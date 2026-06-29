mod ftp;
mod progress;
mod sftp;
mod types;

use crate::ssh::SshManager;
use ftp::FtpConnection;
use sftp::SftpConnection;
use std::collections::HashMap;
use tokio::sync::Mutex;

pub use progress::{ProgressReporter, TransferProgress};
pub use sftp::{list_local_dir, local_home};
pub use types::FileEntry;

pub enum TransferSession {
    Sftp(SftpConnection),
    Ftp(FtpConnection),
}

pub struct TransferManager {
    sessions: Mutex<HashMap<String, TransferSession>>,
}

impl TransferManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub async fn sftp_connect(
        &self,
        id: String,
        host: String,
        port: u16,
        username: String,
        password: String,
        key_path: String,
        passphrase: String,
    ) -> anyhow::Result<()> {
        let auth = build_auth(password, key_path, passphrase);
        let conn = SftpConnection::connect_standalone(host, port, username, auth).await?;
        self.sessions
            .lock()
            .await
            .insert(id, TransferSession::Sftp(conn));
        Ok(())
    }

    pub async fn sftp_from_ssh(
        &self,
        id: String,
        ssh_terminal_id: &str,
        ssh_mgr: &SshManager,
    ) -> anyhow::Result<()> {
        let handle = ssh_mgr
            .get_ssh_handle(ssh_terminal_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Terminal SSH não encontrado ou ainda conectando"))?;
        let conn = SftpConnection::connect_from_ssh_handle(handle).await?;
        self.sessions
            .lock()
            .await
            .insert(id, TransferSession::Sftp(conn));
        Ok(())
    }

    pub async fn ftp_connect(
        &self,
        id: String,
        host: String,
        port: u16,
        username: String,
        password: String,
    ) -> anyhow::Result<()> {
        let conn = tokio::task::spawn_blocking(move || {
            FtpConnection::connect(host, port, username, password)
        })
        .await
        .context("Falha na tarefa FTP")??;
        self.sessions.lock().await.insert(id, TransferSession::Ftp(conn));
        Ok(())
    }

    pub async fn disconnect(&self, id: &str) -> anyhow::Result<()> {
        self.sessions.lock().await.remove(id);
        Ok(())
    }

    pub async fn list_remote(&self, id: &str, path: &str) -> anyhow::Result<Vec<FileEntry>> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Sessão de transferência não encontrada"))?;
        match session {
            TransferSession::Sftp(s) => {
                let conn = s.clone();
                drop(sessions);
                conn.list_dir(path).await
            }
            TransferSession::Ftp(f) => {
                let path = path.to_string();
                let conn = f.clone_conn();
                drop(sessions);
                tokio::task::spawn_blocking(move || conn.list_dir(&path))
                    .await
                    .context("Falha na tarefa FTP")?
            }
        }
    }

    pub async fn upload(
        &self,
        id: &str,
        local_path: &str,
        remote_path: &str,
        progress: Option<ProgressReporter>,
    ) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Sessão de transferência não encontrada"))?;
        match session {
            TransferSession::Sftp(s) => {
                let conn = s.clone();
                let local = local_path.to_string();
                let remote = remote_path.to_string();
                drop(sessions);
                conn.upload(&local, &remote, progress.as_ref()).await
            }
            TransferSession::Ftp(f) => {
                let local = local_path.to_string();
                let remote = remote_path.to_string();
                let conn = f.clone_conn();
                let progress = progress.clone();
                drop(sessions);
                tokio::task::spawn_blocking(move || conn.upload(&local, &remote, progress.as_ref()))
                    .await
                    .context("Falha na tarefa FTP")?
            }
        }
    }

    pub async fn download(
        &self,
        id: &str,
        remote_path: &str,
        local_path: &str,
        progress: Option<ProgressReporter>,
    ) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Sessão de transferência não encontrada"))?;
        match session {
            TransferSession::Sftp(s) => {
                let conn = s.clone();
                let remote = remote_path.to_string();
                let local = local_path.to_string();
                drop(sessions);
                conn.download(&remote, &local, progress.as_ref()).await
            }
            TransferSession::Ftp(f) => {
                let remote = remote_path.to_string();
                let local = local_path.to_string();
                let conn = f.clone_conn();
                let progress = progress.clone();
                drop(sessions);
                tokio::task::spawn_blocking(move || conn.download(&remote, &local, progress.as_ref()))
                    .await
                    .context("Falha na tarefa FTP")?
            }
        }
    }

    pub async fn mkdir_remote(&self, id: &str, path: &str) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Sessão de transferência não encontrada"))?;
        match session {
            TransferSession::Sftp(s) => {
                let conn = s.clone();
                let path = path.to_string();
                drop(sessions);
                conn.mkdir(&path).await
            }
            TransferSession::Ftp(f) => {
                let path = path.to_string();
                let conn = f.clone_conn();
                drop(sessions);
                tokio::task::spawn_blocking(move || conn.mkdir(&path))
                    .await
                    .context("Falha na tarefa FTP")?
            }
        }
    }

    pub async fn delete_remote(&self, id: &str, path: &str, is_dir: bool) -> anyhow::Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Sessão de transferência não encontrada"))?;
        match session {
            TransferSession::Sftp(s) => {
                let conn = s.clone();
                let path = path.to_string();
                drop(sessions);
                conn.remove(&path, is_dir).await
            }
            TransferSession::Ftp(f) => {
                let path = path.to_string();
                let conn = f.clone_conn();
                drop(sessions);
                tokio::task::spawn_blocking(move || conn.remove(&path, is_dir))
                    .await
                    .context("Falha na tarefa FTP")?
            }
        }
    }
}

fn build_auth(password: String, key_path: String, passphrase: String) -> crate::ssh::AuthMethod {
    if !key_path.is_empty() {
        crate::ssh::AuthMethod::PrivateKey {
            path: key_path,
            passphrase: if passphrase.is_empty() { None } else { Some(passphrase) },
        }
    } else {
        crate::ssh::AuthMethod::Password(password)
    }
}

use anyhow::Context;
