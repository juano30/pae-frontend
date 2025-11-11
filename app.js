// Catálogos en memoria (se llenan desde catalogs.php y se guardan en localStorage)
let catalogs = {
  subregiones: [],
  municipios: []   // cada uno: { id, subregion_id, nombre }
};

// Helpers de DOM
const $ = s => document.querySelector(s);

// URL base del backend en InfinityFree
const API_BASE = "https://paeapp.epizy.com/";

// Endpoints
const URL_GUARDAR_VCT      = API_BASE + "guardar_form_vct.php";
const URL_RESPONSABLES     = API_BASE + "obtener_responsables.php";
const URL_UPLOAD_FOTO_VCT  = API_BASE + "upload_foto_vct.php";


// Referencias principales
const formLogin = $('#login-form');
const formReport = $('#report-form');
const btnSync = $('#btn-sync');
const btnLogout = $('#btn-logout');
const netStatus = $('#net-status');
const saveStatus = $('#save-status') || { textContent: '' };
const pendingList = $('#pending-list');
const sentList = $('#sent-list');
const btnInstall = $('#btn-install');
const formSelect = $('#form-select');

// Selects dependientes
const subSelect = $('#subregion');
const munSelect = $('#municipio');

// Selects de transporte y CTV
const selTransporte = document.getElementById('id_transporteVCT_fk');
const camposR = ["r11", "r12", "r13", "r14", "r15", "r16", "r17", "r18"];

// Fotos evidencia (hasta 10)
//const inputFotos   = document.getElementById('fotos');
//const previewFotos = document.getElementById('preview-fotos');
//let fotosSeleccionadas = [];

// ----------------------
// Estado de red / PWA
// ----------------------
function updateNetBadge() {
  if (!netStatus) return;
  netStatus.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  netStatus.style.background = navigator.onLine ? '#22c55e' : '#ef4444';
}
addEventListener('online', () => { updateNetBadge(); processQueue(); });
addEventListener('offline', updateNetBadge);
updateNetBadge();

let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstall) btnInstall.hidden = false;
});

