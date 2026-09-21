import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QR Accesos',
  description: 'Administración de accesos mediante códigos QR',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
