
function qs(id){return document.getElementById(id);}
function qsa(sel){return Array.from(document.querySelectorAll(sel));}
function msg(type, payload={}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, ...payload }, res));
}
const params = new URLSearchParams(location.search);
const rid = params.get("rid");
const mode = params.get("mode") || "hard";

const quotes = [
  "Small habits compound into big results.",
  "Do the work now; thank yourself later.",
  "Focus is a muscle—this rep counts.",
  "Your future self is watching.",
  "Distraction is a choice; choose better.",
  "Every moment of resistance builds your willpower.",
  "Progress over perfection, always.",
  "Deep work creates extraordinary results.",
  "You didn't come this far to only come this far.",
  "The magic happens outside your comfort zone.",
  "Discipline is freedom in disguise.",
  "What you do today matters more than what you'll do tomorrow.",
  "Excellence is not an act, but a habit.",
  "The best time to focus was an hour ago. The second best time is now.",
  "Your attention is your most valuable currency.",
  "Consistency beats intensity every time.",
  "Champions are made when nobody's watching.",
  "The successful warrior is the average person with laser-like focus.",
  "Don't let perfect be the enemy of good.",
  "You are what you repeatedly do.",
  "Time wasted is existence; time used is life.",
  "Focus on progress, not perfection.",
  "The cave you fear to enter holds the treasure you seek.",
  "Success is the sum of small efforts repeated daily.",
  "Your only limit is your mind.",
  "Great things never come from comfort zones.",
  "Turn your wounds into wisdom.",
  "The expert in anything was once a beginner.",
  "It's not about being perfect, it's about being better.",
  "Every pro was once an amateur.",
  "The hardest part is starting. You've got this.",
  "One focused hour beats eight distracted ones.",
  "Your dreams don't work unless you do.",
  "Be stronger than your strongest excuse.",
  "The best investment is in yourself."
];

