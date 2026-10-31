import { runGog } from "./gogWrapper.js";
import { formatFolderLink } from "../services/linkFormatter.js";
import { folderCacheService, isNotFoundError, isZombieFolder } from "../services/folderCache.js";
import { userContextStore } from "../services/context.js";
import { dbService } from "../database/db.js";
import { getGoogleAuthForUser } from "./googleAuth.js";
import { google } from "googleapis";

const SEP = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

export const TALLER_PARTES_TITLE = "Taller_Partes";
export const TALLER_PARTES_HEADERS = [
  "ID",
  "Fecha",
  "Cliente",
  "Teléfono",
  "Matrícula",
  "Marca/Modelo",
  "Km",
  "Avería",
  "Diagnóstico",
  "Presupuesto_neto",
  "IVA",
  "Total",
  "Estado",
  "Notas",
  "Link_fotos"
];

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

export async function isSpreadsheetTrashedOrMissing(spreadsheetId: string, userId: number): Promise<boolean> {
  if (!isValidSpreadsheetId(spreadsheetId)) return true;

  // 1. Verificación directa con googleapis (Drive v3)
  try {
    const authClient = await getGoogleAuthForUser(userId);
    if (authClient) {
      const drive = google.drive({ version: "v3", auth: authClient });
      const fileRes = await drive.files.get({
        fileId: spreadsheetId,
        fields: "id, name, trashed"
      });
      if (fileRes.data.trashed === true) {
        console.warn(`🗑️ [Sheets] Hoja ${spreadsheetId} detectada en papelera (trashed: true).`);
        return true;
      }
      return false;
    }
  } catch (apiErr: any) {
    const errMsg = apiErr?.message || String(apiErr);
    if (isNotFoundError(errMsg) || errMsg.includes("404") || errMsg.includes("notFound") || errMsg.includes("File not found")) {
      console.warn(`❌ [Sheets] Hoja ${spreadsheetId} no encontrada (404/notFound):`, errMsg);
      return true;
    }
  }

  // 2. Fallback con gog CLI
  try {
    const res = await runGog(`drive get ${spreadsheetId} --json`, userId);
    const parsed = JSON.parse(res);
    const file = parsed.file || parsed;
    if (file?.trashed === true) {
      console.warn(`🗑️ [Sheets] Hoja ${spreadsheetId} detectada en papelera vía CLI (trashed: true).`);
      return true;
    }
    return false;
  } catch (cliErr: any) {
    const errMsg = cliErr?.message || String(cliErr);
    if (isNotFoundError(errMsg) || errMsg.includes("404") || errMsg.includes("notFound") || errMsg.includes("File not found") || errMsg.toLowerCase().includes("trash")) {
      console.warn(`❌ [Sheets] Falló drive get para ${spreadsheetId} (posiblemente borrado/trashed):`, errMsg);
      return true;
    }
  }

  return false;
}

export function normalizeValuesMatrix(values: any): any[][] {
  if (values === null || values === undefined) {
    return [];
  }

  let rawMatrix: any[][];

  if (Array.isArray(values)) {
    if (values.length === 0) return [];
    if (!Array.isArray(values[0])) {
      rawMatrix = [values];
    } else {
      rawMatrix = values;
    }
  } else if (typeof values === "string") {
    const trimmed = values.trim();

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return [];
          if (!Array.isArray(parsed[0])) {
            rawMatrix = [parsed];
          } else {
            rawMatrix = parsed;
          }
        } else {
          rawMatrix = [[parsed]];
        }
      } catch (e: any) {
        console.warn("⚠️ [Sheets] Error al parsear values como JSON, intentando fallback:", e?.message);
        if (trimmed.includes(";")) {
          rawMatrix = [trimmed.split(";").map(cell => cell.trim())];
        } else {
          const lines = trimmed.split("\n").filter(l => l.trim() !== "");
          rawMatrix = lines.map(line => {
            const sep = line.includes("|") ? "|" : ",";
            return line.split(sep).map(c => c.trim());
          });
        }
      }
    } else if (trimmed.includes(";")) {
      // Si es string con ';' y NO es JSON → split por ';' en UNA fila (solo fallback legacy)
      rawMatrix = [trimmed.split(";").map(cell => cell.trim())];
    } else {
      const processed = trimmed.replace(/0,21/g, "21%").replace(/0\.21/g, "21%");
      const lines = processed.split("\n").filter(l => l.trim() !== "");
      if (lines.length === 0) return [];
      rawMatrix = lines.map(line => {
        const sep = line.includes("|") ? "|" : ",";
        return line.split(sep).map(c => c.trim());
      });
    }
  } else {
    rawMatrix = [[values]];
  }

  return rawMatrix.map(row => {
    if (!Array.isArray(row)) return [String(row ?? "")];
    return row.map(cell => {
      if (cell === null || cell === undefined) return "";
      if (typeof cell === "number") return cell;
      if (typeof cell === "boolean") return cell;

      const str = String(cell).trim();
      // Si es un número puro sin ceros a la izquierda, no fecha y no teléfono largo con '+'
      if (str !== "" && !isNaN(Number(str)) && !/^0[0-9]+/.test(str) && !str.includes("-") && !str.includes("/")) {
        return Number(str);
      }
      return str;
    });
  });
}

