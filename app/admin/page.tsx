'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { Guest } from '@/lib/types'

export default function AdminPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [maxAccesses, setMaxAccesses] = useState(1)
  const [color, setColor] = useState('#A855F7')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [qrImages, setQrImages] = useState<Record<string,string>>({})

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data } = await supabaseBrowser.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('SESSION')
    return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/guests')
      if (res.status === 401 || res.status === 403) throw new Error('SESSION')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar')
      setGuests(json.guests || [])
    } catch (e) {
      if (e instanceof Error && e.message === 'SESSION') router.replace('/admin/login')
      else setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  }, [authFetch, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const origin = window.location.origin
    Promise.all(guests.map(async g => {
      const src = await QRCode.toDataURL(`${origin}/q/${g.token}`, { width: 240, margin: 2, color: { dark: g.qr_color, light:'#FFFFFF' }, errorCorrectionLevel: 'H' })
      return [g.id, src] as const
    })).then(entries => setQrImages(Object.fromEntries(entries)))
  }, [guests])

  const stats = useMemo(() => ({
    total: guests.length,
    active: guests.filter(g=>g.active).length,
    remaining: guests.reduce((a,g)=>a+Math.max(g.max_accesses-g.used_accesses,0),0),
  }), [guests])

  async function createGuest(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const res = await authFetch('/api/admin/guests', { method:'POST', body:JSON.stringify({ name, email, max_accesses:maxAccesses, qr_color:color }) })
      const json = await res.json(); if (!res.ok) throw new Error(json.error || 'No se pudo crear')
      setName(''); setEmail(''); setMaxAccesses(1); setMessage('Persona y QR creados correctamente.'); await load()
    } catch(e) { setError(e instanceof Error ? e.message : 'Error') } finally { setSaving(false) }
  }

  async function patchGuest(id:string, patch:Record<string,unknown>) {
    setError(''); setMessage('')
    const res = await authFetch(`/api/admin/guests/${id}`, { method:'PATCH', body:JSON.stringify(patch) })
    const json = await res.json(); if (!res.ok) throw new Error(json.error || 'No se pudo actualizar')
    await load()
  }

  async function removeGuest(id:string) {
    if (!confirm('¿Eliminar esta persona y su QR?')) return
    try { const res=await authFetch(`/api/admin/guests/${id}`,{method:'DELETE'}); const json=await res.json(); if(!res.ok) throw new Error(json.error); await load() }
    catch(e){ setError(e instanceof Error?e.message:'Error') }
  }

  function downloadQr(g:Guest) {
    const src=qrImages[g.id]; if(!src) return
    const a=document.createElement('a'); a.href=src; a.download=`qr-${slug(g.name)}.png`; a.click()
  }

  async function copyLink(g:Guest) {
    await navigator.clipboard.writeText(`${window.location.origin}/q/${g.token}`)
    setMessage(`Enlace de ${g.name} copiado.`)
  }

  async function sendEmail(g:Guest) {
    setError(''); setMessage('')
    try { const res=await authFetch(`/api/admin/guests/${g.id}/send`,{method:'POST',body:'{}'}); const json=await res.json(); if(!res.ok) throw new Error(json.error); setMessage(`QR enviado a ${g.email}.`) }
    catch(e){ setError(e instanceof Error?e.message:'Error al enviar') }
  }

  async function logout(){ await supabaseBrowser.auth.signOut(); router.replace('/admin/login') }

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand"><span className="brandDot" /> QR Accesos</div>
        <button className="btn btnSoft" onClick={logout}>Cerrar sesión</button>
      </div>

      <section className="card hero">
        <h1 style={{fontSize:'clamp(30px,4vw,46px)'}}>Panel de códigos QR</h1>
        <p className="muted">Asigna accesos, personaliza el QR y controla cuántas entradas ha usado cada persona.</p>
        <div className="stats">
          <div className="stat"><span className="muted">Personas</span><strong>{stats.total}</strong></div>
          <div className="stat"><span className="muted">QR activos</span><strong>{stats.active}</strong></div>
          <div className="stat"><span className="muted">Accesos disponibles</span><strong>{stats.remaining}</strong></div>
        </div>
      </section>

      <div className="grid2">
        <section className="card formCard">
          <h2>Nueva persona</h2>
          <p className="muted">El QR se genera con un token único y difícil de adivinar.</p>
          <form onSubmit={createGuest}>
            <div className="field"><label>Nombre *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required placeholder="Ej. Ana López" /></div>
            <div className="field"><label>Correo (opcional)</label><input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="ana@correo.com" /></div>
            <div className="field"><label>Número de accesos *</label><input className="input" value={maxAccesses} onChange={e=>setMaxAccesses(Number(e.target.value))} type="number" min={1} max={999} required /></div>
            <div className="field"><label>Color del QR</label><div className="colorField"><input className="colorInput" value={color} onChange={e=>setColor(e.target.value)} type="color" /><input className="input" value={color} onChange={e=>setColor(e.target.value)} pattern="#[0-9A-Fa-f]{6}" /></div></div>
            <button className="btn btnPrimary" disabled={saving} style={{width:'100%'}}>{saving?'Generando…':'Generar QR'}</button>
          </form>
          {message && <p className="success" style={{marginTop:12}}>{message}</p>}
          {error && <p className="error" style={{marginTop:12}}>{error}</p>}
        </section>

        <section className="card listCard">
          <div className="row" style={{justifyContent:'space-between'}}><div><h2 style={{marginBottom:4}}>Personas y accesos</h2><p className="muted" style={{marginBottom:0}}>Cada lectura válida consume 1 acceso.</p></div><button className="btn btnSoft" onClick={load}>Actualizar</button></div>
          {loading ? <div className="empty" style={{marginTop:16}}>Cargando…</div> : guests.length===0 ? <div className="empty" style={{marginTop:16}}>Aún no hay personas registradas.</div> : <div className="guestList">
            {guests.map(g=>{
              const remaining=Math.max(g.max_accesses-g.used_accesses,0)
              return <article className="guest" key={g.id}>
                <div>
                  <div className="guestTitle">{g.name}</div>
                  <div className="row" style={{marginBottom:9}}>
                    <span className={`badge ${g.active?'badgeOk':'badgeOff'}`}>{g.active?'Activo':'Desactivado'}</span>
                    <span className="badge">Usados {g.used_accesses}/{g.max_accesses}</span>
                    <span className="badge">Quedan {remaining}</span>
                  </div>
                  {g.email && <div className="muted" style={{fontSize:13,marginBottom:10}}>{g.email}</div>}
                  <div className="row">
                    <button className="btn btnSoft" onClick={()=>downloadQr(g)}>Descargar QR</button>
                    <button className="btn btnSoft" onClick={()=>copyLink(g)}>Copiar enlace</button>
                    {g.email && <button className="btn btnSoft" onClick={()=>sendEmail(g)}>Enviar correo</button>}
                    <button className="btn btnSoft" onClick={()=>patchGuest(g.id,{active:!g.active}).catch(e=>setError(e.message))}>{g.active?'Desactivar':'Activar'}</button>
                    {g.used_accesses>0 && <button className="btn btnSoft" onClick={()=>patchGuest(g.id,{used_accesses:0}).catch(e=>setError(e.message))}>Reiniciar usos</button>}
                    <button className="btn btnDanger" onClick={()=>removeGuest(g.id)}>Eliminar</button>
                  </div>
                </div>
                {qrImages[g.id] && <img className="qrThumb" src={qrImages[g.id]} alt={`QR de ${g.name}`} />}
              </article>
            })}
          </div>}
        </section>
      </div>
    </main>
  )
}

function slug(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'invitado'}
