# Vditor Editor 工具栏 UI 修复记录

> 项目：WPass/vditor-editor | 技术栈：Tauri 2 + React + Vite + Vditor
> 日期：2026-05-17

---

## 一、问题总览

| # | 问题 | 根因 | 修复方式 |
|---|------|------|----------|
| 1 | 工具栏最左边"新建"按钮 tooltip 显示不全 | Vditor 原生 `::after` tooltip 使用 `position:absolute` + `left:50% translateX(-50%)`，最左侧按钮的 tooltip 左半部分超出窗口边界 | 禁用原生 tooltip，改用 JS `position:fixed` 全局 tooltip + 边界检测 |
| 2 | 修复后所有 tooltip 不显示 | `closest()` 使用了错误的 class 名 `.vditor-toolbar__button`，Vditor 实际用 `.vditor-tooltipped` | 修正为 `target.closest('.vditor-tooltipped')` |
| 3 | 工具栏按钮子菜单上方内容被裁剪/被标题栏遮盖 | 5层祖先元素 `overflow:hidden` 依次裁剪 `position:absolute` 的 `.vditor-panel`；标题栏 z-index 高于子菜单 | 解除全部 `overflow:hidden`；标题栏设低 z-index，工具栏设高 z-index |

---

## 二、核心概念：CSS 溢出裁剪链

### 2.1 裁剪原理

CSS 规范规定：`position:absolute` 的元素会被**最近的有 `overflow:hidden` 的祖先**裁剪，无论中间隔了多少层。

```
DOM 层级（从外到内）：

html/body          overflow: hidden  ← 防止页面滚动条，保留
  └─ #root         overflow: hidden  ← 裁剪！→ 改为 visible
      └─ .app      overflow: hidden  ← 裁剪！→ 改为 visible
          └─ .main-content  overflow: hidden  ← 裁剪！→ 改为 visible
              └─ .editor-wrapper   overflow: visible  ✓
                  └─ .editor-container  overflow: visible  ✓
                      └─ .vditor      overflow: visible  ✓
                          └─ .vditor-toolbar  overflow: visible  ✓
                              └─ .vditor-toolbar__item
                                  └─ .vditor-panel  ← 需要向上溢出！
```

**任何一层 `overflow:hidden` 都会导致子菜单被裁剪。** 之前只修了最内层2个，外层3个仍在裁剪。

### 2.2 修复方案

| 层级 | 元素 | 修复前 | 修复后 | 说明 |
|------|------|--------|--------|------|
| 1 | `html, body` | `overflow: hidden` | `overflow: hidden` | 保留，防止页面滚动条 |
| 2 | `#root` | `overflow: hidden` | `overflow: visible` | 解除裁剪 |
| 3 | `.app` | `overflow: hidden` | `overflow: visible` | 解除裁剪 |
| 4 | `.main-content` | `overflow: hidden` | `overflow: visible` + `min-height:0` | 解除裁剪 + flex 收缩 |
| 5 | `.editor-wrapper` | `overflow: visible` | `+ min-height:0` | flex 收缩 |
| 6 | `.editor-container` | `overflow: visible` | `+ min-height:0` | flex 收缩 |
| 7 | `.vditor` | `overflow: visible` | 不变 | |
| 8 | `.vditor-toolbar` | `overflow: visible` | 不变 | |

> **`min-height:0` 的作用**：flex 子项默认 `min-height: auto`，在 `overflow:visible` 时会导致子项无法正确收缩，内容溢出而非被裁剪但布局异常。设为 `0` 确保 flex 布局正常。

---

## 三、标题栏遮盖问题

### 3.1 问题

子菜单 `.vditor-panel` 向上展开时，虽然不再被裁剪，但被 `.titlebar` 遮盖（标题栏绘制在子菜单上方）。

### 3.2 修复

通过 z-index 层叠控制显示优先级：

```css
.titlebar {
  position: relative;
  z-index: 1;       /* 低优先级 */
}

.vditor-toolbar {
  position: relative;
  z-index: 100;      /* 高优先级，子菜单继承 */
}
```

子菜单 `.vditor-panel` 是 `.vditor-toolbar` 的后代，继承其层叠上下文，z-index 高于标题栏，因此能覆盖在标题栏上方显示。

---

## 四、全局 Tooltip 方案（JS position:fixed）

### 4.1 为什么要替代原生 tooltip

