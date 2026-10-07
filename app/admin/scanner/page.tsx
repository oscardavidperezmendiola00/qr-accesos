'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { EVENT_CONFIG } from '@/lib/event-config'

type RedeemResult = {
  status: string
  guest_id: string | null
  name: string | null
  max_accesses: number | null
  used_accesses: number | null
  remaining_accesses: number | null
  qr_color: string | null
  active: boolean | null
}

type ScannerInstance = {
  start: (
    cameraConfig: { facingMode: string },
    configuration: { fps: number; qrbox: { width: number; height: number }; aspectRatio: number },
    onSuccess: (decodedText: string) => void,
    onError?: () => void,
  ) => Promise<void>
  stop: () => Promise<void>
  clear: () => void
  scanFile: (file: File, showImage?: boolean) => Promise<string>
}

export default function ScannerPage() {
  const router = useRouter()
  const scannerRef = useRef<ScannerInstance | null>(null)
  const processingRef = useRef(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RedeemResult | null>(null)
  const [manualValue, setManualValue] = useState('')

  async function getAuthorizedFetch(url: string, init?: RequestInit) {
    const { data } = await supabaseBrowser.auth.getSession()
    const token = data.session?.access_token

    if (!token) {
      router.replace('/admin/login')
      throw new Error('SESSION')
    }

    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  }

  async function createScanner() {
    if (scannerRef.current) return scannerRef.current
    const { Html5Qrcode } = await import('html5-qrcode')
    const instance = new Html5Qrcode('qr-reader', { verbose: false }) as unknown as ScannerInstance
    scannerRef.current = instance
    return instance
  }

  async function startCamera() {
    setError('')
    setResult(null)
    processingRef.current = false

    try {
      const scanner = await createScanner()
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
        },
        decodedText => {
          if (processingRef.current) return
          processingRef.current = true
          void handleDecodedValue(decodedText)
        },
      )
      setCameraActive(true)
    } catch (e) {
      setCameraActive(false)
      setError(
        e instanceof Error
          ? `No se pudo abrir la cámara: ${e.message}`
          : 'No se pudo abrir la cámara. Revisa los permisos del navegador.',
      )
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current
    if (!scanner || !cameraActive) return

    try {
      await scanner.stop()
    } catch {
      // El lector puede haber sido detenido por el navegador; no bloqueamos el flujo.
    } finally {
      setCameraActive(false)
    }
  }

  async function handleDecodedValue(value: string) {
    setError('')
    setProcessing(true)

    try {
      await stopCamera()
      const token = extractToken(value)
      if (!token) throw new Error('Este QR no pertenece al sistema de accesos.')

      const response = await getAuthorizedFetch('/api/admin/redeem', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })

      if (response.status === 401 || response.status === 403) {
        router.replace('/admin/login')
        throw new Error('SESSION')
      }

      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'No se pudo registrar el acceso.')

      setResult(json.result)
    } catch (e) {
      if (!(e instanceof Error && e.message === 'SESSION')) {
        setError(e instanceof Error ? e.message : 'No se pudo leer el QR.')
      }
    } finally {
      setProcessing(false)
    }
  }

  async function scanImage(file: File) {
    setError('')
    setResult(null)
    processingRef.current = true
    setProcessing(true)

    try {
      await stopCamera()
      const scanner = await createScanner()
      const decodedText = await scanner.scanFile(file, true)
      setProcessing(false)
      await handleDecodedValue(decodedText)
    } catch (e) {
      setProcessing(false)
      setError(e instanceof Error ? e.message : 'No se pudo leer el QR de la imagen.')
    }
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault()
    if (!manualValue.trim()) return
    processingRef.current = true
    await handleDecodedValue(manualValue.trim())
  }

  async function scanNext() {
    setResult(null)
    setError('')
    setManualValue('')
    processingRef.current = false
    await startCamera()
  }

  const granted = result?.status === 'granted'
  const denied = result && result.status !== 'granted'

  return (
    <main className="scannerPage">
      <div className="scannerShell">
        <div className="scannerTopbar">
          <div>
            <div className="scannerEyebrow">Control de acceso</div>
            <h1>Lector QR · {EVENT_CONFIG.title}</h1>
            <p>Solo esta pantalla registra entradas y descuenta accesos.</p>
          </div>
          <button className="btn btnSoft" onClick={() => router.push('/admin')}>Volver al panel</button>
        </div>

        <div className="scannerGrid">
          <section className="scannerCameraCard">
            <div className="scannerCardHeader">
              <div>
                <span className="scannerStep">01</span>
                <strong>Escanear acceso</strong>
              </div>
              <span className={`scannerLive ${cameraActive ? 'isLive' : ''}`}>
                {cameraActive ? 'Cámara activa' : 'Cámara detenida'}
              </span>
            </div>

            <div className="scannerViewportWrap">
              <div id="qr-reader" className="scannerViewport" />
              {!cameraActive && !processing && !result && (
                <div className="scannerPlaceholder">
                  <div className="scannerPlaceholderIcon">⌗</div>
                  <strong>Listo para leer</strong>
                  <span>Activa la cámara y apunta al QR del invitado.</span>
                </div>
              )}
              {processing && (
                <div className="scannerProcessing">
                  <div className="scannerSpinner" />
                  <strong>Validando acceso…</strong>
                  <span>Espera un momento.</span>
                </div>
              )}
            </div>

            <div className="scannerControls">
              {!cameraActive ? (
                <button className="btn btnPrimary scannerMainButton" onClick={startCamera} disabled={processing}>
                  Activar cámara
                </button>
              ) : (
                <button className="btn btnSoft scannerMainButton" onClick={stopCamera}>
                  Detener cámara
                </button>
              )}

              <label className="btn btnSoft scannerUploadButton">
                Leer imagen
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void scanImage(file)
                  }}
                />
              </label>
            </div>

            <form className="scannerManual" onSubmit={submitManual}>
              <label>¿La cámara no funciona?</label>
              <div>
                <input
                  className="input"
                  value={manualValue}
                  onChange={e => setManualValue(e.target.value)}
                  placeholder="Pega el enlace o token del QR"
                />
                <button className="btn btnSoft" disabled={processing || !manualValue.trim()}>
                  Validar
                </button>
              </div>
            </form>
          </section>

          <section className="scannerResultCard">
            <div className="scannerCardHeader">
              <div>
                <span className="scannerStep">02</span>
                <strong>Resultado</strong>
              </div>
            </div>

            {!result && !error && (
              <div className="scannerEmptyResult">
                <div>✓</div>
                <strong>Aquí aparecerá el resultado</strong>
                <span>Al leer un QR se mostrará el invitado y sus accesos restantes.</span>
              </div>
            )}

            {error && (
              <div className="scannerResult scannerResultError">
                <div className="scannerResultIcon">!</div>
                <div className="scannerResultStatus">No se pudo registrar</div>
                <p>{error}</p>
                <button className="btn btnPrimary" onClick={scanNext}>Intentar de nuevo</button>
              </div>
            )}

            {result && (
              <div className={`scannerResult ${granted ? 'scannerResultGranted' : 'scannerResultDenied'}`}>
                <div className="scannerResultIcon">{granted ? '✓' : '!'}</div>
                <div className="scannerResultStatus">
                  {granted
                    ? 'Acceso autorizado'
                    : result.status === 'denied_exhausted'
                      ? 'Sin accesos disponibles'
                      : result.status === 'denied_inactive'
                        ? 'Código desactivado'
                        : 'Acceso rechazado'}
                </div>

                {result.name && <h2>{result.name}</h2>}

                <div className="scannerCounters">
                  <div><span>Asignados</span><strong>{result.max_accesses ?? 0}</strong></div>
                  <div><span>Utilizados</span><strong>{result.used_accesses ?? 0}</strong></div>
                  <div className="scannerCounterMain"><span>Disponibles</span><strong>{result.remaining_accesses ?? 0}</strong></div>
                </div>

                {granted && <p className="scannerResultMessage">Entrada registrada correctamente.</p>}
                {denied && <p className="scannerResultMessage">No se descontó ningún acceso adicional.</p>}

                <button className="btn btnPrimary scannerNextButton" onClick={scanNext}>
                  Escanear siguiente
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="scannerSafetyNote">
          <strong>Importante:</strong> abrir el enlace del QR desde un celular ya no descuenta accesos.
          El descuento ocurre únicamente cuando un administrador lo lee desde esta pantalla.
        </div>
      </div>
    </main>
  )
}

function extractToken(value: string) {
  const trimmed = value.trim()
  const plainToken = trimmed.match(/^[a-f0-9]{48}$/i)?.[0]
  if (plainToken) return plainToken.toLowerCase()

  try {
    const decoded = decodeURIComponent(trimmed)
    const match = decoded.match(/\/(?:q|scan)\/([a-f0-9]{48})(?:[/?#]|$)/i)
    return match?.[1]?.toLowerCase() || null
  } catch {
    const match = trimmed.match(/\/(?:q|scan)\/([a-f0-9]{48})(?:[/?#]|$)/i)
    return match?.[1]?.toLowerCase() || null
  }
}
