import { createAdminClient } from '@/lib/supabase-admin'
import { EVENT_CONFIG } from '@/lib/event-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ token: string }> }

type Guest = {
  id: string
  name: string
  max_accesses: number
  used_accesses: number
  active: boolean
}

export default async function QrPreviewPage({ params }: Props) {
  const { token } = await params
  const db = createAdminClient()

  const { data, error } = await db
    .from('guests')
    .select('id,name,max_accesses,used_accesses,active')
    .eq('token', token)
    .single()

  const guest = data as Guest | null

  if (error || !guest) {
    return (
      <PreviewResult
        title="QR no válido"
        description="El código no existe o ya no está disponible."
      />
    )
  }

  const remaining = Math.max(guest.max_accesses - guest.used_accesses, 0)

  return (
    <PreviewResult
      title={guest.active ? 'Acceso digital' : 'Código desactivado'}
      name={guest.name}
      assigned={guest.max_accesses}
      used={guest.used_accesses}
      remaining={remaining}
      active={guest.active}
      description={
        guest.active
          ? 'Consultar este enlace no descuenta accesos. La entrada se registra únicamente desde el lector QR del administrador.'
          : 'El administrador desactivó temporalmente este código.'
      }
    />
  )
}

function PreviewResult({
  title,
  name,
  assigned,
  used,
  remaining,
  active,
  description,
}: {
  title: string
  name?: string
  assigned?: number
  used?: number
  remaining?: number
  active?: boolean
  description: string
}) {
  const hasCounters = assigned !== undefined && used !== undefined && remaining !== undefined

  return (
    <main className="scanWrap eventScanWrap">
      <section className={`eventScanCard ${active === false ? 'eventScanDenied' : ''}`}>
        <div className="eventScanTop">{EVENT_CONFIG.title}</div>
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
        <p className="eventScanNote">Esta vista es solo de consulta. Para registrar una entrada usa el lector QR del administrador.</p>
      </section>
    </main>
  )
}
