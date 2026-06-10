import { YoutubeTranscript } from "youtube-transcript";

/**
 * Obtiene la transcripción (subtítulos) de un video de YouTube dada su URL o ID.
 */
export async function youtubeGetTranscript(urlOrId: string): Promise<string> {
  try {
    console.log(`📥 Obteniendo transcripción de YouTube para: ${urlOrId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(urlOrId);
    
    if (!transcript || transcript.length === 0) {
      return "⚠️ No se encontraron subtítulos o transcripción disponible para este video.";
    }

    const fullText = transcript.map(t => t.text).join(" ");
    return `🎥 **Transcripción de YouTube:**\n\n${fullText}`;
  } catch (error: any) {
    console.error("Error en youtubeGetTranscript:", error);
    return `❌ Error al obtener la transcripción del video: ${error.message}`;
  }
}
