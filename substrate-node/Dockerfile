# Build stage - Use Rust version compatible with polkadot-v1.20.1
FROM rust:1.75 as builder

WORKDIR /shadowchain

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    clang \
    curl \
    git \
    libssl-dev \
    llvm \
    libudev-dev \
    make \
    pkg-config \
    protobuf-compiler \
    libclang-dev \
    librocksdb-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for protoc and optimization
ENV PROTOC=/usr/bin/protoc
ENV CARGO_INCREMENTAL=0
ENV RUSTFLAGS="-C link-arg=-s"

# Install wasm target and rust-src component (required for WASM runtime compilation)
RUN rustup target add wasm32-unknown-unknown && \
    rustup component add rust-src

# Copy workspace Cargo.toml first
COPY Cargo.toml ./

# Copy all source directories with proper structure
COPY node ./node
COPY pallets ./pallets
COPY runtime ./runtime

# Ensure runtime source structure is complete
RUN mkdir -p runtime/src && \
    ls -la runtime/src/

# Clean any existing build artifacts
RUN rm -rf Cargo.lock target

# Build the node in release mode
# Use lower parallelism to avoid memory issues in Docker
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/shadowchain/target \
    CARGO_BUILD_JOBS=2 \
    SKIP_WASM_BUILD=0 \
    cargo build --release --features runtime-benchmarks && \
    cp target/release/shadowchain-node /tmp/shadowchain-node

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from builder
COPY --from=builder /tmp/shadowchain-node /usr/local/bin/shadowchain-node

# Create user and data directory
RUN useradd -m -u 1000 -U -s /bin/sh shadowchain && \
    mkdir -p /data /chainspec && \
    chown -R shadowchain:shadowchain /data /chainspec

# Switch to non-root user
USER shadowchain

# Set working directory
WORKDIR /data

# Expose Substrate ports
# 9944 - WebSocket RPC
# 9933 - HTTP RPC  
# 9615 - Prometheus metrics
# 30333 - P2P
EXPOSE 9944 9933 9615 30333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD ["/usr/local/bin/shadowchain-node", "--version"]

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/shadowchain-node"]

# Default command for development mode
# --dev: Development mode with pre-configured Alice account
# --ws-external: Allow external WebSocket connections
# --rpc-external: Allow external RPC connections
# --rpc-cors=all: Allow all CORS origins (for development)
# --base-path=/data: Store chain data in /data
# --rpc-methods=unsafe: Allow all RPC methods (for development)
CMD ["--dev", \
     "--ws-external", \
     "--rpc-external", \
     "--rpc-cors=all", \
     "--base-path=/data", \
     "--rpc-methods=unsafe", \
     "--name=ShadowChain-Dev"]