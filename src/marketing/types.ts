export type ContentFormat = "social_post" | "youtube_long" | "youtube_short" | "newsletter";

export type DraftStatus = "pending_review" | "approved" | "regenerating" | "rejected" | "published";

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

export interface SocialPost {
  title: string;
  copy: string;
  hashtags: string[];
  imagePrompt: string;
  callToAction: string;
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
  targetChannels: string[]; // ["telegram_channel", "linkedin", "youtube"]
  voiceProvider?: string; // "edge" | "elevenlabs" | "polly" | "google"
  imageProvider?: string; // "pollinations_flux" | "dalle"
  llmModel?: string; // "gemini-2.5-flash" | "llama-3.3-70b"
  channelPublished?: boolean;
  channelMessageId?: number;
  feedbackNote?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ReviewCallbackPayload {
  action: "approve" | "regenerate" | "reject" | "view_script";
  draftId: string;
}
