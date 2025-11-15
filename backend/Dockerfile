# Backend Dockerfile for Shadow Chain

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies including native addon build tools
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY backend/src ./src

# Build the application
RUN npm run build

# Copy migrations (they are not compiled by TypeScript)
COPY backend/src/db ./dist/db

# Runtime stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S shadowchain && \
    adduser -S shadowchain -u 1001

# Change ownership
RUN chown -R shadowchain:shadowchain /app

# Switch to non-root user
USER shadowchain

# Expose port
EXPOSE 3001

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]