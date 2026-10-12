export type ContentFormat = "social_post" | "youtube_long" | "youtube_short" | "tiktok" | "newsletter";

export type DraftStatus = "pending_review" | "approved" | "approved_saved" | "regenerating" | "rejected" | "published";

export interface SceneBreakdown {
  sceneNumber: number;
  timestamp: string; // e.g. "00:00 - 00:30"
  visualPrompt: string; // Prompt for image/B-roll generation
  narration: string; // Voiceover text for this scene
  onScreenText?: string; // Text overlay or subtitle emphasis
}

export interface VideoScript {
  title: string;
  hook: string; // Hook de los primeros 15-30 segundos
  description: string;
  tags: string[];
  scenes: SceneBreakdown[];
  totalEstimatedDurationSeconds: number;
}

export type SocialPlatform = "linkedin" | "x" | "telegram" | "threads" | "generic";

export interface SocialPost {
  title: string;
  copy: string;
  hashtags: string[];
  imagePrompt: string;
  callToAction: string;
  platform?: SocialPlatform;
}

export interface MarketingDraft {
  id: string; // UUID v4 o nanoid
  userId: number;
  topic: string;
  format: ContentFormat;
  status: DraftStatus;
  socialContent?: SocialPost;
  videoScript?: VideoScript;
  imageUrls: string[];
  audioUrls: string[];
  targetChannels: string[]; // ["telegram_channel", "linkedin", "youtube", "tiktok"]
  targetPlatform?: SocialPlatform;
  voiceProvider?: string; // "edge" | "elevenlabs" | "polly" | "google"
  imageProvider?: string; // "pollinations_flux" | "dalle"
  llmModel?: string; // "gemini-2.5-flash" | "llama-3.3-70b"
  channelPublished?: boolean;
  channelMessageId?: number;
  imageError?: string;
  videoPath?: string;
  videoUrl?: string;
  sceneImageCount?: number;
  distinctImageCount?: number;
  networkImageCount?: number;
  localFallbackImageCount?: number;
  realDurationSeconds?: number;
  videoError?: string;
  feedbackNote?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CampaignPackDraft {
  id: string;
  userId: number;
  topic: string;
  createdAt: string;
  youtubeLongDraft?: MarketingDraft; // 16:9 full (2-3 min, N scenes)
  tiktokShortDraft?: MarketingDraft; // 9:16 vertical (45-60s)
  linkedinPostDraft?: MarketingDraft; // Storytelling
  xPostDraft?: MarketingDraft; // Punchy hook
  telegramPostDraft?: MarketingDraft; // Formatted summary
}

export interface ReviewCallbackPayload {
  action: "approve" | "regenerate" | "reject" | "view_script";
  draftId: string;
}
