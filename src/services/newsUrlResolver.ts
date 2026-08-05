// @ts-ignore
import pkg from "google-news-url-decoder";
const { GoogleDecoder } = pkg;

const decoder = new GoogleDecoder();

/**
 * Resuelve y limpia la URL final de una noticia de Google News RSS.
 */
export async function resolveAndCleanNewsUrl(googleNewsUrl: string): Promise<string> {
  let targetUrl = googleNewsUrl;

  try {
    const res = await decoder.decode(googleNewsUrl);
    if (res && res.status && res.decoded_url) {
      targetUrl = res.decoded_url;
    }
  } catch (err: any) {
    console.warn("⚠️ Falló decodificación de Google News URL:", err.message);
  }

  // Limpiar y validar la URL
  try {
    const url = new URL(targetUrl);
    
    // Eliminar parámetros de tracking comunes
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'oc', 'fbclid', 'gclid', 'msclkid'
    ];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }
    
    return url.toString();
  } catch {
    return targetUrl;
  }
}
