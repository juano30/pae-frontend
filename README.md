
# PAE – Multiforms + Roles
- Sincroniza pendientes
- Si hay internet, guarda directo a MySQL
- Roles funcionando (Admin/Supervisor/Técnico/Usuario)
- Administración de usuarios con botón Volver
- Header y Footer con branding
- Selector de formularios (cada uno con su propia tabla)

## Instalación
1) Copia en `C:\xampp\htdocs\pae\`
2) En phpMyAdmin importa `server/schema.sql`
3) Crea admin: abre `http://localhost/pae/server/create_admin.php` → admin/123456
4) Abre `http://localhost/pae/`
5) Si tenías versiones previas, en Chrome: DevTools → Application → Service Workers → **Unregister** y recarga.
