// Endpoints
const URL_GUARDAR_VCT      = API_BASE + "guardar_form_vct.php";
const URL_RESPONSABLES     = API_BASE + "obtener_responsables.php";
const URL_UPLOAD_FOTO_VCT  = API_BASE + "upload_foto_vct.php";

const DB_NAME='pae_mf_db'; const DB_VERSION=1;
const OUTBOX='outbox', SENT='sent', AUTH='auth', USER='user';
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(OUTBOX))db.createObjectStore(OUTBOX,{keyPath:'id'});if(!db.objectStoreNames.contains(SENT))db.createObjectStore(SENT,{keyPath:'id'});if(!db.objectStoreNames.contains(AUTH))db.createObjectStore(AUTH,{keyPath:'key'});if(!db.objectStoreNames.contains(USER))db.createObjectStore(USER,{keyPath:'key'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbPut(s,v){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(s,'readwrite');tx.objectStore(s).put(v);tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error);});}
async function dbGet(s,k){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(s,'readonly');const r=tx.objectStore(s).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbGetAll(s){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(s,'readonly');const r=tx.objectStore(s).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
async function dbDelete(s,k){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(s,'readwrite');tx.objectStore(s).delete(k);tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error);});}
window.DB={dbPut,dbGet,dbGetAll,dbDelete,OUTBOX,SENT,AUTH,USER};
