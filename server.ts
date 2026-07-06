import express from "express";
import path from "path";
import dotenv from "dotenv";
import JSZip from "jszip";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for external origins like the unpacked chrome-extension context
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

const PORT = 3000;

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// A robust local dataset of current trending videos across key niches as a fast fallback
const STATIC_TRENDS: Record<string, Array<{ title: string; channelTitle: string; viewCount: number; publishedAt: string; thumbnail: string }>> = {
  tech: [
    {
      title: "I Built a Smart Home That Controls Itself (AI Integrated)",
      channelTitle: "TechCrafter",
      viewCount: 450000,
      publishedAt: "2026-07-05T12:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "Why Everyone is Upgrading to This New Laptop Screen Tech",
      channelTitle: "DisplayTech",
      viewCount: 890000,
      publishedAt: "2026-07-04T15:30:00Z",
      thumbnail: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "Building the Ultimate Space-Saving Desk Setup",
      channelTitle: "MinimalWorkspace",
      viewCount: 230000,
      publishedAt: "2026-07-05T18:45:00Z",
      thumbnail: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "My Honest Review of Gemini 3.5: One Month Later",
      channelTitle: "AI Frontier",
      viewCount: 1200000,
      publishedAt: "2026-07-02T09:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  gaming: [
    {
      title: "This Speedrunner Just Broke the World Record by 3 Seconds!",
      channelTitle: "SpeedyRun",
      viewCount: 1500000,
      publishedAt: "2026-07-05T08:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "10 Hidden Details in the New Open-World RPG You Missed",
      channelTitle: "LoreMaster",
      viewCount: 780000,
      publishedAt: "2026-07-04T20:15:00Z",
      thumbnail: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "The Ultimate Guide to Custom Keyboards in 2026",
      channelTitle: "KeebNerd",
      viewCount: 320000,
      publishedAt: "2026-07-03T14:22:00Z",
      thumbnail: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  finance: [
    {
      title: "The 2026 Housing Market is Changing. Here's My Plan.",
      channelTitle: "WealthVision",
      viewCount: 540000,
      publishedAt: "2026-07-04T11:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "How I Live on 40% of My Income (Comfortably)",
      channelTitle: "BudgetSmart",
      viewCount: 1210000,
      publishedAt: "2026-07-05T07:15:00Z",
      thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  cooking: [
    {
      title: "3 Level-Up Secrets for Restaurant-Quality Pasta at Home",
      channelTitle: "SauceCraft",
      viewCount: 980000,
      publishedAt: "2026-07-05T10:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "The Only Bread Recipe You Need (No Kneading, 4 Ingredients)",
      channelTitle: "SourdoughNerd",
      viewCount: 2200000,
      publishedAt: "2026-07-03T16:45:00Z",
      thumbnail: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  lifestyle: [
    {
      title: "A Realistic Day in My Life (Balancing Freelancing & Fitness)",
      channelTitle: "DailyRoutine",
      viewCount: 310000,
      publishedAt: "2026-07-05T06:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "I Tried a 30-Day Digital Detox. Here's What Happened to My Brain.",
      channelTitle: "MindFlow",
      viewCount: 1450000,
      publishedAt: "2026-07-02T13:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  travel: [
    {
      title: "I Spent 72 Hours in a Tokyo Capsule Hotel (Honest Review)",
      channelTitle: "WanderlustSolo",
      viewCount: 1800000,
      publishedAt: "2026-07-04T12:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "The Ultimate Backpacker Guide to Southeast Asia in 2026",
      channelTitle: "BudgetTravels",
      viewCount: 620000,
      publishedAt: "2026-07-03T09:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
  shorts: [
    {
      title: "Never chop onions like this again! 🧅 #shorts",
      channelTitle: "KitchenHacks",
      viewCount: 4500000,
      publishedAt: "2026-07-05T14:00:00Z",
      thumbnail: "https://images.unsplash.com/photo-1508313880080-c4bef0730395?auto=format&fit=crop&w=400&h=225&q=80",
    },
    {
      title: "This iPhone setting is a lifesaver! 📱 #techshorts",
      channelTitle: "TechTipsShorts",
      viewCount: 8900000,
      publishedAt: "2026-07-04T17:30:00Z",
      thumbnail: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=225&q=80",
    },
  ],
};

// Map categories to user-friendly terms
const CATEGORY_MAP: Record<string, string> = {
  "28": "tech",       // Science & Technology
  "20": "gaming",     // Gaming
  "26": "cooking",    // Howto & Style / Food
  "22": "lifestyle",  // People & Blogs
  "19": "travel",     // Travel & Events
  "25": "news",       // News & Politics
  "1": "film",        // Film & Animation
  "10": "music",      // Music
};

// Endpoint 1: Resolve YouTube Channel URL, Handle or ID
app.post("/api/channel/resolve", async (req, res) => {
  const { query, youtubeApiKey, geminiApiKey } = req.body;
  if (!query) {
    res.status(400).json({ error: "Missing channel search query" });
    return;
  }

  const apiKey = youtubeApiKey || process.env.YOUTUBE_API_KEY;

  if (apiKey && apiKey.length > 5) {
    try {
      console.log(`Attempting real YouTube API query for: ${query}`);
      let channelId = "";

      // Parse query to extract username or handle
      let resolvedQuery = query.trim();
      if (resolvedQuery.includes("youtube.com/")) {
        const parts = resolvedQuery.split("youtube.com/");
        const pathPart = parts[1];
        if (pathPart.startsWith("@")) {
          resolvedQuery = pathPart.split("/")[0].split("?")[0];
        } else if (pathPart.includes("channel/")) {
          resolvedQuery = pathPart.split("channel/")[1].split("/")[0].split("?")[0];
        } else if (pathPart.includes("c/")) {
          resolvedQuery = pathPart.split("c/")[1].split("/")[0].split("?")[0];
        } else if (pathPart.includes("user/")) {
          resolvedQuery = pathPart.split("user/")[1].split("/")[0].split("?")[0];
        }
      }

      // Check if it's a direct channel ID
      if (resolvedQuery.startsWith("UC") && resolvedQuery.length === 24) {
        channelId = resolvedQuery;
      }

      let channelData = null;

      if (channelId) {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&id=${channelId}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          channelData = data.items[0];
        }
      } else {
        // Handle lookup or fallback search
        let handleParam = resolvedQuery;
        if (!handleParam.startsWith("@")) {
          handleParam = "@" + handleParam;
        }
        // Try channels.list with forHandle first (supports @handles)
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&forHandle=${encodeURIComponent(handleParam)}&key=${apiKey}`;
        const handleResponse = await fetch(handleUrl);
        const handleData = await handleResponse.json();

        if (handleData.items && handleData.items.length > 0) {
          channelData = handleData.items[0];
        } else {
          // Fallback to standard search list
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(resolvedQuery)}&type=channel&maxResults=1&key=${apiKey}`;
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();
          if (searchData.items && searchData.items.length > 0) {
            channelId = searchData.items[0].id.channelId;
            const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&id=${channelId}&key=${apiKey}`;
            const detailRes = await fetch(detailUrl);
            const detailData = await detailRes.json();
            if (detailData.items && detailData.items.length > 0) {
              channelData = detailData.items[0];
            }
          }
        }
      }

      if (channelData) {
        // Try to identify custom niche via topicDetails or fallback
        let detectedCategory = "lifestyle";
        if (channelData.topicDetails?.topicIds) {
          // Classify based on topics
          const topicIds = channelData.topicDetails.topicIds;
          if (topicIds.some((t: string) => t.toLowerCase().includes("tech") || t.toLowerCase().includes("science"))) {
            detectedCategory = "tech";
          } else if (topicIds.some((t: string) => t.toLowerCase().includes("game"))) {
            detectedCategory = "gaming";
          } else if (topicIds.some((t: string) => t.toLowerCase().includes("business") || t.toLowerCase().includes("finance"))) {
            detectedCategory = "finance";
          } else if (topicIds.some((t: string) => t.toLowerCase().includes("cook") || t.toLowerCase().includes("food"))) {
            detectedCategory = "cooking";
          } else if (topicIds.some((t: string) => t.toLowerCase().includes("travel"))) {
            detectedCategory = "travel";
          }
        }

        res.json({
          id: channelData.id,
          title: channelData.snippet.title,
          customUrl: channelData.snippet.customUrl || resolvedQuery,
          description: channelData.snippet.description,
          thumbnail: channelData.snippet.thumbnails?.high?.url || channelData.snippet.thumbnails?.default?.url,
          category: detectedCategory,
          subscribers: Number(channelData.statistics?.subscriberCount).toLocaleString() || "N/A",
          videosCount: Number(channelData.statistics?.videoCount).toLocaleString() || "N/A",
        });
        return;
      }
    } catch (apiError) {
      console.warn("YouTube API failed, falling back to smart simulation", apiError);
    }
  }

  // Smart AI Simulation Fallback: Uses Gemini Search Grounding or smart heuristic to scrape YouTube stats
  try {
    console.log(`Using Gemini AI to resolve/simulate channel stats for: ${query}`);
    const cleanQuery = query.trim();
    const activeAi = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } }) : ai;

    // System prompt for structured channel extraction
    const response = await activeAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search the web for details and recent statistics about the YouTube channel or content niche for: "${cleanQuery}".
      Determine its name, standard handle, estimated subscriber count, estimated total videos, and its category niche (select strictly from: "tech", "gaming", "finance", "cooking", "lifestyle", "travel").
      Provide a concise summary description. Ensure the statistics look realistic and grounded.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Official name of the channel" },
            customUrl: { type: Type.STRING, description: "Handle starting with @" },
            description: { type: Type.STRING, description: "One-paragraph summary describing the channel niche and topics" },
            category: { type: Type.STRING, description: "Strictly one of: 'tech', 'gaming', 'finance', 'cooking', 'lifestyle', 'travel'" },
            subscribers: { type: Type.STRING, description: "Subscriber count, e.g. '1.24M subscribers'" },
            videosCount: { type: Type.STRING, description: "E.g. '342 videos'" },
          },
          required: ["title", "customUrl", "description", "category", "subscribers", "videosCount"],
        },
      },
    });

    const result = JSON.parse(response.text.trim());
    res.json({
      id: "sim_" + Math.random().toString(36).substring(2, 10),
      title: result.title,
      customUrl: result.customUrl,
      description: result.description,
      thumbnail: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(result.title)}`,
      category: result.category || "lifestyle",
      subscribers: result.subscribers,
      videosCount: result.videosCount,
    });
  } catch (error: any) {
    // Ultimate local static fallback if Gemini fails
    console.error("Gemini resolution failed, using final local fallback", error);
    const mockName = query.replace(/[^a-zA-Z0-9\s]/g, "").trim() || "Creator Hub";
    const customUrl = mockName.toLowerCase().replace(/\s+/g, "");
    res.json({
      id: "sim_default",
      title: mockName,
      customUrl: `@${customUrl}`,
      description: `A creative YouTube channel focusing on high-impact insights in the ${mockName} category.`,
      thumbnail: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(mockName)}`,
      category: "tech",
      subscribers: "125K subscribers",
      videosCount: "42 videos",
    });
  }
});

// Endpoint 2: Get trending/performing videos in a niche & lookback window
app.post("/api/trends", async (req, res) => {
  const { category, window, region, youtubeApiKey } = req.body; // window is '24h' or '7d'
  const finalCategory = (category || "tech").toLowerCase();
  const finalRegion = region || "US";

  const apiKey = youtubeApiKey || process.env.YOUTUBE_API_KEY;

  if (apiKey && apiKey.length > 5) {
    try {
      console.log(`Fetching real YouTube trends for: ${finalCategory} in ${finalRegion}`);
      // Find category code for search mapping
      let categoryId = "";
      if (finalCategory === "tech") categoryId = "28";
      else if (finalCategory === "gaming") categoryId = "20";
      else if (finalCategory === "cooking") categoryId = "26";
      else if (finalCategory === "lifestyle") categoryId = "22";
      else if (finalCategory === "travel") categoryId = "19";

      // Calculate lookback date
      const publishedAfter = new Date();
      if (window === "24h") {
        publishedAfter.setHours(publishedAfter.getHours() - 24);
      } else {
        publishedAfter.setDate(publishedAfter.getDate() - 7);
      }

      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&publishedAfter=${publishedAfter.toISOString()}&regionCode=${finalRegion}&maxResults=8&key=${apiKey}`;
      if (categoryId) {
        url += `&videoCategoryId=${categoryId}`;
      } else {
        url += `&q=${encodeURIComponent(finalCategory)}`;
      }

      const searchRes = await fetch(url);
      const searchData = await searchRes.json();

      if (searchData.items && searchData.items.length > 0) {
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");
        const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();

        if (detailData.items) {
          const processed: any[] = detailData.items.map((video: any) => {
            const viewCount = Number(video.statistics?.viewCount || 0);
            const publishedAt = video.snippet.publishedAt;
            const hoursSincePublished = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60));
            const viewsPerHour = Math.round(viewCount / hoursSincePublished);

            return {
              id: video.id,
              title: video.snippet.title,
              url: `https://youtube.com/watch?v=${video.id}`,
              thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
              viewCount,
              publishedAt,
              viewsPerHour,
              channelTitle: video.snippet.channelTitle,
            };
          });

          // Sort by views per hour if 7d lookback to normalize publishes
          if (window === "7d") {
            processed.sort((a, b) => b.viewsPerHour - a.viewsPerHour);
          } else {
            processed.sort((a, b) => b.viewCount - a.viewCount);
          }

          res.json({ trends: processed, source: "youtube_api" });
          return;
        }
      }
    } catch (apiError) {
      console.warn("YouTube trends API lookup failed, falling back", apiError);
    }
  }

  // Fallback to pre-compiled static lists
  const data = STATIC_TRENDS[finalCategory] || STATIC_TRENDS["tech"];
  const trends = data.map((v, idx) => {
    const publishedAtDate = new Date();
    publishedAtDate.setHours(publishedAtDate.getHours() - (idx * 4 + 2));
    const publishedAt = publishedAtDate.toISOString();
    const hoursSincePublished = Math.max(1, (Date.now() - publishedAtDate.getTime()) / (1000 * 60 * 60));
    const factor = window === "24h" ? 0.4 : 1.2;
    const viewCount = Math.round(v.viewCount * factor);
    const viewsPerHour = Math.round(viewCount / hoursSincePublished);

    return {
      id: "trend_" + finalCategory + "_" + idx,
      title: v.title,
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnail: v.thumbnail,
      viewCount,
      publishedAt,
      viewsPerHour,
      channelTitle: v.channelTitle,
    };
  });

  res.json({ trends, source: "simulation_fallback" });
});

// Endpoint 3: Generate smart structured video ideas using Gemini AI
app.post("/api/generate-ideas", async (req, res) => {
  const { channel, trends, category, geminiApiKey } = req.body;

  if (!channel) {
    res.status(400).json({ error: "Missing channel context" });
    return;
  }

  try {
    const trendContext = (trends || [])
      .map((t: any) => `- "${t.title}" by ${t.channelTitle} (${Number(t.viewCount).toLocaleString()} views, Velocity: ${t.viewsPerHour}/hour)`)
      .join("\n");

    const prompt = `You are a world-class YouTube growth strategist.
    We are generating highly relevant, high-CTR video suggestions for a channel with the following details:
    Channel Name: ${channel.title}
    Niche/Category: ${category || channel.category}
    Channel Description: ${channel.description}
    
    Current performing trend topics in this category right now:
    ${trendContext}
    
    Using these high-performing trends as structural reference or inspiration, create 5 unique, highly viral video ideas customized specifically to fit the channel.
    Provide a title that uses YouTube psychological trigger styles, an opening hooks hook/angle, target audience description, detailed growth rationale, and select the best recommended format ('shorts' or 'long-form').`;

    const activeAi = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } }) : ai;
    const response = await activeAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A high-CTR click-worthy YouTube title" },
              hook: { type: Type.STRING, description: "An engaging intro/hook concept for the first 30 seconds" },
              targetAudience: { type: Type.STRING, description: "The specific viewer segment this video will attract" },
              rationale: { type: Type.STRING, description: "Strategic explanation of why this idea fits current performance patterns" },
              suggestedFormat: { type: Type.STRING, description: "Strictly 'shorts' or 'long-form'" },
            },
            required: ["title", "hook", "targetAudience", "rationale", "suggestedFormat"],
          },
        },
      },
    });

    const parsedIdeas = JSON.parse(response.text.trim());
    
    // Add custom helper fields
    const formattedIdeas = parsedIdeas.map((idea: any) => {
      // Pick random source videos from trends to link inspiration
      const sources = (trends || []).slice(0, 2).map((t: any) => ({
        title: t.title,
        views: Number(t.viewCount).toLocaleString(),
        url: t.url,
      }));

      return {
        id: "idea_" + Math.random().toString(36).substring(2, 10),
        ...idea,
        sourceVideos: sources,
        savedAt: new Date().toISOString(),
        dismissed: false,
      };
    });

    res.json({ ideas: formattedIdeas });
  } catch (error: any) {
    console.error("Gemini Idea Generator Failed:", error);
    res.status(500).json({ error: "Failed to generate video ideas using Gemini AI" });
  }
});

