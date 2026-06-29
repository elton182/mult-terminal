use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct TransferProgress {
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub direction: String,
    pub file_name: String,
}

#[derive(Clone)]
pub struct ProgressReporter {
    app: AppHandle,
    session_id: String,
    direction: String,
    file_name: String,
}

impl ProgressReporter {
    pub fn new(app: AppHandle, session_id: String, direction: &str, file_name: String) -> Self {
        Self {
            app,
            session_id,
            direction: direction.to_string(),
            file_name,
        }
    }

    pub fn report(&self, bytes_done: u64, bytes_total: u64) {
        let _ = self.app.emit(
            &format!("transfer-progress:{}", self.session_id),
            TransferProgress {
                bytes_done,
                bytes_total: bytes_total.max(1),
                direction: self.direction.clone(),
                file_name: self.file_name.clone(),
            },
        );
    }
}
