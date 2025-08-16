
const enabledToggle = document.getElementById("enabledToggle");
const statusDiv = document.getElementById("status");
const addBtn = document.getElementById("addSite");
const openOptions = document.getElementById("openOptions");

function msg(type, payload={}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, ...payload }, res));
}

(async function init(){
  console.log("=== POPUP INIT DEBUG ===");
  try {
    console.log("Requesting settings...");
    const s = await msg("getSettings");
    console.log("Settings received:", s);
    enabledToggle.checked = !!s.enabled;
    statusDiv.textContent = s.enabled ? "Blocking is ON" : "Blocking is OFF";
    console.log("✅ Popup initialized successfully");
  } catch (error) {
    console.error("❌ Popup init failed:", error);
    statusDiv.textContent = "Error initializing";
  }
})();

enabledToggle.addEventListener("change", async () => {
  await msg("setEnabled", { enabled: enabledToggle.checked });
  statusDiv.textContent = enabledToggle.checked ? "Blocking is ON" : "Blocking is OFF";
});

addBtn.addEventListener("click", async () => {
  try {
    console.log("=== ADD SITE DEBUG START ===");
    statusDiv.textContent = "Adding site...";
    
    // First, let's check what tab we're on
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log("Current tab from popup:", tab);
    } catch (e) {
      console.error("Cannot query tabs from popup:", e);
    }
    
    console.log("Sending addCurrentSite message...");
    const r = await msg("addCurrentSite");
    console.log("Received response:", r);
    
    if (r && r.ok) {
      statusDiv.textContent = `✅ Added rule for ${r.added.pattern}`;
      statusDiv.style.color = "#4ade80";
      console.log("✅ Successfully added rule:", r.added);
    } else {
      statusDiv.textContent = `❌ Failed: ${r ? r.error : 'No response'}`;
      statusDiv.style.color = "#f87171";
      console.error("❌ addCurrentSite failed:", r);
    }
  } catch (error) {
    statusDiv.textContent = `❌ Error: ${error.message}`;
    statusDiv.style.color = "#f87171";
    console.error("❌ addCurrentSite exception:", error);
  }
  
  console.log("=== ADD SITE DEBUG END ===");
  
  // Reset color after 5 seconds (longer to read)
  setTimeout(() => {
    statusDiv.style.color = "";
  }, 5000);
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