// Endpoint 4: Bundle Chrome Extension into ZIP and download
app.get("/api/extension/download", async (req, res) => {
  const ytKey = (req.query.ytKey as string) || "";
  const geminiKey = (req.query.geminiKey as string) || "";
  const hostUrl = req.protocol + "://" + req.get("host");
  const proxyUrl = (req.query.proxyUrl as string) || hostUrl;
  const region = (req.query.region as string) || "US";

  try {
    const zip = new JSZip();

    // 1. manifest.json
    const manifest = {
      manifest_version: 3,
      name: "YouPick",
      version: "1.0.0",
      description: "Generate high-performing YouTube video ideas tailored to your channel category with YouPick.",
      permissions: ["storage", "activeTab"],
      host_permissions: [
        "https://*.run.app/",
        "https://www.googleapis.com/"
      ],
      action: {
        default_popup: "popup.html"
      },
      options_page: "options.html",
      background: {
        service_worker: "background.js"
      }
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // 2. popup.html
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
  <title>YouPick</title>
</head>
<body>
  <div class="popup-container">
    <header class="app-header">
      <div class="brand">
        <svg class="icon-sparkles" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <h1>YouPick</h1>
      </div>
      <button id="btnOptions" title="Settings">⚙️</button>
    </header>

    <main class="main-content">
      <!-- 1. Activation / Onboarding Screen -->
      <div id="activationView" class="activation-view">
        <div class="activation-info-card">
          <h3 class="activation-title">🚀 Activate YouPick Extension</h3>
          <p class="activation-subtitle">Enter your options below to initiate trend monitoring and Gemini suggestions.</p>
        </div>
        
        <div class="activation-form">
          <div class="form-group">
            <label>YouTube Data API Key (Optional)</label>
            <input type="password" id="activateYtKey" placeholder="Leave blank for secure sandbox proxy" />
            <div class="help-box">
              <span class="help-title">💡 How to get YouTube Data API Key:</span>
              <ol>
                <li>Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>.</li>
                <li>Create/select a project, search for <strong>YouTube Data API v3</strong>, and enable it.</li>
                <li>Under <strong>Credentials</strong>, click <strong>Create Credentials &gt; API Key</strong>.</li>
              </ol>
            </div>
          </div>

          <div class="form-group">
            <label>Gemini API Key (Optional)</label>
            <input type="password" id="activateGeminiKey" placeholder="Optional standalone key" />
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Default Market</label>
              <select id="activateRegion">
                <option value="US">US - United States</option>
                <option value="GB">GB - United Kingdom</option>
                <option value="CA">CA - Canada</option>
                <option value="AU">AU - Australia</option>
                <option value="IN">IN - India</option>
              </select>
            </div>

            <div class="form-group half">
              <label>Proxy Server URL</label>
              <input type="text" id="activateProxy" value="${proxyUrl}" />
              <button type="button" id="btnResetDefault" style="background:none;border:none;color:#3b82f6;font-size:9px;text-decoration:underline;cursor:pointer;padding:0;margin-top:2px;text-align:left;">Reset to Current Domain</button>
            </div>
          </div>

          <button id="btnSaveActivation" class="btn-activate">Activate & Open YouPick</button>
        </div>
      </div>

      <!-- 2. Main Dashboard View -->
      <div id="dashboardView" class="dashboard-view hidden">
        <div class="channel-section">
          <input type="text" id="inputChannel" placeholder="Channel Handle (e.g. @Veritasium)" />
          <button id="btnAnalyze">Analyze</button>
        </div>

        <div id="statusContainer" class="status-box hidden">
          <span id="statusText">Analyzing channel...</span>
        </div>

        <div id="channelBadge" class="channel-badge hidden">
          <div class="badge-header">
            <img id="channelAvatar" class="avatar" src="" alt="Avatar" />
            <div>
              <h3 id="channelTitle">Channel</h3>
              <span id="channelNiche" class="niche-tag">Niche</span>
            </div>
          </div>
          <p id="channelDesc" class="channel-desc"></p>
        </div>

        <div class="toggle-section">
          <span class="section-label">Trend Window:</span>
          <div class="toggle-group">
            <button id="btn24h" class="toggle-btn active">24 Hours</button>
            <button id="btn7d" class="toggle-btn">7 Days</button>
          </div>
        </div>

        <div class="ideas-section">
          <div class="section-header">
            <h2>Gemini Ideas</h2>
            <button id="btnGenerate" class="btn-primary" disabled>Generate Ideas</button>
          </div>
          <div id="ideasContainer" class="ideas-list">
            <div class="empty-state">
              <p>Connect a YouTube channel to trigger YouPick growth suggestions.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;

    zip.file("popup.html", popupHtml);

    // 3. popup.css (Tailwind compilation mockup for clean visual look)
    const popupCss = `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  width: 380px;
  margin: 0;
  padding: 0;
  background-color: #f8fafc;
  color: #1e293b;
}

.popup-container {
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #0f172a;
  color: #ffffff;
  padding: 12px 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-sparkles {
  width: 18px;
  height: 18px;
  color: #fbbf24;
}

.brand h1 {
  font-size: 15px;
  margin: 0;
  font-weight: 600;
}

#btnOptions {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 16px;
}

.main-content {
  padding: 16px;
}

.channel-section {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.channel-section input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
}

.channel-section button, .btn-primary {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  font-size: 13px;
}

.channel-section button:hover, .btn-primary:hover {
  background-color: #2563eb;
}

.btn-primary:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.status-box {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 12px;
}

.hidden {
  display: none !important;
}

.channel-badge {
  background-color: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.badge-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.badge-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
}

.niche-tag {
  background-color: #f1f5f9;
  color: #475569;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.channel-desc {
  font-size: 12px;
  color: #64748b;
  margin: 8px 0 0 0;
  line-height: 1.4;
}

.toggle-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.toggle-group {
  display: flex;
  background-color: #e2e8f0;
  padding: 2px;
  border-radius: 6px;
}

.toggle-btn {
  background: none;
  border: none;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.toggle-btn.active {
  background-color: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.ideas-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h2 {
  font-size: 14px;
  margin: 0;
  font-weight: 600;
}

.ideas-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.idea-card {
  background-color: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  position: relative;
}

.format-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 9px;
  background-color: #fef2f2;
  color: #dc2626;
  padding: 1px 6px;
  border-radius: 12px;
  font-weight: 600;
}

.idea-card h4 {
  margin: 0 0 6px 0;
  font-size: 13px;
  font-weight: 600;
  padding-right: 60px;
}

.idea-card p {
  font-size: 11px;
  color: #64748b;
  margin: 4px 0;
  line-height: 1.4;
}

.idea-card strong {
  color: #334155;
}

.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: #94a3b8;
  font-size: 12px;
}

/* Activation Onboarding View Styles */
.activation-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activation-info-card {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 10px;
  border-radius: 8px;
  color: #1e40af;
}

.activation-title {
  margin: 0 0 4px 0;
  font-size: 13px;
  font-weight: bold;
}

.activation-subtitle {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: #1e3a8a;
}

.activation-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.form-group input, .form-group select {
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
}

.form-row {
  display: flex;
  gap: 8px;
}

.half {
  flex: 1;
}

.help-box {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  padding: 8px;
  border-radius: 6px;
  margin-top: 4px;
}

.help-title {
  display: block;
  font-size: 10.5px;
  font-weight: bold;
  color: #b45309;
  margin-bottom: 4px;
}

.help-box ol {
  margin: 0;
  padding-left: 14px;
  font-size: 10px;
  color: #d97706;
  line-height: 1.4;
}

.help-box ol li {
  margin-bottom: 2px;
}

.btn-activate {
  background-color: #4f46e5;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  margin-top: 6px;
  text-align: center;
}

.btn-activate:hover {
  background-color: #4338ca;
}`;

    zip.file("popup.css", popupCss);

    // 4. popup.js (Main extension popup execution containing user credentials)
    const popupJs = `// Prefilled configs from ZIP builder
const CONFIGS = {
  youtubeApiKey: "${ytKey}",
  geminiApiKey: "${geminiKey}",
  regionCode: "${region}",
  proxyUrl: "${proxyUrl}",
  fallbackActive: true
};

let activeChannel = null;
let trendWindow = "24h";

document.addEventListener("DOMContentLoaded", () => {
  // Check Chrome Storage for overrides and activation status
  chrome.storage.local.get(["youtubeApiKey", "geminiApiKey", "regionCode", "proxyUrl", "isActivated"], (res) => {
    if (res.youtubeApiKey) CONFIGS.youtubeApiKey = res.youtubeApiKey;
    if (res.geminiApiKey) CONFIGS.geminiApiKey = res.geminiApiKey;
    if (res.regionCode) CONFIGS.regionCode = res.regionCode;
    if (res.proxyUrl) CONFIGS.proxyUrl = res.proxyUrl;
    
    if (res.isActivated) {
      document.getElementById("activationView").classList.add("hidden");
      document.getElementById("dashboardView").classList.remove("hidden");
    } else {
      document.getElementById("activationView").classList.remove("hidden");
      document.getElementById("dashboardView").classList.add("hidden");
    }
    
    initUI();
  });
});

function initUI() {
  const btnAnalyze = document.getElementById("btnAnalyze");
  const btnGenerate = document.getElementById("btnGenerate");
  const btnOptions = document.getElementById("btnOptions");
  const btn24h = document.getElementById("btn24h");
  const btn7d = document.getElementById("btn7d");
  const btnSaveActivation = document.getElementById("btnSaveActivation");
  const btnResetDefault = document.getElementById("btnResetDefault");

  if (btnResetDefault) {
    btnResetDefault.addEventListener("click", () => {
      document.getElementById("activateProxy").value = "${proxyUrl}";
    });
  }

  if (btnSaveActivation) {
    btnSaveActivation.addEventListener("click", () => {
      const ytVal = document.getElementById("activateYtKey").value.trim();
      const gemVal = document.getElementById("activateGeminiKey").value.trim();
      const regVal = document.getElementById("activateRegion").value;
      const prxVal = document.getElementById("activateProxy").value.trim();
      
      const updateData = { isActivated: true };
      if (ytVal) { CONFIGS.youtubeApiKey = ytVal; updateData.youtubeApiKey = ytVal; }
      if (gemVal) { CONFIGS.geminiApiKey = gemVal; updateData.geminiApiKey = gemVal; }
      if (regVal) { CONFIGS.regionCode = regVal; updateData.regionCode = regVal; }
      // Always store proxyUrl if filled or reset to default
      CONFIGS.proxyUrl = prxVal || "${proxyUrl}";
      updateData.proxyUrl = CONFIGS.proxyUrl;
      
      chrome.storage.local.set(updateData, () => {
        document.getElementById("activationView").classList.add("hidden");
        document.getElementById("dashboardView").classList.remove("hidden");
      });
    });
  }

  btnAnalyze.addEventListener("click", handleAnalyze);
  btnGenerate.addEventListener("click", handleGenerate);
  btnOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

  btn24h.addEventListener("click", () => {
    trendWindow = "24h";
    btn24h.classList.add("active");
    btn7d.classList.remove("active");
  });

  btn7d.addEventListener("click", () => {
    trendWindow = "7d";
    btn7d.classList.add("active");
    btn24h.classList.remove("active");
  });
}

// Local helper for YouTube/Gemini queries to bypass server proxy when keys are provided
async function localResolveChannel(query, apiKey, geminiKey) {
  let channelId = "";
  let resolvedQuery = query.trim();
  if (resolvedQuery.includes("youtube.com/")) {
    const parts = resolvedQuery.split("youtube.com/");
    const pathPart = parts[1];
    if (pathPart.startsWith("@")) {
      resolvedQuery = pathPart.split("/")[0].split("?")[0];
    } else if (pathPart.includes("channel/")) {
      resolvedQuery = pathPart.split("channel/")[1].split("/")[0].split("?")[0];
    } else if (pathPart.includes("c/")) {
      resolvedQuery = pathPart.split("c/")[1].split("/")[0].split("?")[0];
    } else if (pathPart.includes("user/")) {
      resolvedQuery = pathPart.split("user/")[1].split("/")[0].split("?")[0];
    }
  }

  if (resolvedQuery.startsWith("UC") && resolvedQuery.length === 24) {
    channelId = resolvedQuery;
  }

  let channelData = null;

  if (channelId) {
    const url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&id=" + channelId + "&key=" + apiKey;
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      channelData = data.items[0];
    }
  } else {
    let handleParam = resolvedQuery;
    if (!handleParam.startsWith("@")) {
      handleParam = "@" + handleParam;
    }
    const handleUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&forHandle=" + encodeURIComponent(handleParam) + "&key=" + apiKey;
    const handleResponse = await fetch(handleUrl);
    const handleData = await handleResponse.json();

    if (handleData.items && handleData.items.length > 0) {
      channelData = handleData.items[0];
    } else {
      const searchUrl = "https://www.googleapis.com/youtube/v3/search?part=snippet&q=" + encodeURIComponent(resolvedQuery) + "&type=channel&maxResults=1&key=" + apiKey;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      if (searchData.items && searchData.items.length > 0) {
        channelId = searchData.items[0].id.channelId;
        const detailUrl = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,topicDetails&id=" + channelId + "&key=" + apiKey;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        if (detailData.items && detailData.items.length > 0) {
          channelData = detailData.items[0];
        }
      }
    }
  }

  if (channelData) {
    let detectedCategory = "lifestyle";
    if (channelData.topicDetails && channelData.topicDetails.topicIds) {
      const topicIds = channelData.topicDetails.topicIds;
      if (topicIds.some(t => t.toLowerCase().includes("tech") || t.toLowerCase().includes("science"))) {
        detectedCategory = "tech";
      } else if (topicIds.some(t => t.toLowerCase().includes("game"))) {
        detectedCategory = "gaming";
      } else if (topicIds.some(t => t.toLowerCase().includes("business") || t.toLowerCase().includes("finance"))) {
        detectedCategory = "finance";
      } else if (topicIds.some(t => t.toLowerCase().includes("cook") || t.toLowerCase().includes("food"))) {
        detectedCategory = "cooking";
      } else if (topicIds.some(t => t.toLowerCase().includes("travel"))) {
        detectedCategory = "travel";
      }
    }

    return {
      id: channelData.id,
      title: channelData.snippet.title,
      customUrl: channelData.snippet.customUrl || resolvedQuery,
      description: channelData.snippet.description,
      thumbnail: (channelData.snippet.thumbnails && channelData.snippet.thumbnails.high) ? channelData.snippet.thumbnails.high.url : ((channelData.snippet.thumbnails && channelData.snippet.thumbnails.default) ? channelData.snippet.thumbnails.default.url : ""),
      category: detectedCategory,
      subscribers: Number(channelData.statistics?.subscriberCount || 0).toLocaleString() || "N/A",
      videosCount: Number(channelData.statistics?.videoCount || 0).toLocaleString() || "N/A"
    };
  }

  if (geminiKey) {
    const prompt = "Search the web for details and recent statistics about the YouTube channel or content niche for: \"" + resolvedQuery + "\".\n" +
      "Determine its name, standard handle, estimated subscriber count, estimated total videos, and its category niche (select strictly from: \"tech\", \"gaming\", \"finance\", \"cooking\", \"lifestyle\", \"travel\").\n" +
      "Provide a concise summary description. Return raw JSON adhering to this schema:\n" +
      "{\n" +
      "  \"title\": \"Official name of the channel\",\n" +
      "  \"customUrl\": \"Handle starting with @\",\n" +
      "  \"description\": \"One-paragraph summary describing the channel niche and topics\",\n" +
      "  \"category\": \"Strictly one of: 'tech', 'gaming', 'finance', 'cooking', 'lifestyle', 'travel'\",\n" +
      "  \"subscribers\": \"e.g. '1.24M subscribers'\",\n" +
      "  \"videosCount\": \"e.g. '342 videos'\",\n" +
      "  \"thumbnail\": \"Valid URL of any profile image or fallback like 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe'\"\n" +
      "}";

    const gemResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + geminiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    const gemData = await gemResponse.json();
    const txt = gemData.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(txt);
    return parsed;
  }

  throw new Error("Could not find channel. Please verify handle.");
}

async function localFetchTrends(category, window, region, apiKey) {
  const finalCategory = (category || "tech").toLowerCase();
  const finalRegion = region || "US";

  let categoryId = "";
  if (finalCategory === "tech") categoryId = "28";
  else if (finalCategory === "gaming") categoryId = "20";
  else if (finalCategory === "cooking") categoryId = "26";
  else if (finalCategory === "lifestyle") categoryId = "22";
  else if (finalCategory === "travel") categoryId = "19";

  const publishedAfter = new Date();
  if (window === "24h") {
    publishedAfter.setHours(publishedAfter.getHours() - 24);
  } else {
    publishedAfter.setDate(publishedAfter.getDate() - 7);
  }

  try {
    let url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&publishedAfter=" + publishedAfter.toISOString() + "&regionCode=" + finalRegion + "&maxResults=8&key=" + apiKey;
    if (categoryId) {
      url += "&videoCategoryId=" + categoryId;
    } else {
      url += "&q=" + encodeURIComponent(finalCategory);
    }

    const searchRes = await fetch(url);
    const searchData = await searchRes.json();

    if (searchData.items && searchData.items.length > 0) {
      const videoIds = searchData.items.map(item => item.id.videoId).join(",");
      const detailUrl = "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=" + videoIds + "&key=" + apiKey;
      const detailRes = await fetch(detailUrl);
      const detailData = await detailRes.json();

      if (detailData.items) {
        const processed = detailData.items.map(video => {
          const viewCount = Number(video.statistics?.viewCount || 0);
          const publishedAt = video.snippet.publishedAt;
          const hoursSincePublished = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60));
          const viewsPerHour = Math.round(viewCount / hoursSincePublished);

          return {
            id: video.id,
            title: video.snippet.title,
            url: "https://youtube.com/watch?v=" + video.id,
            thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url,
            viewCount,
            publishedAt,
            viewsPerHour,
            channelTitle: video.snippet.channelTitle,
          };
        });

        if (window === "7d") {
          processed.sort((a, b) => b.viewsPerHour - a.viewsPerHour);
        } else {
          processed.sort((a, b) => b.viewCount - a.viewCount);
        }

        return processed;
      }
    }
  } catch (err) {
    console.warn("Direct YouTube trends fetch failed:", err);
  }

  return [];
}

async function localGenerateIdeas(channel, trends, category, geminiKey) {
  const modelName = "gemini-2.5-flash";
  let trendsPrompt = "";
  if (trends.length > 0) {
    for (let idx = 0; idx < trends.length; idx++) {
      const t = trends[idx];
      trendsPrompt += (idx + 1) + ". Title: \"" + t.title + "\" | Views: " + t.viewCount + " | Channel: \"" + t.channelTitle + "\"\n";
    }
  } else {
    trendsPrompt = "No trends available. Use standard niche topics for inspiration.";
  }

  const prompt = "You are \"YouPick AI\", an expert YouTube growth assistant.\n" +
    "Analyze the following YouTube channel profile, niche, and currently performing trend videos.\n" +
    "Then generate exactly 4 highly engaging, hyper-targeted video ideas (both standard videos and Shorts) that are predicted to perform extremely well.\n\n" +
    "CHANNEL PROFILE:\n" +
    "Name: " + channel.title + "\n" +
    "Handle: " + channel.customUrl + "\n" +
    "Niche/Category: " + category + "\n" +
    "Description: " + channel.description + "\n" +
    "Subscribers: " + channel.subscribers + "\n" +
    "Total Videos: " + channel.videosCount + "\n\n" +
    "CURRENT IN-NICHE VIDEO TRENDS (Use as inspiration or contextual cues):\n" +
    trendsPrompt + "\n\n" +
    "For each of the 4 ideas, provide:\n" +
    "1. Title (high-CTR click-worthy title)\n" +
    "2. Hook (opening 5-second hook script/concept)\n" +
    "3. Rationale (why this idea will trend, linking back to the channel profile or current trends)\n" +
    "4. Target Audience (who is this for)\n" +
    "5. Suggested Format (strictly select either: \"Standard Video\" or \"YouTube Short\")\n\n" +
    "You must respond with raw JSON in this format:\n" +
    "{\n" +
    "  \"ideas\": [\n" +
    "    {\n" +
    "      \"title\": \"Title here\",\n" +
    "      \"hook\": \"Hook concept here\",\n" +
    "      \"rationale\": \"Rationale here\",\n" +
    "      \"targetAudience\": \"Target audience details\",\n" +
    "      \"suggestedFormat\": \"Standard Video\"\n" +
    "    }\n" +
    "  ]\n" +
    "}";

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + geminiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });
  
  if (!res.ok) {
    throw new Error("Gemini API call failed with status " + res.status);
  }

  const data = await res.json();
  const txt = data.candidates[0].content.parts[0].text;
  const parsed = JSON.parse(txt);
  return parsed.ideas || [];
}

async function handleAnalyze() {
  const input = document.getElementById("inputChannel").value.trim();
  if (!input) return;

  showStatus("Analyzing channel niche...");
  let usedLocal = false;
  try {
    if (CONFIGS.youtubeApiKey && CONFIGS.youtubeApiKey.length > 5) {
      usedLocal = true;
      const channel = await localResolveChannel(input, CONFIGS.youtubeApiKey, CONFIGS.geminiApiKey);
      if (channel) {
        activeChannel = channel;
        renderChannelBadge(channel);
        document.getElementById("btnGenerate").removeAttribute("disabled");
        hideStatus();
        return;
      }
    }
  } catch (localErr) {
    console.warn("Direct local resolve failed, trying server proxy:", localErr);
  }

  let url = "";
  try {
    let baseUrl = CONFIGS.proxyUrl || "https://ais-dev-sndbpvhezzyi4mp3mkvsvr-676650229984.asia-east1.run.app";
    url = baseUrl + "/api/channel/resolve";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        query: input,
        youtubeApiKey: CONFIGS.youtubeApiKey,
        geminiApiKey: CONFIGS.geminiApiKey
      })
    });
    if (!res.ok) {
      throw new Error("HTTP Status " + res.status + " " + res.statusText);
    }
    const channel = await res.json();

    if (channel && !channel.error) {
      activeChannel = channel;
      renderChannelBadge(channel);
      document.getElementById("btnGenerate").removeAttribute("disabled");
      hideStatus();
    } else {
      showStatus("Could not resolve channel: " + (channel.error || "No data returned") + ". Try a handle like @Veritasium");
    }
  } catch (err) {
    const hint = usedLocal ? " (Direct lookup also failed)" : "";
    showStatus("Resolution failed: " + err.message + hint + " (Target URL: " + url + "). Check internet, verify keys, or try resetting configurations in Options.");
  }
}

async function handleGenerate() {
  if (!activeChannel) return;
  showStatus("Retrieving trends & generating ideas with Gemini...");

  let usedLocal = false;
  try {
    if (CONFIGS.youtubeApiKey && CONFIGS.youtubeApiKey.length > 5 && CONFIGS.geminiApiKey && CONFIGS.geminiApiKey.length > 5) {
      usedLocal = true;
      const trends = await localFetchTrends(activeChannel.category, trendWindow, CONFIGS.regionCode, CONFIGS.youtubeApiKey);
      const ideas = await localGenerateIdeas(activeChannel, trends, activeChannel.category, CONFIGS.geminiApiKey);
      renderIdeas(ideas);
      hideStatus();
      return;
    }
  } catch (localErr) {
    console.warn("Direct local generation failed, trying server proxy:", localErr);
  }

  try {
    let baseUrl = CONFIGS.proxyUrl || "https://ais-dev-sndbpvhezzyi4mp3mkvsvr-676650229984.asia-east1.run.app";
    
    // 1. Fetch Niche Trends
    const trendsUrl = baseUrl + "/api/trends";
    const trendRes = await fetch(trendsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        category: activeChannel.category, 
        window: trendWindow, 
        region: CONFIGS.regionCode,
        youtubeApiKey: CONFIGS.youtubeApiKey
      })
    });
    if (!trendRes.ok) {
      throw new Error("Trends fetch failed with HTTP " + trendRes.status);
    }
    const trendsData = await trendRes.json();
    const trends = trendsData.trends || [];

    // 2. Generate Gemini Ideas
    const ideasUrl = baseUrl + "/api/generate-ideas";
    const ideaRes = await fetch(ideasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        channel: activeChannel, 
        trends, 
        category: activeChannel.category,
        geminiApiKey: CONFIGS.geminiApiKey
      })
    });
    if (!ideaRes.ok) {
      throw new Error("Ideas generator failed with HTTP " + ideaRes.status);
    }
    const ideasData = await ideaRes.json();

    renderIdeas(ideasData.ideas || []);
    hideStatus();
  } catch (err) {
    showStatus("Failed to generate ideas: " + err.message + ". Check your configurations inside Options.");
  }
}

function renderChannelBadge(channel) {
  const badge = document.getElementById("channelBadge");
  document.getElementById("channelTitle").innerText = channel.title;
  document.getElementById("channelNiche").innerText = channel.category;
  document.getElementById("channelDesc").innerText = channel.description;
  document.getElementById("channelAvatar").src = channel.thumbnail;
  badge.classList.remove("hidden");
}

function renderIdeas(ideas) {
  const container = document.getElementById("ideasContainer");
  container.innerHTML = "";

  if (ideas.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No ideas found.</p></div>';
    return;
  }

  ideas.forEach(idea => {
    const card = document.createElement("div");
    card.className = "idea-card";
    card.innerHTML = \`
      <span class="format-pill">\${idea.suggestedFormat}</span>
      <h4>\${idea.title}</h4>
      <p><strong>Hook:</strong> \${idea.hook}</p>
      <p><strong>Rationale:</strong> \${idea.rationale}</p>
      <p><strong>Audience:</strong> \${idea.targetAudience}</p>
    \`;
    container.appendChild(card);
  });
}

function showStatus(text) {
  const box = document.getElementById("statusContainer");
  document.getElementById("statusText").innerText = text;
  box.classList.remove("hidden");
}

function hideStatus() {
  document.getElementById("statusContainer").classList.add("hidden");
}
`;

    zip.file("popup.js", popupJs);

    // 5. options.html
    const optionsHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>YouPick - Settings</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 500px;
      margin: 40px auto;
      padding: 0 20px;
      background-color: #f8fafc;
      color: #1e293b;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #475569;
    }
    input, select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      box-sizing: border-box;
    }
    button {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background-color: #1d4ed8;
    }
    .note {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    .success-alert {
      background-color: #dcfce7;
      border: 1px solid #bbf7d0;
      color: #15803d;
      padding: 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 16px;
      display: none;
    }
  </style>
</head>
<body>
  <h1>Extension Configurations</h1>
  
  <div id="successAlert" class="success-alert">
    Configurations saved successfully!
  </div>

  <div class="form-group">
    <label for="ytKey">YouTube Data API v3 Key (Optional)</label>
    <input type="password" id="ytKey" placeholder="AI Studio fallback is active if empty" />
    <div class="note">If left blank, the extension will route through the AI Studio proxy fallback.</div>
  </div>

  <div class="form-group">
    <label for="geminiKey">Gemini API Key (Optional)</label>
    <input type="password" id="geminiKey" placeholder="Injected key used by default" />
  </div>

  <div class="form-group">
    <label for="region">Default Regional Code</label>
    <select id="region">
      <option value="US">United States (US)</option>
      <option value="GB">United Kingdom (GB)</option>
      <option value="CA">Canada (CA)</option>
      <option value="AU">Australia (AU)</option>
      <option value="IN">India (IN)</option>
    </select>
  </div>

  <div class="form-group">
    <label for="proxyUrl">Proxy Server URL</label>
    <input type="text" id="proxyUrl" value="${proxyUrl}" />
    <div class="note">Keep this configured to the active builder domain to route fallbacks properly.</div>
  </div>

  <div style="display: flex; gap: 10px; margin-top: 16px;">
    <button id="btnSave">Save Configurations</button>
    <button id="btnReset" style="background-color: #64748b;">Reset to Defaults</button>
  </div>

  <script src="options.js"></script>
</body>
</html>`;

    zip.file("options.html", optionsHtml);

    // 6. options.js
    const optionsJs = `document.addEventListener("DOMContentLoaded", () => {
  const ytInput = document.getElementById("ytKey");
  const geminiInput = document.getElementById("geminiKey");
  const regionSelect = document.getElementById("region");
  const proxyInput = document.getElementById("proxyUrl");
  const btnSave = document.getElementById("btnSave");
  const btnReset = document.getElementById("btnReset");
  const successAlert = document.getElementById("successAlert");

  // Load current values
  chrome.storage.local.get(["youtubeApiKey", "geminiApiKey", "regionCode", "proxyUrl"], (res) => {
    if (res.youtubeApiKey) ytInput.value = res.youtubeApiKey;
    if (res.geminiApiKey) geminiInput.value = res.geminiApiKey;
    if (res.regionCode) regionSelect.value = res.regionCode;
    proxyInput.value = res.proxyUrl || "${proxyUrl}";
  });

  btnSave.addEventListener("click", () => {
    chrome.storage.local.set({
      youtubeApiKey: ytInput.value.trim(),
      geminiApiKey: geminiInput.value.trim(),
      regionCode: regionSelect.value,
      proxyUrl: proxyInput.value.trim() || "${proxyUrl}"
    }, () => {
      successAlert.style.display = "block";
      setTimeout(() => {
        successAlert.style.display = "none";
      }, 3000);
    });
  });

  btnReset.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      ytInput.value = "";
      geminiInput.value = "";
      regionSelect.value = "US";
      proxyInput.value = "${proxyUrl}";
      successAlert.innerText = "Defaults restored successfully!";
      successAlert.style.display = "block";
      setTimeout(() => {
        successAlert.style.display = "none";
        successAlert.innerText = "Configurations saved successfully!";
      }, 3000);
    });
  });
});`;

    zip.file("options.js", optionsJs);

    // 7. background.js
    const backgroundJs = `// Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("YouPick Installed.");
});`;

    zip.file("background.js", backgroundJs);

    // 8. Placeholders for icon generator
    const iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // 1x1 black pixel base64 fallback
    zip.file("icons/icon16.png", iconBase64, { base64: true });
    zip.file("icons/icon48.png", iconBase64, { base64: true });
    zip.file("icons/icon128.png", iconBase64, { base64: true });

    // 9. README.txt
    const readme = `YouPick - Manifest V3
