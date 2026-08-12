import { runGog } from "./gogWrapper.js";
import { formatFolderLink } from "../services/linkFormatter.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function isValidSpreadsheetId(id?: string): boolean {
  if (!id || typeof id !== "string") return false;
  const clean = id.trim();
  if (clean.length < 20 || clean.length > 80) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) return false;

  // Detección de patrones repetidos (mismo bloque de 8+ caracteres repetido 3+ veces)
  for (let len = 8; len <= clean.length / 3; len++) {
    for (let i = 0; i <= clean.length - len * 3; i++) {
      const chunk = clean.substring(i, i + len);
      const rest = clean.substring(i + len);
      if (rest.startsWith(chunk + chunk) || rest.startsWith(chunk + "-" + chunk)) {
        return false;
      }
    }
  }

  return true;
}

function formatSheetsList(raw: any): string {
  const sheets: any[] = raw.sheets || raw.spreadsheets || (Array.isArray(raw) ? raw : []);
  if (!sheets || sheets.length === 0) return "📊 No se encontraron hojas de cálculo.";

  let out = `📊 **Hojas de Cálculo** (${sheets.length})\n${SEP}\n\n`;
  for (const s of sheets) {
    if (!s || (!s.id && !s.spreadsheetId)) continue;
    const sId = s.id || s.spreadsheetId;
    const sName = s.name || s.title || "Sin nombre";
    const link = `https://docs.google.com/spreadsheets/d/${sId}/edit`;
    
    out += `${formatFolderLink(sName, link)}\n`;
    out += `spreadsheetId: ${sId}\n\n`;
  }
  return out;
}

export const sheetsList = async (userId?: number) => {
  const result = await runGog("drive search --raw-query \"mimeType = 'application/vnd.google-apps.spreadsheet'\" --json", userId);
  try {
    const parsed = JSON.parse(result);
    return formatSheetsList(parsed);
  } catch {
    return result;
  }
};

export const sheetsCreate = async (title: string, userId?: number) => {
  try {
    const result = await runGog(`sheets create "${title}" --json`, userId);
    const parsed = JSON.parse(result);
    const sheet = parsed.spreadsheet || parsed;
    const id = sheet.spreadsheetId || sheet.id;
    if (!id) {
      throw new Error(`No se pudo obtener el ID de la hoja de cálculo. Respuesta: ${result}`);
    }
    const link = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    const cleanTitle = sheet.title || sheet.properties?.title || title;
    const linkStr = formatFolderLink(cleanTitle, link);
    
    return `✅ **HOJA DE CÁLCULO CREADA**\n${SEP}\n\n` +
           `${linkStr}\n` +
           `ID: ${id}\n` +
           `spreadsheetId: ${id}\n\n` +
           `*Puedes empezar a escribir datos usando sheets_write.*`;
  } catch (error: any) {
    return `❌ **Error al crear la hoja de cálculo:** ${error.message}`;
  }
};

export const sheetsRead = async (spreadsheetId: string, range: string, userId?: number) => {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    return `❌ Error: spreadsheet_id inválido o alucinado.`;
  }
  try {
    const result = await runGog(`sheets get ${spreadsheetId} "${range}"`, userId);
    if (!result || result.includes("error")) throw new Error(result);
    return `📊 **DATOS DE LA HOJA**\n${SEP}\n\n${result}`;
  } catch (error: any) {
    if (range.includes("!")) {
      const fallbackRange = range.split("!").pop() || range;
      console.log(`⚠️ Falló sheets get con rango ${range}. Reintentando con rango simplificado ${fallbackRange}...`);
      try {
        const result = await runGog(`sheets get ${spreadsheetId} "${fallbackRange}"`, userId);
        if (!result || result.includes("error")) throw new Error(result);
        return `📊 **DATOS DE LA HOJA**\n${SEP}\n\n${result} *(fallback de rango aplicado)*`;
      } catch (fallbackErr: any) {
        return `❌ **Error al leer la hoja:** ${fallbackErr.message}`;
      }
    }
    return `❌ **Error al leer la hoja:** ${error.message}`;
  }
};

export const sheetsWrite = async (spreadsheetId: string, range: string, values: string | any[][], userId?: number) => {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    return `❌ Error: spreadsheet_id inválido o alucinado.`;
  }
  let matrix: any[][];

  if (Array.isArray(values)) {
    matrix = values.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => {
          if (cell === null || cell === undefined) return "";
          const trimmed = String(cell).trim();
          if (trimmed !== "" && !isNaN(Number(trimmed))) {
            return Number(trimmed);
          }
          return trimmed;
        });
      }
      const trimmed = String(row).trim();
      if (trimmed !== "" && !isNaN(Number(trimmed))) {
        return [Number(trimmed)];
      }
      return [trimmed];
    });
  } else {
    const processedValues = String(values).replace(/0,21/g, "21%").replace(/0\.21/g, "21%");
    const rows = processedValues.split("\n").filter(r => r.trim() !== "");
    matrix = rows.map(row => {
      const separator = row.includes("|") ? "|" : ",";
      return row.split(separator).map(cell => {
        const trimmed = cell.trim();
        if (trimmed !== "" && !isNaN(Number(trimmed))) {
          return Number(trimmed);
        }
        return trimmed;
      });
    });
  }

  const jsonVal = JSON.stringify(matrix);

  try {
    const result = await runGog(`sheets update ${spreadsheetId} "${range}" --values-json '${jsonVal}' --input USER_ENTERED`, userId);
    return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
           `📊 **ID:** ` + "`" + spreadsheetId + "`" + `\n` +
           `📍 **Rango:** ${range}\n\n` +
           `*Los datos han sido volcados en la hoja de cálculo.*`;
  } catch (error: any) {
    if (range.includes("!")) {
      const fallbackRange = range.split("!").pop() || range;
      console.log(`⚠️ Falló sheets update con rango ${range}. Reintentando con rango simplificado ${fallbackRange}...`);
      try {
        const result = await runGog(`sheets update ${spreadsheetId} "${fallbackRange}" --values-json '${jsonVal}' --input USER_ENTERED`, userId);
        return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
               `📊 **ID:** ` + "`" + spreadsheetId + "`" + `\n` +
               `📍 **Rango:** ${fallbackRange}\n\n` +
               `*Los datos han sido volcados en la hoja de cálculo (fallback de rango aplicado).*`;
      } catch (fallbackErr: any) {
        return `❌ **Error al escribir en la hoja:** ${fallbackErr.message}`;
      }
    }
    return `❌ **Error al escribir en la hoja:** ${error.message}`;
  }
};
