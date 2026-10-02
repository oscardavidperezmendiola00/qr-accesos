import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVENT_CONFIG } from '@/lib/event-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ token: string }> }

type Result = {
  status: string
  guest_id: string | null
  name: string | null
  max_accesses: number | null
  used_accesses: number | null
  remaining_accesses: number | null
  qr_color: string | null
  active: boolean | null
}

export default async function QrAccessPage({ params }: Props) {
  const { token } = await params
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = h.get('user-agent') || null
  const db = createAdminClient()

  const { data, error } = await db.rpc('redeem_qr_access', {
    p_token: token,
    p_ip: ip,
    p_user_agent: userAgent,
  })

  const result = (Array.isArray(data) ? data[0] : data) as Result | undefined

  if (error || !result) {
    return (
      <AccessResult
        variant="error"
        title="No se pudo validar"
        description="Intenta nuevamente o solicita ayuda al administrador."
      />
    )
  }

  if (result.status === 'granted') {
    return (
      <AccessResult
        variant="ok"
        title="Acceso autorizado"
        name={result.name || ''}
        assigned={result.max_accesses ?? 0}
        used={result.used_accesses ?? 0}
        remaining={result.remaining_accesses ?? 0}
        description="El acceso quedó registrado correctamente."
      />
    )
  }

  if (result.status === 'denied_exhausted') {
    return (
      <AccessResult
        variant="denied"
        title="Sin accesos disponibles"
        name={result.name || ''}
        assigned={result.max_accesses ?? 0}
        used={result.used_accesses ?? 0}
        remaining={0}
        description="Este código ya utilizó todos los accesos asignados."
      />
    )
  }

  if (result.status === 'denied_inactive') {
    return (
      <AccessResult
        variant="denied"
        title="Código desactivado"
        name={result.name || ''}
        assigned={result.max_accesses ?? 0}
        used={result.used_accesses ?? 0}
        remaining={result.remaining_accesses ?? 0}
        description="El administrador desactivó temporalmente este código."
      />
    )
  }

  return (
    <AccessResult
      variant="denied"
      title="QR no válido"
      description="El código no existe o ya no está disponible."
    />
  )
}

function AccessResult({
  variant,
  title,
  name,
  assigned,
  used,
  remaining,
  description,
}: {
  variant: 'ok' | 'denied' | 'error'
  title: string
  name?: string
  assigned?: number
  used?: number
  remaining?: number
  description: string
}) {
  const ok = variant === 'ok'
  const hasCounters = assigned !== undefined && used !== undefined && remaining !== undefined

  return (
    <main className="scanWrap eventScanWrap">
      <section className={`eventScanCard ${ok ? 'eventScanOk' : 'eventScanDenied'}`}>
        <div className="eventScanTop">{EVENT_CONFIG.title}</div>

        <div className={`eventScanIcon ${ok ? 'eventScanIconOk' : 'eventScanIconDenied'}`}>
          {ok ? '✓' : '!'}
        </div>

        <div className="eventScanStatus">{title}</div>

        {name && <h1 className="eventScanName">{name}</h1>}

        {hasCounters && (
          <div className="eventScanCounters">
            <div className="eventScanCounter">
              <span>Accesos asignados</span>
              <strong>{assigned}</strong>
            </div>
            <div className="eventScanCounter">
              <span>Accesos utilizados</span>
              <strong>{used}</strong>
            </div>
            <div className="eventScanCounter eventScanCounterMain">
              <span>Accesos disponibles</span>
              <strong>{remaining}</strong>
            </div>
          </div>
        )}

        <p className="eventScanDescription">{description}</p>

        <div className="eventScanDivider" />
        <p className="eventScanThanks">{EVENT_CONFIG.thankYouText}</p>
        <p className="eventScanNote">La validación se registra al abrir este QR.</p>
      </section>
    </main>
  )
}
