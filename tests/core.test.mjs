import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { period,energySQL } from '../lib/analytics.mjs';
const sandbox={};vm.runInNewContext(readFileSync('assets/core.js','utf8'),sandbox);const { kwh,csv,simulate }=sandbox.BioVolt;
test('energía normaliza kWh y MWh y excluye unidades desconocidas',()=>{
  assert.equal(kwh({cantidad:2,unidad:' MWh '}),2000); assert.equal(kwh({cantidad:3,unidad:'kWh'}),3);
  assert.equal(kwh({cantidad:3,unidad:'MW'}),null);assert.equal(kwh({cantidad:'NaN',unidad:'kWh'}),null);
  assert.match(energySQL('e'),/cantidad \* 1000/);
});
test('simulador usa unidades y porcentaje, valida límites',()=>{
  const result=simulate({mass:1000,yieldKwh:4,efficiency:25,price:500});assert.equal(result.kwh,1000);assert.equal(result.revenue,500000);
  assert.throws(()=>simulate({mass:-1,yieldKwh:4,efficiency:25,price:500}));
  assert.throws(()=>simulate({mass:1,yieldKwh:4,efficiency:101,price:500}));
});
test('CSV usa BOM, comillas, separador Excel y neutraliza fórmulas',()=>{
  const output=csv([['a;b','"x"','=HYPERLINK("x")','\n@cmd']]);
  assert.equal(output.charCodeAt(0),0xfeff);assert.match(output,/"a;b";"""x"""/);assert.match(output,/"'=HYPERLINK/);assert.match(output,/'\n@cmd/);
});
test('periodos comparan igual número de días y rechazan fechas imposibles',()=>{
  const range=period(new URL('http://local?from=2024-03-01&to=2024-03-02'));
  assert.equal(range.previousFrom,'2024-02-28');assert.equal(range.previousTo,'2024-02-29');
  assert.throws(()=>period(new URL('http://local?from=2024-02-30&to=2024-03-01')));
  assert.throws(()=>period(new URL('http://local?from=2024-01-02&to=2024-01-01')));
});
