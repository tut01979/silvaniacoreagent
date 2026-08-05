import { llmService } from "./llm.js";

/**
 * Servicio modular para desglosar y procesar mensajes con múltiples instrucciones.
 */

/**
 * Divide un mensaje del usuario en un listado de tareas individuales y ordenadas.
 */
export async function parseUserTasks(userMessage: string): Promise<string[]> {
  if (!userMessage || !userMessage.trim()) return [];

  const prompt = `Analiza detenidamente el siguiente mensaje del usuario y divídelo en una lista ordenada de TODAS las tareas o instrucciones individuales que pide realizar.
Instrucciones estrictas:
- Extrae CADA una de las acciones solicitadas en el orden en que fueron expresadas.
- Si el mensaje contiene conectores como "y", "además", "luego", comas (,), saltos de línea o viñetas, separa cada acción como una tarea independiente.
- Retorna ÚNICAMENTE un arreglo JSON de strings de las tareas (ejemplo: ["Lista las carpetas de Drive", "Crea una carpeta llamada Test_Multi", "Muéstrame los correos de hoy"]).
- No incluyas explicaciones ni bloques de formato markdown. Solo el JSON.

Mensaje del usuario: "${userMessage}"`;

  try {
    const response = await llmService.chat([
      { role: "system", content: "Eres un orquestador multitarea de alta precisión que desglosa peticiones en arreglos de tareas en JSON de strings." },
      { role: "user", content: prompt }
    ]);
    
    let content = response.content || "[]";
    content = content.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanedTasks = parsed.map(t => String(t).trim()).filter(t => t.length > 0);
      if (cleanedTasks.length > 0) {
        return cleanedTasks;
      }
    }
  } catch (e: any) {
    console.warn("⚠️ Fallback a parseo directo por comas/conectores para multitarea:", e.message);
  }

  // Fallback si el LLM no devuelve un array válido: desglosar por comas / conectores comunes
  const rawParts = userMessage
    .split(/(?:,|\b\s+y\s+|\b\s+además\s+|\b\s+luego\s+|\n+)/i)
    .map(p => p.trim())
    .filter(p => p.length > 3);

  return rawParts.length > 0 ? rawParts : [userMessage];
}

/**
 * Genera una síntesis ejecutiva de una sola línea (con emoji de estado) para la tarea ejecutada.
 */
export async function formatTaskSummary(task: string, taskResult: string): Promise<string> {
  try {
    const summary = await llmService.chatWithoutTools([
      { role: "system", content: "Eres un asistente de resúmenes ejecutivo élite. Resume el resultado de la tarea del usuario en una sola frase de máximo 10 palabras que empiece con un emoji de éxito o estado (ej. ✅, 📁, 📬, 📅)." },
      { role: "user", content: `Tarea solicitada: "${task}"\n\nResultado obtenido:\n"${taskResult.substring(0, 500)}"\n\nGenera el resumen de una sola línea:` }
    ]);
    const cleanSummary = summary?.trim();
    if (cleanSummary) return cleanSummary;
  } catch {
    // Fallback silencioso
  }
  return `✅ **${task}**: Ejecutado correctamente.`;
}
