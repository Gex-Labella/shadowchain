#!/bin/bash

# Shadow Chain Local Development Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Shadow Chain - Local Development Setup"
echo "========================================"

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command docker
check_command docker-compose
check_command node
check_command npm

# Check if .env exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "📝 Please edit .env with your API keys before continuing."
    echo "   Required: GITHUB_TOKEN, TWITTER_BEARER_TOKEN"
    read -p "Press enter when ready..."
fi

# Start services
echo "🔨 Building Docker images..."
cd "$PROJECT_DIR"
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
check_service() {
    local service=$1
    local port=$2
    local endpoint=$3
    
    echo -n "  Checking $service..."
    if curl -s -f "http://localhost:$port$endpoint" > /dev/null 2>&1; then
        echo " ✅"
        return 0
    else
        echo " ⚠️  (may still be starting)"
        return 1
    fi
}

echo "🏥 Checking service health..."
check_service "IPFS" 5001 "/api/v0/version"
check_service "Backend API" 3001 "/api/health"
check_service "Frontend" 3000 "/"

# Check Substrate node
echo -n "  Checking Substrate node..."
if curl -s -H "Content-Type: application/json" \
    -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
    http://localhost:9933 | grep -q "result"; then
    echo " ✅"
else
    echo " ⚠️  (may still be starting)"
fi

echo ""
echo "✨ Shadow Chain is running!"
echo ""
echo "📍 Service URLs:"
echo "  Frontend:        http://localhost:3000"
echo "  Backend API:     http://localhost:3001"
echo "  Substrate WS:    ws://localhost:9944"
echo "  Substrate RPC:   http://localhost:9933"
echo "  IPFS Gateway:    http://localhost:8080"
echo "  IPFS API:        http://localhost:5001"
echo ""
echo "📝 Useful commands:"
echo "  View logs:       make dev-logs"
echo "  Stop services:   make dev-stop"
echo "  Clean all:       make dev-clean"
echo ""
echo "🎉 Happy coding!"