btnInstall?.addEventListener('click', async () => {
  btnInstall.hidden = true;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

/*localStorage.setItem('usuario_actual', JSON.stringify({
  usuario: usuario,
  rol: rol,
  nombre: nombre
}));*/

// ----------------------
// Firma (canvas)
// ----------------------
const canvas = document.getElementById('sig-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let drawing = false;

function pos(e) {
  const r = canvas.getBoundingClientRect();
  const t = (e.touches ? e.touches[0] : e);
  return {
    x: (t.clientX - r.left) * (canvas.width / r.width),
    y: (t.clientY - r.top) * (canvas.height / r.height)
  };
}
function start(e) {
  if (!ctx) return;
  drawing = true;
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  e.preventDefault();
}
function move(e) {
  if (!drawing || !ctx) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  e.preventDefault();
}
function end() { drawing = false; }

if (canvas) {
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  $('#sig-clear')?.addEventListener('click', () => {
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// ----------------------
// Auth + IndexedDB
// ----------------------
async function setToken(t) { await DB.dbPut(DB.AUTH, { key: 'token', value: t }); }
async function getToken() { const r = await DB.dbGet(DB.AUTH, 'token'); return r ? r.value : null; }
async function setUser(u) { await DB.dbPut(DB.USER, { key: 'user', value: u }); }
async function getUser() { const r = await DB.dbGet(DB.USER, 'user'); return r ? r.value : null; }
async function clearAuth() { await DB.dbDelete(DB.AUTH, 'token'); await DB.dbDelete(DB.USER, 'user'); }

// ----------------------
// Catálogos
// ----------------------
async function loadCatalogs() {
  const token = await getToken();
  const cached = localStorage.getItem('pae_catalogs');
  catalogs = cached ? JSON.parse(cached) : { subregiones: [], municipios: [] };

  try {
    const r = await fetch('/pae/server/catalogs.php?type=full', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Error catálogos');

    catalogs = {
      subregiones: data.subregiones || [],
      municipios: data.municipios || [],
      transporteVCT: data.transporteVCT || [],
      CTV: data.CTV || []
    };
    localStorage.setItem('pae_catalogs', JSON.stringify(catalogs));
  } catch (err) {
    console.warn('No se pudieron actualizar catálogos, uso cache local:', err.message);
  }

  populateSubregiones();
  populateTransporte();
  populateCTV();
}

function populateSubregiones() {
  if (!subSelect) return;
  subSelect.innerHTML = '<option value="">Seleccione…</option>';
  catalogs.subregiones.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nombre;
    subSelect.appendChild(opt);
  });
  resetMunicipios();
}

function resetMunicipios() {
  if (!munSelect) return;
  munSelect.innerHTML = '<option value="">Seleccione la subregión primero…</option>';
  munSelect.disabled = true;
}

function populateMunicipios(subregionId) {
  if (!munSelect) return;
  munSelect.innerHTML = '<option value="">Seleccione…</option>';
  const list = catalogs.municipios.filter(
    m => String(m.subregion_id) === String(subregionId)
  );
  list.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.nombre;
    munSelect.appendChild(opt);
  });
  munSelect.disabled = !list.length;
}

// Transporte VCT
function populateTransporte() {
  if (!selTransporte) return;
  selTransporte.innerHTML = '<option value="">Seleccione...</option>';
  (catalogs.transporteVCT || []).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nombre;
    selTransporte.appendChild(opt);
  });
}

// CTV en R11...R18
function populateCTV() {
  (catalogs.CTV || []).forEach(c => {
    camposR.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      if (!sel.dataset.filled) {
        sel.innerHTML = '<option value="">Seleccione...</option>';
        sel.dataset.filled = '1';
      }
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
  });
}

// Evento al cambiar subregión
subSelect?.addEventListener('change', (e) => {
  const val = e.target.value;
  if (!val) resetMunicipios();
  else populateMunicipios(val);
});

// ----------------------
// Utilidades varias
// ----------------------
function uid() {
  return (Date.now().toString(36) +
    crypto.getRandomValues(new Uint32Array(1))[0].toString(36));
}

function showByRole(role) {
  document.querySelectorAll('[data-role]').forEach(el => el.hidden = true);
  const map = {
    'Admin':      ['form', 'pend', 'sent', 'admin', 'export'],
    'Supervisor': ['form', 'pend', 'sent', 'export'],
    'Técnico':    ['form', 'pend'],
    'Usuario':    ['form']
  };
  (map[role] || []).forEach(k =>
    document.querySelectorAll(`[data-role*="${k}"]`)
      .forEach(el => el.hidden = false)
  );
  document.getElementById('sec-login').hidden = !!role;
  document.getElementById('btn-logout').hidden = !role;
}

function renderItems(c, items, isP) {
  if (!c) return;
  c.innerHTML = '';
  if (!items.length) {
    c.innerHTML = '<div class="muted">Sin registros.</div>';
    return;
  }
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML =
      '<div><strong>' + (it.nombre || '—') + '</strong> – ' + (it.municipio || '—') +
      '<br/><small>' + new Date(it.fecha).toLocaleDateString() +
      ' • ' + (it.form || '') + ' • id: ' + it.id +
      '</small></div><div>' +
      (isP ? '<small>PENDIENTE</small>' : '<small>ENVIADO</small>') +
      '</div>';
    c.appendChild(d);
  }
}

async function refreshLists() {
  const p = await DB.dbGetAll(DB.OUTBOX);
  const s = await DB.dbGetAll(DB.SENT);
  renderItems(pendingList, p, true);
  renderItems(sentList, s, false);
  const u = await getUser();
  showByRole(u ? u.role : null);
}

