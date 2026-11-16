# 01 · Roadmap Marketing Agent (Prioridad #1 de Tracción)

## Estado Actual (Implementado)
- Guionización multicanal (`youtube_long`, `youtube_short`, `tiktok`, `whatsapp_video`, `social_post`) con CTA obligatorio a `silvania.ai`.
- Marca híbrida en Google Drive (`01_inicio`, `02_medio`, `03_cierre`, `banco_visual`, `marca_y_reglas.md`).
- Memoria vectorial semántica por escena + detección de intención por beat.
- Renderizado FFmpeg secuencial (`3x` supersampling anti-vibración, Ken Burns, transiciones `fade`/`xfade`, música con `afade`/`amix`, subtítulos/slides y aprobación HITL en Telegram).

---

## Escalera de Evolución hacia Vídeo Animado / Hiperrealista Multi-Personaje

### Nivel 1 · Coherencia Visual y Ritmo Profesional (Corto plazo — 0€ extra)
- **Separación estricta de escenas de contraste:** catalogar aulas tradicionales/serias (`enseñanza_antigua`) separadas de aulas alegres (`niños_jugando`) y generar un nuevo lote curado de imágenes luminosas y expresivas.
- **Subtítulos dinámicos quemados (ASS/SRT):** añadir subtítulos sincronizados palabra por palabra (estilo Reels/Shorts/TikTok) directamente en FFmpeg para multiplicar la retención sin coste de API.
- **Conexiones y perfiles de marca:** permitir a cada usuario conectar sus cuentas (Telegram, LinkedIn, X, YouTube, Meta, TikTok) y guardar múltiples estilos de marca.

### Nivel 2 · Movimiento Real (Image-to-Video + Stock HD, Bajo Coste)
- **Integración de clips de vídeo cortos (4–5s) por escena:** combinar nuestras imágenes de marca con generadores *Image-to-Video* (ej. **Kling, Runway, Luma Dream Machine, Veo / Hailuo / Fal.ai**) para dar movimiento real de cámara, expresiones y acción a las escenas clave (hook y cierre), manteniendo slides/Ken Burns en las escenas intermedias para controlar costes.
- **B-Roll dinámico:** conector opcional con Pexels/Pixabay Video API para escenas de contexto real en 1080p.

### Nivel 3 · Diálogos Multi-Personaje con Voces Distintas (TTS Multi-Speaker)
- **Guion estructurado por personaje (`speakerId`):**
  - El `scriptWriter` pasa a generar turnos de diálogo: `[Personaje A: Empresario]`, `[Personaje B: CoreAgent]`, `[Narrador]`.
- **Motor de voz multi-personaje:**
  - Asignar una voz distinta a cada personaje usando **Edge-TTS** (gratis: Álvaro, Elvira, Alonso, Abril, etc.) o **ElevenLabs / OpenAI / Gemini Audio** para voces hiperrealistas con emoción.
  - Concatenar los audios por turno guardando los timestamps exactos de cada intervención para sincronizar la escena visual con quién está hablando.

### Nivel 4 · Personajes Consistentes y Lip-Sync Hiperrealista / Animado (Objetivo Final)
- **Consistencia de personaje (Character Sheet / LoRA / Reference):** definir avatares fijos de Silvania (ej. *Eva Tutora*, *CoreAgent Ejecutivo*, *Niño Explorador*) mediante imágenes de referencia fijas o modelos con *character reference* (Flux + IP-Adapter / Kling / Runway Act-One).
- **Sincronización labial (Lip-Sync):** conectar la pista de audio de cada personaje a un motor de *talking head / lip-sync* (ej. **HeyGen API, Sync Labs, LivePortrait o Hedra**) y ensamblar la conversación multi-plano en `videoAssembler.ts` con plano/contraplano automático.
- **Perfiles de usuario en Marketing Agent:** cada cliente elige su estilo (*Animado 3D Pixar*, *Hiperrealista Cinematográfico*, *Corporativo*) y sus personajes propios.

