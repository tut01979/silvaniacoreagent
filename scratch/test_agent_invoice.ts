import { runAgent } from "../src/agent/agent.js";
import { userContextStore } from "../src/services/context.js";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const userId = 1572946817; // Jesús
  const prompt = "Crea una factura llamada FACTURA_TEST5 con cálculo automático de IVA al 21%.";

  console.log("=== EJECUTANDO AGENTE LOCALMENTE CON EL PROMPT ===");
  console.log(`Prompt: "${prompt}"`);

  // Ejecutamos en el contexto del usuario para poblar el AsyncLocalStorage
  await userContextStore.run({ userId }, async () => {
    try {
      const response = await runAgent(userId, prompt);
      console.log("\n=== RESPUESTA FINAL DEL AGENTE ===");
      console.log(response);
    } catch (error: any) {
      console.error("❌ Error ejecutando el agente:", error.stack || error.message);
    }
  });
}

main();
