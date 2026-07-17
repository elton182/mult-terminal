use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct TransferProgress {
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub direction: String,
    pub file_name: String,
}

struct ThrottleState {
    last_emit: Instant,
    last_pct: u8,
}

#[derive(Clone)]
pub struct ProgressReporter {
    app: AppHandle,
    session_id: String,
    direction: String,
    file_name: String,
    throttle: std::sync::Arc<Mutex<ThrottleState>>,
}

impl ProgressReporter {
    pub fn new(app: AppHandle, session_id: String, direction: &str, file_name: String) -> Self {
        Self {
            app,
            session_id,
            direction: direction.to_string(),
            file_name,
            throttle: std::sync::Arc::new(Mutex::new(ThrottleState {
                last_emit: Instant::now() - Duration::from_secs(1),
                last_pct: 0,
            })),
        }
    }

    /// Emite progresso no máximo ~5×/s ou a cada 3% — evita saturar o IPC do Tauri.
    pub fn report(&self, bytes_done: u64, bytes_total: u64) {
        let total = bytes_total.max(1);
        let done = bytes_done.min(total);
        let pct = ((done * 100) / total).min(100) as u8;
        let force = done >= total;

        if let Ok(mut t) = self.throttle.lock() {
            if !force {
                let elapsed = t.last_emit.elapsed();
                let pct_jump = pct.saturating_sub(t.last_pct);
                if elapsed < Duration::from_millis(200) && pct_jump < 3 {
                    return;
                }
            }
            t.last_emit = Instant::now();
            t.last_pct = pct;
        }

        let _ = self.app.emit(
            &format!("transfer-progress:{}", self.session_id),
            TransferProgress {
                bytes_done: done,
                bytes_total: total,
                direction: self.direction.clone(),
                file_name: self.file_name.clone(),
            },
        );
    }
}
