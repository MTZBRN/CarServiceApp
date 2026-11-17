"""Adapt only the endpoint gateway expectation for an isolated fixture network."""
import json


def bind_internal_inspect(candidate):
    original = candidate.inspect

    def inspect(service):
        # Verify network identity/IPAM/peer set with the original gateway first.
        candidate.check_network()
        internal = json.loads(candidate.command([
            'network', 'inspect', '--format', '{{json .Internal}}', candidate.NETWORK]))
        if internal is not True:
            raise RuntimeError('fixture-network-must-be-internal')
        gateway = candidate.GATEWAY
        try:
            # Docker bridge Join deliberately skips SetGateway for Internal.
            # Require exactly empty endpoint gateway, not an arbitrary value.
            candidate.GATEWAY = ''
            return original(service)
        finally:
            candidate.GATEWAY = gateway

    candidate.inspect = inspect
