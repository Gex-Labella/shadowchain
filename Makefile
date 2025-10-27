# Shadow Chain Makefile

.PHONY: help
help: ## Show this help message
	@echo "Shadow Chain - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# Development Commands
.PHONY: install-deps
install-deps: ## Install all dependencies
	@echo "Installing Rust..."
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
	@echo "Installing Node.js dependencies..."
	cd shared-crypto && npm install
	cd backend && npm install
	cd frontend && npm install
	@echo "Installing Substrate dependencies..."
	rustup target add wasm32-unknown-unknown
	rustup component add rust-src

.PHONY: build
build: ## Build all components
	@echo "Building shared-crypto..."
	cd shared-crypto && npm run build
	@echo "Building backend..."
	cd backend && npm run build
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building Substrate node..."
	cd substrate-node && cargo build --release

.PHONY: dev
dev: ## Start local development environment
	sudo docker compose up -d
	@echo "Shadow Chain is running!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:3001"
	@echo "Substrate Node WS: ws://localhost:9944"
	@echo "IPFS Gateway: http://localhost:8080"

.PHONY: dev-logs
dev-logs: ## Show logs from all services
	sudo docker compose logs -f

.PHONY: dev-stop
dev-stop: ## Stop local development environment
	sudo docker compose down

.PHONY: dev-clean
dev-clean: ## Stop and remove all containers, volumes
	sudo docker compose down -v

.PHONY: dev-rebuild
dev-rebuild: ## Rebuild and restart services
	sudo docker compose down
	sudo docker compose build --no-cache
	sudo docker compose up -d

# Testing Commands
.PHONY: test
test: ## Run all tests
	@echo "Testing shared-crypto..."
	cd shared-crypto && npm test
	@echo "Testing backend..."
	cd backend && npm test
	@echo "Testing frontend..."
	cd frontend && npm test
	@echo "Testing Substrate pallets..."
	cd substrate-node && cargo test

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	./scripts/run_e2e_local.sh

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	cd shared-crypto && npm run test:coverage
	cd backend && npm run test:coverage
	cd frontend && npm run test:coverage

# Production Commands
.PHONY: build-prod
build-prod: ## Build production sudo docker images
	sudo docker build -f substrate-node/sudo dockerfile -t shadowchain-node:latest ./substrate-node
	sudo docker build -f backend/sudo dockerfile -t shadowchain-backend:latest .
	sudo docker build -f frontend/sudo dockerfile -t shadowchain-frontend:latest .

.PHONY: deploy-aws
deploy-aws: ## Deploy to AWS
	./scripts/deploy_aws.sh

# Database Commands (optional profiles)
.PHONY: dev-with-db
dev-with-db: ## Start development with PostgreSQL
	sudo docker compose --profile with-db up -d

.PHONY: dev-with-cache
dev-with-cache: ## Start development with Redis cache
	sudo docker compose --profile with-cache up -d

.PHONY: dev-full
dev-full: ## Start development with all optional services
	sudo docker compose --profile with-db --profile with-cache up -d

# Sync Commands
.PHONY: sync-demo
sync-demo: ## Run manual sync demo
	curl -X POST http://localhost:3001/api/shadow/sync \
		-H "Content-Type: application/json" \
		-d '{"address": "YOUR_WALLET_ADDRESS"}'

# Chain Commands
.PHONY: chain-purge
chain-purge: ## Purge chain data
	sudo docker compose exec substrate-node shadowchain-node purge-chain --dev -y

.PHONY: chain-info
chain-info: ## Show chain information
	@echo "Fetching chain info..."
	@curl -s -H "Content-Type: application/json" \
		-d '{"id":1, "jsonrpc":"2.0", "method": "system_chain"}' \
		http://localhost:9933 | jq '.result'

# IPFS Commands
.PHONY: ipfs-peers
ipfs-peers: ## Show IPFS peers
	sudo docker compose exec ipfs ipfs swarm peers

.PHONY: ipfs-stats
ipfs-stats: ## Show IPFS statistics
	sudo docker compose exec ipfs ipfs stats repo

# Utility Commands
.PHONY: lint
lint: ## Run linters
	cd backend && npm run lint
	cd frontend && npm run lint

.PHONY: format
format: ## Format code
	cd substrate-node && cargo fmt
	cd backend && npx prettier --write "src/**/*.ts"
	cd frontend && npx prettier --write "src/**/*.{ts,tsx}"

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf shared-crypto/dist
	rm -rf backend/dist
	rm -rf frontend/build
	cd substrate-node && cargo clean