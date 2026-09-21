import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    return NextResponse.json({ error: 'Configura RESEND_API_KEY y FROM_EMAIL para enviar correos.' }, { status: 400 })
  }

  const { id } = await context.params
  const db = createAdminClient()
  const { data: guest, error } = await db.from('guests').select('*').eq('id', id).single()
  if (error || !guest) return NextResponse.json({ error: 'Invitado no encontrado.' }, { status: 404 })
  if (!guest.email) return NextResponse.json({ error: 'Este invitado no tiene correo.' }, { status: 400 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const qrUrl = `${origin}/q/${guest.token}`
  const dataUrl = await QRCode.toDataURL(qrUrl, {
    width: 900,
    margin: 2,
    color: { dark: guest.qr_color, light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })
  const base64 = dataUrl.split(',')[1]

  const resend = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: [guest.email],
      subject: `Tu código QR de acceso - ${guest.name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>Hola, ${escapeHtml(guest.name)}</h2><p>Te compartimos tu código QR de acceso.</p><p><strong>Accesos disponibles al emitirlo:</strong> ${Math.max(guest.max_accesses - guest.used_accesses, 0)}</p><p>También puedes abrir tu código desde este enlace:</p><p><a href="${qrUrl}">${qrUrl}</a></p><p>Adjuntamos el QR en formato PNG.</p></div>`,
      attachments: [{ filename: `qr-${safeFileName(guest.name)}.png`, content: base64 }],
    }),
  })

  if (!resend.ok) {
    const details = await resend.text()
    return NextResponse.json({ error: `No se pudo enviar el correo: ${details}` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c] || c))
}
function safeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'invitado'
}
