import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { EditorHandle } from './components/Editor';
import TitleBar from './components/TitleBar';
import StatusBar from './components/StatusBar';
import Settings from './components/Settings';
import { writeTextFile, readTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

// Vditor 工具栏修复样式（内联注入，覆盖 Vditor 自带样式）
const vditorToolbarFixCSS = `
/* 工具栏 flex 左对齐，overflow visible 确保子菜单和 tooltip 不被裁剪 */
.vditor .vditor-toolbar,
.vditor-toolbar {
  display: flex !important;
  justify-content: flex-start !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  overflow: visible !important;
  border-bottom: 1px solid var(--border-color) !important;
  background: var(--bg-secondary) !important;
  position: relative !important;
  z-index: 100 !important;
}

/* vditor 容器不裁剪工具栏子菜单 */
.vditor {
  overflow: visible !important;
}

/* 编辑器内容区保持可滚动 */
.vditor-content {
  overflow: auto !important;
}

/* 彻底禁用 Vditor 原生 tooltip（用 JS 全局 tooltip 替代） */
.vditor-toolbar .vditor-tooltipped::before,
.vditor-toolbar .vditor-tooltipped:hover::before,
.vditor-toolbar .vditor-tooltipped::after,
.vditor-toolbar .vditor-tooltipped:hover::after {
  display: none !important;
  content: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}
`;

// 全局Tooltip状态接口
interface GlobalTooltip {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  /** tooltip 相对自身的水平锚点：'left' = tooltip 左边界对齐 x，'center' = 居中对齐 x */
  anchor: 'left' | 'center' | 'right';
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
    y: 0,
    anchor: 'center'
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
      const toolbar = document.querySelector('.vditor-toolbar') as HTMLElement | null;
      if (!toolbar) return;

      const handleMouseOver = (e: Event) => {
        const target = (e as MouseEvent).target as HTMLElement;
        // Vditor 工具栏按钮使用 .vditor-tooltipped class 并携带 aria-label
        const button = target.closest('.vditor-tooltipped') as HTMLElement;
        if (button && button.getAttribute('aria-label')) {
          const rect = button.getBoundingClientRect();
          const label = button.getAttribute('aria-label') || '';
          // 估算 tooltip 宽度（中文约 12px/字，英文约 7px/字，取中间值 + padding）
          const estimatedWidth = label.length * 9 + 20;
          // tooltip 显示在按钮正下方居中
          const centerX = rect.left + rect.width / 2;
          const tooltipY = rect.bottom + 8;

          // 边界检测：居中会超出左/右边界时，自动调整对齐方式
          let anchor: 'left' | 'center' | 'right' = 'center';
          let tooltipX = centerX;
          if (centerX - estimatedWidth / 2 < 8) {
            anchor = 'left';
            tooltipX = rect.left;
          } else if (centerX + estimatedWidth / 2 > window.innerWidth - 8) {
            anchor = 'right';
            tooltipX = rect.right;
          }

          setGlobalTooltip({
            visible: true,
            text: label,
            x: tooltipX,
            y: tooltipY,
            anchor
          });
        }
      };

      const handleMouseOut = (e: Event) => {
        const target = (e as MouseEvent).target as HTMLElement;
        const button = target.closest('.vditor-tooltipped');
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

  // 获取导出用CSS样式 - 从Vditor CDN加载对应主题的完整CSS
  // contentTheme: classic/dark/wechat/ant-design
  const getExportStyles = async (): Promise<string> => {
    const contentTheme = settings.contentTheme || 'classic';
    const codeTheme = settings.codeTheme || 'github';

    // 从Vditor CDN获取内容主题CSS
    let contentThemeCSS = '';
    try {
      const response = await fetch(`https://unpkg.com/vditor@3.11.2/dist/css/content-theme/${contentTheme}.css`);
      if (response.ok) {
        contentThemeCSS = await response.text();
      } else {
        console.warn(`Failed to load content theme CSS: ${contentTheme}`);
        // 降级为内联基础样式
        contentThemeCSS = getFallbackStyles(contentTheme === 'dark');
      }
    } catch (e) {
      console.error('Error loading content theme CSS:', e);
      contentThemeCSS = getFallbackStyles(contentTheme === 'dark');
    }

    // 从Vditor CDN获取代码高亮主题CSS
    let codeThemeCSS = '';
    try {
      const response = await fetch(`https://unpkg.com/vditor@3.11.2/dist/css/code-theme/${codeTheme}.css`);
      if (response.ok) {
        codeThemeCSS = await response.text();
      }
    } catch (e) {
      console.warn('Failed to load code theme CSS');
    }

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
        padding: 40px;
        max-width: 100%;
      }

      /* 内容主题样式 */
      ${contentThemeCSS}

      /* 代码高亮主题样式 */
      ${codeThemeCSS}

      /* 基础样式覆盖（确保在主题样式之后） */
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

      ul, ol {
        padding-left: 24px;
        margin: 8px 0;
      }

      li {
        margin: 4px 0;
      }

      a {
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      /* 打印优化 */
      @media print {
        body {
          background: white !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      }
    `;
  };

  // 降级样式（当CDN加载失败时使用）
  const getFallbackStyles = (isDark: boolean): string => {
    return `
      body {
        color: ${isDark ? '#e0e0e0' : '#333'};
        background: ${isDark ? '#1e1e1e' : '#ffffff'};
      }
      h1, h2, h3, h4, h5, h6 {
        color: ${isDark ? '#ffffff' : '#1a1a1a'};
      }
      h1 { border-bottom: 1px solid ${isDark ? '#404040' : '#eee'}; }
      pre, code {
        background: ${isDark ? '#252526' : '#f6f8fa'};
        color: ${isDark ? '#e0e0e0' : '#333'};
      }
      blockquote {
        border-left: 4px solid ${isDark ? '#4a9eff' : '#0366d6'};
        color: ${isDark ? '#a0a0a0' : '#6a737d'};
        background: ${isDark ? '#252526' : '#f6f8fa'};
      }
      a { color: ${isDark ? '#4a9eff' : '#0366d6'}; }
      table, th, td {
        border: 1px solid ${isDark ? '#404040' : '#dfe2e5'};
      }
      th { background: ${isDark ? '#252526' : '#f6f8fa'}; }
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
          cssStyles: await getExportStyles(),
          title: defaultName,
          filePath,
        });
        console.log('HTML exported:', filePath);
      }
    } catch (err) {
      console.error('Export HTML failed:', err);
      alert('导出HTML失败: ' + err);
    }
  }, [currentPath, settings.contentTheme, settings.codeTheme]);

  // 导出PDF - 通过隐藏iframe触发系统打印对话框（用户选择"另存为PDF"）
  const handleExportPDF = useCallback(async () => {
    if (!editorRef.current?.isReady()) {
      alert('编辑器尚未准备好');
      return;
    }
    
    try {
      // 获取编辑器HTML内容和样式
      const htmlContent = editorRef.current.getHTML();
      const defaultName = currentPath
        ? currentPath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'document'
        : 'document';
      const exportStyles = await getExportStyles();

      // 构建完整HTML（含打印样式）
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${defaultName}</title>
  <style>
    ${exportStyles}
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

      // 创建隐藏iframe进行打印
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        alert('打印初始化失败');
        return;
      }

      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();

      // 等待内容加载后触发打印
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        // 延迟移除iframe，避免打印取消时内容消失
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      };

      console.log('PDF print dialog triggered for:', defaultName);
    } catch (err) {
      console.error('Export PDF failed:', err);
      alert('导出PDF失败: ' + err);
    }
  }, [currentPath, settings.contentTheme, settings.codeTheme]);

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
      {/* 全局Tooltip - position:fixed，完全不受父容器 overflow 限制 */}
      {globalTooltip.visible && (
        <div
          className="vditor-global-tooltip"
          style={{
            left: globalTooltip.x,
            top: globalTooltip.y,
            transform: globalTooltip.anchor === 'center'
              ? 'translateX(-50%)'
              : globalTooltip.anchor === 'right'
                ? 'translateX(-100%)'
                : 'none'
          }}
        >
          {globalTooltip.text}
        </div>
      )}
    </div>
  );
}

export default App;
