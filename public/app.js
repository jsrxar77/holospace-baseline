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
        <div class="kanban-card">
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
        <div class="kanban-card" style="border-color: var(--cobalt);">
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
        <div class="kanban-card" style="border-color: var(--amber);">
          <div class="card-order-no" style="color: var(--amber);">Pedido #${item.orderNumber}</div>
          <div class="card-meta">Auditado por: ${item.operatorId}</div>
          <div class="card-meta" style="font-size: 11px; color: var(--emerald);">${item.auditStamp}</div>
        </div>
      `).join('');

  } catch (e) {
    console.error('Error cargando Kanban:', e);
  }
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1] || e.target.result;
    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          pdfBase64: base64
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`¡Comprobante ${file.name} validado y publicado en Backlog!`);
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