(async function main(){
  // Global variables for this scope
  let targetUrl = "";
  let currentRule = null;
  
  console.log("Block page loaded with params:", { rid, mode });
  
  // First, try to get the rule data
  if (rid && rid !== "__catchall__") {
    try {
      const settings = await msg("getSettings");
      currentRule = settings.rules.find(r => r.id === rid);
      console.log("Found rule:", currentRule);
    } catch (e) {
      console.error("Failed to get rule data:", e);
    }
  }
  
  // Try multiple methods to get the blocked URL
  console.log("Starting URL detection...");
  
  // Method 1: Check URL parameter (most reliable when available)
  const fromParam = params.get("u");
  if (fromParam) {
    targetUrl = decodeURIComponent(fromParam);
    console.log("Method 1 (URL param):", targetUrl);
  }
  
  // Method 2: Try to get from current tab
  if (!targetUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log("Current tab:", tab);
      if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
        targetUrl = tab.url;
        console.log("Method 2 (tab URL):", targetUrl);
      }
    } catch (e) {
      console.log("Method 2 failed:", e);
    }
  }
  
  // Method 3: Use document.referrer as fallback
  if (!targetUrl && document.referrer) {
    targetUrl = document.referrer;
    console.log("Method 3 (referrer):", targetUrl);
  }
  
  // Method 4: Try to reconstruct URL from rule pattern
  if (!targetUrl && currentRule && currentRule.pattern) {
    console.log("Attempting to reconstruct URL from rule pattern:", currentRule.pattern);
    if (currentRule.type === "wildcard" && currentRule.pattern.startsWith("*.")) {
      targetUrl = `https://${currentRule.pattern.slice(2)}`;
      console.log("Method 4a (wildcard):", targetUrl);
    } else if (currentRule.type === "exact") {
      targetUrl = `https://${currentRule.pattern}`;
      console.log("Method 4b (exact):", targetUrl);
    } else if (currentRule.type === "wildcard" && !currentRule.pattern.startsWith("*.")) {
      // Handle wildcard patterns without *. prefix
      targetUrl = `https://${currentRule.pattern}`;
      console.log("Method 4c (wildcard no prefix):", targetUrl);
    }
  }
  
  console.log("Final targetUrl:", targetUrl);
  
  // Display URL
  if (targetUrl && !targetUrl.startsWith('chrome-extension://')) {
    qs("url").textContent = targetUrl;
  } else {
    qs("url").textContent = "Blocked site";
  }
  
  // Clean up rule info display
  if (rid === "__catchall__") {
    qs("ruleInfo").textContent = "Site not in allowlist";
  } else if (mode === "soft") {
    qs("ruleInfo").textContent = "Soft block - continue after countdown";
  } else if (mode === "hard") {
    qs("ruleInfo").textContent = "Hard block - use temporary access if needed";
  } else {
    qs("ruleInfo").textContent = "";
  }

  // Log
  await msg("logBlocked", { url: targetUrl, rid });

  // Soft block countdown
  if (mode === "soft") {
    const soft = qs("softControls");
    const span = qs("count");
    const btn = qs("continueBtn");
    
    if (soft && span && btn) {
      soft.classList.remove("hidden");
      let n = 10;
      
      // Update initial display
      span.textContent = String(n);
      btn.disabled = true;
      
      const iv = setInterval(() => {
        n--;
        span.textContent = String(n);
        if (n <= 0) {
          clearInterval(iv);
          btn.disabled = false;
          btn.textContent = "Continue";
        }
      }, 1000);
      
      btn.addEventListener("click", async () => {
        // Clear any existing interval
        clearInterval(iv);
        // One-shot allow: remove DNR rule briefly and navigate
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = targetUrl || "about:blank";
        await msg("temporaryAllowForRule", { rid, url });
      });
    }
  }

  // Helper function to extract hostname from various sources
  function extractHostname() {
    console.log("Extracting hostname...");
    let hostname = "";
    
    // Method 1: Try to get hostname from targetUrl
    if (targetUrl) {
      try {
        const u = new URL(targetUrl);
        hostname = u.hostname.toLowerCase();
        console.log("Hostname from targetUrl:", hostname);
        return hostname;
      } catch (e) {
        console.log("Could not parse targetUrl:", e);
      }
    }
    
    // Method 2: Extract from rule pattern
    if (currentRule && currentRule.pattern) {
      console.log("Extracting hostname from rule pattern:", currentRule.pattern);
      
      if (currentRule.type === "wildcard" && currentRule.pattern.startsWith("*.")) {
        hostname = currentRule.pattern.slice(2).toLowerCase();
        console.log("Hostname from wildcard pattern:", hostname);
      } else if (currentRule.type === "exact") {
        hostname = currentRule.pattern.toLowerCase();
        console.log("Hostname from exact pattern:", hostname);
      } else if (currentRule.type === "wildcard") {
        // Handle wildcard without *. prefix
        hostname = currentRule.pattern.toLowerCase();
        console.log("Hostname from wildcard (no prefix):", hostname);
      }
      
      // Clean up hostname (remove protocol, path, etc.)
      if (hostname) {
        hostname = hostname.replace(/^https?:\/\//, '');
        hostname = hostname.replace(/\/.*$/, '');
        hostname = hostname.replace(/:.*$/, '');
        console.log("Cleaned hostname:", hostname);
      }
    }
    
    // Method 3: Try to re-fetch rule data if currentRule is null
    if (!hostname && rid && rid !== "__catchall__" && !currentRule) {
      console.log("Attempting to re-fetch rule data for hostname extraction");
      // This will be handled in the async click handler
    }
    
    return hostname;
  }

  // Overrides
  qsa("#overrideControls button").forEach(b => {
    b.addEventListener("click", async () => {
      const minutes = parseInt(b.getAttribute("data-min"), 10);
      console.log(`Override button clicked: ${minutes} minutes`);
      
      let hostname = extractHostname();
      
      // If we still don't have hostname, try to re-fetch rule data
      if (!hostname && rid && rid !== "__catchall__") {
        console.log("Re-fetching rule data for hostname extraction");
        try {
          const settings = await msg("getSettings");
          const rule = settings.rules.find(r => r.id === rid);
          console.log("Re-fetched rule:", rule);
          
          if (rule && rule.pattern) {
            if (rule.type === "wildcard" && rule.pattern.startsWith("*.")) {
              hostname = rule.pattern.slice(2).toLowerCase();
            } else if (rule.type === "exact") {
              hostname = rule.pattern.toLowerCase();
            } else if (rule.type === "wildcard") {
              hostname = rule.pattern.toLowerCase();
            }
            
            // Clean up hostname
            if (hostname) {
              hostname = hostname.replace(/^https?:\/\//, '');
              hostname = hostname.replace(/\/.*$/, '');
              hostname = hostname.replace(/:.*$/, '');
            }
            console.log("Extracted hostname from re-fetched rule:", hostname);
          }
        } catch (e) {
          console.error("Failed to re-fetch rule data:", e);
        }
      }
      
      if (!hostname) {
        console.error("No hostname available for override. Debug info:", {
          targetUrl,
          currentRule,
          rid,
          mode
        });
        alert("Cannot set temporary access - unable to determine website");
        return;
      }
      
      console.log(`Setting override for hostname: ${hostname}, minutes: ${minutes}`);
      
      const result = await msg("overrideHostname", { 
        hostname, 
        minutes, 
        url: targetUrl || `https://${hostname}` 
      });
      
      if (result.ok) {
        console.log(`Override set until: ${new Date(result.until)}`);
        // Navigate to the site
        const navigateUrl = targetUrl || `https://${hostname}`;
        console.log("Navigating to:", navigateUrl);
        window.location.href = navigateUrl;
      } else {
        console.error("Override failed:", result.error);
        alert("Failed to set temporary access: " + (result.error || "Unknown error"));
      }
    });
  });

  qs("backBtn").addEventListener("click", () => history.back());
  qs("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Quote
  const q = quotes[Math.floor(Math.random()*quotes.length)];
  qs("quote").textContent = q;
})();
