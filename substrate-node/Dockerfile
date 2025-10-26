# Build stage
FROM rust:1.88.0 as builder

WORKDIR /shadowchain

# Install build dependencies
RUN apt-get update && apt-get install -y \
    clang \
    libclang-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml ./
COPY node ./node
COPY pallets ./pallets
COPY runtime ./runtime

# Install wasm target and rust-src component (required for WASM runtime compilation)
RUN rustup target add wasm32-unknown-unknown && \
    rustup component add rust-src

# Build the node in release mode
RUN cargo build --release

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary
COPY --from=builder /shadowchain/target/release/shadowchain-node /usr/local/bin/shadowchain-node

# Create user
RUN useradd -m -u 1000 -U -s /bin/sh shadowchain

# Create data directory
RUN mkdir -p /data && chown shadowchain:shadowchain /data

USER shadowchain

# Expose ports
EXPOSE 9944 9933 9615 30333

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/shadowchain-node"]

# Default command
CMD ["--dev", "--ws-external", "--rpc-external", "--rpc-cors=all", "--base-path=/data"]