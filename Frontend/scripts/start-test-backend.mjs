import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend=path.resolve(frontend, '../Backend/CarServiceShop/CarServiceShop');
const runs=path.join(frontend, '.playwright-data');
mkdirSync(runs,{recursive:true});
const data=mkdtempSync(path.join(runs,'run-'));
const webroot=path.join(data,'wwwroot');
// Each invocation gets a fresh database, uploads directory and current SPA build.
cpSync(path.join(frontend,'dist'),webroot,{recursive:true});
console.log('Disposable validation data: '+path.relative(frontend,data));
let child=spawn('dotnet',['build',path.join(backend,'CarServiceShop.csproj'),'--nologo'],{stdio:'inherit'});
child.on('exit',code=>{
  if(code!==0)process.exit(code??1);
  child=spawn('dotnet',[path.join(backend,'bin/Debug/net9.0/CarServiceShop.dll'),'--contentRoot',backend,'--webroot',webroot],{
    cwd:data,stdio:'inherit',env:{...process.env,
      ASPNETCORE_ENVIRONMENT:'Development',ASPNETCORE_URLS:'http://localhost:5232',
      ConnectionStrings__DefaultConnection:'Data Source='+path.join(data,'regression.db'),
      Logging__LogLevel__Default:'Warning',
    },
  });
  child.on('exit',exitCode=>process.exit(exitCode??1));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
