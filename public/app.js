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
      showCustomAlert('Acceso Restringido (403)', data.message || data.error || 'Permisos insuficientes.');
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

async function loadActiveTheme() {
  try {
    const token = getAuthToken() || (currentUser ? currentUser.email : '');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch('/api/theme', { headers });
    const data = await res.json();
    if (data && data.theme) {
      const activeKey = data.themeKey || 'omarchy_tiling';
      const isLoggedOut = !document.getElementById('loginModal') || !document.getElementById('loginModal').classList.contains('hidden');
      document.body.className = 'theme-' + activeKey + (isLoggedOut ? ' state-logged-out' : ' state-logged-in');
      const root = document.documentElement;
      const t = data.theme;

      if (t.background) {
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

      const selectEl = document.getElementById('headerThemeSelect');
      if (selectEl && activeKey && selectEl.value !== activeKey) {
        selectEl.value = activeKey;
      }
    }
  } catch (e) {
    console.error('Error cargando tema activo:', e);
  }
}

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
      await showCustomAlert('Acción Denegada', data.error || 'No se pudo cambiar el tema visual.');
    }
  } catch (e) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
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
      await showCustomAlert('Acción Denegada', data.error || 'No se pudo cambiar el tema del Tenant.');
    }
  } catch (e) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
  }
}

async function loadAppConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success && data.version) {
      const verEl = document.getElementById('footerAppVersion');
      if (verEl) {
        verEl.innerText = `HoloSpace SaaS v${data.version}`;
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
      card.style.background = 'rgba(255,255,255,0.06)';
      card.classList.add('selected');
    } else {
      card.style.borderColor = 'var(--card-border)';
      card.style.background = 'rgba(255,255,255,0.02)';
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
        errorDiv.innerText = 'Error: no se encontraron datos de la cuenta de Google.';
        errorDiv.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Creando Organización...';
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
        submitBtn.innerText = 'Activar Organización y Entrar';
      }
    });
  }

  const token = getAuthToken();
  const userObj = getAuthUser();
  const tenantObj = getAuthTenant();
  const currentPath = window.location.pathname.toLowerCase();

  if (token && userObj) {
    currentUser = userObj;
    const tenant = tenantObj || { name: 'HoloSpace' };

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
      userBadgeEl.innerText = `${currentUser.role}: ${currentUser.email} (${tenant.name || 'HoloSpace'})`;
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
      loginError.innerText = 'Error conectando al servidor';
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
  const badge = document.getElementById('activeContextBadge');
  const userBadge = document.getElementById('userBadge');
  const mobActiveCtx = document.getElementById('mobileActiveContext');
  const footerTenant = document.getElementById('footerTenantStatus');

  const orgName = currentUser.tenantName || currentUser.tenantSlug || 'SUPERADMIN';
  if (badge) badge.innerText = orgName.toUpperCase();
  if (mobActiveCtx) mobActiveCtx.innerText = orgName.toUpperCase();

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
      userBadge.style.background = 'rgba(167, 139, 250, 0.15)';
      userBadge.style.color = '#A78BFA';
      userBadge.style.borderColor = '#A78BFA';
    }

    const dropName = document.getElementById('dropdownUserName');
    const dropRoleBadge = document.getElementById('dropdownUserRoleBadge');
    const dropEmail = document.getElementById('dropdownUserEmail');
    const dropOrg = document.getElementById('dropdownUserOrg');
    if (dropName) dropName.innerText = currentUser.name ? `${currentUser.name} (@${displaySuperUser})` : displaySuperUser;
    if (dropRoleBadge) {
      dropRoleBadge.innerText = 'SUPERADMIN';
      dropRoleBadge.style.background = 'rgba(167, 139, 250, 0.15)';
      dropRoleBadge.style.color = '#A78BFA';
      dropRoleBadge.style.border = '1px solid #A78BFA';
    }
    if (dropEmail) dropEmail.innerText = currentUser.email || '';
    if (dropOrg) dropOrg.innerText = 'Organización: HoloSpace Global Platform';

    if (footerTenant) {
      footerTenant.innerText = 'Organización: HoloSpace Global Platform (SUPERADMIN)';
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
    if (modKanban) modKanban.style.display = 'inline-flex';
    if (mod4see) mod4see.style.display = 'inline-flex';
    
    if (themeContainer) themeContainer.style.display = 'none';

    if (mobModTenant) mobModTenant.style.display = 'none';
    if (mobModCore) mobModCore.style.display = 'none';
    if (mobModKanban) mobModKanban.style.display = 'block';
    if (mobMod4see) mobMod4see.style.display = 'block';

    const orgName = currentUser.tenantSlug ? currentUser.tenantSlug.toUpperCase() : 'KANBAN';
    const displayUser = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'usuario');

    if (userBadge) {
      userBadge.innerHTML = `<span class="badge-user-name">${displayUser}</span><span style="font-size:9px; opacity:0.7; margin-left:2px;">▾</span>`;
      userBadge.title = `${displayUser} (${currentUser.role})`;
      userBadge.style.background = 'rgba(0, 230, 118, 0.15)';
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
      dropRoleBadge.style.background = 'rgba(0, 230, 118, 0.15)';
      dropRoleBadge.style.color = 'var(--emerald)';
      dropRoleBadge.style.border = '1px solid var(--emerald)';
    }
    if (dropEmail) dropEmail.innerText = currentUser.email || '';
    if (dropOrg) dropOrg.innerText = `Organización: ${currentUser.tenantName || orgName}`;

    if (footerTenant) {
      footerTenant.innerText = `Organización: ${currentUser.tenantName || orgName}`;
    }

    const path = window.location.pathname.toLowerCase();
    if (path.includes('tenant')) {
      showForbiddenView('tenant');
      if (window.history && window.history.replaceState) window.history.replaceState({ module: 'tenant' }, '', '/tenant');
    } else if (path.includes('core')) {
      showForbiddenView('core');
      if (window.history && window.history.replaceState) window.history.replaceState({ module: 'core' }, '', '/core');
    } else if (path.includes('4see')) {
      switchModule('4see');
    } else if (path.includes('orders')) {
      switchModule('kanban');
      switchTab('orders');
    } else {
      switchModule('kanban');
      switchTab('kanban');
    }
  }
}

