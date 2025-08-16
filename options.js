
function msg(type, payload={}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, ...payload }, res));
}

let SETTINGS = null;

async function refresh() {
  SETTINGS = await msg("getSettings");
  // globals
  document.getElementById("enabled").checked = !!SETTINGS.enabled;
  document.getElementById("allowlistMode").checked = !!SETTINGS.allowlistMode;
  document.getElementById("defaultBlockMode").value = SETTINGS.defaultBlockMode || "hard";
  document.getElementById("requirePin").checked = !!SETTINGS.requirePinForChanges;
  document.getElementById("overrideDurations").value = (SETTINGS.defaultOverrideMinutes||[5,15,30]).join(",");

  // rules
  const tbody = document.querySelector("#rulesTbl tbody");
  tbody.innerHTML = "";
  for (const r of SETTINGS.rules) {
    const tr = document.createElement("tr");
    const sched = r.schedule ? `${(r.schedule.days||[]).join(",")} ${r.schedule.start}-${r.schedule.end}` : "<span class='badge'>Always</span>";
    tr.innerHTML = `
      <td>${escapeHtml(r.pattern)}</td>
      <td>${r.type||"wildcard"}</td>
      <td>${r.mode||"hard"}</td>
      <td>${sched}</td>
      <td>${r.allow? "Yes":"No"}</td>
      <td>${escapeHtml(r.notes||"")}</td>
      <td>
        <button data-id="${r.id}" class="del">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // activity
  const actDiv = document.getElementById("activity");
  actDiv.innerHTML = "";
  for (const e of SETTINGS.log || []) {
    const d = new Date(e.time);
    const el = document.createElement("div");
    el.innerHTML = `<span class="badge">${d.toLocaleString()}</span> blocked <a class="link" href="${e.url}" target="_blank" rel="noreferrer">${escapeHtml(e.url)}</a> by rule <code>${escapeHtml(e.rid||"")}</code>`;
    actDiv.appendChild(el);
  }
}

function escapeHtml(s) {
  return (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

document.getElementById("saveGlobal").addEventListener("click", async () => {
  const settings = {
    enabled: document.getElementById("enabled").checked,
    allowlistMode: document.getElementById("allowlistMode").checked,
    defaultBlockMode: document.getElementById("defaultBlockMode").value,
    requirePinForChanges: document.getElementById("requirePin").checked,
    defaultOverrideMinutes: document.getElementById("overrideDurations").value.split(",").map(x=>parseInt(x.trim(),10)).filter(x=>!isNaN(x)&&x>0)
  };
  const pin = prompt("If a PIN is required or changing settings is protected, enter PIN (or leave blank).");
  const res = await msg("saveSettings", { settings, pin });
  if (!res.ok) alert("Failed to save: " + (res.error||""));
  await refresh();
});

document.getElementById("addRule").addEventListener("click", async () => {
  const pattern = document.getElementById("pattern").value.trim();
  const type = document.getElementById("type").value;
  const mode = document.getElementById("mode").value;
  const allow = document.getElementById("allowRule").checked;
  const daysStr = document.getElementById("schedDays").value.trim();
  const start = document.getElementById("schedStart").value.trim();
  const end = document.getElementById("schedEnd").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!pattern) { alert("Enter a pattern"); return; }

  const rule = { pattern, type, mode, notes };
  if (allow) rule.allow = true;
  if (daysStr && start && end) {
    const days = daysStr.split(",").map(x=>parseInt(x,10)).filter(x=>!isNaN(x));
    rule.schedule = { days, start, end, timezone: "auto" };
  }

  const res = await msg("addRule", { rule });
  if (!res.ok) alert("Failed to add: " + (res.error||""));
  else {
    // Clear form after successful add
    document.getElementById("pattern").value = "";
    document.getElementById("allowRule").checked = false;
    document.getElementById("schedDays").value = "";
    document.getElementById("schedStart").value = "";
    document.getElementById("schedEnd").value = "";
    document.getElementById("notes").value = "";
  }
  await refresh();
});

document.querySelector("#rulesTbl").addEventListener("click", async (e) => {
  const btn = e.target.closest("button.del");
  if (!btn) return;
  if (!confirm("Delete this rule?")) return;
  const id = btn.getAttribute("data-id");
  const res = await msg("removeRule", { id });
  if (!res.ok) alert("Failed to delete: " + (res.error||""));
  await refresh();
});

// import/export
document.getElementById("exportBtn").addEventListener("click", async () => {
  const s = await msg("getSettings");
  const toSave = {
    enabled: s.enabled,
    allowlistMode: s.allowlistMode,
    defaultBlockMode: s.defaultBlockMode,
    rules: s.rules
  };
  const text = JSON.stringify(toSave, null, 2);
  document.getElementById("exportOut").textContent = text;
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { alert("Invalid JSON"); return; }
  if (!Array.isArray(data.rules)) { alert("JSON must include an array 'rules'"); return; }
  const s = await msg("getSettings");
  s.rules = data.rules;
  s.enabled = !!data.enabled;
  s.allowlistMode = !!data.allowlistMode;
  s.defaultBlockMode = data.defaultBlockMode || s.defaultBlockMode;
  const res = await msg("saveSettings", { settings: s });
  if (!res.ok) alert("Failed to import: " + (res.error||""));
  await refresh();
});

document.getElementById("testBtn").addEventListener("click", async () => {
  const url = document.getElementById("testUrl").value.trim();
  if (!url) return;
  const res = await msg("testMatch", { url });
  const div = document.getElementById("testRes");
  if (res.matched) {
    div.textContent = `Matched rule ${res.matched.id} (${res.matched.pattern})`;
  } else {
    div.textContent = "No rule matched.";
  }
});

refresh();
