// Simulador mínimo de Supabase (Auth + PostgREST + Functions) para probar la interfaz en local
const B64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'admin@ao-gestiones.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const TOKEN = `${B64({ alg: 'HS256', typ: 'JWT' })}.${B64({ sub: USER.id, email: USER.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`;

exports.PASSWORD = 'ClaveSegura123';
exports.createMock = () => {
  const db = {
    profiles: [{ id: USER.id, email: USER.email, display_name: 'David', role: 'admin', active: true, created_at: new Date().toISOString() }],
    years: [], manufacturers: [], orders: [], suppliers: [],
  };
  const calls = [];
  const pk = { years: 'year' };
  const applyFilters = (rows, params) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
      const [op, ...rest] = v.split('.'); const val = rest.join('.');
      rows = rows.filter(r => {
        const x = r[k];
        if (op === 'eq') return String(x) === val;
        if (op === 'neq') return String(x) !== val;
        if (op === 'gte') return Number(x) >= Number(val);
        if (op === 'like') {
          const re = new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$');
          return re.test(String(x));
        }
        return true;
      });
    }
    return rows;
  };
  const handler = async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method(); const path = url.pathname;
    const raw = req.postData();
    const body = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
    calls.push(`${method} ${path}${decodeURIComponent(url.search)}`);
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
    const json = (status, data, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...cors, ...headers }, body: JSON.stringify(data) });
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path === '/auth/v1/token') {
      if (body?.password !== exports.PASSWORD) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' });
      return json(200, { access_token: TOKEN, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user: USER });
    }
    if (path === '/auth/v1/user') return json(200, USER);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (path.startsWith('/functions/v1/setup-admin')) return json(200, { needsSetup: false });
    if (path.startsWith('/functions/v1/extract-order')) return json(503, { error: 'La lectura con IA aún no está activada: falta configurar la clave de IA en el servidor.' });
    const m = path.match(/^\/rest\/v1\/(\w+)/);
    if (!m) return json(404, { message: 'not mocked ' + path });
    const table = m[1]; const params = [...url.searchParams.entries()];
    const h = req.headers(); const prefer = h['prefer'] || ''; const single = (h['accept'] || '').includes('vnd.pgrst.object');
    const rows = db[table];
    if (method === 'GET' || method === 'HEAD') {
      let out = applyFilters(rows, params);
      const order = url.searchParams.get('order');
      if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      const sel = url.searchParams.get('select');
      if (sel && sel !== '*') { const cols = sel.split(','); out = out.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))); }
      const headers = { 'content-range': `0-${Math.max(out.length - 1, 0)}/${out.length}` };
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...cors, ...headers } });
      if (single) return out.length === 1 ? json(200, out[0]) : (out.length === 0 && (h['accept'] || '').includes('nulls=stripped') ? json(200, null) : json(406, { code: 'PGRST116', message: 'no rows' }));
      return json(200, out, headers);
    }
    if (method === 'POST') {
      const items = Array.isArray(body) ? body : [body]; const created = [];
      for (const it of items) {
        const key = pk[table] || 'id';
        if (rows.some(r => r[key] === it[key])) { if (prefer.includes('ignore-duplicates')) continue; return json(409, { code: '23505', message: 'duplicate key' }); }
        if (table === 'orders' && rows.some(r => r.reference_number === it.reference_number)) return json(409, { code: '23505', message: 'duplicate reference' });
        if (table === 'manufacturers' && rows.some(r => r.code.toUpperCase() === String(it.code).toUpperCase())) return json(409, { code: '23505', message: 'duplicate code' });
        const row = { created_at: new Date().toISOString(), ...(table === 'orders' ? { updated_at: new Date().toISOString() } : {}), ...(table === 'manufacturers' ? { active_years: [] } : {}), ...it };
        rows.push(row); created.push(row);
      }
      if (!prefer.includes('return=representation')) return route.fulfill({ status: 201, headers: cors });
      return json(201, single ? created[0] : created);
    }
    if (method === 'PATCH') {
      const target = applyFilters(rows, params);
      target.forEach(r => { Object.assign(r, body); if (table === 'orders') r.updated_at = new Date().toISOString(); });
      if (!prefer.includes('return=representation')) return route.fulfill({ status: 204, headers: cors });
      return json(200, single ? target[0] : target);
    }
    if (method === 'DELETE') {
      const target = new Set(applyFilters(rows, params));
      if (table === 'manufacturers' && [...target].some(mf => db.orders.some(o => o.manufacturer_id === mf.id))) return json(409, { code: '23503', message: 'fk' });
      db[table] = rows.filter(r => !target.has(r));
      return route.fulfill({ status: 204, headers: cors });
    }
    return json(405, {});
  };
  return { db, calls, handler };
};
