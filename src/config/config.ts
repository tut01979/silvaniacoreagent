import "dotenv/config";

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map(id => parseInt(id.trim())),
  },
  llm: {
    groqKey: process.env.GROQ_API_KEY || "",
    openRouterKey: process.env.OPENROUTER_API_KEY || "",
    openRouterModel: process.env.OPENROUTER_MODEL || "openrouter/free",
  },
  voice: {
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || "",
    voiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID || "",
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    pollyVoice: process.env.POLLY_VOICE || "Lucia",
  },
  db: {
    path: process.env.DB_PATH || "./data/memory.db",
    useFirebase: process.env.USE_FIREBASE === "true",
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json",
  },
  search: {
    braveApiKey: process.env.BRAVE_API_KEY || "",
  },
  tempDir: "./temp"
};

// Validación básica
if (!config.telegram.token || !config.llm.groqKey) {
  console.error("❌ ERROR: Faltan claves críticas en el archivo .env");
}
