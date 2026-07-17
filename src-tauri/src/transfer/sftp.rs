use super::progress::ProgressReporter;
use super::types::FileEntry;
use crate::ssh::{connect_handle, AuthMethod, SshHandler};
use anyhow::Context;
use russh::client;
use russh_sftp::client::{Config as SftpConfig, SftpSession};
use russh_sftp::protocol::OpenFlags;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use tokio::sync::Mutex;

/// Alinhado ao max_packet_len padrão do OpenSSH (256 KiB).
const CHUNK_SIZE: usize = 256 * 1024;
/// Arquivos até este tamanho usam read/write em bloco único (bem mais rápido no SFTP).
const FAST_PATH_MAX: u64 = 48 * 1024 * 1024;

fn sftp_config() -> SftpConfig {
    SftpConfig {
        max_packet_len: CHUNK_SIZE as u32,
        max_concurrent_writes: 64,
        request_timeout_secs: 120,
    }
}

pub struct SftpConnection {
    session: Arc<Mutex<SftpSession>>,
}

impl Clone for SftpConnection {
    fn clone(&self) -> Self {
        Self {
            session: self.session.clone(),
        }
    }
}

impl SftpConnection {
    pub async fn connect_standalone(
        host: String,
        port: u16,
        username: String,
        auth: AuthMethod,
    ) -> anyhow::Result<Self> {
        let handle = connect_handle(host, port, username, auth).await?;
        let session = open_sftp_on_handle(&handle).await?;
        Ok(Self { session })
    }

    pub async fn connect_from_ssh_handle(
        handle: Arc<Mutex<client::Handle<SshHandler>>>,
    ) -> anyhow::Result<Self> {
        let session = open_sftp_on_handle(&handle).await?;
        Ok(Self { session })
    }

    pub async fn list_dir(&self, path: &str) -> anyhow::Result<Vec<FileEntry>> {
        let session = self.session.lock().await;
        let remote = normalize_remote(path);
        let mut entries = Vec::new();
        let mut rd = session.read_dir(&remote).await.context("Falha ao listar diretório remoto")?;
        while let Some(entry) = rd.next() {
            let meta = entry.metadata();
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child = join_remote(&remote, &name);
            entries.push(FileEntry {
                name: name.to_string(),
                path: child,
                is_dir: meta.is_dir(),
                size: meta.size.unwrap_or(0),
            });
        }
        entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(entries)
    }

    pub async fn upload(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: Option<&ProgressReporter>,
    ) -> anyhow::Result<()> {
        let remote = normalize_remote(remote_path);
        let total = tokio::fs::metadata(local_path).await?.len();

        if let Some(p) = progress {
            p.report(0, total.max(1));
        }

        let session = self.session.lock().await;

        // Não usar session.write(): abre só com WRITE (sem CREATE) e falha se o arquivo remoto não existe.
        let mut remote_file = session
            .open_with_flags(
                &remote,
                OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE,
            )
            .await
            .context("Falha ao abrir arquivo remoto para upload")?;

        if total <= FAST_PATH_MAX {
            let data = tokio::fs::read(local_path)
                .await
                .with_context(|| format!("Não foi possível ler {}", local_path))?;
            remote_file
                .write_all(&data)
                .await
                .context("Falha no upload SFTP")?;
            remote_file.shutdown().await.ok();
            if let Some(p) = progress {
                p.report(total, total.max(1));
            }
            return Ok(());
        }

        let mut local_file = tokio::fs::File::open(local_path)
            .await
            .with_context(|| format!("Não foi possível ler {}", local_path))?;

        let mut buf = vec![0u8; CHUNK_SIZE];
        let mut done = 0u64;
        loop {
            let n = local_file.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            remote_file.write_all(&buf[..n]).await?;
            done += n as u64;
            if let Some(p) = progress {
                p.report(done, total);
            }
        }
        remote_file.shutdown().await.ok();
        if let Some(p) = progress {
            p.report(total, total);
        }
        Ok(())
    }

