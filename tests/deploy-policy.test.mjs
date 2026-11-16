import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('Netlify omite ramas dev y Deploy Previews incluso con referencias pull/1/head',()=>{
  for(const environment of [{BRANCH:'dev/mesa-ayuda-agente',CONTEXT:'branch-deploy'},{BRANCH:'pull/1/head',CONTEXT:'deploy-preview'},{BRANCH:'main',CONTEXT:'deploy-preview'},{BRANCH:'',CONTEXT:''}])assert.equal(spawnSync(process.execPath,['scripts/ignore-build.mjs'],{env:{...process.env,...environment}}).status,0);
  assert.equal(spawnSync(process.execPath,['scripts/ignore-build.mjs'],{env:{...process.env,BRANCH:'main',CONTEXT:'production'}}).status,1);
});
test('un build hook que omite ignore sigue bloqueado fuera de main/production',()=>{
  const result=spawnSync(process.execPath,['scripts/build.mjs'],{env:{...process.env,NETLIFY:'true',BRANCH:'pull/1/head',CONTEXT:'deploy-preview'},encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/despliegue deshabilitado/);
});
