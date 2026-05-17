// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{Emitter, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 导出HTML - 包含完整样式，直接写入文件
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

    fs::write(&file_path, full_html.as_bytes())
        .map_err(|e| format!("写入HTML文件失败: {}", e))?;

    Ok(())
}

/// 导出PDF - 将完整HTML写入临时文件，通过系统默认浏览器打开（用户在浏览器中另存为PDF）
#[tauri::command]
async fn export_pdf_via_print(
    _app: tauri::AppHandle,
    html_content: String,
    _title: String,
) -> Result<String, String> {
    use std::fs;

    // 获取临时目录，写入临时HTML
    let temp_dir = std::env::temp_dir();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_file = temp_dir.join(format!("vditor_print_{}.html", ts));
    let temp_path = temp_file.to_string_lossy().to_string();

    fs::write(&temp_file, html_content.as_bytes())
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 使用 opener 插件在默认浏览器打开，用户可使用浏览器打印功能保存为PDF
    tauri_plugin_opener::open_path(temp_path.clone(), None::<&str>)
        .map_err(|e| format!("打开文件失败: {}", e))?;

    Ok(temp_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_printer_v2::init())
        .invoke_handler(tauri::generate_handler![greet, export_html, export_pdf_via_print])
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
