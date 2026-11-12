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
python3 /review/ops/test-deploy/rehearsal/cgroup_setup.py
dockerd --storage-driver=vfs --bridge=none --iptables=false \
    --exec-opt native.cgroupdriver=cgroupfs \
    --host=unix:///var/run/docker.sock --data-root=/var/lib/phase6e-docker \
    > /evidence/daemon.log 2>&1 &
attempt=0
until docker info >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 60 ] || exit 1
    sleep 1
done
docker load -i /base.tar >/dev/null
# Read the effective kernel limits; daemon readiness alone does not prove nesting.
docker run --rm --network none --cgroupns private --memory=64m --cpus=0.5 --pids-limit=32 \
    --entrypoint python python:3.12-slim-bookworm -c '
from pathlib import Path
r = Path("/sys/fs/cgroup")
assert (r / "memory.max").read_text().strip() == "67108864"
assert (r / "pids.max").read_text().strip() == "32"
quota, period = map(int, (r / "cpu.max").read_text().split())
assert quota * 2 == period
print("Nested cgroup v2 CPU/memory/PIDs enforcement verified")
'
touch /run/phase6e-ready
exec sleep infinity
