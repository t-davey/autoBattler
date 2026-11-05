import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(join(import.meta.dirname, '../dist/index.html'));
  }
}

// A promise chain, not top-level await: Electron holds `ready` until this module finishes loading.
app
  .whenReady()
  .then(createWindow)
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
