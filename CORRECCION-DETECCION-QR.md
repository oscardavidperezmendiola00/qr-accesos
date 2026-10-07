# Corrección de detección de QR con cámara

Esta versión corrige específicamente el caso en que la cámara abre pero no reconoce el QR.

Cambios:
- El lector escanea únicamente QR_CODE.
- Usa BarcodeDetector nativo cuando el navegador lo soporta.
- Sube a 20 FPS.
- El área de lectura es dinámica y ocupa 86% del lado menor del video.
- Enumera cámaras y prefiere la trasera/principal, evitando ultra gran angular cuando puede identificarla.
- Permite cambiar de cámara desde el lector.
- Los QR nuevos se generan a 720 px, margen 4 y corrección M para reducir densidad.
- Si el color elegido es demasiado claro, se oscurece conservando el tono para mantener contraste.
- El QR se dibuja sin suavizado para conservar módulos nítidos en la tarjeta PNG.

Prueba recomendada:
1. Crea un invitado nuevo.
2. Descarga su tarjeta nueva.
3. Abre /admin/scanner desde un teléfono.
4. Activa cámara y, si hay varias, selecciona la trasera/principal.
5. Coloca el QR ocupando gran parte del recuadro.
6. El primer escaneo debe mostrar ASISTENCIA REGISTRADA y descontar exactamente 1 acceso.
