// Boots the built Electron main and exits non-zero unless its window rendered the game.
import { app, BrowserWindow } from 'electron';

const fail = (message) => {
  console.error(`smoke:electron FAILED: ${message}`);
  app.exit(1);
};

setTimeout(() => fail('window did not render within 15s'), 15_000);
process.on('uncaughtException', (error) => fail(error.stack));

// No top-level await here, for the same reason as electron/main.ts.
import('../dist-electron/main.js')
  .then(() => app.whenReady())
  .then(async () => {
    while (BrowserWindow.getAllWindows().length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const { webContents } = BrowserWindow.getAllWindows()[0];
    if (webContents.isLoading()) {
      await new Promise((resolve) => webContents.once('did-stop-loading', resolve));
    }

    const rendered = await webContents.executeJavaScript("document.querySelector('#app').childElementCount");
    if (rendered === 0) return fail('#app is empty');
    const nodeAccess = await webContents.executeJavaScript("typeof require !== 'undefined'");
    if (nodeAccess) return fail('renderer has Node access');

    console.log(`smoke:electron OK: ${webContents.getURL()}`);
    app.exit(0);
  })
  .catch((error) => fail(error.stack));
