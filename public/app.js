let currentUser = null;
let customDialogResolver = null;
let collapsedUserGroups = new Set(); // Guarda los usuarios colapsados en DOING/DONE

function populateSavedCredentials() {
  const savedEmail = localStorage.getItem('hw_saved_email') || '';
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
    const token = localStorage.getItem('hw_token') || (currentUser ? currentUser.email : '');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch('/api/theme', { headers });
    const data = await res.json();
    if (data && data.theme) {
      const activeKey = data.themeKey || 'omarchy_tiling';
      document.body.className = 'theme-' + activeKey;
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
    const token = localStorage.getItem('hw_token') || (currentUser ? currentUser.email : '');
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
    const token = localStorage.getItem('hw_token') || '';
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

document.addEventListener('DOMContentLoaded', () => {
  loadActiveTheme();
  populateSavedCredentials();

  const token = localStorage.getItem('hw_token');
  const userJson = localStorage.getItem('hw_user');
  const tenantJson = localStorage.getItem('hw_tenant');
  if (token && userJson) {
    currentUser = JSON.parse(userJson);
    const tenant = tenantJson ? JSON.parse(tenantJson) : { name: 'Drink Lovers Argentina' };
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('userBadge').innerText = `${currentUser.role}: ${currentUser.email} (${tenant.name || 'Drink Lovers'})`;
    applyRoleVisibility();
    loadKanbanData();
    setInterval(loadKanbanData, 3000);
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
        localStorage.setItem('hw_token', data.token);
        localStorage.setItem('hw_user', JSON.stringify(data.user));
        if (data.tenant) {
          localStorage.setItem('hw_tenant', JSON.stringify(data.tenant));
          localStorage.setItem('hw_tenant_id', data.tenant.id);
          localStorage.setItem('hw_tenant_slug', data.tenant.slug);
        }
        localStorage.setItem('hw_saved_email', email);

        document.getElementById('loginModal').classList.add('hidden');
        const orgName = data.tenant ? data.tenant.name : 'Drink Lovers';
        document.getElementById('userBadge').innerText = `${currentUser.role}: ${currentUser.email} (${orgName})`;
        applyRoleVisibility();
        loadKanbanData();
        setInterval(loadKanbanData, 3000);
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

  const modTenants = document.getElementById('modTenants');
  const modCore = document.getElementById('modCore');
  const modScanBan = document.getElementById('modScanBan');
  const modScanFlow = document.getElementById('modScanFlow');
  
  const mobModTenants = document.getElementById('mobModTenants');
  const mobModCore = document.getElementById('mobModCore');
  const mobModScanBan = document.getElementById('mobModScanBan');
  const mobModScanFlow = document.getElementById('mobModScanFlow');

  if (isSuperAdmin) {
    // SUPERADMIN: Access strictly to HoloWare Tenants & Core Platform
    if (modTenants) modTenants.style.display = 'inline-flex';
    if (modCore) modCore.style.display = 'inline-flex';
    if (modScanBan) modScanBan.style.display = 'none';
    if (modScanFlow) modScanFlow.style.display = 'none';
    if (themeContainer) themeContainer.style.display = 'flex';

    if (mobModTenants) mobModTenants.style.display = 'block';
    if (mobModCore) mobModCore.style.display = 'block';
    if (mobModScanBan) mobModScanBan.style.display = 'none';
    if (mobModScanFlow) mobModScanFlow.style.display = 'none';

    const displaySuperUser = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'superadmin');
    if (userBadge) {
      userBadge.innerHTML = `<span class="badge-role-text">${currentUser.role}</span><span class="badge-user-email">: ${displaySuperUser}</span>`;
      userBadge.title = `${currentUser.role}: ${displaySuperUser} (${currentUser.email || ''})`;
      userBadge.style.background = 'rgba(167, 139, 250, 0.15)';
      userBadge.style.color = '#A78BFA';
      userBadge.style.borderColor = '#A78BFA';
    }

    if (footerTenant) {
      footerTenant.innerText = 'Organización: HoloWare Cloud Platform';
    }

    const tenantsView = document.getElementById('viewTenants');
    if (tenantsView && !tenantsView.classList.contains('hidden')) {
      switchModule('tenants');
    } else {
      switchModule('tenants');
    }
  } else {
    // ADMIN / OPERATOR: Access to licensed operational modules (ScanBan Board, ScanFlow)
    if (modTenants) modTenants.style.display = 'none';
    if (modCore) modCore.style.display = 'none';
    if (modScanBan) modScanBan.style.display = 'inline-flex';
    if (modScanFlow) modScanFlow.style.display = 'inline-flex';
    if (themeContainer) themeContainer.style.display = 'none';

    if (mobModTenants) mobModTenants.style.display = 'none';
    if (mobModCore) mobModCore.style.display = 'none';
    if (mobModScanBan) mobModScanBan.style.display = 'block';
    if (mobModScanFlow) mobModScanFlow.style.display = 'block';

    const orgName = currentUser.tenantSlug ? currentUser.tenantSlug.toUpperCase() : 'SCANBAN';
    const displayUser = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'usuario');

    if (userBadge) {
      userBadge.innerHTML = `<span class="badge-role-text">${currentUser.role}</span><span class="badge-user-email">: ${displayUser}</span>`;
      userBadge.title = `${currentUser.role}: ${displayUser} (${currentUser.email || ''})`;
      userBadge.style.background = 'rgba(0, 230, 118, 0.15)';
      userBadge.style.color = 'var(--emerald)';
      userBadge.style.borderColor = 'var(--emerald)';
    }

    if (footerTenant) {
      footerTenant.innerText = `Organización: ${currentUser.tenantName || orgName}`;
    }

    const ordersView = document.getElementById('viewOrders');
    if (ordersView && !ordersView.classList.contains('hidden')) {
      switchModule('scanban');
      switchTab('orders');
    } else {
      switchModule('scanban');
      switchTab('kanban');
    }
  }
}

function switchModule(moduleName) {
  // 1. Ocultar todas las features (Tabs)
  document.querySelectorAll('.feature-tenants, .feature-core, .feature-scanban, .feature-scanflow').forEach(el => {
    el.style.display = 'none';
  });

  // 2. Mostrar las features del módulo seleccionado
  document.querySelectorAll('.nav-tab.feature-' + moduleName).forEach(el => el.style.display = 'inline-flex');
  document.querySelectorAll('.mobile-nav-tab.feature-' + moduleName).forEach(el => el.style.display = 'block');

  // 3. Marcar módulo activo con mapeo exacto de IDs
  const desktopModMap = { tenants: 'modTenants', core: 'modCore', scanban: 'modScanBan', scanflow: 'modScanFlow' };
  const mobileModMap = { tenants: 'mobModTenants', core: 'mobModCore', scanban: 'mobModScanBan', scanflow: 'mobModScanFlow' };

  document.querySelectorAll('.module-tab').forEach(el => el.classList.remove('active'));
  const dMod = document.getElementById(desktopModMap[moduleName]);
  const mMod = document.getElementById(mobileModMap[moduleName]);
  if (dMod) dMod.classList.add('active');
  if (mMod) mMod.classList.add('active');

  // 4. Seleccionar la feature por defecto
  if (moduleName === 'tenants') {
    switchTab('tenants');
  } else if (moduleName === 'core') {
    switchTab('platform');
  } else if (moduleName === 'scanban') {
    switchTab('kanban');
  } else if (moduleName === 'scanflow') {
    switchTab('scanflow');
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
  ['tabTenants', 'tabKanban', 'tabUsers', 'tabOrders', 'tabPlatform', 'tabScanFlow',
   'mobTabTenants', 'mobTabKanban', 'mobTabUsers', 'mobTabOrders', 'mobTabPlatform', 'mobTabScanFlow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  // Activar tab seleccionado
  const tabId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  const mobTabId = 'mobTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  const el = document.getElementById(tabId);
  const mobEl = document.getElementById(mobTabId);
  if (el) el.classList.add('active');
  if (mobEl) mobEl.classList.add('active');

  // Asegurarnos de que el módulo padre también esté activo
  let parentModule = '';
  if (tabName === 'tenants') parentModule = 'tenants';
  if (tabName === 'platform' || tabName === 'users') parentModule = 'core';
  if (tabName === 'kanban' || tabName === 'orders') parentModule = 'scanban';
  if (tabName === 'scanflow') parentModule = 'scanflow';
  
  if (parentModule) {
    const desktopModMap = { tenants: 'modTenants', core: 'modCore', scanban: 'modScanBan', scanflow: 'modScanFlow' };
    const mobileModMap = { tenants: 'mobModTenants', core: 'mobModCore', scanban: 'mobModScanBan', scanflow: 'mobModScanFlow' };

    document.querySelectorAll('.module-tab').forEach(m => m.classList.remove('active'));
    const dMod = document.getElementById(desktopModMap[parentModule]);
    const mMod = document.getElementById(mobileModMap[parentModule]);
    if (dMod) dMod.classList.add('active');
    if (mMod) mMod.classList.add('active');
  }

  ['viewTenants', 'viewKanban', 'viewUsers', 'viewOrders', 'viewPlatform', 'viewScanFlow'].forEach(id => {
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
  } else if (tabName === 'kanban') {
    const tab = document.getElementById('tabKanban');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabKanban');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewKanban');
    if (view) view.classList.remove('hidden');
    loadKanbanData();
  } else if (tabName === 'orders') {
    const tab = document.getElementById('tabOrders');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabOrders');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewOrders');
    if (view) view.classList.remove('hidden');
    renderOperatorPills();
    fetchExplorerOrders();
  } else if (tabName === 'scanflow') {
    const tab = document.getElementById('tabScanFlow');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabScanFlow');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewScanFlow');
    if (view) view.classList.remove('hidden');
  } else if (tabName === 'users') {
    const tab = document.getElementById('tabUsers');
    if (tab) tab.classList.add('active');
    const mobTab = document.getElementById('mobTabUsers');
    if (mobTab) mobTab.classList.add('active');
    const view = document.getElementById('viewUsers');
    if (view) view.classList.remove('hidden');
    fetchUsers();
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
    const token = localStorage.getItem('hw_token') || '';
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
          <div style="display: flex; gap: 6px; position: absolute; top: 12px; right: 12px;">
            <button class="btn-primary" style="font-size: 11px; padding: 4px 8px; border-radius: 6px;" onclick="markOrderReady('${item.id}', event)">✓ Pasar a Listo</button>
            <button class="btn-delete-card" style="position: static;" onclick="deleteBacklogOrder('${item.id}', event)">🗑️</button>
          </div>
          <div class="card-order-no" style="color: var(--text-muted);">Pedido #${item.orderNumber}</div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta">Archivo: ${item.fileName}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">🖐️ Puedes hacer clic o arrastrar esta tarjeta a LISTO</div>
        </div>
      `).join('');

    // 2. Render Ready (Verde - Draggable hacia BACKLOG o EN PROCESO)
    const readyList = document.getElementById('readyList');
    document.getElementById('readyCount').innerText = (data.ready || []).length;
    readyList.innerHTML = (!data.ready || data.ready.length === 0)
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos listos para escáner</div>'
      : data.ready.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.id}')" style="border-color: var(--emerald); cursor: grab;" onclick="openInvoiceModal('${item.id}')">
          <button class="btn-secondary" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px;" onclick="markOrderBacklog('${item.id}', event)">↩️ A Backlog</button>
          <div class="card-order-no" style="color: var(--emerald);">Pedido #${item.orderNumber}</div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta" style="color: var(--emerald); font-weight: 800; font-size: 12px;">● Listo para tomar en celular</div>
          ${currentUser && currentUser.role === 'ADMIN' ? `
            <button class="btn-primary" style="background: var(--emerald); color: #000; margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 900; cursor: pointer;" onclick="openAssignOperatorModal('${item.id}', '${item.orderNumber}', event)">
              👤 Asignar a Operario
            </button>
          ` : ''}
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">🖐️ Puedes arrastrar a BACKLOG o EN PROCESO</div>
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
            <div class="card-order-no" style="color: var(--cobalt);">Pedido #${item.orderNumber}</div>
            <div class="card-meta" style="color: #FFF; font-weight: 700;">Cliente: ${item.clientName}</div>
            <div class="card-meta">Avance: ${item.scannedItems} / ${item.totalItems} U (${item.progressPercentage}%)</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${item.progressPercentage}%;"></div>
            </div>
            ${currentUser && currentUser.role === 'ADMIN' ? `
              <button class="btn-action" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid #3B82F6; margin-top: 8px; font-size: 11px; width: 100%; border-radius: 6px; padding: 6px 8px; font-weight: 700; cursor: pointer;" onclick="resetOrderDoingToReady('${item.id}', '${item.orderNumber}', event)">
                ↩️ Reasignar / Liberar a Listo
              </button>
            ` : ''}
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">🖐️ Puedes arrastrar a LISTO para liberar</div>
          </div>
        `).join('');

        return `
          <div class="user-group">
            <div class="user-group-header" onclick="toggleUserGroup('${groupId}')">
              <span>👤 Operario: ${email} (${userOrders.length})</span>
              <span>${isCollapsed ? '►' : '▼'}</span>
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
            <div class="card-order-no" style="color: var(--amber);">Pedido #${item.orderNumber}</div>
            <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
            <div class="card-meta" style="font-size: 11px; color: var(--emerald);">${item.auditStamp}</div>
          </div>
        `).join('');

        return `
          <div class="user-group">
            <div class="user-group-header" onclick="toggleUserGroup('${groupId}')">
              <span>👤 Auditado por: ${email} (${userOrders.length})</span>
              <span>${isCollapsed ? '►' : '▼'}</span>
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
    const res = await fetch('/api/scanban/release-order-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      const token = localStorage.getItem('hw_token') || '';
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      const userList = Array.isArray(data) ? data : (data.users || []);
      const activeUsers = userList.filter(u => u.active !== 0 && u.active !== false && u.role === 'OPERATOR');
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
    const token = localStorage.getItem('hw_token') || '';
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
      const res = await fetch(`/api/scanban/order-detail?id=${orderId}`);
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
      const res = await fetch(`/api/scanban/order-detail?id=${orderId}`);
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
    const res = await fetch(`/api/scanban/order-detail?id=${orderId}`);
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
          'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}`
        },
        body: JSON.stringify({
          fileName: file.name,
          pdfBase64: base64,
          userEmail: currentUser ? currentUser.email : ''
        })
      });
      const data = await res.json();
      if (data.success) {
        await showCustomAlert('¡Éxito!', `Comprobante ${file.name} parseado y cargado en el Backlog.`);
        loadKanbanData();
      } else {
        await showCustomAlert('Error', data.error || 'No se pudo subir el archivo.');
      }
    } catch (err) {
      await showCustomAlert('Error', 'Error de conexión al subir comprobante.');
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
    const res = await fetch('/api/scanban/delete-order', {
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}` }
    });
    const data = await res.json();
    const usersList = Array.isArray(data) ? data : (data.users || []);
    currentFetchedUsers = usersList;
    const tbody = document.getElementById('usersTableBody');
    const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';

    tbody.innerHTML = usersList.map((u, idx) => {
      const isTargetSuperAdmin = u.role === 'SUPERADMIN';
      const canEdit = isSuperAdmin || !isTargetSuperAdmin;
      const orgName = u.tenant_name || u.tenantSlug || (u.tenant_id === 'a0000000-0000-0000-0000-000000000001' ? 'HoloWare Cloud Platform' : 'Organización');
      const displayNick = u.username || (u.email ? u.email.split('@')[0] : '-');

      return `
        <tr>
          <td><strong style="color: var(--emerald); font-family: monospace;">@${displayNick}</strong></td>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>
            <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); color: var(--text-main); border: 1px solid var(--card-border);">
              ${orgName}
            </span>
          </td>
          <td>
            <span class="badge-role" style="${isTargetSuperAdmin ? 'background:rgba(124,58,237,0.2); color:#A78BFA; border-color:#7C3AED;' : ''}">
              ${u.role}
            </span>
          </td>
          <td>
            <span style="color: ${u.active !== false ? 'var(--emerald)' : 'var(--red)'}; font-weight: 800;">
              ${u.active !== false ? '● Activo' : '○ Desactivado'}
            </span>
          </td>
          <td>
            ${canEdit ? `
              <div style="display: flex; gap: 8px;">
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editUserByIndex(${idx})">Editar</button>
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
  } catch (e) {
    console.error('Error al cargar usuarios:', e);
  }
}

function updateRoleSelectOptions(selectedRole = 'OPERATOR') {
  const select = document.getElementById('userRoleInput');
  if (!select) return;
  const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';

  let options = `
    <option value="OPERATOR">OPERATOR (Operario de Escáner Móvil)</option>
    <option value="ADMIN">ADMIN (Administrador de Tablero Web)</option>
  `;
  if (isSuperAdmin) {
    options += `<option value="SUPERADMIN">SUPERADMIN (Super Administrador de Plataforma)</option>`;
  }
  select.innerHTML = options;
  select.value = selectedRole;
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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}` }
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
  
  const passInput = document.getElementById('userPasswordInput');
  passInput.type = 'password';
  passInput.value = '••••••••';
  passInput.placeholder = 'Contraseña obligatoria';
  passInput.required = true;

  const toggleBtn = document.getElementById('toggleUserPasswordBtn');
  if (toggleBtn) toggleBtn.innerText = 'Ver';

  populateUserModalTenants(user.tenant_id || user.tenantId || '');
  updateRoleSelectOptions(user.role || 'OPERATOR');
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
  const password = document.getElementById('userPasswordInput').value;
  const role = document.getElementById('userRoleInput').value;
  
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
  if (!password) {
    await showCustomAlert('Campo Obligatorio', 'La Contraseña es obligatoria.');
    return;
  }

  const url = '/api/users';
  const method = id ? 'PUT' : 'POST';
  const payload = id ? 
    { id, tenantId: targetTenantId, username, name, email, password, role } : 
    { tenantId: targetTenantId, username, name, email, password, role };

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('hw_token') || ''}`
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
// EXPLORADOR INTELIGENTE DE PEDIDOS CON MULTI-SELECCIÓN DE OPERARIOS
// ----------------------------------------------------
let selectedExplorerOperators = new Set();
let allOperatorEmails = [];

async function renderOperatorPills() {
  try {
    const token = localStorage.getItem('hw_token') || '';
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
        ${selectedExplorerOperators.size === 0 ? '✓ ' : ''}Todos los Operarios
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
          ${isSelected ? '✓ ' : ''}${u.name} (@${u.username || email.split('@')[0]})
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
    const token = localStorage.getItem('hw_token') || '';
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
          <tr style="cursor: pointer;" onclick="openInvoiceModal('${o.orderNumber}')">
            <td><strong style="color: var(--emerald);">#${o.orderNumber}</strong></td>
            <td><strong>${o.clientName}</strong></td>
            <td>👤 ${o.operatorEmail || 'Sin Asignar'}</td>
            <td style="font-size: 13px; color: var(--text-muted);">${o.issueDate || 'Hoy'}</td>
            <td style="text-align: center; font-weight: 800;">${o.totalItemsRequired} U</td>
            <td style="text-align: right; color: var(--emerald); font-weight: 900; font-size: 15px;">$${(o.totalAmount || 0).toLocaleString('es-AR')}</td>
            <td style="text-align: center;"><span class="badge-role" style="font-size: 11px; ${badgeStyle}">${statusEs}</span></td>
            <td style="text-align: center;">
              <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="event.stopPropagation(); openInvoiceModal('${o.orderNumber}')">👁️ Detalle</button>
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

async function openQrModal() {
  let host = window.location.hostname;
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.hostIp && data.hostIp !== '127.0.0.1' && data.hostIp !== 'localhost') {
      host = data.hostIp;
    } else if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
      if (data && data.hostIp) {
        host = data.hostIp;
      }
    }
  } catch (e) {
    console.log('Error obteniendo IP dinámica:', e);
  }
  const expoUrl = `exp://${host || '127.0.0.1'}:8081`;
  const qrImg = document.getElementById('qrImage');
  const qrText = document.getElementById('qrText') || document.querySelector('#qrModal p[style*="font-family: monospace"]');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(expoUrl)}`;
  }
  if (qrText) {
    qrText.textContent = expoUrl;
  }
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

function logout() {
  localStorage.removeItem('hw_token');
  localStorage.removeItem('hw_user');
  currentUser = null;
  populateSavedCredentials();
  document.getElementById('loginModal').classList.remove('hidden');
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hw_token')}` }
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hw_token')}` }
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

  const actionColors = {
    'MODULE_ACTIVATED': '#00E676',
    'MODULE_DEACTIVATED': '#FF5252',
    'THEME_CHANGED': '#3B82F6',
  };

  grid.innerHTML = modules.map(mod => {
    const isCore = mod.key === 'core';
    const isActive = mod.is_active === true || mod.is_active === 1 || mod.active === 1 || mod.active === true;
    const rawDate = mod.activated_at || mod.activatedAt;
    const activatedAt = rawDate ? new Date(rawDate).toLocaleString('es-AR') : '—';
    const statusColor = isActive ? 'var(--emerald)' : 'var(--text-muted)';
    const activatedBy = mod.activated_by || mod.activatedBy || '—';

    return `
      <div class="module-card ${isActive ? 'active-module' : 'inactive-module'}" id="moduleCard-${mod.key}">
        <div class="module-info">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="module-name">${mod.name}</div>
            <span style="font-size:11px; font-weight:800; padding:3px 10px; border-radius:12px;
              background:${isActive ? 'rgba(0,230,118,0.15)' : 'rgba(139,148,158,0.15)'};
              color:${statusColor}; border: 1px solid ${statusColor};">
              ${isActive ? 'ACTIVO' : 'INACTIVO'}
            </span>
            ${isCore ? '<span style="font-size:11px; color:#F59E0B; font-weight:800;">⚡ CORE</span>' : ''}
          </div>
          <div class="module-desc">${mod.description || '—'}</div>
          <div class="module-meta">
            Activado por: <strong style="color:#FFF;">${activatedBy}</strong>
            · Fecha: ${activatedAt}
          </div>
        </div>
        ${!isCore ? `
          <label class="toggle-switch" title="${isActive ? 'Desactivar' : 'Activar'} módulo ${mod.name}">
            <input type="checkbox" ${isActive ? 'checked' : ''}
              onchange="toggleModuleActive('${mod.key}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        ` : `<div style="color:var(--text-muted); font-size:12px; font-weight:700;">Siempre activo</div>`}
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
        'Authorization': `Bearer ${localStorage.getItem('hw_token')}`
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
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hw_token')}` }
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
      const isPlatform = t.slug === 'holoware';
      const isSuspended = t.status === 'suspended';
      const planCode = t.plan_code || 'starter';
      const planBadgeColors = {
        starter: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '#3B82F6' },
        pro: { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--emerald)', border: 'var(--emerald)' },
        enterprise: { bg: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', border: '#A78BFA' }
      }[planCode] || { bg: 'rgba(255,255,255,0.1)', color: '#FFF', border: '#888' };

      const modules = t.modules || [];
      const hasModule = (code) => modules.some(m => (m.module_code === code || (code === 'scanban-board' && m.module_code === 'scanban') || (code === 'scanflow' && m.module_code === 'stockflow')) && m.is_enabled);

      const isScanBanBoardActive = hasModule('scanban-board');
      const isScanBanScannerActive = hasModule('scanban-scanner');
      const isScanFlowActive = hasModule('scanflow');

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
                Usuarios: <strong style="color: #FFF;">${users.length}</strong> activos en la empresa
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 10px; text-transform: uppercase; background: ${planBadgeColors.bg}; color: ${planBadgeColors.color}; border: 1px solid ${planBadgeColors.border};">
                Plan ${planCode}
              </span>
              ${!isPlatform ? `
                <button class="${isSuspended ? 'btn-primary' : 'btn-danger'}" style="padding: 4px 8px; font-size: 11px; border-radius: 8px;" onclick="toggleTenantStatus('${t.id}', '${t.name}', '${t.status || 'active'}')" title="${isSuspended ? 'Reactivar Organización' : 'Suspender Organización'}">
                  ${isSuspended ? 'Reactivar' : 'Suspender'}
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Tema Base por Defecto del Tenant -->
          <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Tema Base del Tenant</span>
            <select class="input-field" style="padding: 4px 8px; font-size: 12px; border-radius: 8px; border-color: var(--card-border);" onchange="changeTenantDefaultTheme('${t.id}', this.value)">
              <option value="omarchy_tiling" ${t.active_theme === 'omarchy_tiling' || !t.active_theme ? 'selected' : ''}>Omarchy Tiling WM</option>
              <option value="dark_glassmorphism" ${t.active_theme === 'dark_glassmorphism' ? 'selected' : ''}>Dark Glassmorphism</option>
              <option value="cyberpunk_glassmorphism" ${t.active_theme === 'cyberpunk_glassmorphism' ? 'selected' : ''}>Cyberpunk Glassmorphism</option>
              <option value="soft_minimal_pastel" ${t.active_theme === 'soft_minimal_pastel' ? 'selected' : ''}>Soft Minimal Pastel</option>
            </select>
          </div>

          <!-- Módulos Licenciados Toggles -->
          <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Módulos Licenciados en Vivo</div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
              <!-- ScanBan Board -->
              <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px; cursor: pointer;">
                <span style="font-size: 12px; font-weight: 700; color: ${isScanBanBoardActive ? 'var(--emerald)' : 'var(--text-muted)'};">ScanBan Board</span>
                <input type="checkbox" ${isScanBanBoardActive ? 'checked' : ''} onchange="toggleTenantModuleState('${t.id}', 'scanban-board', this.checked)" style="cursor: pointer;">
              </label>

              <!-- ScanBan Scanner -->
              <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px; cursor: pointer;">
                <span style="font-size: 12px; font-weight: 700; color: ${isScanBanScannerActive ? 'var(--emerald)' : 'var(--text-muted)'};">ScanBan Scanner</span>
                <input type="checkbox" ${isScanBanScannerActive ? 'checked' : ''} onchange="toggleTenantModuleState('${t.id}', 'scanban-scanner', this.checked)" style="cursor: pointer;">
              </label>

              <!-- ScanFlow -->
              <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px; cursor: pointer;">
                <span style="font-size: 12px; font-weight: 700; color: ${isScanFlowActive ? 'var(--accent)' : 'var(--text-muted)'};">ScanFlow</span>
                <input type="checkbox" ${isScanFlowActive ? 'checked' : ''} onchange="toggleTenantModuleState('${t.id}', 'scanflow', this.checked)" style="cursor: pointer;">
              </label>
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

  } catch (err) {
    container.innerHTML = `<div style="color:var(--red); padding:20px;">Error conectando con la API de Tenants: ${err.message}</div>`;
  }
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
        'Authorization': `Bearer ${localStorage.getItem('hw_token')}`
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
        'Authorization': `Bearer ${localStorage.getItem('hw_token')}`
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
        'Authorization': `Bearer ${localStorage.getItem('hw_token')}`
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
