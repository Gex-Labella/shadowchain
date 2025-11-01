# Frontend Dockerfile for Shadow Chain

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy shared-crypto module
COPY shared-crypto /shared-crypto

# Copy source code
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/tsconfig.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/index.html ./

# Build the application
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Install runtime dependencies
RUN apk add --no-cache tini

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S shadowchain && \
    adduser -S shadowchain -u 1001

# Update nginx to run as non-root
RUN touch /var/run/nginx.pid && \
    chown -R shadowchain:shadowchain /var/run/nginx.pid /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Copy custom nginx config that runs on port 8080
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER shadowchain

# Expose port
EXPOSE 8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]