"""Focused fictional-filesystem and mocked-Docker tests; no daemon is contacted."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import stat
import tempfile
import unittest
from unittest.mock import Mock

HERE = Path(__file__).resolve().parent


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


def subject():
    m = module(HERE/'gate-d.py', 'gate_d_fixture_subject')
    m.C = m.load_c()
    return m


def model(m, layout='old'):
    data, uploads = (m.OLD_DATA,m.OLD_UPLOADS) if layout=='old' else (m.TARGET/'data',m.TARGET/'uploads')
    return {'name':m.C.PROJECT, 'networks':{'workshop':{'name':m.C.NETWORK,'external':True}},
      'services':{s:{'image':image,'networks':{'workshop':{'ipv4_address':m.C.ADDRESSES[s]}},
        **({'volumes':[{'type':'bind','source':str(src),'target':dest,'bind':{'create_host_path':False}}
          for src,dest in ((data,'/app/data'),(uploads,'/app/uploads'))]} if s=='backend' else
          {'ports':[{'target':8080,'published':'5174','host_ip':'127.0.0.1','protocol':'tcp'}]})}
          for s,(_,image) in m.C.IDENTITIES.items()}}


class ModelTests(unittest.TestCase):
    def setUp(self): self.m=subject()

    def test_exact_pair_valid(self): self.m.validate_models(model(self.m),model(self.m,'new'))

    def test_compose_2382_empty_ipam_normalization(self):
        old, new = model(self.m), model(self.m, 'new')
        for value in (old, new): value['networks']['workshop']['ipam'] = {}
        self.m.validate_models(old, new)

    def test_external_network_creation_settings_and_wrong_identity_refused(self):
        for key, value in [('external', False), ('external', 1), ('name', 'wrong-network'),
                           ('ipam', None), ('ipam', {'config': [{'subnet': '10.0.0.0/24'}]}),
                           ('driver', 'bridge'), ('internal', True), ('labels', {})]:
            candidate = model(self.m)
            candidate['networks']['workshop'][key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(RuntimeError, 'external-network-required'):
                self.m.validate_model(candidate, 'old')

    def test_wrong_image_refused(self):
        v=model(self.m);v['services']['backend']['image']='mutable:tag'
        with self.assertRaises(RuntimeError):self.m.validate_model(v,'old')

    def test_build_pull_directives_and_additional_mounts_refused(self):
        for key,value in [('build','.'),('env_file','private.env'),('network_mode','host'),('privileged',True),('profiles',['x'])]:
            v=model(self.m);v['services']['backend'][key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):self.m.validate_model(v,'old')
        v=model(self.m);v['services']['frontend']['volumes']=[{'source':'/etc'}]
        with self.assertRaises(RuntimeError):self.m.validate_model(v,'old')

    def test_wrong_network_public_port_and_path_refused(self):
        for mutate in (lambda v:v['networks']['workshop'].update(external=False),
                       lambda v:v['services']['frontend']['ports'][0].update(host_ip='0.0.0.0'),
                       lambda v:v['services']['backend']['volumes'][0].update(source='/opt/prod-data')):
            v=model(self.m);mutate(v)
            with self.assertRaises(RuntimeError):self.m.validate_model(v,'old')

    def test_changes_beyond_storage_refused(self):
        new=model(self.m,'new');new['services']['backend']['environment']={'INJECT':'x'}
        with self.assertRaises(RuntimeError):self.m.validate_models(model(self.m),new)

    def test_host_path_autocreation_refused(self):
        old=model(self.m);old['services']['backend']['volumes'][0]['bind']['create_host_path']=True
        with self.assertRaises(RuntimeError):self.m.validate_model(old,'old')


class MaterializationTests(unittest.TestCase):
    def setUp(self):
        self.m=subject()
        raw=(HERE/'ops_storage.fixture.py').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),self.m.C.HELPER_HASH)
        self.storage=module(HERE/'ops_storage.fixture.py','pinned_storage_fixture')
        self.temp=tempfile.TemporaryDirectory(prefix='gate-d-unit-');self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.source=self.root/'source';self.source.mkdir(mode=0o700)
        self.data=self.source/'data';self.data.mkdir();self.uploads=self.source/'uploads';self.uploads.mkdir()
        self.db=self.data/'app.db'
        c=sqlite3.connect(self.db)
        c.execute('PRAGMA foreign_keys=ON')
        c.execute('CREATE TABLE __EFMigrationsHistory (MigrationId TEXT PRIMARY KEY, ProductVersion TEXT)')
        c.execute("INSERT INTO __EFMigrationsHistory VALUES ('fictional_001','8.0.0')")
        c.execute('CREATE TABLE Users (Id INTEGER PRIMARY KEY)');c.execute('INSERT INTO Users VALUES (1)')
        c.commit();c.close()
        (self.uploads/'nested').mkdir();(self.uploads/'nested/fictional.txt').write_bytes(b'fictional payload')
        self.expected={'history':self.m.C.migration_history(self.db),'counts':self.storage.database_info(self.db),
                       'uploads':self.storage.inventory(self.uploads)}
        self.target=self.root/'target';self.target.mkdir(mode=0o700)
        # Adapt only ownership admission for unprivileged fictional directories.
        # Production OWNER and trusted checks remain unchanged in gate-d.py.
        self.m.OWNER=(os.getuid(),os.getgid());self.m.C.trusted=Mock()

    def materialize(self):
        self.m.materialize(self.source,self.target,self.expected,self.storage,'fixture-attempt')

    def test_full_real_backup_restore_materialize_and_verify(self):
        out=self.root/'backups'
        pair=self.storage.backup(self.db,self.uploads,out,quiesced=True)
        restored=self.root/'carserviceapp-restore-test-fixture'
        self.storage.restore_test(pair,restored,max_upload_bytes=1024)
        self.source=restored;self.materialize()
        self.m.verify_data(self.target/'data',self.target/'uploads',self.expected,self.storage,standalone=True)
        for p in (self.target/'data/app.db',self.target/'uploads/nested/fictional.txt'):
            self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
        self.assertEqual(stat.S_IMODE((self.target/'uploads/nested').stat().st_mode),0o700)

    def test_existing_destination_and_dangling_link_refused(self):
        (self.target/'data').symlink_to(self.root/'missing')
        with self.assertRaises(RuntimeError):self.materialize()
        self.assertTrue((self.target/'data').is_symlink())

    def test_partial_install_refused_and_preserved(self):
        (self.target/'data').mkdir();(self.target/'data/sentinel').write_bytes(b'keep')
        with self.assertRaises(RuntimeError):self.materialize()
        self.assertEqual((self.target/'data/sentinel').read_bytes(),b'keep')

    def test_symlink_upload_refused(self):
        (self.uploads/'linked').symlink_to(self.db)
        with self.assertRaises(RuntimeError):self.materialize()

    def test_hardlinked_upload_refused(self):
        os.link(self.uploads/'nested/fictional.txt',self.uploads/'alias')
        with self.assertRaises(RuntimeError):self.materialize()

    def test_nonregular_entry_refused(self):
        os.mkfifo(self.uploads/'pipe')
        with self.assertRaises(RuntimeError):self.materialize()

    def test_wrong_schema_counts_and_uploads_refused(self):
        for key,value in [('history',[['wrong','8']]),('counts',{'Users':99}),('uploads',[])]:
            expected=copy.deepcopy(self.expected);expected[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):
                self.m.verify_data(self.data,self.uploads,expected,self.storage,True)

    def test_standalone_sidecars_refused(self):
        (self.data/'app.db-wal').write_bytes(b'')
        with self.assertRaises(RuntimeError):self.materialize()

    def test_exclusive_rename_never_overwrites_empty_directory(self):
        src=self.root/'a';dest=self.root/'b';src.mkdir();dest.mkdir()
        with self.assertRaises(OSError):self.m.publish_exclusive(src,dest)
        self.assertTrue(src.exists());self.assertTrue(dest.exists())

    def test_failed_second_publication_preserves_partial_and_never_retries(self):
        actual=self.m.publish_exclusive
        calls=[]
        def publish(src,dst):
            calls.append(dst.name)
            if dst.name=='uploads':raise RuntimeError('fixture-publish-failure')
            actual(src,dst)
        self.m.publish_exclusive=publish
        with self.assertRaises(RuntimeError):self.materialize()
        self.assertEqual(calls,['data','uploads']);self.assertTrue((self.target/'data/app.db').exists())
        self.assertFalse((self.target/'uploads').exists())
        with self.assertRaises(RuntimeError):self.materialize()

    def test_sqlite_corruption_refused(self):
        self.db.write_bytes(b'not SQLite')
        with self.assertRaises(RuntimeError):self.materialize()

    def test_real_foreign_key_violation_refused(self):
        c=sqlite3.connect(self.db)
        c.execute('CREATE TABLE Parent (Id INTEGER PRIMARY KEY)')
        c.execute('CREATE TABLE Child (Pid INTEGER REFERENCES Parent(Id))')
        c.execute('INSERT INTO Child VALUES (99)');c.commit();c.close()
        with self.assertRaisesRegex(RuntimeError,'owner-reader-database-integrity-failed'):self.materialize()

    def test_owner_reader_includes_committed_wal(self):
        c=sqlite3.connect(self.db)
        self.addCleanup(c.close)
        c.execute('PRAGMA journal_mode=WAL')
        c.execute('INSERT INTO Users VALUES (2)');c.commit()
        actual=self.m.data_view(self.data,self.uploads,self.storage)
        self.assertEqual(actual['counts']['Users'],2)
        self.assertEqual(actual['history'],self.expected['history'])

    def test_same_counts_business_row_mutation_is_detected(self):
        expected=dict(self.expected,logical_sha256=self.m.data_view(self.data,self.uploads,self.storage)['logical_sha256'])
        c=sqlite3.connect(self.db);c.execute('UPDATE Users SET Id=99');c.commit();c.close()
        with self.assertRaisesRegex(RuntimeError,'logical-database-content-mismatch'):
            self.m.verify_data(self.data,self.uploads,expected,self.storage)

    def test_materialize_detects_copy_corruption_with_same_counts(self):
        original=self.m.copy_tree
        def broken(source,dest):
            original(source,dest)
            if dest.name=='data':
                c=sqlite3.connect(dest/'app.db');c.execute('UPDATE Users SET Id=999');c.commit();c.close()
        self.m.copy_tree=broken
        with self.assertRaises(RuntimeError):self.materialize()
        self.assertFalse((self.target/'data').exists())


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.m=subject();self.events=[];self.commands=[]
        self.ids={s:v[0] for s,v in self.m.C.IDENTITIES.items()}
        self.m.root_checks=Mock();self.m.C.check_window=Mock();self.m.reference=Mock()
        self.m.C.trusted=Mock()
        self.m.log=lambda directory,name,value:self.events.append((name,value))
        self.running=dict(backend=False,frontend=False)
        def pair(ids,layout,healthy=False,stopped=False):
            if stopped and any(self.running.values()):raise RuntimeError('not-stopped')
            return {s:{'running':self.running[s],'health':'healthy','id':ids[s]} for s in ids}
        self.m.pair=pair
        def command(args,**kw):
            self.commands.append(args)
            if args[0]=='ps':
                service=args[-1].split('=')[-1]
                return ('a' if service=='backend' else 'b')*64
            if args[0]=='stop':
                s=next(s for s in self.ids if self.ids[s]==args[-1]);self.running[s]=False
            return ''
        self.m.command=command
        def compose(a,key,tail):
            self.commands.append(tail);self.running[tail[-1]]=True
            return ''
        self.m.compose=compose

    def test_exact_image_startup_has_no_build_pull_or_dependencies(self):
        self.m.startup({},'new_model',self.ids,Path('/fictional'),'new','old')
        up=[a for a in self.commands if a[0]=='up']
        self.assertEqual([a[-1] for a in up],['backend','frontend'])
        self.assertTrue(all('--no-build' in a and '--no-deps' in a and a[a.index('--pull')+1]=='never' for a in up))
        self.assertEqual([e[0] for e in self.events],['up-intent-backend','up-confirmed-backend','up-intent-frontend','up-confirmed-frontend'])

    def test_startup_failure_never_starts_frontend_or_rolls_back(self):
        self.m.compose=Mock(side_effect=RuntimeError('fixture-failed'))
        with self.assertRaises(RuntimeError):self.m.startup({},'new_model',self.ids,Path('/fixture'),'new','old')
        self.assertEqual(self.m.compose.call_count,1)
        self.assertEqual([e[0] for e in self.events],['up-intent-backend'])

    def test_recovery_first_checks_current_new_layout_then_old(self):
        actual=self.m.pair; layouts=[]
        self.m.pair=lambda ids,layout,**kw:(layouts.append(layout) or actual(ids,layout,**kw))
        self.m.startup({},'old_model',self.ids,Path('/fixture'),'old','new')
        self.assertEqual(layouts[0],'new');self.assertIn('old',layouts[1:])

    def test_stop_is_exact_frontend_first_and_never_down(self):
        self.running=dict(backend=True,frontend=True)
        self.m.stop_pair(self.ids,'new',{},Path('/fixture'))
        self.assertEqual([a[-1] for a in self.commands],[self.ids['frontend'],self.ids['backend']])
        self.assertTrue(all(a[:3]==['stop','--time','60'] for a in self.commands))

    def test_stop_timeout_records_intent_and_never_starts_anything(self):
        self.running=dict(backend=True,frontend=True)
        self.m.command=Mock(side_effect=TimeoutError())
        with self.assertRaises(TimeoutError):self.m.stop_pair(self.ids,'new',{},Path('/fixture'))
        self.assertEqual([e[0] for e in self.events],['stop-intent-frontend'])

    def test_expired_authorization_prevents_compose(self):
        self.m.C.check_window=Mock(side_effect=RuntimeError('expired'))
        with self.assertRaises(RuntimeError):self.m.startup({},'new_model',self.ids,Path('/fixture'),'new','old')
        self.assertEqual(self.commands,[])

    def test_new_authority_blocks_old_recovery(self):
        with tempfile.TemporaryDirectory() as t:
            self.m.STATE=Path(t)
            self.m.old_authority_admission()
            for name in ('accepted-authority.json','new-authority-boundary.json','old-authority.json'):
                p=Path(t)/name;p.write_text('{}')
                with self.subTest(name=name),self.assertRaises(RuntimeError):self.m.old_authority_admission()
                p.unlink()

    def test_approval_must_match_requested_operation(self):
        self.m.C.authenticated_json=Mock(return_value={'operation':'accept','approved':True})
        with self.assertRaisesRegex(RuntimeError,'operation-not-approved'):
            self.m.authorize(Path('/fixture'),'0'*64,'cutover')

    def test_false_approval_cannot_execute(self):
        self.m.C.authenticated_json=Mock(return_value={'operation':'cutover','approved':False})
        with self.assertRaisesRegex(RuntimeError,'operation-not-approved'):
            self.m.authorize(Path('/fixture'),'0'*64,'cutover')

    def test_valid_cutover_authorization_and_implementation_binding(self):
        a=json.loads((HERE/'cutover.template.json').read_text())
        a.update(approved=True,approval_id='fixture-approval',approval_reference='fixture',decision_maker='fixture',
          window_start_utc=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(minutes=1)).isoformat(),
          window_end_utc=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=1)).isoformat(),
          gate_c_approval_sha256='a'*64,max_upload_bytes=1024,
          new_model='/etc/carservice-test-deploy/baseline/compose.json',
          runtime_environment='/etc/carservice-test-deploy/environment')
        for key in ('ingress_closed','custody_continuous','github_gate_disabled','no_other_automation'):a[key]=True
        self.m.C.authenticated_json=Mock(return_value=a)
        record={'approval_sha256':'a'*64,'script_sha256':self.m.C_HASH}
        self.m.C.record_json=Mock(return_value=record)
        refs={'old_model':json.dumps(model(self.m)).encode(),'new_model':json.dumps(model(self.m,'new')).encode(),
              'runtime_environment':b'fictional','expected_history':b'[["fixture","8.0.0"]]'}
        self.m.reference=lambda a,key:refs[key]
        self.assertEqual(self.m.authorize(Path('/fixture'),'0'*64,'cutover'),a)
        record['script_sha256']='0'*64
        with self.assertRaisesRegex(RuntimeError,'unreviewed-gate-c-implementation'):
            self.m.authorize(Path('/fixture'),'0'*64,'cutover')

    def test_resume_backend_first_then_frontend(self):
        original=self.m.command
        def command(args,**kw):
            if args[0]=='start':
                self.running[next(s for s in self.ids if self.ids[s]==args[-1])]=True
                self.commands.append(args);return ''
            return original(args,**kw)
        self.m.command=command
        self.m.resume_pair(self.ids,'new',{},Path('/fixture'))
        self.assertEqual([c[-1] for c in self.commands],[self.ids['backend'],self.ids['frontend']])

    def test_resume_timeout_never_starts_frontend(self):
        self.m.command=Mock(side_effect=TimeoutError())
        with self.assertRaises(TimeoutError):self.m.resume_pair(self.ids,'new',{},Path('/fixture'))
        self.assertEqual(self.m.command.call_count,1)
        self.assertEqual(self.events[0][0],'resume-intent-backend')

    def test_resume_expired_authorization_starts_nothing(self):
        self.m.C.check_window=Mock(side_effect=RuntimeError('expired'))
        with self.assertRaises(RuntimeError):self.m.resume_pair(self.ids,'new',{},Path('/fixture'))
        self.assertEqual(self.commands,[])


if __name__=='__main__':unittest.main()
