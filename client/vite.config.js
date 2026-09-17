import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [process.env.VITE_HTTPS === 'true' ? basicSsl() : null, react()].filter(Boolean),
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
  server: (() => {
    const host = true;
    const port = Number(process.env.VITE_DEV_PORT || 5173);
    // Proxy target. DEV_API_TARGET deliberately has no VITE_ prefix so it
    // is NOT exposed to the browser bundle: it configures where this dev
    // server forwards /api, while the client keeps using same-origin
    // relative URLs. VITE_SERVER_URL, by contrast, IS exposed and makes
    // the browser call the backend directly, which reintroduces both CORS
    // and self-signed-certificate trust as failure modes.
    // Defaults to plain HTTP to match server.js's own default (it only
    // switches to HTTPS when HTTPS=true or SSL cert files are present —
    // neither is true out of the box, so proxying to https:// here would
    // fail the TLS handshake and every /api/* call would 502).
    const apiTarget = (process.env.DEV_API_TARGET || process.env.VITE_SERVER_URL || 'http://localhost:5000').replace(/\/$/, '');

    // If explicit SSL key/cert paths are provided, use them so the dev server
    // can serve HTTPS on LAN IPs (cert must include the LAN IP in SAN).
    let https = process.env.VITE_HTTPS === 'true';
    try {
      const keyPath = process.env.VITE_SSL_KEY_PATH || process.env.VITE_SSL_KEY || '';
      const certPath = process.env.VITE_SSL_CERT_PATH || process.env.VITE_SSL_CERT || '';
      if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        https = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
      }
    } catch (e) {
      // fallback to boolean https
    }

    return {
      host,
      port,
      https,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
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
