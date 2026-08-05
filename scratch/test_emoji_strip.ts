function cleanTextForTTS(text: string): string {
  let clean = text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, " abrir enlace ");
  clean = clean.replace(/[━─═─_-]{3,}/g, " ");
  // Strip emojis, symbols, and special dingbats
  clean = clean.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, " ");
  clean = clean.replace(/[*_#`\[\]()\-]/g, " ");
  clean = clean.replace(/(\d{1,2}):(\d{2})/g, "$1 y $2");
  return clean
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const testText = "🎥 **1. Creo un canal** [17:28]\n> 📅 Publicado: hace 1 a | 👀 Vistas: 680.360\n> 🔗 Enlace: https://youtube.com/watch?v=123\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ EVENTO CREADO.";
console.log("Original:\n", testText);
console.log("\nCleaned:\n", cleanTextForTTS(testText));
