
import { getAll, saveAll, pushLog, clearExpiredOverrides, DEFAULT_SETTINGS } from "./lib/storage.js";
import { inSchedule, nextScheduleBoundary } from "./lib/time.js";
import { toDynamicRule, dynId } from "./lib/rules.js";
import { verifyPin } from "./lib/crypto.js";

// Internal: compute active DNR rules from settings
async function recomputeDynamicRules(reason = "recompute") {
  const settings = await getAll();
  const now = new Date();
  await clearExpiredOverrides();

  const toAdd = [];
  const toRemove = [];

  // Always start by removing all our dynamic rules, then readd
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  for (const r of existing) {
    toRemove.push(r.id);
  }

  if (settings.enabled) {
    if (settings.allowlistMode) {
      // Catch-all redirect, then allow explicit rules
      const catchAll = {
        id: 2, // reserve id 1 for future
        priority: 1,
        action: { type: "redirect", redirect: { url: chrome.runtime.getURL("/block.html?rid=__catchall__&mode=hard") } },
        condition: { urlFilter: "|http", resourceTypes: ["main_frame"] }
      };
      toAdd.push(catchAll);

      for (const appRule of settings.rules) {
        if (!appRule.allow) continue; // only allow entries matter
        // Allow rules have priority > catch-all
        const dyn = toDynamicRule({ ...appRule, allow: true }, 2);
        toAdd.push(dyn);
      }
    } else {
      // Blocklist mode
      for (const appRule of settings.rules) {
        // Skip non-block rules (i.e., explicit allow rules in blocklist mode)
        if (appRule.allow) continue;

        // Schedule check
        const active = inSchedule(now, appRule.schedule);
        if (!active) continue;

        // Check for hostname overrides
        const hostnameKey = hostnameFromPattern(appRule);
        let shouldSkip = false;
        
        if (hostnameKey) {
          const exp = settings.overrides[hostnameKey];
          if (exp && exp > Date.now()) {
            console.log(`Skipping rule ${appRule.id} due to active override for ${hostnameKey} until ${new Date(exp)}`);
            shouldSkip = true;
          }
        }
        
        // Also check for direct hostname matches in overrides
        if (!shouldSkip) {
          for (const [overrideHost, exp] of Object.entries(settings.overrides)) {
            if (exp > Date.now()) {
              // Check if this rule would match the overridden hostname
              const testUrl = `https://${overrideHost}`;
              if (matchUrl(testUrl, appRule)) {
                console.log(`Skipping rule ${appRule.id} due to direct hostname override for ${overrideHost}`);
                shouldSkip = true;
                break;
              }
            }
          }
        }
        
        if (shouldSkip) continue;

        const dyn = toDynamicRule(appRule, 10);
        toAdd.push(dyn);
      }
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules: toAdd });
  // Set alarm to the next minute to reevaluate schedules
  const nextT = nextScheduleBoundary(new Date(), null).getTime();
  const delayMin = Math.max(0.02, (nextT - Date.now()) / 60000);
  await chrome.alarms.create("rebalance", { delayInMinutes: delayMin });
}

function hostnameFromUrl(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}
function hostnameFromPattern(rule) {
  try {
    if (rule.type === "wildcard" || rule.type === "exact") {
      let p = rule.pattern.trim();
      if (p.startsWith("*.")) p = p.slice(2);
      // if pattern includes path or protocol, remove host extras
      if (p.includes("/")) p = p.split("/")[0];
      if (p.includes(":")) p = p.split(":")[0];
      return p.toLowerCase();
    }
    return null;
  } catch { return null; }
}

