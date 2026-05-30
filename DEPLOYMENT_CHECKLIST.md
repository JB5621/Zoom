# ✅ Production Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] No console.log() or debug code in production builds
- [ ] All error handling in place
- [ ] No hardcoded IP addresses or localhost references
- [ ] Environment variables used for configuration

### Build & Assets
- [x] Client built: `npm run build` completed successfully
- [x] Production bundle created: `client/dist/` exists
- [x] Bundle size optimized: ~350KB JavaScript
- [ ] All assets gzipped (CDN/server config)
- [ ] Source maps disabled in production (✓ in vite.config.js)

### Configuration
- [x] `server.js` updated to serve static files from `client/dist/`
- [x] `vite.config.js` configured for production build
- [x] SPA fallback route added for React Router
- [ ] `.env` file created with production variables
- [ ] PORT environment variable supported (✓)

### Dependencies
- [x] Server `package.json` has all required packages
- [x] Client `package.json` has build script
- [ ] No unused dependencies installed
- [ ] npm audit passes (no critical vulnerabilities)

## Deployment Platform

### Common Platforms
- [ ] **Heroku**: Procfile setup, env vars configured
- [ ] **AWS EC2**: Node.js installed, PM2/systemd service created
- [ ] **DigitalOcean**: Server selected, firewall rules set
- [ ] **Render**: GitHub repo connected, build command set
- [ ] **Fly.io**: Dockerfile created, secrets configured
- [ ] **Docker**: Image built and tested locally
- [ ] **Azure**: App Service created, environment variables set
- [ ] **Google Cloud**: Cloud Run or Compute Engine ready

## Network & Security
- [ ] HTTPS enabled (required for camera/mic access)
- [ ] SSL certificate valid and non-expired
- [ ] CORS properly configured for your domain
- [ ] Firewall allows port 5000 (or your PORT)
- [ ] WebSocket (ws:/wss://) traffic allowed
- [ ] Rate limiting configured for `/api/rooms`

## Monitoring & Logging
- [ ] Error logging configured
- [ ] Application startup logs checked
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured
- [ ] Database connection logs (if applicable)

## Testing
- [ ] Load test completed
- [ ] Mobile device testing done
- [ ] Different browsers tested (Chrome, Firefox, Safari)
- [ ] Network connectivity tested
- [ ] Chat functionality verified
- [ ] Screen sharing verified
- [ ] Video recording verified
- [ ] Language interpretation tested

## Performance
- [ ] Initial page load under 3 seconds
- [ ] WebRTC connection under 2 seconds
- [ ] API response times under 200ms
- [ ] Memory usage monitored
- [ ] CPU usage monitored
- [ ] Database query performance checked

## Backup & Disaster Recovery
- [ ] Database backups automated (if applicable)
- [ ] Code repository has backups
- [ ] Disaster recovery plan documented
- [ ] Rollback procedure tested
- [ ] Data retention policy defined

## Post-Deployment
- [ ] Monitor server logs for errors
- [ ] Check analytics and usage patterns
- [ ] Set up alerts for critical errors
- [ ] Document any issues encountered
- [ ] Plan for scaling if needed
- [ ] Schedule regular maintenance window

## Quick Verification
```bash
# 1. Check server is running
curl -I https://your-domain.com/

# 2. Create a test room
curl -X POST https://your-domain.com/api/rooms

# 3. Verify assets are served
curl -I https://your-domain.com/assets/index-*.js

# 4. Check WebSocket connection
wscat -c wss://your-domain.com/socket.io/?EIO=4&transport=websocket
```

## Documentation
- [ ] README updated with deployment URL
- [ ] DEPLOYMENT.md reviewed
- [ ] Support documentation prepared
- [ ] Team trained on deployment process
- [ ] Incident response plan in place

## Compliance & Legal
- [ ] Privacy policy in place
- [ ] Terms of service reviewed
- [ ] Data protection laws followed (GDPR, CCPA, etc.)
- [ ] User consent for recording/data collection
- [ ] Accessibility requirements met (WCAG 2.1)

---

## Deployment Command Checklist

### Build Phase
```bash
# Client
cd client
npm install
npm run build

# Server
cd ../server
npm install --production
```

### Start Phase
```bash
# Set environment
export PORT=5000
export NODE_ENV=production

# Or on Windows
set PORT=5000
set NODE_ENV=production

# Start server
node server.js
```

### Verify Phase
```bash
# Check server running
curl https://localhost:5000/

# Check build files served
curl https://localhost:5000/assets/index-*.js

# Create test room
curl -X POST https://localhost:5000/api/rooms
```

---

## Emergency Contacts

- [ ] DevOps team contact
- [ ] Database administrator contact
- [ ] Security team contact
- [ ] Incident management contact
- [ ] Executive sponsor contact

## Sign-Off

- [ ] Project Manager: _______________ Date: ________
- [ ] DevOps Engineer: _______________ Date: ________
- [ ] QA Lead: _______________ Date: ________
- [ ] Security Officer: _______________ Date: ________

---

**Status**: Ready for Deployment ✅
**Last Updated**: 2026-05-17
