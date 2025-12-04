import { LucideIcon, LayoutDashboard, Globe, Bookmark, PlusCircle, Activity, Coffee, Code, Camera, Music, BookOpen, Briefcase, Zap } from "lucide-react";

export const CATEGORIES = [
  "Technology",
  "Lifestyle",
  "Travel",
  "Food & Cooking",
  "Photography",
  "Art & Design",
  "Personal",
  "Business",
  "Education",
  "Entertainment",
  "Other"
];

export const CORS_PROXY = "https://api.allorigins.win/raw?url=";

export const SAMPLE_BLOGS = [
  "https://googleblog.blogspot.com",
  "https://buzz.blogger.com",
  "https://maps.googleblog.com"
];

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Technology": Code,
  "Lifestyle": Coffee,
  "Travel": Globe,
  "Food & Cooking": Zap,
  "Photography": Camera,
  "Art & Design": BookOpen,
  "Entertainment": Music,
  "Business": Briefcase,
  "Other": Activity
};

export const MAX_RECENT_POSTS = 5;
