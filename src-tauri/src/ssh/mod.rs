mod session;
use session::{AuthMethod, SshControl, SshSession};

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
    app: AppHandle,
}

impl SshManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app,
        }
    }

    pub async fn connect(
        &self,
        id: String,
        host: String,
        port: u16,
        username: String,
        password: String,
        key_path: String,
        rows: u16,
        cols: u16,
    ) -> anyhow::Result<String> {
        let auth = if !key_path.is_empty() {
            AuthMethod::PrivateKey { path: key_path, passphrase: None }
        } else {
            AuthMethod::Password(password)
        };

        let session = SshSession::connect(
            id.clone(), host, port, username, auth, rows, cols, self.app.clone(),
        )
        .await?;

        self.sessions.lock().unwrap().insert(id.clone(), session);
        Ok(id)
    }

    pub fn write(&self, id: &str, data: Vec<u8>) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(id) {
            let tx = session.tx.clone();
            tokio::spawn(async move {
                let _ = tx.send(SshControl::Data(data)).await;
            });
        }
        Ok(())
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(id) {
            let tx = session.tx.clone();
            tokio::spawn(async move {
                let _ = tx.send(SshControl::Resize { rows, cols }).await;
            });
        }
        Ok(())
    }

    pub fn disconnect(&self, id: &str) -> anyhow::Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.remove(id) {
            tokio::spawn(async move {
                let _ = session.tx.send(SshControl::Close).await;
            });
        }
        Ok(())
    }
}
