/**
 * lib/logger.js — HoloSpace Dynamic Multi-Tenant Logging Engine
 * World-Class Structured Logging (JSON/NDJSON) with:
 * 1. Global System Logs (INFO & ERROR daily rotated)
 * 2. Dynamic Per-Tenant Partitioning (Auto-created on first event for any tenant)
 */

const fs = require("fs");
const path = require("path");

const LOGS_ROOT = path.join(__dirname, "..", "logs");
const GLOBAL_DIR = path.join(LOGS_ROOT, "global");
const TENANTS_DIR = path.join(LOGS_ROOT, "tenants");

// Ensure base directories exist
[LOGS_ROOT, GLOBAL_DIR, TENANTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ensureTenantDir(slug) {
  const safeSlug = (slug || "default").toLowerCase().replace(/[^a-z0-9_-]/g, "").trim() || "default";
  const tenantDir = path.join(TENANTS_DIR, safeSlug);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
  return tenantDir;
}

function writeEntry(filePath, entry) {
  const line = JSON.stringify(entry) + "\n";
  try {
    fs.appendFileSync(filePath, line, "utf8");
  } catch (err) {
    console.error("[LOGGER DISK ERROR]", err.message);
  }
}

const logger = {
  /**
   * Log Informativo Global
   */
  info(message, context = {}) {
    const today = getTodayString();
    const entry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      context
    };
    console.log(`[INFO] ${message}`, context.userEmail ? `(${context.userEmail})` : "");
    writeEntry(path.join(GLOBAL_DIR, `app-${today}.log`), entry);

    if (context.tenantSlug) {
      const tDir = ensureTenantDir(context.tenantSlug);
      writeEntry(path.join(tDir, "activity.log"), entry);
    }
  },

  /**
   * Log de Advertencia Global / Tenant
   */
  warn(message, context = {}) {
    const today = getTodayString();
    const entry = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
      context
    };
    console.warn(`[WARN] ${message}`, context);
    writeEntry(path.join(GLOBAL_DIR, `app-${today}.log`), entry);

    if (context.tenantSlug) {
      const tDir = ensureTenantDir(context.tenantSlug);
      writeEntry(path.join(tDir, "activity.log"), entry);
    }
  },

  /**
   * Log de Error Detallado (Global + Tenant específico)
   */
  error(contextName, err, payload = {}) {
    const today = getTodayString();
    const errorMessage = err ? (err.message || String(err)) : "Error sin descripción";
    const stackTrace = err && err.stack ? err.stack : undefined;

    const entry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      context: contextName,
      error: errorMessage,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      userEmail: payload.userEmail || payload.email,
      payload,
      stackTrace
    };

    console.error(`❌ [ERROR - ${contextName}] ${errorMessage}`);
    writeEntry(path.join(GLOBAL_DIR, `error-${today}.log`), entry);

    // Dynamic Tenant Error Partitioning
    if (payload.tenantSlug) {
      const tDir = ensureTenantDir(payload.tenantSlug);
      writeEntry(path.join(tDir, "errors.log"), entry);
    }

    return entry;
  },

  /**
   * Log de Auditoría / Actividad Exclusiva de Tenant
   */
  tenant(slug, action, details = {}) {
    const tDir = ensureTenantDir(slug);
    const entry = {
      timestamp: new Date().toISOString(),
      level: "AUDIT",
      tenantSlug: slug,
      action,
      details
    };
    writeEntry(path.join(tDir, "audit.log"), entry);
  },

  /**
   * Leer logs recientes para soporte / UI
   */
  getRecentErrors(limit = 100) {
    const today = getTodayString();
    const errorFile = path.join(GLOBAL_DIR, `error-${today}.log`);
    if (!fs.existsSync(errorFile)) return [];
    try {
      const content = fs.readFileSync(errorFile, "utf8").trim();
      if (!content) return [];
      const lines = content.split("\n");
      return lines.slice(-limit).map(l => {
        try { return JSON.parse(l); } catch(e) { return { raw: l }; }
      });
    } catch (e) {
      return [{ error: "Error leyendo logs: " + e.message }];
    }
  }
};

module.exports = logger;
