# Envío de correos con Gmail

Esta versión reemplaza Resend por Gmail SMTP mediante Nodemailer.

## Variables nuevas

```env
GMAIL_USER=tu-cuenta@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
FROM_EMAIL=Mis XV Alexa <tu-cuenta@gmail.com>
```

`GMAIL_APP_PASSWORD` debe ser una contraseña de aplicación de Google, no la contraseña normal de la cuenta.

## Instalar dependencia

Después de copiar esta versión sobre tu proyecto actual:

```bash
rm -rf node_modules .next
rm -f package-lock.json
npm install
npm run dev
```

Esto genera un package-lock nuevo que incluye Nodemailer.

## Ya no se usan

```env
RESEND_API_KEY=
```

Puedes eliminarla de `.env.local` y Vercel.

## Producción en Vercel

Agrega en Settings > Environment Variables:

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `FROM_EMAIL`

Mantén también todas las variables de Supabase y `NEXT_PUBLIC_SITE_URL`.
