# Frontend Dockerfile for Shadow Chain

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy shared-crypto module
COPY --from=shared-crypto /app/shared-crypto ../shared-crypto

# Copy source code
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY public ./public
COPY src ./src

# Build the application
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy nginx configuration
COPY --from=builder /app/build /usr/share/nginx/html

# Add custom nginx configuration for React Router
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]