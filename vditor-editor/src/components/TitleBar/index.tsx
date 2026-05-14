import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
  fileName?: string;
  isModified?: boolean;
  onSettingsClick?: () => void;
}

export default function TitleBar({ fileName, isModified, onSettingsClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  // 更新窗口标题（系统任务栏可见）
  useEffect(() => {
    const title = fileName
      ? `${fileName}${isModified ? ' ●' : ''} - Vditor`
      : 'Vditor';
    appWindow.setTitle(title);
  }, [fileName, isModified]);

  useEffect(() => {
    // 初始化最大化状态
    appWindow.isMaximized().then(setIsMaximized);

    // 监听窗口状态变化
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    const maximized = await appWindow.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-title" data-tauri-drag-region>
        <span className="titlebar-icon">📝</span>
        {fileName ? (
          <span className="titlebar-filename">
            {fileName}
            {isModified && <span className="titlebar-modified">●</span>}
          </span>
        ) : (
          <span>Vditor</span>
        )}
      </div>
      <div className="titlebar-buttons">
        {onSettingsClick && (
          <button className="titlebar-btn settings" onClick={onSettingsClick} title="设置">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>
        )}
        <button className="titlebar-btn minimize" onClick={handleMinimize} title="最小化">
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect fill="currentColor" x="1" y="5.5" width="10" height="1" />
          </svg>
        </button>
        <button className="titlebar-btn maximize" onClick={handleMaximize} title={isMaximized ? "还原" : "最大化"}>
          {isMaximized ? (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <rect fill="none" stroke="currentColor" x="2.5" y="3.5" width="6" height="6" strokeWidth="1" />
              <path fill="none" stroke="currentColor" d="M4 3.5V1.5h6v6h-2" strokeWidth="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <rect fill="none" stroke="currentColor" x="1.5" y="1.5" width="9" height="9" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="关闭">
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path fill="currentColor" d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
