// Runs the Vite dev server and an Electron window pointed at it. Closing the window stops both.
import { execSync, spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

execSync('npx tsc -p tsconfig.electron.json', { stdio: 'inherit' });

const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite dev server reported no local URL');

// Set when launched from inside another Electron app, and makes Electron run as plain Node.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...env, VITE_DEV_SERVER_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
