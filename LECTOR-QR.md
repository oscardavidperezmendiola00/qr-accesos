# Lector QR del administrador

Esta versión agrega una pantalla exclusiva para registrar entradas desde la cámara del dispositivo.

## Ruta

`/admin/scanner`

Solo un administrador autenticado puede registrar accesos porque el lector envía el token a `/api/admin/redeem`, que valida la sesión antes de ejecutar `redeem_qr_access`.

## Cambio importante

Los QR nuevos contienen `/q/TOKEN`, que es una vista de consulta y **no descuenta accesos**.

- Abrir el QR con la cámara normal del teléfono: no descuenta.
- Enviar la tarjeta por correo: no descuenta.
- Abrir el enlace del correo: no descuenta.
- Leer el QR desde `/admin/scanner`: descuenta exactamente 1 acceso.

La antigua ruta `/scan/TOKEN` se conserva solo por compatibilidad y redirige a `/q/TOKEN`; ya no descuenta.

## Uso

1. Inicia sesión como administrador.
2. En el panel pulsa **Abrir lector QR**.
3. Pulsa **Activar cámara** y acepta el permiso.
4. Apunta al QR del invitado.
5. El lector se detiene al detectar un código, registra una sola entrada y muestra nombre y accesos restantes.
6. Pulsa **Escanear siguiente** para continuar.

También se puede leer una imagen del QR o pegar manualmente el enlace/token como respaldo.
