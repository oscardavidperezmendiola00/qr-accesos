# QR Accesos — Mis XV Alexa (V2)

Esta versión cambia de forma visible el sistema para que el QR se entregue como un **acceso digital tipo invitación**.

## Cambios visibles

- Encabezado del panel: **Mis XV Alexa**.
- Cada invitado muestra una vista previa grande de su tarjeta rosa.
- La tarjeta contiene: **Mis XV Alexa + QR + nombre + agradecimiento + accesos asignados**.
- El botón principal descarga `acceso-nombre.png`, no el QR suelto.
- El correo adjunta la tarjeta completa.
- Al escanear el QR se muestran: nombre, accesos asignados, usados y disponibles.
- La pantalla de lectura usa fondo rosa y letras moradas.

## Para usarla sobre tu proyecto actual

1. Conserva tu `.env.local` y tu carpeta `.git` del proyecto actual.
2. Copia los archivos de esta carpeta sobre tu proyecto actual y acepta reemplazar.
3. Ejecuta:

```bash
npm install
npm run dev
```

4. Abre `http://localhost:3000/admin`.
5. Haz una recarga fuerte del navegador (`Cmd + Shift + R` en Mac).

Si sigues viendo **“Panel de códigos QR”** y el botón **“Generar QR”**, entonces estás ejecutando la carpeta antigua. En esta V2 debe decir **“Mis XV Alexa”**, **“Crear acceso digital”** y **“Generar acceso digital”**.

## Producción

Después de probar:

```bash
git add .
git commit -m "Rediseño acceso digital Mis XV Alexa"
git push
```

Vercel debería desplegar automáticamente.


## Lector QR del administrador

La ruta `/admin/scanner` usa la cámara para registrar entradas. Los QR nuevos apuntan a `/q/TOKEN` y no consumen accesos al abrirse; únicamente el lector autenticado descuenta un acceso. Consulta `LECTOR-QR.md`.
