import { formatGmailList } from "../src/tools/gmail.js";
import { sanitizeAlucinatedLinks, filterFinalOutput } from "../src/agent/agent.js";
import { readUrl } from "../src/tools/webSearch.js";

async function runTests() {
  console.log("=== 1. TEST GMAIL FORMAT ===");
  const testGmailMsgs = [
    { id: "18f0a1b2c3d4e5f6", snippet: "Factura de servicios", from: "test@example.com", subject: "Factura", date: "2026-09-12" },
    { id: "", snippet: "Mensaje sin id", from: "anon@example.com", subject: "Sin id", date: "2026-09-12" }
  ];
  const formatted = formatGmailList(testGmailMsgs);
  if (!formatted.includes("https://mail.google.com/mail/u/0/#inbox/18f0a1b2c3d4e5f6")) {
    throw new Error("Falla: ID real no incluido en el primer correo");
  }
  if (!formatted.includes("Enlace no disponible")) {
    throw new Error("Falla: El correo sin ID válido debió mostrar que no está disponible");
  }
  console.log("✅ formatGmailList OK");

  console.log("\n=== 2. TEST SANITIZE ALUCINATED LINKS ===");
  const history = [
    { role: "user", content: "Busca mi factura" },
    {
      role: "tool",
      content: "Resultados de drive: Archivo Presupuesto ID: 1REAL_DRIVE_ID_ABC123 https://drive.google.com/file/d/1REAL_DRIVE_ID_ABC123/view\nCorreo ID: 1REAL_GMAIL_999 https://mail.google.com/mail/u/0/#inbox/1REAL_GMAIL_999\nEmpresa web: https://paleplast.com"
    }
  ];

  const assistantResponse = `
Aquí tienes tus datos:
1. Enlace oficial: https://drive.google.com/drive/my-drive
2. Archivo real: https://drive.google.com/file/d/1REAL_DRIVE_ID_ABC123/view
3. Correo real: https://mail.google.com/mail/u/0/#inbox/1REAL_GMAIL_999
4. Carpeta inventada: https://drive.google.com/drive/folders/1FAKE_FOLDER_ID_XYZ
5. Correo inventado: https://mail.google.com/mail/u/0/#inbox/FMfcgzGkXFakeFake
6. Mapa inventado: https://google.com/maps/place/Paleplast+Fake
7. Web de empresa encontrada: https://paleplast.com
  `;

  const sanitized = sanitizeAlucinatedLinks(assistantResponse, history);
  console.log("Sanitized text:\n", sanitized);

  if (!sanitized.includes("https://drive.google.com/drive/my-drive")) {
    throw new Error("Falla: Whitelist canónica eliminada incorrectamente");
  }
  if (!sanitized.includes("https://drive.google.com/file/d/1REAL_DRIVE_ID_ABC123/view")) {
    throw new Error("Falla: Archivo real eliminado incorrectamente");
  }
  if (!sanitized.includes("https://mail.google.com/mail/u/0/#inbox/1REAL_GMAIL_999")) {
    throw new Error("Falla: Correo real eliminado incorrectamente");
  }
  if (!sanitized.includes("https://paleplast.com")) {
    throw new Error("Falla: Web de empresa real eliminada incorrectamente");
  }
  if (sanitized.includes("1FAKE_FOLDER_ID_XYZ")) {
    throw new Error("Falla: Carpeta inventada NO fue neutralizada");
  }
  if (sanitized.includes("FMfcgzGkXFakeFake")) {
    throw new Error("Falla: Correo inventado NO fue neutralizado");
  }
  if (sanitized.includes("Paleplast+Fake")) {
    throw new Error("Falla: Mapa inventado NO fue neutralizado");
  }
  console.log("✅ sanitizeAlucinatedLinks OK");

  console.log("\n=== 3. TEST FILTER FINAL OUTPUT (ANTI-TOOL-ECHO) ===");
  const rawWithCode = `
He buscado en tu correo:
\`\`\`python
print(gmail_list(query='factura'))
\`\`\`
Encontré 3 facturas.
tools.drive_list({"parentId": "root"})
Aquí tienes los detalles.
`;

  const filtered = filterFinalOutput(rawWithCode);
  console.log("Filtered text:\n", filtered);
  if (filtered.includes("print(gmail_list")) {
    throw new Error("Falla: print(...) no fue eliminado");
  }
  if (filtered.includes("tools.drive_list")) {
    throw new Error("Falla: tools.drive_list no fue eliminado");
  }
  if (!filtered.includes("Encontré 3 facturas.") || !filtered.includes("Aquí tienes los detalles.")) {
    throw new Error("Falla: El contenido legítimo fue borrado incorrectamente");
  }
  console.log("✅ filterFinalOutput OK");

  console.log("\n=== 4. TEST READ URL AUTO-HTTPS ===");
  // Test reading a lightweight test domain or checking url formatting logic
  const res = await readUrl("silvania.ai");
  console.log("readUrl response length:", res.length);
  if (!res.includes("silvania.ai")) {
    throw new Error("Falla: readUrl no procesó silvania.ai");
  }
  console.log("✅ readUrl OK");

  console.log("\n🎉 TODOS LOS TESTS DE INTEGRACIÓN PASARON EXITOSAMENTE!");
}

runTests().catch(err => {
  console.error("❌ ERROR EN LOS TESTS:", err);
  process.exit(1);
});
