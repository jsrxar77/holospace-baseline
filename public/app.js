let currentUser = null;

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

async function loadKanbanData() {
  try {
    const res = await fetch('/api/kanban');
    const data = await res.json();

    // Render Backlog
    const backlogList = document.getElementById('backlogList');
    document.getElementById('backlogCount').innerText = data.backlog.length;
    backlogList.innerHTML = data.backlog.length === 0
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos libres</div>'
      : data.backlog.map(item => `
        <div class="kanban-card" onclick="openInvoiceModal('${item.orderNumber}')">
          <button class="btn-delete-card" onclick="deleteBacklogOrder('${item.orderNumber}', event)">🗑️ Borrar</button>
          <div class="card-order-no">Pedido #${item.orderNumber}</div>
          <div class="card-meta">Cliente: ${item.clientName}</div>
          <div class="card-meta">Archivo: ${item.fileName}</div>
        </div>
      `).join('');

    // Render Doing
    const doingList = document.getElementById('doingList');
    document.getElementById('doingCount').innerText = data.doing.length;
    doingList.innerHTML = data.doing.length === 0
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos en proceso</div>'
      : data.doing.map(item => `
        <div class="kanban-card" style="border-color: var(--cobalt);" onclick="openInvoiceModal('${item.orderNumber}')">
          <div class="card-order-no" style="color: var(--cobalt);">Pedido #${item.orderNumber}</div>
          <div class="card-meta" style="color: #FFF; font-weight: 700;">👤 Operario: ${item.operatorEmail}</div>
          <div class="card-meta">Avance: ${item.scannedItems} / ${item.totalItems} U (${item.progressPercentage}%)</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${item.progressPercentage}%;"></div>
          </div>
        </div>
      `).join('');

    // Render Done
    const doneList = document.getElementById('doneList');
    document.getElementById('doneCount').innerText = data.done.length;
    doneList.innerHTML = data.done.length === 0
      ? '<div style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Sin pedidos completados</div>'
      : data.done.map(item => `
        <div class="kanban-card" style="border-color: var(--amber);" onclick="openInvoiceModal('${item.orderNumber}')">
          <div class="card-order-no" style="color: var(--amber);">Pedido #${item.orderNumber}</div>
          <div class="card-meta">👤 Auditado por: ${item.operatorEmail}</div>
          <div class="card-meta" style="font-size: 11px; color: var(--emerald);">${item.auditStamp}</div>
        </div>
      `).join('');

  } catch (e) {
    console.error('Error cargando Kanban:', e);
  }
}

async function openInvoiceModal(orderNumber) {
  try {
    const res = await fetch(`/api/order-detail?orderNumber=${orderNumber}`);
    const data = await res.json();
    if (!data.success || !data.order) {
      alert('No se pudo cargar el detalle del pedido.');
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

    const totalAmount = order.items.reduce((acc, i) => acc + (i.unitPrice || 0) * i.quantityRequired, 0);

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
            <div style="font-size: 12px; color: var(--text-muted);">COMPROBANTE DE VENTA EN BASE DE DATOS</div>
            <div style="font-size: 24px; font-weight: 900; color: var(--emerald);">PEDIDO #${order.orderNumber}</div>
            <div style="font-size: 14px; margin-top: 4px;">Cliente: <strong>${order.clientName}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; color: var(--text-muted);">Fecha de Emisión: ${order.issueDate}</div>
            <div style="font-size: 13px; color: var(--cobalt); font-weight: 800; margin-top: 4px;">PASO ACTUAL: ${order.status}</div>
            <div style="font-size: 12px; color: var(--amber); margin-top: 2px;">👤 Usuario / Operario: ${order.operatorEmail}</div>
            <button class="btn-primary" style="margin-top: 10px; font-size: 13px; padding: 8px 14px;" onclick="downloadPdf('${order.orderNumber}')">⬇️ Descargar PDF de la Orden</button>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Código EAN</th>
              <th>Descripción</th>
              <th style="text-align: center;">P. Unitario</th>
              <th style="text-align: center;">Escaneado / Requerido</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 2px dashed var(--card-border);">
          <div style="font-size: 13px; color: var(--text-muted);">Total de unidades requeridas: ${order.totalItemsRequired} U</div>
          <div style="font-size: 20px; font-weight: 900; color: var(--emerald);">TOTAL: $${totalAmount.toLocaleString('es-AR')}</div>
        </div>

        <!-- Historial de Logs de Auditoría -->
        <div style="margin-top: 16px; border-top: 1px solid var(--card-border); padding-top: 16px;">
          <h4 style="font-weight: 900; font-size: 16px; margin-bottom: 12px; color: var(--cobalt);">📜 Historial Completo de Trazabilidad (Email Usuario & Logs)</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${logsHtml || '<div style="color: var(--text-muted); font-size: 13px;">Sin logs registrados</div>'}
          </div>
        </div>
      </div>
    `;

    document.getElementById('invoiceContent').innerHTML = invoiceHtml;
    document.getElementById('invoiceModal').classList.remove('hidden');
  } catch (e) {
    alert('Error al abrir el detalle del comprobante.');
  }
}

function downloadPdf(orderNumber) {
  window.open(`/api/download-pdf?orderNumber=${orderNumber}`, '_blank');
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.add('hidden');
}

async function deleteBacklogOrder(orderNumber, event) {
  event.stopPropagation();
  if (!confirm(`¿Estás seguro de eliminar el Pedido #${orderNumber} de Backlog y de la Base de Datos?`)) return;

  const userEmail = currentUser ? currentUser.email : 'admin@drinklovers.com';

  try {
    const res = await fetch('/api/delete-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, userEmail })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Pedido #${orderNumber} eliminado por ${userEmail}.`);
      loadKanbanData();
    } else {
      alert(`Error al borrar: ${data.error}`);
    }
  } catch (err) {
    alert('Error de conexión al eliminar el comprobante.');
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1] || e.target.result;
    const userEmail = currentUser ? currentUser.email : 'admin@drinklovers.com';
    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          pdfBase64: base64,
          userEmail
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`¡Comprobante ${file.name} validado y cargado por ${userEmail}!`);
        loadKanbanData();
      } else {
        alert(`Error al validar el PDF: ${data.error}`);
      }
    } catch (err) {
      alert('Error al subir el archivo PDF.');
    }
  };
  reader.readAsDataURL(file);
}

function openQrModal() {
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

function openUserModal() {
  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

async function handleCreateUser(e) {
  e.preventDefault();
  const name = document.getElementById('newName').value;
  const email = document.getElementById('newEmail').value;
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Usuario ${email} creado exitosamente.`);
      closeUserModal();
    } else {
      alert(`Error al crear usuario: ${data.error}`);
    }
  } catch (err) {
    alert('Error al comunicar con el servidor.');
  }
}

function logout() {
  localStorage.removeItem('pw_token');
  localStorage.removeItem('pw_user');
  location.reload();
}
