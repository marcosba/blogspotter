
import { MAX_RECENT_POSTS } from "../constants";
import { BlogPost, BlogStatus, BlogStats, BlogMetadata } from "../types";

export const normalizeUrl = (url: string): string => {
  let cleanUrl = url.trim();
  // Remove trailing slashes
  while (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  
  if (!cleanUrl.startsWith("http")) {
    cleanUrl = `https://${cleanUrl}`;
  }
  
  return cleanUrl;
};

// --- Proxy & Network Helpers ---

// Ordered by reliability and speed. 
// We rotate through these if one fails.
const PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  // Fallback for some environments
  "https://cors-anywhere.herokuapp.com/" 
];

const fetchWithProxy = async (targetUrl: string): Promise<Response> => {
  let lastError: any;
  
  // Add timestamp to prevent proxy caching of errors
  const urlWithCacheBust = targetUrl.includes('?') 
    ? `${targetUrl}&_t=${Date.now()}` 
    : `${targetUrl}?_t=${Date.now()}`;

  const encodedTarget = encodeURIComponent(urlWithCacheBust);

  for (const proxyBase of PROXIES) {
    try {
      // Construct URL based on proxy requirements
      // corsproxy.io generally works best with the full URL appended
      let url = `${proxyBase}${encodedTarget}`;
      
      // Special handling if needed for specific proxies (most use the pattern above)
      if (proxyBase.includes("corsproxy.io")) {
         // corsproxy.io can take unencoded too, but encoded is safer
         url = `${proxyBase}${encodedTarget}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased to 20s
      
      console.log(`Attempting fetch via ${proxyBase}...`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      console.warn(`Proxy ${proxyBase} returned status ${response.status}`);
      lastError = new Error(`Proxy returned status ${response.status}`);
    } catch (e: any) {
      console.warn(`Proxy ${proxyBase} failed:`, e.message);
      lastError = e;
    }
  }
  
  throw lastError || new Error("All proxies failed. Check your internet connection or try disabling ad-blockers.");
};

const fetchJsonFeed = async (baseUrl: string, type: 'posts' | 'pages', maxResults: number = 0, startIndex: number = 1) => {
  // Use alt=json for rich metadata
  const feedUrl = `${baseUrl}/feeds/${type}/default?alt=json&max-results=${maxResults}&start-index=${startIndex}`;
  
  try {
    const response = await fetchWithProxy(feedUrl);
    // Clone response to safely check text before parsing JSON
    const clone = response.clone();
    try {
      const data = await response.json();
      return data.feed;
    } catch (jsonError) {
       // If JSON parse fails, check if we got an HTML error page or similar
       const text = await clone.text();
       if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
         throw new Error("Received HTML instead of JSON. The blog might not support the Blogger API or is not a Blogspot blog.");
       }
       throw jsonError;
    }
  } catch (error) {
    console.warn(`Failed to fetch ${type} feed from ${baseUrl}:`, error);
    throw error;
  }
};

const fetchHtml = async (baseUrl: string) => {
  try {
    const response = await fetchWithProxy(baseUrl);
    return await response.text();
  } catch (error) {
    console.warn(`Failed to fetch HTML for ${baseUrl}:`, error);
    return ""; // Return empty string on failure to allow process to continue
  }
};

// --- Analysis Helpers ---

const countWords = (html: string): number => {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length === 0 ? 0 : text.split(' ').length;
};

const countImages = (html: string): number => {
  if (!html) return 0;
  return (html.match(/<img/gi) || []).length;
};

const parseDate = (dateStr: string): Date => {
  return new Date(dateStr);
};

// --- Scraping Helpers ---

const scrapeFollowers = (html: string): number => {
  if (!html) return 0;
  // Patterns common in Blogger templates
  const patterns = [
    /id="Followers1".*?<span class="item-count">(\d+)<\/span>/s, // Standard widget
    /<div class="followers-count">(\d+)<\/div>/,
    /Total Followers\s*:\s*(\d+)/i,
    /(\d+)\s*followers/i,
    /data-count="(\d+)"/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return 0; 
};

// --- Scoring Logic ---

const calculateConsistencyScore = (dates: Date[]): number => {
  if (dates.length < 3) return 50; 

  const gaps: number[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const diffTime = Math.abs(dates[i].getTime() - dates[i+1].getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    gaps.push(diffDays);
  }

  if (gaps.length === 0) return 0;

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of Variation
  const cv = mean === 0 ? 0 : stdDev / mean;
  
  let score = 100 - (cv * 66); 
  
  const daysSinceLastPost = (new Date().getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastPost > 90) score -= 20;
  if (daysSinceLastPost > 365) score -= 40;

  return Math.max(0, Math.min(100, Math.round(score)));
};

const calculateQualityScore = (stats: BlogStats): number => {
  let score = 0;

  // 1. Content Depth (25%)
  const avgWordsScore = Math.min(100, (stats.avgWordsPerPost / 800) * 100); 
  const avgImgScore = Math.min(100, (stats.avgImagesPerPost / 3) * 100); 
  score += (avgWordsScore * 0.15) + (avgImgScore * 0.10);

  // 2. Activity & Volume (25%)
  const totalPostScore = Math.min(100, (stats.totalPosts / 100) * 100); 
  const consistency = stats.consistencyScore;
  score += (totalPostScore * 0.10) + (consistency * 0.15);

  // 3. Engagement (30%)
  const commentScore = Math.min(100, stats.avgCommentsPerPost * 10); 
  const followerScore = stats.followersCount > 0 ? Math.min(100, Math.log10(stats.followersCount) * 25) : 0;
  
  if (stats.followersCount === 0) {
      score += (commentScore * 0.30);
  } else {
      score += (commentScore * 0.20) + (followerScore * 0.10);
  }

  // 4. Longevity & Structure (20%)
  const now = new Date();
  const first = new Date(stats.firstPostDate);
  const yearsActive = (now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const longevityScore = Math.min(100, yearsActive * 20); 
  
  const pagesScore = Math.min(100, stats.totalPages * 20); 
  
  score += (longevityScore * 0.10) + (pagesScore * 0.10);

  return Math.round(score);
};

// --- Main Service Function ---

export const analyzeBlogAndFetch = async (blogUrl: string): Promise<Partial<BlogMetadata>> => {
  const cleanUrl = normalizeUrl(blogUrl);
  
  try {
    // 1. Initial Fetch (Posts Batch 1) - CRITICAL
    // We try to fetch the feed first. If this fails, the blog is likely invalid or down.
    const postsFeed = await fetchJsonFeed(cleanUrl, 'posts', 25);
    
    if (!postsFeed) {
        throw new Error("No feed data returned. The URL might not be a valid Blogspot blog.");
    }

    const title = postsFeed.title?.$t || "Untitled Blog";
    const description = postsFeed.subtitle?.$t || "";
    const totalPosts = parseInt(postsFeed.openSearch$totalResults?.$t || "0", 10);
    
    // 2. Secondary Fetches (Optional - use try/catch blocks)
    // We don't want the entire process to fail if we can't get history or pages.
    
    let htmlContent = "";
    let creationDateStr: string | null = null;
    let pagesFeed: any = null;

    // Optional: Fetch HTML for scraping followers
    try {
        htmlContent = await fetchHtml(cleanUrl);
    } catch (e) { console.warn("HTML fetch failed, skipping scraping"); }

    // Optional: Fetch Pages
    try {
        pagesFeed = await fetchJsonFeed(cleanUrl, 'pages', 10);
    } catch (e) { console.warn("Pages fetch failed, assuming 0 pages"); }

    // Optional: Fetch Oldest Post (Creation Date)
    try {
        if (totalPosts > 0) {
            const safeTotal = Math.min(totalPosts, 500); 
            if (safeTotal > 1) {
                 const historyFeed = await fetchJsonFeed(cleanUrl, 'posts', 1, safeTotal);
                 creationDateStr = historyFeed.entry?.[0]?.published?.$t;
            }
        }
    } catch (e) { console.warn("History fetch failed, using estimate"); }


    const totalPages = parseInt(pagesFeed?.openSearch$totalResults?.$t || "0", 10);

    // 3. Process Posts
    const entries = postsFeed.entry || [];
    const processedPosts: BlogPost[] = entries.map((entry: any) => {
      const content = entry.content?.$t || entry.summary?.$t || "";
      const wordCount = countWords(content);
      const imageCount = countImages(content);
      
      let commentCount = 0;
      if (entry.thr$total) {
        commentCount = parseInt(entry.thr$total.$t, 10);
      } else {
        const replyLink = entry.link?.find((l: any) => l.rel === 'replies' && l.type === 'text/html');
        if (replyLink && replyLink.title) {
          const match = replyLink.title.match(/(\d+)/);
          if (match) commentCount = parseInt(match[1], 10);
        }
      }

      const tags = entry.category?.map((c: any) => c.term) || [];

      return {
        title: entry.title?.$t || "No Title",
        link: entry.link?.find((l: any) => l.rel === 'alternate')?.href || "",
        pubDate: entry.published?.$t,
        guid: entry.id?.$t,
        snippet: content.replace(/<[^>]*>?/gm, '').substring(0, 150) + "...",
        wordCount,
        imageCount,
        commentCount,
        tags
      };
    });

    // 4. Process Pages
    const pageEntries = pagesFeed?.entry || [];
    let totalPageWords = 0;
    pageEntries.forEach((entry: any) => {
        const content = entry.content?.$t || entry.summary?.$t || "";
        totalPageWords += countWords(content);
    });
    const avgWordsPerPage = pageEntries.length > 0 ? Math.round(totalPageWords / pageEntries.length) : 0;

    // 5. Calculate Aggregate Stats
    const totalWords = processedPosts.reduce((sum, p) => sum + p.wordCount, 0);
    const totalImages = processedPosts.reduce((sum, p) => sum + p.imageCount, 0);
    const totalComments = processedPosts.reduce((sum, p) => sum + p.commentCount, 0);
    
    // Dates
    const postDates = processedPosts.map(p => parseDate(p.pubDate));
    const lastPostDate = postDates.length > 0 ? postDates[0] : new Date();
    
    let firstPostDate = new Date();
    if (creationDateStr) {
        firstPostDate = parseDate(creationDateStr);
    } else if (postDates.length > 0) {
        firstPostDate = postDates[postDates.length - 1];
    }

    // Consistency
    const consistencyScore = calculateConsistencyScore(postDates);
    const avgDaysBetweenPosts = postDates.length > 1 
      ? (postDates[0].getTime() - postDates[postDates.length - 1].getTime()) / (postDates.length - 1) / (1000 * 60 * 60 * 24)
      : 0;

    // Followers
    const followersCount = scrapeFollowers(htmlContent);

    const stats: BlogStats = {
      totalPosts,
      totalPages,
      totalComments: totalPosts > processedPosts.length && processedPosts.length > 0
         ? Math.round((totalComments / processedPosts.length) * totalPosts) 
         : totalComments, 
      avgCommentsPerPost: processedPosts.length ? Math.round((totalComments / processedPosts.length) * 10) / 10 : 0,
      avgWordsPerPost: processedPosts.length ? Math.round(totalWords / processedPosts.length) : 0,
      avgWordsPerPage,
      avgImagesPerPost: processedPosts.length ? Math.round((totalImages / processedPosts.length) * 10) / 10 : 0,
      avgDaysBetweenPosts: Math.round(avgDaysBetweenPosts * 10) / 10,
      consistencyScore,
      followersCount,
      firstPostDate: firstPostDate.toISOString(),
      lastPostDate: lastPostDate.toISOString()
    };

    // 6. Calculate Final Score
    const qualityScore = calculateQualityScore(stats);

    // 7. Determine Status
    let status = BlogStatus.Active;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (lastPostDate < sixMonthsAgo) {
      status = BlogStatus.Inactive;
    }

    // 8. Aggregate Tags
    const allTags = new Set<string>();
    processedPosts.forEach(p => p.tags.forEach(t => allTags.add(t)));

    return {
      title,
      description,
      lastBuildDate: lastPostDate.toISOString(),
      posts: processedPosts.slice(0, MAX_RECENT_POSTS),
      status,
      stats,
      qualityScore,
      tags: Array.from(allTags).slice(0, 15)
    };

  } catch (error: any) {
    console.error("Analysis Error:", error);
    // Provide a more user-friendly error message if possible
    const msg = error.message.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("network error")) {
        throw new Error("Network Error: Could not connect to the blog. Please try: 1. Disabling ad-blockers (they block proxies). 2. Verifying the URL.");
    }
    throw error;
  }
};
