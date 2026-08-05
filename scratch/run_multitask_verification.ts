import { runAgent } from "../src/agent/agent.js";
import { userContextStore } from "../src/services/context.js";

async function main() {
  const userId = 1572946817; // Usuario principal Jesús
  const message = "Listar el contenido de la carpeta silvania, crear una carpeta llamada Test_MultiTarea y mostrarme los correos de hoy.";
  
  console.log("=== INICIANDO VERIFICACIÓN DE MULTI-TAREA ===");
  console.log(`Mensaje enviado: "${message}"\n`);

  try {
    const response = await runAgent(userId, message);
    console.log("\n================ AGENT RESPONSE ================");
    console.log(response);
    console.log("================================================");
  } catch (err: any) {
    console.error("❌ Error durante la verificación multitarea:", err.stack || err.message);
  }
}

main();