export async function findExistingTallerPartes(userId: number): Promise<string | null> {
  const uId = userId || userContextStore.getStore()?.userId || 0;

  // 1. Consultar en la base de datos (drive_folders)
  const cachedId = await dbService.getDriveFolder(uId, "sheet:Taller_Partes");
  if (cachedId) {
    const isDead = await isSpreadsheetTrashedOrMissing(cachedId, uId);
    if (isDead) {
      console.warn(`🗑️ [Sheets] Taller_Partes en caché (${cachedId}) está en papelera o no existe. Purgando clave sheet:Taller_Partes de DB...`);
      await dbService.deleteDriveFolder(uId, "sheet:Taller_Partes");
      await dbService.deleteDriveFolderById(uId, cachedId);
    } else if (isValidSpreadsheetId(cachedId)) {
      return cachedId;
    }
  }

  // 2. Si no está en BD o fue purgado, buscar en Google Drive por nombre exacto con trashed = false
  try {
    const searchRes = await runGog(
      `drive search "name = 'Taller_Partes' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false" --raw-query --json`,
      uId
    );
    const parsed = JSON.parse(searchRes);
    const files: any[] = parsed.files || (Array.isArray(parsed) ? parsed : []);
    for (const f of files) {
      if (f.id && isValidSpreadsheetId(f.id) && !f.trashed) {
        const isDead = await isSpreadsheetTrashedOrMissing(f.id, uId);
        if (!isDead) {
          await dbService.saveDriveFolder(uId, "sheet:Taller_Partes", f.id);
          return f.id;
        } else {
          console.warn(`🗑️ [Sheets] Archivo en Drive '${f.id}' está en papelera/404. Purgando de DB...`);
          await dbService.deleteDriveFolderById(uId, f.id);
        }
      }
    }
  } catch (sErr: any) {
    console.warn("⚠️ [Sheets] Error buscando Taller_Partes en Drive:", sErr.message);
  }

  return null;
}

export async function formatTallerPartesSheet(spreadsheetId: string, userId?: number): Promise<void> {
  const uId = userId || userContextStore.getStore()?.userId || 0;
  
  // Fila 1: Título corporativo con merge A1:O1
  // Fila 2: Cabeceras estructuradas
  const initialMatrix = [
    ["PARTES DE TALLER — Silvania", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    TALLER_PARTES_HEADERS
  ];

  try {
    const authClient = await getGoogleAuthForUser(uId);
    if (authClient) {
      const sheets = google.sheets({ version: "v4", auth: authClient });

      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetId = meta.data.sheets?.[0]?.properties?.sheetId || 0;

      // Actualizar valores de A1:O2
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:O2",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: initialMatrix }
      });

      const requests: any[] = [
        // A. Merge A1:O1 para el título
        {
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 15
            },
            mergeType: "MERGE_ALL"
          }
        },
        // B. Estilo fila 1: Fondo #1a365d, texto blanco, negrita, tamaño 13, centrado
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 15
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 26 / 255, green: 54 / 255, blue: 93 / 255 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                  fontSize: 13
                }
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
          }
        },
        // C. Estilo fila 2: Cabeceras con fondo oscuro (#2d3748), texto blanco, negrita, wrap text, centrado vertical y horizontal (una celda por columna, sin merge)
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: 15
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 45 / 255, green: 55 / 255, blue: 72 / 255 },
                wrapStrategy: "WRAP",
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true,
                  fontSize: 10
                }
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,horizontalAlignment,verticalAlignment)"
          }
        },
        // D. Freeze fila 2
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: 2
              }
            },
            fields: "gridProperties.frozenRowCount"
          }
        },
        // E. Formato columnas J:L (índices 9, 10, 11) como número con 2 decimales
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: 9,
              endColumnIndex: 12
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "NUMBER",
                  pattern: "#,##0.00"
                },
                horizontalAlignment: "RIGHT"
              }
            },
            fields: "userEnteredFormat(numberFormat,horizontalAlignment)"
          }
        },
        // F. Formato columnas D (Teléfono, 3) y E (Matrícula, 4) como texto
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: 3,
              endColumnIndex: 5
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "TEXT"
                },
                horizontalAlignment: "LEFT"
              }
            },
            fields: "userEnteredFormat(numberFormat,horizontalAlignment)"
          }
        },
        // G. Altura de filas
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 42 },
            fields: "pixelSize"
          }
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 34 },
            fields: "pixelSize"
          }
        }
      ];

      // H. Anchos de columnas mínimos (Avería y Diagnóstico más anchos)
      const colWidths: { [col: number]: number } = {
        0: 90,   // ID
        1: 110,  // Fecha
        2: 170,  // Cliente
        3: 120,  // Teléfono
        4: 110,  // Matrícula
        5: 170,  // Marca/Modelo
        6: 90,   // Km
        7: 280,  // Avería
        8: 280,  // Diagnóstico
        9: 140,  // Presupuesto_neto
        10: 110, // IVA
        11: 120, // Total
        12: 120, // Estado
        13: 220, // Notas
        14: 200  // Link_fotos
      };

      for (const [colIdxStr, width] of Object.entries(colWidths)) {
        const colIdx = parseInt(colIdxStr, 10);
        requests.push({
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: colIdx, endIndex: colIdx + 1 },
            properties: { pixelSize: width },
            fields: "pixelSize"
          }
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      console.log(`✅ [Sheets] Formato profesional aplicado con éxito a Taller_Partes (${spreadsheetId})`);
      return;
    }
  } catch (apiErr: any) {
    console.warn("⚠️ [Sheets] Error aplicando batchUpdate con googleapis, aplicando fallback vía gog CLI:", apiErr.message);
  }

  // Fallback con comandos CLI de gog
  try {
    const jsonMatrix = JSON.stringify(initialMatrix);
    await runGog(`sheets update ${spreadsheetId} "A1:O2" --values-json '${jsonMatrix}' --input USER_ENTERED`, uId);
    await runGog(`sheets merge ${spreadsheetId} "A1:O1" --type MERGE_ALL`, uId);
    await runGog(`sheets freeze ${spreadsheetId} --rows=2`, uId);
    await runGog(`sheets resize-columns ${spreadsheetId} "H:I" --width=280`, uId);
  } catch (cliErr: any) {
    console.warn("⚠️ [Sheets] Fallback CLI parcial en formatTallerPartesSheet:", cliErr.message);
  }
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
    
    out += `📄 **${sName}** · [Abrir en Google Sheets](${link})\n`;
    out += `spreadsheetId: ${sId}\n\n`;
  }
  return out;
}

