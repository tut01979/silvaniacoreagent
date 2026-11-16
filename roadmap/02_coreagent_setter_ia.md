# 02 · Roadmap CoreAgent & Setter IA (Validación -> Monetización)

## Estado Actual (Implementado)
- Asistente ejecutivo en Telegram conectado a Google Workspace (Calendar, Gmail, Drive, Sheets, Contacts) con permisos mínimos verificados.
- Conector **Unipile** (`unipileService.ts` + webhook `/api/unipile/webhook`) con modo simulador listo.
- **Setter IA HITL** en Telegram (`leadSetter.ts`): propone respuesta usando huecos reales de Google Calendar y permite **`✅ Aprobar y Enviar`** o **`📅 Enviar + Agendar Cita`** en 1 clic.
- Checkout de Stripe preparado:
  - `Silvania CoreAgent Premium` (19 €/mes).
  - `Silvania CoreAgent Pro + Setter IA` (49 €/mes) **oculto y bloqueado por flag (`ENABLE_PRO_SETTER_CHECKOUT=false`)** hasta el alta legal.

---

## Fases de Crecimiento

### Fase A · Búsqueda de Early Adopters y Validación (AHORA — Sin cobros)
- **Objetivo:** validar acogida real, tasa de respuesta y citas cerradas con 20–50 usuarios beta antes de darse de alta fiscalmente.
- **Flujo del Setter IA en validación:**
  - En lugar de vender suscripción desde el primer mensaje, el Setter IA ofrece **acceso anticipado gratuito (beta privada / prueba de 10–14 días)** a cambio de probar CoreAgent y dar feedback.
  - Conectar cuenta de **Unipile** (`UNIPILE_DSN` + `UNIPILE_API_KEY`) cuando se active la prospección real en LinkedIn/Instagram/WhatsApp.
- **Métricas clave de validación:**
  - % de leads que responden.
  - % de demos agendadas en Google Calendar.
  - Retención semanal de usuarios beta en Telegram.

### Fase B · Activación Comercial (Tras validar tracción)
- Alta fiscal/empresarial y activación de `ENABLE_PRO_SETTER_CHECKOUT=true` en Railway.
- Desbloqueo del plan **`CoreAgent Pro + Setter IA (49 €/mes)`** en Stripe y botones públicos del bot/web.
- Límites y cuotas automáticas por plan (Free / Premium 19€ / Pro + Setter IA 49€).

### Fase C · Setter IA Multicanal Avanzado
- Memoria de conversación completa por prospecto en Firestore (seguimiento a 3, 7 y 14 días si no responde).
- Selector por usuario entre **Modo Asistido HITL** (por defecto) y **Modo Piloto Automático** para cuentas verificadas.
- Dashboard de pipeline de leads y citas cerradas desde el Hub.

