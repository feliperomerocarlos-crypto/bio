export const energySQL = alias => `CASE LOWER(TRIM(${alias}.unidad)) WHEN 'kwh' THEN ${alias}.cantidad WHEN 'mwh' THEN ${alias}.cantidad * 1000 ELSE NULL END`;
export function period(url) {
  const end = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(end)) throw new Error('Fecha inválida.');
  const start = url.searchParams.get('from') || new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
  if (!valid(start)) throw new Error('Fecha inválida.');
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (days < 1 || days > 366) throw new Error('El intervalo debe tener entre 1 y 366 días.');
  const before = new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10);
  const previous = new Date(Date.parse(start) - days * 86400000).toISOString().slice(0, 10);
  return { from: start, to: end, previousFrom: previous, previousTo: before, days };
}
