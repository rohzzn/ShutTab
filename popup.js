
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
  const r = await msg("addCurrentSite");
  if (r.ok) {
    statusDiv.textContent = `Added rule for ${r.added.pattern}`;
  } else {
    statusDiv.textContent = `Failed: ${r.error}`;
  }
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
