"""Portable regression of actual candidate metadata guards; no Docker evidence."""
import ast
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('adapter', HERE / 'internal_fixture.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class InternalFixtureTests(unittest.TestCase):
    def setUp(self):
        # Compile the actual pure metadata functions on Windows as well as Linux.
        source = ast.parse((HERE.parent / 'carservice-gate-c/gate-c.py').read_bytes())
        nodes = [n for n in source.body if isinstance(n, ast.FunctionDef)
                 and n.name in ('need', 'inspect', 'check_network')]
        scope = {'json': json}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<candidate metadata>', 'exec'), scope)
        scope.update(PROJECT='fixture', NETWORK='fixture-network', NETID='a'*64,
                     SUBNET='172.29.198.0/24', GATEWAY='172.29.198.1',
                     IDENTITIES={'frontend': ('b'*64, 'sha256:'+'c'*64)},
                     ADDRESSES={'frontend': '172.29.198.3'}, FRONTEND_PORT='5174')
        # Use a module-style object whose attributes and function globals coincide.
        class Subject:
            def __getattr__(self, key): return scope[key]
            def __setattr__(self, key, value): scope[key] = value
        self.c = Subject()
        self.internal = True
        self.network = ['a'*64, [{'Subnet': scope['SUBNET'], 'Gateway': scope['GATEWAY']}], {'b'*64: {}}]
        self.endpoint = {'NetworkID': 'a'*64, 'IPAddress': '172.29.198.3', 'Gateway': '',
                         'IPAMConfig': {'IPv4Address': '172.29.198.3'}}
        self.row = ['b'*64, 'sha256:'+'c'*64,
                    {'com.docker.compose.project': 'fixture', 'com.docker.compose.service': 'frontend'},
                    'running', True, 'healthy', [], {'fixture-network': self.endpoint},
                    {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '5174'}]},
                    False, {'Name': 'no'}, 'fixture-network', False, False, False, 'start', 'finish']
        def command(args):
            if args[0] == 'inspect': return json.dumps(self.row)
            return json.dumps(self.internal if args[3] == '{{json .Internal}}' else self.network)
        scope['command'] = command

    def test_original_reproduces_empty_gateway_refusal(self):
        with self.assertRaisesRegex(RuntimeError, 'network-address-changed'):
            self.c.inspect('frontend')

    def test_internal_fixture_passes_without_changing_ipam_gateway(self):
        adapter.bind_internal_inspect(self.c)
        self.assertTrue(self.c.inspect('frontend')['running'])
        self.assertEqual(self.c.GATEWAY, '172.29.198.1')
        self.c.check_network()

    def test_noninternal_network_refused(self):
        adapter.bind_internal_inspect(self.c)
        self.internal = False
        with self.assertRaisesRegex(RuntimeError, 'must-be-internal'): self.c.inspect('frontend')

    def test_bad_network_identity_ipam_and_peers_refused(self):
        adapter.bind_internal_inspect(self.c)
        for field, value in [(0, 'd'*64), (1, [{'Subnet': self.c.SUBNET, 'Gateway': ''}]), (2, {'intruder': {}})]:
            saved = self.network[field]; self.network[field] = value
            with self.assertRaises(RuntimeError): self.c.inspect('frontend')
            self.network[field] = saved

    def test_bad_endpoint_metadata_refused_and_gateway_restored(self):
        adapter.bind_internal_inspect(self.c)
        for key, value in [('Gateway', '172.29.198.1'), ('NetworkID', 'd'*64),
                           ('IPAddress', '172.29.198.99'), ('IPAMConfig', {})]:
            saved = self.endpoint[key]; self.endpoint[key] = value
            with self.assertRaises(RuntimeError): self.c.inspect('frontend')
            self.assertEqual(self.c.GATEWAY, '172.29.198.1')
            self.endpoint[key] = saved

    def test_wrong_image_and_public_port_still_refused(self):
        adapter.bind_internal_inspect(self.c)
        for index, value in [(1, 'sha256:'+'d'*64), (8, {'8080/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '5174'}]})]:
            saved = self.row[index]; self.row[index] = value
            with self.assertRaises(RuntimeError): self.c.inspect('frontend')
            self.row[index] = saved

    def backend(self):
        self.c.IDENTITIES = {'backend': self.c.IDENTITIES['frontend']}
        self.c.ADDRESSES = {'backend': self.c.ADDRESSES['frontend']}
        self.c.DATA, self.c.UPLOADS = Path('/fixture/data'), Path('/fixture/uploads')
        self.row[2]['com.docker.compose.service'] = 'backend'
        self.row[3:6] = ['exited', False, None]
        self.row[8] = {}
        self.row[6] = [dict(Type='bind', Source=str(source), Destination=dest,
                            RW=True, Mode='rw', Propagation='rprivate') for source, dest in
                       ((self.c.DATA, '/app/data'), (self.c.UPLOADS, '/app/uploads'))]
        adapter.bind_internal_inspect(self.c)

    def test_stopped_mount_reordering_reproduces_raw_failure_but_is_stable(self):
        self.backend()
        first = self.c.inspect('backend')
        self.row[6].reverse()
        # The previous candidate returned this raw list and failed first == second.
        self.assertNotEqual(first['mounts'], self.row[6])
        self.assertEqual(first, self.c.inspect('backend'))

    def test_mount_details_and_lifecycle_changes_remain_visible(self):
        self.backend()
        first = self.c.inspect('backend')
        self.row[6][0]['Propagation'] = 'rshared'
        self.assertNotEqual(first, self.c.inspect('backend'))
        self.row[6][0]['Propagation'] = 'rprivate'
        self.row[15] = 'different-start'
        self.assertNotEqual(first, self.c.inspect('backend'))

    def test_wrong_mounts_still_refused(self):
        self.backend()
        for key, value in [('Source', '/wrong'), ('Destination', '/wrong'),
                           ('RW', False), ('Type', 'volume')]:
            saved = self.row[6][0][key]; self.row[6][0][key] = value
            with self.assertRaisesRegex(RuntimeError, 'legacy-mounts-changed'):
                self.c.inspect('backend')
            self.row[6][0][key] = saved


if __name__ == '__main__': unittest.main()
