
// Compile app rules into declarativeNetRequest dynamic rules.
// Each app rule:
// { id, pattern, type: "wildcard"|"regex"|"exact", mode: "hard"|"soft", schedule?, notes?, allow?: boolean }
//
// Dynamic rule id space: we'll use hash of rule id + prefix.
const REDIRECT_RESOURCE = "/block.html";

export function toDynamicRule(appRule, priorityBase = 10) {
  // action redirect to extension block page with params
  const params = new URLSearchParams({
    rid: appRule.id,
    mode: appRule.mode || "hard"
  }).toString();

  const extensionUrl = chrome.runtime.getURL(`${REDIRECT_RESOURCE}?${params}`);

  const rule = {
    id: dynId(appRule.id),
    priority: priorityBase,
    action: appRule.allow ? { type: "allow" } : {
      type: "redirect",
      redirect: { 
        url: extensionUrl,
        transform: {
          queryTransform: {
            addOrReplaceParams: [
              { key: "u", value: "{url}" }
            ]
          }
        }
      }
    },
    condition: {
      resourceTypes: ["main_frame"]
    }
  };

  if (appRule.type === "exact") {
    // exact domain block: build urlFilter with domain
    rule.condition.urlFilter = `||${appRule.pattern}`;
  } else if (appRule.type === "wildcard") {
    // wildcard on host, accept patterns like *.example.com or example.com
    let patt = appRule.pattern.trim();
    if (patt.startsWith("*.")) patt = patt.slice(2);
    rule.condition.urlFilter = `||${patt}`;
  } else if (appRule.type === "regex") {
    rule.condition.regexFilter = appRule.pattern;
  } else {
    // fallback
    rule.condition.urlFilter = appRule.pattern;
  }

  return rule;
}

export function dynId(ruleId) {
  // Map string id to stable integer in [1000, 2^31-1)
  // simple hash
  let h = 0;
  const s = String(ruleId);
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return 1000 + (h % 2000000000);
}