function showForbiddenView(moduleName) {
  ['viewTenants', 'viewKanban', 'viewUsers', 'viewOrders', 'viewPlatform'].forEach(id => {
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
    tenant: 'Módulo Tenant (Gobierno de Plataforma)',
    core: 'Módulo Core (Plataforma & Auditoría)',
    kanban: 'Módulo Kanban (Tablero Logístico)'
  };

  if (titleEl) titleEl.innerText = modTitles[moduleName] || `Módulo ${moduleName}`;
  if (descEl) {
    if (currentUser && currentUser.role !== 'SUPERADMIN') {
      descEl.innerText = `Este módulo está reservado exclusivamente para el Super Administrador de HoloSpace. Tu organización actual no tiene permisos de acceso.`;
    } else {
      descEl.innerText = `No tienes los permisos asignados para interactuar con este módulo.`;
    }
  }

  const displayUser = (currentUser && (currentUser.username || currentUser.name)) || (currentUser && currentUser.email) || 'Usuario';
  if (userEl) userEl.innerText = displayUser;
  if (roleEl) roleEl.innerText = (currentUser && currentUser.role) || 'OPERATOR';
  if (tenantEl) tenantEl.innerText = (currentUser && (currentUser.tenantName || currentUser.tenantSlug)) || 'HoloSpace';
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

function switchModule(moduleName, updateUrl = true) {
  const normMod = (moduleName === 'tenants' ? 'tenant' : (moduleName === 'scanban' ? 'kanban' : moduleName));

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
  } else if (normMod === 'kanban') {
    switchTab('kanban');
  } else if (normMod === 'scanner') {
    switchTab('scanner');
  } else if (normMod === '4see') {
    switchTab('4see-monitors');
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
  ['tabTenants', 'tabKanban', 'tabUsers', 'tabRoles', 'tabOrders', 'tabPlatform', 'tabScanner', 'tab4seeMonitors', 'tab4seeCatalog', 'tab4seeMargins',
   'mobTabTenants', 'mobTabKanban', 'mobTabUsers', 'mobTabRoles', 'mobTabOrders', 'mobTabPlatform', 'mobTabScanner', 'mobTab4seeMonitors', 'mobTab4seeCatalog', 'mobTab4seeMargins'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  // Activar tab seleccionado
  let tabId = '';
  let mobTabId = '';
  if (tabName === '4see-monitors') {
    tabId = 'tab4seeMonitors';
    mobTabId = 'mobTab4seeMonitors';
  } else if (tabName === '4see-catalog') {
    tabId = 'tab4seeCatalog';
    mobTabId = 'mobTab4seeCatalog';
  } else if (tabName === '4see-margins') {
    tabId = 'tab4seeMargins';
    mobTabId = 'mobTab4seeMargins';
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

  ['viewTenants', 'viewKanban', 'viewUsers', 'viewRoles', 'viewOrders', 'viewPlatform', 'view4seeMonitors', 'view4seeCatalog', 'view4seeMargins'].forEach(id => {
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
  } else if (tabName === '4see-monitors') {
    const view = document.getElementById('view4seeMonitors');
    if (view) view.classList.remove('hidden');
    load4seeMonitors();
  } else if (tabName === '4see-catalog') {
    const view = document.getElementById('view4seeCatalog');
    if (view) view.classList.remove('hidden');
    load4seeCatalog();
  } else if (tabName === '4see-margins') {
    const view = document.getElementById('view4seeMargins');
    if (view) view.classList.remove('hidden');
    load4seeMargins();
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
  if (['tenant', 'tenants', 'core', 'kanban', 'scanner'].includes(path)) {
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
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin comprobantes pendientes</div>'
      : data.backlog.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--card-border); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
          <button class="btn-delete-card" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px; border-color: rgba(255, 82, 82, 0.4); color: var(--red);" onclick="deleteBacklogOrder('${item.id}', event)">Eliminar</button>
          <div class="card-order-no" style="color: var(--text-muted);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
          <div class="card-meta">Comprobante: <strong>#${item.orderNumber}</strong></div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta">Archivo: ${item.fileName}</div>
          <button class="btn-primary" style="margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 800; cursor: pointer;" onclick="markOrderReady('${item.id}', event)">
            Pasar a Listo
          </button>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Haz clic o arrastra esta tarjeta a LISTO</div>
        </div>
      `).join('');

    // 2. Render Ready (Verde - Draggable hacia BACKLOG o EN PROCESO)
    const readyList = document.getElementById('readyList');
    document.getElementById('readyCount').innerText = (data.ready || []).length;
    readyList.innerHTML = (!data.ready || data.ready.length === 0)
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos listos para escáner</div>'
      : data.ready.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--emerald); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
          <button class="btn-secondary" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px;" onclick="markOrderBacklog('${item.id}', event)">A Backlog</button>
          <div class="card-order-no" style="color: var(--emerald);">Pedido #${(item.id || '').substring(0, 8).toUpperCase()}</div>
          <div class="card-meta">Comprobante: <strong>#${item.orderNumber}</strong></div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta" style="color: var(--emerald); font-weight: 800; font-size: 12px;">Listo para tomar en celular</div>
          ${currentUser && currentUser.role === 'ADMIN' ? `
            <button class="btn-primary" style="background: var(--emerald); color: #000; margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 900; cursor: pointer;" onclick="openAssignOperatorModal('${item.id}', '${item.orderNumber}', event)">
              Asignar a Operario
            </button>
          ` : ''}
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Arrastrar a BACKLOG o EN PROCESO</div>
        </div>
      `).join('');

    // 3. Render Doing por Usuario (Acordeón colapsable)
    const doingList = document.getElementById('doingList');
    document.getElementById('doingCount').innerText = (data.doing || []).length;
    
    if (!data.doing || data.doing.length === 0) {
      doingList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos en proceso</div>';
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
            <div class="card-meta">Comprobante: <strong>#${item.orderNumber}</strong></div>
            <div class="card-meta" style="color: #FFF; font-weight: 700;">Cliente: ${item.clientName}</div>
            <div class="card-meta">Avance: ${item.scannedItems} / ${item.totalItems} U (${item.progressPercentage}%)</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${item.progressPercentage}%;"></div>
            </div>
            ${currentUser && currentUser.role === 'ADMIN' ? `
              <button class="btn-action" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid #3B82F6; margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 700; cursor: pointer;" onclick="resetOrderDoingToReady('${item.id}', '${item.orderNumber}', event)">
                Reasignar / Liberar a Listo
              </button>
            ` : ''}
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Arrastrar a LISTO para liberar</div>
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
      doneList.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos completados</div>';
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
            <div class="card-meta">Comprobante: <strong>#${item.orderNumber}</strong></div>
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
      await showCustomAlert('Acción Denegada', data.error || 'No fue posible validar el pedido.');
    }
  } catch (err) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
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
      await showCustomAlert('Acción Denegada', data.error || 'No fue posible mover el pedido a Backlog.');
    }
  } catch (err) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
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
      await showCustomAlert('Acción Denegada', data.error || 'No fue posible reasignar el pedido.');
    }
  } catch (err) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
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
        selectEl.innerHTML = '<option value="">No hay operarios activos registrados</option>';
      }
    } catch (e) {
      console.error('Error cargando operarios para asignación:', e);
      selectEl.innerHTML = '<option value="">Error cargando operarios</option>';
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
    await showCustomAlert('Selección Requerida', 'Por favor selecciona un operario para asignar el pedido.');
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
      await showCustomAlert('Acción Denegada', data.error || 'No fue posible asignar el pedido.');
    }
  } catch (e) {
    closeAssignOperatorModal();
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
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
      await showCustomAlert('Error', 'No se pudo cargar el detalle del comprobante.');
      return;
    }

    const order = data.order;
    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="font-family: monospace;">${item.code}</td>
        <td>${item.description}</td>
        <td style="text-align: center;">$${(item.unitPrice || 0).toLocaleString('es-AR')}</td>
        <td style="text-align: center; font-weight: 900;">${item.quantityScanned} / ${item.quantityRequired} U</td>
        <td style="text-align: right; font-weight: 900; color: var(--emerald);">$${((item.unitPrice || 0) * item.quantityRequired).toLocaleString('es-AR')}</td>
      </tr>
    `).join('');

    const totalCalculated = order.items.reduce((acc, i) => acc + (i.unitPrice || 0) * i.quantityRequired, 0);

    const logsHtml = (order.auditLogs || []).map(log => `
      <div style="background: #161B22; border-left: 3px solid var(--cobalt); padding: 10px 14px; border-radius: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span style="color: var(--emerald);">${log.userEmail}</span>
          <span style="color: var(--text-muted); font-size: 11px;">${log.timestamp}</span>
        </div>
        <div style="color: #FFF;">${log.details}</div>
      </div>
    `).join('');

    const statusLabelEs = order.status === 'READY' ? 'LISTO' : order.status === 'DOING' || order.status === 'SCANNING' ? 'EN PROCESO' : order.status === 'DONE' ? 'COMPLETADO' : 'BACKLOG';

    const statusActionButton = order.status === 'BACKLOG'
      ? `<button class="btn-primary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px; background-color: var(--emerald); color: #000; font-weight: 900;" onclick="markOrderReadyAndCloseModal('${order.id}')">VALIDAR Y PASAR A LISTO</button>`
      : order.status === 'READY'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px;" onclick="markOrderBacklogAndCloseModal('${order.id}')">DEVOLVER A BACKLOG</button>`
      : (order.status === 'DOING' || order.status === 'SCANNING') && currentUser && currentUser.role === 'ADMIN'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px; border-color: var(--cobalt); color: #60A5FA; font-weight: 800;" onclick="resetOrderDoingToReadyAndCloseModal('${order.id}', '${order.orderNumber}')">REASIGNAR Y LIBERAR A LISTO</button>`
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
              <div style="font-size: 12px; color: var(--text-muted);">EMISOR: <strong>${order.vendorName || 'WYPRA SA'}</strong> (CUIT: ${order.vendorCuit || '30-71828749-5'})</div>
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
            <span style="font-weight: 900; font-size: 14px; color: var(--emerald);">Total: $${totalCalculated.toLocaleString('es-AR')}</span>
          </summary>
          <div style="margin-top: 14px; border-top: 1px solid var(--card-border); padding-top: 14px; overflow-x: auto;">
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Código EAN</th>
                  <th>Descripción del Producto</th>
                  <th style="text-align: center;">Precio Unitario</th>
                  <th style="text-align: center;">Progreso Escaneo</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 900; font-size: 15px;">TOTAL FACTURA:</td>
                  <td style="text-align: right; font-weight: 900; font-size: 17px; color: var(--emerald);">$${totalCalculated.toLocaleString('es-AR')}</td>
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

    titleElem.innerText = isSuccess ? 'Comprobante Ingerido con Éxito' : 'Diagnóstico de Ingesta de Comprobante';
    titleElem.style.color = isSuccess ? 'var(--emerald)' : 'var(--red)';

    const step1 = checklist.step1_integrity || { passed: isSuccess, title: 'Integridad del Archivo PDF', details: isSuccess ? 'Estructura binaria válida.' : 'Error al leer estructura PDF.' };
    const step2 = checklist.step2_metadata || { passed: isSuccess, title: 'Lectura de Cabecera y Metadatos', details: isSuccess ? `N° Comprobante: #${result.orderNumber || ''} | Cliente: ${result.clientName || ''}` : 'No se detectó cabecera válida.' };
    const step3 = checklist.step3_items || { passed: isSuccess, title: 'Detección de Productos y Cantidades', details: isSuccess ? `${result.totalItems || 0} unidades requeridas detectadas.` : 'No se encontraron artículos con cantidades.' };

    const renderStep = (num, step) => {
      const icon = step.passed ? '✓' : '✗';
      const color = step.passed ? 'var(--emerald)' : 'var(--red)';
      const bg = step.passed ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 82, 82, 0.08)';
      const border = step.passed ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 82, 82, 0.25)';

      return `
        <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; text-align: left; transition: all 0.2s;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 13px; color: #FFF; letter-spacing: 0.3px;">Paso ${num}: ${step.title}</span>
            <span style="font-weight: 900; font-size: 14px; color: ${color}; background: rgba(0,0,0,0.3); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${icon}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 18px;">${step.details}</p>
        </div>
      `;
    };

    msgElem.innerHTML = `
      <div style="text-align: left; margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">
        Archivo: <strong style="color: #FFF;">${fileName}</strong>
      </div>
      <div style="margin-top: 10px;">
        ${renderStep(1, step1)}
        ${renderStep(2, step2)}
        ${renderStep(3, step3)}
      </div>
      ${!isSuccess ? `
        <div style="margin-top: 14px; padding: 10px 12px; background: rgba(255, 82, 82, 0.12); border-left: 3px solid var(--red); border-radius: 6px; text-align: left;">
          <span style="font-size: 12px; color: #FFF; font-weight: 700;">Recomendación:</span>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0; line-height: 16px;">
            Verifica que el archivo sea un comprobante PDF con capa de texto (no imagen escaneada plana) y que incluya códigos o descripciones de producto con su columna de cantidades.
          </p>
        </div>
      ` : `
        <div style="margin-top: 14px; padding: 10px 12px; background: rgba(0, 230, 118, 0.12); border-left: 3px solid var(--emerald); border-radius: 6px; text-align: left;">
          <span style="font-size: 12px; color: var(--emerald); font-weight: 700;">Estado de Carga:</span>
          <p style="font-size: 12px; color: #FFF; margin: 4px 0 0 0; line-height: 16px;">
            El pedido #${result.orderNumber || ''} se encuentra disponible en la columna <strong>BACKLOG</strong> de tu organización.
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
          step1_integrity: { passed: false, title: 'Integridad del Archivo PDF', details: 'Error de red o conexión al enviar el comprobante al servidor.' },
          step2_metadata: { passed: false, title: 'Lectura de Cabecera y Metadatos', details: 'No se pudo comunicar con el backend.' },
          step3_items: { passed: false, title: 'Detección de Productos y Cantidades', details: 'No se procesó la respuesta.' }
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
    '¿Estás seguro de eliminar este comprobante del Backlog? Se quitará de la Base de Datos.'
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
      await showCustomAlert('Error', data.error || 'No se pudo eliminar el pedido.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'Error de conexión al eliminar.');
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

function renderUsersTable(usersList = []) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';

  tbody.innerHTML = usersList.map((u, idx) => {
    const isTargetSuperAdmin = u.role === 'SUPERADMIN';
    const canEdit = isSuperAdmin || !isTargetSuperAdmin;
    const orgName = u.tenant_name || u.tenantSlug || (u.tenant_id === 'a0000000-0000-0000-0000-000000000001' ? 'HoloSpace Cloud Platform' : 'Organización');
    const displayNick = u.username || (u.email ? u.email.split('@')[0] : '-');

    return `
      <tr>
        <td><strong style="color: var(--emerald); font-family: monospace;">@${displayNick}</strong></td>
        <td><strong style="color: #FFF;">${u.name}</strong></td>
        <td style="font-family: monospace; font-size: 13px;">${u.email}</td>
        <td>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); color: var(--text-main); border: 1px solid var(--card-border);">
            ${orgName}
          </span>
        </td>
        <td>
          <span class="badge-role" style="${isTargetSuperAdmin ? 'background:rgba(124,58,237,0.2); color:#A78BFA; border-color:#7C3AED;' : (u.is_custom_role ? 'background:rgba(0,230,118,0.15); color:var(--emerald); border-color:var(--emerald);' : '')}">
            ${u.role_name || u.role}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="status-indicator" style="color: ${u.active !== false ? 'var(--emerald)' : 'var(--red)'}; font-weight: 800;">
            ${u.active !== false ? '● Activo' : '○ Desactivado'}
          </span>
        </td>
        <td style="text-align: right;">
          ${canEdit ? `
            <div class="data-table-actions" style="display: inline-flex; gap: 8px;">
              <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editUserById('${u.id || u.email}')">Editar</button>
              <button class="${u.active !== false ? 'btn-danger' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 12px;" onclick="toggleUserStatus('${u.id || u.email}', ${u.active !== false})">
                ${u.active !== false ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ` : `
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px;">
              Protegido (SuperAdmin)
            </span>
          `}
        </td>
      </tr>
    `;
  }).join('');
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
      <option value="SCANNER_OPERATOR">Scanner Operario (Escáner Móvil)</option>
      <option value="KANBAN_OPERATOR">Kanban Operador (Tablero Logístico)</option>
      <option value="KANBAN_ADMIN">Kanban Administrador (Ingesta y Asignación)</option>
      <option value="CORE_ADMIN">Core Administrador (Gobierno de Usuarios)</option>
      <option value="4SEE_USER">4see Analista (Consulta de Precios)</option>
      <option value="4SEE_ADMIN">4see Administrador (Repricing y Márgenes)</option>
    `;
    if (isSuperAdmin) {
      options += `
        <option value="TENANT_ADMIN">Tenant Administrador (Gobierno SaaS)</option>
        <option value="SUPERADMIN">SUPERADMIN (Super Administrador Global)</option>
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
  document.getElementById('userModalTitle').innerText = 'Crear Nuevo Usuario';
  
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
    await showCustomAlert('Campo Obligatorio', 'El Username (Nick) es obligatorio.');
    return;
  }
  if (!name) {
    await showCustomAlert('Campo Obligatorio', 'El Nombre Completo es obligatorio.');
    return;
  }
  if (!email) {
    await showCustomAlert('Campo Obligatorio', 'El Email es obligatorio.');
    return;
  }
  if (!id && !password) {
    await showCustomAlert('Campo Obligatorio', 'La Contraseña es obligatoria para nuevos usuarios.');
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
      await showCustomAlert('¡Guardado!', `Usuario @${username} (${name}) guardado correctamente.`);
      fetchUsers();
    } else {
      await showCustomAlert('Error', data.error || 'No se pudo guardar el usuario.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'Error de comunicación con el servidor.');
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
      await showCustomAlert('Error', data.error || 'No se pudo cambiar el estado del usuario.');
    }
  } catch (e) {
    await showCustomAlert('Error', 'Error de comunicación con el servidor.');
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

function renderRolesTable(roles = []) {
  const tbody = document.getElementById('rolesTableBody');
  if (!tbody) return;

  if (roles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No se encontraron roles que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = roles.map(r => {
    const isSystem = !!r.is_system;
    const typeBadge = isSystem
      ? `<span class="badge-role" style="background: rgba(167, 139, 250, 0.15); color: #A78BFA; border-color: #7C3AED;">Sistema</span>`
      : `<span class="badge-role" style="background: rgba(0, 230, 118, 0.15); color: var(--emerald); border-color: var(--emerald);">Personalizado</span>`;

    const permsCount = Array.isArray(r.permissions) ? r.permissions.length : 0;
    const hasWildcard = Array.isArray(r.permissions) && r.permissions.includes('*');
    
    let permsDisplay = '';
    if (hasWildcard) {
      permsDisplay = `<code style="font-family: monospace; color: var(--emerald); background: rgba(0,230,118,0.1); padding: 2px 6px; border-radius: 4px;">Acceso Total (*)</code>`;
    } else {
      const topPerms = (r.permissions || []).slice(0, 3).map(p => 
        `<span style="font-size: 11px; font-family: monospace; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--card-border);">${p}</span>`
      ).join(' ');
      const extra = permsCount > 3 ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">+${permsCount - 3} más</span>` : '';
      permsDisplay = `<div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">${topPerms}${extra}</div>`;
    }

    const canDelete = !isSystem;

    return `
      <tr>
        <td><strong style="color: #FFF;">${r.name}</strong></td>
        <td><code style="font-family: monospace; color: var(--text-muted);">@${r.slug}</code></td>
        <td style="color: var(--text-muted); font-size: 13px;">${r.description || '-'}</td>
        <td>${typeBadge}</td>
        <td>${permsDisplay}</td>
        <td style="text-align: center;"><strong style="color: #FFF;">${r.user_count || 0}</strong></td>
        <td style="text-align: right;">
          <div class="data-table-actions" style="display: inline-flex; gap: 8px;">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="openRoleModal('${r.id}')">Editar</button>
            ${canDelete ? `
              <button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteRole('${r.id}', '${r.name}')">Eliminar</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
        <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 4px;">
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
          <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer; color: var(--text-main); background: rgba(255,255,255,0.02); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
            <input type="checkbox" name="role_perm" value="${perm.key}" ${isChecked ? 'checked' : ''} ${isSuperadminRole ? 'disabled' : ''} style="margin-top: 3px;">
            <div>
              <span style="font-weight: 700; color: #FFF;">${titleLabel}</span>
              <code style="font-family: monospace; font-size: 11px; color: var(--amber); margin-left: 4px;">(${perm.key})</code>
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
    await showCustomAlert('Campo Requerido', 'El nombre del rol es obligatorio.');
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
      await showCustomAlert('Rol Guardado', `El rol '${name}' fue guardado correctamente con ${selectedPermissions.length} permisos.`);
      await fetchRolesManagementData();
      cachedRoles = [];
      updateRoleSelectOptions();
    } else {
      await showCustomAlert('Error al Guardar', data.error || 'No se pudo guardar el rol.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'Error de conexión con el servidor al guardar rol.');
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
      await showCustomAlert('Rol Eliminado', `El rol '${name}' fue eliminado correctamente.`);
      await fetchRolesManagementData();
      cachedRoles = [];
      updateRoleSelectOptions();
    } else {
      await showCustomAlert('Error al Eliminar', data.error || 'No se pudo eliminar el rol.');
    }
  } catch (err) {
    await showCustomAlert('Error', 'Error de conexión con el servidor al eliminar rol.');
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
        style="background: ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : '#21262D'}; color: ${selectedExplorerOperators.size === 0 ? '#000' : '#FFF'}; border: 1px solid ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer;">
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
          style="background: ${isSelected ? 'var(--emerald)' : '#21262D'}; color: ${isSelected ? '#000' : '#FFF'}; border: 1px solid ${isSelected ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          ${u.name} (@${u.username || email.split('@')[0]})
        </button>
      `;
      })
      .join('');

    container.innerHTML = allPill + pillsHtml;
  } catch (e) {
    console.error('Error cargando operarios:', e);
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
    const grid = document.getElementById('ordersExplorerGrid');
    if (!grid) return;

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

    if (ordersList.length === 0) {
      grid.innerHTML = `
        <tr>
          <td colspan="8" style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 40px;">
            No se encontraron pedidos que coincidan con la búsqueda y filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    grid.innerHTML = ordersList
      .map((o) => {
        const statusEs = o.status === 'READY' ? 'LISTO' : o.status === 'DOING' || o.status === 'SCANNING' ? 'EN PROCESO' : o.status === 'DONE' || o.status === 'CLOSED' ? 'COMPLETADO' : 'BACKLOG';
        const badgeStyle = o.status === 'READY'
          ? 'background: rgba(0, 230, 118, 0.2); color: #00E676;'
          : o.status === 'DOING' || o.status === 'SCANNING'
          ? 'background: rgba(59, 130, 246, 0.2); color: #60A5FA;'
          : o.status === 'DONE' || o.status === 'CLOSED'
          ? 'background: rgba(255, 215, 0, 0.2); color: #FFD700;'
          : 'background: rgba(148, 163, 184, 0.2); color: #94A3B8;';

        return `
          <tr style="cursor: pointer;" onclick="openInvoiceModal('${o.id}')">
            <td>
              <strong style="color: var(--emerald);">#${(o.id || '').substring(0, 8).toUpperCase()}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">Comp. #${o.orderNumber}</div>
            </td>
            <td><strong>${o.clientName}</strong></td>
            <td>${o.operatorEmail || 'Sin Asignar'}</td>
            <td style="font-size: 13px; color: var(--text-muted);">${o.issueDate || 'Hoy'}</td>
            <td style="text-align: center; font-weight: 800;">${o.totalItemsRequired} U</td>
            <td style="text-align: right; color: var(--emerald); font-weight: 900; font-size: 15px;">$${(o.totalAmount || 0).toLocaleString('es-AR')}</td>
            <td style="text-align: center;">
              <span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; ${badgeStyle}">
                ${statusEs}
              </span>
            </td>
            <td style="text-align: center;">
              <button class="btn-secondary" style="padding: 4px 12px; font-size: 11px; font-weight: 700;" onclick="event.stopPropagation(); openInvoiceModal('${o.id}')">Detalle</button>
            </td>
          </tr>
        `;
      })
      .join('');
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
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;
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
      `<div style="color:var(--red)">Error cargando módulos: ${e.message}</div>`;
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
    grid.innerHTML = '<div style="color:var(--text-muted); font-size:14px;">No hay módulos registrados.</div>';
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
              <span class="badge" style="font-size:10px; font-family:monospace; padding:2px 6px;">[${urlInfo.tag}]</span>
              <span>${mod.name}</span>
            </div>
            <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px;
              background:${isActive ? 'rgba(0,230,118,0.15)' : 'rgba(139,148,158,0.15)'};
              color:${statusColor}; border: 1px solid ${statusColor};">
              ${isActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
            <a href="${urlInfo.path}" target="${mod.key === 'scanner' || mod.key === 'landing' ? '_blank' : '_self'}" 
               style="display:inline-flex; align-items:center; gap:4px; font-family:monospace; font-size:11px; font-weight:700; color:var(--cobalt); text-decoration:none; background:rgba(138,173,244,0.12); padding:3px 8px; border-radius:4px; border:1px solid rgba(138,173,244,0.25);">
               ${urlInfo.label}
            </a>
            ${isCore ? '<span style="font-size:11px; color:#F59E0B; font-weight:800;">[CORE PLATAFORMA]</span>' : ''}
          </div>
          <div class="module-desc">${mod.description || '—'}</div>
          <div class="module-meta">
            Ruta Oficial: <strong style="color:var(--emerald);">${urlInfo.path}</strong>
            · Activado por: <strong style="color:#FFF;">${activatedBy}</strong>
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
      await showCustomAlert('Error', data.error || 'No se pudo cambiar el estado del módulo.');
      loadPlatformPanel(); // revert toggle visually
    }
  } catch (e) {
    await showCustomAlert('Error', `Error de red: ${e.message}`);
    loadPlatformPanel();
  }
}

function renderPlatformAuditLog(logs) {
  const container = document.getElementById('platformAuditLog');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:14px; padding:8px 0;">Sin eventos de plataforma registrados aún.</div>';
    return;
  }

  const actionColors = {
    'MODULE_ACTIVATED':   '#00E676',
    'MODULE_DEACTIVATED': '#FF5252',
    'THEME_CHANGED':      '#3B82F6',
    'TENANT_THEME_CHANGED':'#A78BFA'
  };
  const actionLabels = {
    'MODULE_ACTIVATED':   'Módulo activado',
    'MODULE_DEACTIVATED': 'Módulo desactivado',
    'THEME_CHANGED':      'Tema cambiado',
    'TENANT_THEME_CHANGED':'Tema del Tenant cambiado'
  };

  container.innerHTML = [...logs].slice(0, 50).map(log => {
    const color = actionColors[log.action] || '#8B949E';
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
          <div style="font-size:13px; font-weight:800; color:#FFF;">${label}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${log.userEmail || log.user_email || 'Sistema'} · ${ts}</div>
          ${detailsText ? `<div style="font-size:11px; color:${color}; margin-top:2px; font-family:monospace;">${detailsText}</div>` : ''}
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
      container.innerHTML = `<div style="color:var(--red); padding:20px;">${data.error || 'Error cargando organizaciones'}</div>`;
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
      const planCode = t.plan_code || 'starter';
      const planBadgeColors = {
        starter: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '#3B82F6' },
        pro: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--emerald)', border: 'var(--emerald)' },
        enterprise: { bg: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', border: '#A78BFA' }
      }[planCode] || { bg: 'rgba(255,255,255,0.1)', color: '#FFF', border: '#888' };

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
                <h3 style="font-size: 18px; font-weight: 900; color: #FFF;">${t.name}</h3>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 8px; background: rgba(255,255,255,0.08); color: var(--text-muted); font-family: monospace;">
                  ${t.slug}
                </span>
                ${isPlatform ? '<span style="font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 6px; background: rgba(167, 139, 250, 0.2); color: #A78BFA; border: 1px solid #A78BFA;">PLATAFORMA</span>' : ''}
                <span style="font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 6px; border: 1px solid ${isSuspended ? 'var(--red)' : 'var(--emerald)'}; color: ${isSuspended ? 'var(--red)' : 'var(--emerald)'}; background: ${isSuspended ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'};">
                  ${isSuspended ? '○ Suspendido' : '● Activo'}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                Usuarios: <strong style="color: #FFF;">${users.length} / ${t.max_users || '—'}</strong> · Órdenes/Mes: <strong style="color: #FFF;">${t.max_orders_monthly || '—'}</strong>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 10px; text-transform: uppercase; background: ${planBadgeColors.bg}; color: ${planBadgeColors.color}; border: 1px solid ${planBadgeColors.border};">
                Plan ${planCode}
              </span>
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
          <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Tema Base del Tenant</span>
            <span style="font-size: 12px; font-weight: 700; color: #FFF; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              ${{
                omarchy_tiling: 'Omarchy Tiling',
                omarchy_aetheria: 'Omarchy Aetherial',
                dark_glassmorphism: 'Dark Glass',
                cyberpunk_glassmorphism: 'Cyberpunk Glass',
                soft_minimal_pastel: 'Soft Pastel'
              }[t.active_theme] || t.active_theme || 'Omarchy Tiling'}
            </span>
          </div>

          <!-- Módulos Licenciados Toggles (Solo lectura en tarjeta) -->
          <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Módulos Licenciados en Vivo</div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
              <!-- Kanban -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: ${isKanbanActive ? 'var(--emerald)' : 'var(--text-muted)'};">Kanban</span>
                <input type="checkbox" ${isKanbanActive ? 'checked' : ''} disabled style="cursor: not-allowed; opacity: 0.8;">
              </div>

              <!-- Scanner -->
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: ${isScannerActive ? 'var(--emerald)' : 'var(--text-muted)'};">Scanner</span>
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
              ${users.length === 0 ? '<div style="color:var(--text-muted); font-size:12px; font-style:italic;">Sin usuarios asignados</div>' : users.map(u => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: #FFF;">${u.name} ${u.username ? `<span style="color:var(--emerald); font-family:monospace;">(@${u.username})</span>` : ''}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${u.email}</div>
                  </div>
                  <span style="font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 1px solid ${u.role === 'SUPERADMIN' ? '#A78BFA' : u.role === 'ADMIN' ? 'var(--emerald)' : 'var(--accent)'}; color: ${u.role === 'SUPERADMIN' ? '#A78BFA' : u.role === 'ADMIN' ? 'var(--emerald)' : 'var(--accent)'}; background: rgba(255,255,255,0.05);">
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
    const tableBody = document.getElementById('tenantsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" style="color:var(--red); padding:20px; text-align:center;">Error conectando con la API de Tenants: ${err.message}</td></tr>`;
    }
    if (container) {
      container.innerHTML = `<div style="color:var(--red); padding:20px;">Error conectando con la API de Tenants: ${err.message}</div>`;
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

function renderTenantsTable(tenantsList = []) {
  const tbody = document.getElementById('tenantsTableBody');
  if (!tbody) return;

  if (tenantsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No se encontraron organizaciones que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = tenantsList.map(t => {
    const isPlatform = t.slug === 'holospace';
    const isSuspended = t.status === 'suspended';
    const planCode = t.plan_code || 'starter';
    const planBadgeColors = {
      starter: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '#3B82F6' },
      pro: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--emerald)', border: 'var(--emerald)' },
      enterprise: { bg: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', border: '#A78BFA' }
    }[planCode] || { bg: 'rgba(255,255,255,0.1)', color: '#FFF', border: '#888' };

    const modules = t.modules || [];
    const hasModule = (code) => modules.some(m => (m.module_code === code || (code === 'kanban' && (m.module_code === 'scanban-board' || m.module_code === 'scanban')) || (code === 'scanner' && (m.module_code === 'scanban-scanner' || m.module_code === 'scanban'))) && m.is_enabled);

    const moduleChips = ['core', 'tenant', 'kanban', 'scanner', '4see'].map(mCode => {
      const active = (mCode === 'core' || (mCode === 'tenant' && isPlatform)) ? true : hasModule(mCode);
      return `<span style="font-size: 10px; font-family: monospace; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid ${active ? 'var(--card-border)' : 'rgba(255,255,255,0.04)'}; background: ${active ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: ${active ? 'var(--text-main)' : 'var(--text-muted)'}; opacity: ${active ? '1' : '0.4'};">${mCode}</span>`;
    }).join(' ');

    const users = t.users || [];

    return `
      <tr style="opacity: ${isSuspended ? '0.75' : '1'};">
        <td><strong style="color: var(--emerald); font-family: monospace;">@${t.slug}</strong></td>
        <td>
          <div style="font-weight: 800; color: #FFF;">${t.name}</div>
          ${isPlatform ? '<span style="font-size: 10px; font-weight: 900; padding: 1px 6px; border-radius: 4px; background: rgba(167, 139, 250, 0.2); color: #A78BFA; border: 1px solid #A78BFA; margin-top: 4px; display: inline-block;">PLATAFORMA</span>' : ''}
        </td>
        <td>
          <span class="badge-role" style="background: ${planBadgeColors.bg}; color: ${planBadgeColors.color}; border-color: ${planBadgeColors.border};">
            ${planCode.toUpperCase()}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
            ${moduleChips}
          </div>
        </td>
        <td style="text-align: center;">
          <strong style="color: #FFF;">${users.length}</strong>
          <span style="color: var(--text-muted); font-size: 11px;"> / ${t.max_users || '—'}</span>
        </td>
        <td style="text-align: center;">
          <span class="status-indicator" style="color: ${isSuspended ? 'var(--red)' : 'var(--emerald)'}; font-weight: 800;">
            ${isSuspended ? '○ Suspendido' : '● Activo'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="data-table-actions" style="display: inline-flex; gap: 6px;">
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="openEditTenantModal('${t.id}')">Editar</button>
            ${!isPlatform ? `
              <button class="${isSuspended ? 'btn-primary' : 'btn-danger'}" style="padding: 5px 10px; font-size: 11px;" onclick="toggleTenantStatus('${t.id}', '${t.name}', '${t.status || 'active'}')">
                ${isSuspended ? 'Reactivar' : 'Suspender'}
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
      await showCustomAlert('Éxito', data.message || `Organización actualizada.`);
      loadTenantsManagementData();
    } else {
      await showCustomAlert('Error', data.error || 'No se pudo modificar el estado de la organización.');
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
      await showCustomAlert('Error', data.error || 'No se pudo cambiar el estado del módulo');
      loadTenantsManagementData();
    }
  } catch (e) {
    await showCustomAlert('Error', `Error de red: ${e.message}`);
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
  const planCode = document.getElementById('tenantPlanSelect').value;
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
      body: JSON.stringify({ name, slug, planCode, adminName, adminUsername, adminEmail, adminPassword })
    });
    const data = await res.json();

    if (data.success) {
      closeCreateTenantModal();
      await showCustomAlert('Éxito', `Organización '${name}' creada exitosamente.`);
      loadTenantsManagementData();
    } else {
      if (errEl) {
        errEl.innerText = data.error || 'Error al crear la organización.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = `Error de red: ${err.message}`;
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
  const planSelect = document.getElementById('editTenantPlanSelect');
  const maxUsersInput = document.getElementById('editTenantMaxUsersInput');
  const maxOrdersInput = document.getElementById('editTenantMaxOrdersInput');
  const themeSelect = document.getElementById('editTenantThemeSelect');

  if (title) title.innerText = `Editar: ${tenant.name}`;
  if (idInput) idInput.value = tenant.id;
  if (nameInput) nameInput.value = tenant.name || '';
  if (slugInput) slugInput.value = tenant.slug || '';
  if (planSelect) planSelect.value = tenant.plan_code || 'starter';
  if (maxUsersInput) maxUsersInput.value = tenant.max_users || 5;
  if (maxOrdersInput) maxOrdersInput.value = tenant.max_orders_monthly || 500;
  if (themeSelect) themeSelect.value = tenant.active_theme || 'omarchy_tiling';

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

function handleEditTenantPlanChange(newPlan) {
  const defaultQuotas = {
    starter: { users: 5, orders: 500, board: true, scanner: false, foursee: false },
    pro: { users: 20, orders: 2500, board: true, scanner: true, foursee: true },
    enterprise: { users: 100, orders: 10000, board: true, scanner: true, foursee: true }
  }[newPlan] || { users: 5, orders: 500, board: true, scanner: false, foursee: false };

  const maxUsersInput = document.getElementById('editTenantMaxUsersInput');
  const maxOrdersInput = document.getElementById('editTenantMaxOrdersInput');
  const modBoard = document.getElementById('editTenantModBoard');
  const modScanner = document.getElementById('editTenantModScanner');
  const mod4see = document.getElementById('editTenantMod4see');

  if (maxUsersInput) maxUsersInput.value = defaultQuotas.users;
  if (maxOrdersInput) maxOrdersInput.value = defaultQuotas.orders;
  if (modBoard) modBoard.checked = defaultQuotas.board;
  if (modScanner) modScanner.checked = defaultQuotas.scanner;
  if (mod4see) mod4see.checked = defaultQuotas.foursee;
}

async function saveEditTenantSubmit(e) {
  e.preventDefault();

  const tenantId = document.getElementById('editTenantId').value;
  const name = document.getElementById('editTenantNameInput').value.trim();
  const planCode = document.getElementById('editTenantPlanSelect').value;
  const maxUsers = parseInt(document.getElementById('editTenantMaxUsersInput').value, 10);
  const maxOrdersMonthly = parseInt(document.getElementById('editTenantMaxOrdersInput').value, 10);
  const activeTheme = document.getElementById('editTenantThemeSelect').value;

  const isBoardChecked = document.getElementById('editTenantModBoard') ? document.getElementById('editTenantModBoard').checked : false;
  const isScannerChecked = document.getElementById('editTenantModScanner') ? document.getElementById('editTenantModScanner').checked : false;
  const is4seeChecked = document.getElementById('editTenantMod4see') ? document.getElementById('editTenantMod4see').checked : false;

  const modules = {
    'kanban': isBoardChecked,
    'scanban-board': isBoardChecked,
    'scanner': isScannerChecked,
    'scanban-scanner': isScannerChecked,
    '4see': is4seeChecked
  };

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
        planCode,
        maxUsers,
        maxOrdersMonthly,
        activeTheme,
        modules
      })
    });

    const data = await res.json();
    if (data.success) {
      closeEditTenantModal();
      await showCustomAlert('Éxito', `Organización '${name}' actualizada exitosamente.`);
      loadTenantsManagementData();
    } else {
      await showCustomAlert('Error', data.error || 'No se pudo actualizar la organización.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error de red: ${err.message}`);
  }
}

// ============================================================================
// FUNCIONALIDADES DEL MÓDULO 4SEE (MONITOR, CATALOG, MARGINS)
// ============================================================================

// 1. MONITOR DE COMPETENCIA
let cached4seeMonitors = [];

async function load4seeMonitors() {
  const container = document.getElementById('monitorsTableContainer');
  if (!container) return;
  container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Cargando monitores de competencia...</div>';

  try {
    const res = await fetch('/api/4see/monitors', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (!data.success || !data.monitors || data.monitors.length === 0) {
      cached4seeMonitors = [];
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 15px; font-weight: 700; color: #FFF;">No hay URLs de competidores monitoreadas</div>
          <div style="font-size: 13px; margin-top: 6px;">Agrega la primera URL de la competencia para rastrear precios y stock automáticamente.</div>
          <button class="btn-primary" style="margin-top: 16px;" onclick="openCreateMonitorModal()">+ Agregar URL Competidora</button>
        </div>
      `;
      return;
    }

    cached4seeMonitors = data.monitors;
    render4seeMonitorsTable(cached4seeMonitors);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error cargando monitores: ${err.message}</div>`;
  }
}

function filter4seeMonitors(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    render4seeMonitorsTable(cached4seeMonitors);
    return;
  }
  const filtered = cached4seeMonitors.filter(m => {
    const prod = (m.product_name || '').toLowerCase();
    const comp = (m.competitor_name || '').toLowerCase();
    const url = (m.competitor_url || '').toLowerCase();
    const stock = (m.competitor_stock || '').toLowerCase();
    return prod.includes(q) || comp.includes(q) || url.includes(q) || stock.includes(q);
  });
  render4seeMonitorsTable(filtered);
}

function render4seeMonitorsTable(monitors = []) {
  const container = document.getElementById('monitorsTableContainer');
  if (!container) return;

  if (monitors.length === 0) {
    container.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
              No se encontraron monitores que coincidan con la búsqueda.
            </td>
          </tr>
        </tbody>
      </table>
    `;
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="min-width: 180px;">Producto</th>
          <th style="min-width: 160px;">Competidor / Tienda</th>
          <th style="min-width: 110px;">Mi Precio</th>
          <th style="min-width: 120px;">Precio Rival</th>
          <th style="min-width: 130px;">Estado Stock</th>
          <th style="min-width: 120px;">Última Revisión</th>
          <th style="min-width: 160px; text-align: right;">Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  monitors.forEach(m => {
    const isOutOfStock = m.competitor_stock === 'OUT_OF_STOCK';
    const stockBadge = isOutOfStock
      ? '<span class="status-indicator" style="color: var(--red); font-weight: 800; font-size: 11px;">○ QUIEBRE (SIN STOCK)</span>'
      : '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px;">● EN STOCK</span>';

    const priceDiff = m.my_price && m.competitor_price ? (m.my_price - m.competitor_price) : 0;
    const diffLabel = priceDiff > 0 
      ? `<span style="color: var(--red); font-size: 11px;">(+$${priceDiff.toLocaleString('es-AR')})</span>`
      : (priceDiff < 0 ? `<span style="color: var(--emerald); font-size: 11px;">(-$${Math.abs(priceDiff).toLocaleString('es-AR')})</span>` : '');

    html += `
      <tr>
        <td><strong style="color: #FFF;">${m.product_name}</strong></td>
        <td>
          <a href="${m.competitor_url}" target="_blank" rel="noopener noreferrer" style="color: var(--cobalt); text-decoration: none; font-weight: 600;">
            ${m.competitor_name || 'Ver Tienda'} ↗
          </a>
        </td>
        <td style="font-family: monospace; font-weight: 800; color: #FFF;">$${parseFloat(m.my_price).toLocaleString('es-AR')}</td>
        <td style="font-family: monospace; font-weight: 800; color: #FFF;">
          $${parseFloat(m.competitor_price).toLocaleString('es-AR')} ${diffLabel}
        </td>
        <td>${stockBadge}</td>
        <td style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${new Date(m.last_checked_at || m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td style="text-align: right;">
          <div class="data-table-actions" style="display: inline-flex; gap: 6px;">
            <button class="btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="recheckMonitor('${m.id}')">Re-verificar</button>
            <button class="btn-danger" style="padding: 5px 10px; font-size: 11px;" onclick="deleteMonitor('${m.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}

function openCreateMonitorModal() {
  const modal = document.getElementById('createMonitorModal');
  if (modal) {
    document.getElementById('createMonitorForm').reset();
    document.getElementById('createMonitorError').style.display = 'none';
    modal.classList.remove('hidden');
  }
}

function closeCreateMonitorModal() {
  const modal = document.getElementById('createMonitorModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateMonitorSubmit(e) {
  e.preventDefault();
  const productName = document.getElementById('monProductName').value.trim();
  const competitorUrl = document.getElementById('monCompetitorUrl').value.trim();
  const competitorName = document.getElementById('monCompetitorName').value.trim();
  const myPrice = document.getElementById('monMyPrice').value;
  const errorDiv = document.getElementById('createMonitorError');

  try {
    const res = await fetch('/api/4see/monitors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ productName, competitorUrl, competitorName, myPrice })
    });
    const data = await res.json();
    if (data.success) {
      closeCreateMonitorModal();
      load4seeMonitors();
    } else {
      errorDiv.innerText = data.error || 'Error al guardar monitor';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.innerText = `Error de red: ${err.message}`;
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
      load4seeMonitors();
    } else {
      await showCustomAlert('Error', data.error || 'No se pudo re-verificar.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error: ${err.message}`);
  }
}

async function deleteMonitor(id) {
  const confirmDelete = await showCustomConfirm('Eliminar Monitor', '¿Deseas dejar de monitorear esta URL?');
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
      await showCustomAlert('Error', data.error || 'No se pudo eliminar.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error: ${err.message}`);
  }
}

// 2. AUDITORÍA DE CATÁLOGO & DIFF VIEW
let cached4seeCatalog = [];
let lastAuditedPlatform = null;
let lastAuditedCredentials = null;

async function load4seeCatalog() {
  const container = document.getElementById('catalogDiffContainer');
  if (!container) return;

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
          <div style="font-size: 16px; font-weight: 800; color: #FFF;">Diagnóstico de Salud de Catálogo (On-the-Fly)</div>
          <div style="font-size: 13px; margin-top: 8px; max-width: 540px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            Conecta tu tienda de Tiendanube o WooCommerce para escanear en caliente productos sin código de barras GTIN/EAN, marcas faltantes y optimizar títulos para Google Shopping y buscadores.
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
            <button class="btn-primary" style="background: linear-gradient(135deg, #00E676, #00B0FF); color: #000; font-weight: 800;" onclick="openConnectStoreModal()">⚡ Conectar y Escanear Tienda</button>
            <button class="btn-secondary" onclick="runDemoCatalogScan()">Cargar Muestra Demo</button>
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
      const bg = d.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)';
      const color = d.severity === 'HIGH' ? 'var(--red)' : '#EAB308';
      return `<span style="background: ${bg}; color: ${color}; border: 1px solid ${color}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; display: inline-block; margin-right: 6px; margin-bottom: 4px;">${d.message}</span>`;
    }).join('');

    const originalTitle = item.original_title || item.title || 'Sin Título';
    const suggestedTitle = auditInfo.suggested_title || item.suggested_title || originalTitle;
    const isApproved = item.is_approved || auditInfo.status === 'OPTIMIZED';
    const itemId = item.id || item.external_id || auditInfo.listing_id;
    const platform = item.platform || 'LOCAL';
    const brand = item.brand || '';
    const gtin = item.barcode_gtin || item.gtin || '';

    html += `
      <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #FFF; background: rgba(255, 255, 255, 0.1); padding: 2px 8px; border-radius: 4px;">${platform}</span>
            <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: var(--emerald); background: rgba(0, 230, 118, 0.1); padding: 2px 8px; border-radius: 4px;">SKU: ${item.sku || 'N/A'}</span>
            ${brand ? `<span style="font-size: 12px; color: var(--text-muted);">Marca: <strong>${brand}</strong></span>` : '<span style="font-size: 12px; color: #EAB308; font-weight: 700;">Sin Marca</span>'}
            ${gtin ? `<span style="font-size: 12px; color: var(--text-muted);">GTIN/EAN: <strong>${gtin}</strong></span>` : '<span style="font-size: 12px; color: var(--red); font-weight: 700;">Sin GTIN/EAN</span>'}
          </div>
          <div>
            ${isApproved 
              ? '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px;">● OPTIMIZADO Y APROBADO</span>' 
              : `<button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="approveCatalogOptimization('${itemId}')">Aprobar y Aplicar</button>`
            }
          </div>
        </div>

        ${diagBadges ? `<div style="margin-bottom: 12px;">${diagBadges}</div>` : ''}

        <!-- Vista Diff de Dos Columnas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 10px;">
          <div style="background: #10141D; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Título Actual en Tienda</div>
            <div style="font-size: 13px; color: #FFF; font-weight: 600; overflow-wrap: anywhere;">${originalTitle}</div>
          </div>
          <div style="background: #10141D; border: 1px solid rgba(0, 230, 118, 0.2); border-radius: 12px; padding: 14px;">
            <div style="font-size: 11px; color: var(--emerald); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Título Optimizado (Diff)</div>
            <div style="font-size: 13px; color: #FFF; font-weight: 600; overflow-wrap: anywhere;">${suggestedTitle}</div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// Modal Conectar Tienda
function openConnectStoreModal() {
  const modal = document.getElementById('connectStoreModal');
  if (modal) modal.classList.remove('hidden');
}
window.openConnectStoreModal = openConnectStoreModal;

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
window.handleConnectStoreSubmit = handleConnectStoreSubmit;
window.runDemoCatalogScan = runDemoCatalogScan;

async function handleConnectStoreSubmit(e) {
  e.preventDefault();
  const platform = document.getElementById('connPlatform').value;
  const btn = document.getElementById('btnRunStoreScan');

  let credentials = {};
  if (platform === 'TIENDANUBE') {
    credentials.userId = document.getElementById('tnUserId').value.trim();
    credentials.accessToken = document.getElementById('tnAccessToken').value.trim();
    if (!credentials.userId || !credentials.accessToken) {
      await showCustomAlert('Datos Incompletos', 'Ingresa el User ID y el Access Token de Tiendanube.');
      return;
    }
  } else {
    credentials.storeUrl = document.getElementById('wcStoreUrl').value.trim();
    credentials.consumerKey = document.getElementById('wcConsumerKey').value.trim();
    credentials.consumerSecret = document.getElementById('wcConsumerSecret').value.trim();
    if (!credentials.storeUrl) {
      await showCustomAlert('Datos Incompletos', 'Ingresa la URL de tu tienda WooCommerce.');
      return;
    }
  }

  if (btn) btn.innerText = 'Escaneando catálogo...';

  try {
    const res = await fetch('/api/4see/store/audit-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ platform, credentials, options: { limit: 50 } })
    });

    const data = await res.json();
    if (data.success && data.audit) {
      closeConnectStoreModal();
      lastAuditedPlatform = platform;
      lastAuditedCredentials = credentials;
      cached4seeCatalog = data.audit.items || [];
      
      const total = data.audit.total_audited || 0;
      const opt = data.audit.optimized_count || 0;
      const rev = data.audit.needs_review_count || 0;
      const gtin = data.audit.critical_issues_count || 0;

      updateCatalogKpis(total, opt, gtin, rev);
      render4seeCatalog(cached4seeCatalog);
      await showCustomAlert('Escaneo Completado', `Se auditaron ${total} productos de ${platform} en memoria exitosamente.`);
    } else {
      await showCustomAlert('Error en Escaneo', data.error || 'No se pudo conectar a la tienda.');
    }
  } catch (err) {
    await showCustomAlert('Error de Red', err.message);
  } finally {
    if (btn) btn.innerText = 'Iniciar Escaneo de Catálogo';
  }
}

// Cargar muestra de catálogo Demo on-the-fly para visualización inmediata
async function runDemoCatalogScan() {
  closeConnectStoreModal();
  const container = document.getElementById('catalogDiffContainer');
  if (container) container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Procesando catálogo demo en memoria...</div>';

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

  if (btn) btn.innerText = 'Ejecutando auditoría técnica...';

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
      await showCustomAlert('Error', data.error || 'Error al auditar producto');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error de red: ${err.message}`);
  } finally {
    if (btn) btn.innerText = 'Ejecutar Auditoría Técnica';
  }
}

async function approveCatalogOptimization(id) {
  // 1. Si tenemos una tienda conectada en caliente con credenciales, ofrecer write-back directo
  if (lastAuditedPlatform && lastAuditedCredentials) {
    const item = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
    if (item && item.audit && item.audit.suggested_title) {
      try {
        const res = await fetch('/api/4see/store/write-back', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({
            platform: lastAuditedPlatform,
            credentials: lastAuditedCredentials,
            productId: id,
            updates: { title: item.audit.suggested_title }
          })
        });
        const data = await res.json();
        if (data.success) {
          item.is_approved = true;
          render4seeCatalog(cached4seeCatalog);
          await showCustomAlert('Write-Back Exitoso', `El título optimizado ha sido enviado y actualizado en tu tienda ${lastAuditedPlatform}.`);
          return;
        }
      } catch (err) {
        console.warn('Fallo write-back, continuando con fallback local:', err);
      }
    }
  }

  // 2. Fallback local para ítems persistidos
  try {
    const res = await fetch(`/api/4see/catalog/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      await showCustomAlert('Optimización Aprobada', 'El título sugerido ha sido aplicado con éxito.');
      load4seeCatalog();
    } else {
      // Si fue ítem de muestra o demo en memoria, marcarlo como aprobado visualmente
      const found = cached4seeCatalog.find(i => (i.id || i.external_id || (i.audit && i.audit.listing_id)) === id);
      if (found) {
        found.is_approved = true;
        render4seeCatalog(cached4seeCatalog);
        await showCustomAlert('Sugerencia Aprobada', 'El título ha sido optimizado en el reporte.');
      } else {
        await showCustomAlert('Error', data.error || 'No se pudo aprobar.');
      }
    }
  } catch (err) {
    await showCustomAlert('Error', `Error: ${err.message}`);
  }
}

// 3. GUARDIÁN DE RENTABILIDAD & MÁRGENES
let cached4seeMargins = [];

async function load4seeMargins() {
  const container = document.getElementById('marginsTableContainer');
  if (!container) return;
  container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px 0;">Cargando reglas de rentabilidad...</div>';

  try {
    const res = await fetch('/api/4see/margins', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    if (!data.success || !data.rules || data.rules.length === 0) {
      cached4seeMargins = [];
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 15px; font-weight: 700; color: #FFF;">No hay reglas de margen configuradas</div>
          <div style="font-size: 13px; margin-top: 6px;">Fija tus costos, comisiones e impuestos para proteger el margen neto frente a ventas a pérdida.</div>
          <button class="btn-primary" style="margin-top: 16px;" onclick="openCreateMarginModal()">+ Nueva Regla de Margen</button>
        </div>
      `;
      return;
    }

    cached4seeMargins = data.rules;
    render4seeMarginsTable(cached4seeMargins);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--red); padding: 20px; text-align: center;">Error cargando reglas de margen: ${err.message}</div>`;
  }
}

function filter4seeMargins(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    render4seeMarginsTable(cached4seeMargins);
    return;
  }
  const filtered = cached4seeMargins.filter(r => {
    const name = (r.product_name || '').toLowerCase();
    const sku = (r.product_sku || '').toLowerCase();
    const zone = r.is_red_zone ? 'zona roja' : 'saludable';
    return name.includes(q) || sku.includes(q) || zone.includes(q);
  });
  render4seeMarginsTable(filtered);
}

function render4seeMarginsTable(rules = []) {
  const container = document.getElementById('marginsTableContainer');
  if (!container) return;

  if (rules.length === 0) {
    container.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
              No se encontraron reglas de margen que coincidan con la búsqueda.
            </td>
          </tr>
        </tbody>
      </table>
    `;
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="min-width: 180px;">SKU / Producto</th>
          <th style="min-width: 120px;">Costo Reposición</th>
          <th style="min-width: 120px;">Precio Venta</th>
          <th style="min-width: 120px;">Ganancia Neta</th>
          <th style="min-width: 110px;">Margen Real</th>
          <th style="min-width: 140px;">Alerta Rentabilidad</th>
          <th style="min-width: 160px; text-align: right;">Repricing Oportunidad</th>
        </tr>
      </thead>
      <tbody>
  `;

  rules.forEach(r => {
    const isRed = Boolean(r.is_red_zone);
    const alertBadge = isRed
      ? '<span class="status-indicator" style="color: var(--red); font-weight: 800; font-size: 11px;">○ ZONA ROJA (&lt;' + r.min_margin_pct + '%)</span>'
      : '<span class="status-indicator" style="color: var(--emerald); font-weight: 800; font-size: 11px;">● SALUDABLE</span>';

    html += `
      <tr>
        <td>
          <div style="font-weight: 800; color: #FFF;">${r.product_name || r.product_sku}</div>
          <div style="font-family: monospace; font-size: 11px; color: var(--emerald);">SKU: ${r.product_sku}</div>
        </td>
        <td style="font-family: monospace; color: #FFF;">$${parseFloat(r.cost_price).toLocaleString('es-AR')}</td>
        <td style="font-family: monospace; font-weight: 800; color: #FFF;">$${parseFloat(r.selling_price).toLocaleString('es-AR')}</td>
        <td style="font-family: monospace; font-weight: 800; color: ${parseFloat(r.net_profit) > 0 ? 'var(--emerald)' : 'var(--red)'};">
          $${parseFloat(r.net_profit).toLocaleString('es-AR')}
        </td>
        <td style="font-weight: 800; font-family: monospace; color: ${isRed ? 'var(--red)' : '#FFF'};">
          ${r.real_margin_pct}%
        </td>
        <td>${alertBadge}</td>
        <td style="font-family: monospace; font-weight: 800; color: var(--cobalt); text-align: right;">
          $${parseFloat(r.suggested_repricing_price).toLocaleString('es-AR')} (+8%)
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;
  container.innerHTML = html;
}


function openCreateMarginModal() {
  const modal = document.getElementById('createMarginModal');
  if (modal) {
    document.getElementById('createMarginForm').reset();
    modal.classList.remove('hidden');
  }
}

function closeCreateMarginModal() {
  const modal = document.getElementById('createMarginModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateMarginSubmit(e) {
  e.preventDefault();
  const productSku = document.getElementById('marSku').value.trim();
  const productName = document.getElementById('marProductName').value.trim();
  const costPrice = document.getElementById('marCostPrice').value;
  const sellingPrice = document.getElementById('marSellingPrice').value;
  const minMarginPct = document.getElementById('marMinMargin').value;
  const platformFeePct = document.getElementById('marFeePct').value;
  const taxPct = document.getElementById('marTaxPct').value;
  const shippingCost = document.getElementById('marShipping').value;

  try {
    const res = await fetch('/api/4see/margins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        productSku,
        productName,
        costPrice,
        sellingPrice,
        minMarginPct,
        platformFeePct,
        taxPct,
        shippingCost
      })
    });
    const data = await res.json();
    if (data.success) {
      closeCreateMarginModal();
      load4seeMargins();
    } else {
      await showCustomAlert('Error', data.error || 'No se pudo guardar la regla de margen.');
    }
  } catch (err) {
    await showCustomAlert('Error', `Error de red: ${err.message}`);
  }
}

