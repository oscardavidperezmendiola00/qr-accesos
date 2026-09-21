import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

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
  const { data, error } = await db.rpc('redeem_qr_access', { p_token: token, p_ip: ip, p_user_agent: userAgent })
  const result = (Array.isArray(data) ? data[0] : data) as Result | undefined

  if (error || !result) {
    return <Scan status="error" title="No se pudo validar" description="Intenta nuevamente o solicita ayuda al administrador." />
  }
  if (result.status === 'granted') {
    return <Scan status="granted" title="Acceso autorizado" name={result.name || ''} remaining={result.remaining_accesses ?? 0} description="El acceso quedó registrado correctamente." />
  }
  if (result.status === 'denied_exhausted') {
    return <Scan status="denied" title="Sin accesos disponibles" name={result.name || ''} remaining={0} description="Este código ya utilizó todos los accesos asignados." />
  }
  if (result.status === 'denied_inactive') {
    return <Scan status="denied" title="Código desactivado" name={result.name || ''} description="El administrador desactivó temporalmente este código." />
  }
  return <Scan status="denied" title="QR no válido" description="El código no existe o ya no está disponible." />
}

function Scan({status,title,name,remaining,description}:{status:'granted'|'denied'|'error',title:string,name?:string,remaining?:number,description:string}){
  const ok=status==='granted'
  return <main className="scanWrap"><section className={`card scanCard ${ok?'scanGranted':'scanDenied'}`}>
    <div className="scanIcon">{ok?'✓':'!'}</div>
    <h1 style={{fontSize:'clamp(32px,8vw,54px)'}}>{title}</h1>
    {name && <h2>{name}</h2>}
    {remaining!==undefined && <><div className="bigNumber">{remaining}</div><p className="muted">acceso{remaining===1?'':'s'} restante{remaining===1?'':'s'}</p></>}
    <p>{description}</p>
    <p className="muted" style={{fontSize:13,marginBottom:0}}>La validación se registra al abrir este QR.</p>
  </section></main>
}
