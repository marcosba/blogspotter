import { GoogleGenAI, Type } from "@google/genai";
import { ClassificationResult, BlogPost } from "../types";
import { CATEGORIES } from "../constants";

export const classifyBlogWithGemini = async (
  title: string,
  description: string,
  posts: BlogPost[]
): Promise<ClassificationResult> => {
  if (!process.env.API_KEY) {
    console.warn("No API KEY provided, returning default classification");
    return {
      category: "Other",
      tags: ["Unclassified"],
      sentimentScore: 50,
      language: "Unknown",
      summary: "API Key missing."
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const postTitles = posts.map(p => p.title).join(", ");
  const prompt = `
    Analyze the following blog metadata and classify it.
    
    Blog Title: ${title}
    Blog Description: ${description}
    Recent Post Titles: ${postTitles}
    
    Available Categories: ${CATEGORIES.join(", ")}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "One of the available categories that best fits the blog." },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3-5 relevant tags/keywords for the blog content."
            },
            sentimentScore: { type: Type.NUMBER, description: "A score from 0 (negative) to 100 (positive) based on the content tone." },
            language: { type: Type.STRING, description: "The primary language of the blog (e.g., English, Spanish)." },
            summary: { type: Type.STRING, description: "A concise 1-sentence summary of what this blog is about." }
          },
          required: ["category", "tags", "sentimentScore", "language", "summary"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ClassificationResult;
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return {
      category: "Other",
      tags: ["Auto-Tag-Error"],
      sentimentScore: 50,
      language: "English",
      summary: "Could not analyze content."
    };
  }
};
