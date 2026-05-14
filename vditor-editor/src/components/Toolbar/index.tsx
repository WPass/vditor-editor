import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { EditorHandle } from '../Editor';

interface ToolbarProps {
  onEditorChange?: (content: string) => void;
  editorRef?: React.RefObject<EditorHandle | null>;
  onSave: (content: string, path: string) => void;
  onNewFile: () => void;
  currentPath: string | null;
  onThemeChange: (theme: 'light' | 'dark') => void;
  theme: 'light' | 'dark';
}

export default function Toolbar({
  onEditorChange,
  editorRef,
  onSave,
  onNewFile,
  currentPath,
  onThemeChange,
  theme
}: ToolbarProps) {

  const handleNew = () => {
    if (confirm('新建文件？未保存的内容将丢失。')) {
      if (editorRef?.current) {
        editorRef.current.setValue('');
      }
      onNewFile();
    }
  };

  const handleOpen = async () => {
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
        // 设置编辑器内容
        if (editorRef?.current) {
          editorRef.current.setValue(content);
        } else if (onEditorChange) {
          onEditorChange(content);
        }
        onSave(content, selected);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
      alert('打开文件失败: ' + err);
    }
  };

  const handleSave = async () => {
    try {
      let filePath = currentPath;
      if (!filePath) {
        const selected = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: 'untitled.md'
        });
        if (!selected) return;
        filePath = selected;
      }
      // 获取当前编辑器内容
      const currentContent = editorRef?.current?.getValue() || '';
      await onSave(currentContent, filePath);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleSaveAs = async () => {
    try {
      const selected = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: 'untitled.md'
      });
      if (selected) {
        const currentContent = editorRef?.current?.getValue() || '';
        await onSave(currentContent, selected);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleExportHTML = () => {
    const event = new CustomEvent('export-html');
    window.dispatchEvent(event);
  };

  const handleExportPDF = () => {
    const event = new CustomEvent('export-pdf');
    window.dispatchEvent(event);
  };

  const toggleTheme = () => {
    onThemeChange(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group toolbar-group-start">
        <button className="toolbar-btn" onClick={handleNew}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
          <span className="toolbar-tooltip">新建 (Ctrl+N)</span>
        </button>
        <button className="toolbar-btn" onClick={handleOpen}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          <span className="toolbar-tooltip">打开 (Ctrl+O)</span>
        </button>
        <button className="toolbar-btn" onClick={handleSave}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 6h9v4H6z"/>
          </svg>
          <span className="toolbar-tooltip">保存 (Ctrl+S)</span>
        </button>
        <button className="toolbar-btn" onClick={handleSaveAs}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm3-3H6V6h9v4H6z"/>
          </svg>
          <span className="toolbar-tooltip">另存为 (Ctrl+Shift+S)</span>
        </button>
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleExportHTML}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
          <span className="toolbar-tooltip">导出 HTML</span>
        </button>
        <button className="toolbar-btn" onClick={handleExportPDF}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
          </svg>
          <span className="toolbar-tooltip">导出 PDF</span>
        </button>
      </div>

      <div className="toolbar-spacer"></div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={toggleTheme}>
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M9.37 5.51C9.19 6.15 9.1 6.82 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27C17.45 17.19 14.93 19 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
            </svg>
          )}
          <span className="toolbar-tooltip">{theme === 'light' ? '切换深色模式' : '切换浅色模式'}</span>
        </button>
      </div>
    </div>
  );
}
