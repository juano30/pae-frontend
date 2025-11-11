// admin.js

async function getToken() {
  const r = await DB.dbGet(DB.AUTH, 'token');
  return r ? r.value : null;
}

async function getUser() {
  const r = await DB.dbGet(DB.USER, 'user');
  return r ? r.value : null;
}

// Detectar base de la API (flexible si algún día se mueve la app)
const API_BASE = location.pathname.includes('/pae/')
  ? '/pae/server/'
  : 'server/';

// Referencias al DOM
const tbl       = document.getElementById('users-table');
const f         = document.getElementById('user-form');
const btnReload = document.getElementById('btn-reload');
const btnDelete = document.getElementById('u-delete');
const selRole   = document.getElementById('u-role');

// Solo permite entrar a Admin
async function ensureAdmin() {
  const u = await getUser();
  console.log('Usuario en admin.js:', u);

  const role = u?.role ? String(u.role).toLowerCase() : '';

  if (!u || role !== 'admin') {
    alert('Solo Admin');
    location.href = './';
    return;
  }
}


// Cargar roles desde backend
async function loadRoles() {
  try {
    const t = await getToken();
    if (!t) {
      alert('Sesión no válida. Vuelve a iniciar sesión.');
      location.href = './';
      return;
    }

    const r = await fetch(API_BASE + 'roles.php', {
      headers: { 'Authorization': 'Bearer ' + t }
    });

    if (!r.ok) {
      alert('No se pudieron cargar roles (' + r.status + ')');
      return;
    }

    const d = await r.json();
    selRole.innerHTML = d.roles
      .map(x => `<option value="${x.id}">${x.name}</option>`)
      .join('');
  } catch (err) {
    alert('Error cargando roles: ' + err.message);
  }
}

// Listar usuarios
async function listUsers() {
  try {
    const t = await getToken();
    if (!t) {
      tbl.innerHTML = '<div class="muted">Sesión expirada. Vuelve a iniciar sesión.</div>';
      return;
    }

    const r = await fetch(API_BASE + 'users.php', {
      headers: { 'Authorization': 'Bearer ' + t }
    });

    if (!r.ok) {
      tbl.innerHTML = '<div class="muted">No se pudo listar usuarios (' + r.status + ')</div>';
      return;
    }

    const data = await r.json();
    tbl.innerHTML = '';

    data.users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'rowline';
      row.innerHTML = `
        <div>
          <strong>${u.username}</strong>
          <small>(${u.role || '—'})</small>
        </div>
        <div>
          <button class="btn small" data-id="${u.id}">Editar</button>
        </div>
      `;

      row.querySelector('button').addEventListener('click', () => {
        document.getElementById('u-id').value        = u.id;
        document.getElementById('u-username').value  = u.username;
        selRole.value                                = u.role_id;
        document.getElementById('u-pass').value      = '';
        btnDelete.disabled                           = false;
      });

      tbl.appendChild(row);
    });
  } catch (err) {
    tbl.innerHTML = '<div class="muted">Error cargando usuarios: ' + err.message + '</div>';
  }
}

// Recargar lista
btnReload.addEventListener('click', listUsers);

// Submit Crear / Editar usuario
f.addEventListener('submit', async (e) => {
  e.preventDefault();

  const t = await getToken();
  if (!t) {
    alert('Sesión expirada. Vuelve a iniciar sesión.');
    location.href = './';
    return;
  }

  const idField = document.getElementById('u-id').value;
  const payload = {
    action: idField ? 'update' : 'create',
    id: idField || null,
    username: document.getElementById('u-username').value.trim(),
    password: document.getElementById('u-pass').value, // vacío = no cambiar
    role_id: parseInt(selRole.value, 10)
  };

  try {
    const r = await fetch(API_BASE + 'users.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + t
      },
      body: JSON.stringify(payload)
    });

    // Leer la respuesta SOLO una vez
    const ct = r.headers.get('content-type') || '';
    let data;

    if (ct.includes('application/json')) {
      data = await r.json();
    } else {
      const txt = await r.text();
      data = { ok: r.ok, error: txt };
    }

    if (!r.ok || !data.ok) {
      throw new Error(data?.error || ('HTTP ' + r.status));
    }

    // OK
    f.reset();
    document.getElementById('u-id').value   = '';
    document.getElementById('u-pass').value = '';
    btnDelete.disabled                      = true;
    await listUsers();
    alert('Usuario guardado ✔');
  } catch (err) {
    alert('No se pudo guardar: ' + err.message);
    // opcional: refrescar la lista por si algo cambió en el backend
    // await listUsers();
  }
});

// Eliminar usuario
btnDelete.addEventListener('click', async () => {
  const id = document.getElementById('u-id').value;
  if (!id) return;

  if (!confirm('¿Eliminar usuario?')) return;

  const t = await getToken();
  if (!t) {
    alert('Sesión expirada. Vuelve a iniciar sesión.');
    location.href = './';
    return;
  }

  try {
    const r = await fetch(API_BASE + 'users.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + t
      },
      body: JSON.stringify({ action: 'delete', id })
    });

    const d = await r.json();
    if (!r.ok || !d.ok) {
      alert('Error: ' + (d.error || r.status));
      return;
    }

    f.reset();
    document.getElementById('u-id').value      = '';
    document.getElementById('u-delete').disabled = true;
    await listUsers();
  } catch (err) {
    alert('No se pudo eliminar: ' + err.message);
  }
});

// Inicialización
ensureAdmin();
loadRoles();
listUsers();
