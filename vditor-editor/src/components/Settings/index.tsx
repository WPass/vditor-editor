import { useState, useEffect } from 'react';
import './Settings.css';

export interface SettingsData {
  theme: 'light' | 'dark';
  contentTheme: string;
  codeTheme: string;
  editMode: 'wysiwyg' | 'ir' | 'sv';
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsData;
  onSave: (settings: SettingsData) => void;
}

const contentThemeOptions = [
  { value: 'classic', label: 'Classic（经典）' },
  { value: 'dark', label: 'Dark（暗色）' },
  { value: 'wechat', label: 'WeChat（微信）' },
  { value: 'ant-design', label: 'Ant Design' }
];

const codeThemeOptions = [
  { value: 'github', label: 'GitHub' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'dark', label: 'Dark' },
  { value: 'default', label: 'Default' },
  { value: 'vs2015', label: 'VS2015' }
];

const editModeOptions = [
  { value: 'wysiwyg', label: '所见即所得（WYSIWYG）' },
  { value: 'ir', label: '即时渲染（IR）' },
  { value: 'sv', label: '分屏编辑（SV）' }
];

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<SettingsData>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleChange = (key: keyof SettingsData, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>外观</h3>
            <div className="settings-item">
              <label htmlFor="theme">界面主题</label>
              <select
                id="theme"
                value={localSettings.theme}
                onChange={e => handleChange('theme', e.target.value)}
              >
                <option value="light">浅色模式</option>
                <option value="dark">深色模式</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3>编辑器</h3>
            <div className="settings-item">
              <label htmlFor="editMode">编辑模式</label>
              <select
                id="editMode"
                value={localSettings.editMode}
                onChange={e => handleChange('editMode', e.target.value)}
              >
                {editModeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3>预览主题</h3>
            <div className="settings-item">
              <label htmlFor="contentTheme">内容主题</label>
              <select
                id="contentTheme"
                value={localSettings.contentTheme}
                onChange={e => handleChange('contentTheme', e.target.value)}
              >
                {contentThemeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-item">
              <label htmlFor="codeTheme">代码高亮主题</label>
              <select
                id="codeTheme"
                value={localSettings.codeTheme}
                onChange={e => handleChange('codeTheme', e.target.value)}
              >
                {codeThemeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
