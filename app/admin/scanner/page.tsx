'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
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
  attendance_marked?: boolean
}

type CameraOption = {
  id: string
  label: string
}

type ScannerInstance = {
  start: (
    cameraConfig: string | MediaTrackConstraints,
    configuration: {
      fps?: number
      qrbox?: (viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number }
      disableFlip?: boolean
    },
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void,
  ) => Promise<unknown>
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
  const [cameras, setCameras] = useState<CameraOption[]>([])
  const [cameraId, setCameraId] = useState('')
  const [scanHint, setScanHint] = useState('Coloca el QR completo dentro del recuadro.')

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      if (scanner) void scanner.stop().catch(() => undefined)
    }
  }, [])

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

    const mod = await import('html5-qrcode')
    const instance = new mod.Html5Qrcode('qr-reader', {
      verbose: false,
      formatsToSupport: [mod.Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    }) as unknown as ScannerInstance

    scannerRef.current = instance
    return instance
  }

  async function loadCameras() {
    const mod = await import('html5-qrcode')
    const devices = await mod.Html5Qrcode.getCameras()
    const normalized = devices.map(device => ({ id: device.id, label: device.label || 'Cámara' }))
    setCameras(normalized)

    if (!normalized.length) return ''
    if (cameraId && normalized.some(camera => camera.id === cameraId)) return cameraId

    const preferred = pickBestCamera(normalized)
    setCameraId(preferred.id)
    return preferred.id
  }

  async function startCamera(requestedCameraId?: string) {
    setError('')
    setResult(null)
    setScanHint('Buscando código QR… mantén el QR completo dentro del recuadro.')
    processingRef.current = false

    try {
      const scanner = await createScanner()
      const selectedCamera = requestedCameraId || (await loadCameras())

      const cameraConfig: string | MediaTrackConstraints = selectedCamera
        ? { deviceId: { exact: selectedCamera } }
        : { facingMode: { ideal: 'environment' } }

      await scanner.start(
        cameraConfig,
        {
          // Más cuadros por segundo para mejorar la detección en teléfonos y webcams.
          fps: 20,
          // Zona dinámica: utiliza casi todo el video y se adapta a móvil/escritorio.
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.max(190, Math.floor(minEdge * 0.86))
            return { width: size, height: size }
          },
          // Permite leer tanto una imagen normal como una reflejada.
          disableFlip: false,
        },
        decodedText => {
          if (processingRef.current) return
          processingRef.current = true
          setScanHint('QR detectado. Validando acceso…')
          void handleDecodedValue(decodedText)
        },
        () => {
          // Es normal que muchos fotogramas no contengan un QR. Seguimos escaneando.
        },
      )

      setCameraActive(true)
    } catch (e) {
      setCameraActive(false)
      setError(
        e instanceof Error
          ? `No se pudo iniciar correctamente el lector: ${e.message}`
          : 'No se pudo abrir la cámara. Revisa los permisos del navegador.',
      )
    }
  }

  async function switchCamera(nextCameraId: string) {
    setCameraId(nextCameraId)
    if (!cameraActive) return
    await stopCamera()
    processingRef.current = false
    await startCamera(nextCameraId)
  }

  async function stopCamera() {
    const scanner = scannerRef.current
    if (!scanner) return

    try {
      await scanner.stop()
    } catch {
      // Puede haberse detenido desde el navegador.
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
      if (!token) throw new Error('El QR fue leído, pero no pertenece a este sistema de accesos.')

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
      if (json.result?.status === 'granted' && json.result?.attendance_marked) {
        if ('vibrate' in navigator) navigator.vibrate([120, 50, 120])
      }
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
      processingRef.current = false
      setError(
        e instanceof Error
          ? `No se encontró un QR legible en la imagen: ${e.message}`
          : 'No se pudo leer el QR de la imagen.',
      )
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
    await startCamera(cameraId || undefined)
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
            <p>Esta pantalla es la única que registra asistencia y descuenta accesos.</p>
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

            <div className="scannerDetectionHint">{scanHint}</div>

            {cameras.length > 1 && (
              <div className="scannerCameraSelector">
                <label htmlFor="camera-select">Cámara</label>
                <select
                  id="camera-select"
                  className="input"
                  value={cameraId}
                  onChange={e => void switchCamera(e.target.value)}
                  disabled={processing}
                >
                  {cameras.map((camera, index) => (
                    <option key={camera.id} value={camera.id}>
                      {friendlyCameraName(camera.label, index)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="scannerControls">
              {!cameraActive ? (
                <button className="btn btnPrimary scannerMainButton" onClick={() => void startCamera()} disabled={processing}>
                  Activar cámara
                </button>
              ) : (
                <button className="btn btnSoft scannerMainButton" onClick={() => void stopCamera()}>
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

            <div className="scannerTips">
              <strong>Para que lo detecte rápido:</strong>
              <span>usa la cámara trasera, evita reflejos y acerca el QR hasta que ocupe gran parte del recuadro.</span>
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

                {granted && (
                  <>
                    <div className="scannerAttendanceBadge">✓ ASISTENCIA REGISTRADA</div>
                    <p className="scannerResultMessage">Se descontó exactamente 1 acceso.</p>
                  </>
                )}
                {denied && <p className="scannerResultMessage">No se descontó ningún acceso adicional.</p>}

                <button className="btn btnPrimary scannerNextButton" onClick={scanNext}>
                  Escanear siguiente
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="scannerSafetyNote">
          <strong>Importante:</strong> abrir el enlace del QR desde un celular no descuenta accesos.
          El descuento ocurre únicamente cuando un administrador lo lee desde esta pantalla.
        </div>
      </div>
    </main>
  )
}

function pickBestCamera(cameras: CameraOption[]) {
  const score = (camera: CameraOption) => {
    const label = camera.label.toLowerCase()
    let value = 0
    if (/back|rear|environment|trasera|posterior/.test(label)) value += 20
    if (/main|principal|wide(?!.*ultra)|1x/.test(label)) value += 8
    if (/front|user|frontal|facetime/.test(label)) value -= 20
    if (/ultra|0\.5|tele|telephoto|macro/.test(label)) value -= 8
    return value
  }

  return [...cameras].sort((a, b) => score(b) - score(a))[0]
}

function friendlyCameraName(label: string, index: number) {
  const trimmed = label.trim()
  if (!trimmed || trimmed.toLowerCase() === 'camera') return `Cámara ${index + 1}`
  return trimmed
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
