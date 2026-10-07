import { useEffect, useState } from "react";
import { apiUrl } from "../lib/roomAccess";
import ThemeToggle from "./ThemeToggle";
import "./admin.css";

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem("oguz_admin") || "");
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("rooms");
  async function request(path, method = "GET", body) {
    const response = await fetch(apiUrl(`/api/admin${path}`), {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (response.status === 401 && path !== "/login") {
      sessionStorage.removeItem("oguz_admin"); setToken(""); setState(null);
    }
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/state"), { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
          if (active) { sessionStorage.removeItem("oguz_admin"); setToken(""); setState(null); }
          return;
        }
        if (!response.ok) throw new Error("Could not refresh the admin panel.");
        const data = await response.json();
        if (active) setState(data);
      } catch (err) { if (active) setError(err.message); }
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  async function act(path, method, body) {
    setBusy(true); setError("");
    try { await request(path, method, body); setState(await request("/state")); return true; }
    catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  }
  async function decideRoomRequest(creationRequest, approve) {
    setNotice("");
    if (await act(`/room-requests/${creationRequest.id}/decision`, "POST", { approve })) {
      setNotice(approve
        ? `Accepted. ${creationRequest.user?.name || "The user"}'s room has been created.`
        : `Rejected the room request from ${creationRequest.user?.name || "the user"}.`);
    }
  }
  async function refreshRequests() {
    setBusy(true); setError("");
    try { setState(await request("/state")); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function login(event) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const data = await request("/login", "POST", Object.fromEntries(fields));
      sessionStorage.setItem("oguz_admin", data.token); setToken(data.token);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const pending = (state?.rooms.reduce((sum, room) => sum + room.pending.length, 0) || 0) + (state?.creationRequests?.length || 0);
  return <main className="admin-page">
    <ThemeToggle />
    <header><div><span className="admin-eyebrow">OGUZ MEETING</span><h1>Admin panel</h1><p>Manage people, rooms, and meeting access.</p></div>
      {token && <button disabled={busy} onClick={async () => {
        try { await request("/logout", "POST"); } catch { /* Clear local credentials even if offline. */ }
        sessionStorage.removeItem("oguz_admin"); setToken(""); setState(null);
      }}>Log out</button>}
    </header>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!token ? <form className="admin-card admin-login" onSubmit={login}>
      <h2>Administrator sign in</h2>
      <label>Username<input name="username" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form> : !state ? <p>Loading admin panel…</p> : <>
      <div className="admin-stats"><div><strong>{state.users.length}</strong>Users</div><div><strong>{state.rooms.length}</strong>Rooms</div><div><strong>{pending}</strong>Waiting for approval</div></div>
      <nav aria-label="Admin sections"><button className={tab === "rooms" ? "primary" : ""} onClick={() => setTab("rooms")}>Rooms & approvals</button><button className={tab === "users" ? "primary" : ""} onClick={() => setTab("users")}>Users & permissions</button></nav>
      <section className="admin-card admin-request-alert" aria-label="Room creation requests">
        <div className="admin-row"><h2>Room creation requests ({state.creationRequests?.length || 0})</h2>
          <button disabled={busy} onClick={refreshRequests}>Refresh requests</button>
        </div>
        <p>Click Accept request to create the user's room, or Reject request to say no.</p>
        {notice && <p className="admin-request-notice" role="status">{notice}</p>}
        {!Array.isArray(state.creationRequests)
          ? <p role="alert">Restart the backend server to enable room creation requests, then refresh this page.</p>
          : !state.creationRequests.length && <p role="status">No room requests waiting. When a user clicks Request New Meeting, their request and Accept / Reject buttons will appear here automatically.</p>}
        {(state.creationRequests || []).map(request => <div className="admin-row admin-person" key={request.id}>
          <div><b>{request.user?.name}</b> wants to create a room<p>{request.user?.email} · {new Date(request.createdAt).toLocaleString()}{request.hasPassword ? " · Password protected" : ""}</p></div>
          <div className="admin-actions">
            <button className="primary" disabled={busy} onClick={() => decideRoomRequest(request, true)}>Accept request</button>
            <button className="danger" disabled={busy} onClick={() => decideRoomRequest(request, false)}>Reject request</button>
          </div>
        </div>)}
      </section>
      {tab === "rooms" ? <>
        <form className="admin-card" onSubmit={async event => {
          event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
          if (await act("/rooms", "POST", { creatorId: fields.get("creatorId"), password: fields.get("password") })) form.reset();
        }}><h2>Create room</h2><div className="admin-fields">
          <label>Room creator<select name="creatorId" required defaultValue=""><option value="" disabled>Select user</option>{state.users.filter(user => user.canCreateRooms).map(user => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label>
          <label>Room password (optional)<input name="password" type="password" minLength={4} /></label>
        </div><button className="primary" disabled={busy}>Create room</button></form>
        <p>Room creators join automatically. Other participants and interpreters need your approval.</p>
        {!state.rooms.length && <section className="admin-card">No active rooms. Allowed users can create rooms from their dashboard.</section>}
        {state.rooms.map(room => <section className="admin-card" key={room.id}>
          <div className="admin-row"><div><h2>Room {room.id}</h2><p>Created by {room.creator ? `${room.creator.name} (${room.creator.email})` : "Deleted user"} · {new Date(room.createdAt).toLocaleString()}</p></div>
            <button className="danger" disabled={busy} onClick={() => window.confirm(`Delete room ${room.id} and end the meeting for everyone?`) && act(`/rooms/${room.id}`, "DELETE")}>Delete room</button></div>
          <h3>Waiting for approval ({room.pending.length})</h3>
          {!room.pending.length && <p>No pending requests.</p>}
          {room.pending.map(entry => <div className="admin-row admin-person" key={entry.userId}><span><b>{entry.user?.name}</b> · {entry.user?.email} · {entry.role}</span><div className="admin-actions">
            <button className="primary" disabled={busy} onClick={() => act(`/rooms/${room.id}/approval`, "POST", { userId: entry.userId, approve: true })}>Approve</button>
            <button disabled={busy} onClick={() => act(`/rooms/${room.id}/approval`, "POST", { userId: entry.userId, approve: false })}>Reject</button>
          </div></div>)}
          <h3>Connected ({room.participants.length})</h3>
          {!room.participants.length && <p>No connected users.</p>}
          {room.participants.map(person => <div className="admin-row admin-person" key={person.socketId}><span><b>{person.userName}</b> · {state.users.find(user => user.id === person.userId)?.email} · {person.role}</span>
            <button disabled={busy} onClick={() => act(`/rooms/${room.id}/users/${person.userId}`, "DELETE")}>Remove from room</button></div>)}
        </section>)}
      </> : <>
        <form className="admin-card" onSubmit={async event => {
          event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
          if (await act("/users", "POST", { name: fields.get("name"), email: fields.get("email"), password: fields.get("password"), canCreateRooms: fields.has("canCreateRooms") })) form.reset();
        }}><h2>Add user</h2><div className="admin-fields">
          <label>Name<input name="name" required minLength={2} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={6} required /></label>
        </div><label className="admin-check"><input type="checkbox" name="canCreateRooms" defaultChecked />Allow room creation requests</label><button className="primary" disabled={busy}>Add user</button></form>
        <section className="admin-card"><h2>Users</h2>{!state.users.length && <p>No users yet.</p>}{state.users.map(user => <div className="admin-row admin-person" key={user.id}>
          <div><b>{user.name}</b><p>{user.email}</p></div><div className="admin-actions">
            <label className="admin-check"><input type="checkbox" checked={user.canCreateRooms} disabled={busy} onChange={event => act(`/users/${user.id}`, "PATCH", { canCreateRooms: event.target.checked })} />Can request rooms</label>
            <button className="danger" disabled={busy} onClick={() => window.confirm(`Delete ${user.name}'s account and disconnect their sessions?`) && act(`/users/${user.id}`, "DELETE")}>Delete user</button>
          </div></div>)}</section>
      </>}
    </>}
  </main>;
}
