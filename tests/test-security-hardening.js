/**
 * Core: endurecimiento de seguridad (D-001 a D-004, D-007 de docs/DEBT.md)
 * - La identidad solo sale de un JWT firmado; un email nunca es credencial.
 * - Un token firmado con el secreto historico publico es rechazado.
 * - CORS con lista de origenes, cabeceras de seguridad y limite de intentos de login.
 * - El seed no guarda contrasenas en texto plano.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

function req(method, p, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: '127.0.0.1', port: 3001, path: p, method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, json: j }); });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function forgeJwt(secret, email) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const p = b64({ sub: email, email, role: 'SUPERADMIN', iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${h}.${p}.${sig}`;
}

(async () => {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@holospace.com.ar';
  const password = process.env.SUPERADMIN_PASSWORD || 'BrunaSeRelambe22!';

  console.log('D-001 identidad solo con JWT');
  const asEmailBearer = await req('GET', '/api/users', { headers: { Authorization: `Bearer ${email}` } });
  ok(asEmailBearer.status === 403 || asEmailBearer.status === 401, `Bearer <email> rechazado (HTTP ${asEmailBearer.status})`);
  const asHeader = await req('GET', '/api/users', { headers: { 'x-user-email': email } });
  ok(asHeader.status === 403 || asHeader.status === 401, `x-user-email ignorado (HTTP ${asHeader.status})`);
  const asBody = await req('POST', '/api/users', { body: { email, userEmail: email } });
  ok(asBody.status === 403 || asBody.status === 401, `email en body ignorado (HTTP ${asBody.status})`);

  const login = await req('POST', '/api/login', { body: { email, password } });
  ok(login.status === 200 && login.json && login.json.token, 'login valido entrega JWT');
  if (login.json && login.json.token) {
    const withJwt = await req('GET', '/api/users', { headers: { Authorization: `Bearer ${login.json.token}` } });
    ok(withJwt.status === 200, 'JWT valido accede a /api/users');
  }

  console.log('D-002 secreto JWT');
  const forged = await req('GET', '/api/users', { headers: { Authorization: `Bearer ${forgeJwt('holospace_super_secret_jwt_key_2026_x89f_aes', email)}` } });
  ok(forged.status === 403 || forged.status === 401, `token firmado con el secreto historico publico rechazado (HTTP ${forged.status})`);

  console.log('OAuth: el modo simulado no emite sesiones sin OAUTH_MOCK');
  const mockCb = await req('GET', '/api/auth/google/callback?code=' + encodeURIComponent('mock_code_' + email));
  const loc = String(mockCb.headers.location || '');
  ok(mockCb.status === 302 && loc.startsWith('/login?auth_error=') && !/token=/.test(loc), 'callback con mock_code_<email> no entrega token');
  const mockStart = await req('GET', '/api/auth/google?email=' + encodeURIComponent(email));
  ok(!String(mockStart.headers.location || '').includes('mock_code_'), 'inicio de Google ignora ?email= y no simula sin OAUTH_MOCK');

  console.log('D-003 seed sin texto plano');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'data', 'init-schema.sql'), 'utf8');
  ok(!/'scrypt:[^']{1,64}'/.test(seed), "init-schema.sql no usa el formato scrypt:<texto plano>");

  console.log('D-004 CORS, cabeceras y rate limit');
  const evil = await req('GET', '/api/theme', { headers: { Origin: 'https://evil.example.com' } });
  ok(!evil.headers['access-control-allow-origin'], 'origen ajeno no recibe Access-Control-Allow-Origin');
  const local = await req('GET', '/api/theme', { headers: { Origin: 'http://localhost:8081' } });
  ok(local.headers['access-control-allow-origin'] === 'http://localhost:8081', 'origen local de desarrollo permitido');
  const any = await req('GET', '/api/theme');
  ok(any.headers['access-control-allow-origin'] !== '*', 'ya no se responde Access-Control-Allow-Origin: *');
  ok(any.headers['x-content-type-options'] === 'nosniff' && any.headers['x-frame-options'] === 'DENY', 'cabeceras X-Content-Type-Options y X-Frame-Options');
  const landing = await req('GET', '/');
  ok(landing.headers['x-content-type-options'] === 'nosniff', 'la landing tambien lleva cabeceras de seguridad');

  const victim = `rate-${crypto.randomBytes(4).toString('hex')}@example.com`;
  let last = null;
  for (let i = 0; i < 12; i++) last = await req('POST', '/api/login', { body: { email: victim, password: 'incorrecta' } });
  ok(last.status === 429 && last.json && last.json.code === 'TOO_MANY_ATTEMPTS', `login bloqueado tras intentos fallidos (HTTP ${last.status})`);

  console.log(failed ? `\n${failed} verificaciones fallaron` : '\nSeguridad OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Error en la suite:', e.message); process.exit(1); });
