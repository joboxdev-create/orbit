use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

/// Holds the spawned sidecar process so we can stop it when the app exits.
struct Sidecar(Mutex<Option<Child>>);

/// Spawn the engine sidecar — the local, filesystem-backed host that the webview
/// talks to. In dev it runs the Node script (fast iteration); a packaged build
/// runs the self-contained sidecar binary bundled next to the app (no Node
/// needed on the user's machine), so the app is fully offline and self-contained.
fn spawn_sidecar() -> Option<Child> {
  let mut command = if cfg!(debug_assertions) {
    let script = concat!(env!("CARGO_MANIFEST_DIR"), "/../dist-sidecar/server.js");
    let mut c = Command::new("node");
    c.arg(script);
    c
  } else {
    // Tauri's externalBin places the sidecar next to the app executable
    // (`orbit-sidecar`, or `orbit-sidecar.exe` on Windows).
    let name = if cfg!(windows) {
      "orbit-sidecar.exe"
    } else {
      "orbit-sidecar"
    };
    let bin = std::env::current_exe()
      .ok()
      .and_then(|exe| exe.parent().map(|dir| dir.join(name)))
      .unwrap_or_else(|| std::path::PathBuf::from(name));
    Command::new(bin)
  };

  match command.spawn() {
    Ok(child) => Some(child),
    Err(err) => {
      eprintln!("orbit: could not start sidecar ({err}); is it already running?");
      None
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.manage(Sidecar(Mutex::new(spawn_sidecar())));
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app_handle, event| {
      // Stop the sidecar when the app quits, so it doesn't linger.
      if let RunEvent::Exit = event {
        if let Some(state) = app_handle.try_state::<Sidecar>() {
          if let Some(child) = state.0.lock().unwrap().as_mut() {
            let _ = child.kill();
          }
        }
      }
    });
}
