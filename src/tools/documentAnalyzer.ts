import { runGog } from "./gogWrapper.js";
import { llmService } from "../services/llm.js";
import { config } from "../config/config.js";
import { userContextStore } from "../services/context.js";
import fs from "fs";
import path from "path";

/**
 * Descarga y analiza un documento en Drive (PDF, TXT, CSV, JSON, MD) usando google/gemini-2.5-flash.
 */
export async function analyzeDocument({ file_id, prompt, userId }: { file_id: string; prompt?: string; userId?: number }): Promise<string> {
  const uId = userId || userContextStore.getStore()?.userId;
  if (!uId) return "❌ Error: Usuario no identificado.";

  const tempName = `doc_${Date.now()}`;
  const tempPath = path.join(process.cwd(), "temp", tempName);
  
  if (!fs.existsSync(path.join(process.cwd(), "temp"))) {
    fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true });
  }

  try {
    console.log(`📥 [Document Analyzer] Intentando descargar archivo de Drive ${file_id}...`);
    
    const metaRaw = await runGog(`drive get ${file_id} --json`, uId);
    const meta = JSON.parse(metaRaw);
    const mimeType = meta.mimeType || meta.file?.mimeType || "";
    const name = meta.name || meta.file?.name || "documento";
    
    let downloadPath = tempPath;
    const isGoogleDoc = mimeType.startsWith("application/vnd.google-apps.");
    
    if (isGoogleDoc) {
      downloadPath = tempPath + ".txt";
      await runGog(`drive download ${file_id} --format=txt --out="${downloadPath}"`, uId);
    } else {
      downloadPath = tempPath + (name.includes(".") ? path.extname(name) : "");
      await runGog(`drive download ${file_id} --out="${downloadPath}"`, uId);
    }

    if (!fs.existsSync(downloadPath)) {
      throw new Error("No se pudo descargar el archivo.");
    }

    let textContent = "";
    const extension = path.extname(downloadPath).toLowerCase();
    
    if ([".txt", ".csv", ".json", ".md"].includes(extension)) {
      textContent = fs.readFileSync(downloadPath, "utf-8");
    } else if (extension === ".pdf") {
      try {
        const pdfParseModule = (await import("pdf-parse")) as any;
        const dataBuffer = fs.readFileSync(downloadPath);
        const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();
        textContent = textResult.text || "El PDF no contiene texto extraíble.";
        await parser.destroy();
      } catch (pdfErr: any) {
        console.error("Error parseando PDF en analyzeDocument:", pdfErr.message);
        textContent = `[PDF text extraction error: ${pdfErr.message}]`;
      }
    } else {
      textContent = `[Contenido no legible directamente para el formato '${mimeType || extension}'].`;
    }

    // Limpiar archivo descargado
    try { if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath); } catch {}

    console.log(`🤖 [Document Analyzer] Enviando contenido del documento a Gemini-2.5-Flash...`);
    const analysisPrompt = prompt || "Analiza el siguiente documento y resume su contenido de forma detallada.";
    
    const systemInstruction = "Eres un analista de documentos élite de Silvania. Tu tarea es analizar detalladamente el contenido de texto provisto y responder a las preguntas o generar un resumen profesional según el prompt.";
    
    const messages = [
      { role: "system", content: systemInstruction },
      { role: "user", content: `${analysisPrompt}\n\n--- CONTENIDO DEL DOCUMENTO ---\n${textContent.substring(0, 15000)}` }
    ];

    // Llamar a OpenRouter forzando el modelo google/gemini-2.5-flash
    const response = await llmService.chatWithoutTools(messages, config.llm.openRouterVisionModel);
    
    return `📄 **Análisis de Documento "${name}" (ID: ${file_id}) por Gemini 2.5:**\n\n${response}`;
  } catch (error: any) {
    try {
      const files = fs.readdirSync(path.join(process.cwd(), "temp"));
      for (const file of files) {
        if (file.startsWith(tempName)) {
          fs.unlinkSync(path.join(process.cwd(), "temp", file));
        }
      }
    } catch {}
    console.error("Error en analyzeDocument:", error.message);
    return `❌ Error al analizar el documento de Drive: ${error.message}`;
  }
}
