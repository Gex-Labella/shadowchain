# Build stage - Use Rust version compatible with polkadot-v1.20.1
FROM docker.io/paritytech/ci-unified:latest as builder

WORKDIR /shadowchain

# Copy workspace Cargo.toml first
COPY Cargo.toml ./

# Copy all source directories with proper structure
COPY node ./node
COPY pallets ./pallets
COPY runtime ./runtime

# Build the node in release mode with production profile
RUN cargo fetch && \
    cargo build --workspace --locked --profile production && \
    cp target/production/shadowchain-node /tmp/shadowchain-node

# Runtime stage
FROM docker.io/parity/base-bin:latest

# Copy the built binary from builder
COPY --from=builder /tmp/shadowchain-node /usr/local/bin/shadowchain-node

# Create user and data directory
USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /shadowchain shadowchain && \
    mkdir -p /data /shadowchain/.local/share && \
    chown -R shadowchain:shadowchain /data && \
    ln -s /data /shadowchain/.local/share/shadowchain && \
    # unclutter and minimize the attack surface
    rm -rf /usr/bin /usr/sbin && \
    # check if executable works in this container
    /usr/local/bin/shadowchain-node --version

# Switch to non-root user
USER shadowchain

# Expose Substrate/Parachain ports
# 30333 - P2P
# 9933 - HTTP RPC
# 9944 - WebSocket RPC
# 9615 - Prometheus metrics
EXPOSE 30333 9933 9944 9615

# Volume for chain data
VOLUME ["/data"]

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/shadowchain-node"]