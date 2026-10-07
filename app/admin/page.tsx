'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { EVENT_CONFIG } from '@/lib/event-config'
import { createAccessCardDataUrl } from '@/lib/access-card-client'
import type { Guest } from '@/lib/types'

export default function AdminPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [maxAccesses, setMaxAccesses] = useState(1)
  const [color, setColor] = useState('#74347E')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data } = await supabaseBrowser.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('SESSION')

    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
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
    } finally {
      setLoading(false)
    }
  }, [authFetch, router])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '')

    Promise.all(
      guests.map(async guest => {
        const src = await QRCode.toDataURL(`${origin}/q/${guest.token}`, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: guest.qr_color || '#74347E',
            light: '#FFFFFF',
          },
        })
        return [guest.id, src] as const
      }),
    ).then(entries => setQrImages(Object.fromEntries(entries)))
  }, [guests])

  const stats = useMemo(() => ({
    total: guests.length,
    active: guests.filter(guest => guest.active).length,
    remaining: guests.reduce(
      (sum, guest) => sum + Math.max(guest.max_accesses - guest.used_accesses, 0),
      0,
    ),
  }), [guests])

  async function createGuest(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await authFetch('/api/admin/guests', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          max_accesses: maxAccesses,
          qr_color: color,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo crear')

      setName('')
      setEmail('')
      setMaxAccesses(1)
      setMessage('Acceso digital creado correctamente.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function patchGuest(id: string, patch: Record<string, unknown>) {
    setError('')
    setMessage('')

    const res = await authFetch(`/api/admin/guests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'No se pudo actualizar')
    await load()
  }

  async function removeGuest(id: string) {
    if (!confirm('¿Eliminar a esta persona y su acceso digital?')) return

    try {
      const res = await authFetch(`/api/admin/guests/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function makeAccessCard(guest: Guest) {
    const qrDataUrl = qrImages[guest.id]
    if (!qrDataUrl) {
      throw new Error('El QR todavía se está preparando. Intenta nuevamente en un momento.')
    }

    return createAccessCardDataUrl({
      name: guest.name,
      maxAccesses: guest.max_accesses,
      qrDataUrl,
    })
  }

  async function downloadAccessCard(guest: Guest) {
    setError('')
    setMessage('')
    setBusyId(guest.id)

    try {
      const dataUrl = await makeAccessCard(guest)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `acceso-${slug(guest.name)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setMessage(`Acceso digital de ${guest.name} descargado.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar')
    } finally {
      setBusyId(null)
    }
  }

  async function copyLink(guest: Guest) {
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '')
    await navigator.clipboard.writeText(`${origin}/q/${guest.token}`)
    setMessage(`Enlace de ${guest.name} copiado.`)
  }

  async function sendEmail(guest: Guest) {
    setError('')
    setMessage('')
    setBusyId(guest.id)

    try {
      const cardDataUrl = await makeAccessCard(guest)
      const res = await authFetch(`/api/admin/guests/${guest.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ cardDataUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessage(`Acceso digital enviado a ${guest.email}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setBusyId(null)
    }
  }

  async function logout() {
    await supabaseBrowser.auth.signOut()
    router.replace('/admin/login')
  }

  return (
    <main className="shell adminShell">
      <div className="topbar">
        <div>
          <div className="brand"><span className="brandDot" /> QR Accesos</div>
          <div className="eventBrand">{EVENT_CONFIG.title}</div>
        </div>
        <div className="topbarActions">
          <button className="btn btnPrimary" onClick={() => router.push('/admin/scanner')}>Abrir lector QR</button>
          <button className="btn btnSoft" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <section className="eventHero">
        <div className="eventHeroCopy">
          <span className="eventPill">Accesos digitales</span>
          <h1>{EVENT_CONFIG.title}</h1>
          <p>
            Genera para cada invitado una tarjeta rosa con QR, nombre,
            agradecimiento y número de accesos asignados.
          </p>
        </div>

        <div className="eventHeroStats">
          <div><strong>{stats.total}</strong><span>invitados</span></div>
          <div><strong>{stats.active}</strong><span>activos</span></div>
          <div><strong>{stats.remaining}</strong><span>accesos disponibles</span></div>
        </div>
      </section>

      <div className="adminLayout">
        <section className="card formCard eventFormCard">
          <div className="sectionHeader">
            <span className="sectionNumber">01</span>
            <div>
              <h2>Crear acceso digital</h2>
              <p className="muted">Esta información aparecerá en la tarjeta del invitado.</p>
            </div>
          </div>

          <form onSubmit={createGuest}>
            <div className="field">
              <label>Nombre del invitado *</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Ej. Fabiola"
              />
            </div>

            <div className="field">
              <label>Correo (opcional)</label>
              <input
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="fabiola@correo.com"
              />
            </div>

            <div className="field">
              <label>Accesos asignados *</label>
              <input
                className="input"
                value={maxAccesses}
                onChange={e => setMaxAccesses(Number(e.target.value))}
                type="number"
                min={1}
                max={999}
                required
              />
            </div>

            <div className="field">
              <label>Color del QR</label>
              <div className="colorField">
                <input
                  className="colorInput"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  type="color"
                />
                <input
                  className="input"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  pattern="#[0-9A-Fa-f]{6}"
                />
              </div>
            </div>

            <div className="formPreviewNote">
              <strong>La tarjeta llevará:</strong>
              <span>“{EVENT_CONFIG.title}” + QR + nombre + agradecimiento + accesos asignados.</span>
            </div>

            <button className="btn btnPrimary" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Generando…' : 'Generar acceso digital'}
            </button>
          </form>

          {message && <p className="success" style={{ marginTop: 12 }}>{message}</p>}
          {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
        </section>

        <section className="card listCard eventListCard">
          <div className="sectionHeader listHeader">
            <span className="sectionNumber">02</span>
            <div>
              <h2>Invitados y accesos</h2>
              <p className="muted">Cada tarjeta ya muestra una vista previa del diseño final.</p>
            </div>
            <button className="btn btnSoft" onClick={load}>Actualizar</button>
          </div>

          {loading ? (
            <div className="empty" style={{ marginTop: 16 }}>Cargando…</div>
          ) : guests.length === 0 ? (
            <div className="empty" style={{ marginTop: 16 }}>Aún no hay invitados registrados.</div>
          ) : (
            <div className="guestList eventGuestList">
              {guests.map(guest => {
                const remaining = Math.max(guest.max_accesses - guest.used_accesses, 0)
                const isBusy = busyId === guest.id

                return (
                  <article className="eventGuest" key={guest.id}>
                    <div className="guestInfoPanel">
                      <div className="guestTitle">{guest.name}</div>

                      <div className="row" style={{ marginBottom: 10 }}>
                        <span className={`badge ${guest.active ? 'badgeOk' : 'badgeOff'}`}>
                          {guest.active ? 'Activo' : 'Desactivado'}
                        </span>
                        <span className="badge">Asignados {guest.max_accesses}</span>
                        <span className="badge">Usados {guest.used_accesses}</span>
                        <span className="badge">Disponibles {remaining}</span>
                      </div>

                      {guest.email && (
                        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{guest.email}</div>
                      )}

                      <div className="row guestActions">
                        <button
                          className="btn btnPrimary"
                          onClick={() => downloadAccessCard(guest)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Generando…' : 'Descargar tarjeta'}
                        </button>

                        <button className="btn btnSoft" onClick={() => copyLink(guest)}>
                          Copiar enlace de consulta
                        </button>

                        {guest.email && (
                          <button
                            className="btn btnSoft"
                            onClick={() => sendEmail(guest)}
                            disabled={isBusy}
                          >
                            {isBusy ? 'Procesando…' : 'Enviar por correo'}
                          </button>
                        )}

                        <button
                          className="btn btnSoft"
                          onClick={() => patchGuest(guest.id, { active: !guest.active }).catch(e => setError(e.message))}
                        >
                          {guest.active ? 'Desactivar' : 'Activar'}
                        </button>

                        {guest.used_accesses > 0 && (
                          <button
                            className="btn btnSoft"
                            onClick={() => patchGuest(guest.id, { used_accesses: 0 }).catch(e => setError(e.message))}
                          >
                            Reiniciar usos
                          </button>
                        )}

                        <button className="btn btnDanger" onClick={() => removeGuest(guest.id)}>
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="digitalPass" aria-label={`Vista previa del acceso de ${guest.name}`}>
                      <div className="digitalPassInner">
                        <div className="digitalPassTitle">{EVENT_CONFIG.title}</div>
                        <div className="digitalPassRule" />

                        <div className="digitalPassQrFrame">
                          {qrImages[guest.id]
                            ? <img src={qrImages[guest.id]} alt={`QR de ${guest.name}`} />
                            : <div className="digitalPassLoading">Preparando QR…</div>}
                        </div>

                        <div className="digitalPassName">{guest.name}</div>
                        <div className="digitalPassThanks">{EVENT_CONFIG.thankYouText}</div>
                        <div className="digitalPassAccesses">
                          Tienes <strong>{guest.max_accesses}</strong> acceso{guest.max_accesses === 1 ? '' : 's'} asignado{guest.max_accesses === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'invitado'
}