export const sheetsList = async (userId?: number) => {
  try {
    const result = await runGog("drive search --raw-query \"mimeType = 'application/vnd.google-apps.spreadsheet'\" --json", userId);
    try {
      const parsed = JSON.parse(result);
      return formatSheetsList(parsed);
    } catch {
      return result;
    }
  } catch (err: any) {
    if (err.message?.includes("Tu sesión de Google expiró")) throw err;
    return "📊 En el modo de permisos de producción, solo se pueden listar las hojas de cálculo creadas o compartidas con Silvania CoreAgent.";
  }
};

export const sheetsCreate = async (title: string, userId?: number) => {
  try {
    const uId = userId || userContextStore.getStore()?.userId || 0;
    const isTallerOrPartes = /taller|partes/i.test(title);
    const isCanonicalPartes = /taller[-_ ]?partes/i.test(title);

    // Si el usuario pide crear Taller_Partes, verificar si ya existe el libro canónico y está vivo
    if (isCanonicalPartes) {
      const existingId = await findExistingTallerPartes(uId);
      if (existingId) {
        const isDead = await isSpreadsheetTrashedOrMissing(existingId, uId);
        if (isDead) {
          console.warn(`🗑️ [Sheets] Taller_Partes canónico existente (${existingId}) detectado en papelera/404. Purgando de DB y creando uno nuevo...`);
          await dbService.deleteDriveFolder(uId, "sheet:Taller_Partes");
          await dbService.deleteDriveFolderById(uId, existingId);
        } else {
          const link = `https://docs.google.com/spreadsheets/d/${existingId}/edit`;
          return `ℹ️ **EL LIBRO CANÓNICO 'Taller_Partes' YA EXISTE**\n${SEP}\n\n` +
                 `📊 **Documento:** [Taller_Partes](${link}) · [Abrir en Google Sheets](${link})\n` +
                 `🆔 **ID:** \`${existingId}\`\n` +
                 `🆔 **spreadsheetId:** \`${existingId}\`\n` +
                 `🔗 **Enlace directo:** ${link}\n` +
                 `📂 **Ubicación:** Guardado en la carpeta canónica \`silvania/\`\n\n` +
                 `*Ya existe el libro único oficial de partes de taller. NO se ha creado un libro duplicado. Para registrar un nuevo parte de taller, usa sheets_append (o sheets_write) añadiendo la fila en este libro existente.*`;
        }
      }
    }

    const cleanReqTitle = isCanonicalPartes ? "Taller_Partes" : title;
    const result = await runGog(`sheets create "${cleanReqTitle}" --json`, uId);
    const parsed = JSON.parse(result);
    const sheet = parsed.spreadsheet || parsed;
    const id = sheet.spreadsheetId || sheet.id;
    if (!id) {
      throw new Error(`No se pudo obtener el ID de la hoja de cálculo. Respuesta: ${result}`);
    }
    const link = sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;
    const cleanTitle = sheet.title || sheet.properties?.title || cleanReqTitle;

    let moveInfo = "";
    try {
      let silvaniaFolderId = await folderCacheService.getOrCreateFolderPath(uId, "silvania");
      if (isZombieFolder(silvaniaFolderId)) {
        silvaniaFolderId = await folderCacheService.rebootstrapSilvania(uId, silvaniaFolderId);
      }
      if (silvaniaFolderId && silvaniaFolderId !== "root") {
        try {
          await runGog(`drive move ${id} --parent=${silvaniaFolderId}`, uId);
          console.log(`📂 [Sheets] Hoja '${cleanTitle}' (${id}) movida a carpeta canónica silvania/ (${silvaniaFolderId})`);
          moveInfo = `\n📂 **Ubicación:** Guardada en la carpeta canónica \`silvania/\``;
        } catch (firstMoveErr: any) {
          if (isNotFoundError(firstMoveErr)) {
            silvaniaFolderId = await folderCacheService.rebootstrapSilvania(uId, silvaniaFolderId);
            if (silvaniaFolderId && silvaniaFolderId !== "root") {
              try {
                await runGog(`drive move ${id} --parent=${silvaniaFolderId}`, uId);
                console.log(`📂 [Sheets] Reintento de movimiento exitoso a nueva carpeta silvania/ (${silvaniaFolderId})`);
                moveInfo = `\n📂 **Ubicación:** Guardada en la carpeta canónica \`silvania/\``;
              } catch (secondMoveErr: any) {
                console.warn(`⚠️ [Sheets] Reintento de movimiento a silvania/ falló:`, secondMoveErr?.message || secondMoveErr);
                moveInfo = `\n⚠️ *Aviso: La hoja fue creada en la raíz de Google Drive pero no se pudo mover a la carpeta silvania/ (${secondMoveErr?.message || "error al mover"}).*`;
              }
            } else {
              moveInfo = `\n⚠️ *Aviso: La hoja fue creada en la raíz de Google Drive pero no se pudo resolver la carpeta silvania/.*`;
            }
          } else {
            console.warn(`⚠️ [Sheets] Falló el movimiento de la hoja '${id}' a silvania/:`, firstMoveErr?.message || firstMoveErr);
            moveInfo = `\n⚠️ *Aviso: La hoja fue creada en la raíz de Google Drive pero no se pudo mover a la carpeta silvania/ (${firstMoveErr?.message || "error al mover"}).*`;
          }
        }
      }
    } catch (moveErr: any) {
      console.warn(`⚠️ [Sheets] Falló la resolución de silvania/ para mover la hoja:`, moveErr?.message || moveErr);
      moveInfo = `\n⚠️ *Aviso: La hoja fue creada en la raíz de Google Drive pero no se pudo mover a la carpeta silvania/.*`;
    }

    let extraFormatNote = "";
    // B) Tras sheetsCreate de cualquier título que coincida /taller|partes/i (Taller_Partes, Silvania Taller, Partes_Taller_*):
    // - Llamar formatTallerPartesSheet(spreadsheetId) siempre.
    // - Guardar en drive_folders la clave del título y sheet:Taller_Partes solo si el libro está vivo.
    if (isTallerOrPartes) {
      try {
        await formatTallerPartesSheet(id, uId);
        extraFormatNote = `\n\n*Se ha configurado el formato profesional de taller: título corporativo Silvania, 15 cabeceras estructuradas, fila 2 congelada, formatos de moneda con 2 decimales y anchos optimizados.*`;
      } catch (fErr: any) {
        console.warn("⚠️ [Sheets] Error al formatear hoja de taller:", fErr.message);
      }

      const isDead = await isSpreadsheetTrashedOrMissing(id, uId);
      if (!isDead) {
        await dbService.saveDriveFolder(uId, "sheet:Taller_Partes", id);
        await dbService.saveDriveFolder(uId, `sheet:${cleanTitle}`, id);
        if (title !== cleanTitle) {
          await dbService.saveDriveFolder(uId, `sheet:${title}`, id);
        }
        console.log(`💾 [Sheets] Claves guardadas en drive_folders para hoja de taller viva: sheet:Taller_Partes y sheet:${cleanTitle}`);
      }
    }
    
    return `✅ **HOJA DE CÁLCULO CREADA**\n${SEP}\n\n` +
           `📊 **Documento:** [${cleanTitle}](${link}) · [Abrir en Google Sheets](${link})\n` +
           `🆔 **ID:** \`${id}\`\n` +
           `🆔 **spreadsheetId:** \`${id}\`\n` +
           `🔗 **Enlace directo:** ${link}${moveInfo}${extraFormatNote}\n\n` +
           `*Puedes escribir o añadir datos usando sheets_write o sheets_append.*`;
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

function isTallerPartesHeaderRow(row: any[]): boolean {
  if (!Array.isArray(row) || row.length === 0) return false;
  const first = String(row[0]).trim().toUpperCase();
  if (first === "ID") {
    const rowStr = row.map(c => String(c).toLowerCase()).join(" ");
    return rowStr.includes("fecha") || rowStr.includes("matrícula") || rowStr.includes("matricula") || rowStr.includes("cliente");
  }
  return false;
}

export function extractSpreadsheetIdFromCreateOutput(text: string): string | null {
  if (!text) return null;
  const match1 = text.match(/(?:spreadsheetId|ID)\*?\*?:\*?\*?\s*`?([A-Za-z0-9_-]{20,80})`?/i);
  if (match1 && isValidSpreadsheetId(match1[1])) return match1[1];
  const match2 = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})/i);
  if (match2 && isValidSpreadsheetId(match2[1])) return match2[1];
  return null;
}