// Helper: convertir File → dataURL JPEG reducida
function fileToJpegDataURL(file, maxWidth = 1280) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ----------------------
// Login / Logout
// ----------------------
formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = $('#user').value.trim();
  const pass = $('#pass').value;

  try {
    const r = await fetch('/pae/server/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || 'Login inválido');

    await setToken(d.token);
    await setUser(d.user);

    localStorage.setItem('usuario_actual', JSON.stringify({
      usuario: d.user?.username || user,
      rol: d.user?.role || '',
      nombre: d.user?.nombre || ''
    }));

    await loadCatalogs();
    await refreshLists();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

btnLogout?.addEventListener('click', async () => {
  await clearAuth();
  location.reload();
});

// Si ya hay token, cargamos catálogos
getToken().then(t => { if (t) loadCatalogs(); });

// === FOTOS EVIDENCIA ===
const inputFotos = document.getElementById('fotos');
const previewFotos = document.getElementById('preview-fotos');
let fotosSeleccionadas = []; // aquí guardamos TODOS los File

if (inputFotos && previewFotos) {
  fotosSeleccionadas = [];

  inputFotos.addEventListener('change', () => {
    const nuevos = Array.from(inputFotos.files);
    if (!nuevos.length) return;

    // Máximo 10 en TOTAL
    if (fotosSeleccionadas.length + nuevos.length > 10) {
      alert('Solo puedes subir hasta 10 fotos en total.');
      inputFotos.value = '';
      return;
    }

    // 👇 IMPORTANTE: ACUMULAR, NO REEMPLAZAR
    nuevos.forEach(archivo => {
      fotosSeleccionadas.push(archivo);

      const img = document.createElement('img');
      img.src = URL.createObjectURL(archivo);
      previewFotos.appendChild(img);
    });

    // Limpio el input para que el siguiente cambio vuelva a disparar
    inputFotos.value = '';
    console.log('Fotos seleccionadas hasta ahora:', fotosSeleccionadas.length);
  });
}


// ----------------------
// Envío de formulario (VCT + otros)
// ----------------------
formReport?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fecha = $('#fecha')?.value || new Date().toISOString().slice(0, 10);
  const form = formSelect ? formSelect.value : 'default';

  // Subregión / Municipio
  let subregion_id = null;
  let municipio_id = null;
  let subregion_name = '';
  let municipio_name = '';

  if (subSelect) {
    subregion_id = subSelect.value || null;
    subregion_name = subSelect.options[subSelect.selectedIndex]?.text || '';
  }
  if (munSelect) {
    municipio_id = munSelect.value || null;
    municipio_name = munSelect.options[munSelect.selectedIndex]?.text || '';
  }

  // Nombre para listas
  const nombreInput =
    $('#nombre') ||
    $('#operador') ||
    $('#proveedor') ||
    $('#alimentosprovee');
  const nombre = nombreInput ? nombreInput.value.trim() : '';

  const municipioDisplay =
    municipio_name ||
    ($('#municipio') ? $('#municipio').value.trim() : '');

  // Campos específicos VCT
  const operador = $('#operador')?.value.trim() || '';
  const proveedor = $('#proveedor')?.value.trim() || '';
  const alimentosprovee = $('#alimentosprovee')?.value.trim() || '';
  const direccion = $('#direccion')?.value.trim() || '';
  const celular = $('#celular')?.value.trim() || '';
  const id_transporteVCT_fk = selTransporte ? (selTransporte.value || null) : null;

  // Valores r11...r18
  const rValues = {};
  camposR.forEach(id => {
    const el = document.getElementById(id);
    rValues[id] = el ? (el.value || '') : '';
  });

  // Observaciones VCT
  const observacionesVCT = $('#observacionesVCT')?.value.trim() || '';
  const obs = observacionesVCT;

  // Responsable
  const id_responsables_fk = $('#id_responsables_fk')?.value || null;
  const cargo_res = $('#cargo_res')?.value || '';

  // Totales / porcentaje
  const total_items = contarCamposSeleccionados();
  const porcen_cumpli = calcularPorcentajeCumplimiento();

  // Firma
  const firmaB64 = canvas ? canvas.toDataURL('image/png') : null;

  // Fotos → dataURL (para poder guardar offline y luego subir)
  let fotosB64 = [];

  if (fotosSeleccionadas && fotosSeleccionadas.length) {
    console.log('Convirtiendo a base64', fotosSeleccionadas.length, 'fotos');
    for (const f of fotosSeleccionadas) {
      try {
        const durl = await fileToJpegDataURL(f);
        fotosB64.push(durl);
      } catch (err) {
        console.error('Error convirtiendo una foto:', err);
      }
    }
  }

  const currentUser = await getUser(); // viene de IndexedDB (DB.USER)
  const user_id    = currentUser?.id      || '';
  const user_name  = currentUser?.nombre  || currentUser?.username || '';
  const user_role  = currentUser?.role    || '';


    const rec = {
    id: uid(),
    form,
    fecha,
    nombre,
    municipio: municipioDisplay,
    obs,
    subregion_id,
    municipio_id,
    subregion_name,
    municipio_name,

    operador,
    proveedor,
    alimentosprovee,
    direccion,
    celular,
    id_transporteVCT_fk,

    r11: rValues["r11"],
    r12: rValues["r12"],
    r13: rValues["r13"],
    r14: rValues["r14"],
    r15: rValues["r15"],
    r16: rValues["r16"],
    r17: rValues["r17"],
    r18: rValues["r18"],

    total_items,
    porcen_cumpli,
    observacionesVCT,
    id_responsables_fk,
    cargo: cargo_res,

    firmaB64,
    fotos: fotosB64,

    // 👇 NUEVO
    user_id,
    user_name,
    user_role,

    createdAt: new Date().toISOString()
  };


  // Intento online primero
  if (navigator.onLine) {
    try {
      const token = await getToken();
      await uploadItem(rec, token);
      await DB.dbPut(DB.SENT, rec);
      saveStatus.textContent = 'Enviado a BD ✔';
      (e.target.reset && e.target.reset());
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
      fotosSeleccionadas = [];
      if (previewFotos) previewFotos.innerHTML = '';
      await refreshLists();
      return;
    } catch (err) {
      console.warn('Falló envío online, guardo offline', err);
    }
  }

  // Offline o error → va a la cola
  await DB.dbPut(DB.OUTBOX, rec);
  saveStatus.textContent = 'Guardado localmente ✔';
  (e.target.reset && e.target.reset());
  ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
  fotosSeleccionadas = [];
  if (previewFotos) previewFotos.innerHTML = '';
  await refreshLists();
});

