import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase-admin'

const TOKEN_RE = /^[a-f0-9]{48}$/i

type GuestRow = {
  id: string
  name: string
  max_accesses: number
  used_accesses: number
  qr_color: string
  active: boolean
}

type RedeemResult = {
  status: 'granted' | 'denied_exhausted' | 'denied_inactive' | 'denied_invalid'
  guest_id: string | null
  name: string | null
  max_accesses: number | null
  used_accesses: number | null
  remaining_accesses: number | null
  qr_color: string | null
  active: boolean | null
  attendance_marked: boolean
}

async function writeLog(
  db: ReturnType<typeof createAdminClient>,
  values: {
    guest_id: string | null
    scanned_token: string
    status: RedeemResult['status']
    ip: string | null
    user_agent: string | null
  },
) {
  // El log es útil, pero nunca debe impedir registrar una entrada válida.
  await db.from('access_logs').insert(values)
}

function resultFromGuest(
  guest: GuestRow,
  status: RedeemResult['status'],
  attendanceMarked = false,
): RedeemResult {
  return {
    status,
    guest_id: guest.id,
    name: guest.name,
    max_accesses: guest.max_accesses,
    used_accesses: guest.used_accesses,
    remaining_accesses: Math.max(guest.max_accesses - guest.used_accesses, 0),
    qr_color: guest.qr_color,
    active: guest.active,
    attendance_marked: attendanceMarked,
  }
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

  // Ya no dependemos de la función RPC para marcar asistencia. Hacemos una
  // actualización atómica directamente sobre guests para que el lector funcione
  // incluso si la función SQL de Supabase quedó en una versión anterior.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: currentData, error: readError } = await db
      .from('guests')
      .select('id,name,max_accesses,used_accesses,qr_color,active')
      .eq('token', token)
      .maybeSingle()

    if (readError) {
      return NextResponse.json({ error: `No se pudo consultar el acceso: ${readError.message}` }, { status: 500 })
    }

    const guest = currentData as GuestRow | null

    if (!guest) {
      await writeLog(db, {
        guest_id: null,
        scanned_token: token,
        status: 'denied_invalid',
        ip,
        user_agent: userAgent,
      })

      const result: RedeemResult = {
        status: 'denied_invalid',
        guest_id: null,
        name: null,
        max_accesses: null,
        used_accesses: null,
        remaining_accesses: null,
        qr_color: null,
        active: null,
        attendance_marked: false,
      }
      return NextResponse.json({ result })
    }

    if (!guest.active) {
      await writeLog(db, {
        guest_id: guest.id,
        scanned_token: token,
        status: 'denied_inactive',
        ip,
        user_agent: userAgent,
      })
      return NextResponse.json({ result: resultFromGuest(guest, 'denied_inactive') })
    }

    if (guest.used_accesses >= guest.max_accesses) {
      await writeLog(db, {
        guest_id: guest.id,
        scanned_token: token,
        status: 'denied_exhausted',
        ip,
        user_agent: userAgent,
      })
      return NextResponse.json({ result: resultFromGuest(guest, 'denied_exhausted') })
    }

    const nextUsed = guest.used_accesses + 1

    // Compare-and-set: solo actualiza si nadie modificó used_accesses desde que
    // lo leímos. Esto evita descontar dos veces por una lectura concurrente.
    const { data: updatedData, error: updateError } = await db
      .from('guests')
      .update({
        used_accesses: nextUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', guest.id)
      .eq('used_accesses', guest.used_accesses)
      .select('id,name,max_accesses,used_accesses,qr_color,active')
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ error: `No se pudo registrar la asistencia: ${updateError.message}` }, { status: 500 })
    }

    if (!updatedData) {
      // Otro lector ganó la actualización. Releemos y volvemos a intentar.
      continue
    }

    const updated = updatedData as GuestRow

    await writeLog(db, {
      guest_id: updated.id,
      scanned_token: token,
      status: 'granted',
      ip,
      user_agent: userAgent,
    })

    return NextResponse.json({
      result: resultFromGuest(updated, 'granted', true),
    })
  }

  return NextResponse.json(
    { error: 'Hubo varias lecturas simultáneas. Intenta escanear nuevamente.' },
    { status: 409 },
  )
}