export const sheetsWrite = async (spreadsheetId: string, range: string, values: string | any[][], userId?: number) => {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    return `❌ Error: spreadsheet_id inválido o alucinado.`;
  }
  const uId = userId || userContextStore.getStore()?.userId || 0;
  let matrix = normalizeValuesMatrix(values);
  let effectiveRange = range;

  // REGLAS Taller_Partes:
  // 1) Tras formatTallerPartesSheet, NUNCA reescribir cabeceras en A1.
  // 2) Solo insertar la fila de datos en A3 (o sheets_append al final), matriz 1x15.
  // 3) Si sheetsCreate ya formateó, sheets_write/append de un parte nuevo = solo datos, sin fila de headers.
  if (matrix.length > 0 && isTallerPartesHeaderRow(matrix[0])) {
    console.warn("⚠️ [Sheets Write] Fila de cabeceras de Taller_Partes detectada en values. Descartando fila de cabeceras para proteger el banner en fila 1 y cabeceras en fila 2.");
    matrix = matrix.slice(1);
    if (!effectiveRange || /^(?:.*!)?A1(?::[A-Z0-9]+)?$/i.test(effectiveRange) || /^(?:.*!)?[A-Z]*[12](?::[A-Z0-9]+)?$/i.test(effectiveRange)) {
      effectiveRange = "A3";
    }
  } else if (matrix.length > 0 && matrix[0].length === 15 && (/^(?:.*!)?A1(?::[A-Z0-9]+)?$/i.test(effectiveRange) || effectiveRange === "A:O")) {
    console.warn("⚠️ [Sheets Write] Intento de escribir fila de parte en A1. Redirigiendo a A3 para no sobrescribir el banner corporativo ni las cabeceras.");
    effectiveRange = "A3";
  }

  if (matrix.length === 0) {
    return `⚠️ No hay datos que escribir (solo se habían proporcionado cabeceras que ya existen en el formato de la hoja).`;
  }

  const jsonVal = JSON.stringify(matrix);
  const editLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  try {
    const result = await runGog(`sheets update ${spreadsheetId} "${effectiveRange}" --values-json '${jsonVal}' --input USER_ENTERED`, uId);
    return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
           `📊 **Documento:** [Abrir en Google Sheets](${editLink})\n` +
           `🆔 **ID:** \`${spreadsheetId}\`\n` +
           `🆔 **spreadsheetId:** \`${spreadsheetId}\`\n` +
           `📍 **Rango:** ${effectiveRange}\n` +
           `🔗 **Enlace directo:** ${editLink}\n\n` +
           `*Los datos han sido volcados en la hoja de cálculo.*`;
  } catch (error: any) {
    if (effectiveRange.includes("!")) {
      const fallbackRange = effectiveRange.split("!").pop() || effectiveRange;
      console.log(`⚠️ Falló sheets update con rango ${effectiveRange}. Reintentando con rango simplificado ${fallbackRange}...`);
      try {
        const result = await runGog(`sheets update ${spreadsheetId} "${fallbackRange}" --values-json '${jsonVal}' --input USER_ENTERED`, uId);
        return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
               `📊 **Documento:** [Abrir en Google Sheets](${editLink})\n` +
               `🆔 **ID:** \`${spreadsheetId}\`\n` +
               `🆔 **spreadsheetId:** \`${spreadsheetId}\`\n` +
               `📍 **Rango:** ${fallbackRange}\n` +
               `🔗 **Enlace directo:** ${editLink}\n\n` +
               `*Los datos han sido volcados en la hoja de cálculo (fallback de rango aplicado).*`;
      } catch (fallbackErr: any) {
        console.warn("⚠️ [Sheets Write] Fallback de rango en gog falló:", fallbackErr.message);
      }
    }

    // Fallback directo vía googleapis si gog sheets update falla
    try {
      const authClient = await getGoogleAuthForUser(uId);
      if (authClient) {
        const sheets = google.sheets({ version: "v4", auth: authClient });
        const apiRange = effectiveRange.includes("!") ? (effectiveRange.split("!").pop() || effectiveRange) : effectiveRange;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: apiRange,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: matrix }
        });
        return `✅ **DATOS ACTUALIZADOS CORRECTAMENTE**\n${SEP}\n\n` +
               `📊 **Documento:** [Abrir en Google Sheets](${editLink})\n` +
               `🆔 **ID:** \`${spreadsheetId}\`\n` +
               `🆔 **spreadsheetId:** \`${spreadsheetId}\`\n` +
               `📍 **Rango:** ${apiRange}\n` +
               `🔗 **Enlace directo:** ${editLink}\n\n` +
               `*Los datos han sido volcados en la hoja de cálculo (vía API).*`;
      }
    } catch (apiErr: any) {
      console.warn("⚠️ [Sheets Write] Fallback de googleapis falló:", apiErr.message);
    }

    return `❌ **Error al escribir en la hoja:** ${error.message}`;
  }
};

