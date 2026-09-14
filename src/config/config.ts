import "dotenv/config";

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map(id => parseInt(id.trim())),
  },
  llm: {
    groqKey: process.env.GROQ_API_KEY || "",
    openRouterKey: process.env.OPENROUTER_API_KEY || "",
    openRouterModel: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.5-flash",
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
  oauth: {
    prodClientId: process.env.GOOGLE_CLIENT_ID || "",
    prodClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    betaClientId: process.env.GOOGLE_CLIENT_ID_BETA || "",
    betaClientSecret: process.env.GOOGLE_CLIENT_SECRET_BETA || "",
    betaUserIds: (process.env.BETA_USER_IDS || "").split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
    prodScopes: process.env.GOOGLE_SCOPES_PROD || [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/gmail.send"
    ].join(" "),
    betaScopes: process.env.GOOGLE_SCOPES_BETA || [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify"
    ].join(" ")
  },
  marketing: {
    voiceProvider: process.env.MARKETING_VOICE_PROVIDER || "edge",
    premiumVoice: process.env.MARKETING_PREMIUM_VOICE === "true",
    imageProvider: process.env.MARKETING_IMAGE_PROVIDER || "pollinations_flux",
    adminIds: (process.env.MARKETING_ADMIN_IDS || "1572946817").split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
    telegramChannelId: process.env.MARKETING_TELEGRAM_CHANNEL_ID || "",
    telegramChannelUrl: process.env.MARKETING_TELEGRAM_CHANNEL_URL || "",
    webhookUrl: process.env.MARKETING_WEBHOOK_URL || "",
    facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
    facebookPageId: process.env.FACEBOOK_PAGE_ID || "",
    twitterApiKey: process.env.TWITTER_API_KEY || "",
    twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN || ""
  },
  tempDir: "./temp"
};

// Validación básica
if (!config.telegram.token || !config.llm.groqKey) {
  console.error("❌ ERROR: Faltan claves críticas en el archivo .env");
}
