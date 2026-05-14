import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

export interface EditorHandle {
  getValue: () => string;
  getHTML: () => string;
  setValue: (value: string) => void;
  isReady: () => boolean;
}

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  settings?: {
    contentTheme?: string;
    codeTheme?: string;
    editMode?: 'wysiwyg' | 'ir' | 'sv';
  };
  onSettingsChange?: (settings: any) => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange, settings, onSettingsChange }, ref) => {
  const vditorRef = useRef<Vditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialValueRef = useRef(value || '');
  const [isInitialized, setIsInitialized] = useState(false);
  const isReinitializingRef = useRef(false);  // 防止重新初始化循环
  const lastEditModeRef = useRef<string | undefined>(undefined);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (!isInitialized || !vditorRef.current) {
        return initialValueRef.current;
      }
      try {
        return vditorRef.current.getValue() || '';
      } catch {
        return initialValueRef.current;
      }
    },
    getHTML: () => {
      if (!isInitialized || !vditorRef.current) {
        return '<p></p>';
      }
      try {
        return vditorRef.current.getHTML() || '<p></p>';
      } catch {
        return '<p></p>';
      }
    },
    setValue: (newValue: string) => {
      if (vditorRef.current && isInitialized) {
        try {
          vditorRef.current.setValue(newValue);
        } catch {
          initialValueRef.current = newValue;
        }
      } else {
        initialValueRef.current = newValue;
      }
    },
    isReady: () => isInitialized
  }), [isInitialized]);

  // 更新编辑器内容
  const updateContent = useCallback((newValue: string) => {
    if (vditorRef.current && isInitialized) {
      try {
        const currentValue = vditorRef.current.getValue();
        if (currentValue !== newValue) {
          vditorRef.current.setValue(newValue);
        }
      } catch {
        // ignore
      }
    }
  }, [isInitialized]);

  // 初始化Vditor
  useEffect(() => {
    if (!containerRef.current) return;

    const contentTheme = settings?.contentTheme || 'classic';
    const codeTheme = settings?.codeTheme || 'github';
    const editMode = settings?.editMode || 'wysiwyg';

    const vd = new Vditor(containerRef.current, {
      // 使用settings中的编辑模式
      mode: editMode,
      value: initialValueRef.current || '# 欢迎使用 Vditor\n\n开始写作吧！',
      cache: {
        id: 'vditor-editor-main'
      },
      cdn: 'https://unpkg.com/vditor@3.11.2',
      // 工具栏配置 - pin固定工具栏
      toolbarConfig: {
        pin: true
      },
      preview: {
        theme: {
          path: 'https://unpkg.com/vditor@3.11.2/dist/css/content-theme',
          list: {
            'classic': 'Classic',
            'dark': 'Dark',
            'wechat': 'WeChat',
            'ant-design': 'Ant Design'
          },
          current: contentTheme
        },
        // @ts-ignore - Vditor类型定义不完整
        codeTheme: {
          list: {
            'github': 'GitHub',
            'monokai': 'Monokai',
            'dark': 'Dark',
            'default': 'Default',
            'vs2015': 'VS2015'
          },
          current: codeTheme
        }
      },
      // 工具栏配置 - WYSIWYG模式只支持部分按钮
      toolbar: [
        // 文件操作（自定义）
        {
          name: 'new',
          tip: '新建 (Ctrl+N)',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>',
          // @ts-ignore - Vditor类型定义不完整
          click: () => {
            if (confirm('新建文件？未保存的内容将丢失。')) {
              window.dispatchEvent(new CustomEvent('vditor-new-file'));
            }
          }
        },
        {
          name: 'open',
          tip: '打开 (Ctrl+O)',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
          // @ts-ignore - Vditor类型定义不完整
          click: () => {
            window.dispatchEvent(new CustomEvent('vditor-open-file'));
          }
        },
        {
          name: 'save',
          tip: '保存 (Ctrl+S)',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 6h9v4H6z"/></svg>',
          // @ts-ignore - Vditor类型定义不完整
          click: () => {
            window.dispatchEvent(new CustomEvent('vditor-save-file'));
          }
        },
        '|',
        // 导出操作（自定义）
        {
          name: 'export-html',
          tip: '导出 HTML',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>',
          // @ts-ignore - Vditor类型定义不完整
          click: () => {
            window.dispatchEvent(new CustomEvent('export-html'));
          }
        },
        {
          name: 'export-pdf',
          tip: '导出 PDF',
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>',
          // @ts-ignore - Vditor类型定义不完整
          click: () => {
            window.dispatchEvent(new CustomEvent('export-pdf'));
          }
        },
        '|',
        // WYSIWYG模式支持的按钮
        'headings',
        'bold',
        'italic',
        'strike',
        '|',
        'emoji',
        'link',
        'list',
        'ordered-list',
        'check',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        '|',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        'both',
        'preview',
        'outline',
        'edit-mode',
        'fullscreen',
        '|',
        'code-theme',
        'content-theme'
      ],
      input: (val: string) => {
        if (onChange) {
          onChange(val);
        }
      },
      after: () => {
        console.log('Vditor initialized successfully!');
        setIsInitialized(true);
        lastEditModeRef.current = settings?.editMode || 'wysiwyg';

        // 强制工具栏左对齐 - 使用setProperty确保优先级
        const fixToolbarAlignment = () => {
          const toolbar = document.querySelector('.vditor-toolbar') as HTMLElement;
          if (toolbar) {
            toolbar.style.setProperty('display', 'flex', 'important');
            toolbar.style.setProperty('justify-content', 'flex-start', 'important');
            toolbar.style.setProperty('flex-wrap', 'wrap', 'important');
            toolbar.style.setProperty('align-items', 'center', 'important');
          }
          // 同样修复工具栏内部容器
          const inner = document.querySelector('.vditor-toolbar__inner') as HTMLElement;
          if (inner) {
            inner.style.setProperty('display', 'flex', 'important');
            inner.style.setProperty('justify-content', 'flex-start', 'important');
            inner.style.setProperty('flex-wrap', 'wrap', 'important');
          }
        };

        // 立即执行
        fixToolbarAlignment();
        // 延迟执行确保样式生效
        setTimeout(fixToolbarAlignment, 50);
        setTimeout(fixToolbarAlignment, 100);
        setTimeout(fixToolbarAlignment, 200);
        setTimeout(fixToolbarAlignment, 500);
      }
    });

    vditorRef.current = vd;

    return () => {
      if (vditorRef.current) {
        try {
          vditorRef.current.destroy();
        } catch (e) {
          // Vditor already destroyed
        }
        vditorRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [onChange, onSettingsChange]);

  // 当外部value变化时更新编辑器
  useEffect(() => {
    if (value !== undefined) {
      updateContent(value);
    }
  }, [value, updateContent]);

  // 监听预览模式切换，保持工具栏布局
  useEffect(() => {
    if (!vditorRef.current || !isInitialized) return;

    const vditorElement = document.querySelector('.vditor');
    if (!vditorElement) return;

    // 修复工具栏样式的函数
    const fixToolbarAlignment = () => {
      // 修复主工具栏容器
      const toolbar = document.querySelector('.vditor-toolbar') as HTMLElement;
      if (toolbar) {
        toolbar.style.setProperty('display', 'flex', 'important');
        toolbar.style.setProperty('justify-content', 'flex-start', 'important');
        toolbar.style.setProperty('flex-wrap', 'wrap', 'important');
        toolbar.style.setProperty('align-items', 'center', 'important');
      }
      // 修复工具栏内部容器
      const inner = document.querySelector('.vditor-toolbar__inner') as HTMLElement;
      if (inner) {
        inner.style.setProperty('display', 'flex', 'important');
        inner.style.setProperty('justify-content', 'flex-start', 'important');
        inner.style.setProperty('flex-wrap', 'wrap', 'important');
        inner.style.setProperty('align-items', 'center', 'important');
      }
    };

    // 立即执行多次
    fixToolbarAlignment();
    setTimeout(fixToolbarAlignment, 50);
    setTimeout(fixToolbarAlignment, 100);
    setTimeout(fixToolbarAlignment, 200);
    setTimeout(fixToolbarAlignment, 500);

    // 监听class变化（预览模式切换）
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          setTimeout(fixToolbarAlignment, 50);
        }
      });
    });

    observer.observe(vditorElement, { attributes: true });

    // 添加一个定时器，持续监测工具栏样式（防止Vditor后续重置）
    const intervalId = setInterval(fixToolbarAlignment, 1000);

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [isInitialized]);

  // 监听设置变化，切换Vditor主题
  useEffect(() => {
    if (!vditorRef.current || !isInitialized) return;

    const newContentTheme = settings?.contentTheme || 'classic';
    const newCodeTheme = settings?.codeTheme || 'github';

    try {
      // 使用Vditor的静态方法切换主题
      Vditor.setContentTheme(newContentTheme, 'https://unpkg.com/vditor@3.11.2/dist/css/content-theme');
      Vditor.setCodeTheme(newCodeTheme);
      console.log('Theme switched:', { contentTheme: newContentTheme, codeTheme: newCodeTheme });
    } catch (e) {
      console.error('Failed to switch theme:', e);
    }
  }, [settings?.contentTheme, settings?.codeTheme, isInitialized]);

  // 监听编辑模式变化，重新初始化Vditor
  useEffect(() => {
    if (!vditorRef.current || !isInitialized || isReinitializingRef.current) return;
    
    const newEditMode = settings?.editMode || 'wysiwyg';
    
    // 只有当editMode真正变化时才重新初始化
    if (lastEditModeRef.current === newEditMode) return;
    lastEditModeRef.current = newEditMode;
    
    // 标记正在重新初始化，防止循环
    isReinitializingRef.current = true;
    
    try {
      // 获取当前内容
      const currentValue = vditorRef.current.getValue();
      const currentContentTheme = settings?.contentTheme || 'classic';
      const currentCodeTheme = settings?.codeTheme || 'github';
      
      // 销毁旧实例
      vditorRef.current.destroy();
      vditorRef.current = null;
      setIsInitialized(false);
      
      // 重新初始化
      setTimeout(() => {
        if (!containerRef.current) return;
        
        const vd = new Vditor(containerRef.current, {
          mode: newEditMode,
          value: currentValue,
          cache: {
            id: 'vditor-editor-main'
          },
          cdn: 'https://unpkg.com/vditor@3.11.2',
          // 工具栏配置 - pin固定工具栏
          toolbarConfig: {
            pin: true
          },
          preview: {
            theme: {
              path: 'https://unpkg.com/vditor@3.11.2/dist/css/content-theme',
              list: {
                'classic': 'Classic',
                'dark': 'Dark',
                'wechat': 'WeChat',
                'ant-design': 'Ant Design'
              },
              current: currentContentTheme
            },
            // @ts-ignore
            codeTheme: {
              list: {
                'github': 'GitHub',
                'monokai': 'Monokai',
                'dark': 'Dark',
                'default': 'Default',
                'vs2015': 'VS2015'
              },
              current: currentCodeTheme
            }
          },
          toolbar: [
            {
              name: 'new',
              tip: '新建 (Ctrl+N)',
              icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>',
              // @ts-ignore
              click: () => {
                if (confirm('新建文件？未保存的内容将丢失。')) {
                  window.dispatchEvent(new CustomEvent('vditor-new-file'));
                }
              }
            },
            {
              name: 'open',
              tip: '打开 (Ctrl+O)',
              icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
              // @ts-ignore
              click: () => {
                window.dispatchEvent(new CustomEvent('vditor-open-file'));
              }
            },
            {
              name: 'save',
              tip: '保存 (Ctrl+S)',
              icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 6h9v4H6z"/></svg>',
              // @ts-ignore
              click: () => {
                window.dispatchEvent(new CustomEvent('vditor-save-file'));
              }
            },
            '|',
            {
              name: 'export-html',
              tip: '导出 HTML',
              icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>',
              // @ts-ignore
              click: () => {
                window.dispatchEvent(new CustomEvent('export-html'));
              }
            },
            {
              name: 'export-pdf',
              tip: '导出 PDF',
              icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>',
              // @ts-ignore
              click: () => {
                window.dispatchEvent(new CustomEvent('export-pdf'));
              }
            },
            '|',
            'headings',
            'bold',
            'italic',
            'strike',
            '|',
            'emoji',
            'link',
            'list',
            'ordered-list',
            'check',
            '|',
            'quote',
            'line',
            'code',
            'inline-code',
            '|',
            'table',
            '|',
            'undo',
            'redo',
            '|',
            'both',
            'preview',
            'outline',
            'edit-mode',
            'fullscreen',
            '|',
            'code-theme',
            'content-theme'
          ],
          input: (val: string) => {
            if (onChange) {
              onChange(val);
            }
          },
          after: () => {
            console.log('Vditor reinitialized for mode change!');
            setIsInitialized(true);
            isReinitializingRef.current = false;  // 重置标志

            // 强制工具栏左对齐 - 使用setProperty确保优先级
            const fixToolbarAlignment = () => {
              const toolbar = document.querySelector('.vditor-toolbar') as HTMLElement;
              if (toolbar) {
                toolbar.style.setProperty('display', 'flex', 'important');
                toolbar.style.setProperty('justify-content', 'flex-start', 'important');
                toolbar.style.setProperty('flex-wrap', 'wrap', 'important');
                toolbar.style.setProperty('align-items', 'center', 'important');
              }
              const inner = document.querySelector('.vditor-toolbar__inner') as HTMLElement;
              if (inner) {
                inner.style.setProperty('display', 'flex', 'important');
                inner.style.setProperty('justify-content', 'flex-start', 'important');
                inner.style.setProperty('flex-wrap', 'wrap', 'important');
              }
            };

            // 立即执行
            fixToolbarAlignment();
            // 延迟执行确保样式生效
            setTimeout(fixToolbarAlignment, 50);
            setTimeout(fixToolbarAlignment, 100);
            setTimeout(fixToolbarAlignment, 200);
            setTimeout(fixToolbarAlignment, 500);
          }
        });
        
        vditorRef.current = vd;
      }, 100);
    } catch (e) {
      console.error('Failed to switch edit mode:', e);
      isReinitializingRef.current = false;  // 出错也要重置
    }
  }, [settings?.editMode, isInitialized, onChange]);

  // 应用初始保存的主题设置（如果与默认值不同）
  useEffect(() => {
    if (!vditorRef.current || !isInitialized) return;

    const savedContentTheme = settings?.contentTheme;
    const savedCodeTheme = settings?.codeTheme;

    // 只有当保存的主题不是默认值时才应用
    if (savedContentTheme && savedContentTheme !== 'classic') {
      try {
        Vditor.setContentTheme(savedContentTheme, 'https://unpkg.com/vditor@3.11.2/dist/css/content-theme');
        console.log('Applied saved content theme:', savedContentTheme);
      } catch (e) {
        console.error('Failed to apply saved content theme:', e);
      }
    }

    if (savedCodeTheme && savedCodeTheme !== 'github') {
      try {
        Vditor.setCodeTheme(savedCodeTheme);
        console.log('Applied saved code theme:', savedCodeTheme);
      } catch (e) {
        console.error('Failed to apply saved code theme:', e);
      }
    }
  }, [isInitialized]);

  // 监听Vditor工具栏主题选择器的变化
  useEffect(() => {
    if (!vditorRef.current || !isInitialized) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastContentTheme = settings?.contentTheme || 'classic';
    let lastCodeTheme = settings?.codeTheme || 'github';

    // 监听 Vditor 工具栏区域的变化
    const vditorElement = document.querySelector('.vditor');
    if (!vditorElement) return;

    const detectAndSaveTheme = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          // 查找 Vditor 工具栏中的主题选择器下拉菜单
          const contentThemeDropdown = vditorElement.querySelector('[data-type="content-theme"]');
          const codeThemeDropdown = vditorElement.querySelector('[data-type="code-theme"]');

          let newContentTheme = lastContentTheme;
          let newCodeTheme = lastCodeTheme;

          // 查找当前选中的主题值
          if (contentThemeDropdown) {
            const selectedItem = contentThemeDropdown.querySelector('.vditor-toolbar__item--current');
            if (selectedItem) {
              const value = selectedItem.getAttribute('data-value');
              if (value) newContentTheme = value;
            }
            // 备选：从按钮文本获取
            if (newContentTheme === lastContentTheme) {
              const tipElement = contentThemeDropdown.querySelector('.vditor-tooltipped');
              if (tipElement) {
                const text = tipElement.textContent || '';
                if (text.includes('Classic')) newContentTheme = 'classic';
                else if (text.includes('Dark')) newContentTheme = 'dark';
                else if (text.includes('WeChat')) newContentTheme = 'wechat';
                else if (text.includes('Ant')) newContentTheme = 'ant-design';
              }
            }
          }

          if (codeThemeDropdown) {
            const selectedItem = codeThemeDropdown.querySelector('.vditor-toolbar__item--current');
            if (selectedItem) {
              const value = selectedItem.getAttribute('data-value');
              if (value) newCodeTheme = value;
            }
          }

          // 如果检测到变化，保存设置
          if (newContentTheme !== lastContentTheme || newCodeTheme !== lastCodeTheme) {
            console.log('[Theme] Detected change:', { contentTheme: newContentTheme, codeTheme: newCodeTheme });
            lastContentTheme = newContentTheme;
            lastCodeTheme = newCodeTheme;

            if (onSettingsChange) {
              onSettingsChange({
                contentTheme: newContentTheme,
                codeTheme: newCodeTheme
              });
            }
          }
        } catch (e) {
          console.error('[Theme] Detection error:', e);
        }
      }, 300);
    };

    // 监听工具栏点击事件
    vditorElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // 检查是否点击了主题相关的按钮
      if (target.closest('[data-type="content-theme"]') ||
          target.closest('[data-type="code-theme"]')) {
        detectAndSaveTheme();
      }
    });

    // 也监听工具栏的 mouseup 事件（按钮释放时）
    vditorElement.addEventListener('mouseup', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-type="content-theme"]') ||
          target.closest('[data-type="code-theme"]')) {
        detectAndSaveTheme();
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isInitialized, settings?.contentTheme, settings?.codeTheme, onSettingsChange]);

  return (
    <div ref={containerRef} style={{ height: '100%', minHeight: '400px' }} />
  );
});

export default Editor;