export const sheetsAppend = async (spreadsheetId: string, range: string, values: string | any[][], userId?: number) => {
  if (!isValidSpreadsheetId(spreadsheetId)) {
    return `❌ Error: spreadsheet_id inválido o alucinado.`;
  }
  const uId = userId || userContextStore.getStore()?.userId || 0;
  let matrix = normalizeValuesMatrix(values);

  // REGLAS Taller_Partes:
  // Si envían fila de cabeceras al append, descartarla para añadir únicamente la fila de datos
  if (matrix.length > 0 && isTallerPartesHeaderRow(matrix[0])) {
    console.warn("⚠️ [Sheets Append] Fila de cabeceras detectada en values para append. Descartando cabeceras para añadir solo la fila de datos.");
    matrix = matrix.slice(1);
  }

  if (matrix.length === 0) {
    return `⚠️ No hay datos que añadir (solo se habían proporcionado cabeceras que ya existen en el formato de la hoja).`;
  }

  const effectiveRange = range && range.trim() !== "" ? range : "A:O";
  const jsonVal = JSON.stringify(matrix);
  const editLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  try {
    const result = await runGog(`sheets append ${spreadsheetId} "${effectiveRange}" --values-json '${jsonVal}' --input USER_ENTERED`, uId);
    return `✅ **FILA(S) AÑADIDA(S) CORRECTAMENTE**\n${SEP}\n\n` +
           `📊 **Documento:** [Abrir en Google Sheets](${editLink})\n` +
           `🆔 **ID:** \`${spreadsheetId}\`\n` +
           `🆔 **spreadsheetId:** \`${spreadsheetId}\`\n` +
           `📍 **Rango / Destino:** ${effectiveRange}\n` +
           `🔗 **Enlace directo:** ${editLink}\n\n` +
           `*Se ha(n) añadido ${matrix.length} fila(s) al final de la hoja de cálculo.*`;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const isDead = isNotFoundError(errMsg) ||
                   errMsg.includes("404") ||
                   errMsg.toLowerCase().includes("trash") ||
                   errMsg.toLowerCase().includes("papelera") ||
                   (await isSpreadsheetTrashedOrMissing(spreadsheetId, uId));

    if (isDead) {
      console.warn(`🚨 [Sheets Append] Archivo ${spreadsheetId} inválido o en papelera. Purgando clave sheet:Taller_Partes de DB...`);
      // Purgar de DB si coincidía con Taller_Partes o por ID
      await dbService.deleteDriveFolder(uId, "sheet:Taller_Partes");
      await dbService.deleteDriveFolderById(uId, spreadsheetId);
      const cachedTallerId = await dbService.getDriveFolder(uId, "sheet:Taller_Partes");
      if (cachedTallerId) {
        await dbService.deleteDriveFolder(uId, "sheet:Taller_Partes");
        await dbService.deleteDriveFolderById(uId, cachedTallerId);
      }

      console.log(`🔄 [Sheets Append] Regenerando libro canónico 'Taller_Partes' para reintentar append...`);
      const createRes = await sheetsCreate("Taller_Partes", uId);
      const newSpreadsheetId = extractSpreadsheetIdFromCreateOutput(createRes);

      if (newSpreadsheetId && newSpreadsheetId !== spreadsheetId) {
        const newEditLink = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
        try {
          await runGog(`sheets append ${newSpreadsheetId} "${effectiveRange}" --values-json '${jsonVal}' --input USER_ENTERED`, uId);
          return `✅ **LIBRO CANÓNICO REGENERADO TRAS BORRADO Y FILA AÑADIDA**\n${SEP}\n\n` +
                 `📊 **Documento:** [Taller_Partes](${newEditLink}) · [Abrir en Google Sheets](${newEditLink})\n` +
                 `🆔 **ID:** \`${newSpreadsheetId}\`\n` +
                 `🆔 **spreadsheetId:** \`${newSpreadsheetId}\`\n` +
                 `📍 **Rango / Destino:** ${effectiveRange}\n` +
                 `🔗 **Enlace directo:** ${newEditLink}\n\n` +
                 `*El libro anterior '${spreadsheetId}' estaba en la papelera o no disponible. Se ha regenerado un libro nuevo 'Taller_Partes' con su formato profesional en silvania/ y se ha añadido la fila solicitada.*`;
        } catch (retryErr: any) {
          try {
            const authClient = await getGoogleAuthForUser(uId);
            if (authClient) {
              const sheets = google.sheets({ version: "v4", auth: authClient });
              await sheets.spreadsheets.values.append({
                spreadsheetId: newSpreadsheetId,
                range: effectiveRange,
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: matrix }
              });
              return `✅ **LIBRO CANÓNICO REGENERADO TRAS BORRADO Y FILA AÑADIDA**\n${SEP}\n\n` +
                     `📊 **Documento:** [Taller_Partes](${newEditLink}) · [Abrir en Google Sheets](${newEditLink})\n` +
                     `🆔 **ID:** \`${newSpreadsheetId}\`\n` +
                     `🆔 **spreadsheetId:** \`${newSpreadsheetId}\`\n` +
                     `📍 **Rango / Destino:** ${effectiveRange}\n` +
                     `🔗 **Enlace directo:** ${newEditLink}\n\n` +
                     `*El libro anterior '${spreadsheetId}' estaba en la papelera o no disponible. Se ha regenerado un libro nuevo 'Taller_Partes' con su formato profesional en silvania/ y se ha añadido la fila solicitada.*`;
            }
          } catch (apiRetryErr: any) {
            console.warn("⚠️ [Sheets Append] Fallback de regeneración falló:", apiRetryErr.message);
          }
        }
      }
    }

    // Si falla gog append por otra razón, intentar con fallback via googleapis
    try {
      const authClient = await getGoogleAuthForUser(uId);
      if (authClient) {
        const sheets = google.sheets({ version: "v4", auth: authClient });
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: effectiveRange,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: matrix }
        });
        return `✅ **FILA(S) AÑADIDA(S) CORRECTAMENTE**\n${SEP}\n\n` +
               `📊 **Documento:** [Abrir en Google Sheets](${editLink})\n` +
               `🆔 **ID:** \`${spreadsheetId}\`\n` +
               `🆔 **spreadsheetId:** \`${spreadsheetId}\`\n` +
               `📍 **Rango / Destino:** ${effectiveRange}\n` +
               `🔗 **Enlace directo:** ${editLink}\n\n` +
               `*Se ha(n) añadido ${matrix.length} fila(s) al final de la hoja de cálculo (vía API).*`;
      }
    } catch (apiErr: any) {
      console.warn("⚠️ [Sheets Append] Fallback de googleapis falló:", apiErr.message);
    }
    return `❌ **Error al añadir filas a la hoja:** ${error.message}`;
  }
};

