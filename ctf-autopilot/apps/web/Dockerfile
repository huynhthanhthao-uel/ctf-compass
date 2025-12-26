# CTF Autopilot Frontend - React/Vite
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from root project
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies - try npm first, fallback methods for different scenarios
RUN npm install --legacy-peer-deps 2>/dev/null || npm install --force || npm install

# Copy source files
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY eslint.config.js ./
COPY src ./src
COPY public ./public

# Build arguments for environment variables
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/dist ./dist

# Install serve for static file serving
RUN npm install -g serve

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["serve", "-s", "dist", "-l", "3000"]
