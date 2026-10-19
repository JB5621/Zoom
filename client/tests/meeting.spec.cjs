const { test, expect, chromium, request } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('two browsers: media, host controls, chat, layouts, recording and breakouts', async () => {
  test.setTimeout(120000);
  const root = path.resolve(__dirname, '../..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oguz-browser-'));
  const tls = fs.existsSync(path.join(root, 'server/certs/localhost.pem'));
  const base = `${tls ? 'https' : 'http'}://localhost:5531`;
  // A server left behind by an aborted run would otherwise answer this test's requests.
  const probe = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
  await expect.poll(async () => { try { await probe.get('/api/health', { timeout: 1000 }); return 'busy'; } catch { return 'free'; } }, { timeout: 30000, message: 'Port 5531 is still in use' }).toBe('free');
  await probe.dispose();
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'server'), env: {
    ...process.env, DATA_DIR: temp, PORT: '5531', NODE_ENV: 'test', HTTPS: tls ? 'true' : 'false',
    ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD: 'test-secret', MEDIASOUP_NUM_WORKERS: '1', MEDIASOUP_ANNOUNCED_IP: '127.0.0.1',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  process.once('exit', () => child.kill());
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  let browser, api;
  try {
    api = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
    await expect.poll(async () => { try { return (await api.get('/api/health')).status(); } catch { return 0; } }, { timeout:15000, message:'Test server failed to start' }).toBe(200);
    const admin = await (await api.post('/api/admin/login', { data: { username:'test-admin', password:'test-secret' } })).json();
    const register = async name => (await (await api.post('/api/auth/register', { data: { name, email:`${name}@test.local`, password:'secret123' } })).json());
    const host = await register('Host'); const guest = await register('Guest');
    if (!host.user || !guest.user) throw Error(`Registration failed: ${JSON.stringify(host.user ? guest : host)}`);
    const room = await (await api.post('/api/admin/rooms', { headers: { Authorization:`Bearer ${admin.token}` }, data: { creatorId:host.user.id } })).json();
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
      args: ['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--ignore-certificate-errors'] });
    const contexts = []; const pages = []; const errors = [];
    for (const user of [host, guest]) {
      const context = await browser.newContext({ ignoreHTTPSErrors:true, permissions:['camera','microphone'], viewport:{width:1440,height:1000}, acceptDownloads:true }); contexts.push(context);
      await context.addInitScript(token => localStorage.setItem('oguzmeeting_auth_token', token), user.token);
      await context.addInitScript(() => {
        const NativeSocket = window.WebSocket;
        window.__meetingSockets = [];
        window.WebSocket = class extends NativeSocket {
          constructor(...args) { super(...args); window.__meetingSockets.push(this); }
        };
        // Exercise the entire sharing pipeline with deterministic tab-like media.
        navigator.mediaDevices.getDisplayMedia = async () => {
          const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
          const ctx = canvas.getContext('2d'); let frame = 0;
          const timer = setInterval(() => { ctx.fillStyle = frame++ % 2 ? '#345678' : '#6789ab'; ctx.fillRect(0, 0, 640, 360); }, 100);
          const stream = canvas.captureStream(10);
          const audio = new AudioContext(); const oscillator = audio.createOscillator();
          const destination = audio.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
          stream.addTrack(destination.stream.getAudioTracks()[0]);
          const stop = stream.getVideoTracks()[0].stop.bind(stream.getVideoTracks()[0]);
          stream.getVideoTracks()[0].stop = () => { clearInterval(timer); audio.close(); stop(); };
          return stream;
        };
      });
      const page = await context.newPage(); pages.push(page); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/room/${room.roomId}`);
      await expect(page.getByRole('heading', { name:`Ready to join, ${user.user.name}?` })).toBeVisible();
      await page.getByRole('button', { name:'Join meeting', exact:true }).click();
      await expect(page.getByRole('button', { name:/Participants \(/ })).toBeVisible();
    }
    const [h,g] = pages;
    await expect(h.getByRole('button', {name:'Participants (2)',exact:true})).toBeVisible();
    // Remote video really arrives through mediasoup, rather than just a tile placeholder.
    for (const page of pages) await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('video[data-peer-id]')].some(v => v.videoWidth > 0 && v.srcObject?.getAudioTracks().length > 0)), {timeout:15000}).toBe(true);
    // Optional real model download: keep the default suite usable offline.
    if (process.env.TEST_BACKGROUND === '1') {
      await h.getByRole('button', {name:'Background',exact:true}).click();
      await h.getByRole('button', {name:'Studio',exact:true}).click();
      await expect(h.getByRole('button', {name:'Studio',exact:true})).toHaveAttribute('aria-pressed', 'true', {timeout:45000});
      await expect.poll(() => h.evaluate(() => {
        const video = [...document.querySelectorAll('video')].find(v => !v.dataset.peerId);
        if (!video?.videoWidth) return false;
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, 1, 1);
        return ctx.getImageData(0, 0, 1, 1).data[2] > 10;
      })).toBe(true);
      await h.getByRole('button', {name:'None',exact:true}).click();
      await h.getByRole('button', {name:'Close panel',exact:true}).click();
    }

    // A transient socket failure must retain live capture tracks and rebuild media.
    const oldRemote = await h.locator('video[data-peer-id]').first().getAttribute('data-peer-id');
    await g.getByRole('button', {name:'Mute',exact:true}).click();
    await g.evaluate(() => window.__meetingSockets.filter(s => s.readyState === WebSocket.OPEN).forEach(s => s.close()));
    await expect.poll(() => h.locator('video[data-peer-id]').first().getAttribute('data-peer-id')).not.toBe(oldRemote);
    await expect.poll(() => h.evaluate(() => [...document.querySelectorAll('video[data-peer-id]')].some(v => v.videoWidth > 0 && v.srcObject?.getVideoTracks()[0]?.readyState === 'live')), {timeout:15000}).toBe(true);
    await expect(g.getByRole('button', {name:'Unmute',exact:true})).toBeVisible();
    await g.getByRole('button', {name:'Unmute',exact:true}).click();

    await h.getByRole('button', {name:'Share Screen',exact:true}).click();
    await h.getByRole('button', {name:/Browser Tab Share a specific tab with audio/}).click();
    await expect(g.locator('.stage-speaker')).toBeVisible();
    await expect(h.locator('.tile-wrap')).toHaveCount(2);
    await expect.poll(() => g.locator('audio[data-peer-id]').count()).toBe(1);
    await expect.poll(() => g.evaluate(() => document.querySelector('audio[data-peer-id]')?.srcObject?.getAudioTracks()[0]?.readyState)).toBe('live');
    await h.getByRole('button', {name:'Stop Sharing',exact:true}).first().click();
    await expect(g.locator('audio[data-peer-id]')).toHaveCount(0);
    await expect(g.locator('.stage-grid')).toBeVisible();

    await g.getByRole('button', {name:'✋ Raise hand',exact:true}).click();
    await h.getByRole('button', {name:'Participants (2)',exact:true}).click();
    await expect(h.locator('.participant-row').filter({hasText:'Guest'})).toContainText('✋');
    await h.getByRole('button', {name:'Close panel',exact:true}).click();
    await h.getByRole('button', {name:'Speaker view',exact:true}).click();
    await expect(h.locator('.stage-speaker')).toBeVisible();
    await g.getByRole('button', {name:'Chat',exact:true}).first().click();
    await g.getByRole('textbox', {name:'Message',exact:true}).fill('Hello from Guest');
    await g.getByRole('button', {name:'Send',exact:true}).click();
    await h.getByRole('button', {name:/^Chat \(1\)$/}).click();
    await expect(h.getByText('Hello from Guest', {exact:true})).toBeVisible();
    const file = { name:'notes.txt', mimeType:'text/plain', buffer:Buffer.from('Meeting attachment') };
    await g.locator('input[type=file]').setInputFiles(file);
    await g.getByRole('button', {name:'Send',exact:true}).click();
    await expect(h.getByRole('button', {name:/notes.txt/})).toBeVisible();
    await h.getByRole('button', {name:'Close chat',exact:true}).click();
    await g.getByRole('button', {name:'Close chat',exact:true}).click();
    await h.getByRole('button', {name:'Host controls',exact:true}).click();
    await h.getByLabel('Lock meeting', {exact:true}).check();
    await h.getByLabel('Allow participants to share screens').uncheck();
    await h.getByRole('button', {name:'Mute everyone else',exact:true}).click();
    await expect(g.getByRole('button', {name:'Unmute',exact:true})).toBeVisible();
    await h.getByRole('button', {name:'Close panel',exact:true}).click();
    await g.getByRole('button', {name:'Unmute',exact:true}).click();
    await h.getByRole('button', {name:'Start Recording',exact:true}).click();
    await expect(h.getByRole('button', {name:'Stop Recording',exact:true})).toBeVisible();
    await h.waitForTimeout(1200);
    const recording = h.waitForEvent('download'); await h.getByRole('button', {name:'Stop Recording',exact:true}).click();
    const saved = await recording; expect(saved.suggestedFilename()).toMatch(/\.(webm|mp4)$/);
    const savedPath = await saved.path(); expect(fs.statSync(savedPath).size).toBeGreaterThan(1000);
    await h.getByRole('button', {name:'Breakout rooms',exact:true}).click();
    await h.getByRole('button', {name:'Create breakout rooms',exact:true}).click();
    await h.locator('.participant-row').filter({hasText:'Breakout 1'}).locator('select').selectOption({label:'Guest'});
    await expect(g).not.toHaveURL(new RegExp(`/room/${room.roomId}`));
    await g.getByRole('button', {name:'Join meeting',exact:true}).click();
    await expect(g.getByRole('button', {name:'Breakout rooms',exact:true})).toBeVisible();
    await h.getByRole('button', {name:'Close rooms and bring everyone back',exact:true}).click();
    await expect(g).toHaveURL(new RegExp(`/room/${room.roomId}`));
    await g.getByRole('button', {name:'Join meeting',exact:true}).click();
    await expect(h.getByRole('button', {name:'Participants (2)',exact:true})).toBeVisible();
    await h.getByRole('button', {name:'Close panel',exact:true}).click();
    await h.screenshot({path:'/tmp/oguz-meeting-browser.png'});
    await g.getByRole('button', {name:'Start Recording',exact:true}).click();
    await expect(g.getByRole('button', {name:'Stop Recording',exact:true})).toBeVisible();
    await g.waitForTimeout(1200);
    const finalRecording = g.waitForEvent('download');
    await api.delete(`/api/admin/rooms/${room.roomId}`, { headers: { Authorization: `Bearer ${admin.token}` } });
    const finalFile = await finalRecording;
    expect(fs.statSync(await finalFile.path()).size).toBeGreaterThan(1000);
    await expect(g.getByText('The host ended this meeting', {exact:true})).toBeVisible();
    expect(errors).toEqual([]);
    for (const c of contexts) await c.close();
  } catch (error) { console.error(error.message, logs); throw error; }
  finally {
    await browser?.close(); await api?.dispose(); child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(temp, { recursive:true, force:true });
  }
});
