# 🚀 Deployment Guide

## Overview
This is a full-stack WebRTC video conferencing application with built-in language interpretation. The application consists of:
- **Frontend**: React + Vite (served as static files)
- **Backend**: Node.js + Express + Socket.io
- **Protocol**: WebRTC for peer-to-peer video/audio + Socket.io for signaling

## Prerequisites
- Node.js 16+ 
- npm or yarn
- Port 5000 available (or configured via PORT env var)

## Local Development

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Start Development Server

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Server will run on `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Client will run on `https://localhost:5173`

## Production Deployment

### 1. Build the Client
```bash
cd client
npm install
npm run build
```
This creates optimized static files in `client/dist/`

### 2. Install Server Dependencies
```bash
cd server
npm install --production
```

### 3. Start Production Server
```bash
cd server
PORT=5000 node server.js
```

The application will:
- Serve the React frontend from `/` 
- Serve API routes from `/api`
- Serve Socket.io from `/socket.io`
- Handle all React Router paths correctly (SPA fallback)

## Environment Variables

Create a `.env` file in the server directory:

```
PORT=5000                    # Server port (default: 5000)
NODE_ENV=production          # Set to 'production'
```

## Docker Deployment

Example `Dockerfile` for production:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy and build client
COPY client ./client
WORKDIR /app/client
RUN npm ci && npm run build

# Copy and install server
WORKDIR /app
COPY server ./server
WORKDIR /app/server
RUN npm ci --only=production

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t zoomclone .
docker run -p 5000:5000 zoomclone
```

## Cloud Deployment

### Heroku
```bash
# Create app
heroku create zoomclone

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### AWS/DigitalOcean/Render
1. Push code to GitHub/GitLab
2. Connect repo to your cloud platform
3. Set deployment command: `npm run build` (client) then `npm start` (server)
4. Set environment variables in platform dashboard
5. Platform will automatically detect Node.js and start the server

## Architecture

### Request Flow
1. User visits `https://example.com`
2. Server serves `client/dist/index.html`
3. React app loads and connects to Socket.io at same origin
4. WebRTC connections established peer-to-peer
5. Signaling messages routed through Socket.io

### Rooms
- Created on-demand via `/api/rooms` POST
- Stored in memory (resets on server restart)
- Auto-deleted when empty after 1 minute

### Language Interpretation
- Admin creates channels with source/target languages
- Server generates invite tokens for interpreters
- Interpreter joins via `/interpreter?token=xyz` route
- Audio routing handled by client-side Web Audio API

## Performance Tips

1. **Enable Gzip Compression** on your server/CDN
2. **Use a CDN** to serve static assets (client/dist/)
3. **Monitor Room Count** - add persistence if needed
4. **WebRTC Optimization**: 
   - Ensure TURN servers are configured for NAT traversal
   - Consider ICE configuration for restrictive networks

## Troubleshooting

### "Room not found" error
- Check that server is running on port 5000
- Verify CORS settings if frontend is on different domain

### "Socket connection failed"
- Ensure WebSocket connections work: `/socket.io/?EIO=4&transport=websocket`
- Check firewall isn't blocking WebSocket protocol

### No video from other participants
- Check WebRTC isn't blocked by corporate firewalls
- Verify microphone/camera permissions granted
- Check browser console for specific errors

## Security Notes

⚠️ **For Production Use:**
- Add HTTPS (required for browser to access camera/microphone)
- Add user authentication if multi-tenant
- Rate limit `/api/rooms` endpoint
- Add input validation for room codes
- Use environment variables for sensitive config
- Consider adding TURN server for NAT traversal
- Add logging for monitoring and debugging

## Performance Metrics

- Build size: ~350 KB (minified JavaScript)
- Initial load: ~2-3 seconds
- WebRTC connection: ~1-2 seconds per peer
- Memory usage: ~50-100 MB base + per-room overhead

## Support

For issues or questions:
1. Check the README.md in project root
2. Review browser console for errors
3. Check server logs for Socket.io messages
