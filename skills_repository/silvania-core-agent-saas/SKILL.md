---
name: Silvania Core Agent SaaS
description: Asistente ejecutivo elite y plataforma SaaS multi-usuario de inteligencia artificial.
---

# Silvania Core Agent SaaS

## Descripción
Silvania CoreAgent es el primer agente inteligente y el producto estrella de Silvania.ai. Opera como una plataforma SaaS multi-usuario diseñada para ser un asistente ejecutivo élite que corre 24/7 a través de Telegram. Su objetivo es ayudar a profesionales y empresas a automatizar tareas complejas en el mundo real y elevar drásticamente su productividad diaria.

## Capacidades
- **Gestión de Gmail:** Buscar, listar, leer hilos de mensajes, redactar y enviar correos de manera autónoma con URLs directas clicables.
- **Organización de Drive:** Listar directorios raíz y carpetas secundarias, crear carpetas (`drive_mkdir`), clasificar y mover archivos de forma proactiva.
- **Planificación de Calendario:** Crear, listar, modificar y eliminar eventos de Google Calendar.
- **Hojas de Cálculo (Sheets):** Creación de documentos, lectura y volcado de celdas con fórmulas automatizadas (como IVA 21% y subtotales en español `=SUMA`).
- **Investigación Corporativa & Búsqueda Web:** Prospección de información de empresas y lectura directa de URLs (`read_url`) para estructurar informes comerciales detallados.
- **Búsqueda en YouTube:** Búsqueda optimizada por relevancia y fecha de subida, y obtención de transcripciones de videos.
- **Interacción por Voz:** Respuestas por nota de voz naturales y fluidas mediante ElevenLabs/AWS Polly.
- **Multitarea Detallada:** Ejecución secuencial de planes de tareas complejas en un solo mensaje de usuario con respuestas finales numeradas e íntegras.
- **Memoria Persistente Híbrida:** Sincronización transparente de historiales de conversación consolidados y archivos por temas directamente en la carpeta `silvania/` de Google Drive del usuario.

## Arquitectura (resumen)
Telegram bot (gramY) <---> Agent Executive (agent.ts) <---> LLM Service (llm.ts) + Tools Hub (tools/index.ts) <---> gog CLI / OAuth + Firebase + Railway.
Memoria almacenada en el Drive del usuario en `/silvania/historial/`, `/silvania/prompts/` y `/silvania/memoria_conversacion.json`.

## Flujos Críticos
1. **OAuth de Google:** Comando `/auth` genera un enlace temporal visible de redirección hacia Google para vincular la cuenta del usuario de manera segura.
2. **Multitarea (Trigger):** Se activa únicamente si el mensaje del usuario contiene 2 o más verbos de acción física orientados a herramientas. Si es pregunta o explicación, se ejecuta de forma conversacional rápida.
3. **Memoria Persistente:** Carga síncrona desde Drive en la primera interacción o segundo plano si hay caché local caliente. Sincronización automática de `memoria_conversacion.json` y resúmenes de temas al final del turno.
4. **Facturación / Trial:** Bloqueo de uso no básico tras 7 días de trial. Se levanta un checkout seguro de Stripe (~€19/mes) para activar la suscripción Premium.

## Despliegue (alto nivel)
Variables de entorno esenciales requeridas en Railway:
- `TELEGRAM_BOT_TOKEN`: Token de autenticación del bot.
- `OPENROUTER_API_KEY`: API Key para llamadas al LLM (Gemini 2.5 y GPT-4o-mini).
- `PUBLIC_URL`: URL del hosting en Railway para webhooks y Checkouts.
- `PORT`: Puerto de escucha del servidor web.
- `STRIPE_API_KEY` / `STRIPE_WEBHOOK_SECRET`: Claves de facturación mensual.
- `FIREBASE_PROJECT_ID` / `FIREBASE_SERVICE_ACCOUNT`: Persistencia de base de datos multi-usuario.

## Checklist de Pruebas de Humo
- [ ] **Gmail:** *"lista mis 5 últimos correos"* -> Debe verse el remitente, asunto, fecha y URL plana visible.
- [ ] **Calendar:** *"crea un evento para mañana reunión inversores a las 10:00"* -> Detalle del evento y URL visible del calendario.
- [ ] **Drive:** *"lista la raíz de mi Drive"* -> Lista ordenada de carpetas y archivos con URLs completas.
- [ ] **Sheets:** *"crea una factura llamada TestFacturaOK con 2 productos..."* -> Hoja de cálculo con fórmulas `=SUMA`, `=C23*21%`, y `=C23+C24` sin `#VALUE!`.
- [ ] **Multitarea:** *"lista mis 5 correos y crea un evento..."* -> Bloque numerado con el listado de correos real + detalle del evento con URLs reales y línea final `✅ Completado: 2/2 tareas`.
- [ ] **Conversación natural:** *"¿Qué opinas del SaaS de agentes?"* -> Respuesta conceptual fluida sin listas de tareas ni bloque "Resumen Final".

## Notas de Mantenimiento
- **Memoria del Usuario:** La carpeta `silvania/` en Drive es sagrada y contiene la configuración del usuario. NUNCA la borres ni la sobrescribas.
- **Credenciales del Código:** Prohibido commitear o subir `gmail-credentials.json` o `.env` al repositorio de Git; asegúrate de que permanezcan en `.gitignore`.
- **Ruteo de Modelos:** Mantén el ruteo conversacional rápido a `gpt-4o-mini` y el ejecutable a `gemini-2.5-flash`.