// ----------------------
// Sync manual
// ----------------------
$('#btn-sync')?.addEventListener('click', () => processQueue());

// Envío real al backend
async function uploadFormVCT(item, token) {
  const fd = new FormData();
  fd.append('id', item.id);
  fd.append('fecha', item.fecha);
  fd.append('id_sub_fk', item.subregion_id || '');
  fd.append('id_municipio_fk', item.municipio_id || '');
  fd.append('operador', item.operador || '');
  fd.append('proveedor', item.proveedor || '');
  fd.append('alimentosprovee', item.alimentosprovee || '');
  fd.append('direccion', item.direccion || '');
  fd.append('celular', item.celular || '');
  fd.append('id_transporteVCT_fk', item.id_transporteVCT_fk || '');

  fd.append('r11', item.r11 || '');
  fd.append('r12', item.r12 || '');
  fd.append('r13', item.r13 || '');
  fd.append('r14', item.r14 || '');
  fd.append('r15', item.r15 || '');
  fd.append('r16', item.r16 || '');
  fd.append('r17', item.r17 || '');
  fd.append('r18', item.r18 || '');

  fd.append('total_items', item.total_items ?? 0);
  fd.append('porcen_cumpli', item.porcen_cumpli ?? 0);
  fd.append('observacionesVCT', item.observacionesVCT || '');
  fd.append('id_responsables_fk', item.id_responsables_fk || '');
  fd.append('cargo', item.cargo || '');

  if (item.user_id)   fd.append('user_id',   item.user_id);
  if (item.user_name) fd.append('user_name', item.user_name);
  if (item.user_role) fd.append('user_role', item.user_role);

  // 🔑 IMPORTANTE: mandar también el token en el body
  if (token) {
    fd.append('token', token);
  }

  // Firma
  if (item.firmaB64) {
    const blob2 = await (await fetch(item.firmaB64)).blob();
    fd.append('firma', blob2, 'firma.png');
  }

  const r = await fetch('/pae/server/guardar_form_vct.php', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: fd
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (!d.ok) throw new Error(d.msg || 'Error backend form_VCT');
  return d;
}



// ⬇️ agrega aquí la función
async function uploadFotosVCT(item, token) {
  if (!item.fotos || !item.fotos.length) {
    console.log('Sin fotos para', item.id);
    return;
  }

  console.log('Subiendo', item.fotos.length, 'fotos para', item.id);

  for (let i = 0; i < item.fotos.length; i++) {
    const dataUrl = item.fotos[i];

    const blob = await (await fetch(dataUrl)).blob();
    const fd = new FormData();
    fd.append('id_form_vct', item.id);
    fd.append('foto', blob, `vct_${item.id}_${i + 1}.jpg`);

    const r = await fetch('/pae/server/upload_foto_vct.php', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });

    if (!r.ok) {
      throw new Error(`Foto ${i + 1}: HTTP ${r.status}`);
    }

    const d = await r.json();
    if (!d.ok) {
      throw new Error(`Foto ${i + 1}: ${d.msg || 'Error backend'}`);
    }

    console.log('Foto', i + 1, 'guardada como', d.ruta);
  }
}


