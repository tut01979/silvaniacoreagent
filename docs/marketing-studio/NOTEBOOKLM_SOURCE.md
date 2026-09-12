# Silvania Marketing Studio — Autonomous Content Engine & Lean Startup Dossier

> **Documento Fuente de Conocimiento para NotebookLM (Modo Investigación Profunda)**  
> **Producto:** Silvania Marketing Studio  
> **Ecosistema:** Silvania AI  
> **Filosofía:** Lean Bootstrap (Coste marginal cero, máxima calidad percibida, Human-in-the-Loop)

---

## 1. Visión del Producto e Independencia
* **Independencia Arquitectónica:** Silvania Marketing Studio es una startup/producto 100% independiente de **Silvania CoreAgent** (asistente de productividad personal y Google Workspace) y de **Eva** (asistente clínico/logopédico).
* **Propósito:** Automatizar la creación, dirección y distribución de contenido multimedia de alto impacto (posts para LinkedIn/Telegram, YouTube Shorts y vídeos largos de 8 a 15 minutos en YouTube) eliminando la fricción de producción.
* **Paradigma Human-in-the-Loop (HITL):** La IA no publica nada sin la aprobación explícita del creador. El usuario actúa como **Director Ejecutivo de Contenidos**, supervisando propuestas en Telegram con 1 clic (`[ 🚀 Aprobar ]`, `[ 🔄 Regenerar ]`, `[ ❌ Descartar ]`).
* **Estrategia Inicial ("Dogfooding"):** Validación en carne propia por el fundador (`userId: 1572946817`) antes de empaquetar la solución como SaaS multi-inquilino.

---

## 2. Arquitectura de Subagentes Especializados

```
                    ┌─────────────────────────┐
                    │    MARKETING MANAGER    │
                    │      (Orquestador)      │
                    └────────────┬────────────┘
                                 │
     ┌──────────────┬────────────┼────────────┬──────────────┐
     │              │            │            │              │
     ▼              ▼            ▼            ▼              ▼
┌──────────┐  ┌───────────┐ ┌─────────┐ ┌───────────┐ ┌─────────────┐
│  Trend   │  │   Copy    │ │ Creative│ │   Voice   │ │  Telegram   │
│Researcher│  │  Writer   │ │ Studio  │ │  Studio   │ │ Review/Pub  │
│ (Brave/  │  │(Gemini /  │ │ (FLUX.1 │ │ (Edge-TTS │ │(HITL Inline │
│  News)   │  │ Llama-3.3)│ │  Free)  │ │   Free)   │ │  Keyboards) │
└──────────┘  └───────────┘ └─────────┘ └───────────┘ └─────────────┘
                                                      │
                                                      ▼ (Aprobado)
                                            ┌───────────────────┐
                                            │ Canal Telegram /  │
                                            │ LinkedIn / YouTube│
                                            └───────────────────┘
```

1. **Marketing Manager (Director)**: Recibe objetivos o tendencias matutinas, delega tareas en paralelo y ensambla el borrador (`MarketingDraft`).
2. **Trend Researcher**: Analiza noticias y tendencias virales vía Brave Search API (tier gratuito de 2.000 consultas/mes).
3. **Copywriter**: Genera títulos de alto CTR, estructura de retención (Hook $\rightarrow$ Story/Value $\rightarrow$ Lesson $\rightarrow$ CTA) y mención orgánica hacia `silvania.ai`.
4. **Creative Studio**: Genera prompts en inglés de alto contraste visual y renderiza portadas o miniaturas fotorrealistas con FLUX.1.
5. **Audio Studio**: Genera locuciones fluidas y expresivas con voces neuronales en español de Edge-TTS, concatenando pistas con FFmpeg.
6. **HITL Reviewer & Publisher**: Entrega el paquete multimedia a Telegram y publica automáticamente tras la aprobación.

---

## 3. Stack Low-Cost (Máxima Calidad con Opciones Gratuitas)

