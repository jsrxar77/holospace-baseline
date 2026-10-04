/**
 * Formato y carga de datos de holospace.: montos, fechas y nombres. Un solo lugar para todos los
 * modulos. Montos en pesos: "$ 165.200,00" (dos decimales, sin cortes de linea). Logica pura en
 * HSFormat (probada en Node); HSFields aplica el formato a los campos de carga en el navegador.
 */
(function (root) {
  'use strict';

  const NBSP = ' ';

  function money(value) {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '—';
    const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? '-' : ''}$${NBSP}${abs}`;
  }

  // Acepta "165.200,00", "165200,5", "165200.50" o "165200". Devuelve NaN si no es un monto.
  function parseMoney(text) {
    if (typeof text === 'number') return text;
    let s = String(text == null ? '' : text).replace(/[$\s ]/g, '');
    if (s === '') return NaN;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    }
    return /^-?\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
  }

  function date(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function name(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  }

  function moneyHtml(value) {
    return `<span class="hs-money">${money(value)}</span>`;
  }

  const api = { money, moneyHtml, parseMoney, date, name };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSFormat = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  'use strict';
  const F = root.HSFormat;
  if (!F) return;

  // Campo de monto: al salir del campo queda con formato; al guardar se lee como numero
  function bindMoney(input) {
    if (!input || input.dataset.hsMoney === '1') return;
    input.dataset.hsMoney = '1';
    input.inputMode = 'decimal';
    input.addEventListener('blur', () => {
      const n = F.parseMoney(input.value);
      input.value = Number.isNaN(n) ? input.value : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }
  function readMoney(input) {
    return F.parseMoney(input ? input.value : '');
  }
  root.HSFields = { bindMoney, readMoney };
})(typeof window !== 'undefined' ? window : globalThis);

// Nombre de marca con el punto en verde para textos que se arman por JavaScript
const BRAND_HTML = '<span class="hs-name">holospace<i>.</i></span>';

let currentUser = null;
let customDialogResolver = null;
let collapsedUserGroups = new Set(); // Guarda los usuarios colapsados en DOING/DONE
let kanbanAutoRefreshInterval = null; // Auto-refresco en tiempo real del tablero Kanban
let cachedRoles = [];
let cachedPermissions = [];

// Helper de comprobación de permisos en el Frontend (RBAC)
function hasFrontendPermission(permissionKey) {
  if (!currentUser) return false;
  if (currentUser.role === 'SUPERADMIN') return true;
  if (!currentUser.permissions || !Array.isArray(currentUser.permissions)) return false;
  if (currentUser.permissions.includes('*')) return true;
  if (currentUser.permissions.includes(permissionKey)) return true;
  const [mod] = permissionKey.split(':');
  if (currentUser.permissions.includes(`${mod}:*`)) return true;
  return false;
}

// Modal Centralizado de Acceso Denegado 403
function showPermissionDeniedModal(data = {}) {
  const modal = document.getElementById('permissionDeniedModal');
  if (!modal) {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert('No tenés permiso para esto', data.message || data.error || 'Tu rol no incluye esta acción. Pedile a un administrador que te la habilite.');
    }
    return;
  }
  const permChip = document.getElementById('deniedPermissionChip');
  const modChip = document.getElementById('deniedModuleChip');
  const msgEl = document.getElementById('deniedMessageText');
  
  if (permChip) permChip.innerText = data.required_permission || 'Permiso restringido';
  if (modChip) modChip.innerText = (data.module || 'seguridad').toUpperCase();
  if (msgEl) msgEl.innerText = data.message || data.error || 'No dispones de los permisos requeridos para ejecutar esta acción.';
  
  modal.classList.remove('hidden');
}

function closePermissionDeniedModal() {
  const modal = document.getElementById('permissionDeniedModal');
  if (modal) modal.classList.add('hidden');
}

// Interceptor Global de Fetch para capturar 403 INSUFFICIENT_PERMISSIONS de manera centralizada
if (typeof window !== 'undefined' && window.fetch) {
  const nativeFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await nativeFetch.apply(this, args);
    if (response.status === 403) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data && data.code === 'INSUFFICIENT_PERMISSIONS') {
          showPermissionDeniedModal(data);
        }
      } catch (err) {
        // Respuesta no es JSON o ya fue consumida
      }
    }
    return response;
  };
}

// Helper de sesión multi-tab: prioriza sessionStorage (aislado por pestaña) con fallback a localStorage
function getAuthToken() {
  try {
    return sessionStorage.getItem('hs_token') || localStorage.getItem('hs_token') || '';
  } catch (e) {
    return '';
  }
}

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem('hs_user') || localStorage.getItem('hs_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getAuthTenant() {
  try {
    const raw = sessionStorage.getItem('hs_tenant') || localStorage.getItem('hs_tenant');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user, tenant) {
  try {
    if (token) sessionStorage.setItem('hs_token', token);
    if (user) sessionStorage.setItem('hs_user', typeof user === 'string' ? user : JSON.stringify(user));
    if (tenant) sessionStorage.setItem('hs_tenant', typeof tenant === 'string' ? tenant : JSON.stringify(tenant));
    // Limpiar localStorage de tokens para evitar contaminación cruzada entre tabs
    localStorage.removeItem('hs_token');
    localStorage.removeItem('hs_user');
    localStorage.removeItem('hs_tenant');
  } catch (e) {}
}

function clearAuthSession() {
  try {
    sessionStorage.removeItem('hs_token');
    sessionStorage.removeItem('hs_user');
    sessionStorage.removeItem('hs_tenant');
    localStorage.removeItem('hs_token');
    localStorage.removeItem('hs_user');
    localStorage.removeItem('hs_tenant');
  } catch (e) {}
}

function populateSavedCredentials() {
  // Inicialización limpia por defecto (Regla de Oro: Campos limpios y aislados por pestaña)
  const savedEmail = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('hs_saved_email') : '') || '';
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (emailInput) emailInput.value = savedEmail;
  if (passwordInput) passwordInput.value = '';
}

function toggleLoginPasswordVisibility() {
  const passwordInput = document.getElementById('loginPassword');
  const toggleBtn = document.getElementById('togglePasswordBtn');
  if (passwordInput) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      if (toggleBtn) toggleBtn.innerText = 'Ocultar';
    } else {
      passwordInput.type = 'password';
      if (toggleBtn) toggleBtn.innerText = 'Ver';
    }
  }
}

function holoLoggedOutThemeKey() {
  let saved = null;
  try { saved = localStorage.getItem('hs_landing_theme'); } catch (e) {}
  if (saved === 'holo_dark' || saved === 'holo_light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'holo_light' : 'holo_dark';
}

async function loadActiveTheme() {
  try {
    // Sin sesion: Holo Night o Holo Day segun la landing o la preferencia del sistema
    if (!getAuthToken()) {
      const key = holoLoggedOutThemeKey();
      document.body.className = 'theme-' + key + ' state-logged-out';
      updateThemeToggleLabel(key);
      return;
    }
    const token = getAuthToken() || (currentUser ? currentUser.email : '');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch('/api/theme', { headers });
    const data = await res.json();
    if (data && data.theme) {
      const activeKey = data.themeKey || 'holo_dark';
      const isLoggedOut = !document.getElementById('loginModal') || !document.getElementById('loginModal').classList.contains('hidden');
      document.body.className = 'theme-' + activeKey + (isLoggedOut ? ' state-logged-out' : ' state-logged-in');
      const root = document.documentElement;
      const t = data.theme;

      if (t.background) {
        root.style.setProperty('--bg-main', t.background);
        root.style.setProperty('--bg-dark', t.background);
        root.style.setProperty('--bg-black', t.background);
      }
      if (t.cardBg) root.style.setProperty('--card-bg', t.cardBg);
      if (t.cardBorder) root.style.setProperty('--card-border', t.cardBorder);
      if (t.emerald) root.style.setProperty('--emerald', t.emerald);
      if (t.cobalt) root.style.setProperty('--cobalt', t.cobalt);
      if (t.amber) root.style.setProperty('--amber', t.amber);
      if (t.red) root.style.setProperty('--red', t.red);
      if (t.textMain) root.style.setProperty('--text-main', t.textMain);
      if (t.textMuted) root.style.setProperty('--text-muted', t.textMuted);

      if (t.fontFamily) root.style.setProperty('--hw-font-family', t.fontFamily);
      if (t.logoFontFamily) root.style.setProperty('--hw-font-logo', t.logoFontFamily);
      if (t.radiusCard) root.style.setProperty('--hw-radius-card', t.radiusCard + 'px');
      if (t.radiusBtn) root.style.setProperty('--hw-radius-btn', t.radiusBtn + 'px');
      if (t.radiusBadge) root.style.setProperty('--hw-radius-badge', t.radiusBadge + 'px');
      if (t.borderWidth) root.style.setProperty('--hw-border-width', t.borderWidth + 'px');

      updateThemeToggleLabel(activeKey);
      // Los graficos leen la paleta de las variables: si se dibujaron antes de este paso, se redibujan.
      window.dispatchEvent(new Event('hs-theme-applied'));
    }
  } catch (e) {
    console.error('Error cargando tema activo:', e);
  }
}

// El icono (sol/luna) ya cambia solo por CSS segun la clase de tema del body; solo la palabra necesita JS.
function updateThemeToggleLabel(themeKey) {
  const label = document.getElementById('headerThemeLabel');
  if (label) label.textContent = themeKey === 'holo_light' ? 'Day' : 'Night';
}

// El selector de tema es un boton que alterna entre los dos temas (Holo Night / Holo Day), igual que en la landing.
function toggleAppTheme() {
  const next = document.body.classList.contains('theme-holo_light') ? 'holo_dark' : 'holo_light';
  if (getAuthToken()) {
    changeAppThemeSubmit(next);
  } else {
    try { localStorage.setItem('hs_landing_theme', next); } catch (e) {}
    document.body.className = 'theme-' + next + ' state-logged-out';
    updateThemeToggleLabel(next);
  }
}
window.toggleAppTheme = toggleAppTheme;

async function changeAppThemeSubmit(themeKey) {
  try {
    const token = getAuthToken() || (currentUser ? currentUser.email : '');
    const res = await fetch('/api/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        themeKey,
        scope: 'user',
        userEmail: currentUser ? currentUser.email : token
      })
    });
    const data = await res.json();

    if (data.success) {
      await loadActiveTheme();
      if (currentUser && currentUser.role === 'SUPERADMIN' && typeof loadPlatformPanel === 'function') {
        await loadPlatformPanel();
      }
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No se pudo cambiar el tema visual.');
    }
  } catch (e) {
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function changeTenantDefaultTheme(tenantId, themeKey) {
  try {
    const token = getAuthToken() || '';
    const res = await fetch('/api/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        themeKey,
        scope: 'tenant',
        targetTenantId: tenantId
      })
    });
    const data = await res.json();

    if (data.success) {
      await loadTenantsManagementData();
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No pudimos cambiar el tema de la empresa.');
    }
  } catch (e) {
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function loadAppConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success && data.version) {
      const verEl = document.getElementById('footerAppVersion');
      if (verEl) {
        verEl.innerHTML = `${BRAND_HTML} versión ${String(data.version).replace(/[^0-9A-Za-z.\-]/g, '')}`;
      }
    }
  } catch (e) { }
}

let currentOnboardingProfile = null;

function openOnboardingPlanModal(profile) {
  currentOnboardingProfile = profile;
  const modal = document.getElementById('onboardingPlanModal');
  if (!modal) return;

  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.classList.add('hidden');
    loginModal.style.display = 'none';
  }

  const emailEl = document.getElementById('obProfileEmail');
  const nameEl = document.getElementById('obProfileName');
  if (emailEl) emailEl.innerText = profile.email || '';
  if (nameEl) nameEl.innerText = profile.name || (profile.email ? profile.email.split('@')[0] : '');

  const imgEl = document.getElementById('obAvatarImg');
  const placeholderEl = document.getElementById('obAvatarPlaceholder');
  if (imgEl && placeholderEl) {
    if (profile.picture) {
      imgEl.src = profile.picture;
      imgEl.style.display = 'block';
      placeholderEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      placeholderEl.style.display = 'flex';
      placeholderEl.innerText = (profile.name || profile.email || 'G')[0].toUpperCase();
    }
  }

  if (profile.plan && profile.plan.startsWith('fourseee_')) {
    switchOnboardingProduct('4see');
    selectOnboardingPlan(profile.plan);
  } else {
    switchOnboardingProduct('kanban');
    selectOnboardingPlan(profile.plan || 'kanban_business');
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeOnboardingPlanModal() {
  const modal = document.getElementById('onboardingPlanModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function handleOnboardingCompanyNameChange(val) {
  const slugInput = document.getElementById('obCompanySlug');
  if (slugInput) {
    slugInput.value = val.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
}

function switchOnboardingProduct(prod) {
  const tabKanban = document.getElementById('tabProductKanban');
  const tab4see = document.getElementById('tabProduct4see');
  const gridKanban = document.getElementById('plansGridKanban');
  const grid4see = document.getElementById('plansGrid4see');

  if (prod === '4see') {
    if (tabKanban) {
      tabKanban.classList.remove('btn-primary');
      tabKanban.classList.add('btn-secondary');
    }
    if (tab4see) {
      tab4see.classList.remove('btn-secondary');
      tab4see.classList.add('btn-primary');
    }
    if (gridKanban) gridKanban.style.display = 'none';
    if (grid4see) grid4see.style.display = 'grid';
    selectOnboardingPlan('fourseee_business');
  } else {
    if (tab4see) {
      tab4see.classList.remove('btn-primary');
      tab4see.classList.add('btn-secondary');
    }
    if (tabKanban) {
      tabKanban.classList.remove('btn-secondary');
      tabKanban.classList.add('btn-primary');
    }
    if (grid4see) grid4see.style.display = 'none';
    if (gridKanban) gridKanban.style.display = 'grid';
    selectOnboardingPlan('kanban_business');
  }
}

function selectOnboardingPlan(planCode) {
  const inputEl = document.getElementById('obSelectedPlanCode');
  if (inputEl) inputEl.value = planCode;
  document.querySelectorAll('.plan-card-option').forEach(card => {
    if (card.getAttribute('data-plan') === planCode) {
      card.style.borderColor = 'var(--emerald)';
      card.style.background = 'var(--hw-surface-2)';
      card.classList.add('selected');
    } else {
      card.style.borderColor = 'var(--card-border)';
      card.style.background = 'var(--hw-surface-2)';
      card.classList.remove('selected');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('state-logged-out');
  loadActiveTheme();
  loadAppConfig();
  populateSavedCredentials();

  const urlParams = new URLSearchParams(window.location.search);
  // El token de Google llega en el fragmento (#token=...&user=...); se fusiona con la query y se limpia de la URL
  if (window.location.hash && window.location.hash.length > 1) {
    new URLSearchParams(window.location.hash.slice(1)).forEach((v, k) => urlParams.set(k, v));
  }
  const redirectTarget = urlParams.get('redirect');

  // Si viene con ?logout=true desde mobile, limpiar todo en el dominio principal
  if (urlParams.get('logout') === 'true') {
    clearAuthSession();
    currentUser = null;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/login');
    }
  }

  // Procesamiento de autenticación exitosa con Google OAuth2
  const oauthToken = urlParams.get('token');
  const oauthUserRaw = urlParams.get('user');
  if (oauthToken) {
    try {
      const parsedUser = oauthUserRaw ? JSON.parse(decodeURIComponent(oauthUserRaw)) : null;
      const parsedTenant = parsedUser?.tenantSlug ? { id: parsedUser.tenantId, slug: parsedUser.tenantSlug, name: parsedUser.tenantSlug } : null;
      setAuthSession(oauthToken, parsedUser, parsedTenant);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {
      console.error('[AUTH] Error al procesar sesión OAuth:', e);
    }
  }

  // Manejo de onboarding federado (nuevo usuario Google)
  if (urlParams.get('onboarding') === 'google') {
    const obEmail = urlParams.get('email') || '';
    const obName = urlParams.get('name') || '';
    const obSub = urlParams.get('sub') || '';
    const obPicture = urlParams.get('picture') || '';
    const obPlan = urlParams.get('plan') || 'kanban_business';
    
    setTimeout(() => {
      openOnboardingPlanModal({ email: obEmail, name: obName, sub: obSub, picture: obPicture, plan: obPlan });
    }, 150);
  }

  const authError = urlParams.get('auth_error');
  if (authError) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.innerText = decodeURIComponent(authError);
      loginError.style.display = 'block';
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  // Listener para el formulario de Onboarding
  const obForm = document.getElementById('onboardingPlanForm');
  if (obForm) {
    obForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const companyName = document.getElementById('obCompanyName').value;
      const slug = document.getElementById('obCompanySlug').value;
      const planCode = document.getElementById('obSelectedPlanCode').value;
      const errorDiv = document.getElementById('onboardingError');
      const submitBtn = document.getElementById('obSubmitBtn');

      if (!currentOnboardingProfile) {
        errorDiv.innerText = 'No pudimos leer los datos de tu cuenta de Google. Volvé a intentar el ingreso.';
        errorDiv.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Creando tu cuenta...';
      errorDiv.style.display = 'none';

      try {
        const res = await fetch('/api/auth/oauth-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: currentOnboardingProfile,
            companyName,
            slug,
            planCode
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Error al completar el alta de la organización.');
        }

        setAuthSession(data.token, data.user, data.tenant);
        closeOnboardingPlanModal();
        window.location.href = '/';
      } catch (err) {
        errorDiv.innerText = err.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Crear mi cuenta y entrar';
      }
    });
  }

  const token = getAuthToken();
  const userObj = getAuthUser();
  const tenantObj = getAuthTenant();
  const currentPath = window.location.pathname.toLowerCase();

  if (token && userObj) {
    currentUser = userObj;
    const tenant = tenantObj || { name: 'holospace.' };

    // Si viene con redirect hacia m.holospace.com.ar o /scanner, transferir credenciales de inmediato
    if (redirectTarget && (redirectTarget.includes('m.holospace') || redirectTarget.includes('scanner'))) {
      const separator = redirectTarget.includes('?') ? '&' : '?';
      const targetWithAuth = redirectTarget + separator + 'auth_token=' + encodeURIComponent(token) + '&auth_user=' + encodeURIComponent(JSON.stringify(currentUser)) + '&auth_tenant=' + encodeURIComponent(JSON.stringify(tenant));
      window.location.href = targetWithAuth;
      return;
    }

    document.body.classList.remove('state-logged-out');
    document.body.classList.add('state-logged-in');
    const loginModalEl = document.getElementById('loginModal');
    if (loginModalEl) {
      loginModalEl.classList.add('hidden');
      loginModalEl.style.display = 'none';
    }
    const userBadgeEl = document.getElementById('userBadge');
    if (userBadgeEl) {
      userBadgeEl.innerText = `${currentUser.role}: ${currentUser.email} (${tenant.name || 'holospace.'})`;
    }
    applyRoleVisibility();
  } else {
    // Si no está autenticado y accede a una ruta interna, abrir modal de login
    const loginModalEl = document.getElementById('loginModal');
    if (loginModalEl) {
      loginModalEl.classList.remove('hidden');
      loginModalEl.style.display = 'flex';
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginError = document.getElementById('loginError');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        currentUser = data.user;
        setAuthSession(data.token, data.user, data.tenant);
        try {
          sessionStorage.setItem('hs_saved_email', email);
        } catch (e) {}

        document.body.classList.remove('state-logged-out');
        document.body.classList.add('state-logged-in');
        const loginModalEl = document.getElementById('loginModal');
        if (loginModalEl) {
          loginModalEl.classList.add('hidden');
          loginModalEl.style.display = 'none';
        }

        const urlParams = new URLSearchParams(window.location.search);
        const redirectTarget = urlParams.get('redirect');

        if (redirectTarget) {
          // Si el redirect es hacia el escáner móvil m.holospace.com.ar o /scanner
          const separator = redirectTarget.includes('?') ? '&' : '?';
          const targetWithAuth = redirectTarget + separator + 'auth_token=' + encodeURIComponent(data.token) + '&auth_user=' + encodeURIComponent(JSON.stringify(data.user)) + '&auth_tenant=' + encodeURIComponent(JSON.stringify(data.tenant || {}));
          window.location.href = targetWithAuth;
          return;
        }

        const orgName = data.tenant ? data.tenant.name : 'Drink Lovers';
        document.getElementById('userBadge').innerText = `${currentUser.role}: ${currentUser.email} (${orgName})`;
        applyRoleVisibility();
        const currentPath = window.location.pathname.toLowerCase();
        if (currentPath.includes('core')) {
          switchModule('core');
        } else if (currentPath.includes('tenant')) {
          switchModule('tenant');
        } else if (currentPath.includes('orders')) {
          switchModule('kanban');
          switchTab('orders');
        } else if (currentPath.includes('kanban')) {
          switchModule('kanban');
          switchTab('kanban');
        } else {
          if (currentUser.role === 'SUPERADMIN') {
            switchModule('tenant');
          } else {
            switchModule('kanban');
          }
        }

      } else {
        loginError.innerText = data.error || 'Credenciales inválidas';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.innerText = 'No pudimos conectarnos al servidor. Intentá de nuevo.';
      loginError.style.display = 'block';
    }
  });
});

// Apply strict domain/module isolation based on role
function applyRoleVisibility() {
  document.body.classList.remove('state-logged-out');
  document.body.classList.add('state-logged-in');
  if (!currentUser) return;
  const isSuperAdmin = currentUser.role === 'SUPERADMIN';

  const themeContainer = document.getElementById('headerThemeContainer');
  if (themeContainer) themeContainer.style.display = 'flex'; // el tema se elige en todos los modulos y se guarda en las preferencias del usuario
  const badge = document.getElementById('activeContextBadge');
  const userBadge = document.getElementById('userBadge');
  const mobActiveCtx = document.getElementById('mobileActiveContext');
  const footerTenant = document.getElementById('footerTenantStatus');

  const orgName = currentUser.tenantName || currentUser.tenantSlug || 'SUPERADMIN';
  // El nombre de la organizacion se muestra tal cual (el nombre de marca va en minuscula)
  if (badge) badge.innerText = orgName;
  if (mobActiveCtx) mobActiveCtx.innerText = orgName;

  const modTenant = document.getElementById('modTenant') || document.getElementById('modTenants');
  const modCore = document.getElementById('modCore');
  const modKanban = document.getElementById('modKanban') || document.getElementById('modScanBan');
  const mod4see = document.getElementById('mod4see');
    
  const mobModTenant = document.getElementById('mobModTenant') || document.getElementById('mobModTenants');
  const mobModCore = document.getElementById('mobModCore');
  const mobModKanban = document.getElementById('mobModKanban') || document.getElementById('mobModScanBan');
  const mobMod4see = document.getElementById('mobMod4see');
  
  if (isSuperAdmin) {
    // SUPERADMIN: Access strictly to HoloSpace Tenant & Core Platform
    if (modTenant) modTenant.style.display = 'inline-flex';
    if (modCore) modCore.style.display = 'inline-flex';
    if (modKanban) modKanban.style.display = 'none';
    if (mod4see) mod4see.style.display = 'inline-flex';
    
    if (themeContainer) themeContainer.style.display = 'flex';

    if (mobModTenant) mobModTenant.style.display = 'block';
    if (mobModCore) mobModCore.style.display = 'block';
    if (mobModKanban) mobModKanban.style.display = 'none';
    if (mobMod4see) mobMod4see.style.display = 'block';

    const displaySuperUser = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'superadmin');
    if (userBadge) {
      userBadge.innerHTML = `<span class="badge-user-name">${displaySuperUser}</span><span style="font-size:9px; opacity:0.7; margin-left:2px;">▾</span>`;
      userBadge.title = `${displaySuperUser} (SUPERADMIN)`;
      userBadge.style.background = 'var(--hw-violet-soft)';
      userBadge.style.color = 'var(--cobalt)';
      userBadge.style.borderColor = 'var(--cobalt)';
    }

    const dropName = document.getElementById('dropdownUserName');
    const dropRoleBadge = document.getElementById('dropdownUserRoleBadge');
    const dropEmail = document.getElementById('dropdownUserEmail');
    const dropOrg = document.getElementById('dropdownUserOrg');
    if (dropName) dropName.innerText = currentUser.name ? `${currentUser.name} (@${displaySuperUser})` : displaySuperUser;
    if (dropRoleBadge) {
      dropRoleBadge.innerText = 'SUPERADMIN';
      dropRoleBadge.style.background = 'var(--hw-violet-soft)';
      dropRoleBadge.style.color = 'var(--cobalt)';
      dropRoleBadge.style.border = '1px solid var(--cobalt)';
    }
    if (dropEmail) dropEmail.innerText = currentUser.email || '';
    if (dropOrg) dropOrg.innerHTML = `Empresa: ${BRAND_HTML} (administración)`;

    if (footerTenant) {
      footerTenant.innerHTML = `Empresa: ${BRAND_HTML} (administración)`;
    }

    const path = window.location.pathname.toLowerCase();
    if (path.includes('core')) {
      switchModule('core');
    } else if (path.includes('4see')) {
      switchModule('4see');
    } else {
      switchModule('tenant');
    }
  } else {
    // ADMIN / OPERATOR: Access to licensed operational modules (Kanban Board, 4see, QR Connection)
    if (modTenant) modTenant.style.display = 'none';
    if (modCore) modCore.style.display = 'none';
    const access = getAccess() || { modules: {}, defaultModule: null };
    if (modKanban) modKanban.style.display = access.modules.kanban ? 'inline-flex' : 'none';
    if (mod4see) mod4see.style.display = access.modules['4see'] ? 'inline-flex' : 'none';


    if (mobModTenant) mobModTenant.style.display = 'none';
    if (mobModCore) mobModCore.style.display = 'none';
    if (mobModKanban) mobModKanban.style.display = access.modules.kanban ? 'block' : 'none';
    if (mobMod4see) mobMod4see.style.display = access.modules['4see'] ? 'block' : 'none';

    const orgName = currentUser.tenantSlug ? currentUser.tenantSlug.toUpperCase() : 'KANBAN';
    const displayUser = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'usuario');

    if (userBadge) {
      userBadge.innerHTML = `<span class="badge-user-name">${displayUser}</span><span style="font-size:9px; opacity:0.7; margin-left:2px;">▾</span>`;
      userBadge.title = `${displayUser} (${currentUser.role})`;
      userBadge.style.background = 'var(--hw-accent-soft)';
      userBadge.style.color = 'var(--emerald)';
      userBadge.style.borderColor = 'var(--emerald)';
    }

    const dropName = document.getElementById('dropdownUserName');
    const dropRoleBadge = document.getElementById('dropdownUserRoleBadge');
    const dropEmail = document.getElementById('dropdownUserEmail');
    const dropOrg = document.getElementById('dropdownUserOrg');
    if (dropName) dropName.innerText = currentUser.name ? `${currentUser.name} (@${displayUser})` : displayUser;
    if (dropRoleBadge) {
      dropRoleBadge.innerText = currentUser.role || 'OPERATOR';
      dropRoleBadge.style.background = 'var(--hw-accent-soft)';
      dropRoleBadge.style.color = 'var(--emerald)';
      dropRoleBadge.style.border = '1px solid var(--emerald)';
    }
    if (dropEmail) dropEmail.innerText = currentUser.email || '';
    if (dropOrg) dropOrg.innerText = `Empresa: ${currentUser.tenantName || orgName}`;

    if (footerTenant) {
      footerTenant.innerText = `Empresa: ${currentUser.tenantName || orgName}`;
    }

    // Modulo de entrada: el pedido por URL si esta permitido; si no, el primero disponible (nunca uno ajeno)
    const path = window.location.pathname.toLowerCase();
    const wanted = path.includes('tenant') ? 'tenant'
      : path.includes('core') ? 'core'
      : path.includes('4see') ? '4see'
      : (path.includes('orders') || path.includes('kanban') || path.includes('scanban')) ? 'kanban'
      : null;
    const goForbidden = (mod) => {
      showForbiddenView(mod);
      if (window.history && window.history.replaceState) window.history.replaceState({ module: mod }, '', '/' + mod);
    };
    if (wanted === 'tenant' || wanted === 'core') {
      goForbidden(wanted);
    } else if (wanted && !access.modules[wanted]) {
      goForbidden(wanted);
    } else if (wanted === 'kanban' && path.includes('orders')) {
      switchModule('kanban');
      switchTab('orders');
    } else if (wanted) {
      switchModule(wanted);
    } else if (access.defaultModule) {
      switchModule(access.defaultModule);
    } else {
      goForbidden('none');
    }
  }
}

function showForbiddenView(moduleName) {
  ['viewTenants', 'viewKanban', 'viewUsers', 'viewRoles', 'viewOrders', 'viewPlatform', 'view4seeProductos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const view = document.getElementById('viewForbidden');
  if (view) view.classList.remove('hidden');

  const titleEl = document.getElementById('forbiddenModuleTitle');
  const descEl = document.getElementById('forbiddenModuleDesc');
  const userEl = document.getElementById('forbiddenUserDisplay');
  const roleEl = document.getElementById('forbiddenRoleDisplay');
  const tenantEl = document.getElementById('forbiddenTenantDisplay');

  const modTitles = {
    tenant: 'Empresas clientes (administración de la plataforma)',
    core: 'Plataforma (usuarios, roles y actividad)',
    kanban: 'Logística (pedidos y escáner)',
    '4see': '4see (precios de tu tienda online)',
    none: 'Sin módulos habilitados'
  };

  if (titleEl) titleEl.innerText = modTitles[moduleName] || `Sección ${moduleName}`;
  if (descEl) {
    if (moduleName === 'none') {
      descEl.innerText = 'Tu rol no tiene secciones habilitadas en el plan de tu empresa. Pedile a un administrador que revise tus permisos.';
    } else if (moduleName === 'tenant' || moduleName === 'core') {
      descEl.innerHTML = `Esta sección es solo para el administrador de ${BRAND_HTML}. Tu cuenta no tiene acceso.`;
    } else {
      descEl.innerText = 'Esta sección no está incluida en el plan de tu empresa o tu rol no puede usarla. Consultá con un administrador.';
    }
  }

  const displayUser = (currentUser && (currentUser.username || currentUser.name)) || (currentUser && currentUser.email) || 'Usuario';
  if (userEl) userEl.innerText = displayUser;
  if (roleEl) roleEl.innerText = (currentUser && currentUser.role) || 'OPERATOR';
  if (tenantEl) tenantEl.innerText = (currentUser && (currentUser.tenantName || currentUser.tenantSlug)) || 'holospace.';
}

function redirectAllowedModule() {
  if (!currentUser) {
    logout();
    return;
  }
  if (currentUser.role === 'SUPERADMIN') {
    switchModule('tenant');
  } else {
    switchModule('kanban');
  }
}

// Acceso a modulos y pestanas segun plan (entitlements) y permisos del JWT; ver public/access.js
function getAccess() {
  if (!currentUser || typeof HSAccess === 'undefined') return null;
  return HSAccess.computeAccess(currentUser, HSAccess.decodeClaims(getAuthToken()));
}

const TAB_ELEMENT_SUFFIX = {
  tenants: 'Tenants', platform: 'Platform', users: 'Users', roles: 'Roles', kanban: 'Kanban', orders: 'Orders',
  '4see-productos': '4seeProductos'
};

// Oculta del menu (escritorio y movil) las pestanas que la sesion no puede usar
function applyTabAccess() {
  const access = getAccess();
  if (!access) return;
  Object.keys(TAB_ELEMENT_SUFFIX).forEach((key) => {
    if (access.tabs[key]) return;
    ['tab', 'mobTab'].forEach((prefix) => {
      const el = document.getElementById(prefix + TAB_ELEMENT_SUFFIX[key]);
      if (el) el.style.display = 'none';
    });
  });
}

function setModuleFavicon(mod) {
  const map = { '4see': '/brand/4see.svg', kanban: '/brand/logistica.svg', scanner: '/brand/logistica.svg' };
  let link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  link.href = map[mod] || '/brand/mark.svg';
}

// Controles que solo aplican a las aplicaciones operativas (Kanban y Scanner): p. ej. "Conectar Celular".
function updateOpsOnlyControls(moduleName) {
  const show = moduleName === 'kanban' || moduleName === 'scanner';
  document.querySelectorAll('[data-ops-only]').forEach(el => { el.style.display = show ? '' : 'none'; });
}

function switchModule(moduleName, updateUrl = true) {
  const normMod = (moduleName === 'tenants' ? 'tenant' : (moduleName === 'scanban' ? 'kanban' : moduleName));
  document.body.dataset.module = (normMod === 'tenant' || normMod === 'core') ? 'platform' : normMod;

  // Control estricto de acceso y segregación de responsabilidades (RBAC):
  // 1. Tenant y Core son exclusivos para SUPERADMIN
  if ((normMod === 'tenant' || normMod === 'core') && (!currentUser || currentUser.role !== 'SUPERADMIN')) {
    console.warn(`[SECURITY] Acceso denegado a módulo ${normMod} para usuario ${currentUser ? currentUser.email : 'anónimo'}`);
    if (updateUrl && window.history && window.history.pushState) {
      window.history.pushState({ module: normMod }, '', '/' + normMod);
    }
    showForbiddenView(normMod);
    return;
  }

  // 2. SUPERADMIN NO tiene acceso a los módulos operativos de los clientes (Kanban, Scanner)
  if ((normMod === 'kanban' || normMod === 'scanner') && (currentUser && currentUser.role === 'SUPERADMIN')) {
    console.warn(`[SECURITY] SUPERADMIN no puede operar en módulo de cliente: ${normMod}`);
    if (updateUrl && window.history && window.history.pushState) {
      window.history.pushState({ module: 'tenant' }, '', '/tenant');
    }
    showForbiddenView(normMod);
    return;
  }

  setModuleFavicon(normMod);
  updateOpsOnlyControls(normMod);

  // 1. Ocultar vista de acceso denegado si estaba visible
  const forbidView = document.getElementById('viewForbidden');
  if (forbidView) forbidView.classList.add('hidden');

  // 2. Ocultar todas las features (Tabs)
  document.querySelectorAll('.feature-tenant, .feature-tenants, .feature-core, .feature-kanban, .feature-scanban, .feature-scanner, .feature-4see').forEach(el => {
    el.style.display = 'none';
  });

  // 3. Mostrar las features del módulo seleccionado
  document.querySelectorAll('.nav-tab.feature-' + normMod + ', .nav-tab.feature-' + moduleName).forEach(el => el.style.display = 'inline-flex');
  document.querySelectorAll('.mobile-nav-tab.feature-' + normMod + ', .mobile-nav-tab.feature-' + moduleName).forEach(el => el.style.display = 'block');

  applyTabAccess();

  // 4. Marcar módulo activo con mapeo exacto de IDs
  const desktopModMap = { tenant: 'modTenant', tenants: 'modTenant', core: 'modCore', kanban: 'modKanban', scanban: 'modKanban', scanner: 'modScanner', '4see': 'mod4see' };
  const mobileModMap = { tenant: 'mobModTenant', tenants: 'mobModTenant', core: 'mobModCore', kanban: 'mobModKanban', scanban: 'mobModKanban', scanner: 'mobModScanner', '4see': 'mobMod4see' };

  document.querySelectorAll('.module-tab').forEach(el => el.classList.remove('active'));
  const dMod = document.getElementById(desktopModMap[normMod]);
  const mMod = document.getElementById(mobileModMap[normMod]);
  if (dMod) dMod.classList.add('active');
  if (mMod) mMod.classList.add('active');

  // 5. Actualizar URL amigable en navegador
  if (updateUrl && window.history && window.history.pushState) {
    const targetUrl = '/' + normMod;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ module: normMod }, '', targetUrl);
    }
  }

  // 6. Seleccionar la feature por defecto
  if (normMod === 'tenant') {
    switchTab('tenants');
  } else if (normMod === 'core') {
    switchTab('platform');
  } else if (normMod === 'kanban' || normMod === '4see') {
    const access = getAccess();
    const entryTab = access && typeof HSAccess !== 'undefined' ? HSAccess.firstTab(access, normMod) : null;
    switchTab(entryTab || (normMod === 'kanban' ? 'kanban' : '4see-productos'));
  } else if (normMod === 'scanner') {
    switchTab('scanner');
  }
}


// CONTROL DEL MENÚ LATERAL MÓVIL (DRAWER)
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  if (drawer && overlay) {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      overlay.classList.add('hidden');
    } else {
      drawer.classList.add('open');
      overlay.classList.remove('hidden');
    }
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.add('hidden');
}

function switchTabMobile(tabName) {
  closeMobileDrawer();
  switchTab(tabName);
}

// NAVEGACIÓN POR PESTAÑAS (FUNCIONALIDADES INTERNAS)
function switchTab(tabName) {
  // Limpiar clase activa de todos los feature tabs
  ['tabTenants', 'tabKanban', 'tabUsers', 'tabRoles', 'tabOrders', 'tabPlatform', 'tabScanner', 'tab4seeProductos',
   'mobTabTenants', 'mobTabKanban', 'mobTabUsers', 'mobTabRoles', 'mobTabOrders', 'mobTabPlatform', 'mobTabScanner', 'mobTab4seeProductos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  // Activar tab seleccionado
  let tabId = '';
  let mobTabId = '';
  if (tabName === '4see-productos') {
    tabId = 'tab4seeProductos';
    mobTabId = 'mobTab4seeProductos';
  } else {
    tabId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    mobTabId = 'mobTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  }

  const el = document.getElementById(tabId);
  const mobEl = document.getElementById(mobTabId);
  if (el) el.classList.add('active');
  if (mobEl) mobEl.classList.add('active');

  // Asegurarnos de que el módulo padre también esté activo
  let parentModule = '';
  if (tabName === 'tenants') parentModule = 'tenant';
  if (tabName === 'platform' || tabName === 'users' || tabName === 'roles') parentModule = 'core';
  if (tabName === 'kanban' || tabName === 'orders') parentModule = 'kanban';
  if (tabName === 'scanner') parentModule = 'scanner';
  if (tabName.startsWith('4see')) parentModule = '4see';
  
  if (parentModule) updateOpsOnlyControls(parentModule);
  if (parentModule) {
    const desktopModMap = { tenant: 'modTenant', tenants: 'modTenant', core: 'modCore', kanban: 'modKanban', scanban: 'modKanban', scanner: 'modScanner', '4see': 'mod4see' };
    const mobileModMap = { tenant: 'mobModTenant', tenants: 'mobModTenant', core: 'mobModCore', kanban: 'mobModKanban', scanban: 'mobModKanban', scanner: 'mobModScanner', '4see': 'mobMod4see' };

    document.querySelectorAll('.module-tab').forEach(m => m.classList.remove('active'));
    const dMod = document.getElementById(desktopModMap[parentModule]);
    const mMod = document.getElementById(mobileModMap[parentModule]);
    if (dMod) dMod.classList.add('active');
    if (mMod) mMod.classList.add('active');
  }

  // Detener polling de kanban si salimos del tab
  if (tabName !== 'kanban' && kanbanAutoRefreshInterval) {
    clearInterval(kanbanAutoRefreshInterval);
    kanbanAutoRefreshInterval = null;
  }

  ['viewTenants', 'viewKanban', 'viewUsers', 'viewRoles', 'viewOrders', 'viewPlatform', 'view4seeProductos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (tabName === 'tenants') {
    const tab = document.getElementById('tabTenants');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabTenants');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewTenants');
    if (view) view.classList.remove('hidden');
    loadTenantsManagementData();
  } else if (tabName === '4see-productos') {
    const view = document.getElementById('view4seeProductos');
    if (view) view.classList.remove('hidden');
    if (!flowIntroSeen()) openFlowIntro();
    applyFlowStep();
    Promise.allSettled([load4seeMonitors(), load4seeSmartPriceQueue(), renderRulesList()]).then(paintFlow);
  } else if (tabName === 'kanban') {
    const tab = document.getElementById('tabKanban');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabKanban');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewKanban');
    if (view) view.classList.remove('hidden');
    loadKanbanData();
    // Auto-refresco en tiempo real cada 3 segundos constante
    if (!kanbanAutoRefreshInterval) {
      kanbanAutoRefreshInterval = setInterval(() => {
        const kanbanView = document.getElementById('viewKanban');
        if (kanbanView && !kanbanView.classList.contains('hidden')) {
          loadKanbanData();
        }
      }, 3000);
    }
  } else if (tabName === 'orders') {
    const tab = document.getElementById('tabOrders');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabOrders');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewOrders');
    if (view) view.classList.remove('hidden');
    renderOperatorPills();
    fetchExplorerOrders();
  } else if (tabName === 'scanner') {
    openQrModal();
  } else if (tabName === 'users') {
    const tab = document.getElementById('tabUsers');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabUsers');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewUsers');
    if (view) view.classList.remove('hidden');
    fetchUsers();
  } else if (tabName === 'roles') {
    const tab = document.getElementById('tabRoles');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabRoles');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewRoles');
    if (view) view.classList.remove('hidden');
    fetchRolesManagementData();
  } else if (tabName === 'platform') {
    const platformTab = document.getElementById('tabPlatform');
    if (platformTab) platformTab.classList.add('active');
    const mobTab = document.getElementById('mobTabPlatform');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewPlatform');
    if (view) view.classList.remove('hidden');
    loadPlatformPanel();
  }
}

// Soporte de navegación adelante/atrás del navegador (popstate)
window.addEventListener('popstate', (e) => {
  const path = window.location.pathname.replace('/', '').toLowerCase();
  if (['tenant', 'tenants', 'core', 'kanban', 'scanner', '4see'].includes(path)) {
    switchModule(path, false);
  }
});

// SISTEMA DE DIÁLOGOS PERSONALIZADOS (CERO ALERT Y CONFIRM DE SISTEMA)
function showCustomAlert(title, message) {
  return new Promise((resolve) => {
    document.getElementById('dialogTitle').innerText = title;
    document.getElementById('dialogMessage').innerText = message;
    document.getElementById('dialogCancelBtn').style.display = 'none';
    document.getElementById('dialogConfirmBtn').innerText = 'Aceptar';
    document.getElementById('customDialogModal').classList.remove('hidden');
    customDialogResolver = resolve;
  });
}

function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    document.getElementById('dialogTitle').innerText = title;
    document.getElementById('dialogMessage').innerText = message;
    document.getElementById('dialogCancelBtn').style.display = 'inline-block';
    document.getElementById('dialogConfirmBtn').innerText = 'Confirmar';
    document.getElementById('customDialogModal').classList.remove('hidden');
    customDialogResolver = resolve;
  });
}

function closeCustomDialog(result) {
  document.getElementById('customDialogModal').classList.add('hidden');
  if (customDialogResolver) {
    customDialogResolver(result);
    customDialogResolver = null;
  }
}

function toggleUserGroup(groupId) {
  if (collapsedUserGroups.has(groupId)) {
    collapsedUserGroups.delete(groupId);
  } else {
    collapsedUserGroups.add(groupId);
  }
  loadKanbanData();
}

// KANBAN EN TIEMPO REAL CON 4 COLUMNAS Y SUB-GRUPOS COLAPSABLES POR USUARIO
async function loadKanbanData() {
  try {
    loadActiveTheme();
    const token = getAuthToken() || '';
    const res = await fetch('/api/scanban/kanban', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();

    // 1. Render Backlog (Gris - Draggable hacia LISTO)
    const backlogList = document.getElementById('backlogList');
    document.getElementById('backlogCount').innerText = (data.backlog || []).length;
    backlogList.innerHTML = (!data.backlog || data.backlog.length === 0)
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">No hay remitos nuevos. Cargá un PDF arriba para empezar.</div>'
      : data.backlog.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--card-border); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
          <button class="btn-delete-card" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px; border-color: color-mix(in srgb, var(--red) 40%, transparent); color: var(--red);" onclick="deleteBacklogOrder('${item.id}', event)">Eliminar</button>
          <div class="card-order-no" style="color: var(--text-muted);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
          <div class="card-meta">Pedido: <strong>#${item.orderNumber}</strong></div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta">Archivo: ${item.fileName}</div>
          <button class="btn-primary" style="margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 800; cursor: pointer;" onclick="markOrderReady('${item.id}', event)">
            Revisado, pasar a Listos
          </button>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Hacé clic o arrastrá la tarjeta a Listos para preparar cuando esté revisada</div>
        </div>
      `).join('');

    // 2. Render Ready (Verde - Draggable hacia BACKLOG o EN PROCESO)
    const readyList = document.getElementById('readyList');
    document.getElementById('readyCount').innerText = (data.ready || []).length;
    readyList.innerHTML = (!data.ready || data.ready.length === 0)
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Ningún pedido listo para preparar</div>'
      : data.ready.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--emerald); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
          <button class="btn-secondary" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px;" onclick="markOrderBacklog('${item.id}', event)">Volver a Nuevos</button>
          <div class="card-order-no" style="color: var(--emerald);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
          <div class="card-meta">Pedido: <strong>#${item.orderNumber}</strong></div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta" style="color: var(--emerald); font-weight: 800; font-size: 12px;">Listo para que un operario lo tome con el celular</div>
          ${currentUser && currentUser.role === 'ADMIN' ? `
            <button class="btn-primary" style="background: var(--emerald); color: var(--hw-accent-fg); margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 900; cursor: pointer;" onclick="openAssignOperatorModal('${item.id}', '${item.orderNumber}', event)">
              Asignar a Operario
            </button>
          ` : ''}
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Arrastralo a Nuevos, o a En preparación para asignarlo</div>
        </div>
      `).join('');

    // 3. Render Doing por Usuario (Acordeón colapsable)
    const doingList = document.getElementById('doingList');
    document.getElementById('doingCount').innerText = (data.doing || []).length;
    
    if (!data.doing || data.doing.length === 0) {
      doingList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Ningún pedido en preparación</div>';
    } else {
      const doingGroups = {};
      data.doing.forEach(item => {
        const userKey = item.operatorEmail || 'Sin Asignar';
        if (!doingGroups[userKey]) doingGroups[userKey] = [];
        doingGroups[userKey].push(item);
      });

      doingList.innerHTML = Object.keys(doingGroups).map(email => {
        const groupId = `doing-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const isCollapsed = collapsedUserGroups.has(groupId);
        const userOrders = doingGroups[email];

        const cardsHtml = userOrders.map(item => `
          <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--cobalt); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
            <div class="card-order-no" style="color: var(--cobalt);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
            <div class="card-meta">Pedido: <strong>#${item.orderNumber}</strong></div>
            <div class="card-meta" style="color: var(--text-main); font-weight: 700;">Cliente: ${item.clientName}</div>
            <div class="card-meta">Avance: ${item.scannedItems} / ${item.totalItems} U (${item.progressPercentage}%)</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${item.progressPercentage}%;"></div>
            </div>
            ${currentUser && currentUser.role === 'ADMIN' ? `
              <button class="btn-action" style="background: var(--hw-info-soft); color: var(--hw-info); border: 1px solid var(--hw-info); margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 700; cursor: pointer;" onclick="resetOrderDoingToReady('${item.id}', '${item.orderNumber}', event)">
                Liberar y volver a asignar
              </button>
            ` : ''}
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Arrastralo a Listos para preparar para liberarlo</div>
          </div>
        `).join('');

        return `
          <div class="user-group">
            <div class="user-group-header" onclick="toggleUserGroup('${groupId}')">
              <span>Operario: ${email} (${userOrders.length})</span>
              <span>${isCollapsed ? '[+]' : '[-]'}</span>
            </div>
            ${!isCollapsed ? `<div class="user-group-body">${cardsHtml}</div>` : ''}
          </div>
        `;
      }).join('');
    }

    // 4. Render Done por Usuario (Acordeón colapsable)
    const doneList = document.getElementById('doneList');
    document.getElementById('doneCount').innerText = (data.done || []).length;

    if (!data.done || data.done.length === 0) {
      doneList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Todavía no hay pedidos completados</div>';
    } else {
      const doneGroups = {};
      data.done.forEach(item => {
        const userKey = item.operatorEmail || 'Sin Asignar';
        if (!doneGroups[userKey]) doneGroups[userKey] = [];
        doneGroups[userKey].push(item);
      });

      doneList.innerHTML = Object.keys(doneGroups).map(email => {
        const groupId = `done-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const isCollapsed = collapsedUserGroups.has(groupId);
        const userOrders = doneGroups[email];

        const cardsHtml = userOrders.map(item => `
          <div class="kanban-card" style="border-color: var(--amber);" onclick="openInvoiceModal('${item.id}')">
            <div class="card-order-no" style="color: var(--amber);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
            <div class="card-meta">Pedido: <strong>#${item.orderNumber}</strong></div>
            <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
            <div class="card-meta" style="font-size: 11px; color: var(--emerald);">${item.auditStamp}</div>
          </div>
        `).join('');

        return `
          <div class="user-group">
            <div class="user-group-header" onclick="toggleUserGroup('${groupId}')">
              <span>Auditado por: ${email} (${userOrders.length})</span>
              <span>${isCollapsed ? '[+]' : '[-]'}</span>
            </div>
            ${!isCollapsed ? `<div class="user-group-body">${cardsHtml}</div>` : ''}
          </div>
        `;
      }).join('');
    }

  } catch (e) {
    console.error('Error cargando Kanban:', e);
  }
}

// FUNCIONES PARA PASAR ENTRE BACKLOG Y LISTO (READY)
async function markOrderReady(orderId, event) {
  if (event) event.stopPropagation();

  try {
    const res = await fetch('/api/scanban/mark-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        userEmail: currentUser ? currentUser.email : ''
      })
    });
    const data = await res.json();
    if (data.success) {
      loadKanbanData();
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No pudimos pasar el pedido a Listos para preparar.');
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function markOrderBacklog(orderId, event) {
  if (event) event.stopPropagation();

  try {
    const res = await fetch('/api/scanban/mark-backlog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        userEmail: currentUser ? currentUser.email : ''
      })
    });
    const data = await res.json();
    if (data.success) {
      loadKanbanData();
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No pudimos devolver el pedido a Nuevos.');
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}


async function resetOrderDoingToReady(orderId, orderNumber, event) {
  if (event) event.stopPropagation();

  try {
    const token = getAuthToken() || '';
    const res = await fetch('/api/scanban/release-order-admin', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        orderId,
        orderNumber,
        userEmail: currentUser ? currentUser.email : ''
      })
    });
    const data = await res.json();
    if (data.success) {
      loadKanbanData();
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No pudimos reasignar el pedido.');
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function resetOrderDoingToReadyAndCloseModal(orderId, orderNumber) {
  closeInvoiceModal();
  await resetOrderDoingToReady(orderId, orderNumber);
}


let pendingAssignOrderId = null;
let pendingAssignOrderNumber = null;

async function openAssignOperatorModal(orderId, orderNumber, event) {
  if (event) event.stopPropagation();

  pendingAssignOrderId = orderId;
  pendingAssignOrderNumber = orderNumber;

  const titleEl = document.getElementById('assignOrderTitleText');
  if (titleEl) titleEl.innerText = `Pedido #${orderNumber}`;

  const selectEl = document.getElementById('operatorSelectModal');
  if (selectEl) {
    selectEl.innerHTML = '<option value="">Cargando operarios...</option>';
    try {
      const token = getAuthToken() || '';
      const activeTenantId = localStorage.getItem('hs_tenant_id') || '';
      const url = activeTenantId ? `/api/users?tenantId=${encodeURIComponent(activeTenantId)}` : '/api/users';
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      const userList = Array.isArray(data) ? data : (data.users || []);
      const activeUsers = userList.filter(u => u.active !== 0 && u.active !== false && ['OPERATOR', 'SCANNER_OPERATOR', 'KANBAN_OPERATOR'].includes((u.role || '').toUpperCase()));
      if (activeUsers.length > 0) {
        selectEl.innerHTML = activeUsers.map(u => `
          <option value="${u.email}">${u.name} (@${u.username || u.email.split('@')[0]})</option>
        `).join('');
      } else {
        selectEl.innerHTML = '<option value="">Todavía no hay operarios. Agregalos en Usuarios.</option>';
      }
    } catch (e) {
      console.error('No pudimos cargar los operarios para asignación:', e);
      selectEl.innerHTML = '<option value="">No pudimos cargar los operarios</option>';
    }
  }

  document.getElementById('assignOperatorModal').classList.remove('hidden');
}

function closeAssignOperatorModal() {
  document.getElementById('assignOperatorModal').classList.add('hidden');
  pendingAssignOrderId = null;
  pendingAssignOrderNumber = null;
}

async function confirmAssignOperatorSubmit() {
  const selectEl = document.getElementById('operatorSelectModal');
  const selectedOperator = selectEl ? selectEl.value : '';

  if (!selectedOperator) {
    await showCustomAlert('Falta elegir', 'Elegí un operario para asignarle el pedido.');
    return;
  }

  try {
    const token = getAuthToken() || '';
    const res = await fetch('/api/scanban/assign-order', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        orderId: pendingAssignOrderId,
        orderNumber: pendingAssignOrderNumber,
        operatorEmail: selectedOperator,
        userEmail: currentUser ? currentUser.email : ''
      })
    });
    const data = await res.json();

    closeAssignOperatorModal();

    if (data.success) {
      loadKanbanData();
    } else {
      await showCustomAlert('No se pudo hacer', data.error || 'No pudimos asignar el pedido.');
    }
  } catch (e) {
    closeAssignOperatorModal();
    await showCustomAlert('Sin conexión', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

// MANEJADORES DE DRAG AND DROP (ARRASTRAR DE BACKLOG A LISTO Y EN PROCESO)
function handleDragStart(event, orderId) {
  event.dataTransfer.setData('text/plain', String(orderId));
  event.dataTransfer.effectAllowed = 'move';
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

async function handleDropToListo(event) {
  event.preventDefault();
  const orderId = event.dataTransfer.getData('text/plain');
  if (orderId) {
    try {
      const res = await fetch(`/api/scanban/order-detail?id=${orderId}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      const data = await res.json();
      if (data.success && data.order && (data.order.status === 'DOING' || data.order.status === 'SCANNING')) {
        await resetOrderDoingToReady(data.order.id, data.order.orderNumber, event);
        return;
      }
    } catch (e) {}

    await markOrderReady(orderId, event);
  }
}

async function handleDropToBacklog(event) {
  event.preventDefault();
  const orderId = event.dataTransfer.getData('text/plain');
  if (orderId) {
    await markOrderBacklog(orderId, event);
  }
}

async function handleDropToDoing(event) {
  event.preventDefault();
  const orderId = event.dataTransfer.getData('text/plain');
  if (orderId) {
    try {
      const res = await fetch(`/api/scanban/order-detail?id=${orderId}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      const data = await res.json();
      if (data.success && data.order) {
        await openAssignOperatorModal(data.order.id, data.order.orderNumber, event);
      }
    } catch (e) {}
  }
}

async function markOrderReadyAndCloseModal(orderId) {
  closeInvoiceModal();
  await markOrderReady(orderId);
}

async function markOrderBacklogAndCloseModal(orderId) {
  closeInvoiceModal();
  await markOrderBacklog(orderId);
}


// DETALLE COMPLETO DE COMPROBANTE Y MARCA DE AGUA
async function openInvoiceModal(orderId) {
  try {
    const res = await fetch(`/api/scanban/order-detail?id=${orderId}`, {
      headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
    });
    const data = await res.json();
    if (!data.success || !data.order) {
      await showCustomAlert('Error', 'No pudimos cargar el detalle del pedido.');
      return;
    }

    const order = data.order;
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">${item.code}</td>
        <td>${item.description}</td>
        <td style="text-align: center;">${HSFormat.moneyHtml((item.unitPrice || 0))}</td>
        <td style="text-align: center; font-weight: 900;">${item.quantityScanned} / ${item.quantityRequired} U</td>
        <td style="text-align: right; font-weight: 900; color: var(--emerald);">${HSFormat.moneyHtml(((item.unitPrice || 0) * item.quantityRequired))}</td>
      </tr>
    `).join('');

    const totalCalculated = order.items.reduce((acc, i) => acc + (i.unitPrice || 0) * i.quantityRequired, 0);

    const logsHtml = (order.auditLogs || []).map(log => `
      <div style="background: var(--hw-surface-1, var(--card-bg)); border: 1px solid color-mix(in srgb, var(--cobalt) 40%, transparent); padding: 10px 14px; border-radius: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span style="color: var(--emerald);">${log.userEmail}</span>
          <span style="color: var(--text-muted); font-size: 11px;">${log.timestamp}</span>
        </div>
        <div style="color: var(--text-main);">${log.details}</div>
      </div>
    `).join('');

    const statusLabelEs = order.status === 'READY' ? 'LISTO PARA PREPARAR' : order.status === 'DOING' || order.status === 'SCANNING' ? 'EN PREPARACIÓN' : order.status === 'DONE' ? 'COMPLETADO' : 'NUEVO';

    const statusActionButton = order.status === 'BACKLOG'
      ? `<button class="btn-primary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px; background-color: var(--emerald); color: var(--hw-accent-fg); font-weight: 900;" onclick="markOrderReadyAndCloseModal('${order.id}')">REVISADO: PASAR A LISTOS PARA PREPARAR</button>`
      : order.status === 'READY'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px;" onclick="markOrderBacklogAndCloseModal('${order.id}')">VOLVER A NUEVOS</button>`
      : (order.status === 'DOING' || order.status === 'SCANNING') && currentUser && currentUser.role === 'ADMIN'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px; border-color: var(--cobalt); color: var(--hw-info); font-weight: 800;" onclick="resetOrderDoingToReadyAndCloseModal('${order.id}', '${order.orderNumber}')">LIBERAR Y VOLVER A ASIGNAR</button>`
      : '';

    const invoiceHtml = `
      <div class="invoice-card" style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Sección 1: Información del Comprobante y Emisor (Colapsable, cerrada por defecto) -->
        <details style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 14px 18px;">
          <summary style="font-weight: 800; font-size: 14px; cursor: pointer; color: var(--text-main); display: flex; justify-content: space-between; align-items: center;">
            <span>Información del Comprobante #${order.orderNumber}</span>
            <span style="font-size: 12px; color: var(--emerald); font-weight: 800;">[ ${statusLabelEs} ]</span>
          </summary>
          <div style="margin-top: 14px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--card-border); padding-top: 14px;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted);">EMITIDO POR: <strong>${order.vendorName || 'WYPRA SA'}</strong> (CUIT: ${order.vendorCuit || '30-71828749-5'})</div>
              <div style="font-size: 18px; font-weight: 900; color: var(--emerald); margin-top: 4px;">COMPROBANTE #${order.orderNumber}</div>
              <div style="font-size: 14px; margin-top: 4px;">Cliente: <strong>${order.clientName}</strong> ${order.contactPerson ? `(${order.contactPerson})` : ''}</div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="font-size: 13px; color: var(--text-muted);">Fecha de Emisión: ${order.issueDate || '—'}</div>
              <div style="font-size: 13px; color: var(--cobalt); font-weight: 800; margin-top: 4px;">ESTADO: ${statusLabelEs}</div>
              <div style="font-size: 12px; color: var(--amber); margin-top: 2px;">Usuario Asignado: ${(order.operatorEmail && order.operatorEmail !== 'null') ? order.operatorEmail : 'Ninguno'}</div>
              <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                <button class="btn-secondary" style="font-size: 13px; padding: 6px 12px;" onclick="downloadPdf('${order.id}')">Descargar PDF</button>
                ${statusActionButton}
              </div>
            </div>
          </div>
        </details>

        <!-- Sección 2: Artículos del Comprobante (Colapsable, ABIERTA POR DEFECTO) -->
        <details open style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 14px 18px;">
          <summary style="font-weight: 800; font-size: 14px; cursor: pointer; color: var(--emerald); display: flex; justify-content: space-between; align-items: center;">
            <span>Artículos del Comprobante (${order.items.length} Ítems)</span>
            <span style="font-weight: 900; font-size: 14px; color: var(--emerald);">Total: ${HSFormat.moneyHtml(totalCalculated)}</span>
          </summary>
          <div style="margin-top: 14px; border-top: 1px solid var(--card-border); padding-top: 14px; overflow-x: auto;">
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Código de barras</th>
                  <th>Producto</th>
                  <th style="text-align: center;">Precio unitario</th>
                  <th style="text-align: center;">Escaneado</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 900; font-size: 15px;">TOTAL DEL REMITO:</td>
                  <td style="text-align: right; font-weight: 900; font-size: 17px; color: var(--emerald);">${HSFormat.moneyHtml(totalCalculated)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>

        <!-- Sección 3: Historial de Auditoría y Línea de Tiempo (Colapsable, cerrada por defecto) -->
        <details style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 14px 18px;">
          <summary style="font-weight: 800; font-size: 14px; cursor: pointer; color: var(--cobalt);">
            Línea de Tiempo y Auditoría por Usuario (${(order.auditLogs || []).length} Eventos)
          </summary>
          <div style="margin-top: 14px; border-top: 1px solid var(--card-border); padding-top: 14px; display: flex; flex-direction: column; gap: 8px;">
            ${logsHtml}
          </div>
        </details>
      </div>
    `;

    document.getElementById('invoiceModalBody').innerHTML = invoiceHtml;
    document.getElementById('invoiceModal').classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.add('hidden');
}

function downloadPdf(orderId) {
  window.open(`/api/scanban/download-pdf?id=${orderId}`, '_blank');
}

// MODAL DE DIAGNÓSTICO Y CHECKLIST VISUAL DE SUBIDA DE PDF (3 PASOS)
function showUploadDiagnosticsModal(result, fileName) {
  return new Promise((resolve) => {
    const isSuccess = !!result.success;
    const checklist = result.checklist || {};
    const titleElem = document.getElementById('dialogTitle');
    const msgElem = document.getElementById('dialogMessage');

    titleElem.innerText = isSuccess ? 'Comprobante Ingerido con Éxito' : 'Revisión del remito cargado';
    titleElem.style.color = isSuccess ? 'var(--emerald)' : 'var(--red)';

    const step1 = checklist.step1_integrity || { passed: isSuccess, title: 'El archivo PDF está completo', details: isSuccess ? 'El archivo se pudo abrir.' : 'No pudimos abrir el archivo PDF.' };
    const step2 = checklist.step2_metadata || { passed: isSuccess, title: 'Datos del remito', details: isSuccess ? `N° de remito: #${result.orderNumber || ''} | Cliente: ${result.clientName || ''}` : 'No se detectó cabecera válida.' };
    const step3 = checklist.step3_items || { passed: isSuccess, title: 'Productos y cantidades', details: isSuccess ? `${result.totalItems || 0} unidades encontradas.` : 'No se encontraron artículos con cantidades.' };

    const renderStep = (num, step) => {
      const icon = step.passed ? '✓' : '✗';
      const color = step.passed ? 'var(--emerald)' : 'var(--red)';
      const bg = step.passed ? 'var(--hw-accent-soft, var(--hw-accent-soft))' : 'var(--hw-danger-soft)';
      const border = step.passed ? 'var(--hw-accent-soft)' : 'color-mix(in srgb, var(--red) 25%, transparent)';

      return `
        <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; text-align: left; transition: all 0.2s;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: var(--text-main); letter-spacing: 0.3px;">Paso ${num}: ${step.title}</span>
            <span style="font-weight: 900; font-size: 14px; color: ${color}; background: var(--hw-surface-2, var(--card-bg)); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${icon}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 18px;">${step.details}</p>
        </div>
      `;
    };

    msgElem.innerHTML = `
      <div style="text-align: left; margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">
        Archivo: <strong style="color: var(--text-main);">${fileName}</strong>
      </div>
      <div style="margin-top: 10px;">
        ${renderStep(1, step1)}
        ${renderStep(2, step2)}
        ${renderStep(3, step3)}
      </div>
      ${!isSuccess ? `
        <div style="margin-top: 14px; padding: 10px 12px; background: var(--hw-danger-soft); border: 1px solid color-mix(in srgb, var(--red) 40%, transparent); border-radius: 6px; text-align: left;">
          <span style="font-size: 12px; color: var(--text-main); font-weight: 700;">Qué hacer:</span>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0; line-height: 16px;">
            Verifica que el archivo sea un comprobante PDF con capa de texto (no imagen escaneada plana) y que incluya códigos o descripciones de producto con su columna de cantidades.
          </p>
        </div>
      ` : `
        <div style="margin-top: 14px; padding: 10px 12px; background: var(--hw-accent-soft); border: 1px solid color-mix(in srgb, var(--emerald) 40%, transparent); border-radius: 6px; text-align: left;">
          <span style="font-size: 12px; color: var(--emerald); font-weight: 700;">Estado:</span>
          <p style="font-size: 12px; color: var(--text-main); margin: 4px 0 0 0; line-height: 16px;">
            El pedido #${result.orderNumber || ''} ya está en la columna <strong>Nuevos</strong> de tu tablero.
          </p>
        </div>
      `}
    `;

    document.getElementById('dialogCancelBtn').style.display = 'none';
    document.getElementById('dialogConfirmBtn').innerText = 'Entendido';
    document.getElementById('customDialogModal').classList.remove('hidden');
    customDialogResolver = resolve;
  });
}

// SUBIDA DE COMPROBANTES PDF
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    try {
      const res = await fetch('/api/scanban/upload-pdf', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken() || ''}`
        },
        body: JSON.stringify({
          fileName: file.name,
          pdfBase64: base64,
          userEmail: currentUser ? currentUser.email : ''
        })
      });
      const data = await res.json();
      await showUploadDiagnosticsModal(data, file.name);
      if (data.success) {
        loadKanbanData();
      }
    } catch (err) {
      await showUploadDiagnosticsModal({
        success: false,
        checklist: {
          step1_integrity: { passed: false, title: 'El archivo PDF está completo', details: 'No pudimos enviar el archivo. Revisá tu conexión.' },
          step2_metadata: { passed: false, title: 'Datos del remito', details: 'No pudimos comunicarnos con el servidor.' },
          step3_items: { passed: false, title: 'Productos y cantidades', details: 'No pudimos leer la respuesta del servidor.' }
        }
      }, file.name);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsDataURL(file);
}

// ELIMINACIÓN DE COMPROBANTES EN BACKLOG (MODAL PERSONALIZADO)
async function deleteBacklogOrder(orderId, event) {
  if (event) event.stopPropagation();

  const confirmed = await showCustomConfirm(
    'Eliminar Comprobante',
    '¿Querés eliminar este remito de Nuevos? Se borra de holospace. y no se puede recuperar.'
  );

  if (!confirmed) return;

  try {
    const token = getAuthToken() || '';
    const res = await fetch('/api/scanban/delete-order', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        orderId,
        userEmail: currentUser ? currentUser.email : ''
      })
    });
    const data = await res.json();
    if (data.success) {
      loadKanbanData();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos eliminar el pedido.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

// ----------------------------------------------------
// GESTIÓN DE USUARIOS (ABM + BORRADO LÓGICO)
// ----------------------------------------------------
let currentFetchedUsers = [];

async function fetchUsers() {
  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
    });
    const data = await res.json();
    const usersList = Array.isArray(data) ? data : (data.users || []);
    currentFetchedUsers = usersList;
    renderUsersTable(currentFetchedUsers);
  } catch (e) {
    console.error('Error al cargar usuarios:', e);
  }
}

function filterUsersTable(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderUsersTable(currentFetchedUsers);
    return;
  }
  const filtered = currentFetchedUsers.filter(u => {
    const nick = (u.username || (u.email ? u.email.split('@')[0] : '')).toLowerCase();
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const org = (u.tenant_name || u.tenantSlug || '').toLowerCase();
    const role = (u.role_name || u.role || '').toLowerCase();
    const status = u.active !== false ? 'activo' : 'desactivado inactivo';
    return nick.includes(q) || name.includes(q) || email.includes(q) || org.includes(q) || role.includes(q) || status.includes(q);
  });
  renderUsersTable(filtered);
}

let usersTable = null;

function userOrgName(u) {
  return u.tenant_name || u.tenantSlug || (u.tenant_id === 'a0000000-0000-0000-0000-000000000001' ? 'holospace.' : 'Organización');
}

const USERS_TABLE_COLUMNS = [
  {
    key: 'username', label: 'Usuario', filter: 'text',
    filterValue: (u) => u.username || (u.email ? u.email.split('@')[0] : ''),
    render: (u) => `<strong style="color: var(--emerald); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">@${escHtml(u.username || (u.email ? u.email.split('@')[0] : '-'))}</strong>`
  },
  { key: 'name', label: 'Nombre', filter: 'text', render: (u) => `<strong style="color: var(--text-main);">${escHtml(u.name)}</strong>` },
  { key: 'email', label: 'Email', filter: 'text', render: (u) => `<span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size: 13px;">${escHtml(u.email)}</span>` },
  {
    key: 'org', label: 'Empresa', filter: 'text', filterValue: userOrgName,
    render: (u) => `<span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; background: var(--hw-surface-2, var(--card-bg)); color: var(--text-main); border: 1px solid var(--card-border);">${escHtml(userOrgName(u))}</span>`
  },
  {
    key: 'role', label: 'Rol', filter: 'text', filterValue: (u) => u.role_name || u.role,
    render: (u) => {
      const isTargetSuperAdmin = u.role === 'SUPERADMIN';
      return `<span class="badge-role" style="${isTargetSuperAdmin ? 'background:var(--hw-violet-soft); color:var(--cobalt); border-color:var(--cobalt);' : (u.is_custom_role ? 'background:var(--hw-accent-soft); color:var(--emerald); border-color:var(--emerald);' : '')}">${escHtml(u.role_name || u.role)}</span>`;
    }
  },
  {
    key: 'status', label: 'Estado', filter: 'enum', align: 'center',
    options: [{ value: 'Activo', label: 'Activo' }, { value: 'Desactivado', label: 'Desactivado' }],
    filterValue: (u) => (u.active !== false ? 'Activo' : 'Desactivado'),
    render: (u) => `<span class="status-indicator" style="color: ${u.active !== false ? 'var(--emerald)' : 'var(--amber)'}; font-weight: 800;">${u.active !== false ? '● Activo' : '○ Desactivado'}</span>`
  }
];

function renderUsersTable(usersList = []) {
  const container = document.getElementById('usersTableContainer');
  if (!container) return;

  if (!usersTable || !container.querySelector('.hs-table-wrap')) {
    usersTable = HSTable.mount({
      id: 'users',
      container,
      columns: USERS_TABLE_COLUMNS,
      rowKey: (u) => u.id || u.email,
      emptyMessage: 'No hay usuarios que coincidan con tu búsqueda.',
      actionsLabel: 'Acciones',
      renderActions: (u) => {
        const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';
        const isTargetSuperAdmin = u.role === 'SUPERADMIN';
        const canEdit = isSuperAdmin || !isTargetSuperAdmin;
        if (!canEdit) {
          return `<span style="font-size: 12px; color: var(--text-muted); font-weight: 700; background: var(--hw-surface-2, var(--card-bg)); padding: 4px 10px; border-radius: 8px;">Protegido (SuperAdmin)</span>`;
        }
        return `
          <div class="data-table-actions" style="display: inline-flex; gap: 8px;">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editUserById('${u.id || u.email}')">Editar</button>
            <button class="${u.active !== false ? 'btn-danger' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 12px;" onclick="toggleUserStatus('${u.id || u.email}', ${u.active !== false})">${u.active !== false ? 'Desactivar' : 'Activar'}</button>
          </div>`;
      }
    });
  }
  usersTable.update(usersList);
}

async function updateRoleSelectOptions(selectedRole = 'OPERATOR', selectedRoleId = null) {
  const select = document.getElementById('userRoleInput');
  if (!select) return;
  const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';

  // Si no tenemos la lista de roles cargada, la consultamos de /api/roles
  if (!cachedRoles || cachedRoles.length === 0) {
    try {
      const res = await fetch('/api/roles', {
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      const data = await res.json();
      if (data.roles) {
        cachedRoles = data.roles;
      }
    } catch (e) {
      console.warn('Error precargando roles:', e);
    }
  }

  if (cachedRoles && cachedRoles.length > 0) {
    let html = '';
    cachedRoles.forEach(r => {
      // Filtrar superadmin si el usuario actual no es superadmin
      if (r.slug === 'superadmin' && !isSuperAdmin) return;
      
      const isSelected = selectedRoleId ? (String(r.id) === String(selectedRoleId)) : (r.slug.toUpperCase() === String(selectedRole).toUpperCase());
      const typeLabel = r.is_system ? 'Sistema' : 'Personalizado';
      html += `<option value="${r.slug.toUpperCase()}" data-role-id="${r.id}" ${isSelected ? 'selected' : ''}>${r.name} (${typeLabel})</option>`;
    });
    select.innerHTML = html;
  } else {
    // Fallback estándar con roles modulares
    let options = `
      <option value="SCANNER_OPERATOR">Operario (prepara pedidos con el celular)</option>
      <option value="KANBAN_OPERATOR">Operador del tablero de pedidos</option>
      <option value="KANBAN_ADMIN">Administrador de pedidos (carga remitos y asigna)</option>
      <option value="CORE_ADMIN">Administrador de usuarios y roles</option>
      <option value="4SEE_USER">4see Analista (Consulta de Precios)</option>
      <option value="4SEE_ADMIN">Administrador de 4see (precios y márgenes)</option>
    `;
    if (isSuperAdmin) {
      options += `
        <option value="TENANT_ADMIN">Administrador de empresas</option>
        <option value="SUPERADMIN">Superadministrador de la plataforma</option>
      `;
    }
    select.innerHTML = options;
    select.value = selectedRole;
  }
}

function toggleUserPasswordVisibility() {
  const passInput = document.getElementById('userPasswordInput');
  const btn = document.getElementById('toggleUserPasswordBtn');
  if (!passInput) return;
  
  if (passInput.type === 'password') {
    passInput.setAttribute('type', 'text');
    if (btn) btn.innerText = 'Ocultar';
  } else {
    passInput.setAttribute('type', 'password');
    if (btn) btn.innerText = 'Ver';
  }
}

async function populateUserModalTenants(selectedTenantId = '') {
  const select = document.getElementById('userTenantSelect');
  const staticInput = document.getElementById('userTenantStatic');
  if (!select || !staticInput) return;

  const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';

  if (isSuperAdmin) {
    select.style.display = 'block';
    staticInput.style.display = 'none';
    select.required = true;

    try {
      const res = await fetch('/api/tenants', {
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      const data = await res.json();
      const tenants = data.tenants || [];
      
      select.innerHTML = tenants.map(t => `
        <option value="${t.id}" ${t.id === selectedTenantId ? 'selected' : ''}>
          ${t.name} (${t.slug ? t.slug.toUpperCase() : 'TENANT'})
        </option>
      `).join('');

      if (!selectedTenantId && tenants.length > 0) {
        select.value = tenants[0].id;
      }
    } catch (e) {
      console.error('Error cargando tenants en modal de usuario:', e);
    }
  } else {
    select.style.display = 'none';
    select.required = false;
    staticInput.style.display = 'block';
    const myTenantName = currentUser.tenantName || (currentUser.tenantSlug ? currentUser.tenantSlug.toUpperCase() : 'Mi Organización');
    staticInput.value = myTenantName;
    select.innerHTML = `<option value="${currentUser.tenantId || currentUser.tenant_id}" selected>${myTenantName}</option>`;
  }
}

function openUserModal() {
  document.getElementById('userId').value = '';
  document.getElementById('userModalTitle').innerText = 'Agregar un usuario';
  
  const nickInput = document.getElementById('userNickInput');
  if (nickInput) nickInput.value = '';
  document.getElementById('userNameInput').value = '';
  document.getElementById('userEmailInput').value = '';
  
  const passAsterisk = document.getElementById('userPasswordRequiredAsterisk');
  if (passAsterisk) passAsterisk.style.display = 'inline';

  const passInput = document.getElementById('userPasswordInput');
  passInput.type = 'password';
  passInput.value = '';
  passInput.placeholder = 'Contraseña requerida';
  passInput.required = true;

  const toggleBtn = document.getElementById('toggleUserPasswordBtn');
  if (toggleBtn) toggleBtn.innerText = 'Ver';

  populateUserModalTenants(currentUser.tenantId || currentUser.tenant_id || '');
  updateRoleSelectOptions('OPERATOR');
  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

function fillUserModal(user) {
  if (!user) return;
  document.getElementById('userId').value = user.id;
  document.getElementById('userModalTitle').innerText = 'Editar Usuario';
  
  const nickInput = document.getElementById('userNickInput');
  if (nickInput) nickInput.value = user.username || (user.email ? user.email.split('@')[0] : '');
  
  const nameInput = document.getElementById('userNameInput');
  if (nameInput) nameInput.value = user.name || '';
  
  const emailInput = document.getElementById('userEmailInput');
  if (emailInput) emailInput.value = user.email || '';
  
  const passAsterisk = document.getElementById('userPasswordRequiredAsterisk');
  if (passAsterisk) passAsterisk.style.display = 'none';

  const passInput = document.getElementById('userPasswordInput');
  passInput.type = 'password';
  passInput.value = '';
  passInput.placeholder = 'Dejar en blanco para mantener actual';
  passInput.required = false;

  const toggleBtn = document.getElementById('toggleUserPasswordBtn');
  if (toggleBtn) toggleBtn.innerText = 'Ver';

  populateUserModalTenants(user.tenant_id || user.tenantId || '');
  updateRoleSelectOptions(user.role || 'OPERATOR', user.role_id);
  document.getElementById('userModal').classList.remove('hidden');
}

function editUserByIndex(index) {
  const user = currentFetchedUsers[index];
  if (user) fillUserModal(user);
}

function editUserById(userIdOrEmail) {
  const user = currentFetchedUsers.find(u => 
    String(u.id) === String(userIdOrEmail) || 
    String(u.email).toLowerCase() === String(userIdOrEmail).toLowerCase() || 
    (u.username && String(u.username).toLowerCase() === String(userIdOrEmail).toLowerCase())
  );
  if (user) fillUserModal(user);
}

function editUser(id, name, email, role, active) {
  editUserById(id || email);
}

async function saveUserSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const nickInput = document.getElementById('userNickInput');
  const username = nickInput ? nickInput.value.trim().toLowerCase() : '';
  const name = document.getElementById('userNameInput').value.trim();
  const email = document.getElementById('userEmailInput').value.trim().toLowerCase();
  const roleSelect = document.getElementById('userRoleInput');
  const role = roleSelect ? roleSelect.value : 'OPERATOR';
  const selectedOpt = roleSelect && roleSelect.selectedIndex >= 0 ? roleSelect.options[roleSelect.selectedIndex] : null;
  const role_id = selectedOpt ? selectedOpt.getAttribute('data-role-id') : null;
  
  const tenantSelect = document.getElementById('userTenantSelect');
  const targetTenantId = (tenantSelect && tenantSelect.value) ? tenantSelect.value : (currentUser.tenantId || currentUser.tenant_id);

  if (!username) {
    await showCustomAlert('Falta un dato', 'Escribí el nombre de usuario.');
    return;
  }
  if (!name) {
    await showCustomAlert('Falta un dato', 'Escribí el nombre y apellido.');
    return;
  }
  if (!email) {
    await showCustomAlert('Falta un dato', 'Escribí el email.');
    return;
  }
  if (!id && !password) {
    await showCustomAlert('Falta un dato', 'Elegí una contraseña para el nuevo usuario.');
    return;
  }

  const url = '/api/users';
  const method = id ? 'PUT' : 'POST';
  const payload = id ? 
    { id, tenantId: targetTenantId, username, name, email, password: password || '', role, role_id } : 
    { tenantId: targetTenantId, username, name, email, password, role, role_id };

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken() || ''}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeUserModal();
      await showCustomAlert('Usuario guardado', `Guardamos a ${name} (@${username}).`);
      fetchUsers();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos guardar el usuario. Revisá los datos.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function toggleUserStatus(id, currentActive) {
  const actionText = currentActive ? 'desactivar (borrado lógico)' : 'activar';
  const confirmed = await showCustomConfirm(
    'Confirmar Acción de Usuario',
    `¿Estás seguro de que deseas ${actionText} a este usuario?`
  );

  if (!confirmed) return;

  try {
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !currentActive })
    });
    const data = await res.json();
    if (data.success) {
      fetchUsers();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos activar o desactivar al usuario.');
    }
  } catch (e) {
    await showCustomAlert('Error', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

// ----------------------------------------------------
// GESTIÓN DINÁMICA DE ROLES Y PERMISOS (RBAC)
// ----------------------------------------------------
async function fetchRolesManagementData() {
  try {
    const token = getAuthToken();
    const [rolesRes, permsRes] = await Promise.all([
      fetch('/api/roles', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/permissions', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);
    const rolesData = await rolesRes.json();
    const permsData = await permsRes.json();
    
    if (rolesData.roles) cachedRoles = rolesData.roles;
    if (permsData.permissions) cachedPermissions = permsData.permissions;
    
    renderRolesTable(cachedRoles);
  } catch (err) {
    console.error('Error cargando roles y permisos:', err);
  }
}

function filterRolesTable(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderRolesTable(cachedRoles);
    return;
  }
  const filtered = cachedRoles.filter(r => {
    const name = (r.name || '').toLowerCase();
    const slug = (r.slug || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const perms = Array.isArray(r.permissions) ? r.permissions.join(' ').toLowerCase() : '';
    return name.includes(q) || slug.includes(q) || desc.includes(q) || perms.includes(q);
  });
  renderRolesTable(filtered);
}

let rolesTable = null;

function rolePermsDisplayHtml(r) {
  const permsCount = Array.isArray(r.permissions) ? r.permissions.length : 0;
  const hasWildcard = Array.isArray(r.permissions) && r.permissions.includes('*');
  if (hasWildcard) {
    return `<code style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; color: var(--emerald); background: var(--hw-accent-soft); padding: 2px 6px; border-radius: 4px;">Puede hacer todo</code>`;
  }
  const topPerms = (r.permissions || []).slice(0, 3).map((p) => `<span style="font-size: 11px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; background: var(--hw-surface-2, var(--card-bg)); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--card-border);">${escHtml(p)}</span>`).join(' ');
  const extra = permsCount > 3 ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">+${permsCount - 3} más</span>` : '';
  return `<div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">${topPerms}${extra}</div>`;
}

const ROLES_TABLE_COLUMNS = [
  { key: 'name', label: 'Nombre del Rol', filter: 'text', render: (r) => `<strong style="color: var(--text-main);">${escHtml(r.name)}</strong>` },
  { key: 'slug', label: 'Identificador', filter: 'text', render: (r) => `<code style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; color: var(--text-muted);">@${escHtml(r.slug)}</code>` },
  { key: 'description', label: 'Descripción', filter: 'text', render: (r) => `<span style="color: var(--text-muted); font-size: 13px;">${escHtml(r.description || '-')}</span>` },
  {
    key: 'type', label: 'Tipo', filter: 'enum', options: [{ value: 'Incluido', label: 'Incluido' }, { value: 'Propio', label: 'Propio' }],
    filterValue: (r) => (r.is_system ? 'Incluido' : 'Propio'),
    render: (r) => (r.is_system
      ? `<span class="badge-role" style="background: var(--hw-violet-soft); color: var(--cobalt); border-color: var(--cobalt);">Incluido</span>`
      : `<span class="badge-role" style="background: var(--hw-accent-soft); color: var(--emerald); border-color: var(--emerald);">Propio</span>`)
  },
  { key: 'permissions', label: 'Permisos', filter: 'text', filterValue: (r) => (Array.isArray(r.permissions) ? r.permissions.join(' ') : ''), render: rolePermsDisplayHtml },
  { key: 'user_count', label: 'Usuarios', filter: 'none', align: 'center', render: (r) => `<strong style="color: var(--text-main);">${r.user_count || 0}</strong>` }
];

function renderRolesTable(roles = []) {
  const container = document.getElementById('rolesTableContainer');
  if (!container) return;

  if (!rolesTable || !container.querySelector('.hs-table-wrap')) {
    rolesTable = HSTable.mount({
      id: 'roles',
      container,
      columns: ROLES_TABLE_COLUMNS,
      rowKey: (r) => r.id,
      emptyMessage: 'No hay roles que coincidan con tu búsqueda.',
      actionsLabel: 'Acciones',
      renderActions: (r) => `
        <div class="data-table-actions" style="display: inline-flex; gap: 8px;">
          <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="openRoleModal('${r.id}')">Editar</button>
          ${!r.is_system ? `<button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteRole('${r.id}', '${escHtml(r.name)}')">Eliminar</button>` : ''}
        </div>`
    });
  }
  rolesTable.update(roles);
}

async function openRoleModal(roleIdToEdit = null) {
  const token = getAuthToken();
  if (!cachedPermissions || cachedPermissions.length === 0) {
    try {
      const pRes = await fetch('/api/permissions', { headers: { 'Authorization': `Bearer ${token}` } });
      const pData = await pRes.json();
      if (pData.permissions) cachedPermissions = pData.permissions;
    } catch (e) {}
  }

  let role = null;
  if (roleIdToEdit) {
    role = cachedRoles.find(r => String(r.id) === String(roleIdToEdit));
  }

  document.getElementById('roleId').value = role ? role.id : '';
  document.getElementById('roleModalTitle').innerText = role ? `Editar Rol: ${role.name}` : 'Crear Rol Personalizado';
  document.getElementById('roleNameInput').value = role ? role.name : '';
  document.getElementById('roleSlugInput').value = role ? role.slug : '';
  document.getElementById('roleSlugInput').disabled = !!(role && role.is_system);
  document.getElementById('roleDescriptionInput').value = role ? (role.description || '') : '';

  const activePerms = role && Array.isArray(role.permissions) ? role.permissions : [];
  const isSuperadminRole = role && role.slug === 'superadmin';

  // Renderizar checkboxes agrupados por módulo
  const container = document.getElementById('rolePermissionsContainer');
  if (container) {
    const grouped = {};
    cachedPermissions.forEach(p => {
      // Ignorar comodín global en la lista de checkboxes
      if (p.key === '*') return;
      const mod = p.module_code || p.module || (p.key.includes(':') ? p.key.split(':')[0] : 'general');
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push(p);
    });

    let html = '';
    for (const mod in grouped) {
      html += `
        <div style="border-bottom: 1px solid var(--hw-surface-2); padding-bottom: 8px; margin-bottom: 4px;">
          <div style="font-size: 12px; font-weight: 800; color: var(--emerald); text-transform: uppercase; margin-bottom: 6px;">
            Módulo: ${mod}
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
      `;
      grouped[mod].forEach(perm => {
        const isChecked = isSuperadminRole || activePerms.includes(perm.key) || activePerms.includes('*') || activePerms.includes(`${mod}:*`);
        const actionLabel = perm.action || (perm.key.includes(':') ? perm.key.split(':')[2] : (perm.category || 'op'));
        const titleLabel = perm.name || perm.description || perm.key;
        const descLabel = perm.description ? `<span style="font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px;">${perm.description}</span>` : '';
        html += `
          <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer; color: var(--text-main); background: var(--hw-surface-2); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--card-border);">
            <input type="checkbox" name="role_perm" value="${perm.key}" ${isChecked ? 'checked' : ''} ${isSuperadminRole ? 'disabled' : ''} style="margin-top: 3px;">
            <div>
              <span style="font-weight: 700; color: var(--text-main);">${titleLabel}</span>
              <code style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size: 11px; color: var(--amber); margin-left: 4px;">(${perm.key})</code>
              ${descLabel}
            </div>
          </label>
        `;
      });
      html += `</div></div>`;
    }
    container.innerHTML = html;
  }

  document.getElementById('roleModal').classList.remove('hidden');
}

function closeRoleModal() {
  const modal = document.getElementById('roleModal');
  if (modal) modal.classList.add('hidden');
}

function selectAllRolePermissions(selectAll) {
  const checkboxes = document.querySelectorAll('#rolePermissionsContainer input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (!cb.disabled) cb.checked = !!selectAll;
  });
}

async function saveRoleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('roleId').value;
  const name = document.getElementById('roleNameInput').value.trim();
  const slug = document.getElementById('roleSlugInput').value.trim();
  const description = document.getElementById('roleDescriptionInput').value.trim();

  if (!name) {
    await showCustomAlert('Falta un dato', 'Escribí un nombre para el rol.');
    return;
  }

  const selectedPermissions = [];
  document.querySelectorAll('#rolePermissionsContainer input[name="role_perm"]:checked').forEach(cb => {
    selectedPermissions.push(cb.value);
  });

  const token = getAuthToken();
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/roles/${id}` : '/api/roles';
  const payload = { name, slug, description, permissions: selectedPermissions };

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeRoleModal();
      await showCustomAlert('Rol guardado', `El rol '${name}' quedó guardado con ${selectedPermissions.length} permisos.`);
      await fetchRolesManagementData();
      cachedRoles = [];
      updateRoleSelectOptions();
    } else {
      await showCustomAlert('No se guardó', data.error || 'No pudimos guardar el rol. Revisá los datos.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

async function deleteRole(id, name) {
  const confirmed = await showCustomConfirm(
    'Confirmar Eliminación',
    `¿Estás seguro de eliminar el rol '${name}'? Los usuarios asignados a este rol perderán sus permisos específicos.`
  );
  if (!confirmed) return;

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/roles/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      await showCustomAlert('Rol eliminado', `El rol '${name}' se eliminó.`);
      await fetchRolesManagementData();
      cachedRoles = [];
      updateRoleSelectOptions();
    } else {
      await showCustomAlert('No se eliminó', data.error || 'No pudimos eliminar el rol. Puede que haya usuarios que lo usan.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'No pudimos comunicarnos con el servidor. Intentá de nuevo.');
  }
}

// ----------------------------------------------------
// EXPLORADOR INTELIGENTE DE PEDIDOS CON MULTI-SELECCIÓN DE OPERARIOS
// ----------------------------------------------------
let selectedExplorerOperators = new Set();
let allOperatorEmails = [];

async function renderOperatorPills() {
  try {
    const token = getAuthToken() || '';
    const res = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    const usersList = Array.isArray(data) ? data : (data.users || []);
    // Solo operarios
    const operators = usersList.filter(u => u.role === 'OPERATOR');
    allOperatorEmails = operators.map((u) => u.email.toLowerCase());

    const container = document.getElementById('operatorPillsContainer');
    if (!container) return;

    const allPill = `
      <button type="button" 
        onclick="clearOperatorFilter()"
        style="background: ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : 'var(--hw-surface-2)'}; color: ${selectedExplorerOperators.size === 0 ? 'var(--hw-accent-fg)' : 'var(--text-main)'}; border: 1px solid ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer;">
        Todos los Operarios
      </button>
    `;

    const pillsHtml = operators
      .map((u) => {
        const email = u.email.toLowerCase();
        const isSelected = selectedExplorerOperators.has(email);
        return `
        <button type="button" 
          onclick="toggleOperatorFilter('${email}')"
          style="background: ${isSelected ? 'var(--emerald)' : 'var(--hw-surface-2)'}; color: ${isSelected ? 'var(--hw-accent-fg)' : 'var(--text-main)'}; border: 1px solid ${isSelected ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          ${u.name} (@${u.username || email.split('@')[0]})
        </button>
      `;
      })
      .join('');

    container.innerHTML = allPill + pillsHtml;
  } catch (e) {
    console.error('No pudimos cargar los operarios:', e);
  }
}

function clearOperatorFilter() {
  selectedExplorerOperators.clear();
  renderOperatorPills();
  fetchExplorerOrders();
}

function toggleOperatorFilter(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (selectedExplorerOperators.has(cleanEmail)) {
    selectedExplorerOperators.delete(cleanEmail);
  } else {
    selectedExplorerOperators.add(cleanEmail);
  }
  renderOperatorPills();
  fetchExplorerOrders();
}

let explorerOrdersTable = null;
const EXPLORER_STATUS_ES = { READY: 'LISTO PARA PREPARAR', DOING: 'EN PREPARACIÓN', SCANNING: 'EN PREPARACIÓN', DONE: 'COMPLETADO', CLOSED: 'COMPLETADO' };
const EXPLORER_ORDERS_COLUMNS = [
  {
    key: 'id', label: 'Pedido', filter: 'text', filterValue: (o) => `${o.id || ''} ${o.orderNumber || ''}`,
    render: (o) => `<strong style="color: var(--emerald);">#${escHtml((o.id || '').substring(0, 8).toUpperCase())}</strong><div style="font-size: 11px; color: var(--text-muted);">Comp. #${escHtml(o.orderNumber)}</div>`
  },
  { key: 'clientName', label: 'Cliente', filter: 'text', render: (o) => `<strong>${escHtml(o.clientName)}</strong>` },
  { key: 'operatorEmail', label: 'Operario', filter: 'text', render: (o) => escHtml(o.operatorEmail || 'Sin Asignar') },
  { key: 'issueDate', label: 'Fecha', filter: 'none', render: (o) => `<span style="font-size: 13px; color: var(--text-muted);">${escHtml(o.issueDate || 'Hoy')}</span>` },
  { key: 'totalItemsRequired', label: 'Productos', filter: 'none', align: 'center', render: (o) => `<strong>${o.totalItemsRequired} U</strong>` },
  { key: 'totalAmount', label: 'Importe ($)', filter: 'none', align: 'right', render: (o) => `<span style="color: var(--emerald); font-weight: 900; font-size: 15px;">${HSFormat.moneyHtml((o.totalAmount || 0))}</span>` },
  {
    key: 'status', label: 'Estado', filter: 'enum', align: 'center',
    options: Object.keys(EXPLORER_STATUS_ES).filter((k) => !['SCANNING', 'CLOSED'].includes(k)).map((k) => ({ value: EXPLORER_STATUS_ES[k], label: EXPLORER_STATUS_ES[k] })).concat([{ value: 'NUEVO', label: 'NUEVO' }]),
    filterValue: (o) => EXPLORER_STATUS_ES[o.status] || 'NUEVO',
    render: (o) => {
      const statusEs = EXPLORER_STATUS_ES[o.status] || 'NUEVO';
      const badgeStyle = o.status === 'READY' ? 'background: var(--hw-accent-soft); color: var(--emerald);'
        : (o.status === 'DOING' || o.status === 'SCANNING') ? 'background: var(--hw-info-soft); color: var(--hw-info);'
        : (o.status === 'DONE' || o.status === 'CLOSED') ? 'background: var(--hw-warning-soft); color: var(--amber);'
        : 'background: var(--hw-surface-2); color: var(--text-muted);';
      return `<span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; ${badgeStyle}">${statusEs}</span>`;
    }
  }
];

async function fetchExplorerOrders() {
  const query = document.getElementById('orderSearchQuery')?.value || '';
  const status = document.getElementById('orderStatusFilter')?.value || '';
  const sortBy = document.getElementById('orderSortBy')?.value || 'date_desc';
  const operators = Array.from(selectedExplorerOperators).join(',');

  try {
    const token = getAuthToken() || '';
    const res = await fetch(
      `/api/scanban/orders?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&sortBy=${encodeURIComponent(sortBy)}&operators=${encodeURIComponent(operators)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await res.json();
    const container = document.getElementById('ordersExplorerContainer');
    if (!container) return;

    let ordersList = data.orders || [];

    // Multi-selección de operarios en cliente
    if (selectedExplorerOperators.size > 0) {
      ordersList = ordersList.filter(o => {
        const op = (o.operatorEmail || '').toLowerCase().trim();
        return selectedExplorerOperators.has(op);
      });
    }

    // Ordenamiento dinámico
    const cleanSort = (sortBy || 'date_desc').replace('-', '_');
    if (cleanSort === 'date_asc') {
      ordersList.sort((a, b) => a.id - b.id);
    } else if (cleanSort === 'amount_desc') {
      ordersList.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
    } else if (cleanSort === 'items_desc') {
      ordersList.sort((a, b) => (b.totalItemsRequired || 0) - (a.totalItemsRequired || 0));
    } else {
      ordersList.sort((a, b) => b.id - a.id);
    }

    if (!explorerOrdersTable || !container.querySelector('.hs-table-wrap')) {
      explorerOrdersTable = HSTable.mount({
        id: 'explorer_orders',
        container,
        columns: EXPLORER_ORDERS_COLUMNS,
        rowKey: (o) => o.id,
        emptyMessage: 'No hay pedidos que coincidan con tu búsqueda y los filtros elegidos.',
        actionsLabel: 'Ver',
        renderActions: (o) => `<button class="btn-secondary" style="padding: 4px 12px; font-size: 11px; font-weight: 700;" onclick="openInvoiceModal('${o.id}')">Ver detalle</button>`
      });
    }
    explorerOrdersTable.update(ordersList);
  } catch (e) {
    console.error('Error al explorar pedidos:', e);
  }
}

// Inicializar pills cuando se cambia a la pestaña orders
const originalSwitchTab = switchTab;
switchTab = function (tabName) {
  originalSwitchTab(tabName);
  if (tabName === 'orders') {
    renderOperatorPills();
  }
};

let currentQrMode = 'expo'; // 'expo' | 'web'

async function openQrModal() {
  let host = window.location.hostname;
  
  // Si estamos en dominio de producción holospace o VPS remoto
  if (host.includes('holospace.com.ar') || host === '5.161.237.189') {
    host = '5.161.237.189';
  } else if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data && data.hostIp && !data.hostIp.startsWith('172.') && data.hostIp !== '127.0.0.1') {
        host = data.hostIp;
      }
    } catch (e) {
      console.log('Error obteniendo IP dinámica:', e);
    }
  }

  setQrMode(currentQrMode || 'expo');
  document.getElementById('qrModal').classList.remove('hidden');
}

function setQrMode(mode) {
  currentQrMode = mode;
  const webBtn = document.getElementById('qrModeWebBtn');
  const expoBtn = document.getElementById('qrModeExpoBtn');
  
  if (mode === 'expo') {
    if (expoBtn) { expoBtn.className = 'btn-primary'; }
    if (webBtn) { webBtn.className = 'btn-secondary'; }
  } else {
    if (webBtn) { webBtn.className = 'btn-primary'; }
    if (expoBtn) { expoBtn.className = 'btn-secondary'; }
  }

  let host = window.location.hostname;
  if (host.includes('holospace.com.ar') || host === '5.161.237.189') {
    host = mode === 'web' ? 'm.holospace.com.ar' : '5.161.237.189';
  }
  updateQrDisplay(host);
}

function updateQrDisplay(host) {
  const cleanHost = (host || 'm.holospace.com.ar').trim();
  localStorage.setItem('hs_expo_host_ip', cleanHost);
  
  let targetUrl = '';
  if (currentQrMode === 'web') {
    // Web Móvil Directa
    if (cleanHost === 'm.holospace.com.ar' || cleanHost.includes('.')) {
      targetUrl = `https://${cleanHost}`;
    } else {
      targetUrl = `http://${cleanHost}:8081`;
    }
  } else {
    // Modo Expo Go
    if (cleanHost === 'm.holospace.com.ar') {
      targetUrl = `exp://5.161.237.189:8081`;
    } else {
      targetUrl = `exp://${cleanHost}:8081`;
    }
  }

  const qrImg = document.getElementById('qrImage');
  const qrText = document.getElementById('qrText');
  const ipInput = document.getElementById('qrCustomIpInput');

  if (qrImg) {
    if (typeof qrcode === "function") {
      const qr = qrcode(0, "M");
      qr.addData(targetUrl);
      qr.make();
      qrImg.src = qr.createDataURL(8, 2);
      qrImg.style.display = "block";
    }
  }
  if (qrText) {
    qrText.textContent = targetUrl;
  }
  if (ipInput) {
    ipInput.value = cleanHost;
  }
}

function handleCustomIpChange(newIp) {
  if (newIp && newIp.trim()) {
    updateQrDisplay(newIp.trim());
  }
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('userDropdownMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function closeUserDropdown() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

document.addEventListener('click', (e) => {
  const container = document.querySelector('.user-dropdown-container');
  if (container && !container.contains(e.target)) {
    closeUserDropdown();
  }
});

function logout() {
  if (kanbanAutoRefreshInterval) {
    clearInterval(kanbanAutoRefreshInterval);
    kanbanAutoRefreshInterval = null;
  }
  closeUserDropdown();
  clearAuthSession();
  currentUser = null;
  populateSavedCredentials();
  window.location.href = '/';
}

// ============================================================
// PANEL SUPER ADMIN — GESTIÓN DE PLATAFORMA
// ============================================================

async function loadPlatformPanel() {
  if (!currentUser || currentUser.role !== 'SUPERADMIN') return;

  // Fill info cards
  document.getElementById('platformInfoAdmin').innerText = currentUser.email;

  // Load theme info
  try {
    const themeRes = await fetch('/api/theme');
    const themeData = await themeRes.json();
    const activeThemeEl = document.getElementById('platformInfoTheme');
    if (activeThemeEl) {
      activeThemeEl.innerText = (themeData.theme && themeData.theme.name) ? themeData.theme.name : (themeData.activeThemeKey || '—');
    }
  } catch {}

  // Load config / db info
  try {
    const configRes = await fetch('/api/config');
    const configData = await configRes.json();
    const dbEl = document.getElementById('platformInfoDb');
    if (dbEl && configData && configData.dbPath) {
      dbEl.innerText = configData.dbPath;
    }
  } catch {}

  // Load modules
  try {
    const res = await fetch('/api/modules', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      renderModulesGrid(data.modules);
      const activeCount = data.modules.filter(m => m.is_active === true || m.is_active === 1 || m.active === 1 || m.active === true).length;
      document.getElementById('platformInfoActiveModules').innerText = activeCount;
    }
  } catch (e) {
    document.getElementById('modulesGrid').innerHTML =
      `<div style="color:var(--red)">No pudimos cargar los módulos: ${e.message}</div>`;
  }

  // Load platform audit log
  try {
    const auditRes = await fetch('/api/platform-audit', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      renderPlatformAuditLog(auditData.logs || []);
    }
  } catch {}
}

function renderModulesGrid(modules) {
  const grid = document.getElementById('modulesGrid');
  if (!modules || modules.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted); font-size:14px;">No hay módulos disponibles.</div>';
    return;
  }

  const moduleUrlMap = {
    'landing': { path: '/landing', label: 'holospace.com.ar/landing', tag: 'WEB' },
    'tenant': { path: '/tenant', label: 'holospace.com.ar/tenant', tag: 'ADMIN' },
    'core': { path: '/core', label: 'holospace.com.ar/core', tag: 'CORE' },
    'kanban': { path: '/kanban', label: 'holospace.com.ar/kanban', tag: 'LOGISTICA' },
    'scanner': { path: '/scanner', label: 'm.holospace.com.ar', tag: 'MOVIL' },
    '4see': { path: '/4see', label: 'holospace.com.ar/4see', tag: 'ECOMMERCE' }
  };

  grid.innerHTML = modules.map(mod => {
    const isCore = mod.key === 'core';
    const isActive = mod.is_active === true || mod.is_active === 1 || mod.active === 1 || mod.active === true;
    const rawDate = mod.activated_at || mod.activatedAt;
    const activatedAt = rawDate ? new Date(rawDate).toLocaleString('es-AR') : '—';
    const statusColor = isActive ? 'var(--emerald)' : 'var(--text-muted)';
    const activatedBy = mod.activated_by || mod.activatedBy || '—';
    const urlInfo = moduleUrlMap[mod.key] || { path: '/' + mod.key, label: 'holospace.com.ar/' + mod.key, tag: 'MODULO' };

    return `
      <div class="module-card ${isActive ? 'active-module' : 'inactive-module'}" id="moduleCard-${mod.key}">
        <div class="module-info">
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div class="module-name" style="display:flex; align-items:center; gap:6px;">
              <span class="badge" style="font-size:11px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; padding:2px 6px;">[${urlInfo.tag}]</span>
              <span>${mod.name}</span>
            </div>
            <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px;
              background:${isActive ? 'var(--hw-accent-soft)' : 'var(--hw-surface-2)'};
              color:${statusColor}; border: 1px solid ${statusColor};">
              ${isActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
            <a href="${urlInfo.path}" target="${mod.key === 'scanner' || mod.key === 'landing' ? '_blank' : '_self'}" 
               style="display:inline-flex; align-items:center; gap:4px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size:11px; font-weight:700; color:var(--cobalt); text-decoration:none; background:var(--hw-violet-soft); padding:3px 8px; border-radius:4px; border:1px solid color-mix(in srgb, var(--cobalt) 40%, transparent);">
               ${urlInfo.label}
            </a>
            ${isCore ? '<span style="font-size:11px; color:var(--amber); font-weight:800;">[CORE PLATAFORMA]</span>' : ''}
          </div>
          <div class="module-desc">${mod.description || '—'}</div>
          <div class="module-meta">
            Ruta Oficial: <strong style="color:var(--emerald);">${urlInfo.path}</strong>
            · Activado por: <strong style="color: var(--text-main);">${activatedBy}</strong>
            · Fecha: ${activatedAt}
          </div>
        </div>
        ${!isCore ? `
          <label class="toggle-switch" title="${isActive ? 'Desactivar' : 'Activar'} módulo ${mod.name}">
            <input type="checkbox" ${isActive ? 'checked' : ''}
              onchange="toggleModuleActive('${mod.key}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        ` : '<span style="font-size:12px; color:var(--text-muted); font-weight:600;">Siempre activo</span>'}
      </div>
    `;
  }).join('');
}

async function toggleModuleActive(moduleKey, active) {
  try {
    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ key: moduleKey, active })
    });
    const data = await res.json();
    if (data.success) {
      // Reload panel to reflect changes
      loadPlatformPanel();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos activar o desactivar el módulo.');
      loadPlatformPanel(); // revert toggle visually
    }
  } catch (e) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${e.message})`);
    loadPlatformPanel();
  }
}

function renderPlatformAuditLog(logs) {
  const container = document.getElementById('platformAuditLog');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:14px; padding:8px 0;">Todavía no hay actividad registrada.</div>';
    return;
  }

  const actionColors = {
    'MODULE_ACTIVATED':   'var(--emerald)',
    'MODULE_DEACTIVATED': 'var(--red)',
    'THEME_CHANGED':      'var(--cobalt)',
    'TENANT_THEME_CHANGED':'var(--cobalt)'
  };
  const actionLabels = {
    'MODULE_ACTIVATED':   'Módulo activado',
    'MODULE_DEACTIVATED': 'Módulo desactivado',
    'THEME_CHANGED':      'Tema cambiado',
    'TENANT_THEME_CHANGED':'Tema de la empresa cambiado'
  };

  container.innerHTML = [...logs].slice(0, 50).map(log => {
    const color = actionColors[log.action] || 'var(--text-muted)';
    const label = actionLabels[log.action] || log.action;
    const ts = new Date(log.timestamp).toLocaleString('es-AR');
    let detailsText = '';
    if (typeof log.details === 'object' && log.details !== null) {
      detailsText = log.details.description || log.details.message || JSON.stringify(log.details);
    } else if (typeof log.details === 'string') {
      try {
        const parsed = JSON.parse(log.details);
        detailsText = parsed.description || parsed.message || log.details;
      } catch {
        detailsText = log.details;
      }
    }

    return `
      <div class="platform-audit-row">
        <div class="audit-dot" style="background-color:${color};"></div>
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:800; color: var(--text-main);">${label}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${log.userEmail || log.user_email || 'Sistema'} · ${ts}</div>
          ${detailsText ? `<div style="font-size:11px; color:${color}; margin-top:2px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">${detailsText}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// MÓDULO TENANTS (SUPERADMIN SAAS MANAGEMENT)
// ============================================================================

let cachedTenantsList = [];

async function loadTenantsManagementData() {
  const container = document.getElementById('tenantsListContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/tenants', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div style="color:var(--red); padding:20px;">${data.error || 'No pudimos cargar las empresas'}</div>`;
      return;
    }

    cachedTenantsList = data.tenants || [];

    // Actualizar KPIs
    const totalTenants = cachedTenantsList.length;
    const activeTenants = cachedTenantsList.filter(t => t.status === 'active' || !t.status).length;
    const totalUsers = cachedTenantsList.reduce((acc, t) => acc + (t.users ? t.users.length : 0), 0);

    const kpiCount = document.getElementById('kpiTenantsCount');
    const kpiActive = document.getElementById('kpiTenantsActive');
    const kpiUsers = document.getElementById('kpiTenantsUsers');

    if (kpiCount) kpiCount.innerText = totalTenants;
    if (kpiActive) kpiActive.innerText = activeTenants;
    if (kpiUsers) kpiUsers.innerText = totalUsers;

    // Actualizar Select del Modal Asignar Usuario
    const assignTenantSelect = document.getElementById('assignUserTenantSelect');
    if (assignTenantSelect) {
      assignTenantSelect.innerHTML = cachedTenantsList.map(t => `<option value="${t.id}">${t.name} (${t.slug})</option>`).join('');
    }

    // Renderizar Cards de Organizaciones
    container.innerHTML = cachedTenantsList.map(t => {
      const isPlatform = t.slug === 'holospace';
      const isSuspended = t.status === 'suspended';
      const renderPlanBadges = () => {
        const badges = [];
        const kanbanNames = {
          kanban_simple: 'Kanban Simple',
          kanban_business: 'Kanban Business',
          kanban_enterprise: 'Kanban Enterprise'
        };
        const fourseeNames = {
          fourseee_simple: '4see Simple',
          fourseee_business: '4see Business',
          fourseee_enterprise: '4see Enterprise'
        };

        if (t.kanban_plan && kanbanNames[t.kanban_plan]) {
          badges.push(`<span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 10px; text-transform: uppercase; background: var(--hw-info-soft); color: var(--hw-info); border: 1px solid var(--hw-info);">${kanbanNames[t.kanban_plan]}</span>`);
        }
        if (t.fourseee_plan && fourseeNames[t.fourseee_plan]) {
          badges.push(`<span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 10px; text-transform: uppercase; background: var(--hw-violet-soft); color: var(--cobalt); border: 1px solid var(--cobalt);">${fourseeNames[t.fourseee_plan]}</span>`);
        }
        if (badges.length === 0) {
          const rawPlan = t.plan_code || 'kanban_simple';
          badges.push(`<span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 10px; text-transform: uppercase; background: var(--hw-accent-soft); color: var(--emerald); border: 1px solid var(--emerald);">${rawPlan}</span>`);
        }
        return badges.join(' ');
      };

      const modules = t.modules || [];
      const hasModule = (code) => modules.some(m => (m.module_code === code || (code === 'kanban' && (m.module_code === 'scanban-board' || m.module_code === 'scanban')) || (code === 'scanner' && (m.module_code === 'scanban-scanner' || m.module_code === 'scanban'))) && m.is_enabled);

      const isKanbanActive = hasModule('kanban');
      const isScannerActive = hasModule('scanner');

      const users = t.users || [];

      return `
        <div style="background: var(--card-bg); border: 1px solid ${isSuspended ? 'var(--red)' : 'var(--card-border)'}; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); opacity: ${isSuspended ? '0.75' : '1'};">
          <!-- Tenant Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="font-size: 18px; font-weight: 900; color: var(--text-main);">${t.name}</h3>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 8px; background: var(--hw-surface-2, var(--card-bg)); color: var(--text-muted); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">
                  ${t.slug}
                </span>
                ${isPlatform ? '<span style="font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 6px; background: var(--hw-violet-soft); color: var(--cobalt); border: 1px solid var(--cobalt);">PLATAFORMA</span>' : ''}
                <span style="font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; border: 1px solid ${isSuspended ? 'var(--red)' : 'var(--emerald)'}; color: ${isSuspended ? 'var(--red)' : 'var(--emerald)'}; background: ${isSuspended ? 'var(--hw-danger-soft)' : 'var(--hw-accent-soft)'};">
                  ${isSuspended ? '○ Suspendido' : '● Activo'}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                Usuarios: <strong style="color: var(--text-main);">${users.length} / ${t.max_users || '—'}</strong> · Órdenes/Mes: <strong style="color: var(--text-main);">${t.max_orders_monthly || '—'}</strong>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              ${renderPlanBadges()}
              <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px; border-radius: 8px; border-color: var(--emerald); color: var(--emerald); font-weight: 800;" onclick="openEditTenantModal('${t.id}')" title="Editar Organización">
                Editar
              </button>
              ${!isPlatform ? `
                <button class="${isSuspended ? 'btn-primary' : 'btn-danger'}" style="padding: 4px 8px; font-size: 11px; border-radius: 8px;" onclick="toggleTenantStatus('${t.id}', '${t.name}', '${t.status || 'active'}')" title="${isSuspended ? 'Reactivar Organización' : 'Suspender Organización'}">
                  ${isSuspended ? 'Reactivar' : 'Suspender'}
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Tema Base por Defecto del Tenant (Solo lectura en tarjeta) -->
          <div style="background: var(--hw-surface-2, var(--card-bg)); border: 1px solid var(--card-border); border-radius: 16px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Tema de color de la empresa</span>
            <span style="font-size: 12px; font-weight: 700; color: var(--text-main); background: var(--hw-surface-2, var(--card-bg)); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--card-border);">
              ${{
                holo_dark: 'Holo Night',
                holo_light: 'Holo Day'
              }[t.active_theme] || t.active_theme || 'Omarchy Tiling'}
            </span>
          </div>

          <!-- Módulos Licenciados Toggles (Solo lectura en tarjeta) -->
          <div style="background: var(--hw-surface-2, var(--card-bg)); border: 1px solid var(--card-border); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Módulos habilitados ahora</div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
              <!-- Kanban -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: var(--hw-surface-2, var(--card-bg)); padding: 8px 12px; border-radius: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: ${isKanbanActive ? 'var(--emerald)' : 'var(--text-muted)'};">Pedidos</span>
                <input type="checkbox" ${isKanbanActive ? 'checked' : ''} disabled style="cursor: not-allowed; opacity: 0.8;">
              </div>

              <!-- Scanner -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: var(--hw-surface-2, var(--card-bg)); padding: 8px 12px; border-radius: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: ${isScannerActive ? 'var(--emerald)' : 'var(--text-muted)'};">Escáner</span>
                <input type="checkbox" ${isScannerActive ? 'checked' : ''} disabled style="cursor: not-allowed; opacity: 0.8;">
              </div>
            </div>
          </div>

          <!-- Usuarios de la Organización -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Usuarios (${users.length})</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto;">
              ${users.length === 0 ? '<div style="color:var(--text-muted); font-size:12px; font-style:italic;">Todavía sin usuarios</div>' : users.map(u => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--hw-surface-2); border-radius: 8px; border: 1px solid var(--card-border);">
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${u.name} ${u.username ? `<span style="color:var(--emerald); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">(@${u.username})</span>` : ''}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${u.email}</div>
                  </div>
                  <span style="font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 1px solid ${u.role === 'SUPERADMIN' ? 'var(--cobalt)' : u.role === 'ADMIN' ? 'var(--emerald)' : 'var(--accent)'}; color: ${u.role === 'SUPERADMIN' ? 'var(--cobalt)' : u.role === 'ADMIN' ? 'var(--emerald)' : 'var(--accent)'}; background: var(--hw-surface-2, var(--card-bg));">
                    ${u.role}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderTenantsTable(cachedTenantsList);

  } catch (err) {
    tenantsTable = null;
    const tableContainer = document.getElementById('tenantsTableContainer');
    if (tableContainer) {
      tableContainer.innerHTML = `<div style="color:var(--amber); padding:20px; text-align:center;">No pudimos cargar las empresas: ${err.message}</div>`;
    }
  }
}

function filterTenantsTable(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderTenantsTable(cachedTenantsList);
    return;
  }
  const filtered = cachedTenantsList.filter(t => {
    const name = (t.name || '').toLowerCase();
    const slug = (t.slug || '').toLowerCase();
    const plan = (t.plan_code || '').toLowerCase();
    const status = t.status === 'suspended' ? 'suspendido' : 'activo';
    const modules = (t.modules || []).map(m => m.module_code).join(' ').toLowerCase();
    return name.includes(q) || slug.includes(q) || plan.includes(q) || status.includes(q) || modules.includes(q);
  });
  renderTenantsTable(filtered);
}

let tenantsTable = null;

function tenantPlanBadgesHtml(t) {
  const badges = [];
  const kanbanNames = { kanban_simple: 'Kanban Simple', kanban_business: 'Kanban Business', kanban_enterprise: 'Kanban Enterprise' };
  const fourseeNames = { fourseee_simple: '4see Simple', fourseee_business: '4see Business', fourseee_enterprise: '4see Enterprise' };
  if (t.kanban_plan && kanbanNames[t.kanban_plan]) {
    badges.push(`<span class="badge-role" style="background: var(--hw-info-soft); color: var(--hw-info); border-color: var(--hw-info); margin: 2px;">${kanbanNames[t.kanban_plan]}</span>`);
  }
  if (t.fourseee_plan && fourseeNames[t.fourseee_plan]) {
    badges.push(`<span class="badge-role" style="background: var(--hw-violet-soft); color: var(--cobalt); border-color: var(--cobalt); margin: 2px;">${fourseeNames[t.fourseee_plan]}</span>`);
  }
  if (badges.length === 0) {
    const rawPlan = t.plan_code || 'kanban_simple';
    badges.push(`<span class="badge-role" style="background: var(--hw-accent-soft); color: var(--emerald); border-color: var(--emerald); margin: 2px;">${rawPlan.toUpperCase()}</span>`);
  }
  return badges.join(' ');
}

function tenantModuleChipsHtml(t) {
  const isPlatform = t.slug === 'holospace';
  const modules = t.modules || [];
  const hasModule = (code) => modules.some((m) => (m.module_code === code || (code === 'kanban' && (m.module_code === 'scanban-board' || m.module_code === 'scanban')) || (code === 'scanner' && (m.module_code === 'scanban-scanner' || m.module_code === 'scanban'))) && m.is_enabled);
  return ['core', 'tenant', 'kanban', 'scanner', '4see'].map((mCode) => {
    const active = (mCode === 'core' || (mCode === 'tenant' && isPlatform)) ? true : hasModule(mCode);
    return `<span style="font-size: 11px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid ${active ? 'var(--card-border)' : 'var(--card-border)'}; background: ${active ? 'var(--hw-surface-2)' : 'transparent'}; color: ${active ? 'var(--text-main)' : 'var(--text-muted)'}; opacity: ${active ? '1' : '0.4'};">${mCode}</span>`;
  }).join(' ');
}

const TENANTS_TABLE_COLUMNS = [
  { key: 'slug', label: 'Identificador', filter: 'text', render: (t) => `<strong style="color: var(--emerald); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">@${escHtml(t.slug)}</strong>` },
  {
    key: 'name', label: 'Empresa', filter: 'text',
    render: (t) => `<div style="font-weight: 800; color: var(--text-main);">${escHtml(t.name)}</div>${t.slug === 'holospace' ? '<span style="font-size: 11px; font-weight: 900; padding: 1px 6px; border-radius: 4px; background: var(--hw-violet-soft); color: var(--cobalt); border: 1px solid var(--cobalt); margin-top: 4px; display: inline-block;">PLATAFORMA</span>' : ''}`
  },
  { key: 'plan', label: 'Plan', filter: 'none', render: (t) => `<div style="display: flex; gap: 4px; flex-wrap: wrap;">${tenantPlanBadgesHtml(t)}</div>` },
  { key: 'modules', label: 'Módulos habilitados', filter: 'none', render: (t) => `<div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">${tenantModuleChipsHtml(t)}</div>` },
  {
    key: 'users', label: 'Usuarios', filter: 'none', align: 'center',
    render: (t) => `<strong style="color: var(--text-main);">${(t.users || []).length}</strong><span style="color: var(--text-muted); font-size: 11px;"> / ${t.max_users || '—'}</span>`
  },
  {
    key: 'status', label: 'Estado', filter: 'enum', align: 'center',
    options: [{ value: 'Activo', label: 'Activo' }, { value: 'Suspendido', label: 'Suspendido' }],
    filterValue: (t) => (t.status === 'suspended' ? 'Suspendido' : 'Activo'),
    render: (t) => {
      const isSuspended = t.status === 'suspended';
      return `<span class="status-indicator" style="color: ${isSuspended ? 'var(--amber)' : 'var(--emerald)'}; font-weight: 800;">${isSuspended ? '○ Suspendido' : '● Activo'}</span>`;
    }
  }
];

function renderTenantsTable(tenantsList = []) {
  const container = document.getElementById('tenantsTableContainer');
  if (!container) return;

  if (!tenantsTable || !container.querySelector('.hs-table-wrap')) {
    tenantsTable = HSTable.mount({
      id: 'tenants',
      container,
      columns: TENANTS_TABLE_COLUMNS,
      rowKey: (t) => t.id,
      emptyMessage: 'No hay empresas que coincidan con tu búsqueda.',
      actionsLabel: 'Acciones',
      renderActions: (t) => {
        const isPlatform = t.slug === 'holospace';
        const isSuspended = t.status === 'suspended';
        return `
          <div class="data-table-actions" style="display: inline-flex; gap: 6px;">
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="openEditTenantModal('${t.id}')">Editar</button>
            ${!isPlatform ? `<button class="${isSuspended ? 'btn-primary' : 'btn-danger'}" style="padding: 5px 10px; font-size: 11px;" onclick="toggleTenantStatus('${t.id}', '${escHtml(t.name)}', '${t.status || 'active'}')">${isSuspended ? 'Reactivar' : 'Suspender'}</button>` : ''}
          </div>`;
      }
    });
  }
  tenantsTable.update(tenantsList);
}


async function toggleTenantStatus(tenantId, tenantName, currentStatus) {
  const isCurrentlySuspended = currentStatus === 'suspended';
  const newStatus = isCurrentlySuspended ? 'active' : 'suspended';
  const actionText = isCurrentlySuspended ? 'reactivar' : 'suspender (bloqueo lógico)';

  const confirmed = await showCustomConfirm(
    'Confirmar Estado de Organización',
    `¿Estás seguro de que deseas ${actionText} la organización '${tenantName}'?`
  );

  if (!confirmed) return;

  try {
    const res = await fetch('/api/tenants/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ tenantId, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      await showCustomAlert('Listo', data.message || 'Empresa actualizada.');
      loadTenantsManagementData();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos activar o desactivar la empresa.');
    }
  } catch (e) {
    await showCustomAlert('Error', `Error de conexión: ${e.message}`);
  }
}

async function toggleTenantModuleState(tenantId, moduleCode, isEnabled) {
  try {
    const res = await fetch('/api/tenants/modules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ tenantId, moduleCode, isEnabled })
    });
    const data = await res.json();
    if (data.success) {
      loadTenantsManagementData();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos activar o desactivar el módulo.');
      loadTenantsManagementData();
    }
  } catch (e) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${e.message})`);
    loadTenantsManagementData();
  }
}

function openCreateTenantModal() {
  const modal = document.getElementById('createTenantModal');
  const err = document.getElementById('createTenantError');
  if (err) err.style.display = 'none';
  const form = document.getElementById('createTenantForm');
  if (form) form.reset();
  if (modal) modal.classList.remove('hidden');
}

function closeCreateTenantModal() {
  const modal = document.getElementById('createTenantModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateTenantSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('tenantNameInput').value.trim();
  const slug = document.getElementById('tenantSlugInput').value.trim().toLowerCase();
  const kanbanPlanCode = document.getElementById('tenantKanbanPlanSelect') ? document.getElementById('tenantKanbanPlanSelect').value : 'kanban_simple';
  const fourseeePlanCode = document.getElementById('tenant4seePlanSelect') ? document.getElementById('tenant4seePlanSelect').value : 'none';
  const adminName = document.getElementById('tenantAdminNameInput').value.trim();
  const adminUsername = document.getElementById('tenantAdminUsernameInput').value.trim().toLowerCase();
  const adminEmail = document.getElementById('tenantAdminEmailInput').value.trim().toLowerCase();
  const adminPassword = document.getElementById('tenantAdminPasswordInput').value;

  const errEl = document.getElementById('createTenantError');

  try {
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ name, slug, kanbanPlanCode, fourseeePlanCode, adminName, adminUsername, adminEmail, adminPassword })
    });
    const data = await res.json();

    if (data.success) {
      closeCreateTenantModal();
      await showCustomAlert('Empresa creada', `La empresa '${name}' ya está creada.`);
      loadTenantsManagementData();
    } else {
      if (errEl) {
        errEl.innerText = data.error || 'No pudimos crear la empresa. Revisá los datos.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
      errEl.style.display = 'block';
    }
  }
}

// ============================================================================
// FUNCIONES DE EDICIÓN INTEGRAL DE ORGANIZACIONES (SUPERADMIN ONLY)
// ============================================================================

function openEditTenantModal(tenantId) {
  const tenant = cachedTenantsList.find(t => String(t.id) === String(tenantId));
  if (!tenant) return;

  const modal = document.getElementById('editTenantModal');
  const title = document.getElementById('editTenantModalTitle');
  const idInput = document.getElementById('editTenantId');
  const nameInput = document.getElementById('editTenantNameInput');
  const slugInput = document.getElementById('editTenantSlugInput');
  const kanbanSelect = document.getElementById('editTenantKanbanPlanSelect');
  const fourseeSelect = document.getElementById('editTenant4seePlanSelect');
  const maxUsersInput = document.getElementById('editTenantMaxUsersInput');
  const maxOrdersInput = document.getElementById('editTenantMaxOrdersInput');
  const themeSelect = document.getElementById('editTenantThemeSelect');

  if (title) title.innerText = `Editar empresa: ${tenant.name}`;
  if (idInput) idInput.value = tenant.id;
  if (nameInput) nameInput.value = tenant.name || '';
  if (slugInput) slugInput.value = tenant.slug || '';
  if (kanbanSelect) kanbanSelect.value = tenant.kanban_plan || 'none';
  if (fourseeSelect) fourseeSelect.value = tenant.fourseee_plan || 'none';
  if (maxUsersInput) maxUsersInput.value = tenant.max_users || 4;
  if (maxOrdersInput) maxOrdersInput.value = tenant.max_orders_monthly || 0;
  if (themeSelect) themeSelect.value = tenant.active_theme || 'holo_dark';

  const modules = tenant.modules || [];
  const hasModule = (code) => modules.some(m => (m.module_code === code || (code === 'kanban' && (m.module_code === 'scanban-board' || m.module_code === 'scanban')) || (code === 'scanner' && (m.module_code === 'scanban-scanner' || m.module_code === 'scanban'))) && m.is_enabled);

  const modBoard = document.getElementById('editTenantModBoard');
  const modScanner = document.getElementById('editTenantModScanner');
  const mod4see = document.getElementById('editTenantMod4see');

  if (modBoard) modBoard.checked = hasModule('kanban');
  if (modScanner) modScanner.checked = hasModule('scanner');
  if (mod4see) mod4see.checked = hasModule('4see');

  if (modal) modal.classList.remove('hidden');
}

function closeEditTenantModal() {
  const modal = document.getElementById('editTenantModal');
  if (modal) modal.classList.add('hidden');
}

function handleEditTenantPlansChange() {
  const kanbanPlan = document.getElementById('editTenantKanbanPlanSelect')?.value || 'none';
  const fourseePlan = document.getElementById('editTenant4seePlanSelect')?.value || 'none';

  const kanbanQuotas = {
    none: { users: 0, orders: 0, board: false, scanner: false },
    kanban_simple: { users: 4, orders: 500, board: true, scanner: true },
    kanban_business: { users: 18, orders: 3000, board: true, scanner: true },
    kanban_enterprise: { users: 9999, orders: 999999, board: true, scanner: true }
  }[kanbanPlan] || { users: 0, orders: 0, board: false, scanner: false };

  const fourseeQuotas = {
    none: { users: 0, foursee: false },
    fourseee_simple: { users: 3, foursee: true },
    fourseee_business: { users: 10, foursee: true },
    fourseee_enterprise: { users: 9999, foursee: true }
  }[fourseePlan] || { users: 0, foursee: false };

  const totalUsers = Math.max(1, kanbanQuotas.users + fourseeQuotas.users);
  const totalOrders = kanbanQuotas.orders;

  const maxUsersInput = document.getElementById('editTenantMaxUsersInput');
  const maxOrdersInput = document.getElementById('editTenantMaxOrdersInput');
  const modBoard = document.getElementById('editTenantModBoard');
  const modScanner = document.getElementById('editTenantModScanner');
  const mod4see = document.getElementById('editTenantMod4see');

  if (maxUsersInput) maxUsersInput.value = totalUsers;
  if (maxOrdersInput) maxOrdersInput.value = totalOrders;
  if (modBoard) modBoard.checked = kanbanQuotas.board;
  if (modScanner) modScanner.checked = kanbanQuotas.scanner;
  if (mod4see) mod4see.checked = fourseeQuotas.foursee;
}

async function saveEditTenantSubmit(e) {
  e.preventDefault();

  const tenantId = document.getElementById('editTenantId').value;
  const name = document.getElementById('editTenantNameInput').value.trim();
  const kanbanPlanCode = document.getElementById('editTenantKanbanPlanSelect')?.value || 'none';
  const fourseeePlanCode = document.getElementById('editTenant4seePlanSelect')?.value || 'none';
  const maxUsers = parseInt(document.getElementById('editTenantMaxUsersInput').value, 10);
  const maxOrdersMonthly = parseInt(document.getElementById('editTenantMaxOrdersInput').value, 10);
  const activeTheme = document.getElementById('editTenantThemeSelect').value;

  const isBoardChecked = document.getElementById('editTenantModBoard') ? document.getElementById('editTenantModBoard').checked : false;
  const isScannerChecked = document.getElementById('editTenantModScanner') ? document.getElementById('editTenantModScanner').checked : false;
  const is4seeChecked = document.getElementById('editTenantMod4see') ? document.getElementById('editTenantMod4see').checked : false;

  const modules = [
    { code: 'kanban', enabled: isBoardChecked },
    { code: 'scanban-board', enabled: isBoardChecked },
    { code: 'scanner', enabled: isScannerChecked },
    { code: 'scanban-scanner', enabled: isScannerChecked },
    { code: '4see', enabled: is4seeChecked }
  ];

  try {
    const res = await fetch('/api/tenants', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        tenantId,
        name,
        kanbanPlanCode,
        fourseeePlanCode,
        maxUsers,
        maxOrdersMonthly,
        activeTheme,
        modules
      })
    });

    const data = await res.json();
    if (data.success) {
      closeEditTenantModal();
      await showCustomAlert('Empresa actualizada', `Guardamos los cambios de '${name}'.`);
      loadTenantsManagementData();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos guardar los cambios. Revisá los datos.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  }
}

// ============================================================================
// FUNCIONALIDADES DEL MÓDULO 4SEE (MONITOR, CATALOG, MARGINS)
// ============================================================================

// 1. MONITOR DE COMPETENCIA
let cached4seeMonitors = [];     // version plana (todos los rivales de todos los productos), para los graficos
let cached4seeProducts = [];     // maestro: un producto vigilado con sus rivales adentro (monitors)
let watchedProductsTable = null; // instancia de HSTable montada sobre #monitorsTableContainer

function priceSourceLabelText(source) {
  return { STORE: 'de tu tienda', LINK: 'de tu link', MANUAL: 'a mano' }[source] || '';
}

// Cada carga lleva un numero: si una respuesta vieja llega despues de una mas nueva, se descarta
let monitorsLoadSeq = 0;

async function load4seeMonitors() {
  const seq = ++monitorsLoadSeq;
  try {
    const res = await fetch('/api/4see/watched-products', { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
    const data = await res.json();
    if (seq !== monitorsLoadSeq) return;
    if (!data.success) throw new Error(data.error || 'intentá de nuevo');
    flowProducts = (data.products || []).map((p) => ({ ...p, title: p.name }));
    flowAnalysis = data.analysis || null;
    cached4seeProducts = flowProducts;
    cached4seeMonitors = flowProducts.flatMap((p) => p.monitors.map((m) => ({ ...m, my_price: p.price })));
    renderWatchedProductsTable();
    renderMonitorsDashboard(cached4seeMonitors);
    paintFlow();
  } catch (err) {
    if (seq !== monitorsLoadSeq) return;
    const container = document.getElementById('monitorsTableContainer');
    if (container) {
      container.innerHTML = `<div class="flow-empty">No pudimos cargar tus productos: ${escHtml(err.message)}. <button class="btn-secondary" onclick="load4seeMonitors()">Reintentar</button></div>`;
    }
  }
}
window.load4seeMonitors = load4seeMonitors;

let activeFlowStep = 1;
let flowStepTouched = false;
let flowProducts = [];
let flowAnalysis = null;
let currentFlow = null;

const ARS = (n) => `${HSFormat.money(Number(n || 0))}`;

let catalogTable = null;
function renderCatalogStep() {
  const container = document.getElementById('catalogTableContainer');
  if (!container) return;
  if (!catalogTable || !container.querySelector('.hs-table-wrap')) {
    catalogTable = HSTable.mount({
      id: '4see_catalogo',
      container,
      columns: [
        { key: 'title', label: 'Producto', filter: 'text', render: (p) => `<strong style="color: var(--text-main);">${escHtml(p.title)}</strong>` },
        { key: 'sku', label: 'Código', filter: 'text', render: (p) => `<span class="flow-card-sub">${escHtml(p.sku || '')}</span>` },
        { key: 'price', label: 'Tu precio', filter: 'none', align: 'right', render: (p) => (p.price == null ? '<span style="color: var(--amber);">Sin precio</span>' : HSFormat.moneyHtml(p.price)) },
        { key: 'in_analysis', label: 'En análisis', filter: 'enum', options: [{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }], filterValue: (p) => (p.in_analysis ? 'Sí' : 'No'), render: (p) => (p.in_analysis ? '<span class="hs-badge is-ok">Sí</span>' : '<span class="hs-badge is-todo">No</span>') }
      ],
      rowKey: (p) => p.id,
      emptyMessage: 'Todavía no cargaste productos. Agregá el primero con el botón de arriba.',
      actionsLabel: 'Acciones',
      renderActions: (p) => `<div class="data-table-actions" style="display: inline-flex; gap: 6px;">
        <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="openEditCatalogItem('${p.id}')">Editar</button>
        <button class="btn-danger" style="padding: 5px 10px; font-size: 11px;" onclick="askDeleteCatalogItem('${p.id}')">Quitar</button>
      </div>`
    });
  }
  catalogTable.update(flowProducts);
}

function renderAnalysisQuota() {
  const quota = document.getElementById('analysisQuota');
  if (!quota) return;
  quota.textContent = flowAnalysis
    ? `${flowAnalysis.used} de ${flowAnalysis.max} productos en análisis · Plan ${flowAnalysis.planName}`
    : '';
}


const RULE_CONDITION = { LOWEST_MARKET: 'el rival más barato con stock', TARGET_COMPETITOR: 'un rival puntual', OUT_OF_STOCK_RIVAL: 'cuando un rival se queda sin stock' };
function ruleActionText(r) {
  const v = Number(r.offset_value) || 0;
  if (r.action_type === 'PERCENT_OFFSET_BELOW') return `${v} % por debajo`;
  if (r.action_type === 'PERCENT_OFFSET_ABOVE') return `${v} % por encima`;
  if (r.action_type === 'FIXED_OFFSET_BELOW') return `${HSFormat.money(v)} por debajo`;
  if (r.action_type === 'FIXED_OFFSET_ABOVE') return `${HSFormat.money(v)} por encima`;
  if (r.action_type === 'MATCH') return 'igualar su precio';
  if (r.action_type === 'MAX_CEILING') return 'poner tu tope';
  return 'aplicar la regla';
}
async function renderRulesList() {
  const box = document.getElementById('rulesList');
  if (!box) return;
  try {
    const res = await fetch('/api/4see/rules', { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
    const data = await res.json();
    const rules = (data.rules || []).filter((r) => r.is_active);
    box.innerHTML = rules.map((r) => `
      <article class="flow-rule">
        <span class="hs-badge">Regla propia</span>
        <p class="flow-rule-text"><strong>${escHtml(r.name)}</strong>: ${ruleActionText(r)} de ${RULE_CONDITION[r.trigger_condition] || 'tu referencia'}.</p>
      </article>`).join('');
  } catch (err) {
    box.innerHTML = '';
  }
}
window.renderRulesList = renderRulesList;

let costsTable = null;
function renderCostsStep() {
  const container = document.getElementById('marginsTableContainer');
  if (!container) return;
  const analysed = flowProducts.filter((p) => p.in_analysis);
  if (!analysed.length) {
    container.innerHTML = '<div class="flow-empty">Primero elegí productos para analizar en el paso 2. Los costos se cargan para cada uno de ellos.</div>';
    costsTable = null;
    return;
  }
  const money = (v) => (v == null ? '<span style="color: var(--text-muted); white-space: nowrap;">Sin cargar</span>' : HSFormat.moneyHtml(v));
  if (!costsTable || !container.querySelector('.hs-table-wrap')) {
    costsTable = HSTable.mount({
      id: '4see_costos',
      container,
      columns: [
        { key: 'title', label: 'Producto', filter: 'text', render: (p) => `<strong style="color: var(--text-main);">${escHtml(p.title)}</strong>` },
        { key: 'price', label: 'Tu precio', filter: 'none', align: 'right', render: (p) => (p.price != null ? HSFormat.moneyHtml(p.price) : '<span style="color: var(--text-muted);">Sin precio</span>') },
        { key: 'rival_cheapest', label: 'Rival más barato', filter: 'none', align: 'right', render: (p) => { const c = HSFlow.rivalSummary(p.monitors).cheapestInStock; return c ? HSFormat.moneyHtml(c.price) : '<span style="color: var(--text-muted);">Sin dato</span>'; } },
        { key: 'cost_price', label: 'Costo', filter: 'none', align: 'right', render: (p) => money(p.costs_loaded ? p.cost_price : null) },
        { key: 'margin_now', label: 'Margen hoy', filter: 'none', align: 'right', render: (p) => {
          if (!p.costs_loaded) return '<span style="color: var(--text-muted);">Sin cargar</span>';
          const b = HSFlow.costBreakdown({ price: p.price, cost: p.cost_price, operating: p.operating_costs, marginPct: p.min_margin_percentage, ceiling: p.max_price_ceiling });
          if (b.marginPercent === null) return '<span style="color: var(--text-muted);">Sin precio</span>';
          return `${b.marginPercent.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %` + (b.priceBelowFloor ? ' <span class="hs-badge is-warn">Bajo el piso</span>' : '');
        } },
        { key: 'min_price_floor', label: 'Piso de margen', filter: 'none', align: 'right', render: (p) => money(p.costs_loaded ? p.min_price_floor : null) },
        { key: 'costs_loaded', label: 'Estado', filter: 'enum', options: [{ value: 'Cargado', label: 'Cargado' }, { value: 'Falta el costo', label: 'Falta el costo' }], filterValue: (p) => (p.costs_loaded ? 'Cargado' : 'Falta el costo'), render: (p) => (p.costs_loaded ? '<span class="hs-badge is-ok">Cargado</span>' : '<span class="hs-badge is-warn">Falta el costo</span>') }
      ],
      rowKey: (p) => p.id,
      emptyMessage: 'Primero elegí productos para analizar en el paso 2.',
      actionsLabel: 'Acciones',
      renderActions: (p) => `<button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="openCostsModal('${p.id}')">Editar</button>`
    });
  }
  costsTable.update(analysed);
}

async function askDeleteCatalogItem(productId) {
  const p = flowProducts.find((x) => x.id === productId);
  if (!p) return;
  const res = await fetch(`/api/4see/products/${productId}/impact`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
  const data = await res.json();
  if (!data.success) {
    await showCustomAlert('No se pudo', data.error || 'Intentá de nuevo.');
    return;
  }
  const i = data.impact;
  const lines = [
    `Vas a quitar "${p.title}" de tu catálogo.`,
    'Se borra también:',
    `• ${i.rivals} rival(es) cargado(s)`,
    `• ${i.pending} sugerencia(s) pendiente(s)`,
    i.costs_loaded ? '• Los costos cargados' : null,
    i.in_analysis ? '• Su lugar en el análisis' : null,
    'Esta acción no se puede deshacer.'
  ].filter(Boolean).join('\n');
  const confirmed = await showCustomConfirm('Quitar producto', lines);
  if (!confirmed) return;
  const del = await fetch(`/api/4see/products/${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
  const delData = await del.json();
  if (!delData.success) {
    await showCustomAlert('No se pudo quitar', delData.error || 'Intentá de nuevo.');
    return;
  }
  load4seeMonitors();
}
window.askDeleteCatalogItem = askDeleteCatalogItem;

function flowNodeStateText(st, isCurrent) {
  if (st.done) return 'Hecho';
  if (st.locked) return 'Bloqueado';
  if (isCurrent) return 'Estás acá';
  return 'Disponible';
}

function applyFlowStep() {
  const n = activeFlowStep;
  const st = currentFlow ? currentFlow.steps.find((s) => s.n === n) : null;
  const locked = Boolean(st && st.locked);
  document.querySelectorAll('.flow-body').forEach((b) => {
    b.classList.toggle('is-active', !locked && Number(b.dataset.step) === n);
  });
  document.querySelectorAll('.flow-node').forEach((b) => {
    const isCurrent = Number(b.dataset.step) === n;
    b.classList.toggle('is-current', isCurrent);
    b.setAttribute('aria-current', isCurrent ? 'step' : 'false');
  });
  const panel = document.getElementById('flowPanel');
  if (panel) panel.dataset.step = String(n);
  const meta = HSFlow.STEPS[n - 1];
  if (meta) {
    document.getElementById('flowPanelNumber').textContent = String(n);
    document.getElementById('flowPanelN').textContent = String(n);
    document.getElementById('flowPanelTitle').textContent = meta.label;
    document.getElementById('flowPanelGoal').textContent = meta.goal;
  }
  const lock = document.getElementById('flowPanelLock');
  if (lock) {
    lock.hidden = !locked;
    document.getElementById('flowPanelLockText').textContent = locked ? st.reason : '';
    document.getElementById('flowPanelLockGo').onclick = () => setFlowStep(st.blockedBy);
  }
}

function setFlowStep(n) {
  flowStepTouched = true;
  activeFlowStep = n;
  applyFlowStep();
}
window.setFlowStep = setFlowStep;

function paintFlow() {
  currentFlow = HSFlow.computeFlow(flowProducts, cached4seeQueue);
  const s = currentFlow.summary;
  currentFlow.steps.forEach((st) => {
    const node = document.querySelector(`.flow-node[data-step="${st.n}"]`);
    if (!node) return;
    node.classList.toggle('is-done', st.done);
    node.classList.toggle('is-locked', st.locked);
    node.querySelector('.flow-node-state').textContent = flowNodeStateText(st, st.n === activeFlowStep);
    node.title = st.locked ? st.reason : '';
  });
  if (!flowStepTouched) activeFlowStep = currentFlow.suggestedStep;
  renderCatalogStep();
  renderCostsStep();
  renderAnalysisQuota();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('sumCatalog', s.catalogCount);
  set('sumAnalysis', s.analysisCount);
  set('sumRivals', s.withRivals);
  set('sumSuggestions', s.suggestionsPending);
  applyFlowStep();
}

function setFlowView(view) {
  const steps = document.getElementById('flowStepsView');
  const summary = document.getElementById('flowSummaryView');
  const bSteps = document.getElementById('flowViewSteps');
  const bSummary = document.getElementById('flowViewSummary');
  if (steps) steps.hidden = view !== 'steps';
  if (summary) summary.hidden = view !== 'summary';
  if (bSteps) { bSteps.classList.toggle('active', view === 'steps'); bSteps.setAttribute('aria-selected', String(view === 'steps')); }
  if (bSummary) { bSummary.classList.toggle('active', view === 'summary'); bSummary.setAttribute('aria-selected', String(view === 'summary')); }
  // Los graficos se dibujan con el panel oculto (tamano 0); al mostrarlo hay que recalcular su tamano.
  if (view === 'summary' && window.HSCharts) requestAnimationFrame(() => HSCharts.resizeAll());
}
window.setFlowView = setFlowView;

function flowIntroSeen() {
  try { return localStorage.getItem('hs_4see_intro_done') === '1'; } catch (e) { return false; }
}

function openFlowIntro() {
  const el = document.getElementById('flowIntro');
  if (el) el.hidden = false;
}
window.openFlowIntro = openFlowIntro;

function closeFlowIntro() {
  const el = document.getElementById('flowIntro');
  if (el) el.hidden = true;
  try { localStorage.setItem('hs_4see_intro_done', '1'); } catch (e) { /* almacenamiento no disponible */ }
}
window.closeFlowIntro = closeFlowIntro;

async function toggleProductAnalysis(productId, inAnalysis) {
  if (!inAnalysis) {
    const p = flowProducts.find((x) => x.id === productId);
    let pending = 0;
    try {
      const r = await fetch(`/api/4see/products/${productId}/impact`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      const d = await r.json();
      if (d.success) pending = d.impact.pending;
    } catch (err) { /* el aviso se muestra igual, sin el dato */ }
    const lines = [
      `Vas a sacar "${p ? p.title : 'este producto'}" del análisis.`,
      'Qué pasa:',
      '• Deja de ocupar un lugar de tu plan.',
      '• Sus rivales y sus costos quedan guardados.',
      pending ? `• Se quita ${pending} sugerencia(s) pendiente(s); si lo volvés a analizar se calculan de nuevo.` : '• No hay sugerencias pendientes para quitar.',
      'El producto sigue en tu catálogo.'
    ].join('\n');
    const ok = await showCustomConfirm('Quitar del análisis', lines);
    if (!ok) return;
  }
  try {
    const res = await fetch(`/api/4see/products/${productId}/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ inAnalysis })
    });
    const data = await res.json();
    if (!data.success) await showCustomAlert('No se pudo', data.error || 'Intentá de nuevo.');
  } catch (err) {
    await showCustomAlert('Sin conexión', 'No pudimos guardar el cambio. Revisá la conexión e intentá de nuevo.');
  }
  load4seeMonitors();
}
window.toggleProductAnalysis = toggleProductAnalysis;

let costsEditingId = null;

function openCostsModal(productId) {
  const p = flowProducts.find((x) => x.id === productId);
  if (!p) return;
  costsEditingId = p.id;
  document.getElementById('costsProductName').textContent = p.title;
  document.getElementById('costsError').style.display = 'none';
  const fmt = (v) => (v == null ? '' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  document.getElementById('costsCostPrice').value = p.costs_loaded ? fmt(p.cost_price) : '';
  document.getElementById('costsOperating').value = p.costs_loaded ? fmt(p.operating_costs) : '';
  document.getElementById('costsMargin').value = p.costs_loaded ? fmt(p.min_margin_percentage) : '';
  document.getElementById('costsCeiling').value = fmt(p.max_price_ceiling);
  renderCostsContext(p);
  updateCostsLive();
  document.getElementById('costsModal').classList.remove('hidden');
}
window.openCostsModal = openCostsModal;

function costRow(label, value, cls) {
  const row = document.createElement('div');
  row.className = 'cost-row' + (cls ? ' ' + cls : '');
  const a = document.createElement('span');
  a.textContent = label;
  const b = document.createElement('span');
  b.textContent = value;
  row.append(a, b);
  return row;
}
function costNote(tag, text, cls) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}
const PRICE_SOURCE_TEXT = { LINK: 'de tu link', STORE: 'de tu tienda', MANUAL: 'cargado a mano' };

// Arriba del formulario: tu precio y el de cada rival, para decidir con la referencia a la vista
function renderCostsContext(p, boxId = 'costsContext') {
  const box = document.getElementById(boxId);
  box.replaceChildren(costNote('p', 'Tu precio y el de tus rivales', 'cost-title'));
  const source = PRICE_SOURCE_TEXT[p.price_source] ? ' (' + PRICE_SOURCE_TEXT[p.price_source] + ')' : '';
  box.appendChild(costRow('Tu precio hoy' + source, p.price != null ? HSFormat.money(p.price) : 'Sin precio'));
  const rs = HSFlow.rivalSummary(p.monitors);
  if (!rs.rivals.length) {
    box.appendChild(costNote('p', 'Todavía no sumaste rivales a este producto. Sumalos en el paso Análisis para ver contra quién competís.', 'cost-sub'));
    return;
  }
  rs.rivals.forEach((r) => {
    const stock = r.inStock === false ? ' · sin stock' : (r.inStock === true ? ' · con stock' : '');
    const best = rs.cheapestInStock && r === rs.cheapestInStock;
    box.appendChild(costRow(r.name + stock, r.price != null ? HSFormat.money(r.price) : 'Sin precio leído', best ? 'is-best' : ''));
  });
  if (rs.cheapestInStock && p.price > 0) {
    const diff = ((Number(p.price) - rs.cheapestInStock.price) / rs.cheapestInStock.price) * 100;
    const pct = Math.abs(diff).toLocaleString('es-AR', { maximumFractionDigits: 1 });
    const text = Math.abs(diff) < 0.05
      ? 'Estás igual que el rival más barato con stock (' + rs.cheapestInStock.name + ').'
      : 'Estás ' + pct + ' % ' + (diff > 0 ? 'por encima' : 'por debajo') + ' del rival más barato con stock (' + rs.cheapestInStock.name + ').';
    box.appendChild(costNote('p', text, 'cost-sub'));
  } else if (!rs.cheapestInStock) {
    box.appendChild(costNote('p', 'Ningún rival tiene precio y stock leídos todavía.', 'cost-sub'));
  }
}

// Mientras escribís: cuánto te cuesta, cuánto ganás con tu precio de hoy y cuál es el precio mínimo
function updateCostsLive() {
  const box = document.getElementById('costsLive');
  const p = flowProducts.find((x) => x.id === costsEditingId);
  if (!p) { box.replaceChildren(); return; }
  const b = HSFlow.costBreakdown({
    price: p.price,
    cost: HSFields.readMoney(document.getElementById('costsCostPrice')),
    operating: HSFields.readMoney(document.getElementById('costsOperating')),
    marginPct: HSFields.readMoney(document.getElementById('costsMargin')),
    ceiling: HSFields.readMoney(document.getElementById('costsCeiling'))
  });
  box.replaceChildren(costNote('p', 'Con lo que cargás', 'cost-title'));
  if (!b.ready) {
    box.appendChild(costNote('p', 'Cargá el costo del producto y te mostramos cuánto ganás y cuál es tu piso de margen.', 'cost-sub'));
    return;
  }
  box.appendChild(costRow('Te cuesta venderlo', HSFormat.money(b.totalCost)));
  if (b.marginMoney !== null) {
    const pct = b.marginPercent.toLocaleString('es-AR', { maximumFractionDigits: 1 });
    box.appendChild(costRow(b.marginMoney >= 0 ? 'Con tu precio de hoy ganás' : 'Con tu precio de hoy perdés', HSFormat.money(Math.abs(b.marginMoney)) + ' (' + pct + ' %)'));
  }
  box.appendChild(costRow('Tu piso de margen (el precio mínimo)', HSFormat.money(b.floor)));
  if (b.priceBelowFloor) box.appendChild(costNote('p', 'Tu precio de hoy está por debajo de tu piso de margen: con él ganás menos de lo que querés. Podés guardar igual: nunca te vamos a sugerir un precio por debajo del piso.', 'cost-warn'));
  if (b.ceilingBelowFloor) box.appendChild(costNote('p', 'Tu precio tope es menor que tu piso de margen: no vamos a poder proponerte un precio que cumpla las dos cosas. Revisá el tope.', 'cost-warn'));
}
window.updateCostsLive = updateCostsLive;

function closeCostsModal() {
  document.getElementById('costsModal').classList.add('hidden');
  costsEditingId = null;
}
window.closeCostsModal = closeCostsModal;

async function handleCostsSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('costsError');
  errorBox.style.display = 'none';
  if (!costsEditingId) return;
  const body = {
    costPrice: HSFields.readMoney(document.getElementById('costsCostPrice')),
    operatingCosts: HSFields.readMoney(document.getElementById('costsOperating')) || 0,
    minMarginPercentage: HSFields.readMoney(document.getElementById('costsMargin')) || 0,
    maxPriceCeiling: HSFields.readMoney(document.getElementById('costsCeiling')) || ''
  };
  try {
    const res = await fetch(`/api/4see/products/${costsEditingId}/costs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      errorBox.textContent = data.error || 'No pudimos guardar los costos.';
      errorBox.style.display = 'block';
      return;
    }
    closeCostsModal();
    Promise.allSettled([load4seeMonitors(), load4seeSmartPriceQueue()]).then(paintFlow);
  } catch (err) {
    errorBox.textContent = 'Sin conexión. Revisá la red e intentá de nuevo.';
    errorBox.style.display = 'block';
  }
}
window.handleCostsSubmit = handleCostsSubmit;

if (window.HSFields) document.querySelectorAll('.js-money').forEach((el) => HSFields.bindMoney(el));

function renderRivalDetailTable(product) {
  if (!product.monitors.length) {
    const intro = product.in_analysis ? 'Este producto todavía no tiene rivales cargados.' : 'Todavía no lo seguís. Al sumar el primer rival, pasa a análisis.';
    return `<div style="padding: 14px 4px; color: var(--text-muted); font-size: 13px;">${intro}
      <button class="btn-secondary" style="margin-left: 8px; padding: 4px 10px; font-size: 12px;" onclick="event.stopPropagation(); openAddRivalModal('${product.id}')">+ Agregar rival</button></div>`;
  }
  const rows = product.monitors.map((m) => {
    const isOutOfStock = m.competitor_stock === 'OUT_OF_STOCK';
    const stockCell = m.competitor_stock === null
      ? '<span style="color: var(--text-muted); font-size: 11px;">No se pudo leer</span>'
      : (isOutOfStock
        ? '<span class="status-indicator" style="color: var(--amber); font-weight: 800; font-size: 11px;">○ Sin stock</span>'
        : '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px;">● Con stock</span>');
    const priceCell = m.competitor_price === null
      ? `<span style="color: var(--amber); font-size: 12px;">No se pudo leer</span>`
      : `${HSFormat.money(parseFloat(m.competitor_price))}`;
    return `
      <tr>
        <td>
          <a href="${escHtml(m.competitor_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--cobalt); text-decoration: none; font-weight: 600;">
            ${escHtml(m.competitor_name || 'Ver tienda')} ↗
          </a>
        </td>
        <td style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-weight: 800; color: var(--text-main);">${priceCell}</td>
        <td>${stockCell}</td>
        <td style="color: var(--text-muted); font-size: 12px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">${HSFormat.date(m.last_checked_at || m.created_at)}</td>
        <td style="text-align: right;">
          <div class="data-table-actions" style="display: inline-flex; gap: 6px;">
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="event.stopPropagation(); recheckMonitor('${m.id}')">Revisar precio</button>
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="event.stopPropagation(); openEditRivalModal('${m.id}')">Editar</button>
            <button class="btn-danger" style="padding: 5px 10px; font-size: 11px;" onclick="event.stopPropagation(); deleteMonitor('${m.id}')">Quitar</button>
          </div>
        </td>
      </tr>`;
  }).join('');
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Rival</th>
          <th>Precio del rival</th>
          <th>Stock del rival</th>
          <th>Última revisión</th>
          <th style="text-align: right;">Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding: 10px 4px 2px;">
      <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="event.stopPropagation(); openAddRivalModal('${product.id}')">+ Agregar rival</button>
    </div>`;
}

function renderWatchedProductsTable() {
  const container = document.getElementById('monitorsTableContainer');
  if (!container) return;

  const columns = [
    { key: 'name', label: 'Producto', filter: 'text', render: (p) => `<strong style="color: var(--text-main);">${escHtml(p.name)}</strong>` },
    {
      key: 'analysis', label: 'En análisis', filter: 'enum', options: [{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }],
      filterValue: (p) => (p.in_analysis ? 'Sí' : 'No'),
      render: (p) => `<button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="event.stopPropagation(); toggleProductAnalysis('${p.id}', ${!p.in_analysis})">${p.in_analysis ? 'Quitar del análisis' : 'Analizar'}</button>`
    },
    {
      key: 'price', label: 'Tu precio', filter: 'text',
      filterValue: (p) => p.price == null ? '' : String(p.price),
      render: (p) => p.price == null
        ? '<span style="color: var(--amber); font-size: 12px;">Sin definir</span>'
        : `${HSFormat.moneyHtml(parseFloat(p.price))} <span style="color: var(--text-muted); font-size: 11px;">(${priceSourceLabelText(p.price_source)})</span>`
    },
    { key: 'rivals', label: 'Rivales', filter: 'none', align: 'center', render: (p) => String(p.monitors.length) },
    {
      key: 'last_checked_at', label: 'Última revisión', filter: 'none',
      render: (p) => {
        const last = p.monitors.reduce((acc, m) => (m.last_checked_at && (!acc || m.last_checked_at > acc) ? m.last_checked_at : acc), null);
        return last ? HSFormat.date(last) : '—';
      }
    }
  ];

  watchedProductsTable = HSTable.mount({
    id: '4see_competencia',
    container,
    columns,
    rowKey: (p) => p.id,
    renderDetail: (p) => renderRivalDetailTable(p),
    emptyMessage: cached4seeProducts.length
      ? 'No hay productos que coincidan con tu búsqueda.'
      : 'Todavía no cargaste productos. Empezá por el paso 1.',
    actionsLabel: 'Acciones',
    renderActions: (p) => `<button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="event.stopPropagation(); openEditCatalogItem('${p.id}')">Editar</button>`
  });
  watchedProductsTable.update(cached4seeProducts);
}

// Tienda conectada para "tu precio" (compartido entre el modal de rival y el de producto): orden de prioridad
// tienda conectada -> link de tu producto -> valor que cargues, resuelto en el servidor (modules/4see/lib/own_price.js).
let myStoreProductsCache = {};

// Escapa texto de catalogos de terceros (nombre de tienda, titulo de producto) antes de insertarlo como HTML
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function ensureConnectedStoresLoaded() {
  try {
    const res = await fetch('/api/4see/stores', { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
    const data = await res.json();
    if (data.success && Array.isArray(data.stores)) cachedSavedStores = data.stores;
  } catch (err) {
    console.error('No pudimos cargar tus tiendas conectadas:', err);
  }
  return cachedSavedStores;
}

function populateMyStoreSelect(prefix) {
  const select = document.getElementById(`${prefix}MyStoreSelect`);
  if (!select) return;
  let html = '<option value="">No uso una tienda conectada</option>';
  cachedSavedStores.forEach((s) => { html += `<option value="${s.id}">${escHtml(s.name)} (${escHtml(s.platform)})</option>`; });
  select.innerHTML = html;
  const productSelect = document.getElementById(`${prefix}MyStoreProduct`);
  if (productSelect) { productSelect.innerHTML = ''; productSelect.classList.add('hidden'); }
}

async function handleMyStoreChange(prefix) {
  const storeId = document.getElementById(`${prefix}MyStoreSelect`).value;
  const productSelect = document.getElementById(`${prefix}MyStoreProduct`);
  if (!storeId) {
    productSelect.innerHTML = '';
    productSelect.classList.add('hidden');
    if (prefix === 'mon') resetMonitorPreview();
    return;
  }
  productSelect.innerHTML = '<option value="">Buscando tus productos...</option>';
  productSelect.classList.remove('hidden');
  try {
    const res = await fetch(`/api/4see/stores/${storeId}/products`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
    const data = await res.json();
    if (data.success && Array.isArray(data.products)) {
      myStoreProductsCache[storeId] = data.products;
      productSelect.innerHTML = '<option value="">Elegí tu producto</option>' + data.products.map((p) =>
        `<option value="${escHtml(p.externalId)}">${escHtml(p.title)}${p.price ? ' — ' + HSFormat.money(p.price) : ' (sin precio informado)'}</option>`
      ).join('');
    } else {
      productSelect.innerHTML = '<option value="">No pudimos leer tu tienda</option>';
    }
  } catch (err) {
    productSelect.innerHTML = '<option value="">No pudimos leer tu tienda</option>';
  }
  if (prefix === 'mon') resetMonitorPreview();
}
window.handleMyStoreChange = handleMyStoreChange;

function myPricePayload(prefix) {
  const storeId = document.getElementById(`${prefix}MyStoreSelect`).value || null;
  const productSelect = document.getElementById(`${prefix}MyStoreProduct`);
  const externalId = storeId && productSelect && !productSelect.classList.contains('hidden') ? productSelect.value || null : null;
  return { storeId, externalId };
}

// --- Alta de un rival en dos pasos: se lee antes de guardar, nunca se inventa un precio ---
let monLastPreview = null;
let monPriceManuallyEdited = false;

function openCreateMonitorModal() {
  const modal = document.getElementById('createMonitorModal');
  if (modal) {
    document.getElementById('createMonitorForm').reset();
    document.getElementById('createMonitorError').style.display = 'none';
    resetMonitorPreview();
    populateMyStoreSelect('mon');
    ensureConnectedStoresLoaded().then(() => populateMyStoreSelect('mon'));
    modal.classList.remove('hidden');
  }
}

function closeCreateMonitorModal() {
  const modal = document.getElementById('createMonitorModal');
  if (modal) modal.classList.add('hidden');
}

function resetMonitorPreview() {
  monLastPreview = null;
  monPriceManuallyEdited = false;
  const box = document.getElementById('monPreviewBox');
  if (box) box.classList.add('hidden');
  const warn = document.getElementById('monPreviewWarning');
  if (warn) warn.classList.add('hidden');
  const allowRow = document.getElementById('monAllowUnreadableRow');
  if (allowRow) allowRow.classList.add('hidden');
  const err = document.getElementById('createMonitorError');
  if (err) err.style.display = 'none';
  document.getElementById('monBtnPreview').classList.remove('hidden');
  document.getElementById('monBtnConfirm').classList.add('hidden');
}
window.resetMonitorPreview = resetMonitorPreview;

function markMonitorPriceEdited() { monPriceManuallyEdited = true; }
window.markMonitorPriceEdited = markMonitorPriceEdited;

async function handlePreviewMonitor() {
  const productName = document.getElementById('monProductName').value.trim();
  const competitorUrl = document.getElementById('monCompetitorUrl').value.trim();
  const errorDiv = document.getElementById('createMonitorError');
  errorDiv.style.display = 'none';
  if (!productName || !competitorUrl) {
    errorDiv.innerText = 'Escribí el nombre de tu producto y pegá el link del producto del rival.';
    errorDiv.style.display = 'block';
    return;
  }
  const btn = document.getElementById('monBtnPreview');
  const original = btn.innerText;
  btn.innerText = 'Leyendo...';
  btn.disabled = true;
  try {
    const { storeId, externalId } = myPricePayload('mon');
    const myUrl = document.getElementById('monMyUrl').value.trim();
    const myPrice = document.getElementById('monMyPrice').value;
    const res = await fetch('/api/4see/monitors/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ competitorUrl, myUrl, storeId, externalId, myPrice })
    });
    const data = await res.json();
    if (!data.success) {
      errorDiv.innerText = data.error || 'No pudimos leer los precios. Intentá de nuevo.';
      errorDiv.style.display = 'block';
      return;
    }
    monLastPreview = data;
    monPriceManuallyEdited = false;
    renderMonitorPreview(data);
  } catch (err) {
    errorDiv.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
    errorDiv.style.display = 'block';
  } finally {
    btn.innerText = original;
    btn.disabled = false;
  }
}
window.handlePreviewMonitor = handlePreviewMonitor;

function renderMonitorPreview({ rival, mine, warning }) {
  document.getElementById('monPreviewBox').classList.remove('hidden');
  document.getElementById('monBtnPreview').classList.add('hidden');
  document.getElementById('monBtnConfirm').classList.remove('hidden');

  const rivalText = document.getElementById('monPreviewRivalText');
  if (rival.ok) {
    const stockTxt = rival.inStock === null ? '' : (rival.inStock ? ' · con stock' : ' · sin stock');
    rivalText.innerText = `${HSFormat.money(rival.price)}${stockTxt}`;
    rivalText.style.color = 'var(--text-main)';
  } else {
    rivalText.innerText = rival.message || 'No pudimos leer el precio del rival.';
    rivalText.style.color = 'var(--amber)';
  }

  const allowRow = document.getElementById('monAllowUnreadableRow');
  allowRow.classList.toggle('hidden', rival.ok);
  document.getElementById('monAllowUnreadable').checked = false;

  const sourceLabel = { STORE: 'Leído de tu tienda conectada', LINK: 'Leído del link de tu producto', MANUAL: 'Cargado a mano' };
  const mineSource = document.getElementById('monPreviewMineSource');
  const minePrice = document.getElementById('monPreviewMinePrice');
  mineSource.innerText = mine.ok ? sourceLabel[mine.source] || '' : 'No pudimos resolver tu precio: cargalo acá.';
  minePrice.value = mine.ok ? mine.price : '';

  const warn = document.getElementById('monPreviewWarning');
  if (warning) { warn.innerText = warning; warn.classList.remove('hidden'); } else { warn.classList.add('hidden'); }
}

async function handleCreateMonitorSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('createMonitorError');
  errorDiv.style.display = 'none';

  if (!monLastPreview) { await handlePreviewMonitor(); return; }

  const minePrice = document.getElementById('monPreviewMinePrice').value;
  if (!minePrice) {
    errorDiv.innerText = 'Cargá tu precio para poder guardar.';
    errorDiv.style.display = 'block';
    return;
  }
  if (!monLastPreview.rival.ok && !document.getElementById('monAllowUnreadable').checked) {
    errorDiv.innerText = 'No pudimos leer el precio del rival. Revisá el link, o marcá la casilla para guardarlo igual.';
    errorDiv.style.display = 'block';
    return;
  }

  const productName = document.getElementById('monProductName').value.trim();
  const competitorUrl = document.getElementById('monCompetitorUrl').value.trim();
  const competitorName = document.getElementById('monCompetitorName').value.trim();
  const myUrl = document.getElementById('monMyUrl').value.trim();
  const { storeId, externalId } = myPricePayload('mon');

  try {
    const res = await fetch('/api/4see/watched-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({
        productName, competitorUrl, competitorName, myUrl, storeId, externalId,
        myPrice: minePrice, myPriceLocked: monPriceManuallyEdited,
        allowUnreadable: document.getElementById('monAllowUnreadable').checked
      })
    });
    const data = await res.json();
    if (data.success) {
      closeCreateMonitorModal();
      load4seeMonitors();
    } else {
      errorDiv.innerText = data.error || 'No pudimos guardar el producto. Revisá el link e intentá de nuevo.';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
    errorDiv.style.display = 'block';
  }
}

async function recheckMonitor(id) {
  try {
    const res = await fetch(`/api/4see/monitors/${id}/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      await load4seeMonitors();
      // La tabla ya muestra el precio nuevo; solo interrumpimos cuando hay algo para decidir:
      // no se pudo leer (se conserva el dato anterior) o el precio quedo muy distinto del tuyo.
      const { rival, warning } = data;
      if (rival && !rival.ok) {
        await showCustomAlert('No pudimos leer al rival', `${rival.message || 'No pudimos leer el precio de este rival.'} El precio que tenías guardado se mantiene sin cambios.`);
      } else if (warning) {
        await showCustomAlert('Precios muy distintos', `El rival quedó en ${HSFormat.money(rival.price)}. ${warning}`);
      }
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos revisar este rival ahora. Intentá de nuevo en un rato.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error: ${err.message}`);
  }
}

async function deleteMonitor(id) {
  const confirmDelete = await showCustomConfirm('Quitar rival', 'Vas a quitar a este rival.\nQué pasa:\n• Se borra su historial de precios.\n• La sugerencia de precio de tu producto se recalcula sin él.\n• Tu producto sigue en el análisis.');
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/4see/monitors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      load4seeMonitors();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos quitarlo. Intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error: ${err.message}`);
  }
}


// --- Agregar otro rival a un producto que ya existe ---
let addRivalLastPreview = null;

function openAddRivalModal(productId) {
  const product = cached4seeProducts.find((p) => p.id === productId);
  if (!product) return;
  const modal = document.getElementById('addRivalModal');
  document.getElementById('addRivalForm').reset();
  document.getElementById('addRivalProductId').value = productId;
  document.getElementById('addRivalProductLabel').innerText = `Para "${product.name}". Tu precio: ${product.price != null ? HSFormat.money(product.price) : 'sin definir'}.` + (product.in_analysis ? '' : ' Al sumar este rival, el producto pasa a análisis.');
  resetAddRivalPreview();
  modal.classList.remove('hidden');
}
window.openAddRivalModal = openAddRivalModal;

function closeAddRivalModal() {
  document.getElementById('addRivalModal').classList.add('hidden');
}
window.closeAddRivalModal = closeAddRivalModal;

function resetAddRivalPreview() {
  addRivalLastPreview = null;
  document.getElementById('addRivalPreviewBox').classList.add('hidden');
  document.getElementById('addRivalAllowUnreadableRow').classList.add('hidden');
  document.getElementById('addRivalWarning').classList.add('hidden');
  document.getElementById('addRivalError').style.display = 'none';
  document.getElementById('addRivalBtnPreview').classList.remove('hidden');
  document.getElementById('addRivalBtnConfirm').classList.add('hidden');
}
window.resetAddRivalPreview = resetAddRivalPreview;

async function handlePreviewAddRival() {
  const competitorUrl = document.getElementById('addRivalUrl').value.trim();
  const errorDiv = document.getElementById('addRivalError');
  errorDiv.style.display = 'none';
  if (!competitorUrl) {
    errorDiv.innerText = 'Pegá el link del producto del rival.';
    errorDiv.style.display = 'block';
    return;
  }
  const watchedProductId = document.getElementById('addRivalProductId').value;
  const btn = document.getElementById('addRivalBtnPreview');
  const original = btn.innerText;
  btn.innerText = 'Leyendo...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/4see/monitors/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ competitorUrl, watchedProductId })
    });
    const data = await res.json();
    if (!data.success) {
      errorDiv.innerText = data.error || 'No pudimos leer el precio. Intentá de nuevo.';
      errorDiv.style.display = 'block';
      return;
    }
    addRivalLastPreview = data;
    document.getElementById('addRivalPreviewBox').classList.remove('hidden');
    document.getElementById('addRivalBtnPreview').classList.add('hidden');
    document.getElementById('addRivalBtnConfirm').classList.remove('hidden');
    const rivalText = document.getElementById('addRivalPreviewText');
    if (data.rival.ok) {
      const stockTxt = data.rival.inStock === null ? '' : (data.rival.inStock ? ' · con stock' : ' · sin stock');
      rivalText.innerText = `${HSFormat.money(data.rival.price)}${stockTxt}`;
      rivalText.style.color = 'var(--text-main)';
    } else {
      rivalText.innerText = data.rival.message || 'No pudimos leer el precio del rival.';
      rivalText.style.color = 'var(--amber)';
    }
    document.getElementById('addRivalAllowUnreadableRow').classList.toggle('hidden', data.rival.ok);
    document.getElementById('addRivalAllowUnreadable').checked = false;
    const warn = document.getElementById('addRivalWarning');
    if (data.warning) { warn.innerText = data.warning; warn.classList.remove('hidden'); } else { warn.classList.add('hidden'); }
  } catch (err) {
    errorDiv.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
    errorDiv.style.display = 'block';
  } finally {
    btn.innerText = original;
    btn.disabled = false;
  }
}
window.handlePreviewAddRival = handlePreviewAddRival;

async function handleAddRivalSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('addRivalError');
  errorDiv.style.display = 'none';
  if (!addRivalLastPreview) { await handlePreviewAddRival(); return; }
  if (!addRivalLastPreview.rival.ok && !document.getElementById('addRivalAllowUnreadable').checked) {
    errorDiv.innerText = 'No pudimos leer el precio del rival. Revisá el link, o marcá la casilla para guardarlo igual.';
    errorDiv.style.display = 'block';
    return;
  }
  const productId = document.getElementById('addRivalProductId').value;
  const competitorUrl = document.getElementById('addRivalUrl').value.trim();
  const competitorName = document.getElementById('addRivalName').value.trim();
  try {
    const res = await fetch(`/api/4see/watched-products/${productId}/monitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ competitorUrl, competitorName, allowUnreadable: document.getElementById('addRivalAllowUnreadable').checked })
    });
    const data = await res.json();
    if (data.success) {
      closeAddRivalModal();
      load4seeMonitors();
    } else {
      errorDiv.innerText = data.error || 'No pudimos agregar el rival. Intentá de nuevo.';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
    errorDiv.style.display = 'block';
  }
}
window.handleAddRivalSubmit = handleAddRivalSubmit;

// --- Editar un rival ya cargado (link, nombre) ---
function openEditRivalModal(monitorId) {
  const monitor = cached4seeMonitors.find((m) => m.id === monitorId);
  if (!monitor) return;
  document.getElementById('editRivalForm').reset();
  document.getElementById('editRivalId').value = monitorId;
  document.getElementById('editRivalUrl').value = monitor.competitor_url || '';
  document.getElementById('editRivalName').value = monitor.competitor_name || '';
  resetEditRivalConfirm();
  document.getElementById('editRivalModal').classList.remove('hidden');
}
window.openEditRivalModal = openEditRivalModal;

function closeEditRivalModal() {
  document.getElementById('editRivalModal').classList.add('hidden');
}
window.closeEditRivalModal = closeEditRivalModal;

function resetEditRivalConfirm() {
  document.getElementById('editRivalAllowUnreadableRow').classList.add('hidden');
  document.getElementById('editRivalAllowUnreadable').checked = false;
  document.getElementById('editRivalError').style.display = 'none';
}
window.resetEditRivalConfirm = resetEditRivalConfirm;

async function handleEditRivalSubmit(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('editRivalError');
  errorDiv.style.display = 'none';
  const monitorId = document.getElementById('editRivalId').value;
  const competitorUrl = document.getElementById('editRivalUrl').value.trim();
  const competitorName = document.getElementById('editRivalName').value.trim();
  const allowUnreadable = document.getElementById('editRivalAllowUnreadable').checked;
  try {
    const res = await fetch(`/api/4see/monitors/${monitorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ competitorUrl, competitorName, allowUnreadable })
    });
    const data = await res.json();
    if (data.success) {
      closeEditRivalModal();
      load4seeMonitors();
    } else if (data.code === 'RIVAL_UNREADABLE') {
      errorDiv.innerText = data.error || 'No pudimos leer el precio del rival.';
      errorDiv.style.display = 'block';
      document.getElementById('editRivalAllowUnreadableRow').classList.remove('hidden');
    } else {
      errorDiv.innerText = data.error || 'No pudimos guardar los cambios. Intentá de nuevo.';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.innerText = `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`;
    errorDiv.style.display = 'block';
  }
}
window.handleEditRivalSubmit = handleEditRivalSubmit;

// 2. AUDITORÍA DE CATÁLOGO & DIFF VIEW
let cached4seeCatalog = [];
let lastAuditedPlatform = null;
let lastAuditedCredentials = null;

async function load4seeCatalog() {
  const container = document.getElementById('catalogDiffContainer');
  if (!container) return;

  loadSavedStores();

  if (cached4seeCatalog.length > 0) {
    render4seeCatalog(cached4seeCatalog);
    return;
  }

  container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Cargando catálogo auditado...</div>';

  try {
    const res = await fetch('/api/4see/catalog', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (!data.success || !data.items || data.items.length === 0) {
      cached4seeCatalog = [];
      const kpis = document.getElementById('catalogHealthKpis');
      if (kpis) kpis.style.display = 'none';

      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 16px; font-weight: 800; color: var(--text-main);">Conectá tu tienda para revisar tu catálogo</div>
          <div style="font-size: 13px; margin-top: 8px; max-width: 540px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            Conectá tu tienda de Tiendanube o WooCommerce y holospace. revisa tus productos: marca los que no tienen código de barras ni marca y te propone mejores títulos para Google Shopping y los buscadores.
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
            <button class="btn-primary" style="background: var(--emerald); color: var(--hw-accent-fg); font-weight: 800;" onclick="openConnectStoreModal()">Conectar mi tienda</button>
            <button class="btn-secondary" onclick="runDemoCatalogScan()">Probar con datos de ejemplo</button>
          </div>
        </div>
      `;
      return;
    }

    cached4seeCatalog = data.items;
    render4seeCatalog(cached4seeCatalog);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error cargando catálogo: ${err.message}</div>`;
  }
}

function filter4seeCatalog(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    render4seeCatalog(cached4seeCatalog);
    return;
  }
  const filtered = cached4seeCatalog.filter(item => {
    const orig = (item.original_title || item.title || '').toLowerCase();
    const sugg = (item.suggested_title || (item.audit && item.audit.suggested_title) || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const gtin = (item.gtin || item.barcode_gtin || '').toLowerCase();
    return orig.includes(q) || sugg.includes(q) || sku.includes(q) || brand.includes(q) || gtin.includes(q);
  });
  render4seeCatalog(filtered);
}

function updateCatalogKpis(total, optimized, missingGtin, needsReview) {
  const kpisContainer = document.getElementById('catalogHealthKpis');
  if (!kpisContainer) return;
  kpisContainer.style.display = 'grid';

  const elTotal = document.getElementById('kpiTotalAudited');
  const elOpt = document.getElementById('kpiOptimized');
  const elGtin = document.getElementById('kpiMissingGtin');
  const elRev = document.getElementById('kpiNeedsReview');

  if (elTotal) elTotal.innerText = total;
  if (elOpt) elOpt.innerText = optimized;
  if (elGtin) elGtin.innerText = missingGtin;
  if (elRev) elRev.innerText = needsReview;
}

function render4seeCatalog(items = []) {
  const container = document.getElementById('catalogDiffContainer');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
        No se encontraron productos auditados que coincidan con la búsqueda.
      </div>
    `;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 16px; padding: 12px 0;">`;

  items.forEach(item => {
    const auditInfo = item.audit || {};
    const diagnostics = Array.isArray(auditInfo.diagnostics) 
      ? auditInfo.diagnostics 
      : (typeof item.diagnostics === 'string' ? JSON.parse(item.diagnostics) : (item.diagnostics || []));

    const diagBadges = diagnostics.map(d => {
      const bg = d.severity === 'HIGH' ? 'var(--hw-danger-soft)' : 'var(--hw-warning-soft)';
      const color = d.severity === 'HIGH' ? 'var(--red)' : 'var(--amber)';
      return `<span style="background: ${bg}; color: ${color}; border: 1px solid ${color}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; display: inline-block; margin-right: 6px; margin-bottom: 4px;">${d.message}</span>`;
    }).join('');

    const originalTitle = item.original_title || item.title || 'Sin Título';
    const suggestedTitle = auditInfo.suggested_title || item.suggested_title || originalTitle;
    const isApproved = item.is_approved || auditInfo.status === 'OPTIMIZED';
    const itemId = item.id || item.external_id || auditInfo.listing_id;
    const platform = item.platform || 'LOCAL';
    const brand = item.brand || '';
    const suggestedBrand = auditInfo.suggested_brand || item.suggested_brand || '';
    const gtin = item.barcode_gtin || item.gtin || '';
    const suggestedGtin = auditInfo.suggested_gtin || item.suggested_gtin || '';
    const isMissingGtin = !gtin || !/^[0-9]{8,14}$/.test(String(gtin).trim());
    const isMissingBrand = !brand;

    html += `
      <div style="background: var(--hw-surface-2, var(--card-bg)); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px;">
        <!-- Cabecera de la Tarjeta -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size: 11px; font-weight: 800; color: var(--text-main); background: var(--hw-surface-2); padding: 2px 8px; border-radius: 4px;">${platform}</span>
            <span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size: 12px; font-weight: 800; color: var(--emerald); background: var(--hw-accent-soft); padding: 2px 8px; border-radius: 4px;">Código: ${item.sku || 'N/A'}</span>
            ${brand 
              ? `<span style="font-size: 12px; color: var(--text-main); background: var(--hw-surface-2, var(--card-bg)); padding: 2px 8px; border-radius: 4px;">Marca: <strong>${brand}</strong></span>` 
              : `<span style="font-size: 12px; color: var(--amber); font-weight: 800; background: var(--hw-warning-soft); padding: 2px 8px; border-radius: 4px;">Sin marca</span>`}
            ${!isMissingGtin 
              ? `<span style="font-size: 12px; color: var(--text-main); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; background: var(--hw-surface-2, var(--card-bg)); padding: 2px 8px; border-radius: 4px;">EAN: <strong>${gtin}</strong></span>` 
              : `<span style="font-size: 12px; color: var(--red); font-weight: 800; background: var(--hw-danger-soft); padding: 2px 8px; border-radius: 4px;">Sin código de barras</span>`}
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button class="btn-secondary" style="padding: 5px 12px; font-size: 11px;" onclick="openEditProductModal('${itemId}')">Completar datos</button>
            ${isApproved 
              ? '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px; background: var(--hw-accent-soft); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--emerald);">● APROBADO (SIMULACIÓN)</span>' 
              : `<button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="approveCatalogOptimization('${itemId}')">Aprobar título (simulación)</button>`
            }
          </div>
        </div>

        ${diagBadges ? `<div style="margin-bottom: 12px;">${diagBadges}</div>` : ''}

        <!-- Asistente Rápido de Atributos Faltantes (Marca y EAN) -->
        ${(isMissingBrand || isMissingGtin) && !isApproved ? `
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; background: var(--hw-surface-2); border: 1px dashed var(--card-border); border-radius: 10px; padding: 10px 14px;">
            ${isMissingBrand ? `
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 800; color: var(--amber);">Agregar marca:</span>
                <input type="text" id="inline_brand_${itemId}" class="input-field" placeholder="Escribe la marca..." style="padding: 3px 8px; font-size: 12px; max-width: 160px;" value="">
                <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="updateItemBrand('${itemId}', document.getElementById('inline_brand_${itemId}').value)">Asignar</button>
                ${suggestedBrand ? `
                  <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px; color: var(--emerald); border-color: var(--hw-accent-border);" onclick="updateItemBrand('${itemId}', '${suggestedBrand.replace(/'/g, "\\'")}')">Sugerida: "${suggestedBrand}"</button>
                ` : ''}
              </div>
            ` : ''}

            ${isMissingGtin ? `
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 800; color: var(--red);">Agregar código de barras:</span>
                <input type="text" id="inline_gtin_${itemId}" class="input-field" placeholder="8-14 dígitos..." style="padding: 3px 8px; font-size: 12px; max-width: 160px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;" value="">
                <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="updateItemGtin('${itemId}', document.getElementById('inline_gtin_${itemId}').value)">Asignar</button>
                ${suggestedGtin ? `
                  <button class="btn-secondary" style="padding: 3px 8px; font-size: 11px; color: var(--emerald); border-color: var(--hw-accent-border);" onclick="updateItemGtin('${itemId}', '${suggestedGtin}')">Generar EAN interno: ${suggestedGtin}</button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Vista Diff de Título con Edición en Vivo -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 6px;">
          <div style="background: var(--hw-surface-1, var(--card-bg)); border: 1px solid var(--card-border); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Título actual en tu tienda</div>
            <div style="font-size: 13px; color: var(--text-main); font-weight: 600; overflow-wrap: anywhere;">${originalTitle}</div>
          </div>
          <div style="background: var(--hw-surface-1, var(--card-bg)); border: 1px solid var(--hw-accent-border); border-radius: 12px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; color: var(--emerald); text-transform: uppercase; font-weight: 800;">Título mejorado (podés editarlo)</span>
              <span style="font-size: 11px; color: var(--text-muted);">Cambialo como quieras antes de aprobar</span>
            </div>
            ${isApproved 
              ? `<div style="font-size: 13px; color: var(--emerald); font-weight: 600; overflow-wrap: anywhere;">${suggestedTitle}</div>`
              : `<input type="text" class="input-field" style="width: 100%; font-size: 13px; font-weight: 600; color: var(--text-main); border-color: var(--hw-accent-border);" value="${suggestedTitle.replace(/"/g, '&quot;')}" onchange="updateItemSuggestedTitle('${itemId}', this.value)">`
            }
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ============================================================================
// GESTIÓN MULTI-TIENDA PERSISTENTE (4SEE CONNECTED STORES)
// ============================================================================
let cachedSavedStores = [];
let currentSelectedStoreId = null;

async function loadSavedStores() {
  const select = document.getElementById('savedStoresSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/4see/stores', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.stores)) {
      cachedSavedStores = data.stores;
      
      let optionsHtml = `<option value="">Elegí una de tus tiendas (${cachedSavedStores.length})</option>`;
      cachedSavedStores.forEach(s => {
        const isSelected = s.id === currentSelectedStoreId ? 'selected' : '';
        optionsHtml += `<option value="${s.id}" ${isSelected}>${s.name} (${s.platform})</option>`;
      });
      optionsHtml += `<option value="__NEW__">+ Conectar Nueva Tienda...</option>`;
      select.innerHTML = optionsHtml;

      if (!currentSelectedStoreId && cachedSavedStores.length > 0) {
        currentSelectedStoreId = cachedSavedStores[0].id;
        select.value = currentSelectedStoreId;
      }

      updateQuickScanButtonText();
    }
  } catch (err) {
    console.error('Error cargando tiendas conectadas:', err);
  }
}
window.loadSavedStores = loadSavedStores;

function updateQuickScanButtonText() {
  const btn = document.getElementById('btnQuickAuditStore');
  if (!btn) return;

  if (currentSelectedStoreId) {
    const store = cachedSavedStores.find(s => s.id === currentSelectedStoreId);
    if (store) {
      btn.innerText = `Revisar ${store.name} ahora`;
      return;
    }
  }
  btn.innerText = 'Revisar mi tienda ahora';
}

function handleSelectSavedStore(val) {
  if (val === '__NEW__') {
    openConnectStoreModalForNew();
    const select = document.getElementById('savedStoresSelect');
    if (select) select.value = currentSelectedStoreId || '';
    return;
  }
  currentSelectedStoreId = val || null;
  updateQuickScanButtonText();
}
window.handleSelectSavedStore = handleSelectSavedStore;

async function handleQuickScanSelectedStore() {
  if (!currentSelectedStoreId) {
    openConnectStoreModalForNew();
    return;
  }

  const store = cachedSavedStores.find(s => s.id === currentSelectedStoreId);
  const btn = document.getElementById('btnQuickAuditStore');
  const originalText = btn ? btn.innerText : 'Revisar mi tienda ahora';
  if (btn) {
    btn.innerText = `Revisando ${store ? store.name : 'tu tienda'}...`;
    btn.disabled = true;
  }

  const container = document.getElementById('catalogDiffContainer');
  if (container) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Revisando el catálogo de ${store ? store.name : 'tu tienda'}...</div>`;
  }

  try {
    const res = await fetch('/api/4see/store/audit-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ store_id: currentSelectedStoreId, options: { limit: 50 } })
    });

    const data = await res.json();
    if (data.success && data.audit) {
      cached4seeCatalog = data.audit.items || [];
      lastAuditedPlatform = data.platform || (store ? store.platform : 'CUSTOM');
      
      const total = data.audit.total_audited || 0;
      const opt = data.audit.optimized_count || 0;
      const rev = data.audit.needs_review_count || 0;
      const gtin = data.audit.critical_issues_count || 0;

      updateCatalogKpis(total, opt, gtin, rev);
      render4seeCatalog(cached4seeCatalog);
      loadSavedStores(); // Actualizar fecha de último escaneo

      const bulkBar = document.getElementById('catalogBulkBar');
      if (bulkBar) bulkBar.style.display = 'flex';

      await showCustomAlert('Revisión lista', `Revisamos ${total} productos de ${data.store_name || (store ? store.name : 'tu tienda')}.`);
    } else {
      await showCustomAlert('No pudimos revisar la tienda', data.error || 'No pudimos conectarnos a la tienda elegida. Revisá las claves.');
      if (container) container.innerHTML = `<div style="color: var(--red); font-size: 14px; text-align: center; padding: 20px 0;">Error: ${data.error || 'Fallo de conexión'}</div>`;
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', err.message);
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
}
window.handleQuickScanSelectedStore = handleQuickScanSelectedStore;

// Modal Conectar / Editar Tienda
function openConnectStoreModal() {
  const modal = document.getElementById('connectStoreModal');
  if (modal) modal.classList.remove('hidden');
}
window.openConnectStoreModal = openConnectStoreModal;

function openConnectStoreModalForNew() {
  const form = document.getElementById('connectStoreForm');
  if (form) form.reset();
  const idField = document.getElementById('connStoreId');
  if (idField) idField.value = '';
  const title = document.getElementById('connectStoreModalTitle');
  if (title) title.innerText = 'Conectar tu tienda online';
  const btn = document.getElementById('btnRunStoreScan');
  if (btn) btn.innerText = 'Conectar y revisar ahora';
  const saveCheck = document.getElementById('connSaveStore');
  if (saveCheck) saveCheck.checked = true;

  togglePlatformFields(document.getElementById('connPlatform').value);
  openConnectStoreModal();
}
window.openConnectStoreModalForNew = openConnectStoreModalForNew;

function closeConnectStoreModal() {
  const modal = document.getElementById('connectStoreModal');
  if (modal) modal.classList.add('hidden');
}
window.closeConnectStoreModal = closeConnectStoreModal;

function togglePlatformFields(platform) {
  const tnFields = document.getElementById('fieldsTiendanube');
  const wcFields = document.getElementById('fieldsWooCommerce');
  if (platform === 'TIENDANUBE') {
    if (tnFields) tnFields.style.display = 'flex';
    if (wcFields) wcFields.style.display = 'none';
  } else {
    if (tnFields) tnFields.style.display = 'none';
    if (wcFields) wcFields.style.display = 'flex';
  }
}
window.togglePlatformFields = togglePlatformFields;

// Modal Gestionar Tiendas Guardadas
function openManageStoresModal() {
  renderManageStoresList();
  const modal = document.getElementById('manageStoresModal');
  if (modal) modal.classList.remove('hidden');
}
window.openManageStoresModal = openManageStoresModal;

function closeManageStoresModal() {
  const modal = document.getElementById('manageStoresModal');
  if (modal) modal.classList.add('hidden');
}
window.closeManageStoresModal = closeManageStoresModal;

let savedStoresTable = null;
const SAVED_STORES_COLUMNS = [
  {
    key: 'name', label: 'Nombre y dirección', filter: 'text', filterValue: (s) => `${s.name || ''} ${s.store_url || ''}`,
    render: (s) => `<div style="font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 8px;">${escHtml(s.name)}${s.id === currentSelectedStoreId ? '<span style="font-size: 11px; color: var(--emerald); background: var(--hw-accent-soft); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--emerald);">ACTIVA</span>' : ''}</div><div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escHtml(s.store_url || 'N/A')}</div>`
  },
  { key: 'platform', label: 'Plataforma', filter: 'enum', options: [{ value: 'WOOCOMMERCE', label: 'WooCommerce' }, { value: 'TIENDANUBE', label: 'Tiendanube' }], render: (s) => `<span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-size: 11px; font-weight: 800; background: var(--hw-surface-2, var(--card-bg)); padding: 3px 8px; border-radius: 4px;">${escHtml(s.platform)}</span>` },
  { key: 'last_scanned_at', label: 'Última revisión', filter: 'none', render: (s) => (s.last_scanned_at ? `<span style="font-size: 12px; color: var(--text-main);">${new Date(s.last_scanned_at).toLocaleString()}</span>` : '<span style="color: var(--text-muted); font-size: 12px;">Todavía no revisada</span>') }
];

function renderManageStoresList() {
  const container = document.getElementById('savedStoresListContainer');
  if (!container) return;

  if (!savedStoresTable || !container.querySelector('.hs-table-wrap')) {
    savedStoresTable = HSTable.mount({
      id: 'saved_stores',
      container,
      columns: SAVED_STORES_COLUMNS,
      rowKey: (s) => s.id,
      emptyMessage: 'Todavía no tenés tiendas conectadas guardadas.',
      actionsLabel: 'Acciones',
      renderActions: (s) => `
        <div class="data-table-actions" style="display: inline-flex; gap: 6px; white-space: nowrap;">
          <button class="btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="closeManageStoresModal(); currentSelectedStoreId = '${s.id}'; updateQuickScanButtonText(); handleQuickScanSelectedStore();">Revisar ahora</button>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="editStoreConnection('${s.id}')">Editar</button>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px; color: var(--red); border-color: color-mix(in srgb, var(--red) 40%, transparent);" onclick="disconnectStore('${s.id}')">×</button>
        </div>`
    });
  }
  savedStoresTable.update(cachedSavedStores);
}

function editStoreConnection(storeId) {
  const store = cachedSavedStores.find(s => s.id === storeId);
  if (!store) return;

  closeManageStoresModal();

  const idField = document.getElementById('connStoreId');
  if (idField) idField.value = store.id;

  const nameField = document.getElementById('connStoreName');
  if (nameField) nameField.value = store.name;

  const platformField = document.getElementById('connPlatform');
  if (platformField) {
    platformField.value = store.platform;
    togglePlatformFields(store.platform);
  }

  const urlField = document.getElementById('wcStoreUrl');
  if (urlField) urlField.value = store.store_url || '';

  const keyField = document.getElementById('wcConsumerKey');
  if (keyField) keyField.value = store.credentials?.consumer_key || store.credentials?.consumerKey || '';

  const secField = document.getElementById('wcConsumerSecret');
  if (secField) {
    secField.value = '';
    secField.placeholder = '•••••••• (Dejar en blanco para mantener)';
  }

  const tnUser = document.getElementById('tnUserId');
  if (tnUser) tnUser.value = store.credentials?.user_id || store.credentials?.userId || '';

  const tnTok = document.getElementById('tnAccessToken');
  if (tnTok) {
    tnTok.value = '';
    tnTok.placeholder = '•••••••• (Dejar en blanco para mantener)';
  }

  const title = document.getElementById('connectStoreModalTitle');
  if (title) title.innerText = `Editar tienda: ${store.name}`;

  const btn = document.getElementById('btnRunStoreScan');
  if (btn) btn.innerText = 'Guardar cambios y revisar';

  openConnectStoreModal();
}
window.editStoreConnection = editStoreConnection;

async function disconnectStore(storeId) {
  const store = cachedSavedStores.find(s => s.id === storeId);
  const storeName = store ? store.name : 'esta tienda';

  const confirmed = await showCustomConfirm(
    'Desconectar Tienda',
    `¿Estás seguro de que deseas desconectar "${storeName}"? Sus credenciales guardadas se eliminarán del acceso activo.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/4see/stores/${storeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      if (currentSelectedStoreId === storeId) {
        currentSelectedStoreId = null;
      }
      await loadSavedStores();
      renderManageStoresList();
      await showCustomAlert('Tienda desconectada', `"${storeName}" fue desconectada.`);
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos desconectar la tienda. Intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', err.message);
  }
}
window.disconnectStore = disconnectStore;

async function handleConnectStoreSubmit(e) {
  e.preventDefault();
  const storeId = document.getElementById('connStoreId').value.trim();
  const storeName = document.getElementById('connStoreName').value.trim();
  const platform = document.getElementById('connPlatform').value;
  const saveStore = document.getElementById('connSaveStore') ? document.getElementById('connSaveStore').checked : true;
  const btn = document.getElementById('btnRunStoreScan');

  let credentials = {};
  let storeUrl = '';

  if (platform === 'TIENDANUBE') {
    credentials.userId = document.getElementById('tnUserId').value.trim();
    credentials.accessToken = document.getElementById('tnAccessToken').value.trim();
    storeUrl = `https://tiendanube.com/store/${credentials.userId}`;
    if (!credentials.userId) {
      await showCustomAlert('Falta un dato', 'Cargá el número de tu tienda en Tiendanube.');
      return;
    }
  } else {
    storeUrl = document.getElementById('wcStoreUrl').value.trim();
    credentials.storeUrl = storeUrl;
    credentials.consumerKey = document.getElementById('wcConsumerKey').value.trim();
    credentials.consumerSecret = document.getElementById('wcConsumerSecret').value.trim();
    if (!credentials.storeUrl) {
      await showCustomAlert('Falta un dato', 'Cargá la dirección de tu tienda WooCommerce.');
      return;
    }
  }

  if (btn) btn.innerText = 'Guardando y revisando...';

  try {
    let activeStoreId = storeId || null;

    // Si está marcado guardar o ya tiene ID, persistir en /api/4see/stores
    if (saveStore || activeStoreId) {
      const storePayload = {
        id: activeStoreId || undefined,
        name: storeName || storeUrl,
        platform,
        store_url: storeUrl,
        credentials
      };
      const resStore = await fetch('/api/4see/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(storePayload)
      });
      const dataStore = await resStore.json();
      if (dataStore.success && dataStore.store) {
        activeStoreId = dataStore.store.id;
        currentSelectedStoreId = activeStoreId;
      }
    }

    // Ejecutar auditoría on-the-fly
    const auditBody = activeStoreId 
      ? { store_id: activeStoreId, options: { limit: 50 } }
      : { platform, credentials, options: { limit: 50 } };

    const resAudit = await fetch('/api/4see/store/audit-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(auditBody)
    });

    const dataAudit = await resAudit.json();
    if (dataAudit.success && dataAudit.audit) {
      closeConnectStoreModal();
      lastAuditedPlatform = platform;
      lastAuditedCredentials = credentials;
      cached4seeCatalog = dataAudit.audit.items || [];
      
      const total = dataAudit.audit.total_audited || 0;
      const opt = dataAudit.audit.optimized_count || 0;
      const rev = dataAudit.audit.needs_review_count || 0;
      const gtin = dataAudit.audit.critical_issues_count || 0;

      updateCatalogKpis(total, opt, gtin, rev);
      render4seeCatalog(cached4seeCatalog);
      await loadSavedStores();

      const bulkBar = document.getElementById('catalogBulkBar');
      if (bulkBar) bulkBar.style.display = 'flex';

      await showCustomAlert('Tienda conectada', `La tienda "${storeName || storeUrl}" quedó conectada y revisamos ${total} productos.`);
    } else {
      await showCustomAlert('No pudimos revisar la tienda', dataAudit.error || 'No pudimos revisar la tienda. Revisá las claves e intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Sin conexión', err.message);
  } finally {
    if (btn) btn.innerText = 'Conectar y revisar ahora';
  }
}
window.handleConnectStoreSubmit = handleConnectStoreSubmit;
window.runDemoCatalogScan = runDemoCatalogScan;

// Cargar muestra de catálogo Demo on-the-fly para visualización inmediata
async function runDemoCatalogScan() {
  closeConnectStoreModal();
  const container = document.getElementById('catalogDiffContainer');
  if (container) container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Preparando los datos de ejemplo...</div>';

  const demoItems = [
    {
      id: 'demo-1',
      platform: 'TIENDANUBE',
      name: 'Ginebra clásica botánica',
      brand: 'London Spirit',
      price: 12500,
      stock: 18,
      sku: 'GIN-LON-01',
      barcode: '7791234567890',
      seo_title: 'Ginebra Botánica 750ml',
      seo_description: 'Ginebra premium destilada artesanalmente.'
    },
    {
      id: 'demo-2',
      platform: 'TIENDANUBE',
      name: 'Vino Tinto',
      brand: '',
      price: 8900,
      stock: 5,
      sku: 'VIN-MAL-02',
      barcode: '',
      seo_title: '',
      seo_description: ''
    },
    {
      id: 'demo-3',
      platform: 'WOOCOMMERCE',
      name: 'Whisky Escocés 12 Años Malta Pura',
      brand: 'Highland Park',
      price: 45000,
      stock: 3,
      sku: 'WKY-ESC-12',
      barcode: '5010106113127',
      seo_title: 'Whisky 12 Años',
      seo_description: 'Whisky escocés añejado en roble.'
    },
    {
      id: 'demo-4',
      platform: 'WOOCOMMERCE',
      name: 'Cerveza IPA',
      brand: 'Patagonia Cervecería',
      price: 2100,
      stock: 40,
      sku: 'CER-IPA-473',
      barcode: '',
      seo_title: '',
      seo_description: ''
    }
  ];

  try {
    const res = await fetch('/api/4see/store/audit-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ raw_items: demoItems })
    });

    const data = await res.json();
    if (data.success && data.audit) {
      cached4seeCatalog = data.audit.items || [];
      const total = data.audit.total_audited || 0;
      const opt = data.audit.optimized_count || 0;
      const rev = data.audit.needs_review_count || 0;
      const gtin = data.audit.critical_issues_count || 0;

      updateCatalogKpis(total, opt, gtin, rev);
      render4seeCatalog(cached4seeCatalog);
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error: ${err.message}</div>`;
  }
}

function openAuditItemModal() {
  const modal = document.getElementById('auditItemModal');
  if (modal) {
    document.getElementById('auditItemForm').reset();
    modal.classList.remove('hidden');
  }
}

function closeAuditItemModal() {
  const modal = document.getElementById('auditItemModal');
  if (modal) modal.classList.add('hidden');
}

async function handleAuditItemSubmit(e) {
  e.preventDefault();
  const sku = document.getElementById('catSku').value.trim();
  const title = document.getElementById('catTitle').value.trim();
  const brand = document.getElementById('catBrand').value.trim();
  const gtin = document.getElementById('catGtin').value.trim();
  const btn = e.target.querySelector('button[type="submit"]');

  if (btn) btn.innerText = 'Revisando el producto...';

  try {
    const res = await fetch('/api/4see/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ sku, title, brand, gtin })
    });
    const data = await res.json();
    if (data.success) {
      closeAuditItemModal();
      load4seeCatalog();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos revisar el producto. Intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  } finally {
    if (btn) btn.innerText = 'Revisar este producto';
  }
}

function reAuditItemInMemory(item) {
  if (!item) return;
  const diagnostics = [];
  const gtin = String(item.barcode_gtin || item.gtin || '').trim();
  const brand = String(item.brand || '').trim();
  const title = String(item.suggested_title || item.original_title || item.title || '').trim();

  // 1. GTIN
  if (!/^[0-9]{8,14}$/.test(gtin)) {
    diagnostics.push({
      code: 'MISSING_GTIN',
      severity: 'HIGH',
      field: 'barcode_gtin',
      message: 'Falta el código de barras (EAN-13). Sin él, Google Shopping y otros canales pueden rechazar el producto.'
    });
  }

  // 2. Marca
  if (!brand) {
    diagnostics.push({
      code: 'MISSING_BRAND',
      severity: 'MEDIUM',
      field: 'brand',
      message: 'Falta la marca del producto. Sin marca cuesta más que te encuentren y filtrar por ella.'
    });
  }

  // 3. Título
  if (title.length < 20) {
    diagnostics.push({
      code: 'SHORT_TITLE',
      severity: 'LOW',
      field: 'title',
      message: 'El título es muy corto (menos de 20 caracteres). Uno más descriptivo ayuda a vender.'
    });
  }

  if (!item.audit) item.audit = {};
  item.audit.diagnostics = diagnostics;
  item.audit.has_critical_issues = diagnostics.some(d => d.severity === 'HIGH');
  item.audit.status = diagnostics.length === 0 ? 'OPTIMIZED' : 'NEEDS_REVIEW';

  // Recalcular KPIs globales
  const total = cached4seeCatalog.length;
  const opt = cached4seeCatalog.filter(i => i.is_approved || (i.audit && i.audit.status === 'OPTIMIZED')).length;
  const rev = Math.max(0, total - opt);
  const missingGtin = cached4seeCatalog.filter(i => {
    const g = String(i.barcode_gtin || i.gtin || '').trim();
    return !/^[0-9]{8,14}$/.test(g);
  }).length;

  updateCatalogKpis(total, opt, missingGtin, rev);
  render4seeCatalog(cached4seeCatalog);
}

function updateItemSuggestedTitle(id, newTitle) {
  const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
  if (item) {
    const clean = newTitle.trim();
    if (item.audit) item.audit.suggested_title = clean;
    item.suggested_title = clean;
    reAuditItemInMemory(item);
  }
}
window.updateItemSuggestedTitle = updateItemSuggestedTitle;

function updateItemBrand(id, newBrand) {
  const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
  if (item) {
    const clean = newBrand.trim();
    item.brand = clean;
    if (item.audit) item.audit.current_brand = clean;
    
    // Si el título no tenía la marca o fue generado automáticamente, sugerir incorporarla
    if (clean && item.suggested_title && !item.suggested_title.toUpperCase().includes(clean.toUpperCase())) {
      item.suggested_title = `${clean.toUpperCase()} ${item.suggested_title}`;
      if (item.audit) item.audit.suggested_title = item.suggested_title;
    }

    reAuditItemInMemory(item);
    showCustomAlert('Marca guardada', `Marca "${clean}" guardada para el producto ${item.sku || id}.`);
  }
}
window.updateItemBrand = updateItemBrand;

function updateItemGtin(id, newGtin) {
  const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
  if (item) {
    const clean = newGtin.trim();
    item.barcode_gtin = clean;
    item.gtin = clean;
    if (item.audit) item.audit.current_gtin = clean;
    reAuditItemInMemory(item);
    showCustomAlert('Código de barras guardado', `Código ${clean} guardado para el producto ${item.sku || id}.`);
  }
}
window.updateItemGtin = updateItemGtin;

// Modal Completo de Edición y Carga de Atributos
let currentEditingProductItem = null;

function openEditProductModal(itemId) {
  const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === itemId);
  if (!item) return;

  currentEditingProductItem = item;
  const auditInfo = item.audit || {};

  document.getElementById('editAttrItemId').value = itemId;
  document.getElementById('editAttrSubtitle').innerText = `Código: ${item.sku || 'sin código'} | Tienda: ${item.platform || 'ejemplo'}`;

  // Título
  const origTitle = item.original_title || item.title || '';
  const suggTitle = auditInfo.suggested_title || item.suggested_title || origTitle;
  document.getElementById('editAttrOriginalTitle').innerText = origTitle || 'Sin título';
  document.getElementById('editAttrTitleInput').value = item.suggested_title || suggTitle;

  const titleSugBox = document.getElementById('editAttrTitleSuggestionBox');
  const titleSugTxt = document.getElementById('editAttrSuggestedTitleText');
  if (suggTitle && suggTitle !== origTitle) {
    titleSugTxt.innerText = suggTitle;
    titleSugBox.style.display = 'flex';
  } else {
    titleSugBox.style.display = 'none';
  }

  // Marca
  const curBrand = item.brand || '';
  const suggBrand = auditInfo.suggested_brand || item.suggested_brand || '';
  document.getElementById('editAttrCurrentBrandBadge').innerText = curBrand ? `Actual: ${curBrand}` : 'Sin marca';
  document.getElementById('editAttrBrandInput').value = curBrand || suggBrand;

  const brandSugBox = document.getElementById('editAttrBrandSuggestionBox');
  const brandSugTxt = document.getElementById('editAttrSuggestedBrandText');
  if (suggBrand && suggBrand !== curBrand) {
    brandSugTxt.innerText = suggBrand;
    brandSugBox.style.display = 'flex';
  } else {
    brandSugBox.style.display = 'none';
  }

  // GTIN / EAN
  const curGtin = item.barcode_gtin || item.gtin || '';
  const suggGtin = auditInfo.suggested_gtin || item.suggested_gtin || '';
  const gtinBadge = document.getElementById('editAttrGtinStatusBadge');
  if (/^[0-9]{8,14}$/.test(curGtin)) {
    gtinBadge.innerText = '● Código de barras válido';
    gtinBadge.style.color = 'var(--emerald)';
  } else {
    gtinBadge.innerText = '● Falta o no es válido';
    gtinBadge.style.color = 'var(--red)';
  }
  document.getElementById('editAttrGtinInput').value = curGtin || suggGtin;

  const gtinSugBox = document.getElementById('editAttrGtinSuggestionBox');
  const gtinSugTxt = document.getElementById('editAttrSuggestedGtinText');
  if (suggGtin && suggGtin !== curGtin) {
    gtinSugTxt.innerText = suggGtin;
    gtinSugBox.style.display = 'flex';
  } else {
    gtinSugBox.style.display = 'none';
  }

  const modal = document.getElementById('editProductAttributesModal');
  if (modal) modal.classList.remove('hidden');
}
window.openEditProductModal = openEditProductModal;

function closeEditProductModal() {
  const modal = document.getElementById('editProductAttributesModal');
  if (modal) modal.classList.add('hidden');
  currentEditingProductItem = null;
}
window.closeEditProductModal = closeEditProductModal;

function applyFieldSuggestion(field) {
  if (!currentEditingProductItem) return;
  const auditInfo = currentEditingProductItem.audit || {};

  if (field === 'title') {
    const suggTitle = auditInfo.suggested_title || currentEditingProductItem.suggested_title || '';
    if (suggTitle) document.getElementById('editAttrTitleInput').value = suggTitle;
  } else if (field === 'brand') {
    const suggBrand = auditInfo.suggested_brand || currentEditingProductItem.suggested_brand || '';
    if (suggBrand) document.getElementById('editAttrBrandInput').value = suggBrand;
  } else if (field === 'gtin') {
    const suggGtin = auditInfo.suggested_gtin || currentEditingProductItem.suggested_gtin || '';
    if (suggGtin) document.getElementById('editAttrGtinInput').value = suggGtin;
  }
}
window.applyFieldSuggestion = applyFieldSuggestion;

function handleSaveProductAttributes(e) {
  e.preventDefault();
  if (!currentEditingProductItem) return;

  const newTitle = document.getElementById('editAttrTitleInput').value.trim();
  const newBrand = document.getElementById('editAttrBrandInput').value.trim();
  const newGtin = document.getElementById('editAttrGtinInput').value.trim();

  currentEditingProductItem.suggested_title = newTitle;
  if (currentEditingProductItem.audit) currentEditingProductItem.audit.suggested_title = newTitle;

  currentEditingProductItem.brand = newBrand;
  if (currentEditingProductItem.audit) currentEditingProductItem.audit.current_brand = newBrand;

  currentEditingProductItem.barcode_gtin = newGtin;
  currentEditingProductItem.gtin = newGtin;
  if (currentEditingProductItem.audit) currentEditingProductItem.audit.current_gtin = newGtin;

  reAuditItemInMemory(currentEditingProductItem);
  closeEditProductModal();
  showCustomAlert('Cambios guardados', `El producto ${currentEditingProductItem.sku || ''} se actualizó y lo volvimos a revisar.`);
}
window.handleSaveProductAttributes = handleSaveProductAttributes;

// Aprobación en Modo Mock Seguro (Sin mutaciones en la tienda real)
async function approveCatalogOptimization(id) {
  const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
  if (item) {
    item.is_approved = true;
    if (item.audit) item.audit.status = 'OPTIMIZED';

    // Recalcular KPIs en caliente
    const total = cached4seeCatalog.length;
    const opt = cached4seeCatalog.filter(i => i.is_approved || (i.audit && i.audit.status === 'OPTIMIZED')).length;
    const rev = Math.max(0, total - opt);
    const gtin = cached4seeCatalog.filter(i => {
      const g = i.barcode_gtin || i.gtin;
      return !g || !/^[0-9]{8,14}$/.test(String(g).trim());
    }).length;
    updateCatalogKpis(total, opt, gtin, rev);

    render4seeCatalog(cached4seeCatalog);
    await showCustomAlert(
      'Aprobado (Modo Simulación)',
      `Aprobaste el título sugerido (simulación).\n\n Modo de prueba: no cambiamos nada en tu tienda real (${item.platform || 'E-Commerce'}).`
    );
  }
}
window.approveCatalogOptimization = approveCatalogOptimization;

// Aprobación Masiva en Modo Mock
async function bulkApproveCatalogMock() {
  if (cached4seeCatalog.length === 0) {
    await showCustomAlert('Nada para aprobar', 'Primero revisá tu tienda para tener productos que aprobar.');
    return;
  }

  let count = 0;
  cached4seeCatalog.forEach(item => {
    if (!item.is_approved) {
      item.is_approved = true;
      if (item.audit) item.audit.status = 'OPTIMIZED';
      count++;
    }
  });

  const total = cached4seeCatalog.length;
  const gtin = cached4seeCatalog.filter(i => {
    const g = i.barcode_gtin || i.gtin;
    return !g || !/^[0-9]{8,14}$/.test(String(g).trim());
  }).length;
  updateCatalogKpis(total, total, gtin, 0);

  render4seeCatalog(cached4seeCatalog);
  await showCustomAlert(
    'Aprobación Masiva Completada',
    `Aprobaste ${count} productos en simulación.\n\n Modo de prueba: tu tienda sigue igual.`
  );
}
window.bulkApproveCatalogMock = bulkApproveCatalogMock;

// Exportar Reporte de Auditoría a CSV
function exportCatalogAuditCsv() {
  if (cached4seeCatalog.length === 0) {
    showCustomAlert('Nada para descargar', 'Primero revisá tu tienda para poder descargar el informe.');
    return;
  }

  const headers = ['ID_Externo', 'Plataforma', 'SKU', 'Marca', 'GTIN_EAN', 'Titulo_Original', 'Titulo_Optimizado', 'Estado', 'Problemas_Detectados'];
  const rows = cached4seeCatalog.map(item => {
    const auditInfo = item.audit || {};
    const diag = (auditInfo.diagnostics || []).map(d => d.code).join('; ');
    const orig = (item.original_title || item.title || '').replace(/"/g, '""');
    const sugg = (auditInfo.suggested_title || item.suggested_title || '').replace(/"/g, '""');
    return [
      `"${item.id || item.external_id || ''}"`,
      `"${item.platform || 'CUSTOM'}"`,
      `"${item.sku || ''}"`,
      `"${item.brand || ''}"`,
      `"${item.barcode_gtin || item.gtin || ''}"`,
      `"${orig}"`,
      `"${sugg}"`,
      `"${item.is_approved ? 'OPTIMIZADO_APROBADO' : (auditInfo.status || 'NEEDS_REVIEW')}"`,
      `"${diag}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `auditoria_catalogo_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportCatalogAuditCsv = exportCatalogAuditCsv;

// 3. GUARDIÁN DE RENTABILIDAD & MÁRGENES
let cached4seeQueue = [];

async function load4seeSmartPriceQueue() {
  const container = document.getElementById('smartpriceQueueContainer');
  if (!container) return;

  container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; padding: 20px 0; text-align: center;">Cargando precios sugeridos...</div>';

  try {
    const res = await fetch('/api/4see/queue', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.queue)) {
      cached4seeQueue = data.queue;
      render4seeQueueTable(cached4seeQueue);
      updateSmartPriceKpis(cached4seeQueue);
    } else {
      container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error al cargar sugerencias: ${data.error || 'Desconocido'}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error de conexión: ${err.message}</div>`;
  }
}
window.load4seeSmartPriceQueue = load4seeSmartPriceQueue;

function updateSmartPriceKpis(queue = []) {
  const pending = queue.filter(q => q.status === 'PENDING').length;
  const applied = queue.filter(q => q.status === 'APPLIED').length;
  const shielded = queue.filter(q => Boolean(q.floor_applied)).length;

  const kPending = document.getElementById('kpiQueuePending');
  const kApplied = document.getElementById('kpiQueueApplied');
  const kShielded = document.getElementById('kpiFloorShielded');

  if (kPending) kPending.innerText = pending;
  if (kApplied) kApplied.innerText = applied;
  if (kShielded) kShielded.innerText = shielded;
  renderSmartPriceDashboard(queue);
}



function renderSmartPriceDashboard(queue = []) {
  if (typeof HSCharts === 'undefined') return;
  const empty = document.getElementById('smartpriceDashEmpty');
  const count = (s) => queue.filter(q => q.status === s).length;
  const hasData = queue.length > 0;
  if (empty) empty.classList.toggle('hidden', hasData);
  if (!hasData) return;

  HSCharts.track('chartQueueStatus', () => HSCharts.build.donut({
    centerLabel: String(queue.length),
    items: [
      { name: 'Para decidir', value: count('PENDING'), tone: 'pending' },
      { name: 'Aplicado', value: count('APPLIED'), tone: 'applied' },
      { name: 'Descartado', value: count('REJECTED'), tone: 'neutral' }
    ].filter(i => i.value > 0)
  })).catch(() => {});

  const rows = queue.slice(0, 12).map(q => ({
    name: (q.product_title || 'Producto').toString().slice(0, 16),
    floor: parseFloat(q.min_price_floor || 0),
    previous: parseFloat(q.previous_price || 0),
    suggested: parseFloat(q.suggested_price || 0)
  }));
  HSCharts.track('chartQueueFloor', () => HSCharts.build.floorBand({ rows })).catch(() => {});
}

// Monitor de Precios: alternar tabla / dashboard


function renderMonitorsDashboard(monitors = []) {
  if (typeof HSCharts === 'undefined') return;
  const empty = document.getElementById('monitorsDashEmpty');
  if (empty) empty.classList.toggle('hidden', monitors.length > 0);
  if (!monitors.length) return;

  const out = monitors.filter(m => m.competitor_stock === 'OUT_OF_STOCK').length;
  HSCharts.track('chartMonStock', () => HSCharts.build.donut({
    centerLabel: String(monitors.length),
    items: [
      { name: 'Con stock', value: monitors.length - out, tone: 'applied' },
      { name: 'Sin stock', value: out, tone: 'risk' }
    ].filter(i => i.value > 0)
  })).catch(() => {});

  const byProduct = new Map();
  monitors.forEach(m => {
    const key = m.product_name || 'Producto';
    if (!byProduct.has(key)) byProduct.set(key, { name: key.slice(0, 16), mine: parseFloat(m.my_price || 0), rivals: [] });
    byProduct.get(key).rivals.push({ name: m.competitor_name || 'Rival', price: parseFloat(m.competitor_price || 0) });
  });
  const rows = Array.from(byProduct.values()).slice(0, 12);
  HSCharts.track('chartMonPrices', () => HSCharts.build.priceVsRivals({ rows })).catch(() => {});
}

function filter4seeQueue(queryText) {
  const q = (queryText || '').toLowerCase().trim();
  if (!q) {
    render4seeQueueTable(cached4seeQueue);
    return;
  }
  const filtered = cached4seeQueue.filter(item => {
    const sku = (item.sku || '').toLowerCase();
    const title = (item.product_title || '').toLowerCase();
    const rule = (item.rule_name || '').toLowerCase();
    const status = (item.status || '').toLowerCase();
    return sku.includes(q) || title.includes(q) || rule.includes(q) || status.includes(q);
  });
  render4seeQueueTable(filtered);
}
window.filter4seeQueue = filter4seeQueue;

let smartpriceQueueTable = null;
const QUEUE_STATUS_ES = { PENDING: 'Para decidir', APPLIED: 'Aplicado', REJECTED: 'Descartado' };
const SMARTPRICE_QUEUE_COLUMNS = [
  {
    key: 'product', label: 'Producto', filter: 'text', filterValue: (q) => `${q.product_title || ''} ${q.sku || ''}`,
    render: (q) => `<strong style="color: var(--text-main); display: block;">${escHtml(q.product_title || 'Producto')}</strong><span style="font-size: 11px; color: var(--text-muted); font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">Código: ${escHtml(q.sku || '-')}</span>`
  },
  {
    key: 'min_price_floor', label: 'Piso de margen', filter: 'none',
    render: (q) => `<span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-weight: 800; color: var(--emerald);">${HSFormat.moneyHtml(parseFloat(q.min_price_floor || 0))}</span>${q.floor_applied ? '<span style="display: block; font-size: 11px; color: var(--amber); font-weight: 800; margin-top: 2px;">Frenado en tu piso de margen</span>' : ''}`
  },
  { key: 'previous_price', label: 'Precio actual', filter: 'none', render: (q) => `<span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-weight: 700; color: var(--text-muted);">${HSFormat.moneyHtml(parseFloat(q.previous_price || 0))}</span>` },
  { key: 'suggested_price', label: 'Precio sugerido', filter: 'none', render: (q) => `<span style="font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace; font-weight: 900; color: var(--text-main); font-size: 14px;">${HSFormat.moneyHtml(parseFloat(q.suggested_price || 0))}</span>` },
  { key: 'rule_name', label: 'Regla usada', filter: 'text', render: (q) => `<span style="font-size: 12px; color: var(--text-main);">${escHtml(q.rule_name || (q.floor_applied ? 'Frenado en tu piso de margen' : 'Regla por defecto: acercarte al más barato'))}</span>` },
  {
    key: 'status', label: 'Estado', filter: 'enum', options: Object.values(QUEUE_STATUS_ES).map((v) => ({ value: v, label: v })),
    filterValue: (q) => QUEUE_STATUS_ES[q.status] || q.status,
    render: (q) => {
      if (q.status === 'PENDING') return '<span class="status-indicator" style="color: var(--hw-chart1); font-weight: 800; font-size: 11px;">● Para decidir</span>';
      if (q.status === 'APPLIED') return '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px;">Aplicado</span>';
      if (q.status === 'REJECTED') return '<span class="status-indicator" style="color: var(--text-muted); font-weight: 800; font-size: 11px;">× Descartado</span>';
      return `<span class="status-indicator" style="color: var(--amber); font-weight: 800; font-size: 11px;">${escHtml(q.status)}</span>`;
    }
  }
];

function render4seeQueueTable(items = []) {
  const container = document.getElementById('smartpriceQueueContainer');
  if (!container) return;

  if (!smartpriceQueueTable || !container.querySelector('.hs-table-wrap')) {
    smartpriceQueueTable = HSTable.mount({
      id: '4see_smartprice_queue',
      container,
      columns: SMARTPRICE_QUEUE_COLUMNS,
      rowKey: (q) => q.id,
      emptyHtml: 'No hay precios para decidir por ahora. Apretá <strong>Revisar precios ahora</strong> para compararte con tus rivales.',
      actionsLabel: 'Acciones',
      renderActions: (q) => (q.status === 'PENDING'
        ? `<div class="data-table-actions" style="display: inline-flex; gap: 6px;">
             <button class="btn-secondary" style="padding: 6px 12px; font-size: 11px;" onclick="handleApproveQueueItem('${q.id}')">Aplicar</button>
             <button class="btn-danger" style="padding: 6px 10px; font-size: 11px;" onclick="handleRejectQueueItem('${q.id}')">Descartar</button>
           </div>`
        : `<span style="color: var(--text-muted); font-size: 11px; font-family: var(--hw-font-mono, 'Geist Mono'), ui-monospace, monospace;">Ya resuelto</span>`)
    });
  }
  smartpriceQueueTable.update(items);
}

async function handleApproveQueueItem(queueId) {
  try {
    const res = await fetch(`/api/4see/queue/${queueId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    const data = await res.json();
    if (data.success) {
      await showCustomAlert('Precio aplicado', `Aplicamos el nuevo precio: ${HSFormat.money(parseFloat(data.newPrice))}`);
      load4seeSmartPriceQueue();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos aplicar el precio. Intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  }
}
window.handleApproveQueueItem = handleApproveQueueItem;

async function handleRejectQueueItem(queueId) {
  try {
    const res = await fetch(`/api/4see/queue/${queueId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    const data = await res.json();
    if (data.success) {
      load4seeSmartPriceQueue();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos descartar la sugerencia. Intentá de nuevo.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  }
}
window.handleRejectQueueItem = handleRejectQueueItem;

async function handleTriggerWorkerCycle() {
  const btn = document.getElementById('btnRunWorkerCycle');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Revisando precios...';
  }

  try {
    const res = await fetch('/api/4see/worker/run-cycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    const data = await res.json();

    if (data.success) {
      const s = data.summary || {};
      await showCustomAlert('Revisión lista', `Revisamos ${s.totalMappingsProcessed || 0} productos contra sus rivales.\nPrecios nuevos para decidir: ${s.priceUpdatesQueued || 0}\nPrecios aplicados sin aprobación: ${s.autoDispatchesExecuted || 0}`);
      load4seeSmartPriceQueue();
    } else {
      await showCustomAlert('Aviso', data.reason === 'CYCLE_ALREADY_IN_PROGRESS' ? 'Ya estamos revisando precios. Esperá unos minutos.' : (data.error || 'No pudimos revisar los precios ahora. Intentá de nuevo.'));
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Revisar precios ahora';
    }
  }
}
window.handleTriggerWorkerCycle = handleTriggerWorkerCycle;

// Modales de Producto y Reglas
// --- Alta de producto: tres caminos (link, tienda conectada, a mano). Lo leido se muestra antes de guardar. ---
const intake = { mode: 'link', reading: null, storeProduct: null, url: '', edit: null };
const intakeEl = (id) => document.getElementById(id);

function showIntakeNotice(message, { manual = false } = {}) {
  const box = intakeEl('intakeNotice');
  box.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  box.appendChild(text);
  if (manual) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary';
    btn.textContent = 'Cargar a mano';
    btn.onclick = () => setIntakeMode('manual');
    box.appendChild(btn);
  }
  box.hidden = false;
}

function clearIntakeNotice() {
  const box = intakeEl('intakeNotice');
  box.hidden = true;
  box.innerHTML = '';
}

function intakeStockText(inStock) {
  if (inStock === true) return 'Con stock';
  if (inStock === false) return 'Sin stock';
  return 'La fuente no informa el stock.';
}

function showIntakeData({ title = '', sku = '', priceText = '', sourceText = '', stockText = '' } = {}) {
  const manual = intake.mode === 'manual';
  intakeEl('intakeData').hidden = false;
  // Al editar, el nombre y el código que ya tiene el producto no se pisan con los de la fuente
  intakeEl('intakeTitle').value = intake.edit ? (intakeEl('intakeTitle').value || title) : title;
  intakeEl('intakeSku').value = intake.edit ? (intakeEl('intakeSku').value || sku) : sku;
  if (!intake.edit) intakeEl('intakePrice').value = '';
  intakeEl('intakePriceManual').hidden = !manual;
  intakeEl('intakePriceRead').hidden = manual;
  intakeEl('intakePriceReadText').textContent = priceText;
  intakeEl('intakeSourceText').textContent = sourceText;
  intakeEl('intakeStockText').textContent = stockText;
  updateIntakeSaveState();
}

function hideIntakeData() {
  intakeEl('intakeData').hidden = true;
  updateIntakeSaveState();
}

function updateIntakeSaveState() {
  const title = intakeEl('intakeTitle').value.trim();
  let ready = false;
  if (!intakeEl('intakeData').hidden && title) {
    if (intake.mode === 'link') ready = Boolean(intake.reading);
    else if (intake.mode === 'store') ready = Boolean(intake.storeProduct);
    else ready = HSFields.readMoney(intakeEl('intakePrice')) > 0;
  }
  intakeEl('intakeSaveBtn').disabled = !ready;
}
window.updateIntakeSaveState = updateIntakeSaveState;

function renderIntakeStorePanel() {
  populateMyStoreSelect('prod');
  intakeEl('prodMyStoreSelect').options[0].textContent = 'Elegí una tienda';
  intakeEl('intakeStoreEmpty').hidden = cachedSavedStores.length > 0;
}

function setIntakeMode(mode) {
  intake.mode = mode;
  intake.reading = null;
  intake.storeProduct = null;
  [['link', 'intakeTabLink', 'intakePanelLink'], ['store', 'intakeTabStore', 'intakePanelStore'], ['manual', 'intakeTabManual', null]].forEach(([m, tabId, panelId]) => {
    const active = m === mode;
    const tab = intakeEl(tabId);
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    if (panelId) intakeEl(panelId).hidden = !active;
  });
  clearIntakeNotice();
  if (mode === 'manual') showIntakeData(); else hideIntakeData();
  if (mode === 'store') renderIntakeStorePanel();
  const focusTarget = intakeEl(mode === 'link' ? 'intakeUrl' : mode === 'manual' ? 'intakeTitle' : 'prodMyStoreSelect');
  if (focusTarget) focusTarget.focus();
}
window.setIntakeMode = setIntakeMode;

function setIntakeTexts() {
  const editing = Boolean(intake.edit);
  intakeEl('intakeModalTitle').textContent = editing ? 'Editar producto' : 'Agregar un producto';
  intakeEl('intakeModalHint').textContent = editing ? 'Cambiá lo que necesites. Si cambiás de dónde sale el precio, lo leemos antes de guardar.' : 'Cada producto se carga una sola vez. Elegí cómo.';
  intakeEl('intakeSaveBtn').textContent = editing ? 'Guardar cambios' : 'Guardar producto';
}

// Si cambia el link despues de leerlo, la lectura anterior ya no vale
function handleIntakeUrlInput() {
  if (intake.mode !== 'link' || !intake.reading) return;
  if (intakeEl('intakeUrl').value.trim() !== intake.url) {
    intake.reading = null;
    clearIntakeNotice();
    hideIntakeData();
  }
}
window.handleIntakeUrlInput = handleIntakeUrlInput;

// Editar usa el mismo formulario del alta, con las mismas tres fuentes
function openEditCatalogItem(productId) {
  const p = flowProducts.find((x) => x.id === productId);
  const modal = intakeEl('createProductModal');
  if (!p || !modal) return;
  intakeEl('createProductForm').reset();
  intake.edit = { id: p.id };
  const mode = p.own_url ? 'link' : (p.store_id && p.external_id ? 'store' : 'manual');
  setIntakeTexts();
  renderCostsContext(p, 'intakeContext');
  modal.classList.remove('hidden');
  setIntakeMode(mode);
  intakeEl('intakeTitle').value = p.title || '';
  intakeEl('intakeSku').value = p.sku || '';
  const money = p.price != null ? HSFormat.money(p.price) : 'Sin precio';
  const stockText = '';
  if (mode === 'link') {
    intakeEl('intakeUrl').value = p.own_url;
    intake.url = p.own_url;
    intake.reading = { current: true };
    showIntakeData({ priceText: money, sourceText: 'Leído de tu link. Tocá "Leer link" para volver a leerlo.', stockText });
  } else if (mode === 'manual') {
    showIntakeData();
    intakeEl('intakePrice').value = p.price != null ? Number(p.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    updateIntakeSaveState();
  } else {
    ensureConnectedStoresLoaded().then(async () => {
      renderIntakeStorePanel();
      intakeEl('prodMyStoreSelect').value = p.store_id;
      await handleMyStoreChange('prod');
      intakeEl('prodMyStoreProduct').value = p.external_id;
      intake.storeProduct = { storeId: p.store_id, externalId: p.external_id, current: true };
      showIntakeData({ priceText: money, sourceText: 'De tu tienda. Elegí otro producto de la lista para volver a leerlo.', stockText });
    });
  }
}
window.openEditCatalogItem = openEditCatalogItem;

function openCreateProductModal() {
  const modal = intakeEl('createProductModal');
  if (!modal) return;
  intakeEl('createProductForm').reset();
  intake.edit = null;
  setIntakeTexts();
  intakeEl('intakeContext').replaceChildren();
  intake.url = '';
  modal.classList.remove('hidden');
  setIntakeMode('link');
  ensureConnectedStoresLoaded().then(() => { if (intake.mode === 'store') renderIntakeStorePanel(); });
}
window.openCreateProductModal = openCreateProductModal;

function closeCreateProductModal() {
  const modal = intakeEl('createProductModal');
  if (modal) modal.classList.add('hidden');
  intake.edit = null;
}
window.closeCreateProductModal = closeCreateProductModal;

async function readIntakeLink() {
  const url = intakeEl('intakeUrl').value.trim();
  clearIntakeNotice();
  intake.reading = null;
  hideIntakeData();
  if (!/^https?:\/\//i.test(url)) {
    showIntakeNotice('Pegá el link completo de tu producto, con https://.');
    return;
  }
  const btn = intakeEl('intakeReadBtn');
  btn.disabled = true;
  btn.textContent = 'Leyendo...';
  try {
    const res = await fetch('/api/4see/products/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!data.success) { showIntakeNotice(data.error || 'No pudimos leer el link.'); return; }
    const r = data.reading;
    if (!r.ok) { showIntakeNotice(r.message + ' La única forma de cargarlo es a mano.', { manual: true }); return; }
    if (data.existing && !(intake.edit && data.existing.id === intake.edit.id)) { showIntakeNotice('Ya cargaste este link como "' + data.existing.title + '".'); return; }
    intake.reading = r;
    intake.url = url;
    showIntakeData({
      title: r.title || '',
      sku: r.sku || '',
      priceText: HSFormat.money(r.price),
      sourceText: 'Leído de ' + r.store,
      stockText: intakeStockText(r.inStock)
    });
    if (!r.title) showIntakeNotice('La página no informa el nombre del producto: escribilo.');
  } catch (err) {
    showIntakeNotice('Sin conexión con el servidor. Intentá de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Leer link';
  }
}
window.readIntakeLink = readIntakeLink;

function resetIntakeStoreChoice() {
  intake.storeProduct = null;
  clearIntakeNotice();
  hideIntakeData();
}
window.resetIntakeStoreChoice = resetIntakeStoreChoice;

// Al elegir el producto en la tienda conectada se muestran los datos que la tienda informa
function handleProdStoreProductChange() {
  const storeId = intakeEl('prodMyStoreSelect').value;
  const externalId = intakeEl('prodMyStoreProduct').value;
  resetIntakeStoreChoice();
  const product = (myStoreProductsCache[storeId] || []).find((p) => p.externalId === externalId);
  if (!product) return;
  if (!product.price) {
    showIntakeNotice('Tu tienda no informa un precio para este producto.', { manual: true });
    return;
  }
  intake.storeProduct = { storeId, externalId };
  const store = cachedSavedStores.find((s) => s.id === storeId);
  showIntakeData({
    title: product.title || '',
    sku: product.sku || '',
    priceText: HSFormat.money(product.price),
    sourceText: 'De ' + (store ? store.name : 'tu tienda'),
    stockText: intakeStockText(product.inStock)
  });
}
window.handleProdStoreProductChange = handleProdStoreProductChange;

async function handleCreateProductSubmit(e) {
  e.preventDefault();
  if (intake.mode === 'link' && !intake.reading) { readIntakeLink(); return; }
  clearIntakeNotice();
  const editing = intake.edit;
  const payload = { title: intakeEl('intakeTitle').value.trim(), sku: intakeEl('intakeSku').value.trim() };
  if (editing) payload.mode = intake.mode;
  if (intake.mode === 'link') {
    payload.own_url = intake.url;
    if (editing && intake.reading && !intake.reading.current) payload.reread = true;
  } else if (intake.mode === 'store') {
    payload.store_id = intake.storeProduct.storeId;
    payload.store_external_id = intake.storeProduct.externalId;
    if (editing && !intake.storeProduct.current) payload.reread = true;
  } else {
    const price = HSFields.readMoney(intakeEl('intakePrice'));
    if (!(price > 0)) { showIntakeNotice('El precio no es un monto válido. Ejemplo: 165.200,00'); return; }
    payload.current_price = price;
  }
  const saveBtn = intakeEl('intakeSaveBtn');
  saveBtn.disabled = true;
  try {
    const res = await fetch(editing ? '/api/4see/products/' + editing.id : '/api/4see/products', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      showIntakeNotice(data.error || 'No pudimos guardar el producto.', { manual: Boolean(data.manualOnly) });
      return;
    }
    closeCreateProductModal();
    if (editing) {
      if (data.sku.generated) await showCustomAlert('Código generado', 'Este producto no tenía código. Le asignamos ' + data.sku.value + '.');
      load4seeMonitors();
      return;
    }
    const lines = ['"' + data.product.title + '" quedó en tu catálogo con un precio de ' + HSFormat.money(data.product.current_price) + '.'];
    if (data.sku.generated) lines.push('La fuente no informa un código, así que generamos el ' + data.sku.value + '. Podés cambiarlo con Editar.');
    lines.push('Para seguir su precio contra tus rivales, elegilo en el paso Análisis.');
    await showCustomAlert('Producto guardado', lines.join('\n'));
    load4seeMonitors();
  } catch (err) {
    showIntakeNotice('Sin conexión con el servidor. Intentá de nuevo.');
  } finally {
    updateIntakeSaveState();
  }
}
window.handleCreateProductSubmit = handleCreateProductSubmit;

function openCreateRuleModal() {
  const modal = document.getElementById('createRuleModal');
  if (modal) {
    document.getElementById('createRuleForm').reset();
    modal.classList.remove('hidden');
  }
}
window.openCreateRuleModal = openCreateRuleModal;

function closeCreateRuleModal() {
  const modal = document.getElementById('createRuleModal');
  if (modal) modal.classList.add('hidden');
}
window.closeCreateRuleModal = closeCreateRuleModal;

async function handleCreateRuleSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('ruleName').value.trim();
  const trigger_condition = document.getElementById('ruleTrigger').value;
  const action_type = document.getElementById('ruleAction').value;
  const offset_value = document.getElementById('ruleOffset').value;
  const auto_dispatch = document.getElementById('ruleAutoDispatch').checked;

  try {
    const res = await fetch('/api/4see/rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        name,
        trigger_condition,
        action_type,
        offset_value,
        auto_dispatch
      })
    });
    const data = await res.json();
    if (data.success) {
      closeCreateRuleModal();
      await showCustomAlert('Regla activada', `La regla "${name}" ya está funcionando.`);
      load4seeSmartPriceQueue();
    } else {
      await showCustomAlert('Error', data.error || 'No pudimos crear la regla. Revisá los datos.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Sin conexión con el servidor. Intentá de nuevo. (${err.message})`);
  }
}
window.handleCreateRuleSubmit = handleCreateRuleSubmit;


