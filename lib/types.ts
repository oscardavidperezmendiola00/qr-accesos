export type Guest = {
  id: string
  name: string
  email: string | null
  max_accesses: number
  used_accesses: number
  qr_color: string
  token: string
  active: boolean
  created_at: string
}
