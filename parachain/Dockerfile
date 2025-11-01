FROM docker.io/paritytech/ci-unified:latest as builder

WORKDIR /shadowchain
COPY . /shadowchain

RUN cargo fetch
RUN cargo build --workspace --locked --profile production

FROM docker.io/parity/base-bin:latest

COPY --from=builder /shadowchain/target/production/shadow-chain-node /usr/local/bin

USER root
RUN useradd -m -u 1001 -U -s /bin/sh -d /shadowchain shadowchain && \
	mkdir -p /data /shadowchain/.local/share && \
	chown -R shadowchain:shadowchain /data && \
	ln -s /data /shadowchain/.local/share/shadowchain && \
# unclutter and minimize the attack surface
	rm -rf /usr/bin /usr/sbin && \
# check if executable works in this container
	/usr/local/bin/shadow-chain-node --version

USER shadowchain

EXPOSE 30333 9933 9944 9615
VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/shadow-chain-node"]
