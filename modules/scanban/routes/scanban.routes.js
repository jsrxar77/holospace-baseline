/**
 * HoloWare Module: ScanBan — API Router Module
 * Handles all /api/scanban/* routes
 */

module.exports = function handleScanBanRoutes(req, res, db, data, currentUser, getFullOrderFromDb, parsePdfBuffer, logDetailedError) {
  const url = req.url;
  const method = req.method;

  if (!url.startsWith('/api/scanban/')) {
    return false; // Not a ScanBan route
  }

  // Check if ScanBan module is active
  const scanbanModule = db.prepare("SELECT active FROM modules WHERE key = 'scanban'").get();
  if (scanbanModule && !scanbanModule.active) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'El módulo ScanBan está desactivado actualmente por el Super Administrador.' }));
    return true;
  }

  return false; // Delegated back to main handlers for backwards safety
};
