# 🎥 Oguz Meeting — WebRTC Video Conferencing App

A fully functional video conferencing app built with:
- **React 19** (frontend with modern UI)
- **Node.js + Express** (backend signaling server)
- **Socket.io** (real-time WebRTC signaling)
- **mediasoup SFU** (WebRTC media forwarding)
- **Language Interpretation** (real-time translation support)

### ✨ Features

- 📹 **HD Video Conferencing** — WebRTC media through a mediasoup SFU
- 🎙️ **Screen Sharing** — Share your screen with participants
- 💬 **Live Chat** — Text messaging during meetings
- 🌐 **Language Interpretation** — Support for 35+ languages including Turkmen & Russian
- 🎥 **Recording** — Record meetings locally
- 🎨 **Modern UI** — Dark, video-first interface driven by CSS design tokens (see `client/src/index.css`), so the whole app can be rethemed from one block
- 🔐 **Login System** — Local accounts stored in a JSON database on the server
- 🔐 **Media transport** — Encrypted browser-to-SFU connections; recordings download locally

---

## 📁 Project Structure

```
oguz-meeting/
├── server/
│   ├── package.json
│   ├── server.js          ← Signaling server (Socket.io + Express)
│   └── .env.example
│
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── dist/              ← Built production assets
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css      ← Global styles + animations
│       ├── hooks/
│       │   ├── useWebRTC.js      ← Core WebRTC + socket logic
│       │   ├── useRecorder.js    ← Video recording
│       │   └── useInterpretation.js
│       └── components/
│           ├── Home.jsx        ← Landing page
│           ├── Room.jsx        ← Meeting room
│           ├── VideoPlayer.jsx ← Video tiles
│           ├── Controls.jsx    ← Toolbar
│           ├── Chat.jsx        ← Chat panel
│           ├── InterpretationPanel.jsx
│           └── ...
│
├── README.md
├── DEPLOYMENT.md          ← 🚀 Production deployment guide
├── .gitignore
├── build.sh              ← Production build script
└── build.bat             ← Windows build script
```

---

## 🚀 Development Setup

### Prerequisites
- Node.js 22.12+
- npm or yarn

### Step 1 — Install Server Dependencies

```bash
cd server
npm install
```

### Step 2 — Install Client Dependencies

```bash
cd client
npm install
```

### Step 3 — Start the Signaling Server

```bash
cd server
npm run dev       # with hot-reload (nodemon)
```

Server runs on: **https://localhost:5000** and serves the JSON-backed auth API at `/api/auth/*`

### Step 4 — Start the React App

```bash
cd client
npm run dev
```

Client runs on: **https://localhost:5173**

For other devices on the same network, use your computer's LAN IP: `https://YOUR_IP:5173`

### One-command dev start

From the workspace root, run:

```bash
npm start
```

That launches the backend on `https://localhost:5000` and the Vite client on `https://localhost:5173`.

If port `5000` or `5173` is already in use, the launcher reuses the existing process instead of failing.

---

## 🌍 Production Deployment

For complete production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

### Quick Start

```bash
# Build client
cd client && npm install && npm run build

# Start production server
cd ../server && npm install --production
PORT=5000 node server.js
```

Server will:
- Serve React frontend from `/`
- Handle API at `/api/*`
- Manage Socket.io at `/socket.io`
- Automatically route React paths (SPA)

### Supported Platforms
- ✅ Heroku
- ✅ AWS (EC2, Elastic Beanstalk)
- ✅ DigitalOcean
- ✅ Render
- ✅ Docker/Kubernetes
- ✅ Any Node.js hosting

---

## 🔗 How It Works

### Architecture

```
Browser A ──┐                    ┌── Browser B
            │   WebSocket (SDP)  │
            ├── Socket.io Server ─┤
            │   (Node.js :5000)  │
            │                    │
            └──── WebRTC P2P ────┘
                  (direct video/audio)
```

### WebRTC Flow (Signaling)

1. **User A** creates a room → gets Room ID
2. **User B** joins with that ID → both connect to Socket.io server
3. User A sends an **Offer** (SDP) to User B via socket
4. User B replies with an **Answer** (SDP) via socket
5. Both exchange **ICE Candidates** (network path info)
6. Direct **P2P connection** established — video flows peer-to-peer
7. Server only relays signals, **not video data**

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 Video Calls | HD video via WebRTC (up to 720p) |
| 🎤 Mute / Unmute | Toggle microphone on/off |
| 📵 Video On/Off | Toggle camera on/off |
| 🖥️ Screen Share | Share your screen to all participants |
| 💬 In-room Chat | Real-time text chat sidebar |
| 🔗 Shareable Link | Copy meeting link with one click |
| 👥 Multi-party | Supports multiple participants |
| 🏠 Auto room cleanup | Empty rooms deleted after 60s |

---

## 🌐 Multi-Device Testing

### Same machine
Open `https://localhost:5173` in one or more browser windows.

