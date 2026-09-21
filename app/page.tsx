import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="shell">
      <section className="card hero" style={{ marginTop: '8vh' }}>
        <div className="brand"><span className="brandDot" /> QR Accesos</div>
        <h1>Invitaciones y accesos con QR personalizados.</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          Crea personas, asigna el número de accesos, personaliza el color del QR y valida cada entrada en tiempo real.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <Link className="btn btnPrimary" href="/admin/login" style={{ textDecoration: 'none' }}>Entrar como administrador</Link>
        </div>
      </section>
    </main>
  )
}