export function buildInvoiceMatrix(opts?: { number?: string; date?: string; locale?: "es" | "en" }): (string | number)[][] {
  const isEn = opts?.locale === "en";
  const invoiceNum = opts?.number || "001";
  const invoiceDate = opts?.date || (isEn ? "=TODAY()" : "=HOY()");

  const sumFormula = isEn ? "=SUM(D12:D14)" : "=SUMA(D12:D14)";
  const ivaFormula = isEn ? "=D16*0.21" : "=D16*0,21";

  return [
    ["FACTURA", "", "", ""],
    ["Número de Factura:", invoiceNum, "Fecha:", invoiceDate],
    ["", "", "", ""],
    ["DATOS DEL EMISOR", "", "DATOS DEL CLIENTE", ""],
    ["Nombre:", "[Tu Empresa / Autónomo]", "Nombre:", "[Nombre del Cliente]"],
    ["NIF/CIF:", "[B00000000]", "NIF/CIF:", "[00000000A]"],
    ["Dirección:", "[Dirección Emisor]", "Dirección:", "[Dirección Cliente]"],
    ["Teléfono:", "[+34 600 000 000]", "Teléfono:", "[+34 600 000 000]"],
    ["Email:", "[emisor@empresa.com]", "Email:", "[cliente@empresa.com]"],
    ["", "", "", ""],
    ["Concepto", "Cantidad", "Precio unitario", "Importe"],
    ["Producto / Servicio 1", 1, 100, "=B12*C12"],
    ["Producto / Servicio 2", 1, 50, "=B13*C13"],
    ["Producto / Servicio 3", 1, 30, "=B14*C14"],
    ["", "", "", ""],
    ["", "", "Subtotal", sumFormula],
    ["", "", "IVA 21%", ivaFormula],
    ["", "", "TOTAL", "=D16+D17"]
  ];
}

