mod config;
mod pty;
mod ssh;
mod transfer;

use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use pty::PtyManager;
use ssh::SshManager;
use transfer::{ProgressReporter, TransferManager};

type PtyState = Arc<Mutex<PtyManager>>;
type SshState = Arc<Mutex<SshManager>>;
type TransferState = Arc<Mutex<TransferManager>>;

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

// ── File transfer commands ────────────────────────────────────────────────────

#[tauri::command]
async fn transfer_sftp_connect(
    id: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    key_path: String,
    passphrase: String,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.sftp_connect(id, host, port, username, password, key_path, passphrase)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_sftp_from_ssh(
    id: String,
    ssh_terminal_id: String,
    transfer_state: tauri::State<'_, TransferState>,
    ssh_state: tauri::State<'_, SshState>,
) -> Result<(), String> {
    let ssh_mgr = ssh_state.lock().await;
    let transfer_mgr = transfer_state.lock().await;
    transfer_mgr
        .sftp_from_ssh(id, &ssh_terminal_id, &ssh_mgr)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_ftp_connect(
    id: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.ftp_connect(id, host, port, username, password)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_disconnect(
    id: String,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.disconnect(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_list_remote(
    id: String,
    path: String,
    state: tauri::State<'_, TransferState>,
) -> Result<Vec<transfer::FileEntry>, String> {
    let mgr = state.lock().await;
    mgr.list_remote(&id, &path).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn transfer_list_local(path: String) -> Result<Vec<transfer::FileEntry>, String> {
    transfer::list_local_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn transfer_local_home() -> Result<String, String> {
    transfer::local_home().map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_upload(
    id: String,
    local_path: String,
    remote_path: String,
    app: AppHandle,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let file_name = std::path::Path::new(&local_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("arquivo")
        .to_string();
    let progress = ProgressReporter::new(app, id.clone(), "upload", file_name);
    let mgr = state.lock().await;
    mgr.upload(&id, &local_path, &remote_path, Some(progress))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_download(
    id: String,
    remote_path: String,
    local_path: String,
    app: AppHandle,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let file_name = std::path::Path::new(&remote_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("arquivo")
        .to_string();
    let progress = ProgressReporter::new(app, id.clone(), "download", file_name);
    let mgr = state.lock().await;
    mgr.download(&id, &remote_path, &local_path, Some(progress))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_mkdir_remote(
    id: String,
    path: String,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.mkdir_remote(&id, &path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn transfer_delete_remote(
    id: String,
    path: String,
    is_dir: bool,
    state: tauri::State<'_, TransferState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.delete_remote(&id, &path, is_dir)
        .await
        .map_err(|e| e.to_string())
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
            let ssh_mgr = Arc::new(Mutex::new(SshManager::new(handle.clone())));
            let transfer_mgr = Arc::new(Mutex::new(TransferManager::new()));
            app.manage(pty_mgr);
            app.manage(ssh_mgr);
            app.manage(transfer_mgr);
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
            transfer_sftp_connect,
            transfer_sftp_from_ssh,
            transfer_ftp_connect,
            transfer_disconnect,
            transfer_list_remote,
            transfer_list_local,
            transfer_local_home,
            transfer_upload,
            transfer_download,
            transfer_mkdir_remote,
            transfer_delete_remote,
            create_desktop_shortcut,
            get_auto_startup,
            set_auto_startup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