// Messages from UI pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "getSettings") {
      sendResponse(await getAll());
      return;
    }
    if (msg.type === "setEnabled") {
      const s = await getAll();
      s.enabled = !!msg.enabled;
      await saveAll(s);
      await recomputeDynamicRules("toggle");
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "saveSettings") {
      const s = await getAll();
      if (s.requirePinForChanges && msg.pin && !(await verifyPin(s, msg.pin))) {
        sendResponse({ ok: false, error: "Invalid PIN" });
        return;
      }
      // Partial update; validate
      const merged = { ...s, ...msg.settings };
      await saveAll(merged);
      await recomputeDynamicRules("save");
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "addRule") {
      const s = await getAll();
      const r = { ...msg.rule };
      if (!r.id) r.id = "r_" + Math.random().toString(36).slice(2, 10);
      if (!r.type) r.type = "wildcard";
      if (!r.mode) r.mode = s.defaultBlockMode || "hard";
      s.rules.push(r);
      await saveAll(s);
      await recomputeDynamicRules("addRule");
      sendResponse({ ok: true, id: r.id });
      return;
    }
    if (msg.type === "removeRule") {
      const s = await getAll();
      s.rules = s.rules.filter(x => x.id !== msg.id);
      await saveAll(s);
      await recomputeDynamicRules("removeRule");
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "updateRule") {
      const s = await getAll();
      const idx = s.rules.findIndex(x => x.id === msg.rule.id);
      if (idx >= 0) {
        s.rules[idx] = { ...s.rules[idx], ...msg.rule };
        await saveAll(s);
        await recomputeDynamicRules("updateRule");
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Rule not found" });
      }
      return;
    }
    if (msg.type === "testMatch") {
      const s = await getAll();
      const url = msg.url;
      let matched = null;
      for (const r of s.rules) {
        if (r.allow) continue;
        if (matchUrl(url, r)) { matched = r; break; }
      }
      sendResponse({ matched });
      return;
    }
    if (msg.type === "temporaryAllowForRule") {
      // Remove the DNR rule temporarily and navigate
      const rid = msg.rid;
      const url = msg.url;
      const dyn = dynId(rid);
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [dyn], addRules: [] });
      // restore in 15s
      setTimeout(async () => {
        const s = await getAll();
        const rule = s.rules.find(r => r.id === rid);
        if (rule) {
          const add = toDynamicRule(rule, 10);
          try { await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [add] }); } catch {}
        }
      }, 15000);
      if (sender.tab && sender.tab.id) {
        await chrome.tabs.update(sender.tab.id, { url });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "overrideHostname") {
      const s = await getAll();
      const { hostname, minutes } = msg;
      const exp = Date.now() + minutes * 60 * 1000;
      console.log(`Setting override for hostname: ${hostname}, expires: ${new Date(exp)}`);
      s.overrides[hostname] = exp;
      await saveAll(s);
      console.log(`Current overrides:`, s.overrides);
      await recomputeDynamicRules("override");
      if (sender.tab && sender.tab.id && msg.url) {
        console.log(`Navigating tab to: ${msg.url}`);
        await chrome.tabs.update(sender.tab.id, { url: msg.url });
      }
      sendResponse({ ok: true, until: exp });
      return;
    }
    if (msg.type === "logBlocked") {
      const { url, rid } = msg;
      await pushLog({ type: "blocked", url, rid });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "addCurrentSite") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) { sendResponse({ ok: false, error: "No active tab" }); return; }
      const host = hostnameFromUrl(tab.url);
      const s = await getAll();
      const rule = {
        id: "r_" + Math.random().toString(36).slice(2,10),
        pattern: "*." + host,
        type: "wildcard",
        mode: s.defaultBlockMode || "hard",
        notes: "Added from popup"
      };
      s.rules.push(rule);
      await saveAll(s);
      await recomputeDynamicRules("addCurrentSite");
      sendResponse({ ok: true, added: rule });
      return;
    }
    sendResponse({ ok: false, error: "Unknown message" });
  })();
  return true;
});

// Evaluate if a given URL matches an app rule
function matchUrl(url, r) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (r.type === "exact") {
      return host === r.pattern;
    }
    if (r.type === "wildcard") {
      let patt = r.pattern.replace(/^\*\./, "");
      return host === patt || host.endsWith("." + patt);
    }
    if (r.type === "regex") {
      const re = new RegExp(r.pattern);
      return re.test(url);
    }
    return false;
  } catch {
    return false;
  }
}

// alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "rebalance") {
    await recomputeDynamicRules("alarm");
  }
});

// lifecycle
chrome.runtime.onInstalled.addListener(async () => {
  const s = await getAll();
  // First install: ensure defaults saved
  await saveAll(s);
  await recomputeDynamicRules("install");
});

chrome.runtime.onStartup.addListener(async () => {
  await recomputeDynamicRules("startup");
});
