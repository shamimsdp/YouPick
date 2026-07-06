export interface ChannelInfo {
  id: string;
  title: string;
  customUrl: string; // e.g. @handle
  description: string;
  thumbnail: string;
  category: string;
  subscribers?: string;
  videosCount?: string;
}

export interface VideoTrend {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  viewCount: number;
  publishedAt: string;
  viewsPerHour: number;
  channelTitle: string;
}

export interface VideoIdea {
  id: string;
  title: string;
  hook: string;
  targetAudience: string;
  rationale: string;
  suggestedFormat: "shorts" | "long-form";
  sourceVideos: Array<{ title: string; views: string; url: string }>;
  savedAt: string;
  dismissed: boolean;
}

export interface UserPrefs {
  connectedChannelId: string;
  defaultRegion: string;
  defaultCategory: string;
  refreshIntervalHours: number;
}

export interface ExtensionConfig {
  youtubeApiKey: string;
  geminiApiKey: string;
  useProxy: boolean;
  proxyUrl: string;
  regionCode: string;
}
