# 🎥 ZoomClone — WebRTC Video Conferencing App

A fully functional Zoom-like video conferencing app built with:
- **React 19** (frontend with modern UI)
- **Node.js + Express** (backend signaling server)
- **Socket.io** (real-time WebRTC signaling)
- **WebRTC** (peer-to-peer video & audio)
- **Language Interpretation** (real-time translation support)

### ✨ Features

- 📹 **HD Video Conferencing** — Peer-to-peer WebRTC connections
- 🎙️ **Screen Sharing** — Share your screen with participants
- 💬 **Live Chat** — Text messaging during meetings
- 🌐 **Language Interpretation** — Support for 35+ languages including Turkmen & Russian
- 🎥 **Recording** — Record meetings locally
- 🎨 **Modern UI** — Beautiful glassmorphic design with smooth animations
- ⚡ **No Account** — Create or join instantly with room codes
- 🔐 **Secure** — P2P encryption, no server recording

---

## 📁 Project Structure

```
zoom-clone/
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
- Node.js 16+
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

Server runs on: **http://localhost:5000**

### Step 4 — Start the React App

```bash
cd client
npm run dev
```

Client runs on: **https://localhost:5173**

For other devices on the same network, use your computer's LAN IP: `https://YOUR_IP:5173`

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

## 📡 Adding a TURN Server (Production)

WebRTC P2P fails behind some corporate firewalls without a TURN server.
In `useWebRTC.js`, add your TURN credentials to `ICE_SERVERS`:

```js
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com:3478",
      username: "your_username",
      credential: "your_password",
    },
  ],
};
```

Free TURN providers: **Metered.ca**, **Twilio**, **Xirsys**

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Backend | Node.js, Express 4 |
| Real-time | Socket.io 4 |
| Video/Audio | WebRTC (browser native) |
| Styling | CSS-in-JS (inline styles) |
| Fonts | Syne + DM Sans (Google Fonts) |
