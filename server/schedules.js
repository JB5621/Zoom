const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function scheduleFields(body = {}) {
  if (!body.scheduledAt) return null;
  const date = new Date(body.scheduledAt);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  if (!title || !Number.isFinite(date.getTime())) throw Error('Enter a title and valid meeting date.');
  const duration = Number(body.duration || 60);
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440) throw Error('Duration must be 15–1440 minutes.');
  return { title, scheduledAt: date.toISOString(), duration,
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '',
    recurring: body.recurring === true };
}
function createScheduleStore(dataDir) {
  const file = path.join(dataDir, 'meetings.json');
  let items = [];
  if (fs.existsSync(file)) items = JSON.parse(fs.readFileSync(file, 'utf8'));
  const save = () => {
    fs.mkdirSync(dataDir, { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
  };
  return {
    list: userId => items.filter(m => m.creatorId === userId).map(m => ({ ...m })),
    get: id => items.find(m => m.id === id),
    add: (creatorId, fields) => { const item = { id: randomUUID(), creatorId, ...fields }; items.push(item); save(); return item; },
    remove: id => { items = items.filter(m => m.id !== id); save(); },
  };
}
module.exports = { scheduleFields, createScheduleStore };
