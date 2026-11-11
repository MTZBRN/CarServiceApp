#!/bin/sh
set -eu
# No bind mounts or host socket are supplied by the workflow. Refuse an uplink.
[ "$(ls /sys/class/net)" = lo ]
[ ! -e /var/run/docker.sock ]
[ ! -e /opt/carserviceapp ]
[ ! -e /etc/carservice-test-deploy ]
[ ! -e /var/lib/carservice-test-deploy ]
umask 077
mkdir /evidence
printf '%s\n' phase6e-disposable > /run/phase6e-container
dockerd --storage-driver=vfs --bridge=none --iptables=false \
    --host=unix:///var/run/docker.sock --data-root=/var/lib/phase6e-docker \
    > /evidence/daemon.log 2>&1 &
attempt=0
until docker info >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 60 ] || exit 1
    sleep 1
done
docker load -i /base.tar >/dev/null
touch /run/phase6e-ready
exec sleep infinity