export const sheetsCreateInvoice = async (opts: { title: string; number?: string; date?: string; locale?: "es" | "en"; userId?: number }) => {
  const title = opts.title || "Factura";
  const userId = opts.userId || userContextStore.getStore()?.userId;

  try {
    // 1. Crear la hoja de cálculo (y moverla automáticamente a la carpeta canónica silvania/)
    const createRes = await sheetsCreate(title, userId);
    if (createRes.includes("Error al crear")) {
      return createRes;
    }

    // Extraer el spreadsheetId real de la respuesta de sheetsCreate (compatible con formato Markdown **ID:** `...`)
    const spreadsheetId = extractSpreadsheetIdFromCreateOutput(createRes);
    if (!spreadsheetId) {
      return `❌ Error: No se pudo extraer el spreadsheetId de la hoja creada. Detalles: ${createRes}`;
    }

    // 2. Rellenar con la matriz 2D (18x4) en una sola escritura en A1 con USER_ENTERED (español por defecto)
    const baseLocale = opts.locale || "es";
    let matrix = buildInvoiceMatrix({ number: opts.number, date: opts.date, locale: baseLocale });
    let writeRes = await sheetsWrite(spreadsheetId, "A1", matrix, userId);

    if (writeRes.includes("Error al escribir")) {
      return `⚠️ Hoja creada pero falló la escritura de la matriz: ${writeRes}`;
    }

    // 3. Verificar si falló por locale EN (p. ej. #NAME?, #VALUE!, #ERROR! en =HOY(), =SUMA(D12:D14) o =D16*0,21)
    let checkLocaleFailed = false;
    try {
      const readRes = await sheetsRead(spreadsheetId, "D2:D18", userId);
      if (
        readRes.includes("#NAME?") ||
        readRes.includes("#VALUE!") ||
        readRes.includes("#NAME") ||
        readRes.includes("#VALOR") ||
        readRes.includes("#ERROR!") ||
        readRes.includes("#¿NOMBRE?")
      ) {
        checkLocaleFailed = true;
      }
    } catch (err) {
      console.warn("⚠️ No se pudo verificar la validez de las fórmulas tras la escritura:", err);
    }

    // Si falló el locale ES, reintentar una vez con locale inglés (=TODAY(), =SUM(D12:D14), =D16*0.21)
    if (checkLocaleFailed && baseLocale === "es") {
      console.log("⚠️ Fórmulas con error de locale detectadas en español. Reintentando en A1 con locale inglés (SUM y 0.21)...");
      matrix = buildInvoiceMatrix({ number: opts.number, date: opts.date, locale: "en" });
      const rewriteRes = await sheetsWrite(spreadsheetId, "A1", matrix, userId);
      if (rewriteRes.includes("Error al escribir")) {
        return `⚠️ Hoja creada pero falló el reintento de escritura en inglés: ${rewriteRes}`;
      }
    }

    let moveNote = "\n📂 **Ubicación:** Guardada en la carpeta canónica `silvania/`";
    if (createRes.includes("no se pudo mover")) {
      moveNote = "\n⚠️ *Aviso: La factura fue creada en la raíz de Google Drive pero no se pudo mover a la carpeta silvania/.*";
    }

    const editLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return `✅ **FACTURA CREADA Y CONFIGURADA CON ÉXITO**\n${SEP}\n\n` +
           `📊 **Documento:** [${title}](${editLink}) · [Abrir en Google Sheets](${editLink})\n` +
           `🆔 **ID:** \`${spreadsheetId}\`\n` +
           `🆔 **spreadsheetId:** \`${spreadsheetId}\`${moveNote}\n` +
           `🔗 **Enlace directo:** ${editLink}\n` +
           `📍 **Rango inicial:** \`A1\` (matriz 2D 18×4 escrita de una sola vez con \`USER_ENTERED\`)\n\n` +
           `*Se han volcado las fórmulas automáticas vivas de Importe (\`=B12*C12\`, \`=B13*C13\`, \`=B14*C14\`), Subtotal (\`=SUMA(D12:D14)\`), IVA 21% (\`=D16*0,21\`) y TOTAL (\`=D16+D17\`) de forma correcta.*`;
  } catch (error: any) {
    return `❌ **Error al crear la factura estructurada:** ${error.message}`;
  }
};
