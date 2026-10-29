import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend=path.resolve(frontend, '../Backend/CarServiceShop/CarServiceShop');
const production=process.argv.includes('--production');
const environment=production?'Production':'Development';
const port=production?15232:5232;
const signingKey=process.env.CAR_TEST_JWT_KEY || randomBytes(48).toString('base64');
const testEnv={...process.env,Jwt__Key:signingKey,Jwt__Issuer:production?'urn:carserviceapp:browser-production':'urn:carserviceapp:development',Jwt__Audience:production?'urn:carserviceapp:browser-production-client':'urn:carserviceapp:development-client',InitialAdmin__Email:'admin@test.com',InitialAdmin__Password:'Admin-test-only-123'};
const runs=path.join(frontend, '.playwright-data');
mkdirSync(runs,{recursive:true});
const data=mkdtempSync(path.join(runs,'run-'));
const webroot=path.join(data,'wwwroot');
// Each invocation gets a fresh database, uploads directory and current SPA build.
cpSync(path.join(frontend,'dist'),webroot,{recursive:true});
console.log('Disposable validation data: '+path.relative(frontend,data));
let child=spawn('dotnet',production?['--version']:['build',path.join(backend,'CarServiceShop.csproj'),'--nologo'],{stdio:'inherit'});
child.on('exit',async code=>{
  if(code!==0)process.exit(code??1);
  const dll=path.join(backend,'bin/Debug/net10.0/CarServiceShop.dll');
  const isolated={...testEnv,ASPNETCORE_ENVIRONMENT:environment,ConnectionStrings__DefaultConnection:'Data Source='+path.join(data,'regression.db'),Uploads__Path:path.join(data,'uploads')};
  const provision=spawn('dotnet',[dll,'--contentRoot',backend,'--provision-admin'],{cwd:data,stdio:'inherit',env:isolated});
  const provisionCode=await new Promise(resolve=>provision.on('exit',resolve));
  if(provisionCode!==0)process.exit(provisionCode??1);
  child=spawn('dotnet',[dll,'--contentRoot',backend,'--webroot',webroot],{
    cwd:data,stdio:'inherit',env:{...isolated,
      Login__SourcePermitLimit:'1000',ASPNETCORE_ENVIRONMENT:environment,ASPNETCORE_URLS:'http://localhost:'+port,
      ConnectionStrings__DefaultConnection:'Data Source='+path.join(data,'regression.db'),
      Logging__LogLevel__Default:'Warning',
    },
  });
  child.on('exit',exitCode=>process.exit(exitCode??1));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
