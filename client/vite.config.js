import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const configDir = path.dirname(fileURLToPath(import.meta.url));
const defaultServerKey = path.resolve(configDir, '../server/certs/localhost-key.pem');
const defaultServerCert = path.resolve(configDir, '../server/certs/localhost.pem');
const hasDefaultCerts = fs.existsSync(defaultServerKey) && fs.existsSync(defaultServerCert);

function readHttpsConfig() {
  const keyPath = process.env.VITE_SSL_KEY_PATH || process.env.VITE_SSL_KEY || (hasDefaultCerts ? defaultServerKey : '');
  const certPath = process.env.VITE_SSL_CERT_PATH || process.env.VITE_SSL_CERT || (hasDefaultCerts ? defaultServerCert : '');

  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  return process.env.VITE_HTTPS === 'true';
}

const httpsConfig = readHttpsConfig();

// https://vite.dev/config/
export default defineConfig({
  plugins: [httpsConfig === true ? basicSsl() : null, react()].filter(Boolean),
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
  server: (() => {
    const host = true;
    const port = Number(process.env.VITE_DEV_PORT || 5173);
    const defaultApiTarget = hasDefaultCerts
      ? 'https://localhost:5000'
      : 'http://localhost:5000';

    // Proxy target. DEV_API_TARGET deliberately has no VITE_ prefix so it
    // is NOT exposed to the browser bundle: it configures where this dev
    // server forwards /api, while the client keeps using same-origin
    // relative URLs. VITE_SERVER_URL, by contrast, IS exposed and makes
    // the browser call the backend directly, which reintroduces both CORS
    // and self-signed-certificate trust as failure modes.
    // Defaults to the same scheme server.js uses: HTTPS when the generated
    // localhost certs exist, otherwise HTTP.
    const apiTarget = (process.env.DEV_API_TARGET || process.env.VITE_SERVER_URL || defaultApiTarget).replace(/\/$/, '');

    return {
      host,
      port,
      https: httpsConfig,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Pass the caller's address through as X-Forwarded-For. Without
          // it every proxied request reaches the API from 127.0.0.1, so
          // the server's per-address rate limits treat everyone on the
          // network as one client and a handful of sign-ins locks the
          // whole LAN out. The server only trusts this header from
          // loopback, which is exactly this hop.
          xfwd: true,
        },
        '/socket.io': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    };
  })(),
})