    pub async fn download(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: Option<&ProgressReporter>,
    ) -> anyhow::Result<()> {
        let remote = normalize_remote(remote_path);

        if let Some(parent) = Path::new(local_path).parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }

        let session = self.session.lock().await;
        let total = session
            .metadata(&remote)
            .await
            .ok()
            .and_then(|m| m.size)
            .unwrap_or(0);

        if let Some(p) = progress {
            p.report(0, total.max(1));
        }

        if total > 0 && total <= FAST_PATH_MAX {
            let data = session
                .read(&remote)
                .await
                .context("Falha no download SFTP")?;
            drop(session);
            tokio::fs::write(local_path, &data)
                .await
                .with_context(|| format!("Não foi possível gravar {}", local_path))?;
            if let Some(p) = progress {
                p.report(total, total);
            }
            return Ok(());
        }

        let mut remote_file = session
            .open(&remote)
            .await
            .context("Falha ao abrir arquivo remoto para download")?;
        drop(session);

        let local_file = tokio::fs::File::create(local_path)
            .await
            .with_context(|| format!("Não foi possível gravar {}", local_path))?;
        let mut writer = BufWriter::with_capacity(1024 * 1024, local_file);

        let mut buf = vec![0u8; CHUNK_SIZE];
        let mut done = 0u64;
        loop {
            let n = remote_file.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            writer.write_all(&buf[..n]).await?;
            done += n as u64;
            let denom = if total > 0 { total } else { done.max(1) };
            if let Some(p) = progress {
                p.report(done.min(denom), denom);
            }
        }
        writer.flush().await?;
        if let Some(p) = progress {
            let final_total = if total > 0 { total } else { done.max(1) };
            p.report(final_total, final_total);
        }
        Ok(())
    }

    pub async fn mkdir(&self, path: &str) -> anyhow::Result<()> {
        let session = self.session.lock().await;
        session
            .create_dir(&normalize_remote(path))
            .await
            .context("Falha ao criar pasta remota")?;
        Ok(())
    }

    pub async fn remove(&self, path: &str, is_dir: bool) -> anyhow::Result<()> {
        let session = self.session.lock().await;
        let remote = normalize_remote(path);
        if is_dir {
            session.remove_dir(&remote).await.context("Falha ao remover pasta")?;
        } else {
            session.remove_file(&remote).await.context("Falha ao remover arquivo")?;
        }
        Ok(())
    }
}

async fn open_sftp_on_handle(
    handle: &Arc<Mutex<client::Handle<SshHandler>>>,
) -> anyhow::Result<Arc<Mutex<SftpSession>>> {
    let h = handle.lock().await;
    let channel = h
        .channel_open_session()
        .await
        .context("Falha ao abrir canal SFTP")?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .context("Servidor não suporta subsistema SFTP")?;
    let stream = channel.into_stream();
    let sftp = SftpSession::new_with_config(stream, sftp_config())
        .await
        .context("Falha ao iniciar sessão SFTP")?;
    Ok(Arc::new(Mutex::new(sftp)))
}

fn normalize_remote(path: &str) -> String {
    let p = path.replace('\\', "/");
    if p.is_empty() || p == "/" {
        return "/".to_string();
    }
    let trimmed = p.trim_end_matches('/');
    if trimmed.is_empty() {
        return "/".to_string();
    }
    if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{}", trimmed)
    }
}

fn join_remote(base: &str, name: &str) -> String {
    let base = normalize_remote(base);
    if base == "/" {
        format!("/{}", name)
    } else {
        format!("{}/{}", base.trim_end_matches('/'), name)
    }
}

pub fn list_local_dir(path: &str) -> anyhow::Result<Vec<FileEntry>> {
    let path = PathBuf::from(shellexpand::tilde(path).into_owned());
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&path).with_context(|| format!("Falha ao listar {}", path.display()))? {
        let entry = entry?;
        let meta = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().to_string();
        entries.push(FileEntry {
            name: name.clone(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: if meta.is_dir() { 0 } else { meta.len() },
        });
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(entries)
}

pub fn local_home() -> anyhow::Result<String> {
    Ok(shellexpand::tilde("~").into_owned())
}
