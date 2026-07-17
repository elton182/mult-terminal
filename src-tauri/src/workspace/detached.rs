use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetachedWorkspaceTab {
    pub id: String,
    pub label: String,
    pub columns: Vec<u32>,
    pub slots: Vec<Option<String>>,
    pub active_terminal_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetachedTerminalState {
    pub id: String,
    pub title: String,
    pub label: Option<String>,
    pub shell_type: String,
    pub color: Option<String>,
    pub is_connected: bool,
    #[serde(rename = "type")]
    pub terminal_type: String,
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetachedPayload {
    pub tab: DetachedWorkspaceTab,
    pub terminals: Vec<DetachedTerminalState>,
    /// terminalId → SerializeAddon dump
    pub scrollbacks: HashMap<String, String>,
    pub window_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetachedTabMeta {
    pub tab_id: String,
    pub label: String,
    pub window_label: String,
    pub terminal_count: usize,
}

#[derive(Default)]
pub struct DetachedRegistry {
    inner: Mutex<HashMap<String, DetachedPayload>>,
}

impl DetachedRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn put(&self, payload: DetachedPayload) {
        let tab_id = payload.tab.id.clone();
        self.inner.lock().unwrap().insert(tab_id, payload);
    }

    pub fn get(&self, tab_id: &str) -> Option<DetachedPayload> {
        self.inner.lock().unwrap().get(tab_id).cloned()
    }

    pub fn take(&self, tab_id: &str) -> Option<DetachedPayload> {
        self.inner.lock().unwrap().remove(tab_id)
    }

    pub fn remove(&self, tab_id: &str) {
        self.inner.lock().unwrap().remove(tab_id);
    }

    pub fn list(&self) -> Vec<DetachedTabMeta> {
        self.inner
            .lock()
            .unwrap()
            .values()
            .map(|p| DetachedTabMeta {
                tab_id: p.tab.id.clone(),
                label: p.tab.label.clone(),
                window_label: p.window_label.clone(),
                terminal_count: p.terminals.len(),
            })
            .collect()
    }
}
