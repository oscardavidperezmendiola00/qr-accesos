'use client'

import { EVENT_CONFIG } from '@/lib/event-config'

type AccessCardInput = {
  name: string
  maxAccesses: number
  qrDataUrl: string
}

const WIDTH = 1080
const HEIGHT = 1600

export async function createAccessCardDataUrl({ name, maxAccesses, qrDataUrl }: AccessCardInput) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la imagen del acceso digital.')

  // Fondo rosa exterior, igual al estilo solicitado.
  ctx.fillStyle = EVENT_CONFIG.backgroundColor
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Tarjeta interna.
  ctx.fillStyle = EVENT_CONFIG.panelColor
  ctx.strokeStyle = EVENT_CONFIG.borderColor
  ctx.lineWidth = 5
  roundRect(ctx, 58, 58, 964, 1484, 34)
  ctx.fill()
  ctx.stroke()

  // Título.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = EVENT_CONFIG.textColor
  ctx.font = 'italic 700 62px Georgia, "Times New Roman", serif'
  ctx.fillText(EVENT_CONFIG.title, WIDTH / 2, 142)

  // Ornamento sencillo debajo del título.
  ctx.strokeStyle = EVENT_CONFIG.softTextColor
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(325, 195)
  ctx.bezierCurveTo(420, 230, 660, 230, 755, 195)
  ctx.stroke()

  // Marco del QR.
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = EVENT_CONFIG.borderColor
  ctx.lineWidth = 5
  roundRect(ctx, 145, 245, 790, 790, 26)
  ctx.fill()
  ctx.stroke()

  const image = await loadImage(qrDataUrl)
  // Evita suavizado/borrosidad al dibujar el QR: los módulos deben conservar bordes nítidos.
  const smoothingBeforeQr = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 180, 280, 720, 720)
  ctx.imageSmoothingEnabled = smoothingBeforeQr

  // Nombre.
  ctx.fillStyle = EVENT_CONFIG.textColor
  drawFittedText(
    ctx,
    name,
    WIDTH / 2,
    1138,
    820,
    74,
    38,
    size => `italic 700 ${size}px Georgia, "Times New Roman", serif`,
  )

  // Agradecimiento.
  ctx.fillStyle = EVENT_CONFIG.softTextColor
  ctx.font = '600 39px Arial, Helvetica, sans-serif'
  ctx.fillText(EVENT_CONFIG.thankYouText, WIDTH / 2, 1242)

  // Accesos asignados.
  ctx.fillStyle = '#F2C7E9'
  roundRect(ctx, 170, 1305, 740, 120, 60)
  ctx.fill()

  const accessText = maxAccesses === 1
    ? 'Tienes 1 acceso asignado'
    : `Tienes ${maxAccesses} accesos asignados`

  ctx.fillStyle = EVENT_CONFIG.textColor
  drawFittedText(
    ctx,
    accessText,
    WIDTH / 2,
    1367,
    660,
    43,
    29,
    size => `800 ${size}px Arial, Helvetica, sans-serif`,
  )

  ctx.fillStyle = EVENT_CONFIG.softTextColor
  ctx.font = '500 27px Arial, Helvetica, sans-serif'
  ctx.fillText(EVENT_CONFIG.instructionText, WIDTH / 2, 1493)

  return canvas.toDataURL('image/png')
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar el QR para generar el acceso digital.'))
    image.src = src
  })
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  font: (size: number) => string,
) {
  let size = maxSize
  ctx.font = font(size)

  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2
    ctx.font = font(size)
  }

  let finalText = text.trim()
  if (ctx.measureText(finalText).width > maxWidth) {
    while (finalText.length > 1 && ctx.measureText(`${finalText}…`).width > maxWidth) {
      finalText = finalText.slice(0, -1)
    }
    finalText += '…'
  }

  ctx.fillText(finalText, x, y)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}
