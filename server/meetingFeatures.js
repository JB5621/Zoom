const { randomUUID } = require('crypto');

const REACTIONS = new Set(['👍', '👏', '❤️', '😂', '🎉']);
const MAX_FILE_BYTES = 512 * 1024;
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function initMeeting(room) {
  room.locked ??= false;
  room.allowScreenShare ??= true;
  room.spotlightId ??= null;
  room.breakouts ??= [];
  room.chatHistory ??= [];
}
function meetingState(room) {
  initMeeting(room);
  return { locked: room.locked, allowScreenShare: room.allowScreenShare,
    spotlightId: room.spotlightId, title: room.title || '', parentRoomId: room.parentRoomId || null,
    breakouts: room.breakouts.map(r => ({ id: r.id, name: r.name })),
    participants: [...room.participants.values(), ...room.interpreters.values()] };
}
function registerMeetingFeatures(io, socket, { getRoom, rooms, endRoom, sfu }) {
  const roomOf = () => getRoom(socket.data?.roomId);
  const publish = room => io.to(room.id).emit('meeting-state', meetingState(room));
  const on = (event, handler) => socket.on(event, async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const room = roomOf();
      if (!room || !room.participants.has(socket.id) && !room.interpreters.has(socket.id)) throw Error('Join a meeting first.');
      initMeeting(room);
      await handler(room, payload && typeof payload === 'object' ? payload : {});
      reply({ ok: true });
    } catch (error) { reply({ error: error.message }); }
  });
  const host = room => { if (room.adminId !== socket.id) throw Error('Only the host can do that.'); };
  socket.on('meeting-state-get', (_data, ack) => {
    const room = roomOf();
    if (typeof ack === 'function') ack(room ? { state: meetingState(room) } : { error: 'not-in-room' });
  });
  on('meeting-settings', (room, data) => {
    host(room);
    if (typeof data.locked === 'boolean') room.locked = data.locked;
    if (typeof data.allowScreenShare === 'boolean') {
      room.allowScreenShare = data.allowScreenShare;
      if (!data.allowScreenShare) io.to(room.id).except(socket.id).emit('stop-sharing');
    }
    if (Object.hasOwn(data, 'spotlightId')) {
      if (data.spotlightId !== null && !room.participants.has(data.spotlightId)) throw Error('Participant has left.');
      room.spotlightId = data.spotlightId;
    }
    publish(room);
  });
  on('host-mute', async (room, data) => {
    host(room);
    const targets = [...room.participants.values(), ...room.interpreters.values()]
      .filter(p => p.socketId !== socket.id && (!data.socketId || p.socketId === data.socketId));
    for (const p of targets) {
      await sfu.mutePeer?.(p.socketId);
      p.isMuted = true;
      io.to(p.socketId).emit('host-muted');
      io.to(room.id).emit('user-mute-changed', { socketId: p.socketId, isMuted: true });
    }
    publish(room);
  });
  on('host-remove', (room, data) => {
    host(room);
    const target = room.participants.get(data.socketId) || room.interpreters.get(data.socketId);
    if (!target || target.socketId === socket.id) throw Error('Choose another participant.');
    room.denied.add(target.userId);
    for (const s of io.sockets.sockets.values()) {
      if (s.data.roomId === room.id && s.accountId === target.userId) {
        s.emit('room-ended', { reason: 'host-removed' }); s.disconnect(true);
      }
    }
  });
  on('raise-hand', (room, data) => {
    const person = room.participants.get(socket.id) || room.interpreters.get(socket.id);
    person.handRaised = !!data.raised;
    publish(room);
  });
  on('reaction', (room, data) => {
    if (!REACTIONS.has(data.emoji)) throw Error('Unknown reaction.');
    if (Date.now() - (socket.lastReaction || 0) < 1000) return;
    socket.lastReaction = Date.now();
    io.to(room.id).emit('reaction', { socketId: socket.id, userName: socket.data.userName, emoji: data.emoji, id: randomUUID() });
  });
  on('share-request', room => {
    if (!room.allowScreenShare && room.adminId !== socket.id) throw Error('Screen sharing is restricted to the host.');
    if (room.presenterId && room.presenterId !== socket.id) throw Error('Someone is already sharing.');
    room.presenterId = socket.id;
    io.to(room.id).emit('presentation-started', { socketId: socket.id, userName: socket.data.userName });
  });
  on('chat-send', (room, data) => {
    // Allow short bursts (quick replies, a file right after text) but cap flooding.
    const now = Date.now();
    socket.recentMessages = (socket.recentMessages || []).filter(t => now - t < 3000);
    if (socket.recentMessages.length >= 5) throw Error('Please wait before sending another message.');
    const message = text(data.message, 4000);
    const target = data.to ? room.participants.get(data.to) || room.interpreters.get(data.to) : null;
    if (data.to && !target) throw Error('The recipient has left.');
    let file = null;
    if (data.file) {
      const { name, base64 } = data.file;
      if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw Error('Files must be 512 KB or smaller.');
      const size = Buffer.from(base64, 'base64').length;
      if (!size || size > MAX_FILE_BYTES) throw Error('Invalid file.');
      file = { name: text(name, 120).replace(/[\\/\x00-\x1f]/g, '_') || 'attachment', base64, size };
    }
    if (!message && !file) throw Error('Enter a message or choose a file.');
    socket.recentMessages.push(now);
    const entry = { id: randomUUID(), from: socket.id, userName: socket.data.userName,
      to: target?.socketId || null, toName: target?.userName || null, message, file, timestamp: new Date().toISOString() };
    if (target) {
      io.to(socket.id).to(target.socketId).emit('new-message', entry);
    } else {
      // Attachments are delivered live; retain only bounded text history.
      room.chatHistory.push({ ...entry, file: null, message: message || `[File: ${file.name}]` });
      if (room.chatHistory.length > 100) room.chatHistory.shift();
      io.to(room.id).emit('new-message', entry);
    }
  });
  on('caption', (room, data) => {
    const person = room.participants.get(socket.id) || room.interpreters.get(socket.id);
    const caption = text(data.text, 500);
    if (!caption || person.isMuted || Date.now() - (socket.lastCaption || 0) < 200) return;
    socket.lastCaption = Date.now();
    io.to(room.id).emit('caption', { id: randomUUID(), socketId: socket.id, userName: socket.data.userName, text: caption });
  });
  on('breakouts-create', (room, data) => {
    host(room);
    if (room.parentRoomId) throw Error('Create breakout rooms from the main meeting.');
    if (room.breakouts.length) throw Error('Close the existing breakout rooms first.');
    const count = Number(data.count);
    if (!Number.isInteger(count) || count < 1 || count > 8) throw Error('Choose between 1 and 8 rooms.');
    for (let i = 0; i < count; i++) {
      const id = randomUUID().slice(0, 8).toUpperCase();
      const name = `Breakout ${i + 1}`;
      const child = { id, title: name, creatorId: room.creatorId, parentRoomId: room.id,
        approved: new Set(), denied: new Set(), pending: new Map(), createdAt: new Date(),
        adminId: null, participants: new Map(), interpreters: new Map(), interpretationChannels: [], presenterId: null,
        assignedUsers: new Set([socket.accountId]), passwordHash: null };
      initMeeting(child); rooms.set(id, child); room.breakouts.push({ id, name });
    }
    publish(room);
  });
  on('breakout-assign', (room, data) => {
    host(room);
    const destination = room.breakouts.find(r => r.id === data.roomId);
    const target = io.sockets.sockets.get(data.socketId);
    if (!destination || !target || target.data.roomId !== room.id) throw Error('Choose a connected participant and a breakout room.');
    getRoom(destination.id)?.assignedUsers.add(target.accountId);
    room.returningUsers ??= new Set(); room.returningUsers.add(target.accountId);
    target.emit('breakout-move', { roomId: destination.id, parentRoomId: room.id });
  });
  on('breakouts-close', room => {
    host(room);
    for (const child of room.breakouts) {
      const breakout = getRoom(child.id);
      if (!breakout) continue;
      for (const p of [...breakout.participants.values(), ...breakout.interpreters.values()]) {
        room.returningUsers ??= new Set(); room.returningUsers.add(p.userId);
        io.to(p.socketId).emit('breakout-move', { roomId: room.id });
      }
      endRoom(breakout, { silent: true });
    }
    room.breakouts = []; publish(room);
  });
}
module.exports = { initMeeting, meetingState, registerMeetingFeatures };
