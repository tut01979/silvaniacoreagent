# 02 · Roadmap CoreAgent, Setter IA & Combo Microempresarios (All-in-One)

## Visión de Producto: El Sistema Operativo para Microempresarios
En lugar de vender herramientas desconectadas (que obligan al cliente a usar Zapier, ManyChat, Make y Calendly), Silvania se empaqueta como **un empleado digital integral** para autónomos y microempresas:
1. **CoreAgent:** Gestión operativa de Google Workspace (Gmail, Drive, Docs, Sheets, Calendar y finanzas básicas).
2. **Marketing Agent:** Creación periódica de contenido audiovisual profesional para redes sociales (YouTube, TikTok, Instagram, LinkedIn).
3. **Setter IA Multicanal:** Prospección y atención 24/7 en WhatsApp, Instagram, LinkedIn y chat web con Unipile + Google Calendar.
4. **Widget Web & Webhook de Captura:** Formulario/chat embebible en la web del cliente que responde con su catálogo y agenda citas en piloto automático.
5. **Base de Conocimiento Nativa en Drive:** El cliente solo sube sus PDFs, listas de precios o FAQs a una carpeta de su Google Drive; el agente aprende sin configuración técnica ni prompts complejos.

---

## Estado Actual (Implementado)
- Asistente ejecutivo en Telegram conectado a Google Workspace (Calendar, Gmail, Drive, Sheets, Contacts) con permisos mínimos verificados.
- Conector **Unipile** (`unipileService.ts` + webhook `/api/unipile/webhook`) con credenciales de producción activas en Railway (`UNIPILE_DSN` y `UNIPILE_API_KEY`).
- **Setter IA HITL** en Telegram (`leadSetter.ts`): propone respuesta usando huecos reales de Google Calendar y permite **`✅ Aprobar y Enviar`** o **`📅 Enviar + Agendar Cita`** en 1 clic.
- Sistema de reservas y disponibilidad integrado con Google Calendar.
- Checkout de Stripe preparado con `Silvania CoreAgent Premium` (19 €/mes) y modo Pro con Setter bloqueado por flag (`ENABLE_PRO_SETTER_CHECKOUT=false`) hasta el lanzamiento oficial.

---

## Análisis Financiero y Viabilidad (Unit Economics)
Estimación de coste directo de servicio (COGS) por microempresario con uso moderado-alto:

| Concepto / API | Consumo Mensual Promedio por Cliente | Coste Estimado (€) |
| :--- | :--- | :--- |
| **Unipile** (WhatsApp/LinkedIn/IG) | 1 cuenta conectada activa | ~4,50 € – 6,00 € |
| **LLM (Gemini 2.0 / Claude mini)** | ~1.500 mensajes de prospección/chat + razonamiento | ~0,40 € – 0,80 € |
| **ElevenLabs / Audio IA** | 8 a 12 videos de marketing al mes (~15 min de audio) | ~2,50 € – 3,50 € |
| **Infraestructura Railway / Storage** | Computación compartida y base de datos | ~1,00 € |
| **Total Coste Directo (COGS)** | — | **~8,40 € – 11,30 € / mes** |
| **Ingreso Oferta Fundadores** | **50 € / mes** | **Margen Bruto: ~77% – 83%** |
| **Ingreso Precio Estándar** | **60 € / mes** | **Margen Bruto: ~81% – 86%** |

---

## Fases de Crecimiento y Salida al Mercado

### Fase A · Validación con Early Adopters (AHORA — Sin cobros)
- **Objetivo:** validar acogida real, tasa de respuesta y citas cerradas con 20–50 usuarios beta antes de darse de alta fiscalmente.
- **Flujo del Setter IA en validación:**
  - Ofrecer **acceso anticipado gratuito (beta privada de 14 días)** a cambio de feedback activo.
  - Conexión de canales Unipile para testear captación real en frío y caliente.
- **Métricas clave:** % de respuestas de leads, % de reuniones agendadas y retención semanal.

### Fase B · Lanzamiento Comercial "Los 100 Fundadores" (Tras validar)
- **Alta fiscal/empresarial** y activación de cobros en Stripe.
- **Oferta Pioneros / Fundadores (Primeros 100 clientes):**
  - **Precio:** **50 €/mes** (precio congelado de por vida mientras mantengan la suscripción activa).
  - **Compromiso del cliente:** Feedback bimensual y autorización de caso de estudio / testimonio.
  - **Impacto financiero:** Genera **5.000 €/mes de MRR recurrente** con costes operativos inferiores a 1.100 €/mes.
- **Política de Uso Justo (Fair Use Policy - FUP):**
  - Hasta 12-15 vídeos de marketing generados al mes.
  - Hasta 1.500 conversaciones/mensajes gestionados por el Setter IA.
  - Paquetes de ampliación para clientes con tráfico masivo.

### Fase C · Precio Estándar y Expansión (A partir del cliente 101)
- **Precio Estándar:** **60 €/mes** (o 69 €/mes).
  - Muy inferior al coste de contratar un setter humano (500–1.200 €/mes) o contratar herramientas de IA parciales que solo hacen chat y rondan 70–100 €/mes.
- **Onboarding Self-Serve en 3 pasos:**
  1. Conexión de Google Workspace (Gmail + Drive + Calendar) vía OAuth.
  2. Conexión de WhatsApp/Redes escaneando un código QR vía Unipile.
  3. Selección de la carpeta de Drive con la documentación del negocio.

### Fase D · Funcionalidades Avanzadas de Conversión
- **Widget Web Embebible (1 línea de código):**
  - `<script src="https://silvania.ai/widget.js" data-business-id="ID"></script>` para instalar en WordPress, Webflow, Shopify o cualquier web.
- **Webhook de Captura `/api/leads/capture`:**
  - Integración inmediata con formularios de contacto, Typeform o landing pages con IA; el Setter IA inicia el contacto por WhatsApp en menos de 60 segundos.
- **Memoria Relacional Prolongada:**
  - Secuencias de seguimiento automático a 3, 7 y 14 días si el prospecto no responde, con selector entre **Modo HITL (aprobación en Telegram)** y **Modo Autónomo**.

