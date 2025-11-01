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

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Create nginx config that can handle backend being unavailable
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    location /api { \
        set $backend backend:3001; \
        proxy_pass http://$backend; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_connect_timeout 2s; \
        proxy_send_timeout 10s; \
        proxy_read_timeout 10s; \
    } \
    \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Use default nginx user instead of creating custom one
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]