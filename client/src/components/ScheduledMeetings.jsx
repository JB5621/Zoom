import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthState';
import { apiUrl, createRoom, getRoomCreationRequest } from '../lib/roomAccess';
import './meeting.css';
import { CalendarPlus, Calendar, Copy, Trash2, Send, Video } from './icons';

async function api(path, token, method = 'GET') {
  const res = await fetch(apiUrl(path), { method, headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json(); if (!res.ok) throw Error(data.error || 'Request failed.'); return data;
}
function calendar(meeting) {
  const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const link = `${window.location.origin}/meeting/${meeting.id}`;
  const text = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Oguz Meeting//EN','BEGIN:VEVENT',`UID:${meeting.id}@oguz`,
    `DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(meeting.scheduledAt)}`,`DTEND:${stamp(new Date(meeting.scheduledAt).getTime() + meeting.duration * 60000)}`,
    `SUMMARY:${escape(meeting.title)}`,`DESCRIPTION:${escape(meeting.description + '\n' + link)}`,`URL:${link}`,
    ...(meeting.recurring ? ['RRULE:FREQ=WEEKLY'] : []),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })); const a = document.createElement('a'); a.href = url; a.download = 'meeting.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function ScheduledMeetings() {
  const { token, user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const storageKey = `oguz_schedule_request_${user.id}`;
  const [pending, setPending] = useState(() => sessionStorage.getItem(storageKey) || '');
  useEffect(() => {
    let active = true;
    api('/api/meetings', token).then(data => { if (active) setMeetings(data.meetings); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token, pending]);
  useEffect(() => {
    if (!pending) return;
    let active = true; let timer;
    const check = async () => {
      try {
        const result = await getRoomCreationRequest(pending);
        if (!active) return;
        if (result.state !== 'pending') {
          sessionStorage.removeItem(storageKey); setPending('');
          setNotice(result.state === 'approved' ? 'Scheduled meeting approved. Its invitation link is ready below.' : 'The administrator rejected this request.'); return;
        }
      } catch (e) { if (active) { setError(e.message); if ([401,404,410].includes(e.status)) { sessionStorage.removeItem(storageKey); setPending(''); return; } } }
      if (active) timer = setTimeout(check, 2000);
    }; check(); return () => { active = false; clearTimeout(timer); };
  }, [pending, storageKey]);
  async function schedule(event) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await createRoom(undefined, { title: data.get('title'), description: data.get('description'),
        scheduledAt: new Date(data.get('date')).toISOString(), duration: Number(data.get('duration')), recurring: data.has('recurring') });
      sessionStorage.setItem(storageKey, result.requestId); setPending(result.requestId); setForm(false);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="schedule-list"><h2>Scheduled meetings</h2>
    <button className="icon-btn" onClick={() => setForm(v => !v)} disabled={!!pending}>{pending ? 'Waiting for schedule approval…' : <><CalendarPlus size={16} /> Schedule a meeting</>}</button>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {form && <form className="meeting-card" onSubmit={schedule} style={{marginTop:12}}><label>Title<input name="title" required maxLength={100} /></label>
      <label>Date and time (your local timezone)<input name="date" type="datetime-local" required /></label>
      <label>Duration in minutes<input name="duration" type="number" min={15} max={1440} defaultValue={60} /></label>
      <label>Description<textarea name="description" maxLength={2000} /></label>
      <label><span><input name="recurring" type="checkbox" /> Repeat weekly with the same invitation link</span></label>
      <button disabled={busy} className="primary icon-btn"><Send size={16} /> Request schedule approval</button></form>}
    {!meetings.length && <p>No scheduled meetings yet.</p>}
    {meetings.map(meeting => <article key={meeting.id} className="schedule-item"><strong>{meeting.title}</strong>
      <p>{new Date(meeting.scheduledAt).toLocaleString()} · {meeting.duration} min{meeting.recurring ? ' · Weekly' : ''}</p><p>{meeting.description}</p>
      <a href={`/meeting/${meeting.id}`}>Open meeting</a><div className="meeting-actions">
        <button className="icon-btn" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/meeting/${meeting.id}`); setNotice('Invitation link copied.'); } catch { setNotice(`${window.location.origin}/meeting/${meeting.id}`); } }}><Copy size={16} /> Copy invitation</button>
        <button className="icon-btn" onClick={() => calendar(meeting)}><Calendar size={16} /> Add to calendar</button>
        <button className="icon-btn" onClick={async () => { if (!window.confirm('Delete this schedule and close any active session?')) return; try { await api(`/api/meetings/${meeting.id}`, token, 'DELETE'); setMeetings(list => list.filter(m => m.id !== meeting.id)); } catch (e) { setError(e.message); } }}><Trash2 size={16} /> Delete</button>
      </div></article>)}
  </section>;
}
export function ScheduledMeetingJoin() {
  const { id } = useParams(); const { token } = useAuth(); const navigate = useNavigate();
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api(`/api/meetings/${id}`, token).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id, token]);
  async function join() { setBusy(true); try { const result = await api(`/api/meetings/${id}/join`, token, 'POST'); navigate(`/room/${result.roomId}`); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <main className="prejoin"><section className="meeting-card"><h1>{data?.meeting.title || 'Scheduled meeting'}</h1>
    {data && <><p>{new Date(data.meeting.scheduledAt).toLocaleString()} · {data.meeting.duration} minutes</p><p>{data.meeting.description}</p>
      <button className="primary icon-btn" disabled={busy} onClick={join}><Video size={16} /> {data.isOrganizer ? 'Start or join meeting' : 'Join meeting'}</button></>}
    {error && <p role="alert">{error}</p>}<p><a href="/dashboard">Back to dashboard</a></p></section></main>;
}
