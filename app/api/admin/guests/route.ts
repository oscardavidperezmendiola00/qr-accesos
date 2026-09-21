import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const db = createAdminClient()
  const { data, error } = await db.from('guests').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ guests: data })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim() || null
  const maxAccesses = Number(body.max_accesses)
  const qrColor = String(body.qr_color || '#A855F7')

  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  if (!Number.isInteger(maxAccesses) || maxAccesses < 1 || maxAccesses > 999) {
    return NextResponse.json({ error: 'Los accesos deben estar entre 1 y 999.' }, { status: 400 })
  }
  if (!COLOR_RE.test(qrColor)) return NextResponse.json({ error: 'Color inválido.' }, { status: 400 })

  const token = randomBytes(24).toString('hex')
  const db = createAdminClient()
  const { data, error } = await db.from('guests').insert({
    name,
    email,
    max_accesses: maxAccesses,
    qr_color: qrColor,
    token,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ guest: data }, { status: 201 })
}
