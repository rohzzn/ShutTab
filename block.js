
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
  "Distraction is a choice; choose better."
];

(async function main(){
  // Try multiple methods to get the blocked URL
  let targetUrl = "";
  
  // Method 1: Check URL parameter (most reliable when available)
  const fromParam = params.get("u");
  if (fromParam) {
    targetUrl = decodeURIComponent(fromParam);
  }
  
  // Method 2: Try to get from current tab
  if (!targetUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
        targetUrl = tab.url;
      }
    } catch (e) {
      console.log("Cannot access tab URL:", e);
    }
  }
  
  // Method 3: Use document.referrer as fallback
  if (!targetUrl) {
    targetUrl = document.referrer || "";
  }
  
  // Method 4: Try to reconstruct URL from rule pattern if we have it
  if (!targetUrl && rid && rid !== "__catchall__") {
    try {
      const settings = await msg("getSettings");
      const rule = settings.rules.find(r => r.id === rid);
      if (rule && rule.pattern) {
        if (rule.type === "wildcard" && rule.pattern.startsWith("*.")) {
          targetUrl = `https://${rule.pattern.slice(2)}`;
        } else if (rule.type === "exact") {
          targetUrl = `https://${rule.pattern}`;
        }
      }
    } catch (e) {
      console.log("Cannot reconstruct URL from rule:", e);
    }
  }
  
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

  // Overrides
  qsa("#overrideControls button").forEach(b => {
    b.addEventListener("click", async () => {
      const minutes = parseInt(b.getAttribute("data-min"), 10);
      
      let hostname = "";
      
      // Try to get hostname from targetUrl
      if (targetUrl) {
        try {
          const u = new URL(targetUrl);
          hostname = u.hostname.toLowerCase();
        } catch (e) {
          console.log("Could not parse targetUrl, trying rule pattern");
        }
      }
      
      // If we couldn't get hostname from URL, try to get it from the rule pattern
      if (!hostname && rid && rid !== "__catchall__") {
        try {
          const settings = await msg("getSettings");
          const rule = settings.rules.find(r => r.id === rid);
          if (rule && rule.pattern) {
            if (rule.type === "wildcard" && rule.pattern.startsWith("*.")) {
              hostname = rule.pattern.slice(2).toLowerCase();
            } else if (rule.type === "exact") {
              hostname = rule.pattern.toLowerCase();
            }
          }
        } catch (e) {
          console.log("Could not get hostname from rule pattern");
        }
      }
      
      if (!hostname) {
        console.error("No hostname available for override");
        alert("Cannot set temporary access - hostname unknown");
        return;
      }
      
      console.log(`Setting override for hostname: ${hostname}, minutes: ${minutes}`);
      
      const result = await msg("overrideHostname", { hostname, minutes, url: targetUrl || `https://${hostname}` });
      if (result.ok) {
        console.log(`Override set until: ${new Date(result.until)}`);
        // Show success and navigate
        window.location.href = targetUrl || `https://${hostname}`;
      } else {
        console.error("Override failed:", result.error);
        alert("Failed to set temporary access");
      }
    });
  });

  qs("backBtn").addEventListener("click", () => history.back());
  qs("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Quote
  const q = quotes[Math.floor(Math.random()*quotes.length)];
  qs("quote").textContent = q;
})();
