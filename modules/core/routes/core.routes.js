/**
 * HoloWare Core — Platform API Router Module
 * Endpoints: /api/login, /api/users, /api/theme, /api/modules, /api/platform-audit, /api/error-logs, /api/log-client-error
 */

module.exports = function handleCoreRoutes(req, res, db, data, currentUser, processEnv, logDetailedError) {
  const url = req.url;
  const method = req.method;

  // 1. CONSULTA DE TEMA DINÁMICO
  if (url === '/api/theme' && method === 'GET') {
    const activeTheme = db.prepare("SELECT value FROM app_settings WHERE key = 'active_theme'").get();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeTheme: activeTheme ? activeTheme.value : (processEnv.HW_THEME || processEnv.THEME || 'original')
    }));
    return true;
  }

  // 2. CAMBIO DE TEMA DINÁMICO (ADMIN & SUPERADMIN)
  if (url === '/api/theme' && method === 'POST') {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERADMIN')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Acceso restringido a administradores' }));
      return true;
    }

    const { theme } = data;
    if (!theme) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Parámetro theme es requerido' }));
      return true;
    }

    const normalizedTheme = String(theme).toLowerCase().trim();
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('active_theme', ?)").run(normalizedTheme);

    // Audit log
    try {
      db.prepare('INSERT INTO platform_audit_logs (timestamp, userEmail, action, details) VALUES (?, ?, ?, ?)')
        .run(new Date().toISOString(), currentUser.email, 'THEME_CHANGED', JSON.stringify({ theme: normalizedTheme }));
    } catch {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, theme: normalizedTheme }));
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

  return false; // Route not handled by core router
};
