let currentUser = null;
let customDialogResolver = null;
let collapsedUserGroups = new Set(); // Guarda los usuarios colapsados en DOING/DONE

document.addEventListener('DOMContentLoaded', () => {
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

// KANBAN EN TIEMPO REAL CON SUB-GRUPOS COLAPSABLES POR USUARIO
async function loadKanbanData() {
  try {
    const res = await fetch('/api/kanban');
    const data = await res.json();

    // 1. Render Backlog
    const backlogList = document.getElementById('backlogList');
    document.getElementById('backlogCount').innerText = data.backlog.length;
    backlogList.innerHTML = data.backlog.length === 0
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos libres</div>'
      : data.backlog.map(item => `
        <div class="kanban-card" onclick="openInvoiceModal('${item.orderNumber}')">
          <button class="btn-delete-card" onclick="deleteBacklogOrder('${item.orderNumber}', event)">🗑️ Borrar</button>
          <div class="card-order-no">Pedido #${item.orderNumber}</div>
          <div class="card-meta">Cliente: <strong>${item.clientName}</strong></div>
          <div class="card-meta">Archivo: ${item.fileName}</div>
        </div>
      `).join('');

    // 2. Render Doing por Usuario (Acordeón colapsable)
    const doingList = document.getElementById('doingList');
    document.getElementById('doingCount').innerText = data.doing.length;
    
    if (data.doing.length === 0) {
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
          <div class="kanban-card" style="border-color: var(--cobalt);" onclick="openInvoiceModal('${item.orderNumber}')">
            <div class="card-order-no" style="color: var(--cobalt);">Pedido #${item.orderNumber}</div>
            <div class="card-meta" style="color: #FFF; font-weight: 700;">Cliente: ${item.clientName}</div>
            <div class="card-meta">Avance: ${item.scannedItems} / ${item.totalItems} U (${item.progressPercentage}%)</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${item.progressPercentage}%;"></div>
            </div>
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

    // 3. Render Done por Usuario (Acordeón colapsable)
    const doneList = document.getElementById('doneList');
    document.getElementById('doneCount').innerText = data.done.length;

    if (data.done.length === 0) {
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

    const invoiceHtml = `
      <div class="invoice-card">
        <div class="invoice-header">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">EMISOR: <strong>${order.vendorName || 'WYPRA SA'}</strong> (CUIT: ${order.vendorCuit || '30-71828749-5'})</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--emerald);">COMPROBANTE #${order.orderNumber}</div>
            <div style="font-size: 15px; margin-top: 4px;">Cliente: <strong>${order.clientName}</strong> ${order.contactPerson ? `(${order.contactPerson})` : ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; color: var(--text-muted);">Fecha de Emisión: ${order.issueDate || order.issueDate}</div>
            <div style="font-size: 13px; color: var(--cobalt); font-weight: 800; margin-top: 4px;">ESTADO: ${order.status}</div>
            <div style="font-size: 12px; color: var(--amber); margin-top: 2px;">👤 Usuario Asignado: ${order.operatorEmail}</div>
            <button class="btn-primary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px;" onclick="downloadPdf('${order.orderNumber}')">⬇️ Descargar PDF de la Orden</button>
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
          userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com'
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
        userEmail: currentUser ? currentUser.email : 'admin@drinklovers.com'
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
    const tbody = document.getElementById('usersTableBody');

    tbody.innerHTML = data.users.map(u => `
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
// EXPLORADOR INTELIGENTE DE PEDIDOS
// ----------------------------------------------------
async function fetchExplorerOrders() {
  const query = document.getElementById('orderSearchQuery').value;
  const status = document.getElementById('orderStatusFilter').value;
  const sortBy = document.getElementById('orderSortBy').value;

  try {
    const res = await fetch(`/api/orders?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&sortBy=${encodeURIComponent(sortBy)}`);
    const data = await res.json();
    const grid = document.getElementById('ordersExplorerGrid');

    if (!data.orders || data.orders.length === 0) {
      grid.innerHTML = '<div style="color: var(--text-muted); font-size: 15px; grid-column: 1/-1; text-align: center; padding: 40px;">No se encontraron pedidos que coincidan con la búsqueda.</div>';
      return;
    }

    grid.innerHTML = data.orders.map(o => `
      <div class="kanban-card" onclick="openInvoiceModal('${o.orderNumber}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="card-order-no">Pedido #${o.orderNumber}</div>
          <span class="badge-role" style="font-size: 11px;">${o.status}</span>
        </div>
        <div class="card-meta" style="color: #FFF; font-weight: 800;">Cliente: ${o.clientName}</div>
        <div class="card-meta">Fecha: ${o.issueDate || 'Hoy'}</div>
        <div class="card-meta">Ítems: <strong>${o.totalItemsRequired} U</strong></div>
        <div class="card-meta" style="color: var(--emerald); font-weight: 900; font-size: 15px;">Total: $${(o.totalAmount || 0).toLocaleString('es-AR')}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error al explorar pedidos:', e);
  }
}

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
  document.getElementById('loginModal').classList.remove('hidden');
}
