import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = { params: Promise<{ token: string }> }

/**
 * Compatibilidad con tarjetas antiguas.
 * Esta ruta YA NO descuenta accesos.
 * El descuento se realiza exclusivamente desde /admin/scanner.
 */
export default async function LegacyScanPage({ params }: Props) {
  const { token } = await params
  redirect(`/q/${encodeURIComponent(token)}`)
}
