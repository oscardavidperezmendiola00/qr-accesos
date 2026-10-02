import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVENT_CONFIG } from '@/lib/event-config'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    return NextResponse.json(
      { error: 'Configura RESEND_API_KEY y FROM_EMAIL para enviar correos.' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const cardDataUrl = typeof body.cardDataUrl === 'string' ? body.cardDataUrl : ''

  if (!cardDataUrl.startsWith('data:image/png;base64,')) {
    return NextResponse.json(
      { error: 'No se recibió correctamente la tarjeta digital.' },
      { status: 400 },
    )
  }

  if (cardDataUrl.length > 5_500_000) {
    return NextResponse.json(
      { error: 'La imagen del acceso digital es demasiado grande.' },
      { status: 413 },
    )
  }

  const { id } = await context.params
  const db = createAdminClient()
  const { data: guest, error } = await db.from('guests').select('*').eq('id', id).single()

  if (error || !guest) {
    return NextResponse.json({ error: 'Invitado no encontrado.' }, { status: 404 })
  }

  if (!guest.email) {
    return NextResponse.json({ error: 'Este invitado no tiene correo.' }, { status: 400 })
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
  const qrUrl = `${origin}/q/${guest.token}`
  const base64 = cardDataUrl.split(',')[1]
  const accessText = guest.max_accesses === 1
    ? 'Tienes 1 acceso asignado'
    : `Tienes ${guest.max_accesses} accesos asignados`

  const resend = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to: [guest.email],
      subject: `Tu acceso digital - ${EVENT_CONFIG.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#f7edf5;padding:32px 16px;color:#4f2a57">
          <div style="max-width:620px;margin:0 auto;background:#fff9fd;border:1px solid #e3b7db;border-radius:24px;padding:32px">
            <div style="text-align:center;color:#74347e;font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:34px;margin-bottom:24px">
              ${escapeHtml(EVENT_CONFIG.title)}
            </div>
            <h2 style="margin:0 0 14px;color:#74347e">Hola, ${escapeHtml(guest.name)}</h2>
            <p style="line-height:1.6">${escapeHtml(EVENT_CONFIG.thankYouText)}.</p>
            <p style="line-height:1.6">Te compartimos tu acceso digital para <strong>${escapeHtml(EVENT_CONFIG.title)}</strong>.</p>
            <p style="font-size:18px;color:#74347e"><strong>${accessText}.</strong></p>
            <p style="line-height:1.6">Guarda la imagen adjunta y preséntala al momento de ingresar.</p>
            <div style="margin-top:24px;padding:16px;border-radius:14px;background:#f3d3eb">
              <div style="font-size:13px;color:#765a7d;margin-bottom:6px">También puedes abrir tu acceso desde este enlace:</div>
              <a href="${qrUrl}" style="color:#74347e;word-break:break-all">${qrUrl}</a>
            </div>
          </div>
        </div>`,
      attachments: [
        {
          filename: `acceso-${safeFileName(guest.name)}.png`,
          content: base64,
        },
      ],
    }),
  })

  if (!resend.ok) {
    const details = await resend.text()
    return NextResponse.json({ error: `No se pudo enviar el correo: ${details}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;',
  }[char] || char))
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'invitado'
}
