import { runAgent } from "../src/agent/agent.js";
import { executeTool } from "../src/tools/index.js";

async function testWebInvestigation() {
  console.log("🧪 1. Probando executeTool read_url directamente con silvania.ai...");
  const directRead = await executeTool("read_url", { url: "silvania.ai" });
  console.log("Resultado directo de read_url (primeros 250 chars):", directRead.slice(0, 250));

  console.log("\n🧪 2. Probando runAgent con la consulta de Jesús: 'investiga el sitio web silvania.ai'...");
  const adminId = 1572946817;
  const response = await runAgent(adminId, "investiga el sitio web silvania.ai");
  console.log("✅ Respuesta del agente:\n", response);
}

testWebInvestigation().catch(console.error);
