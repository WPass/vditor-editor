import { useMemo } from 'react';

interface StatusBarProps {
  content: string;
  mode: string;
}

const modeLabels: Record<string, string> = {
  wysiwyg: '即时渲染',
  sv: '分屏预览',
  ir: '阅读模式',
  markdown: '源码编辑'
};

export default function StatusBar({ content, mode }: StatusBarProps) {
  const stats = useMemo(() => {
    // 字符数
    const chars = content.length;
    // 字数（中文按字计，英文按词计）
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const words = chineseChars + englishWords;
    // 行数
    const lines = content.split('\n').length;
    // 段落数
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim()).length;

    return { chars, words, lines, paragraphs };
  }, [content]);

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className="status-item">{modeLabels[mode]}</span>
      </div>
      <div className="statusbar-right">
        <span className="status-item" title="字符数">{stats.chars} 字符</span>
        <span className="status-item" title="字数">{stats.words} 字</span>
        <span className="status-item" title="行数">{stats.lines} 行</span>
        <span className="status-item" title="段落">{stats.paragraphs} 段</span>
        <span className="status-item">Markdown</span>
      </div>
    </div>
  );
}
