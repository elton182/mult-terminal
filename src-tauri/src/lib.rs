mod config;
mod pty;
mod ssh;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use pty::PtyManager;
use ssh::SshManager;

type PtyState = Arc<Mutex<PtyManager>>;
type SshState = Arc<Mutex<SshManager>>;

// ── PTY commands ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn pty_spawn(
    shell_type: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, PtyState>,
) -> Result<pty::TerminalInfo, String> {
    let mgr = state.lock().await;
    mgr.spawn(&shell_type, rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pty_write(
    id: String,
    data: String,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.write(&id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pty_resize(
    id: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.resize(&id, rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pty_kill(
    id: String,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.kill(&id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_available_shells() -> Vec<String> {
    PtyManager::available_shells()
}

// ── SSH commands ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn ssh_connect(
    id: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    key_path: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, SshState>,
) -> Result<String, String> {
    let mgr = state.lock().await;
    mgr.connect(id, host, port, username, password, key_path, rows, cols)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_write(
    id: String,
    data: String,
    state: tauri::State<'_, SshState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.write(&id, data.into_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_resize(
    id: String,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, SshState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.resize(&id, rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_disconnect(
    id: String,
    state: tauri::State<'_, SshState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.disconnect(&id).map_err(|e| e.to_string())
}

// ── System integration commands ───────────────────────────────────────────────

#[tauri::command]
fn create_desktop_shortcut() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.to_string_lossy().replace('\'', "''");

    let script = format!(
        r#"
        $ws = New-Object -ComObject WScript.Shell
        $desktop = [Environment]::GetFolderPath('Desktop')
        $s = $ws.CreateShortcut("$desktop\multerm.lnk")
        $s.TargetPath = '{exe}'
        $s.Description = 'Multi Terminal Manager'
        $s.IconLocation = '{exe},0'
        $s.Save()
        Write-Host "OK"
        "#,
        exe = exe_str
    );

    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("PowerShell error: {}", err));
    }
    Ok(())
}

#[tauri::command]
fn get_auto_startup() -> bool {
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };

    let script = format!(
        r#"$v = (Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'multerm' -ErrorAction SilentlyContinue).multerm; if ($v -eq '{}') {{ 'true' }} else {{ 'false' }}"#,
        exe.to_string_lossy().replace('\'', "''")
    );

    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output();

    matches!(out, Ok(o) if String::from_utf8_lossy(&o.stdout).trim() == "true")
}

#[tauri::command]
fn set_auto_startup(enable: bool) -> Result<(), String> {
    let script = if enable {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        format!(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'multerm' -Value '{}'",
            exe.to_string_lossy().replace('\'', "''")
        )
    } else {
        "Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'multerm' -ErrorAction SilentlyContinue".to_string()
    };

    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("PowerShell error: {}", err));
    }
    Ok(())
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let pty_mgr = Arc::new(Mutex::new(PtyManager::new(handle.clone())));
            let ssh_mgr = Arc::new(Mutex::new(SshManager::new(handle)));
            app.manage(pty_mgr);
            app.manage(ssh_mgr);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            get_available_shells,
            ssh_connect,
            ssh_write,
            ssh_resize,
            ssh_disconnect,
            create_desktop_shortcut,
            get_auto_startup,
            set_auto_startup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
