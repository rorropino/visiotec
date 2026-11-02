# Viva la Salud — versión de prueba

Aplicación web responsiva / PWA en **PHP 8.3+, SQLite, JavaScript y CSS**, aislada de otros sistemas. Se entrega como una **versión funcional de pruebas**, no una aplicación clínica certificada.

## Funcionalidad implementada
- Registro y login con contraseña cifrada (password_hash), sesiones seguras y CSRF.
- Perfil: objetivo (bajar grasa, definir, ganar músculo, mantener, bienestar), edad, estatura, peso, experiencia, capacidad de flexiones/sentadillas, días y minutos, equipamiento, precauciones y restricciones.
- Plan de fuerza/calistenia y cardio suave para casa, alternado por tipo, adaptativo al esfuerzo percibido de la sesión anterior.
- Entrenador guiado con cronómetro, rondas, descansos, sonidos y síntesis de voz del navegador.
- Despensa por usuario, recomendaciones de recetas rankeadas según ingredientes disponibles, instrucciones, faltantes y restricciones.
- Guía de porciones y recuperación ajustada cualitativamente a objetivo, peso registrado y esfuerzo reciente.
- Registro de comidas, hidratación, descanso y progreso de peso/cintura, con historial.
- Motor de recetas local sin coste adicional; integración *opcional* OpenRouter para generar recetas, vía credencial **solo de servidor**.
- PWA instalable y caché de recursos visuales: las operaciones de cuenta y datos requieren conexión.

## Despliegue objetivo
**https://test.visiotec.cl/viva-salud/**

> **No se modifica la aplicación SGSE ya alojada en test.visiotec.cl.** Se necesita acceso de despliegue al document root real del subdominio y confirmar que sus reglas de reescritura excluyen esta subcarpeta. El repositorio Git no determina por sí solo dónde publica LiteSpeed.

### Requisitos
- PHP 8.3+ con `PDO`, `pdo_sqlite` y `openssl`, permiso de escritura fuera del document root.
- HTTPS, Apache/LiteSpeed, sesiones PHP.
- Crear directorio privado de base de datos fuera de webroot. Por defecto: `dirname(__DIR__,3)/viva_salud_private/viva_salud.sqlite` relativo a `api/bootstrap.php`. Se puede definir `VIVA_DB_PATH` absoluto con variables de entorno de hosting.
- No subir archivos SQLite a Git ni colocarlos en carpeta pública. `api/schema.sql` crea esquema automáticamente en primer acceso.

### IA generativa gratis (opcional)
Definir en entorno PHP del **servidor**:
- `VIVA_OPENROUTER_API_KEY` — credencial, no subir a Git.
- `VIVA_OPENROUTER_MODEL` — opcional, por defecto `openrouter/free`.

Solo se aceptan modelos `openrouter/free` o `:free` y se limitan a **3 solicitudes por usuario al día**. Si no hay credencial, la app sigue funcionando con recomendaciones locales y declara de forma explícita que la IA generativa está desactivada. Nunca colocar la clave en JS o HTML.

### Publicación mediante GitHub Actions
- CI en `.github/workflows/viva-salud.yml` ante cambios en la rama `test/viva-salud`.
- Despliegue SFTP/SSH **manual** con `workflow_dispatch`, después de tests.
- Secretos requeridos para publicar (todos se configuran en GitHub Actions Secrets):
  - `VIVA_SSH_HOST`, `VIVA_SSH_USER`, `VIVA_SSH_PRIVATE_KEY`,
  - `VIVA_SSH_KNOWN_HOSTS` (host key verificada, no generar en el runner),
  - `VIVA_DEPLOY_PATH` (ruta absoluta real de la carpeta `viva-salud` de test.visiotec.cl).
- Sin estos datos, la rama queda en GitHub pero **no se afirma que la app esté desplegada**.
- El deploy usa rsync sobre SSH **sin --delete** y excluye tests, archivos privados, claves y bases de datos.

### Desarrollo y pruebas
Local bajo un host que sirva la ruta `/viva-salud/`.
- `php -l api/bootstrap.php && php -l api/engine.php && php -l api/index.php`
- `node --check assets/app.js`
- `php -S 127.0.0.1:18887 -t ..` ejecutado desde `test/viva-salud` (el docroot real es `test`).
- `python3 tests/smoke.py`: integración API, 34 requests probados al momento de publicación.
- `NODE_PATH=<ruta a node_modules> node tests/browser.cjs` (requiere Puppeteer y Chromium), prueba visual escritorio/móvil y recorridos de uso.

### Seguridad y alcance
Esta versión no ofrece evaluación médica, diagnóstico, estimaciones de calorías clínicas, ni garantía de abdominales marcados. Para condiciones de salud se recomiendan evaluaciones profesionales y se evitan progresiones de alta intensidad; las elecciones de alimentos no sustituyen recomendaciones individuales de un nutricionista. El usuario elige qué información sensible declarar en su perfil.

### Rutas
- Front: `/viva-salud/index.html`
- API: `/viva-salud/api/index.php?action=...`
- Datos: SQLite fuera de webroot. Identificador de usuario para partición de registros.
