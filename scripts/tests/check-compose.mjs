// Static preparation checks, not a substitute for docker compose config/runtime execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'Frontend/package.json'));
const yaml=require('js-yaml'); // Already present in the locked frontend development graph; no new dependency.
const config=yaml.load(fs.readFileSync(path.join(root,'docker-compose.yml'),'utf8'));
assert.deepEqual(Object.keys(config.services).sort(),['backend','frontend']);
const {backend,frontend}=config.services;
assert.equal(backend.ports,undefined);
assert.deepEqual(frontend.ports,['127.0.0.1:${FRONTEND_BIND_PORT:-5173}:8080']);
assert(backend.environment.includes('ReverseProxy__KnownProxies__0='+frontend.networks.workshop.ipv4_address));
const ingress=yaml.load(fs.readFileSync(path.join(root,'docker-compose.ingress.yml'),'utf8'));
assert.deepEqual(ingress,{services:{frontend:{volumes:[{
 type:'bind',source:'/etc/carserviceapp/trusted-edge.conf',target:'/etc/nginx/trusted-edge.conf',
 read_only:true,bind:{create_host_path:false},
}]}}});
const nginx=fs.readFileSync(path.join(root,'Frontend/nginx.conf'),'utf8');
assert(nginx.includes('map "$remote_addr:$http_x_carservice_edge_token" $verified_edge'));
assert.equal(nginx.match(/include \/etc\/nginx\/proxy-headers\.conf;/g)?.length,3);
assert(!nginx.includes('$proxy_add_x_forwarded_for'));
const proxy=fs.readFileSync(path.join(root,'Frontend/proxy-headers.conf'),'utf8');
for(const name of ['Token','Scheme','Client']) assert(proxy.includes('proxy_set_header X-CarService-Edge-'+name+' "";'));
for(const service of [backend,frontend]){
 assert.equal(service.restart,'unless-stopped');
 assert.equal(service.read_only,true);
 assert.deepEqual(service.cap_drop,['ALL']);
 assert(service.security_opt.includes('no-new-privileges:true'));
 assert(service.tmpfs.some(value=>value.includes('/tmp:rw,noexec,nosuid,nodev,size=')));
 assert(service.mem_limit&&service.cpus>0&&service.pids_limit>0);
}
assert.equal(backend.volumes[0].source,'${DATA_PATH:-./backend-data}');
assert.equal(backend.volumes[1].source,'${UPLOADS_PATH:-./user-uploads}');
assert.deepEqual(backend.volumes.map(v=>[v.target,v.type,v.bind.create_host_path]),[['/app/data','bind',false],['/app/uploads','bind',false]]);
assert.equal(backend.image,'carserviceapp-backend:${APP_IMAGE_TAG:-local}');
assert.equal(frontend.image,'carserviceapp-frontend:${APP_IMAGE_TAG:-local}');
assert(backend.environment.includes('ASPNETCORE_ENVIRONMENT=Production'));
assert(backend.environment.includes('ConnectionStrings__DefaultConnection=Data Source=/app/data/app.db'));
assert(!backend.environment.some(value=>value.startsWith('InitialAdmin__')));
const example=fs.readFileSync(path.join(root,'.env.production.example'),'utf8');
assert(example.includes('JWT_KEY=__GENERATE_64_RANDOM_BYTES_BASE64_ON_SERVER__'));
assert(example.includes('JWT_ISSUER=urn:example:'));
assert(example.includes('JWT_AUDIENCE=urn:example:'));
for(const file of ['scripts/backup.sh','scripts/restore-test.sh','scripts/stage4a-validate.sh']){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 assert(!source.includes('\r'));
 assert(source.includes('set -euo pipefail')&&source.includes('umask 077'));
}
console.log('PASS: static YAML/topology, hardening, placeholders and script line endings. Docker runtime remains unverified.');
