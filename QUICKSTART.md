# ⚡ Quick Start Deployment Guide

Get ZoomClone running in production in under 5 minutes.

## Option 1: Local Server (Simple)

```bash
# 1. Build the client (already done in dist/)
cd client
npm install
npm run build

# 2. Start the server
cd ../server
npm install --production
node server.js
```

Visit: **https://localhost:5000**

## Option 2: Using Start Scripts

### Linux/Mac
```bash
chmod +x start-prod.sh
./start-prod.sh
```

### Windows
```cmd
start-prod.bat
```

## Option 3: Docker (Recommended for Cloud)

```bash
# Build image
docker build -t zoomclone .

# Run container
docker run -p 5000:5000 zoomclone
```

Visit: **https://localhost:5000**

## Option 4: Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

## Option 5: Deploy to Render

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Create New → Web Service
4. Connect GitHub repo
5. Set build command: `npm run build` (client) + `npm install` (server)
6. Set start command: `cd server && node server.js`
7. Deploy!

## Verify Deployment

```bash
# Run the check script
./check-deploy.sh    # or check-deploy.bat on Windows

# Or manually test
curl https://localhost:5000/api/rooms -X POST
```

## Environment Variables

```env
PORT=5000              # Server port
NODE_ENV=production    # Set to production
```

## Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Frontend (React app) |
| `POST /api/rooms` | Create new meeting room |
| `GET /api/rooms/:roomId` | Check if room exists |
| `WS /socket.io` | WebRTC signaling |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find dist" | Run `cd client && npm run build` |
| Port already in use | Use different port: `PORT=3000 node server.js` |
| Can't connect from another device | Use your computer's IP instead of localhost |
| SSL certificate warning | Expected in development, proceed anyway |

## Performance Tips

- Enable gzip compression on server
- Use a CDN for `/assets/*` 
- Set appropriate Keep-Alive timeouts
- Monitor room/participant count

## Next Steps

For complete documentation, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [README.md](./README.md) - Features and architecture
- [DEPLOYMENT.md#security-notes](./DEPLOYMENT.md) - Production security checklist

---

**Ready to ship?** 🚀

```bash
PORT=5000 node server/server.js
```
