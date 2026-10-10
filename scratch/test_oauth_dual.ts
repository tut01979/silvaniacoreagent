import { getAuthUrl } from "../src/services/authHelper.js";
import { config } from "../src/config/config.js";

// Mock beta env vars for testing
process.env.GOOGLE_CLIENT_ID = "prod_client_id_12345.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "prod_secret_123";
process.env.GOOGLE_CLIENT_ID_BETA = "beta_client_id_99999.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET_BETA = "beta_secret_999";
process.env.BETA_USER_IDS = "1572946817,777888999";

// Update config at runtime for test
config.oauth.prodClientId = process.env.GOOGLE_CLIENT_ID;
config.oauth.prodClientSecret = process.env.GOOGLE_CLIENT_SECRET;
config.oauth.betaClientId = process.env.GOOGLE_CLIENT_ID_BETA;
config.oauth.betaClientSecret = process.env.GOOGLE_CLIENT_SECRET_BETA;
config.oauth.betaUserIds = [1572946817, 777888999];

console.log("=== PRUEBA DE GENERACIÓN DE ENLACES OAUTH DUAL ===");

// 1. Usuario Whitelisted (Beta)
const betaUserId = 1572946817;
const betaUrl = getAuthUrl(betaUserId);
console.log("\n1. Usuario Beta (whitelisted ID: 1572946817):");
console.log("URL:", betaUrl);

if (betaUrl && betaUrl.includes("beta_client_id_99999") && betaUrl.includes("gmail.modify")) {
  console.log("✅ ÉXITO: Usuario Beta utiliza client_id BETA y scopes amplios (gmail.modify, drive full).");
} else {
  console.error("❌ ERROR: Falló la generación de URL para usuario Beta.");
}

// 2. Usuario Normal (Producción)
const prodUserId = 123456789;
const prodUrl = getAuthUrl(prodUserId);
console.log("\n2. Usuario Producción (normal ID: 123456789):");
console.log("URL:", prodUrl);

if (prodUrl && prodUrl.includes("prod_client_id_12345") && !prodUrl.includes("gmail.modify") && prodUrl.includes("gmail.send") && prodUrl.includes("drive.file")) {
  console.log("✅ ÉXITO: Usuario Producción utiliza client_id PROD y scopes reducidos (drive.file, gmail.send). NUNCA usa beta.");
} else {
  console.error("❌ ERROR: Falló la generación de URL para usuario Producción.");
}

// 3. Simulación cuando no hay vars Beta
config.oauth.betaClientId = "";
config.oauth.betaClientSecret = "";
const betaUserWithoutBetaVarsUrl = getAuthUrl(betaUserId);
console.log("\n3. Usuario Whitelisted cuando NO hay variables Beta configuradas:");
console.log("URL:", betaUserWithoutBetaVarsUrl);

if (betaUserWithoutBetaVarsUrl && betaUserWithoutBetaVarsUrl.includes("prod_client_id_12345")) {
  console.log("✅ ÉXITO: Fallback seguro a cliente PROD cuando faltan variables Beta.");
} else {
  console.error("❌ ERROR: Falló el fallback seguro a Producción.");
}
