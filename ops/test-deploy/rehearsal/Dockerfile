FROM docker:27.5.1-cli AS cli
FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    python3 git gh docker.io sudo openssh-client tar iptables ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/libexec/docker/cli-plugins/docker-compose
COPY review /review
COPY base.tar /base.tar
RUN chmod 0755 /review/ops/test-deploy/rehearsal/entry.sh
ENTRYPOINT ["/review/ops/test-deploy/rehearsal/entry.sh"]
