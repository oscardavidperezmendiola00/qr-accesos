import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.getUser(token)
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const userEmail = (data.user?.email || '').trim().toLowerCase()

  if (error || !data.user || !adminEmail || userEmail !== adminEmail) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }

  return { ok: true as const, user: data.user }
}
