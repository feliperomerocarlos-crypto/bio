import test from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, tokenId, isAdmin, canAccess, ticketId } from '../lib/access.mjs';
process.env.TICKET_TOKEN_SECRET='test-only-private-token-secret-32bytes-minimum';
process.env.AYUDA_PIN='test-docente-only';
const req=token=>new Request('http://local',{headers:{authorization:'Bearer '+token}});
test('código firmado solo da acceso al ticket emitido y caduca',()=>{
  const token=issueToken(42,1000);
  assert.equal(tokenId(req(token),1001),42);
  assert.equal(tokenId(req(token),1000+30*86400000),0);
  assert.equal(tokenId(req(token+'x'),1001),0);
  assert.equal(canAccess(req(issueToken(42)),43),false);
});
test('PIN compartido solo autoriza coincidencia exacta',()=>{
  assert.equal(isAdmin(new Request('http://local',{headers:{'x-admin-pin':'incorrecto'}})),false);
  assert.equal(isAdmin(new Request('http://local',{headers:{'x-admin-pin':process.env.AYUDA_PIN}})),true);
});
test('IDs ambiguos se rechazan',()=>{
  for(const id of ['1x2','-1','0','12.1','9007199254740999','BV-1;DROP'])assert.equal(ticketId(id),0);
  assert.equal(ticketId('BV-12'),12);
});
test('rotar el secreto invalida códigos anteriores; el PIN no sirve de secreto de firma',()=>{
  const secret=process.env.TICKET_TOKEN_SECRET,token=issueToken(7);
  process.env.TICKET_TOKEN_SECRET='a-different-long-signing-secret-for-tests';assert.equal(tokenId(req(token)),0);
  delete process.env.TICKET_TOKEN_SECRET;assert.equal(tokenId(req(token)),0);assert.throws(()=>issueToken(7));process.env.TICKET_TOKEN_SECRET=secret;
});
