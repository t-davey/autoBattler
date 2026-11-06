import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

const MIN_CONTENT_WIDTH = 1280;
const MIN_CONTENT_HEIGHT = 720;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: MIN_CONTENT_WIDTH,
    height: MIN_CONTENT_HEIGHT,
    useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // The minimum counts the window's frame, so add it to keep the page at the minimum size.
  const [windowWidth = 0, windowHeight = 0] = window.getSize();
  const [contentWidth = 0, contentHeight = 0] = window.getContentSize();
  window.setMinimumSize(MIN_CONTENT_WIDTH + windowWidth - contentWidth, MIN_CONTENT_HEIGHT + windowHeight - contentHeight);

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
