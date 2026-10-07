# Corrección definitiva del descuento de accesos

Esta versión evita que un acceso se descuente al enviar el correo, abrir el enlace o escanear el QR con la cámara normal del teléfono.

## Flujo nuevo

- `/q/[token]`: vista pública de consulta. **Nunca descuenta accesos**.
- `/scan/[token]`: compatibilidad con tarjetas antiguas. Redirige a `/q/[token]` y **ya no descuenta**.
- `/admin/scanner`: lector QR exclusivo del administrador.
- `/api/admin/redeem`: endpoint protegido que registra/descuenta exactamente un acceso después de que el lector del administrador detecta un QR válido.

## QR nuevos

Los QR generados por el administrador ahora contienen `/q/[token]`.

Esto significa que:

- Enviar el correo no descuenta.
- Los filtros de seguridad de Gmail no descuentan.
- El invitado puede abrir su QR o enlace sin gastar accesos.
- La entrada solo se registra cuando el personal abre `/admin/scanner` y lee el QR.

## Lector

El lector detiene la cámara después de detectar un QR para evitar dobles lecturas. Después muestra:

- Nombre del invitado.
- Accesos asignados.
- Accesos utilizados.
- Accesos disponibles.
- Estado autorizado/rechazado.

Para la siguiente persona se pulsa **Escanear siguiente**.
