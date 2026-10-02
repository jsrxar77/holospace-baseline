#!/usr/bin/env node
// PreToolUse(Bash): impone la regla "todo corre en Docker".
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = JSON.parse(raw).tool_input.command || ''; } catch { process.exit(0); }
  const blocked = [
    [/\bnpm\s+run\s+dev\b/, 'npm run dev no se usa: el stack corre en Docker.'],
    [/(^|[;&|]\s*)node\s+(--watch\s+)?server\.js\b/, 'No ejecutar server.js en el host: usar docker compose.'],
    [/(^|[;&|]\s*)(npm|npx)\s+(i|install|ci)\b(?!.*(impeccable|context7|playwright|server-postgres))/, 'Instalar dependencias via Dockerfile/package.json + docker compose up -d --build.'],
  ];
  for (const [re, msg] of blocked) {
    if (re.test(cmd)) {
      process.stderr.write(`Bloqueado por regla de proyecto: ${msg}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
