# Plan de Implementación: VideoAssembler MP4 para Silvania Marketing Studio (P0)

## Contexto y Principios
- **Regla Absoluta de Preservación**: No borrar ni eliminar ninguna herramienta, skill, carpeta canónica `silvania/`, Eva clínica, CoreAgent OAuth/scopes de producción, ni los flujos HITL existentes.
- **Cero publicación sin aprobación**: El vídeo MP4 se entrega al admin para revisión y nunca se publica en canales ni redes sin clic en "Aprobar y Publicar".
- **Low-Cost y Máxima Eficiencia**: Sin APIs externas de vídeo de pago. Renderizado local ultrarrápido con FFmpeg (`ffmpeg-static` + fallback a PATH del sistema).

---

## 1. Módulo Modular `VideoAssembler` (`src/marketing/services/videoAssembler.ts`)
- **Detección de Binario FFmpeg**:
  1. `process.env.FFMPEG_PATH` (si se especifica en variables de entorno).
  2. `ffmpeg-static` (paquete npm multiplataforma verificado en Windows y Linux).
  3. `ffmpeg` global en el `PATH` del sistema.
  - Error explícito si falta el binario, sin colgar el bot.
- **Cálculo de Duración y Sincronización**:
  - Obtiene la duración del audio completo de voz mediante FFmpeg.
  - Calcula la duración proporcional de cada escena según la longitud del texto de narración (o reparto equitativo).
- **Ensamblado FFmpeg**:
  - Genera archivo de lista `concat` con cada imagen y su duración.
  - Renderizado con `-c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest`.
  - Escala y padding automático a 1280x720 (16:9) o 720x1280 (9:16 para TikTok/Shorts).
  - Timeout de seguridad (120s) y limpieza de archivos temporales.

## 2. Generación Visual por Escena (`src/marketing/manager.ts`)
- En el flujo de vídeo (`youtube_long`, `youtube_short`, `tiktok`):
  - Iterar por cada escena del guion generado (límite de seguridad: hasta 6–8 escenas en P0).
  - Generar imagen fotorrealista para cada escena con `imageGenerator` (FLUX).
  - Tolerancia a fallos: reintento de 1 vez; si falla, reutiliza la imagen previa o portada sin abortar el vídeo si >= 50% de imágenes fueron exitosas.
- Ensamblado del vídeo llamando a `videoAssembler.assembleVideo(...)`.
- Registro de `videoPath`, `sceneImageCount` o `videoError` en el borrador.

## 3. Entrega HITL en Telegram (`src/marketing/telegramReview.ts`)
- Si `draft.videoPath` está disponible:
  - Envía el archivo `.mp4` a Telegram con `bot.api.sendVideo` (soporta hasta 50MB, vídeos de 1-3 min pesan ~10-25MB).
  - Si supera los límites o falla el envío directo, fallback a enlace o archivo persistente.
- Si `draft.videoError` ocurrió, muestra aviso explícito: `⚠️ Vídeo MP4 no generado: {motivo}`.
- Mantiene la locución de voz completa, el guion particionado multipart y los botones interactivos HITL (Aprobar, Regenerar, Descartar, Pack).

## 4. Tipos, Persistencia y UX
- Extender `MarketingDraft` en `src/marketing/types.ts`:
  - `videoPath?: string;`
  - `videoUrl?: string;`
  - `sceneImageCount?: number;`
  - `videoError?: string;`
- Persistencia automática en SQLite (`marketingDb`) en formato JSON.
- En `/marketing status` de `src/index.ts`, reportar el estado del vídeo MP4.
- Archivo `nixpacks.toml` en raíz para redundancia en Railway con `nixPkgs = ["ffmpeg"]`.

---

## Verificación
1. `npx tsc --noEmit` y `npm run build` -> 0 errores.
2. Test scratch (`scratch/test_video_assembler.ts`) con audio y múltiples imágenes locales generando un MP4 válido.
3. Test de tolerancia a fallos cuando una imagen falla o cuando FFmpeg no está disponible.
4. Resumen final: Añadido / Modificado / Preservado.
