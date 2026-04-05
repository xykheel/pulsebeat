# Build React client (standalone; no root workspace needed in image)
FROM node:20-bookworm AS client-build
WORKDIR /app
COPY CHANGELOG.md ./
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN cp /app/CHANGELOG.md ./public/CHANGELOG.md
RUN npm run build

# Runtime: compile better-sqlite3 from source (ARM64 / amd64)
FROM node:20-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY CHANGELOG.md /app/CHANGELOG.md
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
RUN cp /app/CHANGELOG.md ./CHANGELOG.md
COPY --from=client-build /app/client/dist ./public

ENV NODE_ENV=production
ENV PULSEBEAT_DATA_DIR=/app/data
ENV PULSEBEAT_STATIC_DIR=/app/server/public
EXPOSE 4141

CMD ["./node_modules/.bin/tsx", "index.ts"]
