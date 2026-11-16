import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ticketId = value => {
  const m = /^(?:BV-)?([1-9]\d{0,14})$/.exec(String(value ?? ''));
  const n = m ? Number(m[1]) : 0;
  return Number.isSafeInteger(n) ? n : 0;
};
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export const isAdmin = request => !!process.env.AYUDA_PIN && same(request.headers.get('x-admin-pin'), process.env.AYUDA_PIN);
// El secreto nunca sale del backend. Rotarlo invalida los códigos emitidos.
const secret = () => typeof process.env.TICKET_TOKEN_SECRET === 'string' && process.env.TICKET_TOKEN_SECRET.length >= 32 ? process.env.TICKET_TOKEN_SECRET : null;
export const canIssueToken = () => !!secret();
const signature = payload => createHmac('sha256', secret()).update('biovolt-ticket-v1:' + payload).digest('base64url');
export function issueToken(id, now = Date.now()) {
  if (!ticketId(id)) throw new Error("Invalid ticket ID");
  if (!secret()) throw new Error('Ticket access is not configured');
  const payload = Buffer.from(JSON.stringify({ id, exp: now + 30 * 86400000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return payload + '.' + signature(payload);
}
export function tokenId(request, now = Date.now()) {
  if (!secret()) return 0;
  const raw = request.headers.get('authorization') || '';
  if (!raw.startsWith('Bearer ') || raw.length > 1024) return 0;
  const [payload, sig, extra] = raw.slice(7).split('.');
  if (!payload || !sig || extra || !same(sig, signature(payload))) return 0;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isFinite(data.exp) && data.exp > now ? ticketId(data.id) : 0;
  } catch { return 0; }
}
export const canAccess = (request, id) => isAdmin(request) || tokenId(request) === id;
// Protección por instancia; un límite distribuido debe configurarse en el proveedor.
const buckets = new Map();
export function throttled(request, context, scope, limit = 20) {
  const ip = context?.ip || request.headers.get('x-nf-client-connection-ip') || 'anon';
  const key = scope + ':' + ip, now = Date.now();
  const stamps = (buckets.get(key) || []).filter(t => now - t < 60000);
  stamps.push(now); buckets.set(key, stamps);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.at(-1) < now - 60000) buckets.delete(k);
    if (buckets.size > 5000) buckets.delete(buckets.keys().next().value);
  }
  return stamps.length > limit;
}
