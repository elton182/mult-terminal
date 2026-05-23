# AGENTS.md — multerm

Guidelines for AI coding agents (Claude Code, Copilot, Cursor, etc.) working on this codebase.

## Project overview

`multerm` is a cross-platform multi-terminal manager built with **Tauri 2** (Rust backend) + **Vue 3** (frontend). The architecture splits clearly into:

- **Rust** handles OS-level concerns: PTY processes, SSH sessions, file system, registry
- **Vue** handles all UI: layout, xterm.js rendering, component state
- **Tauri IPC** bridges them via `invoke()` (frontend → Rust) and `emit()` events (Rust → frontend)

## Repository layout

```
src/
  components/     Vue components — one file per concern, co-locate styles
  composables/    Reusable setup() logic (useTerminal, useKeyboard)
  stores/         Pinia stores — one per domain (terminals, ssh-profiles)
  types/          Shared TypeScript interfaces
src-tauri/src/
  lib.rs          Tauri command registrations (single source of truth)
  pty/mod.rs      PTY session lifecycle
  ssh/            SSH client (session.rs + mod.rs)
  config/         Serde models only — no business logic
```

## Critical invariants

1. **Terminal IDs are UUIDs generated on the frontend** and passed to `pty_spawn` / `ssh_connect`. The backend returns the same ID, not a new one. Do not change this — it's what wires Tauri events to the right xterm instance.

2. **Events are namespaced by terminal ID**: `terminal-output:{id}`, `terminal-exit:{id}`, `terminal-error:{id}`. Any Rust code that emits to a terminal must use this exact pattern.

3. **PTY resize must be debounced** (50ms) on the frontend. The ResizeObserver fires many times per drag; hammering the backend causes flickering.

4. **SSH sessions are non-blocking at connect time**: `SshSession::connect` spawns a tokio task and returns immediately. The actual TCP handshake happens in the background. Errors appear as `terminal-error:{id}` events, not as command errors.

5. **The layout is purely a frontend concern**: `columns: number[]` in `App.vue` maps terminal list indices to grid positions. Rust knows nothing about layout.

## Adding a new Tauri command

1. Write the Rust function in `src-tauri/src/lib.rs` (or a submodule)
2. Add `#[tauri::command]` and include it in `tauri::generate_handler![...]`
3. Call from frontend with `invoke('command_name', { camelCaseArgs })` — Tauri auto-converts to snake_case
4. Declare the return type as `Result<T, String>` — `String` errors become rejected Promises

## Adding a new shell type

**Rust** (`src-tauri/src/pty/mod.rs`):
- Add a branch to `build_command()`
- Add a label to `shell_type_title()`
- Add detection to `available_shells()`

**Frontend** (`src/components/Toolbar.vue`):
- Add an icon to the `shellIcon()` map

## Modifying the layout system

The layout is a `number[]` where each element is the row count for that column.
- `[1]` = single terminal
- `[2, 3, 1]` = col0 has 2 rows, col1 has 3 rows, col2 has 1 row

`TerminalGrid.vue` maps `store.list[flatIndex]` to grid positions by summing column sizes.
`App.vue` auto-expands the last column if more terminals are opened than slots.

## TypeScript conventions

- All shared types live in `src/types/index.ts`
- Stores (`src/stores/`) use Pinia Options API — keep actions async where they call `invoke`
- Composables use Vue's Composition API setup pattern with `onMounted`/`onUnmounted` cleanup

## Rust conventions

- All state shared across async commands uses `Arc<tokio::sync::Mutex<...>>`
- PTY reading happens in `tokio::task::spawn_blocking` (blocking I/O)
- SSH runs in `tokio::spawn` (async, non-blocking)
- Errors use `anyhow` internally; Tauri commands return `Result<T, String>`
- No `unwrap()` in command handlers — use `?` and `map_err(|e| e.to_string())`

## What NOT to do

- Do not add `println!` or `eprintln!` in release paths — use `tracing` if needed
- Do not store SSH passwords anywhere persistent (no files, no registry)
- Do not block the Tauri main thread — all heavy work must be in spawned tasks
- Do not add new Cargo dependencies for things that can be done via PowerShell (`std::process::Command`) or the existing `portable-pty`/`russh` APIs
- Do not modify `tauri.conf.json` identifier (`com.multerm.dev`) without updating the store paths

## Running locally

```bash
npm install
npm run tauri dev   # hot-reload frontend, rebuilds Rust on file change
```

If the app window doesn't appear, check that port 1420 is free:
```powershell
Stop-Process -Name multerm -Force -ErrorAction SilentlyContinue
```

## Testing SSH

Use the profile manager (🔒 button) to create a profile, then click ▶. Errors appear inline in the terminal panel. Common failures:

| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to connect` | Wrong host/port or firewall | Verify connectivity with `ssh user@host` |
| `Authentication rejected` | Wrong password or key not authorized | Check `~/.ssh/authorized_keys` on server |
| `Could not load key` | Wrong key path or permissions | Use absolute path; `chmod 600` on Unix |
| `Password auth disabled` | Server requires key auth | Switch profile to `privatekey` auth type |
