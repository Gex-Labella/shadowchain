# Substrate Node Dockerfile for Shadow Chain

# Build stage
FROM rust:latest as builder

# Install required packages
RUN apt-get update && \
    apt-get install -y \
    clang \
    libclang-dev \
    cmake \
    protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /shadowchain

# Copy source code
COPY . .

# Build the node in release mode
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install required runtime dependencies
RUN apt-get update && \
    apt-get install -y \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /shadowchain/target/release/shadowchain-node /usr/local/bin/shadowchain-node

# Create a non-root user
RUN useradd -m -u 1000 -U -s /bin/sh shadowchain

# Create data directory
RUN mkdir -p /data && chown shadowchain:shadowchain /data

USER shadowchain

# Expose ports
EXPOSE 9944 9933 30333 9615

# Volume for chain data
VOLUME ["/data"]

# Start the node
ENTRYPOINT ["shadowchain-node"]