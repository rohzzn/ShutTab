
const enabledToggle = document.getElementById("enabledToggle");
const statusDiv = document.getElementById("status");
const addBtn = document.getElementById("addSite");
const openOptions = document.getElementById("openOptions");

function msg(type, payload={}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, ...payload }, res));
}

(async function init(){
  const s = await msg("getSettings");
  enabledToggle.checked = !!s.enabled;
  statusDiv.textContent = s.enabled ? "Blocking is ON" : "Blocking is OFF";
})();

enabledToggle.addEventListener("change", async () => {
  await msg("setEnabled", { enabled: enabledToggle.checked });
  statusDiv.textContent = enabledToggle.checked ? "Blocking is ON" : "Blocking is OFF";
});

addBtn.addEventListener("click", async () => {
  try {
    statusDiv.textContent = "Adding site...";
    const r = await msg("addCurrentSite");
    if (r.ok) {
      statusDiv.textContent = `✅ Added rule for ${r.added.pattern}`;
      statusDiv.style.color = "#4ade80";
    } else {
      statusDiv.textContent = `❌ Failed: ${r.error}`;
      statusDiv.style.color = "#f87171";
      console.error("addCurrentSite failed:", r.error);
    }
  } catch (error) {
    statusDiv.textContent = `❌ Error: ${error.message}`;
    statusDiv.style.color = "#f87171";
    console.error("addCurrentSite exception:", error);
  }
  
  // Reset color after 3 seconds
  setTimeout(() => {
    statusDiv.style.color = "";
  }, 3000);
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
