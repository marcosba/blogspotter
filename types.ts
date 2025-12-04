export enum BlogStatus {
  Active = 'Active',
  Inactive = 'Inactive', // No posts in 6 months
  Unreachable = 'Unreachable'
}

export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  guid: string;
  snippet: string;
  wordCount: number;
  imageCount: number;
  commentCount: number;
  tags: string[];
}

export interface BlogStats {
  totalPosts: number;
  totalPages: number;
  totalComments: number;
  avgCommentsPerPost: number;
  avgWordsPerPost: number;
  avgWordsPerPage: number;
  avgImagesPerPost: number;
  avgDaysBetweenPosts: number;
  consistencyScore: number; // 0-100 (Higher is more consistent)
  followersCount: number; // -1 if unknown
  firstPostDate: string; // Estimated or retrieved
  lastPostDate: string;
}

export interface BlogMetadata {
  id: string;
  url: string;
  feedUrl: string;
  title: string;
  description: string;
  lastBuildDate: string;
  category: string;
  tags: string[];
  status: BlogStatus;
  isFavorite: boolean;
  
  // Scores
  sentimentScore: number; // 0 to 100 (from Gemini)
  qualityScore: number; // 0 to 100 (Algorithmic)
  
  language: string;
  addedAt: string;
  lastCheckedAt: string;
  
  // Content
  posts: BlogPost[];
  stats: BlogStats;
}

export interface ClassificationResult {
  category: string;
  tags: string[];
  sentimentScore: number;
  language: string;
  summary: string;
}

export type ViewState = 'dashboard' | 'directory' | 'favorites' | 'add';