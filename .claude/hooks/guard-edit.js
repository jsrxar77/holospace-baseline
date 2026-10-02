#!/usr/bin/env node
// PreToolUse(Edit|Write): .md fuera de docs/, emojis y secretos obvios.
const path = require('path');
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw).tool_input; } catch { process.exit(0); }
  const file = input.file_path || '';
  const text = input.content || input.new_string || '';
  const rel = path.relative(process.cwd(), file);
  const fail = (m) => { process.stderr.write(`Bloqueado por regla de proyecto: ${m}\n`); process.exit(2); };

  if (/\.md$/i.test(file) && !/^(docs\/|\.claude\/|CLAUDE\.md$|PRODUCT\.md$|DESIGN\.md$)/.test(rel) && !rel.startsWith('..')) {
    fail(`archivo .md fuera de docs/ (${rel}). Documentar en docs/.`);
  }
  if (/\.(js|ts|tsx|html|css|json|md|sql|sh)$/i.test(file) && !rel.startsWith('.claude/skills/impeccable')) {
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) fail('emojis no permitidos en codigo, UI ni docs.');
  }
  if (/(password|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i.test(text) && !/\.env\.example$|tests\//.test(rel)) {
    fail('posible secreto hardcodeado. Usar variables de entorno.');
  }
  process.exit(0);
});