Vditor 原生 tooltip 使用 `::after` 伪元素 + `position:absolute`，存在两个问题：
1. 被任何 `overflow:hidden` 祖先裁剪
2. 居中对齐时边缘按钮的 tooltip 超出窗口

### 4.2 实现架构

```
┌─────────────────────────────────────────────┐
│ React App                                    │
│  ┌─ .vditor-toolbar (监听 mouseover/mouseout) │
│  │   └─ .vditor-tooltipped[aria-label]        │
│  │                                             │
│  │  hover → handleMouseOver()                  │
│  │    ├─ 获取按钮 rect                         │
│  │    ├─ 估算 tooltip 宽度                     │
│  │    ├─ 边界检测 → 决定 anchor                │
│  │    └─ setGlobalTooltip({x, y, anchor})      │
│  │                                             │
│  │  out → handleMouseOut()                     │
│  │    └─ setGlobalTooltip({visible: false})    │
│  │                                             │
│  └─ .vditor-global-tooltip (position:fixed)    │
│      完全脱离文档流，不受 overflow 限制          │
└─────────────────────────────────────────────┘
```

### 4.3 边界检测逻辑

```ts
const estimatedWidth = label.length * 9 + 20;
const centerX = rect.left + rect.width / 2;

let anchor: 'left' | 'center' | 'right' = 'center';
let tooltipX = centerX;

if (centerX - estimatedWidth / 2 < 8) {
  // 居中时左边超出屏幕 → 锚定左边界
  anchor = 'left';
  tooltipX = rect.left;
} else if (centerX + estimatedWidth / 2 > window.innerWidth - 8) {
  // 居中时右边超出屏幕 → 锚定右边界
  anchor = 'right';
  tooltipX = rect.right;
}
```

### 4.4 关键接口

```ts
interface GlobalTooltip {
  visible: boolean;
  text: string;
  x: number;      // tooltip 定位 X（像素）
  y: number;      // tooltip 定位 Y（像素，rect.bottom + 8）
  anchor: 'left' | 'center' | 'right';  // 水平对齐方式
}
```

---

## 五、修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `index.html` | `#root` 从 `overflow:hidden` 改为 `overflow:visible`，`html/body` 保持 `overflow:hidden` |
| `src/App.css` | `.app` / `.main-content` 改为 `overflow:visible` + `min-height:0`；`.titlebar` 加 `position:relative; z-index:1`；`.vditor-global-tooltip` 及箭头样式 |
| `src/App.tsx` | `GlobalTooltip` 接口（含 `anchor` 字段）；`handleMouseOver` 边界检测；`handleMouseOut` 修正 class 选择器；tooltip render 动态 transform |
| `src/App.tsx` (vditorToolbarFixCSS) | `.vditor-toolbar` flex + overflow:visible + z-index:100；`.vditor` overflow:visible；禁用原生 `::before`/`::after` tooltip |

---

## 六、技术要点速查

| 主题 | 要点 |
|------|------|
| Vditor 按钮选择器 | `.vditor-tooltipped`（带 `aria-label`），不是 `.vditor-toolbar__button` |
| overflow 裁剪链 | 任何一层 `overflow:hidden` 都会裁剪 `position:absolute` 的后代，必须全部解除 |
| flex + overflow:visible | 子项必须加 `min-height:0`，否则无法正确收缩 |
| position:fixed vs absolute | fixed 脱离文档流不受 overflow 限制；absolute 受限 |
| z-index 层叠 | `.titlebar` z-index:1 < `.vditor-toolbar` z-index:100，子菜单覆盖标题栏 |
| Tooltip 宽度估算 | `label.length * 9 + 20`（中英文混合取中间值） |

---

## 七、其他已修复问题

### 7.1 TypeScript 类型错误
- `querySelector('.vditor-toolbar')` 返回 `Element | null`，改为 `as HTMLElement | null`
- 事件处理器参数类型 `(e: Event) => void`，内部强转 `e as MouseEvent`

### 7.2 移除 printer 插件
- `import { getPrinters } from 'tauri-plugin-printer-v2'` 顶层 import 崩溃
- 完全废弃 printer 插件

### 7.3 PDF 导出
- 前端隐藏 iframe + `contentWindow.print()` + A4 @page CSS
- 备用方案：`tauri_plugin_opener::open_path` 在默认浏览器打开
