# Frontend Dockerfile for Shadow Chain

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

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

# Runtime stage - simplified without Nginx
FROM node:18-alpine

# Install serve - a lightweight static file server
RUN npm install -g serve

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/build /app

# Switch to non-root user
USER nodejs

# Expose port 3000 (matching what host Nginx expects)
EXPOSE 3000

# Serve the static files
CMD ["serve", "-s", "/app", "-l", "3000"]