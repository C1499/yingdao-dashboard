const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const BACKEND_PORT = Number(process.env.YINGDAO_DESKTOP_PORT || 3001);
const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`;
let backendProcess = null;
let mainWindow = null;

function resolveBackendEntry() {
  const candidate = path.join(app.getAppPath(), 'apps', 'backend', 'dist', 'main.js');
  if (!fs.existsSync(candidate)) {
    throw new Error(`Backend entry not found: ${candidate}`);
  }
  return candidate;
}

function resolveFrontendEntry() {
  const candidate = path.join(app.getAppPath(), 'apps', 'frontend', 'dist', 'index.html');
  if (!fs.existsSync(candidate)) {
    throw new Error(`Frontend entry not found: ${candidate}`);
  }
  return candidate;
}

function waitForPort(port, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Backend did not start within ${timeoutMs}ms`));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };

    tryConnect();
  });
}

async function startBackend() {
  if (backendProcess) return;

  const backendEntry = resolveBackendEntry();
  backendProcess = spawn(process.execPath, [backendEntry], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  backendProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[backend] ${chunk}`);
  });

  backendProcess.once('exit', (code) => {
    backendProcess = null;
    if (!app.isQuitting) {
      dialog.showErrorBox('后端已退出', `本地服务意外退出，退出码: ${code ?? 'unknown'}`);
      app.quit();
    }
  });

  await waitForPort(BACKEND_PORT);
}

function stopBackend() {
  if (!backendProcess) return;
  backendProcess.kill();
  backendProcess = null;
}

async function createWindow() {
  await startBackend();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    title: '影刀调度运维台',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`window.__YINGDAO_API_BASE__ = ${JSON.stringify(`${API_BASE}/api/yingdao`)}`);
  });

  await mainWindow.loadFile(resolveFrontendEntry());
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox('启动失败', error.message);
  stopBackend();
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      dialog.showErrorBox('启动失败', error.message);
      app.quit();
    });
  }
});
