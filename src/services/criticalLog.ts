import fs from "fs";
import path from "path";

type AlertCallback = (msg: string) => Promise<void>;
let alertCallback: AlertCallback | null = null;

export const criticalLogService = {
  /**
   * Registra un callback para enviar notificaciones en caliente (por ejemplo, mensajes de Telegram).
   */
  registerCallback(cb: AlertCallback) {
    alertCallback = cb;
  },

  /**
   * Registra una alerta crítica en la consola, en un archivo de log físico local
   * y despacha un callback si está registrado (ej. enviar mensaje de Telegram a Jesús).
   */
  async logCritical(title: string, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [CRITICAL] [${title}] ${message}\n`;
    
    console.error(`🚨 ALERTA CRÍTICA: [${title}] ${message}`);

    // 1. Guardar en archivo de log físico
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.appendFileSync(path.join(dataDir, "critical_alerts.log"), logLine, "utf8");
    } catch (e: any) {
      console.error("❌ Falló el guardado del log físico crítico:", e.message);
    }

    // 2. Despachar notificación
    if (alertCallback) {
      try {
        await alertCallback(`🚨 **ALERTA CRÍTICA DE SISTEMA**\n\n📌 **Asunto:** ${title}\n📅 **Hora (UTC):** ${timestamp}\n💬 **Mensaje:** ${message}`);
      } catch (err: any) {
        console.error("❌ Falló el envío del callback de alerta crítica:", err.message);
      }
    }
  }
};
