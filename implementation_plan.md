# Plan de Implementación P0: Silvania CoreAgent (Post-Deploy Octubre 2026)

## Contexto y Principios
- **Regla Absoluta de Preservación**: No borrar ni eliminar herramientas, skills, carpeta `silvania/`, Eva clínica, Marketing Studio, scopes de producción (`gmail.send`, `calendar.events`, `spreadsheets`, `drive.file`) ni flujos HITL existentes.
- **Tier Beta**: Usuario admin `1572946817` se mantiene en `BETA_USER_IDS` con scopes amplios. Producción mantiene scopes mínimos.
- **X/Twitter**: Devolver mensaje claro "X no configurado" si no hay credenciales autorizadas.
- **Facturas / Sheets**: Flujo verificado y preservado.

---

## 1. Skill Loader Ruidoso (Prioridad Alta)
- **Problema**: Cada mensaje ejecuta decenas de `drive search` y `drive download` de los mismos `SKILL.md` (rrhh-*, agente-*, etc.), saturando logs y latencia.
- **Solución**:
  - Implementar en `src/services/skillLoader.ts` una caché en memoria/disco con TTL (20 minutos) por usuario.
  - Comprobar metadatos (`modifiedTime` / `fileId` y existencia local) antes de descargar. Si no ha cambiado, omitir descarga.
  - Logging unificado en 1 sola línea resumen: `✅ [Skill Loader] Sincronización completada para usuario {userId}: {total} skills ({descargas} descargas, {omitidas} omitidas por caché)`.

## 2. Enlaces Reales al Crear Carpeta / Archivo en Drive
- **Problema**: `drive_mkdir` y `drive_create_text_file` devuelven mensajes que no exponen el `id` y `webViewLink` de forma limpia al `sanitizeAlucinatedLinks`, provocando `[Enlace no disponible — no devuelto por la herramienta]`.
- **Solución**:
  - En `src/tools/drive.ts` (`driveMkdir`) y `src/tools/index.ts` (`drive_create_text_file`):
    - Devolver siempre `id`, `name`, `webViewLink` y `[Abrir]({url})` con formato reconocible tanto al crear como cuando la carpeta ya existe.
    - Soporte explícito para rutas de carpetas tipo `silvania/transcripciones` o `transcripciones` resolviendo en la estructura canónica sin duplicar.
  - En `src/agent/agent.ts`:
    - Instrucción explícita para no inventar ni usar `my-drive` si se tiene el ID real devuelto por la herramienta.

## 3. YouTube Transcripción: Resumen en Chat + Guardado + Enlace
- **Problema**: Transcripciones completas saturan el chat de Telegram y se truncan.
- **Solución**:
  - En `src/tools/youtube.ts`:
    - Por defecto (o cuando longitud > 1500 caracteres), guardar el texto completo en Drive (`silvania/transcripciones/transcripcion_{videoId}.md`).
    - En el chat devolver resumen estructurado (~800–1200 caracteres) + enlace real y verificado de Drive al archivo completo.
    - No volcar la transcripción completa al chat.

## 4. /marketing video: Texto Completo + Audio Completo
- **Problema**: `/marketing video` genera guion largo pero TTS dice solo el tema (ej. "coreagent") y el texto se percibe truncado.
- **Solución**:
  - En `src/marketing/manager.ts`: sintetizar para TTS la narración real (hook + resumen/escenas), nunca solo el slug del tema.
  - En `src/marketing/telegramReview.ts`:
    - Adjuntar el guion completo estructurado por escenas en Telegram (partiendo en mensajes si supera límites de caracteres).
    - Locución con título real en la leyenda (no el slug simple).
    - Preservar botones HITL.

## 5. UX Menor Auth / Gmail
- En `src/agent/agent.ts`:
  - Si el usuario dice "ya lo vinculé", "inténtalo ahora", "reintenta", no llamar a `generate_authorization_link`; ejecutar la acción solicitada.
  - Si pide enviar correo ("envíalo tú"), llamar a `gmail_send` y no responder solo con enlace a webmail.

## 6. Cron Matutino / Rotativo de Marketing: Borradores con Imagen
- En `src/marketing/cron.ts`, `manager.ts` y `telegramReview.ts`:
  - Asegurar que el pipeline de imagen FLUX se ejecute siempre.
  - Si la generación de imagen falla, loguear y mostrar aviso explícito `⚠️ Imagen no generada: {motivo}`, manteniendo botones HITL y 0 mensajes a usuarios no-admin.

---

## Verificación
1. `npm run build` / `npx tsc --noEmit` -> 0 errores.
2. Test script para `skillLoader`: verificar que la 2ª llamada en < TTL no descargue las skills.
3. Test de enlaces en `drive_mkdir` y `drive_create_text_file` con `sanitizeAlucinatedLinks`.
4. Test de transcripción de YouTube: resumen + archivo Drive.
5. Test de `/marketing video` y rotación de cron admin con aviso de imagen.
