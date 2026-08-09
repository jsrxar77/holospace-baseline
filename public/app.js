let currentUser = null;
let customDialogResolver = null;
let collapsedUserGroups = new Set(); // Guarda los usuarios colapsados en DOING/DONE

function populateSavedCredentials() {
  const savedEmail = localStorage.getItem('pw_saved_email') || 'admin@drinklovers.com.ar';
  const savedPassword = localStorage.getItem('pw_saved_password') || 'drinklovers2026!';
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (emailInput) emailInput.value = savedEmail;
  if (passwordInput) passwordInput.value = savedPassword;
}

function toggleLoginPasswordVisibility() {
  const passwordInput = document.getElementById('loginPassword');
  const toggleBtn = document.getElementById('togglePasswordBtn');
  if (passwordInput) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      if (toggleBtn) toggleBtn.innerText = '🙈';
    } else {
      passwordInput.type = 'password';
      if (toggleBtn) toggleBtn.innerText = '👁️';
    }
  }
}

async function loadActiveTheme() {
  try {
    const res = await fetch('/api/theme');
    const data = await res.json();
    if (data && data.theme) {
      const root = document.documentElement;
      const t = data.theme;
      if (t.background) root.style.setProperty('--bg-dark', t.background);
      if (t.cardBg) root.style.setProperty('--card-bg', t.cardBg);
      if (t.cardBorder) root.style.setProperty('--card-border', t.cardBorder);
      if (t.emerald) root.style.setProperty('--emerald', t.emerald);
      if (t.cobalt) root.style.setProperty('--cobalt', t.cobalt);
      if (t.amber) root.style.setProperty('--amber', t.amber);
      if (t.red) root.style.setProperty('--red', t.red);
      if (t.textMain) root.style.setProperty('--text-main', t.textMain);
      if (t.textMuted) root.style.setProperty('--text-muted', t.textMuted);

      const selectEl = document.getElementById('headerThemeSelect');
      if (selectEl && data.activeThemeKey && selectEl.value !== data.activeThemeKey) {
        selectEl.value = data.activeThemeKey;
      }
    }
  } catch (e) {
    console.error('Error cargando tema dinámico:', e);
  }
}

