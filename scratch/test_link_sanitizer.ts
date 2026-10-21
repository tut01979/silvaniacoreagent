import { sanitizeAlucinatedLinks } from "../src/agent/agent.js";

// Test 1: Link in previous assistant message
const historyWithPreviousFile = [
  { role: "user", content: "resume este video y guardalo en drive" },
  { role: "tool", content: "Archivo guardado en Drive: https://drive.google.com/file/d/1ySSFz-dz4zkhYrSjom3FpAhki2a85Vc0/view ID: 1ySSFz-dz4zkhYrSjom3FpAhki2a85Vc0" },
  { role: "assistant", content: "He guardado la transcripcion en https://drive.google.com/file/d/1ySSFz-dz4zkhYrSjom3FpAhki2a85Vc0/view" },
  { role: "user", content: "enviamela a mi correo" },
  // In this turn, tool was only gmail_send:
  { role: "tool", content: "Email enviado correctamente" }
];

const assistantResponse = "He enviado el correo. El enlace al archivo es: https://drive.google.com/file/d/1ySSFz-dz4zkhYrSjom3FpAhki2a85Vc0/view";

const sanitized = sanitizeAlucinatedLinks(assistantResponse, historyWithPreviousFile);
console.log("Input:", assistantResponse);
console.log("Sanitized:", sanitized);

if (sanitized.includes("[Enlace no disponible")) {
  console.log("FAIL: Link was wrongly neutralized!");
} else {
  console.log("SUCCESS: Legitimate link from history preserved!");
}

// Test 2: Truly hallucinated link
const hallucinatedResponse = "Aqui tienes el enlace: https://drive.google.com/file/d/1FakeHallucinatedId9999999999/view";
const sanitizedHallucination = sanitizeAlucinatedLinks(hallucinatedResponse, historyWithPreviousFile);
console.log("Hallucination Sanitized:", sanitizedHallucination);

if (sanitizedHallucination.includes("[Enlace no disponible")) {
  console.log("SUCCESS: Hallucinated link was correctly neutralized!");
} else {
  console.log("FAIL: Hallucinated link was NOT neutralized!");
}
