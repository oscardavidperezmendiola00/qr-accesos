# Cambios aplicados para “Mis XV Alexa”

1. El botón del administrador ahora genera y descarga un **acceso digital PNG completo**, no solo el QR.
2. El acceso incluye **Mis XV Alexa**, QR, nombre del invitado, agradecimiento y número de accesos asignados.
3. El correo de Resend adjunta la misma tarjeta PNG completa.
4. La pantalla al escanear muestra nombre, accesos asignados, utilizados y disponibles.
5. Se conserva el diseño rosa con letras lilas/moradas y el color personalizado del QR.
6. `supabase/schema.sql` contiene la versión corregida de `redeem_qr_access` para instalaciones futuras.

## No requiere cambios de tablas

Si tu Supabase actual ya funciona, no tienes que borrar ni recrear datos.

## Prueba local

```bash
npm install
npm run dev
```

Luego entra al administrador, crea o usa un invitado y prueba:

- Descargar acceso digital.
- Enviar correo.
- Escanear el QR.

## Subir los cambios existentes a GitHub/Vercel

```bash
git add .
git commit -m "Acceso digital Mis XV Alexa"
git push
```

Vercel hará el deploy desde GitHub. Verifica que `NEXT_PUBLIC_SITE_URL` siga apuntando a tu URL pública de producción.
