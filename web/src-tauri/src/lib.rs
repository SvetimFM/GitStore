use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use tauri::{Manager, State};

struct ServerProcess(Mutex<Option<Child>>);

/// Find the backend dist directory — checks dev path then bundled Resources
fn find_backend_dir(app: &tauri::App) -> Option<std::path::PathBuf> {
    let candidates = vec![
        // Development: relative to web/src-tauri/
        std::path::PathBuf::from("../../dist"),
        // Bundled: files placed flat in Resources
        app.path().resource_dir().ok().unwrap_or_default(),
        // Bundled: nested under backend/
        app.path().resource_dir().ok().map(|p| p.join("backend")).unwrap_or_default(),
    ];

    for candidate in candidates {
        let server_file = candidate.join("server").join("start.js");
        if server_file.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Find the node binary — checks PATH and common install locations
fn find_node() -> String {
    // Check if node is in PATH
    let check = if cfg!(windows) {
        Command::new("where").arg("node").output()
    } else {
        Command::new("which").arg("node").output()
    };

    if let Ok(output) = check {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().lines().next().unwrap_or("node").to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    // Fallback: common paths
    if cfg!(windows) {
        for p in &[
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
        ] {
            if std::path::Path::new(p).exists() { return p.to_string(); }
        }
    } else {
        for p in &["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"] {
            if std::path::Path::new(p).exists() { return p.to_string(); }
        }
    }

    "node".to_string()
}

fn start_backend_server(app: &tauri::App, port: u16) -> Option<Child> {
    let backend_dir = find_backend_dir(app)?;
    let server_script = backend_dir.join("server").join("start.js");
    let working_dir = backend_dir.parent().unwrap_or(&backend_dir).to_path_buf();
    let node = find_node();

    println!("[GitStore] Node: {}", node);
    println!("[GitStore] Backend: {}", server_script.display());

    let mut cmd = Command::new(&node);
    cmd.arg(&server_script)
       .env("PORT", port.to_string())
       .current_dir(&working_dir);

    // On Windows, prevent a console window from appearing
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.spawn().ok()
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
            // Start backend on a background thread so the window appears immediately
            let server_state = app.state::<ServerProcess>();

            match start_backend_server(app, port) {
                Some(child) => {
                    println!("[GitStore] Backend server spawned on port {}", port);
                    *server_state.0.lock().unwrap() = Some(child);

                    // Wait for server readiness in background — don't block UI
                    thread::spawn(move || {
                        for i in 0..40 {
                            if std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
                                println!("[GitStore] Backend ready after {}ms", i * 250);
                                return;
                            }
                            thread::sleep(std::time::Duration::from_millis(250));
                        }
                        eprintln!("[GitStore] Backend failed to start within 10 seconds");
                    });
                }
                None => {
                    eprintln!("[GitStore] Warning: Could not start backend server. Is Node.js installed?");
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
