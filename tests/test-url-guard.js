/**
 * 4see: proteccion contra pedidos a direcciones internas (modules/4see/lib/url_guard.js). Sin base de datos ni red.
 */
const { assertPublicHost, isPrivateAddress } = require('../modules/4see/lib/url_guard');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const rejects = async (url) => { try { await assertPublicHost(url); return false; } catch (e) { return e.code === 'URL_NOT_ALLOWED'; } };

(async () => {
  console.log('IPv4 internas se rechazan');
  ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']
    .forEach((ip) => ok(isPrivateAddress(ip), `${ip} es interna`));
  console.log('IPv4 publicas se permiten');
  ['8.8.8.8', '172.32.0.1', '192.169.0.1', '100.63.0.1', '1.1.1.1'].forEach((ip) => ok(!isPrivateAddress(ip), `${ip} es publica`));

  console.log('IPv6 internas se rechazan, en cualquier forma de escribirlas');
  ['::1', '::', '0:0:0:0:0:0:0:1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::127.0.0.1']
    .forEach((ip) => ok(isPrivateAddress(ip), `${ip} es interna`));
  console.log('IPv6 publicas se permiten');
  ['2001:4860:4860::8888', '::ffff:8.8.8.8'].forEach((ip) => ok(!isPrivateAddress(ip), `${ip} es publica`));

  console.log('Links completos');
  delete process.env.HS_ALLOW_PRIVATE_FETCH;
  ok(await rejects('http://127.0.0.1:5432/'), 'localhost por IP se rechaza');
  ok(await rejects('http://[::1]/'), 'localhost IPv6 se rechaza');
  ok(await rejects('http://169.254.169.254/latest/meta-data/'), 'metadatos de la nube se rechazan');
  ok(await rejects('http://10.0.0.5/admin'), 'red privada se rechaza');
  ok(await rejects('ftp://8.8.8.8/'), 'un protocolo que no es http o https se rechaza');
  ok(await rejects('no-es-un-link'), 'un texto que no es un link se rechaza');
  let allowed = true;
  try { await assertPublicHost('http://8.8.8.8/'); } catch (e) { allowed = false; }
  ok(allowed, 'una direccion publica se permite');

  console.log('El permiso de pruebas nunca vale en produccion');
  const prevEnv = process.env.NODE_ENV;
  process.env.HS_ALLOW_PRIVATE_FETCH = '1';
  process.env.NODE_ENV = 'development';
  let devAllowed = true;
  try { await assertPublicHost('http://127.0.0.1/'); } catch (e) { devAllowed = false; }
  ok(devAllowed, 'en desarrollo con el permiso de pruebas se puede leer localhost');
  process.env.NODE_ENV = 'production';
  ok(await rejects('http://127.0.0.1/'), 'en produccion el permiso se ignora');
  process.env.NODE_ENV = prevEnv;
  delete process.env.HS_ALLOW_PRIVATE_FETCH;

  console.log(failed ? `\n${failed} verificaciones fallaron` : '\nProteccion contra direcciones internas OK');
  process.exit(failed ? 1 : 0);
})();
