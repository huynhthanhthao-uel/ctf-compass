# CTF Autopilot Frontend - React/Vite
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from root project
COPY package*.json ./

# Install dependencies (use npm install if no lock file)
RUN npm install --legacy-peer-deps

# Copy source files
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY src ./src
COPY public ./public

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
    adduser -S appuser -u 1001

USER appuser

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
