import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

const TOKEN_RE = /^[a-f0-9]{48}$/i

type RedeemResult = {
  status: string
  guest_id: string | null
  name: string | null
  max_accesses: number | null
  used_accesses: number | null
  remaining_accesses: number | null
  qr_color: string | null
  active: boolean | null
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  let body: { token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const token = String(body.token || '').trim().toLowerCase()
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'El QR no pertenece a este sistema.' }, { status: 400 })
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null

  const db = createAdminClient()
  const { data, error } = await db.rpc('redeem_qr_access', {
    p_token: token,
    p_ip: ip,
    p_user_agent: userAgent,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = (Array.isArray(data) ? data[0] : data) as RedeemResult | undefined
  if (!result) {
    return NextResponse.json({ error: 'No se pudo validar el acceso.' }, { status: 500 })
  }

  return NextResponse.json({ result })
}
