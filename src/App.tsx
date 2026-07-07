import React, { useState, useEffect } from "react";
import { STATIC_TRENDS } from "./staticTrends";
import { 
  Sparkles, 
  Chrome, 
  Download, 
  Settings, 
  Play, 
  Check, 
  Trash, 
  Bookmark, 
  Flame, 
  Eye, 
  BookOpen, 
  ArrowRight, 
  Clock, 
  Globe, 
  Search, 
  Youtube, 
  TrendingUp, 
  Copy, 
  FileCode, 
  ChevronRight,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChannelInfo, VideoTrend, VideoIdea, ExtensionConfig } from "./types";

export default function App() {
  // Channel & Niche Selection States
  const [channelQuery, setChannelQuery] = useState("");
  const [activeChannel, setActiveChannel] = useState<ChannelInfo | null>(null);
  const [trendWindow, setTrendWindow] = useState<"24h" | "7d">("24h");
  const [selectedNiche, setSelectedNiche] = useState("tech");
  
  // Data States
  const [nicheTrends, setNicheTrends] = useState<VideoTrend[]>([]);
  const [generatedIdeas, setGeneratedIdeas] = useState<VideoIdea[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<VideoIdea[]>([]);
  
  // Loading States
  const [resolvingChannel, setResolvingChannel] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Chrome Extension Configuration & Exporter States
  const [configs, setConfigs] = useState<ExtensionConfig>({
    youtubeApiKey: "",
    geminiApiKey: "",
    useProxy: true,
    proxyUrl: window.location.origin,
    regionCode: "US"
  });
  const [exporting, setExporting] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"manifest" | "popupJs" | "popupHtml">("manifest");
  const [copiedCode, setCopiedCode] = useState(false);

  // Simulated activation states
  const [isSimulatorActivated, setIsSimulatorActivated] = useState(false);
  const [simYtKey, setSimYtKey] = useState("");
  const [simGeminiKey, setSimGeminiKey] = useState("");
  const [simRegion, setSimRegion] = useState("US");
  const [simProxyUrl, setSimProxyUrl] = useState(window.location.origin);

  // Load saved simulator states & ideas from local storage
  useEffect(() => {
    const saved = localStorage.getItem("yt_ideas_saved");
    if (saved) {
      try {
        setSavedIdeas(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    // Restore simulator active channel
    const savedChannel = localStorage.getItem("yt_active_channel");
    if (savedChannel) {
      try {
        const parsed = JSON.parse(savedChannel);
        setActiveChannel(parsed);
        setChannelQuery(parsed.customUrl || parsed.title || "");
      } catch (e) {
        console.error(e);
      }
    }

    // Restore simulator generated ideas
    const savedGenIdeas = localStorage.getItem("yt_generated_ideas");
    if (savedGenIdeas) {
      try {
        setGeneratedIdeas(JSON.parse(savedGenIdeas));
      } catch (e) {
        console.error(e);
      }
    }

    // Restore simulator selected niche & trend window
    const savedNiche = localStorage.getItem("yt_selected_niche") || "tech";
    const savedWindow = (localStorage.getItem("yt_trend_window") as "24h" | "7d") || "24h";
    
    setSelectedNiche(savedNiche);
    setTrendWindow(savedWindow);

    // Fetch initial trends based on restored values
    fetchTrends(savedNiche, savedWindow);
  }, []);

  const fetchTrends = async (category: string, windowVal: "24h" | "7d") => {
    setLoadingTrends(true);
    let success = false;
    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          category, 
          window: windowVal, 
          region: configs.regionCode,
          youtubeApiKey: configs.youtubeApiKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trends && data.trends.length > 0) {
          setNicheTrends(data.trends);
          success = true;
        }
      }
    } catch (err) {
      console.warn("API trends fetch failed, falling back to static client-side trends:", err);
    }

    if (!success) {
      // Fallback to static client trends
      const finalCategory = (category || "tech").toLowerCase().trim();
      const localData = STATIC_TRENDS[finalCategory] || STATIC_TRENDS["tech"];
      const fallbackTrends = localData.map((v, idx) => {
        const publishedAtDate = new Date();
        publishedAtDate.setHours(publishedAtDate.getHours() - (idx * 4 + 2));
        const publishedAt = publishedAtDate.toISOString();
        const hoursSincePublished = Math.max(1, (Date.now() - publishedAtDate.getTime()) / (1000 * 60 * 60));
        const factor = windowVal === "24h" ? 0.4 : 1.2;
        const viewCount = Math.round(v.viewCount * factor);
        const viewsPerHour = Math.round(viewCount / hoursSincePublished);

        return {
          id: "local_trend_" + finalCategory + "_" + idx,
          title: v.title,
          url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
          thumbnail: v.thumbnail,
          viewCount,
          publishedAt,
          viewsPerHour,
          channelTitle: v.channelTitle,
        };
      });
      setNicheTrends(fallbackTrends);
    }
    setLoadingTrends(false);
  };

  const handleResolveChannel = async (queryStr: string) => {
    if (!queryStr.trim()) return;
    setResolvingChannel(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/channel/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: queryStr,
          youtubeApiKey: configs.youtubeApiKey,
          geminiApiKey: configs.geminiApiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        setErrorText(data.error);
      } else {
        setActiveChannel(data);
        localStorage.setItem("yt_active_channel", JSON.stringify(data));
        // Automatically sync niche list to channel's category
        setSelectedNiche(data.category);
        localStorage.setItem("yt_selected_niche", data.category);
        fetchTrends(data.category, trendWindow);
      }
    } catch (err) {
      setErrorText("Failed to resolve channel details. Backend fallback active.");
    } finally {
      setResolvingChannel(false);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!activeChannel) return;
    setGeneratingIdeas(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: activeChannel,
          trends: nicheTrends,
          category: selectedNiche,
          geminiApiKey: configs.geminiApiKey,
          youtubeApiKey: configs.youtubeApiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        setErrorText(data.error);
      } else if (data.ideas) {
        setGeneratedIdeas(data.ideas);
        localStorage.setItem("yt_generated_ideas", JSON.stringify(data.ideas));
      }
    } catch (err) {
      setErrorText("Failed to generate custom ideas via Gemini. Please try again.");
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const saveIdea = (idea: VideoIdea) => {
    if (savedIdeas.some(i => i.id === idea.id)) return;
    const updated = [idea, ...savedIdeas];
    setSavedIdeas(updated);
    localStorage.setItem("yt_ideas_saved", JSON.stringify(updated));
  };

  const removeSavedIdea = (id: string) => {
    const updated = savedIdeas.filter(i => i.id !== id);
    setSavedIdeas(updated);
    localStorage.setItem("yt_ideas_saved", JSON.stringify(updated));
  };

  const handleDownloadZip = () => {
    setExporting(true);
    const query = new URLSearchParams({
      ytKey: configs.youtubeApiKey,
      geminiKey: configs.geminiApiKey,
      proxyUrl: configs.proxyUrl,
      region: configs.regionCode
    }).toString();

    // Trigger direct browser download
    window.location.href = `/api/extension/download?${query}`;
    
    setTimeout(() => {
      setExporting(false);
    }, 2000);
  };

  // Niche Tab change handler
  const handleNicheChange = (niche: string) => {
    setSelectedNiche(niche);
    localStorage.setItem("yt_selected_niche", niche);
    fetchTrends(niche, trendWindow);
  };

  const handleWindowChange = (win: "24h" | "7d") => {
    setTrendWindow(win);
    localStorage.setItem("yt_trend_window", win);
    fetchTrends(selectedNiche, win);
  };

  const copyCodeToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Mock code strings for code viewer tab
  const CODE_SNIPPETS = {
    manifest: `{
  "manifest_version": 3,
  "name": "YouPick",
  "version": "1.0.0",
  "description": "Extract high-velocity YouTube trends and auto-generate custom video ideas using Gemini AI.",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://*.run.app/",
    "https://www.googleapis.com/"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options.html",
  "background": {
    "service_worker": "background.js"
  }
}`,
    popupJs: `// Prefilled API configurations
const CONFIGS = {
  youtubeApiKey: "${configs.youtubeApiKey || "AI_STUDIO_PROXY_ACTIVE"}",
  geminiApiKey: "${configs.geminiApiKey || "AI_STUDIO_PROXY_ACTIVE"}",
  regionCode: "${configs.regionCode}",
  proxyUrl: "${configs.proxyUrl}"
};

async function handleAnalyze() {
  const handle = document.getElementById("inputChannel").value;
  showStatus("Resolving channel niche...");
  
  const res = await fetch(\`\${CONFIGS.proxyUrl}/api/channel/resolve\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: handle })
  });
  const channel = await res.json();
  renderChannelBadge(channel);
}

async function handleGenerate() {
  showStatus("Fetching velocity trends...");
  const trendsRes = await fetch(\`\${CONFIGS.proxyUrl}/api/trends\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: activeChannel.category })
  });
  const trends = await trendsRes.json();
  
  showStatus("Thinking with Gemini...");
  const ideasRes = await fetch(\`\${CONFIGS.proxyUrl}/api/generate-ideas\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, trends })
  });
  renderIdeas(await ideasRes.json());
}`,
    popupHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header class="app-header">
      <h1>YouPick</h1>
    </header>
    <main>
      <input type="text" id="inputChannel" placeholder="@Veritasium" />
      <button id="btnAnalyze">Analyze</button>
      <div id="ideasContainer"></div>
    </main>
  </div>
  <script src="popup.js"></script>
</body>
</html>`
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* Premium Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-md shrink-0">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center border-2 border-white shadow-sm">
              <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight flex items-center gap-2">
              YouPick <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full border border-indigo-100">Chrome Extension Factory</span>
            </h1>
            <p className="text-xs text-slate-500">Design, Simulate, and Compile Your Manifest V3 Growth Extension</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            {process.env.YOUTUBE_API_KEY ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                YouTube API: Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                AI Proxy Sandbox Fallback
              </span>
            )}
          </div>
          <button 
            onClick={handleDownloadZip}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-sm hover:shadow"
          >
            <Download className="w-4 h-4" />
            <span>Export Extension ZIP</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Extension Simulator & Setup (5/12 grid) */}
        <section className="lg:col-span-5 space-y-8">
          
          {/* Section Heading */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500 tracking-wider uppercase flex items-center gap-2">
              <Chrome className="w-4 h-4 text-slate-400" />
              Live Extension Simulator
            </h2>
            <span className="text-xs text-indigo-500 font-medium">Fully Interactive</span>
          </div>

          {/* Interactive Chrome Extension Simulator Canvas */}
          <div className="bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-800 relative max-w-[420px] mx-auto">
            {/* Simulated Chrome Browser Frame Elements */}
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
              <div className="bg-slate-800 text-[10px] text-slate-400 font-mono px-3 py-0.5 rounded-full flex items-center gap-1">
                <Globe className="w-2.5 h-2.5 text-slate-500" />
                chrome-extension://youpick/popup.html
              </div>
              <div className="w-4"></div>
            </div>

            {/* Extension Popup Body Frame */}
            <div className="bg-white rounded-xl overflow-hidden shadow-inner flex flex-col min-h-[500px]">
              
              {/* Simulated Extension Header */}
              <header className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-sm shrink-0">
                    <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 flex items-center justify-center border border-slate-950">
                      <Check className="w-1.5 h-1.5 text-slate-950 stroke-[3]" />
                    </div>
                  </div>
                  <span className="font-semibold text-xs tracking-tight">YouPick</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsSimulatorActivated(!isSimulatorActivated)}
                    className="text-slate-400 hover:text-white text-[9px] bg-slate-850 hover:bg-slate-800 px-2 py-0.5 rounded transition"
                    title="Toggle setup / dashboard screen"
                  >
                    {isSimulatorActivated ? "Reset Activation" : "Skip Setup"}
                  </button>
                  <button 
                    onClick={() => {
                      const el = document.getElementById("config-card");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-slate-400 hover:text-white transition"
                    title="Extension Options"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </header>

              {/* Simulated Extension Main Body */}
              <main className="p-4 flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[440px]">
                
                {!isSimulatorActivated ? (
                  /* Activation Onboarding View */
                  <div className="space-y-4 py-1">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        Activate YouPick Extension
                      </div>
                      <p className="text-[11px] text-indigo-700 leading-normal">
                        Welcome to YouPick! To activate and unlock the real-time YouTube growth panel, configure your credentials below.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">YouTube Data API Key (Optional)</label>
                        </div>
                        <input
                          type="password"
                          value={simYtKey}
                          onChange={(e) => setSimYtKey(e.target.value)}
                          placeholder="Leave empty for proxy fallback"
                          className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                        <div className="bg-amber-50 border border-amber-100/70 rounded-lg p-2 text-[10.5px] text-amber-800 space-y-1 mt-1">
                          <p className="font-semibold flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                            How to get YouTube API Key:
                          </p>
                          <ol className="list-decimal pl-3.5 space-y-0.5 text-[10px] text-amber-700 leading-tight">
                            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a>.</li>
                            <li>Enable the <strong className="text-amber-900">"YouTube Data API v3"</strong>.</li>
                            <li>Navigate to <strong className="text-amber-900">Credentials</strong> & click <strong className="text-amber-900">Create Credentials &gt; API Key</strong>.</li>
                          </ol>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gemini API Key (Optional)</label>
                        <input
                          type="password"
                          value={simGeminiKey}
                          onChange={(e) => setSimGeminiKey(e.target.value)}
                          placeholder="Bake custom API key (optional)"
                          className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Regional Market</label>
                          <select
                            value={simRegion}
                            onChange={(e) => setSimRegion(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="US">United States (US)</option>
                            <option value="GB">United Kingdom (GB)</option>
                            <option value="CA">Canada (CA)</option>
                            <option value="AU">Australia (AU)</option>
                            <option value="IN">India (IN)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Proxy Connection</label>
                          <input
                            type="text"
                            value={simProxyUrl}
                            onChange={(e) => setSimProxyUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-slate-50 border border-slate-200 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition truncate"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsSimulatorActivated(true);
                        setConfigs({
                          ...configs,
                          youtubeApiKey: simYtKey,
                          geminiApiKey: simGeminiKey,
                          regionCode: simRegion,
                          proxyUrl: simProxyUrl
                        });
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Activate & Open YouPick</span>
                    </button>
                  </div>
                ) : (
                  /* Main Activated View */
                  <>
                    {/* 1. Channel Input Box */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Connect YouTube Channel</label>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input 
                            type="text" 
                            value={channelQuery}
                            onChange={(e) => setChannelQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleResolveChannel(channelQuery)}
                            placeholder="Enter channel handle (e.g. @MrBeast)"
                            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-8 pr-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                          />
                        </div>
                        <button 
                          onClick={() => handleResolveChannel(channelQuery)}
                          disabled={resolvingChannel}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium px-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center min-w-[64px]"
                        >
                          {resolvingChannel ? "Analysing..." : "Analyze"}
                        </button>
                      </div>
                    </div>

                    {/* Status Box or Error Alert */}
                    {errorText && (
                      <div className="bg-rose-50 border border-rose-100 text-[11px] text-rose-700 p-2.5 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                        <span>{errorText}</span>
                      </div>
                    )}

                    {/* 2. Channel Identity Badge (Visible when loaded) */}
                    <AnimatePresence mode="wait">
                      {activeChannel ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              src={activeChannel.thumbnail} 
                              alt="Avatar" 
                              className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-xs text-slate-800 truncate">{activeChannel.title}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                  {activeChannel.category}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono truncate">{activeChannel.customUrl}</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed italic">
                            "{activeChannel.description || "No description provided."}"
                          </p>
                          
                          {/* Subscriber Counter Stats bar */}
                          <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2 text-[10px] text-slate-500">
                            <div>
                              <span className="block text-slate-400">Subscribers</span>
                              <span className="font-mono font-semibold text-slate-700">{activeChannel.subscribers || "N/A"}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400">Videos Count</span>
                              <span className="font-mono font-semibold text-slate-700">{activeChannel.videosCount || "N/A"}</span>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs"
                        >
                          No YouTube channel resolved yet. Search a channel name or handle above to begin.
                        </motion.div>
                      )}
                    </AnimatePresence>

                     {/* 3. Trend Configuration Window Controls */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[11px] font-medium text-slate-600">Lookback Performance:</span>
                      <div className="bg-slate-100 p-0.5 rounded-lg flex">
                        <button 
                          onClick={() => handleWindowChange("24h")}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition ${trendWindow === "24h" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          Today
                        </button>
                        <button 
                          onClick={() => handleWindowChange("7d")}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition ${trendWindow === "7d" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          This Week
                        </button>
                      </div>
                    </div>

                    {/* Simulator Niche Trends List */}
                    {activeChannel && (
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Niche Trends ({activeChannel.category})
                        </span>
                        {loadingTrends ? (
                          <div className="text-center py-4 text-xs text-slate-400">Loading trends...</div>
                        ) : nicheTrends.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">No trends found.</div>
                        ) : (
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {nicheTrends.map((trend: any) => {
                              const viewStr = Number(trend.viewCount || 0).toLocaleString();
                              const vphStr = trend.viewsPerHour ? `${trend.viewsPerHour}/hr` : "";
                              return (
                                <div key={trend.id || trend.title} className="flex gap-2 items-center bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg p-1.5 transition">
                                  <img 
                                    className="w-12 h-8 rounded object-cover bg-slate-200 flex-shrink-0" 
                                    src={trend.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"} 
                                    alt="Thumb" 
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="min-width-0 flex-1 overflow-hidden">
                                    <h4 className="text-[11px] font-medium text-slate-800 truncate">
                                      <a href={trend.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                                        {trend.title}
                                      </a>
                                    </h4>
                                    <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                                      <span className="truncate max-w-[100px]">{trend.channelTitle}</span>
                                      <span>
                                        {viewStr} views {vphStr && <span className="text-emerald-500 font-semibold ml-1">{vphStr}</span>}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. Action Button for AI Suggestion Generator */}
                    <button 
                      onClick={handleGenerateIdeas}
                      disabled={!activeChannel || generatingIdeas}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{generatingIdeas ? "Consulting Gemini AI..." : "Generate Custom Ideas"}</span>
                    </button>

                    {/* 5. Suggestions Stream */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Generated Video Ideas</h3>
                      
                      <div className="space-y-3">
                        {generatingIdeas ? (
                          <div className="space-y-2.5 py-4">
                            <div className="h-10 bg-slate-100 rounded-lg animate-pulse"></div>
                            <div className="h-16 bg-slate-100 rounded-lg animate-pulse"></div>
                            <p className="text-[10px] text-slate-400 text-center italic">Gemini is synthesizing views-per-hour metrics...</p>
                          </div>
                        ) : generatedIdeas.length > 0 ? (
                          generatedIdeas.map((idea, idx) => (
                            <div key={idea.id} className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm relative group space-y-1.5">
                              <span className={`absolute top-2.5 right-2.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${idea.suggestedFormat === "shorts" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
                                {idea.suggestedFormat === "shorts" ? "Shorts" : "Long Form"}
                              </span>
                              
                              <h5 className="font-semibold text-xs text-slate-800 pr-14 leading-snug">{idea.title}</h5>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                <span className="font-bold text-slate-800">Hook:</span> {idea.hook}
                              </p>
                              <p className="text-[11px] text-slate-500 line-clamp-1 leading-normal">
                                <span className="font-bold text-slate-700">Audience:</span> {idea.targetAudience}
                              </p>

                              {/* Quick save button */}
                              <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                                <span className="text-[9px] text-indigo-500 font-medium">Derived from current category trends</span>
                                <button 
                                  onClick={() => saveIdea(idea)}
                                  className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-0.5 transition"
                                >
                                  <Bookmark className="w-3 h-3" />
                                  Save Concept
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-100 rounded-xl">
                            Click "Generate Custom Ideas" above to load suggestions.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </main>

              {/* Simulated Extension Footer */}
              <footer className="bg-slate-50 px-4 py-2 text-center text-[9px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
                <span>v1.0.0 (Manifest V3)</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Node Sync
                </span>
              </footer>

            </div>
          </div>

          {/* Quick-Guide Block: How to load the extension */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500" />
              Developer Installation Steps
            </h3>
            <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
              <li>Configure your optional keys in the <strong className="text-slate-800">Extension Compiler</strong> card below.</li>
              <li>Click the top-right <strong className="text-slate-800">"Export Extension ZIP"</strong> button.</li>
              <li>Unzip the downloaded archive onto your local desktop computer.</li>
              <li>Open Chrome and navigate to <code className="bg-slate-100 text-slate-700 px-1 rounded">chrome://extensions/</code>.</li>
              <li>Activate <strong className="text-slate-800">Developer Mode</strong> (top right toggle) and click <strong className="text-slate-800">"Load Unpacked"</strong>.</li>
              <li>Select your extracted folder to run the extension natively inside Chrome!</li>
            </ol>
          </div>

        </section>

        {/* Right Column: Dynamic Trends Browser, Saved Ideas, and Source Codes (7/12 grid) */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* Main Workspace Headers */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Trends Analytics & Growth Desk</h2>
            <p className="text-sm text-slate-500">Examine current high-velocity video patterns across categories to feed Gemini ideation</p>
          </div>

          {/* Dashboard Module 1: Live Niche Trends Browser */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Category Nav Tab */}
            <div className="bg-slate-50/50 border-b border-slate-200/80 p-4 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#ff0000]" />
                <span className="font-semibold text-sm">High-Velocity Trend Feeds</span>
              </div>
              
              {/* Window toggle */}
              <div className="text-xs text-slate-400">
                Sorted by {trendWindow === "24h" ? "Views" : "Views Per Hour (VPH)"}
              </div>
            </div>

            {/* Quick Niches Toggle Buttons */}
            <div className="px-4 py-2.5 bg-slate-50/20 border-b border-slate-200/50 flex flex-wrap gap-1.5">
              {["tech", "gaming", "finance", "cooking", "lifestyle", "travel", "kids"].map((niche) => (
                <button
                  key={niche}
                  onClick={() => handleNicheChange(niche)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition capitalize ${selectedNiche === niche ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}
                >
                  {niche}
                </button>
              ))}
            </div>

            {/* Videos Trend List Grid */}
            <div className="p-4">
              {loadingTrends ? (
                <div className="space-y-3 py-6">
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse"></div>
                </div>
              ) : nicheTrends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nicheTrends.map((trend) => (
                    <div key={trend.id} className="flex bg-slate-50 border border-slate-150 p-2.5 rounded-xl gap-3 hover:border-slate-300 transition group relative">
                      <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 relative bg-slate-200">
                        <img 
                          src={trend.thumbnail} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition">
                            <a href={trend.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {trend.title}
                            </a>
                          </h4>
                          <span className="text-[10px] text-slate-500 block truncate mt-0.5">{trend.channelTitle}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1 font-mono">
                          <span>{Number(trend.viewCount).toLocaleString()} views</span>
                          <span className="text-emerald-600 font-semibold">{trend.viewsPerHour}/hr</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No trends loaded for this category.
                </div>
              )}
            </div>

          </div>

          {/* Dashboard Module 2: Saved Content Concepts Library */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-500" />
                Your Saved Video Concepts ({savedIdeas.length})
              </h3>
              {savedIdeas.length > 0 && (
                <button 
                  onClick={() => {
                    setSavedIdeas([]);
                    localStorage.removeItem("yt_ideas_saved");
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 transition font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {savedIdeas.length > 0 ? (
                savedIdeas.map((idea) => (
                  <div key={idea.id} className="bg-slate-50/50 border border-slate-200 p-4 rounded-xl flex items-start gap-4 hover:bg-slate-50 transition">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${idea.suggestedFormat === "shorts" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>
                          {idea.suggestedFormat === "shorts" ? "Shorts" : "Long Form"}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-800">{idea.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Hook:</span> {idea.hook}</p>
                      <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Audience:</span> {idea.targetAudience}</p>
                    </div>
                    
                    <button 
                      onClick={() => removeSavedIdea(idea.id)}
                      className="text-slate-400 hover:text-rose-600 transition p-1"
                      title="Delete Concept"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Save suggestions from the simulator on the left to organize your channel pipeline.
                </div>
              )}
            </div>
          </div>

          {/* Dashboard Module 3: Extension Key Prefills & Compiler Card */}
          <div id="config-card" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Extension Pre-compiler & Credentials</h3>
              <p className="text-xs text-slate-500">Inject custom keys or proxy paths directly into the downloaded ZIP extension package</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">YouTube Data API Key (Optional)</label>
                <input 
                  type="password" 
                  value={configs.youtubeApiKey}
                  onChange={(e) => setConfigs({ ...configs, youtubeApiKey: e.target.value })}
                  placeholder="Leave empty for sandbox proxy fallback"
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block leading-tight">If blank, extension falls back automatically to secure AI Studio proxy.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Gemini API Key (Optional)</label>
                <input 
                  type="password" 
                  value={configs.geminiApiKey}
                  onChange={(e) => setConfigs({ ...configs, geminiApiKey: e.target.value })}
                  placeholder="Prefills options page"
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block leading-tight">Optionally bake a standalone Gemini API key into options.html pre-set.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Default Regional Market</label>
                <select
                  value={configs.regionCode}
                  onChange={(e) => setConfigs({ ...configs, regionCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="US">United States (US)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="IN">India (IN)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Proxy Server Connection URL</label>
                <input 
                  type="text" 
                  value={configs.proxyUrl}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-xs text-slate-500 rounded-lg px-3 py-2.5 cursor-not-allowed"
                />
              </div>
            </div>

            <button 
              onClick={handleDownloadZip}
              disabled={exporting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? "Assembling Extension ZIP File..." : "Compile & Download ZIP Extension Packet"}</span>
            </button>
          </div>

          {/* Dashboard Module 4: Live Code Visualizer */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-xs text-slate-300">ZIP File Inspection Hub</span>
              </div>
              <button 
                onClick={() => copyCodeToClipboard(CODE_SNIPPETS[activeCodeTab])}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-md flex items-center gap-1.5 transition active:scale-95"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
              </button>
            </div>

            {/* Code Tabs Selector */}
            <div className="bg-slate-950/40 border-b border-slate-800/60 px-4 flex gap-2">
              {(["manifest", "popupJs", "popupHtml"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`py-2 px-3 text-xs font-mono border-b-2 transition ${activeCodeTab === tab ? "border-indigo-500 text-white font-medium" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                >
                  {tab === "manifest" ? "manifest.json" : tab === "popupJs" ? "popup.js" : "popup.html"}
                </button>
              ))}
            </div>

            {/* Visual Code Box */}
            <div className="p-4">
              <pre className="text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[350px] whitespace-pre">
                {CODE_SNIPPETS[activeCodeTab]}
              </pre>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
}