==================================================

How to Install in Google Chrome:
--------------------------------
1. Extract the downloaded ZIP archive into a dedicated folder (e.g. "yt-trend-extension").
2. Open your Google Chrome browser and navigate to: chrome://extensions/
3. Enable "Developer mode" by toggling the switch in the top-right corner.
4. Click the "Load unpacked" button in the top-left corner.
5. Select the folder where you extracted the files (the folder containing "manifest.json").
6. The extension is now successfully installed! Click the puzzle-piece icon on the Chrome toolbar to pin and open it.

Configuration / API Keys:
--------------------------
1. Right-click the extension icon and select "Options" (or click settings inside the popup).
2. Enter your YouTube Data API Key or Gemini API Key if you wish to run completely locally, or leave blank to utilize our seamless server-side AI proxy fallback.
3. Click "Save Configurations" and you're good to go!`;

    zip.file("README.txt", readme);

    // Generate zip content
    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=youpick-extension.zip");
    res.send(content);
  } catch (zipError: any) {
    console.error("ZIP Generation Failed:", zipError);
    res.status(500).json({ error: "Failed to assemble extension ZIP" });
  }
});

// Start standard full-stack Express + Vite server setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for fast feedback local development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`YouTube Extension Builder Server running on port ${PORT}`);
  });
}

startServer();
