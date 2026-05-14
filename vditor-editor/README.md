# Vditor Markdown Editor

基于 Tauri 2 + React + TypeScript 构建的桌面 Markdown 编辑器，集成了强大的 [Vditor](https://ld246.com/article/1549638747130) 编辑器内核。

## 功能特性

- **实时预览** - 所见即所得的 Markdown 编辑体验
- **多主题支持** - 明暗主题切换，适合不同使用场景
- **文件管理** - 支持新建、打开、保存 Markdown 文件
- **导出功能** - 支持导出为 HTML 格式
- **自定义标题栏** - 使用原生窗口控件，保持应用原生感
- **文件关联** - 支持直接打开 `.md` `.markdown` 等文件

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Tauri 2 |
| 前端 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 编辑器 | Vditor 3.11 |
| 样式 | 原生 CSS |

## 系统要求

- Windows 10/11 (64-bit)
- WebView2 运行时（Windows 11 已预装）

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录下。

## 项目结构

```
vditor-editor/
├── src/                      # React 前端源码
│   ├── components/           # React 组件
│   │   ├── Editor/           # Vditor 编辑器组件
│   │   ├── Settings/         # 设置面板
│   │   ├── StatusBar/        # 状态栏
│   │   ├── TitleBar/         # 自定义标题栏
│   │   └── Toolbar/          # 工具栏
│   ├── App.tsx               # 主应用组件
│   └── main.tsx              # 应用入口
├── src-tauri/                # Tauri/Rust 后端源码
│   ├── src/
│   │   ├── lib.rs            # Rust 库入口
│   │   └── main.rs           # Rust 程序入口
│   ├── capabilities/         # Tauri 权限配置
│   ├── icons/               # 应用图标
│   ├── Cargo.toml            # Rust 依赖配置
│   └── tauri.conf.json       # Tauri 应用配置
├── public/                   # 静态资源
├── package.json              # 前端依赖配置
├── vite.config.ts           # Vite 配置
└── tsconfig.json            # TypeScript 配置
```

## 配置说明

### Tauri 权限

当前已启用以下插件权限：

- `dialog:default` - 文件对话框
- `fs:default` - 文件系统访问
- `opener:default` - 外部链接打开
- `printer:default` - 打印功能

### 文件关联

应用注册了以下文件类型关联：

| 扩展名 | 类型 |
|--------|------|
| `.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn` | Markdown 文档 |
| `.txt` | 纯文本 |

## 快捷键

| 功能 | 快捷键 |
|------|--------|
| 新建文件 | `Ctrl+N` |
| 打开文件 | `Ctrl+O` |
| 保存文件 | `Ctrl+S` |
| 另存为 | `Ctrl+Shift+S` |
| 导出 HTML | `Ctrl+E` |
| 切换主题 | `Ctrl+T` |

## 开发相关

### 推荐的 IDE 配置

- **VS Code** + [Tauri VSCode Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### 添加 Rust 依赖

编辑 `src-tauri/Cargo.toml` 后，重新编译时会自动拉取依赖。

## 许可证

MIT License
