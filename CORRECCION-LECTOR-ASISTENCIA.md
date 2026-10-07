# Corrección del lector de asistencia

Esta versión corrige el registro de asistencia desde `/admin/scanner`.

## Qué cambió

- El lector ya no depende de `redeem_qr_access()` para descontar el acceso.
- `/api/admin/redeem` consulta directamente `guests` y aumenta `used_accesses` en 1.
- La actualización usa comparación del valor anterior para evitar dobles descuentos en lecturas simultáneas.
- Se guarda el intento en `access_logs`.
- El lector muestra claramente **ASISTENCIA REGISTRADA** cuando el descuento ocurrió.
- Abrir `/q/TOKEN` o `/scan/TOKEN` sigue sin descontar accesos.

## Prueba esperada

Invitado con 2 accesos:

1. Antes: `usados 0 / disponibles 2`.
2. Escanear desde `/admin/scanner`.
3. Debe mostrar `ASISTENCIA REGISTRADA`.
4. Debe quedar `usados 1 / disponibles 1`.
5. Segundo escaneo: `usados 2 / disponibles 0`.
6. Tercer escaneo: `Sin accesos disponibles` y no aumenta usados.

No hace falta ejecutar SQL nuevo en Supabase.
