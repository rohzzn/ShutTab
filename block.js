
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const urlText = tab?.openerTabId ? document.referrer : document.referrer; // not always reliable
  // Better: use chrome.tabs.getCurrent not supported; show placeholder
  let targetUrl = document.referrer || "";
  if (!targetUrl) {
    // Try to get it from history: not allowed. Use hash param if available
    const fromParam = params.get("u");
    if (fromParam) targetUrl = decodeURIComponent(fromParam);
  }
  qs("url").textContent = targetUrl || "(unknown URL)";
  qs("ruleInfo").textContent = rid && rid !== "__catchall__" ? `Matched rule: ${rid} (${mode})` : (rid === "__catchall__" ? "Allowlist mode: site not allowed" : "");

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
      const u = new URL(targetUrl || "https://example.com");
      await msg("overrideHostname", { hostname: u.hostname, minutes, url: targetUrl });
    });
  });

  qs("backBtn").addEventListener("click", () => history.back());
  qs("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Quote
  const q = quotes[Math.floor(Math.random()*quotes.length)];
  qs("quote").textContent = q;
})();