async function changeAppThemeSubmit(themeKey) {
  try {
    const res = await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeKey,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
      })
    });
    const data = await res.json();

    if (data.success) {
      await loadActiveTheme();
    } else {
      await showCustomAlert('Acción Denegada', data.error || 'No se pudo cambiar el tema visual.');
    }
  } catch (e) {
    await showCustomAlert('Error de Conexión', 'No se pudo comunicar con el servidor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadActiveTheme();
  populateSavedCredentials();

  const token = localStorage.getItem('pw_token');
  const userJson = localStorage.getItem('pw_user');
  if (token && userJson) {
    currentUser = JSON.parse(userJson);
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('userBadge').innerText = `${currentUser.role}: ${currentUser.email}`;
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
        localStorage.setItem('pw_token', data.token);
        localStorage.setItem('pw_user', JSON.stringify(data.user));
        localStorage.setItem('pw_saved_email', email);
        localStorage.setItem('pw_saved_password', password);

        document.getElementById('loginModal').classList.add('hidden');
        document.getElementById('userBadge').innerText = `${currentUser.role}: ${currentUser.email}`;
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

// NAVEGACIÓN POR PESTAÑAS (KANBAN / USUARIOS / EXPLORADOR DE PEDIDOS)
function switchTab(tabName) {
  document.getElementById('tabKanban').classList.remove('active');
  document.getElementById('tabUsers').classList.remove('active');
  document.getElementById('tabOrders').classList.remove('active');

  document.getElementById('viewKanban').classList.add('hidden');
  document.getElementById('viewUsers').classList.add('hidden');
  document.getElementById('viewOrders').classList.add('hidden');

  if (tabName === 'kanban') {
    document.getElementById('tabKanban').classList.add('active');
    document.getElementById('viewKanban').classList.remove('hidden');
    loadKanbanData();
  } else if (tabName === 'users') {
    document.getElementById('tabUsers').classList.add('active');
    document.getElementById('viewUsers').classList.remove('hidden');
    fetchUsers();
  } else if (tabName === 'orders') {
    document.getElementById('tabOrders').classList.add('active');
    document.getElementById('viewOrders').classList.remove('hidden');
    fetchExplorerOrders();
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
    const res = await fetch('/api/kanban');
    const data = await res.json();

    // 1. Render Backlog (Gris - Draggable hacia LISTO)
    const backlogList = document.getElementById('backlogList');
    document.getElementById('backlogCount').innerText = (data.backlog || []).length;
    backlogList.innerHTML = (!data.backlog || data.backlog.length === 0)
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin comprobantes pendientes</div>'
      : data.backlog.map(item => `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.orderNumber}')" style="border-color: var(--card-border); cursor: grab;" onclick="openInvoiceModal('${item.orderNumber}')">
          <div style="display: flex; gap: 6px; position: absolute; top: 12px; right: 12px;">
            <button class="btn-primary" style="font-size: 11px; padding: 4px 8px; border-radius: 6px;" onclick="markOrderReady('${item.orderNumber}', event)">✓ Pasar a Listo</button>
            <button class="btn-delete-card" style="position: static;" onclick="deleteBacklogOrder('${item.orderNumber}', event)">🗑️</button>
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
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.orderNumber}')" style="border-color: var(--emerald); cursor: grab;" onclick="openInvoiceModal('${item.orderNumber}')">
          <button class="btn-secondary" style="position: absolute; top: 12px; right: 12px; font-size: 11px; padding: 4px 8px;" onclick="markOrderBacklog('${item.orderNumber}', event)">↩️ A Backlog</button>
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
          <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${item.orderNumber}')" style="border-color: var(--cobalt); cursor: grab;" onclick="openInvoiceModal('${item.orderNumber}')">
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
          <div class="kanban-card" style="border-color: var(--amber);" onclick="openInvoiceModal('${item.orderNumber}')">
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
async function markOrderReady(orderNumber, event) {
  if (event) event.stopPropagation();

  try {
    const res = await fetch('/api/mark-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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

async function markOrderBacklog(orderNumber, event) {
  if (event) event.stopPropagation();

  try {
    const res = await fetch('/api/mark-backlog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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
    const res = await fetch('/api/reset-doing-to-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        orderNumber,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users && Array.isArray(data.users)) {
        const activeUsers = data.users.filter(u => u.active !== 0 && u.active !== false);
        selectEl.innerHTML = activeUsers.map(u => `
          <option value="${u.email}">${u.name} (${u.email}) [${u.role}]</option>
        `).join('');
      } else {
        selectEl.innerHTML = '<option value="jsrxar@gmail.com">Javier Rizzo (jsrxar@gmail.com)</option>';
      }
    } catch (e) {
      selectEl.innerHTML = '<option value="jsrxar@gmail.com">Javier Rizzo (jsrxar@gmail.com)</option>';
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
    const res = await fetch('/api/assign-order-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: pendingAssignOrderId,
        orderNumber: pendingAssignOrderNumber,
        operatorEmail: selectedOperator,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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
function handleDragStart(event, orderNumber) {
  event.dataTransfer.setData('text/plain', orderNumber);
  event.dataTransfer.effectAllowed = 'move';
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

async function handleDropToListo(event) {
  event.preventDefault();
  const orderNumber = event.dataTransfer.getData('text/plain');
  if (orderNumber) {
    try {
      const res = await fetch(`/api/order-detail?orderNumber=${orderNumber}`);
      const data = await res.json();
      if (data.success && data.order && (data.order.status === 'DOING' || data.order.status === 'SCANNING')) {
        await resetOrderDoingToReady(data.order.id, orderNumber, event);
        return;
      }
    } catch (e) {}

    await markOrderReady(orderNumber, event);
  }
}

async function handleDropToBacklog(event) {
  event.preventDefault();
  const orderNumber = event.dataTransfer.getData('text/plain');
  if (orderNumber) {
    await markOrderBacklog(orderNumber, event);
  }
}

async function handleDropToDoing(event) {
  event.preventDefault();
  const orderNumber = event.dataTransfer.getData('text/plain');
  if (orderNumber) {
    await openAssignOperatorModal(null, orderNumber, event);
  }
}

async function markOrderReadyAndCloseModal(orderNumber) {
  closeInvoiceModal();
  await markOrderReady(orderNumber);
}

async function markOrderBacklogAndCloseModal(orderNumber) {
  closeInvoiceModal();
  await markOrderBacklog(orderNumber);
}


// DETALLE COMPLETO DE COMPROBANTE Y MARCA DE AGUA
async function openInvoiceModal(orderNumber) {
  try {
    const res = await fetch(`/api/order-detail?orderNumber=${orderNumber}`);
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
          <span style="color: var(--emerald);">👤 ${log.userEmail}</span>
          <span style="color: var(--text-muted); font-size: 11px;">⏱️ ${log.timestamp}</span>
        </div>
        <div style="color: #FFF;">${log.details}</div>
      </div>
    `).join('');

    const statusLabelEs = order.status === 'READY' ? 'LISTO' : order.status === 'DOING' || order.status === 'SCANNING' ? 'EN PROCESO' : order.status === 'DONE' ? 'COMPLETADO' : 'BACKLOG';

    const statusActionButton = order.status === 'BACKLOG'
      ? `<button class="btn-primary" style="margin-top: 10px; font-size: 13px; padding: 10px 16px; background-color: var(--emerald); color: #000; font-weight: 900;" onclick="markOrderReadyAndCloseModal('${order.id || order.orderNumber}')">✓ VALIDAR Y PASAR A LISTO</button>`
      : order.status === 'READY'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px;" onclick="markOrderBacklogAndCloseModal('${order.id || order.orderNumber}')">↩️ DEVOLVER A BACKLOG</button>`
      : (order.status === 'DOING' || order.status === 'SCANNING') && currentUser && currentUser.role === 'ADMIN'
      ? `<button class="btn-secondary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px; border-color: var(--cobalt); color: #60A5FA; font-weight: 800;" onclick="resetOrderDoingToReadyAndCloseModal('${order.id}', '${order.orderNumber}')">↩️ REASIGNAR Y LIBERAR A LISTO</button>`
      : '';

    const invoiceHtml = `
      <div class="invoice-card">
        <div class="invoice-header">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">EMISOR: <strong>${order.vendorName || 'WYPRA SA'}</strong> (CUIT: ${order.vendorCuit || '30-71828749-5'})</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--emerald);">COMPROBANTE #${order.orderNumber}</div>
            <div style="font-size: 15px; margin-top: 4px;">Cliente: <strong>${order.clientName}</strong> ${order.contactPerson ? `(${order.contactPerson})` : ''}</div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
            <div style="font-size: 13px; color: var(--text-muted);">Fecha de Emisión: ${order.issueDate || order.issueDate}</div>
            <div style="font-size: 13px; color: var(--cobalt); font-weight: 800; margin-top: 4px;">ESTADO: ${statusLabelEs}</div>
            <div style="font-size: 12px; color: var(--amber); margin-top: 2px;">👤 Usuario Asignado: ${order.operatorEmail}</div>
            <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
              <button class="btn-secondary" style="font-size: 13px; padding: 8px 14px;" onclick="downloadPdf('${order.orderNumber}')">⬇️ Descargar PDF</button>
              ${statusActionButton}
            </div>
          </div>
        </div>

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
              <td colspan="4" style="text-align: right; font-weight: 900; font-size: 16px;">TOTAL FACTURA:</td>
              <td style="text-align: right; font-weight: 900; font-size: 18px; color: var(--emerald);">$${totalCalculated.toLocaleString('es-AR')}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 10px;">
          <h4 style="font-size: 15px; font-weight: 800; color: var(--cobalt); margin-bottom: 10px;">Línea de Tiempo y Auditoría por Usuario:</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${logsHtml}
          </div>
        </div>
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

function downloadPdf(orderNumber) {
  window.open(`/api/download-pdf?orderNumber=${orderNumber}`, '_blank');
}

// SUBIDA DE COMPROBANTES PDF
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          pdfBase64: base64,
          userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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
    }
  };
  reader.readAsDataURL(file);
}

// ELIMINACIÓN DE COMPROBANTES EN BACKLOG (MODAL PERSONALIZADO)
async function deleteBacklogOrder(orderNumber, event) {
  if (event) event.stopPropagation();

  const confirmed = await showCustomConfirm(
    'Eliminar Comprobante',
    `¿Estás seguro de eliminar el pedido #${orderNumber} del Backlog? Se quitará de la Base de Datos.`
  );

  if (!confirmed) return;

  try {
    const res = await fetch('/api/delete-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com.ar'
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
async function fetchUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const usersList = Array.isArray(data) ? data : (data.users || []);
    const tbody = document.getElementById('usersTableBody');

    tbody.innerHTML = usersList.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span class="badge-role">${u.role}</span></td>
        <td style="font-family: monospace;">${u.operatorId || '-'}</td>
        <td>
          <span style="color: ${u.active !== false ? 'var(--emerald)' : 'var(--red)'}; font-weight: 800;">
            ${u.active !== false ? '● Activo' : '○ Desactivado'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editUser('${u.id}', '${u.name}', '${u.email}', '${u.role}', ${u.active !== false})">Editar</button>
            <button class="${u.active !== false ? 'btn-danger' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 12px;" onclick="toggleUserStatus('${u.id}', ${u.active !== false})">
              ${u.active !== false ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error al cargar usuarios:', e);
  }
}

function openUserModal() {
  document.getElementById('userId').value = '';
  document.getElementById('userModalTitle').innerText = 'Crear Nuevo Usuario';
  document.getElementById('userNameInput').value = '';
  document.getElementById('userEmailInput').value = '';
  document.getElementById('userPasswordInput').value = '';
  document.getElementById('userRoleInput').value = 'OPERATOR';
  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

function editUser(id, name, email, role, active) {
  document.getElementById('userId').value = id;
  document.getElementById('userModalTitle').innerText = 'Editar Usuario';
  document.getElementById('userNameInput').value = name;
  document.getElementById('userEmailInput').value = email;
  document.getElementById('userPasswordInput').value = '••••••••';
  document.getElementById('userRoleInput').value = role;
  document.getElementById('userModal').classList.remove('hidden');
}

async function saveUserSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const name = document.getElementById('userNameInput').value;
  const email = document.getElementById('userEmailInput').value;
  const password = document.getElementById('userPasswordInput').value;
  const role = document.getElementById('userRoleInput').value;

  const url = '/api/users';
  const method = id ? 'PUT' : 'POST';
  const payload = id ? { id, name, email, password, role } : { name, email, password, role };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeUserModal();
      await showCustomAlert('¡Guardado!', `Usuario ${email} guardado correctamente.`);
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
    const res = await fetch('/api/users');
    const data = await res.json();
    const usersList = Array.isArray(data) ? data : (data.users || []);
    allOperatorEmails = usersList.map((u) => u.email.toLowerCase());

    const container = document.getElementById('operatorPillsContainer');
    if (!container) return;

    const allPill = `
      <button type="button" 
        onclick="clearOperatorFilter()"
        style="background: ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : '#21262D'}; color: ${selectedExplorerOperators.size === 0 ? '#000' : '#FFF'}; border: 1px solid ${selectedExplorerOperators.size === 0 ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer;">
        ${selectedExplorerOperators.size === 0 ? '✓ ' : ''}Todos los Operarios
      </button>
    `;

    const pillsHtml = allOperatorEmails
      .map((email) => {
        const isSelected = selectedExplorerOperators.has(email);
        return `
        <button type="button" 
          onclick="toggleOperatorFilter('${email}')"
          style="background: ${isSelected ? 'var(--emerald)' : '#21262D'}; color: ${isSelected ? '#000' : '#FFF'}; border: 1px solid ${isSelected ? 'var(--emerald)' : 'var(--card-border)'}; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          ${isSelected ? '✓ ' : ''}${email}
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
    const res = await fetch(
      `/api/orders?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&sortBy=${encodeURIComponent(sortBy)}&operators=${encodeURIComponent(operators)}`
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

function openQrModal() {
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

function logout() {
  localStorage.removeItem('pw_token');
  localStorage.removeItem('pw_user');
  currentUser = null;
  populateSavedCredentials();
  document.getElementById('loginModal').classList.remove('hidden');
}

