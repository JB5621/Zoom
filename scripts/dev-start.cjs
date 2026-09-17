const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = 'npm';

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || root,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: isWin,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited via signal ${signal}`);
    } else {
      console.log(`[${name}] exited with code ${code}`);
    }
    if (!shuttingDown) {
      shuttingDown = true;
      server?.kill('SIGINT');
      client?.kill('SIGINT');
      process.exit(code || 0);
    }
  });

  return child;
}

let shuttingDown = false;
let server = null;
let client = null;
let serverWasAlreadyRunning = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server?.kill('SIGINT');
  client?.kill('SIGINT');
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

// Does whatever is listening on this port speak TLS? When we reuse a
// backend somebody else started we cannot assume it matches the scheme we
// would have chosen, and guessing wrong makes every /api call fail.
function detectScheme(host, port) {
  return new Promise((resolve) => {
    const tls = require('tls');
    const socket = tls.connect(
      { host, port, rejectUnauthorized: false, servername: host },
      () => { socket.destroy(); resolve('https'); }
    );
    socket.setTimeout(1000);
    socket.once('timeout', () => { socket.destroy(); resolve('http'); });
    socket.once('error', () => { socket.destroy(); resolve('http'); });
  });
}

(async () => {
  serverWasAlreadyRunning = await isPortOpen('127.0.0.1', 5000);
  let apiScheme = 'https'; // what we start ourselves, below
  if (serverWasAlreadyRunning) {
    apiScheme = await detectScheme('127.0.0.1', 5000);
    console.log(`Port 5000 is already in use; reusing the existing backend server (${apiScheme}).`);
  } else {
    // ensure certs exist for HTTPS
    try {
      const genScript = path.join(root, 'scripts', 'generate-cert.cjs');
      if (fs.existsSync(genScript)) {
        require(genScript);
      }
    } catch (e) {
      console.warn('Failed to run cert generator:', e && e.message);
    }

    server = run('server', npmCmd, ['run', 'start'], {
      cwd: path.join(root, 'server'),
      env: {
        ...process.env,
        HTTPS: 'true',
        SSL_KEY_PATH: path.join(root, 'server', 'certs', 'localhost-key.pem'),
        SSL_CERT_PATH: path.join(root, 'server', 'certs', 'localhost.pem'),
      },
    });
  }

  const clientPortOpen = await isPortOpen('127.0.0.1', 5173);
  if (clientPortOpen) {
    console.log('Port 5173 is already in use; reusing the existing HTTPS client server.');
  } else {
    client = run('client', npmCmd, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173', '--strictPort'], {
      cwd: path.join(root, 'client'),
      env: {
        ...process.env,
        VITE_HTTPS: 'true',
        VITE_DEV_PORT: '5173',
        VITE_SSL_KEY_PATH: path.join(root, 'server', 'certs', 'localhost-key.pem'),
        VITE_SSL_CERT_PATH: path.join(root, 'server', 'certs', 'localhost.pem'),
        // Proxy target only — not exposed to the browser. The client keeps
        // using relative /api and /socket.io and reaches the backend through
        // this dev server, so the page never has to trust the backend's
        // self-signed certificate and never makes a cross-origin request.
        DEV_API_TARGET: `${apiScheme}://localhost:5000`,
        // Explicitly cleared: if it leaks in from the ambient environment
        // the browser would call the backend directly and bypass the proxy.
        VITE_SERVER_URL: '',
      },
    });
  }

  console.log(`HTTPS client will run on https://localhost:5173 and proxy /api to ${apiScheme}://localhost:5000`);
})();
