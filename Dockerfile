# --- Skynet Nexus News Dockerfile ---
# Uses node:22-slim so we get node:sqlite (built-in, no compile).
# Single-stage: no build step, just install prod deps + run.

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the rest of the app.
COPY . .

# Railway sets PORT dynamically; app listens on process.env.PORT.
EXPOSE 4180
CMD ["node", "server/index.js"]
