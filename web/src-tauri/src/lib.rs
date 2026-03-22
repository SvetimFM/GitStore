use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{Manager, State};

struct ServerProcess(Mutex<Option<Child>>);

/// Find the backend dist directory — checks dev path then bundled Resources
fn find_backend_dir(app: &tauri::App) -> Option<std::path::PathBuf> {
    let candidates = vec![
        // Development: relative to web/src-tauri/
        std::path::PathBuf::from("../../dist"),
        // Bundled macOS: files placed flat in Resources
        app.path().resource_dir().ok().unwrap_or_default(),
        // Bundled macOS: nested under backend/
        app.path().resource_dir().ok().map(|p| p.join("backend")).unwrap_or_default(),
    ];

    for candidate in candidates {
        let server_file = candidate.join("server/start.js");
        if server_file.exists() {
            return Some(candidate);
        }
    }
    None
}

fn start_backend_server(app: &tauri::App, port: u16) -> Option<Child> {
    let backend_dir = find_backend_dir(app)?;
    let server_script = backend_dir.join("server/start.js");
    let working_dir = backend_dir.parent().unwrap_or(&backend_dir).to_path_buf();

    println!("[GitStore] Starting backend from: {}", server_script.display());

    let child = Command::new("node")
        .arg(&server_script)
        .env("PORT", port.to_string())
        .current_dir(&working_dir)
        .spawn()
        .ok()?;

    Some(child)
}

/// Wait for the backend server to be ready (up to 10 seconds)
fn wait_for_server(port: u16) -> bool {
    for i in 0..40 {
        if std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            println!("[GitStore] Backend ready after {}ms", i * 250);
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    eprintln!("[GitStore] Backend failed to start within 10 seconds");
    false
}

#[tauri::command]
fn get_server_port() -> u16 {
    3456
}

#[tauri::command]
fn server_health() -> bool {
    std::net::TcpStream::connect("127.0.0.1:3456").is_ok()
}

pub fn run() {
    let port: u16 = 3456;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_server_port, server_health])
        .setup(move |app| {
            let server_state = app.state::<ServerProcess>();
            match start_backend_server(app, port) {
                Some(child) => {
                    println!("[GitStore] Backend server spawned on port {}", port);
                    *server_state.0.lock().unwrap() = Some(child);
                    wait_for_server(port);
                }
                None => {
                    eprintln!("[GitStore] Warning: Could not start backend server.");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state: State<'_, ServerProcess> = window.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(ref mut child) = *guard {
                    let _ = child.kill();
                    let _ = child.wait();
                    println!("[GitStore] Backend server stopped");
                }
                *guard = None;
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running GitStore");
}
