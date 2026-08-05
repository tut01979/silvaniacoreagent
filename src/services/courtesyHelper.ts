/**
 * Centraliza la verificación de saludos y cortesías simples
 * para dar respuestas ultra-rápidas sin invocar el LLM.
 */
export function checkCourtesyGreeting(text: string): string | null {
  if (!text) return null;
  
  const cleanTextLower = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿]/g, "");
  const words = cleanTextLower.split(/\s+/).filter(w => w.length > 0);
  
  const courtesyGreetings = [
    "gracias", "muchas gracias", "excelente", "perfecto", "genial", 
    "de nada", "ok", "listo", "entendido", "buenísimo", 
    "buenisimo", "de acuerdo", "bien", "muy bien"
  ];
  
  if (words.length <= 2 && courtesyGreetings.includes(cleanTextLower)) {
    return "De nada, ¿en qué más puedo ayudarte?";
  }
  
  return null;
}
