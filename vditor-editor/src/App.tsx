import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { EditorHandle } from './components/Editor';
import TitleBar from './components/TitleBar';
import StatusBar from './components/StatusBar';
import Settings from './components/Settings';
import { writeTextFile, readTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getPrinters } from 'tauri-plugin-printer-v2';
import './App.css';

// Vditor 工具栏强制左对齐样式
const vditorToolbarFixCSS = `
/* Vditor工具栏强制左对齐 - 最高优先级 */
.vditor .vditor-toolbar {
  display: flex !important;
  justify-content: flex-start !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  border-bottom: 1px solid var(--border-color) !important;
  background: var(--bg-secondary) !important;
}

.vditor-toolbar {
  display: flex !important;
  justify-content: flex-start !important;
  flex-wrap: wrap !important;
  align-items: center !important;
}

.vditor-toolbar__inner {
  display: flex !important;
  justify-content: flex-start !important;
  flex-wrap: wrap !important;
  align-items: center !important;
}

/* 禁用原生tooltip，避免被裁剪 */
.vditor-toolbar .vditor-tooltipped::before,
.vditor-toolbar .vditor-tooltipped::after {
  display: none !important;
}
`;

// 全局Tooltip状态接口
interface GlobalTooltip {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

// 用户设置接口
interface UserSettings {
  theme: 'light' | 'dark';
  contentTheme: string;
  codeTheme: string;
  editMode: 'wysiwyg' | 'ir' | 'sv';
}

// 默认设置
const defaultSettings: UserSettings = {
  theme: 'light',
  contentTheme: 'classic',
  codeTheme: 'github',
  editMode: 'wysiwyg'
};

// 设置文件名称
const SETTINGS_FILENAME = 'settings.json';

// 确保应用数据目录存在
const ensureAppDataDir = async (): Promise<void> => {
  try {
    const dirExists = await exists('', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch (e) {
    console.error('Failed to create app data dir:', e);
  }
};

// 加载用户设置（异步）
const loadSettings = async (): Promise<UserSettings> => {
  try {
    await ensureAppDataDir();
    const fileExists = await exists(SETTINGS_FILENAME, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      const content = await readTextFile(SETTINGS_FILENAME, { baseDir: BaseDirectory.AppData });
      const parsed = JSON.parse(content);
      console.log('Settings loaded from file:', parsed);
      return { ...defaultSettings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
};

// 保存用户设置（异步）
const saveSettingsToFile = async (settings: UserSettings): Promise<void> => {
  try {
    await ensureAppDataDir();
    const content = JSON.stringify(settings, null, 2);
    console.log('[Settings] Attempting to save:', content);
    await writeTextFile(SETTINGS_FILENAME, content, { baseDir: BaseDirectory.AppData });
    console.log('[Settings] Saved successfully');
  } catch (e) {
    console.error('[Settings] Save failed:', e);
  }
};

function App() {
  const [content, setContent] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [globalTooltip, setGlobalTooltip] = useState<GlobalTooltip>({
    visible: false,
    text: '',
    x: 0,
    y: 0
  });
  const editorRef = useRef<EditorHandle>(null);

  // 应用主题到DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // 注入Vditor工具栏修复样式
  useEffect(() => {
    const styleId = 'vditor-toolbar-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = vditorToolbarFixCSS;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, []);

  // 异步加载设置
  useEffect(() => {
    const initSettings = async () => {
      const loaded = await loadSettings();
      setSettings(loaded);
      setSettingsLoaded(true);
      console.log('Settings loaded:', loaded);
    };
    initSettings();
  }, []);

  // 全局Tooltip监听器 - 监听Vditor工具栏按钮hover
  useEffect(() => {
    // 等待Vditor初始化
    const timeoutId = setTimeout(() => {
      const toolbar = document.querySelector('.vditor-toolbar');
      if (!toolbar) return;

      const handleMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // 查找带有aria-label的按钮元素
        const button = target.closest('.vditor-toolbar__button') as HTMLElement;
        if (button && button.getAttribute('aria-label')) {
          const rect = button.getBoundingClientRect();
          setGlobalTooltip({
            visible: true,
            text: button.getAttribute('aria-label') || '',
            x: rect.right + 12,
            y: rect.top + rect.height / 2
          });
        }
      };

      const handleMouseOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.vditor-toolbar__button');
        if (button) {
          setGlobalTooltip(prev => ({ ...prev, visible: false }));
        }
      };

      toolbar.addEventListener('mouseover', handleMouseOver);
      toolbar.addEventListener('mouseout', handleMouseOut);

      return () => {
        toolbar.removeEventListener('mouseover', handleMouseOver);
        toolbar.removeEventListener('mouseout', handleMouseOut);
      };
    }, 500); // 延迟等待Vditor初始化

    return () => clearTimeout(timeoutId);
  }, [settingsLoaded]);

  // 监听命令行文件参数（文件关联打开）
  useEffect(() => {
    const handler = async (e: Event) => {
      const event = e as CustomEvent<string>;
      const filePath = event.detail;
      console.log('[App] Opening file from CLI:', filePath);
      try {
        const content = await readTextFile(filePath);
        setContent(content);
        setCurrentPath(filePath);
        setIsModified(false);
        editorRef.current?.setValue(content);
      } catch (err) {
        console.error('[App] Failed to open file:', err);
        alert('打开文件失败: ' + err);
      }
    };

    window.addEventListener('open-file-from-cli', handler);
    return () => window.removeEventListener('open-file-from-cli', handler);
  }, []);

  // 监听拖拽文件 (Tauri 2 拖拽事件)
  useEffect(() => {
    let unlistenDrop: UnlistenFn | undefined;
    let unlistenHover: UnlistenFn | undefined;

    const setupListeners = async () => {
      // 监听拖拽悬停开始
      unlistenHover = await listen('tauri://drag-enter', () => {
        document.body.classList.add('drag-over');
      });

      // 监听拖拽悬停结束
      await listen('tauri://drag-leave', () => {
        document.body.classList.remove('drag-over');
      });

      // 监听文件放下事件
      unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
        document.body.classList.remove('drag-over');
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          const filePath = paths[0];
          const fileName = filePath.split(/[/\\]/).pop() || '';

          // 检查是否是文本文件
          if (fileName.match(/\.(md|markdown|mdown|mkd|txt)$/i)) {
            console.log('[App] Dropped file:', filePath);
            try {
              const content = await readTextFile(filePath);
              setContent(content);
              setCurrentPath(filePath);
              setIsModified(false);
              editorRef.current?.setValue(content);
            } catch (err) {
              console.error('[App] Failed to read dropped file:', err);
              alert('读取文件失败: ' + err);
            }
          } else {
            alert('仅支持 .md, .markdown, .txt 文件');
          }
        }
      });
    };

    setupListeners();

    return () => {
      unlistenDrop?.();
      unlistenHover?.();
    };
  }, []);

  // 处理保存
  const handleSave = useCallback(async (saveContent: string, filePath: string) => {
    if (filePath) {
      try {
        await writeTextFile(filePath, saveContent);
        setCurrentPath(filePath);
        setIsModified(false);
        console.log('File saved:', filePath);
      } catch (err) {
        console.error('Failed to save:', err);
        alert('保存失败: ' + err);
      }
    }
  }, []);

  // 处理新建文件
  const handleNewFile = useCallback(() => {
    setContent('');
    setCurrentPath(null);
    setIsModified(false);
    editorRef.current?.setValue('');
  }, []);

  // 处理编辑器内容变化
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setIsModified(true);
  }, []);

  // 更新设置并持久化
  const handleSettingsChange = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // 异步保存到文件
      saveSettingsToFile(updated);
      return updated;
    });
  }, []);

  // 处理设置面板的保存
  const handleSettingsSave = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettingsToFile(newSettings);
    console.log('[Settings] Saved from settings panel:', newSettings);
  }, []);

  // 打开文件
  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (selected) {
        const content = await readTextFile(selected);
        setContent(content);
        setCurrentPath(selected);
        setIsModified(false);
        editorRef.current?.setValue(content);
        console.log('File opened:', selected);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
      alert('打开文件失败: ' + err);
    }
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (isModified && !confirm('新建文件？未保存的更改将丢失。')) return;
        handleNewFile();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const currentContent = editorRef.current?.getValue() || content;
        if (currentPath) {
          await writeTextFile(currentPath, currentContent);
          setIsModified(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, currentPath, isModified, handleNewFile]);

  // 获取文件名称
  const fileName = currentPath
    ? currentPath.split(/[/\\]/).pop()
    : '未命名.md';

  // 获取导出用CSS样式 - 根据当前主题
  const getExportStyles = (): string => {
    const isDark = settings.theme === 'dark';
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
        font-size: 14px;
        line-height: 1.8;
        color: ${isDark ? '#e0e0e0' : '#333'};
        background: ${isDark ? '#1e1e1e' : '#ffffff'};
        padding: 40px;
        max-width: 100%;
      }
      
      h1 { 
        font-size: 24px; 
        margin: 24px 0 16px; 
        border-bottom: 1px solid ${isDark ? '#404040' : '#eee'}; 
        padding-bottom: 8px;
        color: ${isDark ? '#ffffff' : '#1a1a1a'};
      }
      h2 { font-size: 20px; margin: 20px 0 12px; color: ${isDark ? '#e0e0e0' : '#333'}; }
      h3 { font-size: 17px; margin: 16px 0 10px; color: ${isDark ? '#e0e0e0' : '#333'}; }
      h4, h5, h6 { font-size: 15px; margin: 12px 0 8px; color: ${isDark ? '#e0e0e0' : '#333'}; }
      
      p { margin: 8px 0; }
      
      pre {
        background: ${isDark ? '#252526' : '#f6f8fa'};
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 13px;
        margin: 12px 0;
        border: 1px solid ${isDark ? '#404040' : '#e1e4e8'};
        color: ${isDark ? '#e0e0e0' : '#333'};
      }
      
      code {
        background: ${isDark ? '#252526' : '#f6f8fa'};
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 90%;
        font-family: 'Consolas', 'Monaco', 'Source Code Pro', monospace;
        color: ${isDark ? '#e0e0e0' : '#333'};
      }
      
      pre code { 
        background: transparent; 
        padding: 0; 
      }
      
      blockquote {
        border-left: 4px solid ${isDark ? '#4a9eff' : '#0366d6'};
        margin: 12px 0;
        padding: 8px 16px;
        color: ${isDark ? '#a0a0a0' : '#6a737d'};
        background: ${isDark ? '#252526' : '#f6f8fa'};
      }
      
      img { 
        max-width: 100%; 
        height: auto; 
        margin: 12px 0; 
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
      }
      
      table, th, td {
        border: 1px solid ${isDark ? '#404040' : '#dfe2e5'};
        padding: 8px 12px;
      }
      
      th { 
        background: ${isDark ? '#252526' : '#f6f8fa'}; 
        font-weight: 600; 
      }
      
      tr:nth-child(even) {
        background: ${isDark ? '#252526' : '#fafbfc'};
      }
      
      ul, ol { 
        padding-left: 24px; 
        margin: 8px 0; 
      }
      
      li { margin: 4px 0; }
      
      hr { 
        border: none; 
        border-top: 1px solid ${isDark ? '#404040' : '#dfe2e5'}; 
        margin: 24px 0; 
      }
      
      a { 
        color: ${isDark ? '#4a9eff' : '#0366d6'}; 
        text-decoration: none; 
      }
      
      a:hover {
        text-decoration: underline;
      }
      
      /* 代码高亮主题 */
      .hljs {
        background: transparent !important;
      }
      
      /* 打印优化 */
      @media print {
        body {
          background: white !important;
          color: #333 !important;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #1a1a1a !important;
        }
        
        pre, code {
          background: #f6f8fa !important;
          border-color: #e1e4e8 !important;
          color: #333 !important;
        }
        
        blockquote {
          background: #f6f8fa !important;
          border-left-color: #0366d6 !important;
          color: #6a737d !important;
        }
        
        table, th, td {
          border-color: #dfe2e5 !important;
        }
        
        th {
          background: #f6f8fa !important;
        }
        
        a {
          color: #0366d6 !important;
        }
      }
    `;
  };

  // 导出HTML - 使用应用主题
  const handleExportHTML = useCallback(async () => {
    if (!editorRef.current?.isReady()) {
      alert('编辑器尚未准备好');
      return;
    }
    try {
      const htmlContent = editorRef.current.getHTML();
      const defaultName = currentPath
        ? currentPath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'document'
        : 'document';

      // 使用Tauri保存对话框
      const filePath = await save({
        defaultPath: `${defaultName}.html`,
        filters: [{ name: 'HTML', extensions: ['html'] }]
      });

      if (filePath) {
        // 调用后端命令导出HTML
        await invoke('export_html', {
          htmlContent,
          cssStyles: getExportStyles(),
          title: defaultName,
          filePath,
        });
        console.log('HTML exported:', filePath);
      }
    } catch (err) {
      console.error('Export HTML failed:', err);
      alert('导出HTML失败: ' + err);
    }
  }, [currentPath, settings.theme]);

  // 导出PDF - 使用tauri-plugin-printer-v2生成PDF
  const handleExportPDF = useCallback(async () => {
    if (!editorRef.current?.isReady()) {
      alert('编辑器尚未准备好');
      return;
    }
    
    try {
      // 获取编辑器内容
      const htmlContent = editorRef.current.getHTML();
      const defaultName = currentPath
        ? currentPath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'document'
        : 'document';

      // 选择保存路径
      const filePath = await save({
        defaultPath: `${defaultName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (!filePath) return;

      // 构建完整HTML
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    ${getExportStyles()}
    @media print {
      @page { size: A4; margin: 15mm; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

      // 获取可用打印机列表
      const printersStr = await getPrinters();
      const printers = JSON.parse(printersStr);
      
      // 查找"Microsoft Print to PDF"虚拟打印机
      const pdfPrinter = printers.find((p: any) => 
        p.name && (p.name.includes('Microsoft Print to PDF') || p.name.includes('PDF'))
      );
      
      if (!pdfPrinter) {
        // 如果没有找到PDF打印机，使用默认打印机
        console.log('No PDF printer found, available printers:', printers.map((p: any) => p.name));
        // 回退到Vditor内置的打印方式
        if (editorRef.current) {
          const vditor = (editorRef.current as any).vditorRef?.current;
          if (vditor && vditor.exportPDF) {
            vditor.exportPDF();
            return;
          }
        }
        alert('未找到可用的PDF打印机，请确保系统已安装"Microsoft Print to PDF"虚拟打印机');
        return;
      }

      // 使用printer插件打印HTML
      const { printHtml } = await import('tauri-plugin-printer-v2');
      
      await printHtml({
        id: 'vditor-export',
        html: fullHtml,
        printer: pdfPrinter.name,
        page_size: 'A4',
        orientation: 'portrait',
        remove_after_print: false,
        margin: {
          top: 15,
          bottom: 15,
          left: 15,
          right: 15,
          unit: 'mm'
        },
        quality: 100,
        grayscale: false,
        copies: 1
      });

      console.log('PDF export completed via printer:', pdfPrinter.name);
      alert('PDF已发送到打印机。请在打印机设置中选择输出到文件或使用虚拟打印机。');
    } catch (err) {
      console.error('Export PDF failed:', err);
      
      // 回退到Vditor内置的打印方式
      try {
        const vditor = (editorRef.current as any).vditorRef?.current;
        if (vditor && vditor.exportPDF) {
          vditor.exportPDF();
          return;
        }
      } catch (e) {
        console.error('Fallback to Vditor export also failed:', e);
      }
      
      alert('导出PDF失败: ' + err);
    }
  }, [currentPath, settings.theme]);

  // 监听导出事件
  useEffect(() => {
    const handleExportHTMLEvent = () => handleExportHTML();
    const handleExportPDFEvent = () => handleExportPDF();
    const handleNewFileEvent = () => {
      if (isModified && !confirm('新建文件？未保存的更改将丢失。')) return;
      handleNewFile();
    };
    const handleOpenFileEvent = () => handleOpenFile();
    const handleSaveFileEvent = () => {
      const currentContent = editorRef.current?.getValue() || content;
      if (currentPath) {
        handleSave(currentContent, currentPath);
      } else {
        // 另存为
        save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: 'untitled.md'
        }).then(filePath => {
          if (filePath) {
            handleSave(currentContent, filePath);
          }
        });
      }
    };

    window.addEventListener('export-html', handleExportHTMLEvent);
    window.addEventListener('export-pdf', handleExportPDFEvent);
    window.addEventListener('vditor-new-file', handleNewFileEvent);
    window.addEventListener('vditor-open-file', handleOpenFileEvent);
    window.addEventListener('vditor-save-file', handleSaveFileEvent);

    return () => {
      window.removeEventListener('export-html', handleExportHTMLEvent);
      window.removeEventListener('export-pdf', handleExportPDFEvent);
      window.removeEventListener('vditor-new-file', handleNewFileEvent);
      window.removeEventListener('vditor-open-file', handleOpenFileEvent);
      window.removeEventListener('vditor-save-file', handleSaveFileEvent);
    };
  }, [handleExportHTML, handleExportPDF, handleNewFile, handleOpenFile, handleSave, currentPath, content, isModified]);

  // 设置加载完成前显示加载状态
  if (!settingsLoaded) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>加载中...</div>
          <div style={{ color: '#666' }}>正在加载用户设置</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${settings.theme}`}>
      <TitleBar
        fileName={fileName}
        isModified={isModified}
        onSettingsClick={() => setSettingsPanelOpen(true)}
      />
      <div className="main-content">
        <div className="editor-wrapper">
          <Editor
            ref={editorRef}
            value={content}
            onChange={handleContentChange}
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      </div>
      <StatusBar content={content} mode={settings.editMode} />
      <Settings
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={settings}
        onSave={handleSettingsSave}
      />
      {/* 全局Tooltip - position:fixed避免被overflow裁剪 */}
      {globalTooltip.visible && (
        <div
          className="vditor-global-tooltip"
          style={{
            left: globalTooltip.x,
            top: globalTooltip.y,
            transform: 'translateY(-50%)'
          }}
        >
          {globalTooltip.text}
        </div>
      )}
    </div>
  );
}

export default App;
