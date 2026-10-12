# Resumen de Verificación P0 Post-Deploy (Octubre 2026)

## 1. Skill Loader Ruidoso (Resuelto)
- **Implementación**: En [skillLoader.ts](file:///c:/Users/eduar/silvaniacoreagent/src/services/skillLoader.ts), se incorporó caché en memoria con TTL de 20 minutos por `userId`.
- **Comprobación de Metadatos**: Se valida `fileId` y `modifiedTime` de los archivos en Drive respecto a la copia local. Si no han cambiado, se omiten las descargas (`omittedCount++`).
- **Log Unificado**: Ahora genera una única línea resumen por sincronización:
  `✅ [Skill Loader] Sincronización de habilidades completada para usuario {userId}: N skills activas (K descargas, M omitidas por caché).`
- **Invalidación**: En [skills.ts](file:///c:/Users/eduar/silvaniacoreagent/src/tools/skills.ts), tras subir o crear una nueva skill a Drive, se llama a `skillLoader.invalidateCache(userId)`.

## 2. Enlaces Reales en Google Drive (`drive_mkdir` y `drive_create_text_file`)
- **Implementación**: En [drive.ts](file:///c:/Users/eduar/silvaniacoreagent/src/tools/drive.ts) y [index.ts](file:///c:/Users/eduar/silvaniacoreagent/src/tools/index.ts):
  - `driveMkdir` expone explícitamente el `id`, el nombre y la URL completa (`https://drive.google.com/drive/folders/{id}`), tanto cuando crea una nueva carpeta como cuando detecta que ya existe o redirige a la estructura canónica.
  - `drive_create_text_file` y `drive_upload` exponen el ID del archivo, su URL directa (`https://drive.google.com/file/d/{id}/view`) y la carpeta contenedora con su ID y URL.
  - Sanitizador: [agent.ts](file:///c:/Users/eduar/silvaniacoreagent/src/agent/agent.ts) (`sanitizeAlucinatedLinks`) ahora valida y preserva los enlaces devueltos legítimamente en los mensajes de tipo `tool`.
  - Rutas canónicas: Peticiones de carpetas como `transcripciones` se resuelven bajo `silvania/transcripciones` sin duplicación ni ambigüedad de ID.

## 3. Transcripción de YouTube (Resumen en Chat + Guardado en Drive)
- **Implementación**: En [youtube.ts](file:///c:/Users/eduar/silvaniacoreagent/src/tools/youtube.ts) y [llm.ts](file:///c:/Users/eduar/silvaniacoreagent/src/services/llm.ts):
  - Por defecto o cuando la longitud supera los 1500 caracteres, el texto completo se guarda en `silvania/transcripciones/transcripcion_{videoId}.md`.
  - En el chat de Telegram solo se devuelve un resumen acotado (~1000 caracteres) acompañado del enlace verificado de Google Drive al archivo completo y a la carpeta contenedora.

## 4. `/marketing video`: Texto Completo y Locución No Truncada
- **Implementación**: En [manager.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/manager.ts) y [telegramReview.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/telegramReview.ts):
  - Generación de locución TTS: Se concatena el gancho (`hook`) junto a las locuciones de todas las escenas estructuradas, evitando reproducir únicamente el slug del tema (`"coreagent"`).
  - Título en nota de voz: El caption de la nota de voz utiliza el título real del vídeo/borrador en lugar del argumento suelto.
  - Guion completo multipart: Telegram recibe el desglose escena por escena particionado si supera los límites de longitud, evitando cortes lógicos.

## 5. UX Menor de Autorización y Gmail
- **Implementación**: En [agent.ts](file:///c:/Users/eduar/silvaniacoreagent/src/agent/agent.ts):
  - Si el usuario dice "ya lo vinculé", "inténtalo ahora" o solicita una acción ejecutiva tras autorizar, el agente no vuelve a llamar a `generate_authorization_link` y ejecuta la herramienta requerida directamente.
  - Ante peticiones explícitas de enviar correo ("envíalo tú"), el agente invoca obligatoriamente `gmail_send` y no evade respondiendo solo con enlaces a `https://mail.google.com/`.

## 6. Cron Rotativo de Marketing y Fallback de Imagen
- **Implementación**: En [telegramReview.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/telegramReview.ts) y [manager.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/manager.ts):
  - Si la generación de imagen con FLUX falla, se captura el error y la tarjeta de revisión a Telegram incluye de forma explícita el aviso:
    `⚠️ *Imagen no generada:* {motivo}`.
  - Se preservan intactos los botones Human-in-the-Loop y la regla de no publicar sin confirmación humana.
  - Solo accesible y despachado a `MARKETING_ADMIN_IDS`.

## 7. VideoAssembler P0 (Hotfix: Locución Completa, Imágenes Distintas por Escena y Still Dinámico)
- **Causa Raíz Resuelta**:
  - En versiones iniciales, si la generación de imágenes de escenas secundarias fallaba o se llamaba al mismo endpoint, se heredaba la misma imagen para todas las escenas, generando un vídeo de imagen estática fija. Además, sin el filtro `fps=24` continuo, los decodificadores móviles no actualizaban el fotograma.
  - La duración del vídeo se estimaba en el texto según el guión teórico (~8 min), mientras que el audio sintetizado real tenía su propia duración (~1:25 min).
- **Mejoras Implementadas**:
  - **Locución Completa**: [manager.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/manager.ts) sintetiza el `hook` + TODAS las escenas seleccionadas para el MP4 (`scenesToRender`, $N \le 8$). Se mide y loggea con FFmpeg la duración real en segundos (`getAudioDuration`) y los caracteres narrados.
  - **Imágenes Distintas y Fallback a Turbo**: [imageGenerator.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/services/imageGenerator.ts) reintenta automáticamente con el modelo ultrarrápido `turbo` si el primer intento (`flux`) falla.
  - **Validación Estricta de Escenas Múltiples**: Si hay más de una escena y solo se obtiene una imagen distinta (`distinctImages.size <= 1`), se cancela el ensamblado con un error explícito (`draft.videoError`), evitando vídeos estáticos fraudulentos.
  - **Framerate Continuo a 24fps**: [videoAssembler.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/services/videoAssembler.ts) inyecta `fps=24` y `-r 24` en el pipeline de FFmpeg, garantizando que el fotograma cambie dinámicamente en Telegram, navegadores y reproductores móviles.
  - **Mensajes Honestos al Admin**: [telegramReview.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/telegramReview.ts) e [index.ts](file:///c:/Users/eduar/silvaniacoreagent/src/index.ts) reportan la duración real del audio (ej. `MP4 1:25 (audio real) · 8 escenas en guion · 3 imágenes distintas usadas`), evitando discrepancias confusas con el guión teórico.

## 9. P0 Image Resilience + Scene Capping (Hotfix Pollinations 402 & Short Topics)
- **Problema de Producción**:
  - Pollinations devolvía HTTP 402 ("Payment Required") en casi todas las escenas tras generar la portada, cancelando el ensamblado de vídeo por falta de imágenes (`sceneImageCount=0`).
  - Al pedir temas de "3 escenas" o "corto", `scriptWriter` generaba ~10 escenas teóricas con duraciones teóricas infladas (~8 min) a pesar de que el audio real medía ~80-90s.
- **Solución Implementada**:
  - **Cadena de Resiliencia en [imageGenerator.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/services/imageGenerator.ts)**:
    - Provider chain: `flux` -> `turbo` -> Fallback local obligatorio vía FFmpeg (`generateLocalSceneCard`).
    - El fallback local genera imágenes 1280x720 de fondo curado (degradados/sólidos específicos por índice de escena) con tarjeta de texto (título de escena recortado a <=60 caracteres y badge de número de escena).
    - **Circuit Breaker 402**: Tras 2 errores 402 consecutivos en un job, se conmuta inmediatamente a fallback local para el resto de escenas, evitando llamadas y esperas innecesarias a la red.
  - **Tope de Escenas (Scene Capping) en [scriptWriter.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/services/scriptWriter.ts) y [manager.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/manager.ts)**:
    - Si el tema solicita "3 escena", "corto", "short", "prueba" o "test", se generan y renderizan exactamente 3 escenas con duración estimada realista (~60-120s).
    - En cualquier otro tema, el tope en P0 es de máximo 5 escenas (ahorro de cuotas y tiempo de render).
  - **Ensamblado Garantizado**:
    - Si fallan imágenes de red, las escenas faltantes se completan automáticamente con slides locales generados por FFmpeg.
    - Se permite ensamblado con 1 imagen fija solo bajo flag explícito `allowSingleStill: true` (para tests de administración); por defecto se generan N slides locales diferenciados por escena.
    - El MP4 de prueba SIEMPRE puede entregarse al admin.
  - **Reporte Claro en Mensajes Admin**:
    - [telegramReview.ts](file:///c:/Users/eduar/silvaniacoreagent/src/marketing/telegramReview.ts) e [index.ts](file:///c:/Users/eduar/silvaniacoreagent/src/index.ts) reportan: duración real del audio (ffprobe) y desglose de imágenes (ej. `MP4 1:25 (audio real) · 3 escenas (1 red, 2 slides locales)`).
- **Test de Verificación**:
  - `npx tsx scratch/test_mock_402_assembler.ts`: Verificado con simulación de 402 forzado. Generó 3 imágenes locales con colores y textos distintos, y ensambló un MP4 de 6s con hashes MD5 diferentes en los segundos 1s, 3s y 5s (`197d...`, `4ab7...`, `221b...`).



