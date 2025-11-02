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
COPY frontend/tailwind.config.js ./

# Set build-time environment variables for production
ENV REACT_APP_API_URL=https://shadowchain.locsafe.org/api
ENV REACT_APP_WS_URL=wss://shadowchain.locsafe.org/ws
ENV REACT_APP_GITHUB_CLIENT_ID=${REACT_APP_GITHUB_CLIENT_ID}

# Build the app
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Use default nginx user instead of creating custom one
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]