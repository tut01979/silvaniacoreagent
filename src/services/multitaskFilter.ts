/**
 * Filtro determinista ultra-estricto para evaluar de forma local si un mensaje del usuario
 * requiere ser procesado como multitarea.
 */
export function shouldTriggerMultitask(message: string): boolean {
  if (!message || !message.trim()) return false;
  
  const lower = message.toLowerCase().trim();

  // 1. Descartar de inmediato si es una pregunta, explicación, opinión o profundización
  const infoRequestPatterns = /\b(qu[eé]\s+es|qu[eé]\s+opinas|qu[eé]\s+piensas|c[oó]mo\s+funciona|c[oó]mo\s+hacer|c[oó]mo\s+puedo|por\s+qu[eé]|expl[ií]came|explica|dame\s+una\s+explicaci[oó]n|cu[aá]l\s+es|cu[aá]les\s+son|qui[eé]n\s+es|d[oó]nde\s+queda|opini[oó]n|profundiza|analiza\s+y\s+dime|qu[eé]\s+crees|qu[eé]\s+d[ií]a|qu[eé]\s+hora|dime\s+qu[eé]|dime\s+c[oó]mo)\b/i;
  if (infoRequestPatterns.test(lower)) {
    return false;
  }

  // 2. Comprobar presencia de verbos de acción dirigidos a herramientas (se requieren al menos 2 acciones para justificar la multitarea)
  const actionPatterns = [
    /\b(crea|crear|dise[ñn]ar)\b/i,
    /\b(lista|listar|mostrar|ver)\b/i,
    /\b(busca|buscar|filtrar)\b/i,
    /\b(env[ií]a|enviar|mandar)\b/i,
    /\b(sube|subir|cargar)\b/i,
    /\b(mueve|mover|trasladar)\b/i,
    /\b(borra|borrar|eliminar)\b/i,
    /\b(programar|agenda|agendar|cita|evento|reunion|reunión)\b/i,
    /\b(transcribe|transcribir)\b/i
  ];

  let actionCount = 0;
  for (const pattern of actionPatterns) {
    if (pattern.test(lower)) {
      actionCount++;
    }
  }

  // Si no hay al menos 2 intenciones de acción distintas, no se justifica iniciar la multitarea
  if (actionCount < 2) {
    return false;
  }

  // 3. Evaluar los disparadores estrictos de multitarea:
  // Solo se divide si el usuario incluye listas numeradas o con viñetas físicas de al menos 2 elementos.
  const lines = message.split("\n").map(line => line.trim());
  let listItemsCount = 0;
  for (const line of lines) {
    if (/^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      listItemsCount++;
    }
  }
  if (listItemsCount >= 2) {
    return true;
  }

  // Frase explícita que denote independencia de tareas
  if (lower.includes("haz las siguientes tareas independientes") || lower.includes("ejecuta en paralelo")) {
    return true;
  }

  // En cualquier otro caso, procesar como una única instrucción integrada para evitar fragmentación artificial
  return false;
}
