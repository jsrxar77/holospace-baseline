const dns = require('dns').promises;
const net = require('net');

/**
 * Proteccion contra pedidos hacia direcciones internas (SSRF). El servidor abre links que escriben
 * los usuarios (rivales, productos propios): sin esto, alguien podria apuntarlo a la base de datos,
 * a otros contenedores de Docker o a los metadatos del proveedor de nube.
 * Solo se permiten http y https hacia direcciones publicas; se revisa en cada redireccion.
 */

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && p[2] === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function ipv6Words(ip) {
  let s = ip.toLowerCase();
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const p = v4[1].split('.').map(Number);
    s = s.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  const [head, tail] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = s.includes('::') ? new Array(Math.max(0, 8 - h.length - t.length)).fill('0') : [];
  return [...h, ...fill, ...t].map((x) => parseInt(x, 16));
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (!net.isIPv6(ip)) return true;
  const w = ipv6Words(ip);
  if (w.length !== 8 || w.some((x) => Number.isNaN(x))) return true;
  const leadingZeros = w.slice(0, 5).every((x) => x === 0);
  if (leadingZeros && (w[5] === 0xffff || w[5] === 0)) {
    if (w[5] === 0 && w[6] === 0 && (w[7] === 0 || w[7] === 1)) return true; // :: y ::1
    return isPrivateIPv4(`${w[6] >> 8}.${w[6] & 255}.${w[7] >> 8}.${w[7] & 255}`); // IPv4 dentro de IPv6
  }
  return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || (w[0] & 0xff00) === 0xff00;
}

function urlNotAllowed() {
  const err = new Error('URL_NOT_ALLOWED');
  err.code = 'URL_NOT_ALLOWED';
  return err;
}

// Solo para pruebas locales: nunca en produccion
function privateFetchAllowed() {
  return process.env.HS_ALLOW_PRIVATE_FETCH === '1' && process.env.NODE_ENV !== 'production';
}

async function assertPublicHost(urlString) {
  if (privateFetchAllowed()) return;
  let u;
  try { u = new URL(urlString); } catch (e) { throw urlNotAllowed(); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw urlNotAllowed();
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw urlNotAllowed();
}

module.exports = { assertPublicHost, isPrivateAddress };
