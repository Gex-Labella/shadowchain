# Backend Dockerfile for Shadow Chain

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy shared-crypto module
COPY shared-crypto /shared-crypto

# Copy source code
COPY backend/src ./src

# Build the application
RUN npm run build

# Runtime stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy shared-crypto module
COPY --from=builder /shared-crypto /shared-crypto

# Create non-root user
RUN addgroup -g 1001 -S shadowchain && \
    adduser -S shadowchain -u 1001

# Change ownership
RUN chown -R shadowchain:shadowchain /app /shared-crypto

# Switch to non-root user
USER shadowchain

# Expose port
EXPOSE 3001

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]