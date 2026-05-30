const fs = require('fs');
const path = require('path');

(async function main() {
  const cwd = path.resolve(__dirname, '..');
  const certDir = path.join(cwd, 'server', 'certs');
  const keyPath = path.join(certDir, 'localhost-key.pem');
  const certPath = path.join(certDir, 'localhost.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('[cert] existing certs found');
    return;
  }

  console.log('[cert] generating self-signed certificate (selfsigned npm)');
  try {
    let selfsigned;
    try { selfsigned = require('selfsigned'); } catch (e1) {
      try { selfsigned = require(path.join(__dirname, '..', 'server', 'node_modules', 'selfsigned')); } catch (e2) {
        const alt = path.join(process.cwd(), 'server', 'node_modules', 'selfsigned');
        selfsigned = require(alt);
      }
    }
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          ips.push(iface.address);
        }
      }
    }

    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }];
    // add detected LAN IPs as IP SANs
    for (const ip of ips) {
      altNames.push({ type: 7, ip });
    }

    const opts = {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames }],
    };

    const pems = selfsigned.generate(attrs, opts);

    fs.mkdirSync(certDir, { recursive: true });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log('[cert] written', keyPath, certPath);
  } catch (err) {
    console.error('[cert] failed to generate cert:', err && err.message);
    process.exit(1);
  }
})();
