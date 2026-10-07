// Run with: node --test server/test/admin.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('../../client/node_modules/socket.io-client');

test('admin authorization, room permissions, approvals and deletion', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-admin-'));
  const serverPath = path.resolve(__dirname, '../server.js');
  const sfuPath = path.resolve(__dirname, '../sfu.js');
  // Signaling integration test; media workers are not needed for authorization.
  const code = `require.cache[${JSON.stringify(sfuPath)}]={exports:{initWorkers:async()=>{},registerSfuHandlers:()=>{},cleanupPeer:()=>{},closeRoomRouter:()=>{},releasePeer:()=>{}}};require(${JSON.stringify(serverPath)});`;
  const child = spawn(process.execPath, ['-e', code], { env: { ...process.env, DATA_DIR: temp, PORT: '5519', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  const sockets = [];
  const https = fs.existsSync(path.resolve(__dirname, '../certs/localhost.pem'));
  const base = `${https ? 'https' : 'http'}://localhost:5519`;
  const transport = require(https ? 'node:https' : 'node:http');
  const api = (route, method = 'GET', body, token) => new Promise((resolve, reject) => {
    const req = transport.request(`${base}/api${route}`, { method, rejectUnauthorized: false, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, res => {
      let text = ''; res.on('data', d => text += d); res.on('end', () => { try { resolve({ status: res.statusCode, ...JSON.parse(text) }); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  const event = (socket, name) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Missing event ${name}`)), 4000); socket.once(name, data => { clearTimeout(timer); resolve(data); }); });
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(output)), 5000); child.stdout.on('data', () => { if (output.includes('Server on')) { clearTimeout(timer); resolve(); } }); });
    assert.equal((await api('/admin/state')).status, 401);
    assert.equal((await api('/admin/login', 'POST', { username: 'admin', password: 'wrong' })).status, 401);
    const admin = (await api('/admin/login', 'POST', { username: 'admin', password: 'admin' })).token;
    assert.ok(admin);
    const add = async name => {
      const result = await api('/admin/users', 'POST', { name, email: `${name}@test.local`, password: 'secret123' }, admin);
      assert.equal(result.status, 201);
      return { ...result.user, token: (await api('/auth/login', 'POST', { email: result.user.email, password: 'secret123' })).token };
    };
    const host = await add('Host'); const guest = await add('Guest');
    assert.equal((await api('/admin/state', 'GET', null, host.token)).status, 401);
    assert.equal((await api('/rooms', 'POST', {})).status, 401);
    await api(`/admin/users/${guest.id}`, 'PATCH', { canCreateRooms: false }, admin);
    assert.equal((await api('/rooms', 'POST', {}, guest.token)).status, 403);
    assert.equal((await api('/health')).roomCreationApproval, true);
    const request = await api('/room-requests', 'POST', { password: 'room-secret' }, host.token);
    assert.equal(request.status, 202); assert.equal(request.state, 'pending'); assert.equal(request.roomId, undefined);
    assert.equal((await api('/admin/state', 'GET', null, admin)).rooms.length, 0);
    const queued = (await api('/admin/state', 'GET', null, admin)).creationRequests;
    assert.equal(queued.length, 1); assert.equal(queued[0].user.id, host.id); assert.equal(queued[0].passwordHash, undefined);
    assert.equal((await api('/rooms', 'POST', {}, host.token)).requestId, request.requestId);
    assert.equal((await api(`/room-requests/${request.requestId}`, 'GET', null, guest.token)).status, 404);
    assert.equal((await api(`/admin/room-requests/${request.requestId}/decision`, 'POST', { approve: true }, host.token)).status, 401);
    assert.equal((await api(`/admin/room-requests/${request.requestId}/decision`, 'POST', { approve: true }, admin)).status, 200);
    assert.equal((await api(`/admin/room-requests/${request.requestId}/decision`, 'POST', { approve: true }, admin)).status, 409);
    const room = await api(`/room-requests/${request.requestId}`, 'GET', null, host.token);
    assert.equal(room.state, 'approved'); assert.ok(room.roomId); assert.ok(room.pass); assert.equal(room.hasPassword, true);
    assert.equal((await api(`/rooms/${room.roomId}/verify`, 'POST', { password: 'wrong' })).status, 401);
    assert.equal((await api(`/rooms/${room.roomId}/verify`, 'POST', { password: 'room-secret' })).status, 200);
    const noRequest = await api('/rooms', 'POST', {}, host.token);
    assert.equal((await api(`/admin/room-requests/${noRequest.requestId}/decision`, 'POST', { approve: false }, admin)).status, 200);
    assert.equal((await api(`/room-requests/${noRequest.requestId}`, 'GET', null, host.token)).state, 'rejected');
    assert.equal((await api('/admin/state', 'GET', null, admin)).rooms.length, 1);
    const socket = io(base, { auth: { token: guest.token }, rejectUnauthorized: false, transports: ['websocket'] }); sockets.push(socket);
    await event(socket, 'connect');
    let pending = event(socket, 'join-pending'); socket.emit('join-room', { roomId: room.roomId, pass: room.pass, userName: 'Guest' }); await pending;
    let state = await api('/admin/state', 'GET', null, admin);
    assert.equal(state.rooms[0].participants.length, 0); assert.equal(state.rooms[0].pending[0].userId, guest.id);
    const approved = event(socket, 'join-approved');
    await api(`/admin/rooms/${room.roomId}/approval`, 'POST', { userId: guest.id, approve: true }, admin); await approved;
    const joined = event(socket, 'room-users'); socket.emit('join-room', { roomId: room.roomId, pass: room.pass, userName: 'Guest' }); await joined;
    state = await api('/admin/state', 'GET', null, admin); assert.equal(state.rooms[0].participants[0].userId, guest.id);
    const removed = event(socket, 'room-ended');
    await api(`/admin/rooms/${room.roomId}/users/${guest.id}`, 'DELETE', null, admin); await removed;
    const deniedSocket = io(base, { auth: { token: guest.token }, rejectUnauthorized: false, transports: ['websocket'] }); sockets.push(deniedSocket);
    await event(deniedSocket, 'connect');
    const rejected = event(deniedSocket, 'join-rejected'); deniedSocket.emit('join-room', { roomId: room.roomId, pass: room.pass }); await rejected;
    const hostSocket = io(base, { auth: { token: host.token }, rejectUnauthorized: false, transports: ['websocket'] }); sockets.push(hostSocket);
    await event(hostSocket, 'connect');
    const hostJoined = event(hostSocket, 'room-users'); hostSocket.emit('join-room', { roomId: room.roomId, pass: room.pass, userName: 'Host' }); await hostJoined;
    const ended = event(hostSocket, 'room-ended'); await api(`/admin/rooms/${room.roomId}`, 'DELETE', null, admin); await ended;
    const missing = event(hostSocket, 'join-error'); hostSocket.emit('join-room', { roomId: room.roomId }); assert.equal((await missing).code, 'not-found');
    await api(`/admin/users/${guest.id}`, 'DELETE', null, admin);
    assert.equal((await api('/auth/me', 'GET', null, guest.token)).status, 401);
    const adminRoom = await api('/admin/rooms', 'POST', { creatorId: host.id }, admin); assert.ok(adminRoom.roomId);
    const visitor = await add('Visitor');
    const visitorSocket = io(base, { auth: { token: visitor.token }, rejectUnauthorized: false, transports: ['websocket'] }); sockets.push(visitorSocket);
    await event(visitorSocket, 'connect');
    pending = event(visitorSocket, 'join-pending'); visitorSocket.emit('join-room', { roomId: adminRoom.roomId }); await pending;
    const rejectNotice = event(visitorSocket, 'join-rejected');
    await api(`/admin/rooms/${adminRoom.roomId}/approval`, 'POST', { userId: visitor.id, approve: false }, admin); await rejectNotice;
    const rejectAgain = event(visitorSocket, 'join-rejected'); visitorSocket.emit('join-room', { roomId: adminRoom.roomId }); await rejectAgain;
    await api('/admin/logout' , 'POST', null, admin);
    assert.equal((await api('/admin/state', 'GET', null, admin)).status, 401);
  } finally {
    sockets.forEach(socket => socket.disconnect()); child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
