/**
 * Conector Unipile (API unificada para LinkedIn, Instagram, WhatsApp y Email)
 * Permite recibir webhooks de mensajes entrantes y enviar respuestas aprobadas vía HITL.
 * Si UNIPILE_DSN o UNIPILE_API_KEY aún no están configurados, opera en modo simulador seguro.
 */

export interface UnipileIncomingMessage {
  chatId: string;
  accountId?: string;
  provider: string;
  senderName: string;
  senderRole?: string;
  senderProfileUrl?: string;
  messageText: string;
  isSelf: boolean;
}

export interface UnipileSendResult {
  ok: boolean;
  simulated: boolean;
  providerResponse?: any;
  error?: string;
}

export const unipileService = {
  isConfigured(): boolean {
    return Boolean(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY);
  },

  getDsnUrl(): string {
    const raw = (process.env.UNIPILE_DSN || "").trim().replace(/\/+$/, "");
    if (!raw) return "";
    return raw.startsWith("http") ? raw : `https://${raw}`;
  },

  /**
   * Normaliza el payload de webhook `message_received` de Unipile (y formatos equivalentes de prueba).
   */
  parseWebhookPayload(body: any): UnipileIncomingMessage | null {
    if (!body || typeof body !== "object") return null;

    // Formato estándar Unipile message_received
    const eventType = String(body.event || body.type || "message_received").toLowerCase();
    if (eventType && !eventType.includes("message") && !body.message && !body.messageText) {
      return null;
    }

    const sender = body.sender || body.attendee || {};
    const isSelf = Boolean(
      body.is_sender === true ||
      body.from_me === true ||
      sender.is_self === true
    );

    const chatId = String(body.chat_id || body.chatId || body.conversation_id || "").trim();
    const messageText = String(
      body.message?.text ||
      (typeof body.message === "string" ? body.message : "") ||
      body.text ||
      body.messageText ||
      ""
    ).trim();

    if (!messageText) return null;

    const senderName = String(
      sender.attendee_name ||
      sender.name ||
      body.sender_name ||
      body.leadName ||
      "Prospecto"
    ).trim();

    const senderRole = String(
      sender.headline ||
      sender.role ||
      body.leadRole ||
      "Profesional B2B"
    ).trim();

    const senderProfileUrl =
      sender.attendee_profile_url ||
      sender.profile_url ||
      body.leadProfileUrl ||
      undefined;

    const provider = String(
      body.provider ||
      body.account_type ||
      sender.provider ||
      "LINKEDIN"
    ).toUpperCase();

    return {
      chatId: chatId || `sim_chat_${Date.now()}`,
      accountId: body.account_id || process.env.UNIPILE_ACCOUNT_ID || undefined,
      provider,
      senderName,
      senderRole,
      senderProfileUrl,
      messageText,
      isSelf,
    };
  },

  /**
   * Envía un mensaje a un chat de Unipile tras aprobación HITL en Telegram.
   * Si no hay credenciales aún, devuelve éxito simulado para pruebas locales/staging.
   */
  async sendMessage(chatId: string, text: string): Promise<UnipileSendResult> {
    if (!this.isConfigured()) {
      console.log(`🧪 [Unipile Simulator] Mensaje aprobado para chat ${chatId}: "${text.slice(0, 120)}..."`);
      return { ok: true, simulated: true };
    }

    const dsn = this.getDsnUrl();
    const apiKey = process.env.UNIPILE_API_KEY!;

    try {
      const res = await fetch(`${dsn}/api/v1/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.message || data?.detail || `HTTP ${res.status}`;
        console.error(`❌ [Unipile] Error enviando mensaje a ${chatId}: ${errMsg}`);
        return { ok: false, simulated: false, error: errMsg, providerResponse: data };
      }

      console.log(`✅ [Unipile] Mensaje enviado al chat ${chatId}`);
      return { ok: true, simulated: false, providerResponse: data };
    } catch (err: any) {
      console.error(`❌ [Unipile] Excepción enviando mensaje:`, err.message);
      return { ok: false, simulated: false, error: err.message };
    }
  },
};

