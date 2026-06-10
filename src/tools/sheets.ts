import { runGog } from "./gogWrapper.js";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function formatSheetsList(raw: any): string {
  const sheets: any[] = raw.sheets || raw.spreadsheets || (Array.isArray(raw) ? raw : []);
  if (!sheets || sheets.length === 0) return "📊 No se encontraron hojas de cálculo.";

  let out = `📊 **Hojas de Cálculo** (${sheets.length})\n${SEP}\n\n`;
  for (const s of sheets) {
    if (!s || !s.id) continue;
    const link = `https://docs.google.com/spreadsheets/d/${s.id}/edit`;
    out += `📊 **${s.name || s.title}**\n`;
    out += `└ 🆔 \`${s.id}\`\n`;
    out += `└ 🔗 [Abrir hoja](${link})\n\n`;
  }
  return out;
}

export const sheetsList = async () => {
  const result = await runGog("drive search --raw-query \"mimeType = 'application/vnd.google-apps.spreadsheet'\" --json");
  try {
    const parsed = JSON.parse(result);
    return formatSheetsList(parsed);
  } catch {
    return result;
  }
};

export const sheetsCreate = async (title: string) => {
  try {
    const result = await runGog(`sheets create "${title}" --json`);
    const parsed = JSON.parse(result);
    const sheet = parsed.spreadsheet || parsed;
    const link = `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`;
    
    return `✅ **HOJA DE CÁLCULO CREADA**\n${SEP}\n\n` +
           `📊 **Título:** ${sheet.title || title}\n` +
           `🆔 **ID:** ` + "`" + sheet.id + "`" + `\n` +
           `🔗 [Abrir Nueva Hoja](${link})\n\n` +
           `*Puedes empezar a escribir datos usando sheets_write.*`;
  } catch (error: any) {
    return `❌ **Error al crear la hoja de cálculo:** ${error.message}`;
  }
};

export const sheetsRead = async (spreadsheetId: string, range: string) => {
  try {
    const result = await runGog(`sheets get ${spreadsheetId} "${range}"`);
    if (!result || result.includes("error")) throw new Error(result);
    return `📊 **DATOS DE LA HOJA**\n${SEP}\n\n${result}`;
  } catch (error: any) {
    return `❌ **Error al leer la hoja:** ${error.message}`;
  }
};

export const sheetsWrite = async (spreadsheetId: string, range: string, values: string) => {
  // Convertir formato CSV (comas para celdas, nuevas líneas para filas) 
  // al formato de gog (pipes para celdas, comas para filas)
  const rows = values.split("\n").filter(r => r.trim() !== "");
  const formattedValues = rows.map(row => {
    if (row.includes("|")) return row;
    return row.split(",").join("|");
  }).join(",");

  try {
    const result = await runGog(`sheets update ${spreadsheetId} "${range}" "${formattedValues}"`);
    return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
           `📊 **ID:** ` + "`" + spreadsheetId + "`" + `\n` +
           `📍 **Rango:** ${range}\n\n` +
           `*Los datos han sido volcados en la hoja de cálculo.*`;
  } catch (error: any) {
    return `❌ **Error al escribir en la hoja:** ${error.message}`;
  }
};
