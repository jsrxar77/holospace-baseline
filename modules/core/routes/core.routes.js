/**
 * HoloWare Core — Platform API Router Module
 * Endpoints: /api/login, /api/users, /api/theme, /api/modules, /api/platform-audit, /api/error-logs, /api/log-client-error
 */

const THEMES = {
  original: {
    name: 'Original Dark Glassmorphism',
    background: '#0B0E14',
    cardBg: '#161B22',
    cardBorder: '#30363D',
    emerald: '#00E676',
    cobalt: '#3B82F6',
    amber: '#F59E0B',
    red: '#FF5252',
    textMain: '#FFFFFF',
    textMuted: '#8B949E'
  },
  cyberpunk_neon: {
    name: 'Cyberpunk Neon',
    background: '#0D0221',
    cardBg: '#190A38',
    cardBorder: '#261447',
    emerald: '#00FF9F',
    cobalt: '#00B8FF',
    amber: '#FF007F',
    red: '#FF3860',
    textMain: '#FFFFFF',
    textMuted: '#A092B7'
  },
  nordic_frost: {
    name: 'Nordic Frost',
    background: '#0F172A',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    emerald: '#38BDF8',
    cobalt: '#818CF8',
    amber: '#F59E0B',
    red: '#F43F5E',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8'
  },
  dracula_pro: {
    name: 'Dracula Pro',
    background: '#282A36',
    cardBg: '#44475A',
    cardBorder: '#6272A4',
    emerald: '#50FA7B',
    cobalt: '#BD93F9',
    amber: '#FFB86C',
    red: '#FF5555',
    textMain: '#F8F8F2',
    textMuted: '#8BE9FD'
  },
  emerald_light: {
    name: 'Modern Light Corporate',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    emerald: '#059669',
    cobalt: '#2563EB',
    amber: '#D97706',
    red: '#DC2626',
    textMain: '#0F172A',
    textMuted: '#64748B'
  },
  monochrome_minimal: {
    name: 'Monochrome Minimal',
    background: '#000000',
    cardBg: '#111111',
    cardBorder: '#222222',
    emerald: '#FFFFFF',
    cobalt: '#CCCCCC',
    amber: '#888888',
    red: '#FF4444',
    textMain: '#FFFFFF',
    textMuted: '#777777'
  },
  catppuccin_mocha: {
    name: 'Catppuccin Mocha',
    background: '#1E1E2E',
    cardBg: '#181825',
    cardBorder: '#313244',
    emerald: '#A6E3A1',
    cobalt: '#89B4FA',
    amber: '#F9E2AF',
    red: '#F38BA8',
    textMain: '#CDD6F4',
    textMuted: '#A6ADC8'
  }
};

module.exports = function handleCoreRoutes(req, res, db, data, currentUser, processEnv, logDetailedError) {
  const url = req.url;
  const method = req.method;

  // 1. CONSULTA DE TEMA DINÁMICO DE PLATAFORMA (GET /api/theme)
  if (url === '/api/theme' && method === 'GET') {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'active_theme'").get();
    const themeKey = (row ? row.value : 'original').toLowerCase().trim();
    const activeTheme = THEMES[themeKey] || THEMES.original;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeThemeKey: themeKey in THEMES ? themeKey : 'original',
      theme: activeTheme
    }));
    return true;
  }

  // 2. CAMBIO DE TEMA DINÁMICO DE PLATAFORMA (POST /api/theme - SUPERADMIN ONLY)
  if (url === '/api/theme' && method === 'POST') {
    const { themeKey, theme } = data;
    const targetKey = (themeKey || theme || '').toLowerCase().trim();

    if (!currentUser || currentUser.role !== 'SUPERADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Solo el Super Administrador puede cambiar el tema visual de la plataforma.' }));
      return true;
    }

    if (!THEMES[targetKey]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tema no válido.' }));
      return true;
    }

    // Persistir tema activo a nivel Core en app_settings
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('active_theme', ?)").run(targetKey);

    // Auditoría de plataforma
    try {
      db.prepare('INSERT INTO platform_audit_logs (timestamp, userEmail, action, details) VALUES (?, ?, ?, ?)')
        .run(new Date().toISOString(), currentUser.email, 'THEME_CHANGED', JSON.stringify({ themeKey: targetKey, themeName: THEMES[targetKey].name }));
    } catch {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      activeThemeKey: targetKey,
      theme: THEMES[targetKey]
    }));
    return true;
  }

  // 3. MÓDULOS (SUPERADMIN ONLY)
  if (url === '/api/modules' && method === 'GET') {
    const mods = db.prepare('SELECT id, key, name, description, active, activatedBy, activatedAt FROM modules ORDER BY id ASC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, modules: mods }));
    return true;
  }

  if (url === '/api/modules' && method === 'POST') {
    if (!currentUser || currentUser.role !== 'SUPERADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede gestionar módulos.' }));
      return true;
    }
    const { key, active } = data;
    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Se requiere el campo key del módulo.' }));
      return true;
    }
    const mod = db.prepare('SELECT * FROM modules WHERE key = ?').get(key);
    if (!mod) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Módulo '${key}' no encontrado.` }));
      return true;
    }
    if (mod.key === 'core') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'El módulo Core no puede desactivarse.' }));
      return true;
    }
    const newActive = active ? 1 : 0;
    db.prepare('UPDATE modules SET active = ?, activatedBy = ?, activatedAt = ? WHERE key = ?')
      .run(newActive, currentUser.email, new Date().toISOString(), key);
    db.prepare('INSERT INTO platform_audit_logs (timestamp, userEmail, action, details) VALUES (?, ?, ?, ?)')
      .run(new Date().toISOString(), currentUser.email, newActive ? 'MODULE_ACTIVATED' : 'MODULE_DEACTIVATED',
        JSON.stringify({ module: key, active: newActive }));
    const updated = db.prepare('SELECT * FROM modules WHERE key = ?').get(key);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, module: updated }));
    return true;
  }

  // 4. PLATFORM AUDIT LOGS (SUPERADMIN ONLY)
  if (url === '/api/platform-audit' && method === 'GET') {
    if (!currentUser || currentUser.role !== 'SUPERADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
      return true;
    }
    const logs = db.prepare('SELECT id, timestamp, userEmail, action, details FROM platform_audit_logs ORDER BY id DESC LIMIT 100').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, logs }));
    return true;
  }

  return false;
};
