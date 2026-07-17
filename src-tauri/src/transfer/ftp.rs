use super::progress::ProgressReporter;
use super::types::FileEntry;
use anyhow::Context;
use std::io::{BufWriter, Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use suppaftp::FtpStream;

const CHUNK_SIZE: usize = 256 * 1024;
const WRITE_BUF_SIZE: usize = 1024 * 1024;

pub struct FtpConnection {
    inner: Arc<Mutex<FtpStream>>,
}

struct ProgressReader<R> {
    inner: R,
    done: u64,
    total: u64,
    progress: Option<ProgressReporter>,
}

impl<R: Read> Read for ProgressReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        if n > 0 {
            self.done += n as u64;
            if let Some(p) = &self.progress {
                p.report(self.done.min(self.total.max(1)), self.total.max(1));
            }
        }
        Ok(n)
    }
}

impl FtpConnection {
    pub fn clone_conn(&self) -> Self {
        Self {
            inner: self.inner.clone(),
        }
    }

    pub fn connect(
        host: String,
        port: u16,
        username: String,
        password: String,
    ) -> anyhow::Result<Self> {
        let addr = format!("{}:{}", host, port);
        let mut ftp =
            FtpStream::connect(&addr).with_context(|| format!("Falha ao conectar FTP em {}", addr))?;
        ftp.login(&username, &password)
            .context("Falha na autenticação FTP")?;
        Ok(Self {
            inner: Arc::new(Mutex::new(ftp)),
        })
    }

    pub fn list_dir(&self, path: &str) -> anyhow::Result<Vec<FileEntry>> {
        let mut ftp = self.inner.lock().map_err(|_| anyhow::anyhow!("Sessão FTP bloqueada"))?;
        let remote = normalize_remote(path);
        let cwd = ftp.pwd().unwrap_or_else(|_| "/".to_string());
        if remote != "/" {
            ftp.cwd(&remote).with_context(|| format!("Não foi possível entrar em {}", remote))?;
        }
        let names = ftp.nlst(None).context("Falha ao listar diretório FTP")?;
        let mut entries = Vec::new();
        for name in names {
            if name.is_empty() || name == "." || name == ".." {
                continue;
            }
            let is_dir = if ftp.cwd(&name).is_ok() {
                let _ = ftp.cdup();
                true
            } else {
                false
            };
            let size = if is_dir { 0 } else { ftp.size(&name).unwrap_or(0) as u64 };
            entries.push(FileEntry {
                name: name.clone(),
                path: join_remote(&remote, &name),
                is_dir,
                size,
            });
        }
        if remote != "/" {
            let _ = ftp.cwd(&cwd);
        }
        entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(entries)
    }

    pub fn upload(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: Option<&ProgressReporter>,
    ) -> anyhow::Result<()> {
        let total = std::fs::metadata(local_path)
            .with_context(|| format!("Não foi possível ler {}", local_path))?
            .len();

        if let Some(p) = progress {
            p.report(0, total);
        }

        let mut ftp = self.inner.lock().map_err(|_| anyhow::anyhow!("Sessão FTP bloqueada"))?;
        let remote = normalize_remote(remote_path);
        let file_name = Path::new(&remote)
            .file_name()
            .and_then(|s| s.to_str())
            .context("Caminho remoto inválido")?;
        let parent = Path::new(&remote)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());
        if parent != "/" {
            ftp.cwd(&parent).ok();
        }

        let file = std::fs::File::open(local_path)
            .with_context(|| format!("Não foi possível ler {}", local_path))?;
        let mut reader = ProgressReader {
            inner: std::io::BufReader::with_capacity(CHUNK_SIZE, file),
            done: 0,
            total,
            progress: progress.cloned(),
        };
        ftp.put_file(file_name, &mut reader)
            .context("Falha no upload FTP")?;

        if let Some(p) = progress {
            p.report(total, total);
        }
        Ok(())
    }

    pub fn download(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: Option<&ProgressReporter>,
    ) -> anyhow::Result<()> {
        let mut ftp = self.inner.lock().map_err(|_| anyhow::anyhow!("Sessão FTP bloqueada"))?;
        let remote = normalize_remote(remote_path);
        let file_name = Path::new(&remote)
            .file_name()
            .and_then(|s| s.to_str())
            .context("Caminho remoto inválido")?;
        let parent = Path::new(&remote)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());
        if parent != "/" {
            ftp.cwd(&parent).ok();
        }

        let total = ftp.size(file_name).unwrap_or(0) as u64;
        if let Some(p) = progress {
            p.report(0, total.max(1));
        }

        if let Some(parent) = Path::new(local_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let file = std::fs::File::create(local_path)
            .with_context(|| format!("Não foi possível criar {}", local_path))?;
        let mut writer = BufWriter::with_capacity(WRITE_BUF_SIZE, file);
        let mut done = 0u64;

        ftp.retr(file_name, |remote| {
            let mut buf = vec![0u8; CHUNK_SIZE];
            loop {
                let n = remote
                    .read(&mut buf)
                    .map_err(suppaftp::FtpError::ConnectionError)?;
                if n == 0 {
                    break;
                }
                writer
                    .write_all(&buf[..n])
                    .map_err(suppaftp::FtpError::ConnectionError)?;
                done += n as u64;
                if let Some(p) = progress {
                    let denom = if total > 0 { total } else { done.max(1) };
                    p.report(done.min(denom), denom);
                }
            }
            writer
                .flush()
                .map_err(suppaftp::FtpError::ConnectionError)?;
            Ok(())
        })
        .map_err(|e| anyhow::anyhow!("Falha no download FTP: {e}"))?;

        if let Some(p) = progress {
            let final_total = if total > 0 { total } else { done.max(1) };
            p.report(final_total, final_total);
        }
        Ok(())
    }

    pub fn mkdir(&self, path: &str) -> anyhow::Result<()> {
        let mut ftp = self.inner.lock().map_err(|_| anyhow::anyhow!("Sessão FTP bloqueada"))?;
        ftp.mkdir(&normalize_remote(path))
            .context("Falha ao criar pasta FTP")?;
        Ok(())
    }

    pub fn remove(&self, path: &str, is_dir: bool) -> anyhow::Result<()> {
        let mut ftp = self.inner.lock().map_err(|_| anyhow::anyhow!("Sessão FTP bloqueada"))?;
        let remote = normalize_remote(path);
        if is_dir {
            ftp.rmdir(&remote).context("Falha ao remover pasta FTP")?;
        } else {
            ftp.rm(&remote).context("Falha ao remover arquivo FTP")?;
        }
        Ok(())
    }
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