async function uploadItem(item, token) {
  if (item.form === 'visita') {
    await uploadFormVCT(item, token);
    await uploadFotosVCT(item, token);
    return;
  }

  const fd = new FormData();
  fd.append('form', item.form);
  fd.append('id', item.id);
  fd.append('fecha', item.fecha);
  fd.append('nombre', item.nombre || '');
  fd.append('municipio', item.municipio || '');
  fd.append('obs', item.obs || '');

  if (item.subregion_id) fd.append('subregion_id', item.subregion_id);
  if (item.municipio_id) fd.append('municipio_id', item.municipio_id);
  if (item.subregion_name) fd.append('subregion_name', item.subregion_name);
  if (item.municipio_name) fd.append('municipio_name', item.municipio_name);
  if (item.user_id)   fd.append('user_id',   item.user_id);
  if (item.user_name) fd.append('user_name', item.user_name);
  if (item.user_role) fd.append('user_role', item.user_role);
  if (item.firmaB64) {
    const blob2 = await (await fetch(item.firmaB64)).blob();
    fd.append('firma', blob2, 'firma.png');
  }

  // 🔑 también aquí:
  if (token) {
    fd.append('token', token);
  }

  const r = await fetch('/pae/server/upload.php', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: fd
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Error backend');
  return d;
}


// Procesa cola offline
async function processQueue() {
  const token = await getToken();
  if (!token) { alert('Inicia sesión.'); return; }

  const p = await DB.dbGetAll(DB.OUTBOX);
  for (const it of p) {
    try {
      await uploadItem(it, token);
      await DB.dbPut(DB.SENT, it);
      await DB.dbDelete(DB.OUTBOX, it.id);
    } catch (err) {
      console.error('No se pudo subir', it.id, err.message);
    }
  }
  refreshLists();
}

// ----------------------
// Conteo y porcentaje R11...R18
// ----------------------

// Ajusta aquí qué valores significan "CUMPLE"
const valoresCumple = ["CUMPLE", "1"];

function esCumple(valor) {
  if (valor === null || valor === undefined) return false;
  const v = valor.toString().trim().toUpperCase();
  return valoresCumple.some(vc => v === vc.toString().trim().toUpperCase());
}

function contarCamposSeleccionados() {
  let contador = 0;
  camposR.forEach(id => {
    const campo = document.getElementById(id);
    if (campo && campo.value.trim() !== "") contador++;
  });

  const lbl = document.getElementById("resultadoConteo");
  if (lbl) {
    lbl.innerText = "Campos diligenciados: " + contador + " de " + camposR.length;
  }

  const hiddenTotal = document.getElementById("total_items");
  if (hiddenTotal) hiddenTotal.value = contador;

  return contador;
}

function calcularPorcentajeCumplimiento() {
  let total = 0;
  const pesoPorCampo = 12.5; // cada R11...R18 vale 12.5%

  camposR.forEach(id => {
    const campo = document.getElementById(id);
    if (!campo) return;
    const valor = campo.value;
    if (esCumple(valor)) {
      total += pesoPorCampo;
    }
  });

  const lblResultado = document.getElementById("resultadoPorcentaje");
  if (lblResultado) {
    lblResultado.innerText = "Porcentaje cumplimiento: " + total.toFixed(1) + "%";
  }

  const hiddenPorc = document.getElementById("porcentaje_r11_r18");
  if (hiddenPorc) {
    hiddenPorc.value = total.toFixed(1);
  }

  return total;
}

// Asociar funciones a cambios de campos
camposR.forEach(id => {
  const campo = document.getElementById(id);
  if (campo) {
    campo.addEventListener("change", () => {
      contarCamposSeleccionados();
      calcularPorcentajeCumplimiento();
    });
  }
});

// ----------------------
// Responsables
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  const selectResponsable = document.getElementById("id_responsables_fk");
  const inputCargo = document.getElementById("cargo_res");

  if (!selectResponsable || !inputCargo) return;

  fetch("server/obtener_responsables.php")
    .then(response => response.json())
    .then(data => {
      data.forEach(res => {
        const option = document.createElement("option");
        option.value = res.id;
        option.textContent = res.nombre_res;
        option.dataset.cargo = res.cargo_res;
        selectResponsable.appendChild(option);
      });
    })
    .catch(error => console.error("Error al cargar responsables:", error));

  selectResponsable.addEventListener("change", function () {
    const selected = this.options[this.selectedIndex];
    inputCargo.value = selected.dataset.cargo || "";
  });
});

// Carga inicial de listas
refreshLists();

// Estado Online / Offline en el footer
function updateConn() {
  const on = navigator.onLine;
  const el = document.getElementById('status-conn');
  if (el) el.textContent = on ? 'Online' : 'Offline';
}
addEventListener('online', updateConn);
addEventListener('offline', updateConn);
updateConn();


fotosSeleccionadas = [];
if (previewFotos) previewFotos.innerHTML = '';
