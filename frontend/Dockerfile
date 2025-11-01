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

# Copy only the source files (not the entire directory)
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/tsconfig.json ./

# Build the app
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Install runtime dependencies
RUN apk add --no-cache tini

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S shadowchain && \
    adduser -S shadowchain -u 1001

# Setup nginx permissions
RUN touch /var/run/nginx.pid && \
    chown -R shadowchain:shadowchain /var/run/nginx.pid /var/cache/nginx /var/log/nginx /usr/share/nginx/html

# Create nginx config
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:3001; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

USER shadowchain

EXPOSE 8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["nginx", "-g", "daemon off;"]