# The game is a web app; Electron is a thin shell

Players get a Windows desktop app, but `src/` targets web APIs only and Electron just hosts the built page, sandboxed and with no Node access. This keeps development in a browser tab fast, at the cost of routing desktop features through a bridge.

Any desktop-only feature is a capability reached through a preload bridge, with a browser fallback. Saves are the first case: files on disk in Electron, browser storage in development.
