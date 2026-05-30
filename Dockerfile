# Stage 1: build the React client
FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# Stage 2: lean production image
FROM node:20-alpine AS production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server ./

# Copy built client into the path the server expects
COPY --from=builder /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/auth/me || exit 1

CMD ["node", "server.js"]
