# QR Accesos – Next.js + Supabase + Vercel

Sistema para administrar personas e invitaciones mediante códigos QR.

## Funciones incluidas

- Login exclusivo para administrador con Supabase Auth.
- Alta de personas con nombre, correo opcional y número máximo de accesos.
- Selector de color libre para el QR (rosa, lila o cualquier HEX).
- QR único por persona.
- Vista previa y descarga del QR como PNG.
- Copiar enlace individual.
- Envío opcional por correo mediante Resend.
- Activar/desactivar un QR.
- Reiniciar el contador de usos.
- Cada validación exitosa consume exactamente 1 acceso mediante una función SQL transaccional.
- Bloqueo automático cuando ya no quedan accesos.
- Registro de intentos válidos, agotados, desactivados o inválidos en `access_logs`.

## 1. Crear Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**.
3. Copia y ejecuta `supabase/schema.sql`.
4. En **Authentication > Users**, crea manualmente el usuario que será administrador con correo y contraseña.
5. Copia la URL del proyecto, la Publishable Key y la Service Role Key.

> La `SUPABASE_SERVICE_ROLE_KEY` es secreta. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni mostrarse en el navegador.

## 2. Variables locales

Copia `.env.example` a `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
ADMIN_EMAIL=correo-del-admin@dominio.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

El `ADMIN_EMAIL` debe ser exactamente el correo creado en Supabase Auth.

## 3. Ejecutar localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## 4. Subir a Vercel

1. Sube este proyecto a GitHub/GitLab/Bitbucket o impórtalo directamente en Vercel.
2. En Vercel agrega las mismas variables de entorno.
3. Cambia `NEXT_PUBLIC_SITE_URL` por tu dominio real, por ejemplo:

```env
NEXT_PUBLIC_SITE_URL=https://mi-qr.vercel.app
```

4. Redeploy.

## 5. Envío opcional por correo

Si deseas usar el botón **Enviar correo**, agrega:

```env
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=Accesos <accesos@tudominio.com>
```

El dominio/remitente debe estar permitido por tu cuenta de Resend.

## Flujo de acceso

1. El admin crea a una persona con, por ejemplo, 3 accesos.
2. Descarga o envía su QR.
3. Al escanearlo y abrir la URL `/q/{token}`, se registra 1 uso.
4. El primer escaneo deja 2, el segundo 1 y el tercero 0.
5. A partir del cuarto intento, el sistema muestra **Sin accesos disponibles** y no incrementa el contador.

## Importante

En esta primera versión, **abrir la URL del QR equivale a registrar una entrada**. Por eso no debe abrirse el enlace solo para "verlo" si no se quiere consumir un acceso. Para un evento grande, una siguiente mejora recomendable es crear una pantalla de **lector/validador para el personal de acceso**, donde la persona solo presenta el QR y el staff lo escanea sin que el invitado pueda consumir accesos por su cuenta.
