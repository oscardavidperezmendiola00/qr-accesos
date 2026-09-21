'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/admin')
    })
  }, [router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError('Correo o contraseña incorrectos.')
    router.replace('/admin')
  }

  return (
    <main className="loginWrap">
      <section className="card loginCard">
        <div className="brand" style={{ marginBottom: 18 }}><span className="brandDot" /> QR Accesos</div>
        <h2>Administrador</h2>
        <p className="muted">Inicia sesión para gestionar invitados y códigos QR.</p>
        <form onSubmit={submit}>
          <div className="field"><label>Correo</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field"><label>Contraseña</label><input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
          {error && <p className="error">{error}</p>}
          <button className="btn btnPrimary" style={{ width:'100%' }} disabled={loading}>{loading ? 'Entrando…' : 'Iniciar sesión'}</button>
        </form>
      </section>
    </main>
  )
}