### Different devices on the same network
1. Find your computer's local IP address.
2. Start the server and client on your computer.
3. Open `https://YOUR_IP:5173` from the other device.
4. If the browser warns about the certificate, proceed once and allow camera/microphone access.
5. The client should connect to the backend through the current origin by default; use `VITE_SOCKET_URL` only if you are hosting the signaling server elsewhere.

### Public deployment
- Deploy server to **Railway**, **Render**, or **Fly.io**
- Deploy client to **Vercel** or **Netlify**
- Add a TURN server for NAT traversal (e.g. **Twilio**, **Metered**)

---

## 🔧 Environment Variables

Create `server/.env`:
```env
PORT=5000
```

---

## Media deployment

The backend forwards media through mediasoup. Configure `MEDIASOUP_ANNOUNCED_IP`
to a reachable address and open the configured UDP/TCP media port range. An HTTP
reverse proxy alone does not forward those media ports. See `server/.env.example`.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router v7 |
| Backend | Node.js, Express 4 |
| Real-time | Socket.io 4 |
| Video/Audio | WebRTC with mediasoup SFU |
| Styling | CSS-in-JS (inline styles) |
| Fonts | Syne + DM Sans (Google Fonts) |

## Admin panel

Open `https://localhost:5173/admin` while the development servers are running.
Sign in with username `admin` and password `admin`. Override these defaults with
`ADMIN_USERNAME` and `ADMIN_PASSWORD` in `server/.env`; restart the server after changing them.
Admin sessions are separate from user accounts and expire after eight hours.

The panel supports adding/deleting users, changing each user's room-creation
permission, creating rooms for a selected user, deleting rooms, viewing connected
participants/interpreters, removing users from rooms, and approving/rejecting room creation requests.
Each user request for a new room appears as an alert in `/admin` with **Accept request**
and **Reject request** buttons. No room is created before approval. The requesting
user waits on the dashboard and enters automatically after Yes, or sees a rejection
message after No. Requests are retained for up to 24 hours while the server runs;
the dashboard remembers the pending request across refreshes in the same tab.
Admins can also create rooms directly for users. Signed-in participants and invited interpreters join automatically. Protected rooms still require a password. Removed accounts cannot rejoin that room. The panel refreshes
every three seconds. User accounts and creation permissions persist in the local
JSON database; rooms and room approvals last until the server restarts.

Run the isolated API/socket authorization test with `node --test server/test/admin.cjs`.
The test uses a temporary database and stubs media workers; it does not test live audio/video.

## Expanded meeting features

- **Pre-join screen:** preview video, test microphone levels and speaker output,
  select devices, and join with audio/video off or without devices.
- **Participants:** search attendees, raise/lower hands, and show microphone status.
- **Layouts:** gallery, active-speaker view, local pinning, and host spotlighting.
- **Host controls:** mute individuals/all others, remove users, restrict screen sharing,
  and lock admission. Participants choose when to unmute; existing attendees can reconnect.
- **Reactions:** temporary emoji reactions visible to the meeting.
- **Scheduling:** titles, local date/time, descriptions, duration, persistent invitation
  links, weekly calendar recurrence, and downloadable `.ics` invitations. Schedule
  requests require administrator approval. Only the organizer starts a session;
  its invitation link can be used again after a session ends.
- **Chat:** public and private messages, unread counts, downloads, and attachments up
  to 512 KB. New arrivals receive the latest 100 public text messages. Attachments
  and private messages are delivered live; each tab keeps its latest 200 messages.
- **Recording:** local composite video and mixed audio, updated as participants and
  tracks change; pause/resume and automatic download on leaving or meeting closure.
  Keep the tab open until the download finishes. Closing the browser can lose a recording.
- **Backgrounds:** local person segmentation with blur, a studio background, or an
  uploaded image (up to 8 MB). Initial setup fetches MediaPipe WASM/model assets.
  To host those assets yourself, set `VITE_MEDIAPIPE_WASM_URL` and
  `VITE_SEGMENTATION_MODEL_URL` before building. Segmentation runs at 640×360, 15 fps.
- **Breakout rooms:** hosts create up to eight rooms, assign participants, and close
  rooms to bring everyone back. Assigned users can also return to the main meeting.
- **Captions:** display shared captions and opt in to transcribing your microphone
  through browser speech recognition. Recognition may use the browser provider's
  online service; language availability varies. This is speech-to-text, not automatic
  translation. The existing human-interpreter channels remain available.
- **Recovery and sharing:** capture tracks survive socket reconnects; tab audio is
  played separately from microphone audio and included in local recordings.

The dashboard has no optional meeting-password field. Administrators can still
create protected rooms, and joining those rooms still requires their password.

### Validation

```sh
npm run lint --prefix client
npm run build --prefix client
npm test --prefix server
npm run test:e2e --prefix client
```

Browser tests use a temporary data directory, fake cameras/microphones, and a real
mediasoup worker. Install Chrome at `/usr/bin/google-chrome`, or set `CHROME_PATH`.
They exercise two-party media, reconnection, screen/tab-audio sharing, host controls,
chat, recording downloads, and breakout transfers. Set `TEST_BACKGROUND=1` to also
exercise the real background model download; that additional check needs internet.
No live speech-recognition service or physical camera is required by the default tests.
