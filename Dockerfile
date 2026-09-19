# Stage 1: build the React client
FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# Stage 2: production image
#
# Debian rather than Alpine: mediasoup compiles a native worker, and building
# it against musl is the kind of thing that works until it doesn't. The extra
# image size buys a toolchain that mediasoup actually targets.
FROM node:20-bookworm-slim AS production

# mediasoup builds its worker from source on install.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip build-essential ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server ./

# Copy built client into the path the server expects
COPY --from=builder /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=5000

# A narrower media range than the default, because each published port costs
# a userland proxy process under Docker's default networking. For anything
# beyond a handful of concurrent calls, run with --network host and widen it.
ENV MEDIASOUP_MIN_PORT=40000
ENV MEDIASOUP_MAX_PORT=40199

EXPOSE 5000
EXPOSE 40000-40199/udp
EXPOSE 40000-40199/tcp

# NOTE: MEDIASOUP_ANNOUNCED_IP must be set at run time to this host's public
# address. Without it the container announces its own internal address and
# every call connects without carrying media. For example:
#
#   docker run --network host \
#     -e MEDIASOUP_ANNOUNCED_IP=203.0.113.10 \
#     -e MEDIASOUP_MIN_PORT=40000 -e MEDIASOUP_MAX_PORT=49999 \
#     oguzmeeting

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/auth/me || exit 1

CMD ["node", "server.js"]
