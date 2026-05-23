use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub shell_type: String,
    pub title: String,
    pub pid: Option<u32>,
}

struct PtySession {
    writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    pair: PtyPair,
    info: TerminalInfo,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    app: AppHandle,
}

impl PtyManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app,
        }
    }

    pub fn available_shells() -> Vec<String> {
        let mut shells = vec![];

        #[cfg(target_os = "windows")]
        {
            shells.push("cmd".to_string());
            if which::which("powershell.exe").is_ok() {
                shells.push("powershell".to_string());
            }
            if which::which("wsl.exe").is_ok() {
                shells.push("wsl".to_string());
            }
            if which::which("bash.exe").is_ok() {
                shells.push("bash".to_string());
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            shells.push("bash".to_string());
            if which::which("zsh").is_ok() {
                shells.push("zsh".to_string());
            }
            if which::which("fish").is_ok() {
                shells.push("fish".to_string());
            }
        }

        shells
    }

    pub fn spawn(&self, shell_type: &str, rows: u16, cols: u16) -> anyhow::Result<TerminalInfo> {
        let pty_system = NativePtySystem::default();

        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = build_command(shell_type);
        let child = pair.slave.spawn_command(cmd)?;
        let pid = child.process_id();

        let id = Uuid::new_v4().to_string();
        let info = TerminalInfo {
            id: id.clone(),
            shell_type: shell_type.to_string(),
            title: shell_type_title(shell_type),
            pid,
        };

        let mut reader = pair.master.try_clone_reader()?;
        let app = self.app.clone();
        let event_id = id.clone();

        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app.emit(&format!("terminal-output:{}", event_id), data);
                    }
                    Err(_) => break,
                }
            }
            let _ = app.emit(&format!("terminal-exit:{}", event_id), ());
        });

        let writer = pair.master.take_writer()?;

        self.sessions.lock().unwrap().insert(
            id.clone(),
            PtySession { writer, pair, info: info.clone() },
        );

        Ok(info)
    }

    pub fn write(&self, id: &str, data: &str) -> anyhow::Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(id) {
            session.writer.write_all(data.as_bytes())?;
            session.writer.flush()?;
        }
        Ok(())
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(id) {
            session.pair.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })?;
        }
        Ok(())
    }

    pub fn kill(&self, id: &str) -> anyhow::Result<()> {
        self.sessions.lock().unwrap().remove(id);
        Ok(())
    }

    pub fn list(&self) -> Vec<TerminalInfo> {
        self.sessions
            .lock()
            .unwrap()
            .values()
            .map(|s| s.info.clone())
            .collect()
    }
}

fn build_command(shell_type: &str) -> CommandBuilder {
    match shell_type {
        "powershell" => {
            let mut cmd = CommandBuilder::new("powershell.exe");
            cmd.arg("-NoLogo");
            cmd
        }
        "wsl" => {
            let mut cmd = CommandBuilder::new("wsl.exe");
            cmd.arg("--");
            cmd
        }
        "bash" => CommandBuilder::new("bash"),
        "zsh" => CommandBuilder::new("zsh"),
        "fish" => CommandBuilder::new("fish"),
        _ => CommandBuilder::new("cmd.exe"),
    }
}

fn shell_type_title(shell_type: &str) -> String {
    match shell_type {
        "cmd" => "Command Prompt".into(),
        "powershell" => "PowerShell".into(),
        "wsl" => "WSL".into(),
        "bash" => "Bash".into(),
        "zsh" => "Zsh".into(),
        "fish" => "Fish".into(),
        other => other.to_string(),
    }
}
