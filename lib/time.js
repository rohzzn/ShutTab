
export function parseHHMM(s) {
  const [hh, mm] = s.split(":").map(x => parseInt(x, 10));
  return { hh, mm };
}

export function inSchedule(now, sched) {
  // sched: { days:[0-6], start:"HH:MM", end:"HH:MM", timezone:"auto" }
  if (!sched) return true;
  if (!Array.isArray(sched.days) || typeof sched.start !== "string" || typeof sched.end !== "string") return true;
  const dow = now.getDay();
  if (!sched.days.includes(dow)) return false;
  const { hh: sh, mm: sm } = parseHHMM(sched.start);
  const { hh: eh, mm: em } = parseHHMM(sched.end);
  const start = new Date(now); start.setHours(sh, sm, 0, 0);
  const end = new Date(now); end.setHours(eh, em, 0, 0);
  if (end.getTime() === start.getTime()) {
    // 24h window
    return true;
  }
  if (end < start) {
    // overnight window (e.g., 22:00-06:00)
    return now >= start || now <= end;
  } else {
    return now >= start && now <= end;
  }
}

export function nextScheduleBoundary(now, sched) {
  // Return a Date when we should recompute schedules
  // Simplify: next minute boundary
  const t = new Date(now);
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  return t;
}
