//! Watches ~/Moneta so the library view stays live when files change
//! (externally or via our own saves). Events are debounced to one
//! `library-changed` emit per quiet period.

use std::sync::mpsc;
use std::time::Duration;

use notify::{RecursiveMode, Watcher as _};
use tauri::{AppHandle, Emitter as _};

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<()>();
        let mut watcher =
            match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                let Ok(event) = res else { return };
                use notify::EventKind;
                if !matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                ) {
                    return;
                }
                // Skip in-flight atomic-write temp files.
                let relevant = event
                    .paths
                    .iter()
                    .any(|p| p.extension().map(|e| e != "tmp").unwrap_or(true));
                if relevant {
                    let _ = tx.send(());
                }
            }) {
                Ok(w) => w,
                Err(_) => return,
            };
        if watcher
            .watch(&crate::fs::root_dir(), RecursiveMode::Recursive)
            .is_err()
        {
            return;
        }
        loop {
            if rx.recv().is_err() {
                break;
            }
            // Debounce: wait for 300ms of quiet before emitting.
            while rx.recv_timeout(Duration::from_millis(300)).is_ok() {}
            let _ = app.emit("library-changed", ());
        }
    });
}
