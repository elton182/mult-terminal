use anyhow::Context;
use russh::client;
use russh_keys::key::PublicKey;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

pub enum SshControl {
    Data(Vec<u8>),
    Resize { rows: u16, cols: u16 },
    Close,
}

pub struct SshSession {
    pub id: String,
    pub tx: mpsc::Sender<SshControl>,
    pub handle: Arc<Mutex<Option<Arc<Mutex<client::Handle<SshHandler>>>>>>,
}

pub struct SshHandler;

#[async_trait::async_trait]
impl client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

#[derive(Debug, Clone)]
pub enum AuthMethod {
    Password(String),
    PrivateKey { path: String, passphrase: Option<String> },
}

pub async fn connect_handle(
    host: String,
    port: u16,
    username: String,
    auth: AuthMethod,
) -> anyhow::Result<Arc<Mutex<client::Handle<SshHandler>>>> {
    let config = Arc::new(client::Config {
        keepalive_interval: Some(std::time::Duration::from_secs(15)),
        keepalive_max: 3,
        ..Default::default()
    });
    let mut session = client::connect(config, (host.as_str(), port), SshHandler)
        .await
        .with_context(|| format!("Não foi possível conectar a {}:{}", host, port))?;

    authenticate(&mut session, &username, &auth).await?;
    Ok(Arc::new(Mutex::new(session)))
}

pub async fn authenticate(
    session: &mut client::Handle<SshHandler>,
    username: &str,
    auth: &AuthMethod,
) -> anyhow::Result<()> {
    let authenticated = match auth {
        AuthMethod::Password(password) => session
            .authenticate_password(username, password.as_str())
            .await
            .context("Falha na autenticação por senha")?,

        AuthMethod::PrivateKey { path, passphrase } => {
            let key_path = shellexpand::tilde(path).to_string();
            let key = russh_keys::load_secret_key(Path::new(&key_path), passphrase.as_deref())
                .with_context(|| format!("Não foi possível carregar a chave SSH: {}", path))?;

            session
                .authenticate_publickey(username, Arc::new(key))
                .await
                .context("Falha na autenticação por chave")?
        }
    };

    if !authenticated {
        anyhow::bail!("Servidor rejeitou a autenticação. Verifique usuário/senha ou se a chave pública está autorizada no servidor.");
    }
    Ok(())
}

impl SshSession {
    pub async fn connect(
        id: String,
        host: String,
        port: u16,
        username: String,
        auth: AuthMethod,
        rows: u16,
        cols: u16,
        app: AppHandle,
    ) -> anyhow::Result<Self> {
        let (tx, rx) = mpsc::channel::<SshControl>(256);
        let handle_slot: Arc<Mutex<Option<Arc<Mutex<client::Handle<SshHandler>>>>>> =
            Arc::new(Mutex::new(None));

        let id_clone = id.clone();
        let app_clone = app.clone();
        let handle_for_task = handle_slot.clone();

        tokio::spawn(async move {
            let _ = app_clone.emit(
                &format!("terminal-output:{}", id_clone),
                format!("\x1b[2mConectando a {}:{}...\x1b[0m\r\n", host, port),
            );

            if let Err(e) = Self::run(
                id_clone.clone(),
                host,
                port,
                username,
                auth,
                rows,
                cols,
                rx,
                app_clone.clone(),
                handle_for_task,
            )
            .await
            {
                let _ = app_clone.emit(
                    &format!("terminal-output:{}", id_clone),
                    format!("\r\n\x1b[31m[Erro SSH: {}]\x1b[0m\r\n", e),
                );
            }
            let _ = app_clone.emit(&format!("terminal-exit:{}", id_clone), ());
        });

        Ok(Self {
            id,
            tx,
            handle: handle_slot,
        })
    }

    async fn run(
        id: String,
        host: String,
        port: u16,
        username: String,
        auth: AuthMethod,
        rows: u16,
        cols: u16,
        mut rx: mpsc::Receiver<SshControl>,
        app: AppHandle,
        handle_slot: Arc<Mutex<Option<Arc<Mutex<client::Handle<SshHandler>>>>>>,
    ) -> anyhow::Result<()> {
        let shared = connect_handle(host, port, username, auth).await?;
        {
            let mut slot = handle_slot.lock().await;
            *slot = Some(shared.clone());
        }

        let mut channel = {
            let handle = shared.lock().await;
            handle
                .channel_open_session()
                .await
                .context("Falha ao abrir canal SSH")?
        };

        channel
            .request_pty(false, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
            .await?;
        channel.request_shell(false).await?;

        loop {
            tokio::select! {
                ctrl = rx.recv() => {
                    match ctrl {
                        Some(SshControl::Data(data)) => {
                            channel.data(data.as_ref()).await?;
                        }
                        Some(SshControl::Resize { rows, cols }) => {
                            channel.window_change(cols as u32, rows as u32, 0, 0).await?;
                        }
                        Some(SshControl::Close) | None => break,
                    }
                }
                msg = channel.wait() => {
                    match msg {
                        Some(russh::ChannelMsg::Data { ref data }) => {
                            let text = String::from_utf8_lossy(data).to_string();
                            let _ = app.emit(&format!("terminal-output:{}", id), text);
                        }
                        Some(russh::ChannelMsg::ExtendedData { ref data, .. }) => {
                            let text = String::from_utf8_lossy(data).to_string();
                            let _ = app.emit(&format!("terminal-output:{}", id), text);
                        }
                        Some(russh::ChannelMsg::Eof)
                        | Some(russh::ChannelMsg::Close)
                        | None => break,
                        _ => {}
                    }
                }
            }
        }

        Ok(())
    }
}
