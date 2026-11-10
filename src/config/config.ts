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
    instagramAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "",
    publicUrl: process.env.PUBLIC_URL || "https://silvania.ai",
    twitterApiKey: process.env.TWITTER_API_KEY || "",
    twitterApiSecret: process.env.TWITTER_API_SECRET || "",
    twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN || "",
    twitterAccessSecret: process.env.TWITTER_ACCESS_SECRET || "",
    youtubeClientId: process.env.YOUTUBE_CLIENT_ID || "",
    youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
    youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN || "",
    linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN || "AQVts5Vntlmtb3ktSdY42lXsvi8KPzCtUdvsFenEyXyqkRqHaaVO7k0luUny_GtSV-S57Jg0IDzc-VJirYa2bF_iWC7-4eT-tVXlSkA7_deyRMDscvFg4rzNFNg-6jPh-IUJa_lIqhG1Gj5j5S2UbABAormExaTe1gNgmJRBJS7_ZEBrcl587Y9j_fe8aqxrTeT3Y7qDf98n6tbUq8Zcuu4xn6AoSHJRg16DZSiGq8z-O-kgg1EJHj00Vfh53MllZUF4tQQ61IV8alszG53T_B5S5WJUcZ_3IE3yfvBdNZ6f0I7Mt46kU0QzOUkKG2MM5_LF2NPm9aMH2VOTzow3lGRD4wdphQ",
    linkedinPersonUrn: process.env.LINKEDIN_PERSON_URN || "urn:li:person:5hWnXvuzlV",
    cronEnabled: process.env.MARKETING_CRON_ENABLED !== "false",
    cronHour: parseInt(process.env.MARKETING_CRON_HOUR || "11"),
    cronMinute: parseInt(process.env.MARKETING_CRON_MINUTE || "0")
  },
  skills: {
    seedBuiltin: process.env.SEED_BUILTIN_SKILLS !== "false"
  },
  tempDir: "./temp"
};

// Validación básica
if (!config.telegram.token || !config.llm.groqKey) {
  console.error("❌ ERROR: Faltan claves críticas en el archivo .env");
}