| Componente | Proveedor por Defecto (0 € / Barato) | Alternativa Premium / Fallback | Coste Silvania vs. Mercado |
| :--- | :--- | :--- | :--- |
| **Redacción / LLM** | Google Gemini 2.5 Flash / Groq Llama 3.3 70B | Claude 3.5 Sonnet (solo casos complejos) | **~$0.002 / post** vs. $49/mes (Jasper) |
| **Locución Neural** | Microsoft Edge-TTS (`es-ES-AlvaroNeural`) / Google TTS | ElevenLabs (`MARKETING_PREMIUM_VOICE=true`) | **$0.00** vs. $22-$99/mes (ElevenLabs) |
| **Generación Visual** | Pollinations AI (FLUX.1 1280x720 sin coste) | Fal.ai / DALL-E 3 (bajo flag de pago) | **$0.00** vs. $30/mes (Midjourney) |
| **Investigación** | Brave Search API (2.000 búsquedas gratis/mes) | Perplexity API | **$0.00** vs. $199/mes (Semrush) |
| **Montaje de Video** | FFmpeg nativo local en contenedor Railway | Rendermac / Shotstack API | **$0.00** vs. $30-$60/mes (InVideo) |
| **Distribución** | Bot de Telegram + APIs directas (OAuth) | Make.com / Zapier / Buffer | **$0.00** vs. $99/mes (Hootsuite) |

---

## 4. Unit Economics Realistas y Variables

> [!NOTE]
> En la filosofía Lean Bootstrap no se inflan márgenes de fantasía; se evalúan los costes reales computacionales y el tiempo humano.

* **Coste por Post Corto (Texto + Foto FLUX + Locución Edge-TTS)**:
  * LLM: ~$0.001 - $0.003
  * Imagen FLUX: $0.00
  * Audio Edge-TTS: $0.00
  * **Coste Total por Post**: **< $0.003** (3 milésimas de dólar).
* **Coste por Vídeo de YouTube (8 a 12 minutos)**:
  * Guión completo por escenas: ~$0.005 - $0.008
  * Locución completa (1.200 a 1.800 palabras con Edge-TTS): $0.00
  * Miniatura 16:9 con FLUX: $0.00
  * B-roll (Pexels API libre): $0.00
  * CPU de Renderizado en Railway (FFmpeg 1080p en ~3-4 min): ~$0.015 (según consumo de vCPU del contenedor ya contratado).
  * **Coste Total por Vídeo Largo**: **~$0.02 - $0.03**.
* **Tiempo Humano**: 30 a 60 segundos por pieza (revisar la tarjeta de Telegram en el móvil y pulsar Aprobar). Ahorro de más de 4 horas de edición manual por vídeo.

---

## 5. Pipeline de Posts Cortos (Fase 1 — En Producción)

1. **Disparador**: Comando `/marketing post [tema]` o cron programado matutino.
2. **Generación Paralela**:
   - Redacción estructurada con gancho y hashtags.
   - Generación de imagen 16:9 con FLUX optimizada para contraste móvil.
   - Síntesis de voz del copy con Edge-TTS (`es-ES-AlvaroNeural`).
3. **Persistencia SQLite**: Registro en tabla `marketing_drafts` con estado `pending_review` y metadatos (`voiceProvider`, `imageProvider`, `llmModel`).
4. **Presentación HITL en Telegram**: Envío al administrador de foto con texto explicativo, nota de voz adjunta y teclado con 4 botones:
   - `[ 🚀 Aprobar y Publicar ]` $\rightarrow$ Envía al canal oficial si está configurado en `MARKETING_TELEGRAM_CHANNEL_ID` y marca `published`. Si no hay canal, marca `approved` sin falsos envíos.
   - `[ 🔄 Regenerar ]` $\rightarrow$ Solicita un nuevo enfoque y re-ejecuta el ciclo.
   - `[ ❌ Descartar ]` $\rightarrow$ Marca como `rejected`.
   - `[ 📜 Ver Guión ]` $\rightarrow$ Desglosa el guión escena por escena.

---

## 6. Pipeline de Vídeo de Larga Duración (Fase 2–3)

