// Test script to validate sanitizeAlucinatedLinks
import { runAgent } from "../src/agent/agent.js";
import fs from "fs";
import path from "path";

// Vamos a exportar o usar la función del archivo compilado usando require o import dinámico
async function testSanitizer() {
  console.log("=== INICIANDO PRUEBAS DE SANITIZADOR DE ENLACES ===");
  
  // Como sanitizeAlucinatedLinks es una función privada de agent.ts, podemos probar su lógica de regex
  // o importar dinámicamente y evaluarla usando una simulación.
  // Replicamos la lógica exacta de la función aquí para verificar su comportamiento teórico primero.
  
  function simulateSanitize(responseText: string, toolResults: string[]): string {
    const validIds = new Set<string>();
    const idRegex = /\b([a-zA-Z0-9_-]{19,55})\b/g;

    for (const content of toolResults) {
      let match;
      idRegex.lastIndex = 0;
      while ((match = idRegex.exec(content)) !== null) {
        validIds.add(match[1]);
      }
    }

    const driveLinkRegex = /(https?:\/\/(?:docs|drive)\.google\.com\/(?:spreadsheets|file|document|drive\/folders)\/[^\s)\]]+)/gi;
    let sanitizedText = responseText;
    const linksFound = responseText.match(driveLinkRegex) || [];

    for (const link of linksFound) {
      let linkId = "";
      const dMatch = link.match(/\/d\/([a-zA-Z0-9_-]{19,55})/i);
      const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]{19,55})/i);

      if (dMatch) {
        linkId = dMatch[1];
      } else if (folderMatch) {
        linkId = folderMatch[1];
      }

      if (linkId) {
        if (!validIds.has(linkId)) {
          sanitizedText = sanitizedText.replace(link, "[Enlace no disponible - creación no ejecutada o fallida]");
        }
      }
    }

    return sanitizedText;
  }

  const toolOutputs = [
    "✅ Archivo creado con ID: 1owG1DBkgAxYth3WZGgAbpMH1Eis97vGu",
    "spreadsheetId: 1DitnECgAHf7XTK4S7JucRLHavuLjwvXA"
  ];

  const assistantResponse = 
    "He creado los siguientes recursos:\n" +
    "1. Documento válido: https://drive.google.com/file/d/1owG1DBkgAxYth3WZGgAbpMH1Eis97vGu/view\n" +
    "2. Sheet válida: https://docs.google.com/spreadsheets/d/1DitnECgAHf7XTK4S7JucRLHavuLjwvXA/edit\n" +
    "3. Documento ALUCINADO: https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view\n" +
    "4. Carpeta ALUCINADA: https://drive.google.com/drive/folders/1FolderIdAlucinated";

  const sanitized = simulateSanitize(assistantResponse, toolOutputs);
  console.log("-> Texto Sanitizado:\n", sanitized);

  const hasValid1 = sanitized.includes("https://drive.google.com/file/d/1owG1DBkgAxYth3WZGgAbpMH1Eis97vGu/view");
  const hasValid2 = sanitized.includes("https://docs.google.com/spreadsheets/d/1DitnECgAHf7XTK4S7JucRLHavuLjwvXA/edit");
  const hasAlucinatedDocRemoved = !sanitized.includes("1A2B3C4D5E6F7G8H9I0J");
  const hasAlucinatedFolderRemoved = !sanitized.includes("1FolderIdAlucinated");

  console.log(`-> Enlace válido 1 intacto: ${hasValid1 ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Enlace válido 2 intacto: ${hasValid2 ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Enlace alucinado 1 removido: ${hasAlucinatedDocRemoved ? "✅ PASÓ" : "❌ FALLÓ"}`);
  console.log(`-> Enlace alucinado 2 removido: ${hasAlucinatedFolderRemoved ? "✅ PASÓ" : "❌ FALLÓ"}`);

  if (hasValid1 && hasValid2 && hasAlucinatedDocRemoved && hasAlucinatedFolderRemoved) {
    console.log("\n✅ TODAS LAS PRUEBAS DEL SANITIZADOR DE ENLACES PASARON CON ÉXITO.");
  } else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
  }
}

testSanitizer();
