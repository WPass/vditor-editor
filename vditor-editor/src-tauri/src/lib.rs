// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{Emitter, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 导出HTML - 包含完整样式
#[tauri::command]
fn export_html(
    html_content: String,
    css_styles: String,
    title: String,
    file_path: String,
) -> Result<(), String> {
    use std::fs;

    let full_html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        {}
    </style>
</head>
<body>
{}
</body>
</html>"#,
        title, css_styles, html_content
    );

    fs::write(&file_path, &full_html)
        .map_err(|e| format!("写入HTML文件失败: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_printer_v2::init())
        .invoke_handler(tauri::generate_handler![greet, export_html])
        .setup(|app| {
            // 处理命令行参数（文件关联打开）
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = &args[1];
                println!("Opening file: {}", file_path);
                // 通知前端打开文件
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("open-file-from-cli", file_path);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