1. **Estructuración por Bloques**: División del vídeo en Hook (0-30s), Introducción, 4-6 Capítulos narrativos, Conclusión y CTA.
2. **Desglose de Escenas (`SceneBreakdown`)**: Cada bloque contiene su rango temporal, locución exacta y prompt cinematográfico de B-roll.
3. **Síntesis y Timecodes**: Sincronización del archivo de audio maestro con la duración de cada escena.
4. **Ensamblado Headless con FFmpeg**:
   - Generación de fondos de B-roll (imágenes panorámicas con efecto Ken Burns / zoom lento).
   - Mezcla de audio (voz principal al 100% + música de fondo royalty-free al 12%).
   - Quema de subtítulos dinámicos (`.srt`) en la parte inferior.
5. **Revisión en Telegram**: El bot envía la miniatura generada, un fragmento de video preview (los primeros 45 segundos) y el enlace privado para aprobación final antes de publicar en YouTube.

---

## 7. Responsabilidad del Director de Contenidos (Human-in-the-Loop)

* La IA es una **fábrica de borradores de alta velocidad**, no un sustituto del criterio editorial.
* El rol del fundador/usuario es:
  1. Verificar que el tono y los datos sean veraces.
  2. Asegurar que las imágenes no presenten deformaciones visuales evidentes.
  3. Decidir el momento estratégico de publicación.

---

## 8. Roadmap de Monetización Escalonado

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     FASE 1      │     │      FASE 2      │     │      FASE 3      │     │     FASE 4      │
│  Dogfooding &   │ ──► │  Canal Telegram  │ ──► │ LinkedIn OAuth & │ ──► │ SaaS Comercial  │
│ Telegram Review │     │    Automatizado  │     │ YouTube Faceless │     │ (Planes 29-79€) │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **Fase 1 (Completada)**: Pruebas del fundador en Telegram, verificación de calidad visual y locución neural gratuita.
2. **Fase 2**: Publicación automática diaria en el canal oficial de Telegram de Silvania para nutrir a la comunidad con consejos y casos de uso.
3. **Fase 3**: Integración de OAuth orgánico de LinkedIn (gratuito) y canal de YouTube Faceless monetizado con AdSense y tráfico referido a `silvania.ai`.
4. **Fase 4**: Apertura de la landing `silvania.ai/marketing` con planes de suscripción para creadores y agencias que deseen su propia agencia de contenidos con aprobación por Telegram.

---

## 9. Matriz de Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación Implementada |
| :--- | :--- | :--- |
| **Fallo o bloqueo de Edge-TTS** | Medio | Arquitectura de fallback en cadena: si Edge-TTS falla, salta a Google TTS libre; si este falla, salta a Polly/ElevenLabs. |
| **Latencia o caída de Pollinations AI** | Medio | Reintentos automáticos con timeout de 30s y opción de fallback a proveedores alternativos libres. |
| **Shadowban en redes sociales** | Alto | El factor Human-in-the-Loop evita el spam indiscriminado; los posts tienen variabilidad de ganchos y valor educativo real. |
| **Sobrecarga de CPU en el servidor** | Bajo | Los renderizados pesados se ejecutan con colas de baja prioridad en momentos de bajo tráfico del bot. |

---

## 10. Preguntas Clave para el Modo "Deep Research" de NotebookLM

Copia y pega estas consultas en NotebookLM para activar la investigación profunda y enriquecer la base de conocimiento:

1. *"¿Cuáles son las estructuras narrativas y ganchos de retención más efectivos para vídeos de YouTube de 8 a 12 minutos en canales educativos y de tecnología faceless en 2026?"*
2. *"Analiza los requisitos técnicos, límites de publicación orgánica y mejores prácticas de la API de LinkedIn para startups de automatización de contenidos."*
3. *"Comparativa técnica de renderizado local con FFmpeg vs servicios headless en la nube (Shotstack, Creatomate): costes, consumo de memoria y optimización de filtros Ken Burns."*
4. *"Estrategias probadas de monetización para canales de YouTube automatizados: AdSense vs marketing de afiliados de software SaaS vs generación de leads directos."*
5. *"¿Cómo estructurar un producto SaaS B2B de creación de contenido asistido por Telegram (Human-in-the-Loop) para maximizar la retención mensual (churn < 4%)?"*
