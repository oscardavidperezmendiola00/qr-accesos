import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = await request.json()

  const patch: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') patch.active = body.active
  if (body.max_accesses !== undefined) {
    const n = Number(body.max_accesses)
    if (!Number.isInteger(n) || n < 1 || n > 999) return NextResponse.json({ error: 'Accesos inválidos.' }, { status: 400 })
    patch.max_accesses = n
  }
  if (body.used_accesses !== undefined) {
    const n = Number(body.used_accesses)
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: 'Usados inválidos.' }, { status: 400 })
    patch.used_accesses = n
  }
  if (body.qr_color !== undefined) {
    const color = String(body.qr_color)
    if (!COLOR_RE.test(color)) return NextResponse.json({ error: 'Color inválido.' }, { status: 400 })
    patch.qr_color = color
  }
  patch.updated_at = new Date().toISOString()

  const db = createAdminClient()
  const { data, error } = await db.from('guests').update(patch).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ guest: data })
}

export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const db = createAdminClient()
  const { error } = await db.from('guests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
