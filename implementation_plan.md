# Plan de Implementación: Cron de Marketing Rotativo para Admins (HITL)

## 1. Contexto y Objetivos
- **Propósito**: Implementar un cron automático y opcional exclusivo para administradores (`MARKETING_ADMIN_IDS`) que genere **1 único borrador rotativo por ejecución** sobre los 3 productos de Silvania:
  1. **CoreAgent**: Productividad ejecutiva en Telegram conectada a Google Workspace con scopes mínimos y privacidad. (Disponible / Early Access en `https://silvania.ai/coreagent`).
  2. **Eva**: Voz y estimulación del habla interactiva en navegador web, 100% privacidad local, sin enviar audio de menores a servidores ni requerir cuentas de Google de niños. Estado obligatorio: **"Próximamente / En el laboratorio"** (no vender acceso público aún).
  3. **Marketing Studio**: Motor de contenidos multicanal con filosofía Human-in-the-Loop y dogfooding interno. Estado obligatorio: **"Próximamente / Fase interna"** (no vender acceso público aún).

## 2. Reglas Estrictas
- **NO enviar nada a usuarios normales**: El cron solo busca administradores en `config.marketing.adminIds`. Si no hay admins configurados, no se ejecuta.
- **Un solo borrador por ejecución**: Se envía exclusivamente al administrador principal (`adminIds[0]`) para evitar duplicaciones o spam.
- **Botones HITL existentes**: La tarjeta interactiva se envía a Telegram con los botones habituales:
  - `🚀 Aprobar y Publicar` (publica en el canal vitrina solo si el admin lo pulsa)
  - `🔄 Regenerar` (solicita nueva propuesta)
  - `❌ Descartar` (cancela el borrador)
  - `📦 Pack Multirredes` (X, LinkedIn, FB, TikTok)
- **Cero publicación sin aprobación**: Ningún contenido se publica de manera automática en el canal ni redes sociales sin aprobación explícita HITL.
- **Rotación determinista**: Se rota el producto en cada ejecución de forma circular:
  `CoreAgent -> Eva -> Marketing Studio -> CoreAgent...`
- **Preservación absoluta**:
  - Cero cambios a scopes OAuth de producción.
  - Cero cambios a la lógica y endpoints clínicos de Eva.
  - No borrar herramientas, skills ni configs existentes.

---

## 3. Arquitectura de la Solución
1. **Configuración (`src/config/config.ts`)**:
   - Soporte para variables opcionales:
     - `MARKETING_CRON_ENABLED`: boolean (default `true` si hay admins en `MARKETING_ADMIN_IDS`).
     - `MARKETING_CRON_HOUR`: hora de ejecución en Europe/Madrid (default `11` AM).
     - `MARKETING_CRON_MINUTE`: minuto de ejecución (default `00`).
2. **Servicio Cron Rotativo (`src/marketing/cron.ts`)**:
   - Definición de los 3 perfiles de producto con sus directrices y estado de disponibilidad.
   - Cálculo del índice de rotación persistido en SQLite / memoria.
   - Creación del borrador llamando a `marketingManager.createAndReviewDraft(...)`.
   - Envío de tarjeta HITL a través de `telegramReview.sendReviewCard(...)`.
   - Función manual invocable `runMarketingDailyDraft(bot, adminId)` para pruebas inmediatas o comandos de admin (`/marketing draft`).
3. **Refuerzo en `scriptWriter.ts`**:
   - Asegurar que el prompt del LLM exija que Eva y Marketing Studio lleven explícitamente el estado *"Próximamente / Fase experimental"* sin vender acceso directo público.
4. **Activación en el arranque (`src/index.ts`)**:
   - Inicializar el scheduler de `startMarketingAdminCron(bot)` sin interferir con el cron matutino de las 06:30.

---

## 4. Plan de Verificación
1. `npx tsc --noEmit` y `npm run build`.
2. Prueba unitaria / script scratch para comprobar:
   - Rotación correcta de los 3 productos (0, 1, 2).
   - El copy de Eva y Marketing Studio incluye "próximamente" y no vende acceso público.
   - La tarjeta HITL solo se despacha a administradores con los botones de aprobación.
   - Sin aprobación humana no se produce publicación al canal.
