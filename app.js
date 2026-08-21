const $ = (id) => document.getElementById(id);

const idsToSave = [
  "uptHours","uptMinutes","flexHours","flexMinutes","standardHours","standardMinutes",
  "shiftStart","shiftEnd","breakEnabled","breakStart","breakEnd",
  "flexSpend","standardSpend","uptSpend","actualClockIn",
  "desiredLeave","targetPriority","ptoOrder",
  "predictStart","predictEnd","predictLunchStart"
];

const RATE_MIN_PER_HOUR = 5;
const UPT_BLOCK = 15;

function n(id) {
  const v = Number($(id).value);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}
function balanceMinutes(prefix) {
  return Math.round(n(prefix + "Hours") * 60 + n(prefix + "Minutes"));
}
function parseTime(value) {
  if (!value || !value.includes(":")) return null;
  const [h,m] = value.split(":").map(Number);
  return h * 60 + m;
}
function overlap(a1,a2,b1,b2) {
  return Math.max(0, Math.min(a2,b2) - Math.max(a1,b1));
}
function normalizeEnd(start, end) {
  if (start == null || end == null) return null;
  while (end <= start) end += 1440;
  return end;
}
function normalizeInsideWindow(time, start, end) {
  if (time == null) return null;
  let t = time;
  while (t < start) t += 1440;
  if (end != null && t > end && t - 1440 >= start) t -= 1440;
  return t;
}
function shiftData() {
  const start = parseTime($("shiftStart").value);
  let end = parseTime($("shiftEnd").value);
  if (start == null || end == null) return null;
  end = normalizeEnd(start, end);

  let breakStart = null, breakEnd = null;
  if ($("breakEnabled").checked) {
    breakStart = normalizeInsideWindow(parseTime($("breakStart").value), start, end);
    breakEnd = normalizeInsideWindow(parseTime($("breakEnd").value), start, end);
    if (breakStart != null && breakEnd != null) {
      if (breakEnd <= breakStart) breakEnd += 1440;
      if (breakStart >= end || breakEnd <= start) {
        breakStart = null; breakEnd = null;
      } else {
        breakStart = Math.max(start, breakStart);
        breakEnd = Math.min(end, breakEnd);
      }
    }
  }
  return { start, end, breakStart, breakEnd };
}
function workMinutesBetween(a,b,data) {
  if (!data) return 0;
  let mins = Math.max(0, b-a);
  if (data.breakStart != null) mins -= overlap(a,b,data.breakStart,data.breakEnd);
  return Math.max(0, Math.round(mins));
}
function scheduledWork(data) {
  return workMinutesBetween(data.start, data.end, data);
}
function leaveTimeForCoverage(coverage, data) {
  if (!data) return null;
  const maxWork = scheduledWork(data);
  let remaining = Math.min(Math.max(0, Math.round(coverage)), maxWork);
  let cursor = data.end;
  const hadCoverage = remaining > 0;

  while (remaining > 0 && cursor > data.start) {
    const minuteStart = cursor - 1;
    const inBreak = data.breakStart != null && minuteStart >= data.breakStart && minuteStart < data.breakEnd;
    cursor--;
    if (!inBreak) remaining--;
  }

  if (hadCoverage && data.breakStart != null && cursor >= data.breakStart && cursor <= data.breakEnd) {
    cursor = data.breakStart;
  }
  return Math.max(data.start, cursor);
}
function displayDuration(mins) {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins/60), m = mins%60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr${h===1?"":"s"}`;
  return `${m} min`;
}
function displayClock(absMin) {
  if (absMin == null) return "—";
  const m = ((Math.round(absMin) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m/60), mm = m%60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return `${h}:${String(mm).padStart(2,"0")} ${suffix}`;
}
function isNextDay(absMin) {
  const data = shiftData();
  return data ? absMin >= 1440 && data.start < 1440 : false;
}
function earnedUpt(workedMinutes) {
  return Math.floor((workedMinutes * RATE_MIN_PER_HOUR) / 60 + 1e-9);
}
function clamp(v,min,max) { return Math.max(min, Math.min(max, v)); }

function syncSpendLimits(forceAll=false) {
  const flex = balanceMinutes("flex");
  const standard = balanceMinutes("standard");
  const upt = balanceMinutes("upt");
  const usable = Math.floor(upt / UPT_BLOCK) * UPT_BLOCK;
  const sliders = [
    ["flexSpend", flex, 1],
    ["standardSpend", standard, 1],
    ["uptSpend", usable, UPT_BLOCK]
  ];
  sliders.forEach(([id,max,step]) => {
    const el = $(id);
    el.max = String(max);
    el.step = String(step);
    if (forceAll) el.value = String(max);
    else el.value = String(clamp(Number(el.value)||0,0,max));
  });
}

function updateMain() {
  syncSpendLimits(false);
  const data = shiftData();
  if (!data) return;

  const totalWork = scheduledWork(data);
  const uptBal = balanceMinutes("upt");
  const usableUpt = Math.floor(uptBal / UPT_BLOCK) * UPT_BLOCK;
  const remainder = uptBal - usableUpt;

  const flexUse = Math.round(n("flexSpend"));
  const standardUse = Math.round(n("standardSpend"));
  const uptUse = Math.round(n("uptSpend") / UPT_BLOCK) * UPT_BLOCK;
  const selectedPto = flexUse + standardUse;
  const selectedTotal = selectedPto + uptUse;
  const actualCoverage = Math.min(selectedTotal, totalWork);

  const leave = leaveTimeForCoverage(actualCoverage, data);
  const worked = workMinutesBetween(data.start, leave, data);
  const earned = earnedUpt(worked);

  $("earliestLeave").textContent = displayClock(leave);
  $("resultLeave").textContent = displayClock(leave);
  $("nextDayBadge").classList.toggle("hidden", !isNextDay(leave));
  $("coverageTotal").textContent = displayDuration(actualCoverage);
  $("ptoTotal").textContent = displayDuration(selectedPto);
  $("usableUpt").textContent = displayDuration(usableUpt);
  $("uptRemainder").textContent = displayDuration(remainder);
  $("scheduledWork").textContent = displayDuration(totalWork);
  $("fullShiftEarn").textContent = displayDuration(earnedUpt(totalWork));
  $("workedBeforeLeave").textContent = displayDuration(worked);
  $("earnedByLeave").textContent = displayDuration(earned);
  $("selectedTimeOff").textContent = displayDuration(actualCoverage);
  $("flexSpendLabel").textContent = displayDuration(flexUse);
  $("standardSpendLabel").textContent = displayDuration(standardUse);
  $("uptSpendLabel").textContent = displayDuration(uptUse);

  const pct = totalWork ? Math.min(100, (actualCoverage / totalWork) * 100) : 0;
  $("coverageFill").style.width = `${pct}%`;
  $("breakFields").classList.toggle("hidden", !$("breakEnabled").checked);

  updateLateChecker();
  updateDesiredLeave();
  saveState();
}

function absoluteTimeInsideShift(timeValue, data) {
  let t = parseTime(timeValue);
  if (t == null || !data) return null;
  while (t < data.start) t += 1440;
  return t;
}
function splitPaidTime(amount, flexBal, standardBal, order) {
  amount = Math.max(0, Math.round(amount));
  let flexUse = 0, standardUse = 0;
  if (order === "standard_first") {
    standardUse = Math.min(standardBal, amount);
    flexUse = Math.min(flexBal, amount - standardUse);
  } else {
    flexUse = Math.min(flexBal, amount);
    standardUse = Math.min(standardBal, amount - flexUse);
  }
  return { flexUse, standardUse };
}
function targetUsagePlan(required, priority, flexBal, standardBal, usableUpt, order) {
  const paidBal = flexBal + standardBal;
  let uptUse = 0;
  let paidUse = 0;

  if (priority === "save_pto") {
    if (usableUpt >= required) {
      uptUse = Math.ceil(required / UPT_BLOCK) * UPT_BLOCK;
    } else {
      uptUse = usableUpt;
    }
    paidUse = Math.max(0, required - uptUse);
  } else {
    const shortageAfterPaid = Math.max(0, required - paidBal);
    uptUse = Math.ceil(shortageAfterPaid / UPT_BLOCK) * UPT_BLOCK;
    uptUse = Math.min(usableUpt, uptUse);
    paidUse = Math.max(0, required - uptUse);
  }

  if (paidUse > paidBal || uptUse > usableUpt || paidUse + uptUse < required) return null;
  const paid = splitPaidTime(paidUse, flexBal, standardBal, order);
  return {
    ...paid,
    uptUse,
    paidUse,
    charged: paidUse + uptUse,
    rounding: Math.max(0, paidUse + uptUse - required)
  };
}
function updateDesiredLeave() {
  const data = shiftData();
  if (!data) return;

  const target = absoluteTimeInsideShift($("desiredLeave").value, data);
  const flexBal = balanceMinutes("flex");
  const standardBal = balanceMinutes("standard");
  const uptBal = balanceMinutes("upt");
  const usableUpt = Math.floor(uptBal / UPT_BLOCK) * UPT_BLOCK;
  const maxCoverage = flexBal + standardBal + usableUpt;
  const status = $("targetStatus");
  const shortfall = $("targetShortfall");
  const planBox = $("targetPlan");

  if (target == null || target < data.start || target > data.end) {
    status.className = "target-status neutral";
    status.querySelector(".status-icon").textContent = "!";
    $("targetStatusKicker").textContent = "Choose a time during your shift";
    $("targetStatusTime").textContent = "Outside shift";
    $("targetStatusText").textContent = `Your shift runs from ${displayClock(data.start)} to ${displayClock(data.end)}.`;
    $("targetNeeded").textContent = "—";
    $("targetCharged").textContent = "—";
    $("targetRounding").textContent = "—";
    planBox.classList.add("hidden");
    shortfall.classList.add("hidden");
    $("targetNote").textContent = "";
    return;
  }

  const required = workMinutesBetween(target, data.end, data);
  const priority = $("targetPriority").value;
  const order = $("ptoOrder").value;
  const canCover = maxCoverage >= required;
  $("targetNeeded").textContent = displayDuration(required);

  if (canCover) {
    const plan = targetUsagePlan(required, priority, flexBal, standardBal, usableUpt, order);
    if (!plan) return;
    status.className = "target-status success";
    status.querySelector(".status-icon").textContent = "✓";
    $("targetStatusKicker").textContent = "Yes — you can leave at";
    $("targetStatusTime").textContent = displayClock(target);
    $("targetStatusText").textContent = priority === "save_pto"
      ? "This option uses UPT first to preserve more paid time."
      : "This option uses paid time first to preserve more UPT.";
    $("targetCharged").textContent = displayDuration(plan.charged);
    $("targetRounding").textContent = plan.rounding ? `+${displayDuration(plan.rounding)}` : "None";
    $("targetFlexUse").textContent = displayDuration(plan.flexUse);
    $("targetStandardUse").textContent = displayDuration(plan.standardUse);
    $("targetUptUse").textContent = displayDuration(plan.uptUse);
    $("targetFlexRemain").textContent = displayDuration(flexBal - plan.flexUse);
    $("targetStandardRemain").textContent = displayDuration(standardBal - plan.standardUse);
    $("targetUptRemain").textContent = displayDuration(uptBal - plan.uptUse);
    planBox.classList.remove("hidden");
    shortfall.classList.add("hidden");
    $("targetNote").textContent = `UPT stays in ${UPT_BLOCK}-minute blocks; Flexible and Standard PTO can fill exact-minute differences.`;
  } else {
    const earliest = leaveTimeForCoverage(Math.min(maxCoverage, scheduledWork(data)), data);
    const shortBy = Math.max(0, required - maxCoverage);
    status.className = "target-status error";
    status.querySelector(".status-icon").textContent = "×";
    $("targetStatusKicker").textContent = "Not enough time for";
    $("targetStatusTime").textContent = displayClock(target);
    $("targetStatusText").textContent = `You can cover ${displayDuration(maxCoverage)} of the ${displayDuration(required)} needed.`;
    $("targetCharged").textContent = displayDuration(maxCoverage);
    $("targetRounding").textContent = "—";
    $("targetShortBy").textContent = displayDuration(shortBy);
    $("targetEarliestPossible").textContent = displayClock(earliest);
    planBox.classList.add("hidden");
    shortfall.classList.remove("hidden");
    $("targetNote").textContent = `Earliest possible uses all paid time plus ${displayDuration(usableUpt)} of usable UPT.`;
  }
}

function updateUptPrediction() {
  const start = parseTime($("predictStart").value);
  let end = parseTime($("predictEnd").value);
  let lunchStart = parseTime($("predictLunchStart").value);
  if (start == null || end == null || lunchStart == null) return;

  end = normalizeEnd(start, end);
  lunchStart = normalizeInsideWindow(lunchStart, start, end);
  let lunchEnd = lunchStart + 30;
  const elapsed = Math.max(0, end - start);
  const lunchDeducted = Math.min(30, overlap(start, end, lunchStart, lunchEnd));
  const worked = Math.max(0, elapsed - lunchDeducted);
  const earned = earnedUpt(worked);

  $("predictElapsed").textContent = displayDuration(elapsed);
  $("predictLunch").textContent = displayDuration(lunchDeducted);
  $("predictWorked").textContent = displayDuration(worked);
  $("predictEarned").textContent = displayDuration(earned);

  const lunchText = lunchDeducted === 0
    ? "No lunch time is deducted because the selected end time is before the lunch window."
    : `${displayDuration(lunchDeducted)} of the 30-minute lunch falls inside the selected work window.`;
  $("predictExplanation").textContent =
    `${displayClock(start)} → ${displayClock(end)} is ${displayDuration(elapsed)} elapsed. ${lunchText} ` +
    `That gives ${displayDuration(worked)} actually worked → about ${displayDuration(earned)} UPT.`;
  saveState();
}

function updateLateChecker() {
  const data = shiftData();
  if (!data) return;
  let actual = parseTime($("actualClockIn").value);
  if (actual == null) return;
  while (actual < data.start) actual += 1440;
  if (actual > data.end) actual = data.end;

  const missedWork = workMinutesBetween(data.start, actual, data);
  const charge = missedWork === 0 ? 0 : Math.ceil(missedWork / UPT_BLOCK) * UPT_BLOCK;
  $("lateBy").textContent = displayDuration(missedWork);
  $("lateCharge").textContent = displayDuration(charge);

  const a = displayClock(actual);
  const s = displayClock(data.start);
  if (missedWork === 0) {
    $("lateExplanation").textContent = `${a} is not after the scheduled start of ${s}, so no late UPT block is needed.`;
  } else {
    $("lateExplanation").textContent =
      `${a} leaves ${displayDuration(missedWork)} of scheduled work uncovered after ${s}. ` +
      `UPT rounds that uncovered time up to ${displayDuration(charge)} in 15-minute blocks.`;
  }
}

function saveState() {
  try {
    const state = {};
    idsToSave.forEach(id => {
      const el = $(id);
      state[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    localStorage.setItem("timebank-state-v2", JSON.stringify(state));
  } catch (_) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem("timebank-state-v2") || localStorage.getItem("timebank-state-v1");
    if (!raw) return false;
    const state = JSON.parse(raw);
    idsToSave.forEach(id => {
      if (!(id in state)) return;
      const el = $(id);
      if (el.type === "checkbox") el.checked = Boolean(state[id]);
      else el.value = state[id];
    });
    return true;
  } catch (_) { return false; }
}
function loadExample() {
  $("uptHours").value = 1;
  $("uptMinutes").value = 16;
  $("flexHours").value = 3;
  $("flexMinutes").value = 0;
  $("standardHours").value = 0;
  $("standardMinutes").value = 0;
  $("shiftStart").value = "18:15";
  $("shiftEnd").value = "04:45";
  $("breakEnabled").checked = true;
  $("breakStart").value = "22:45";
  $("breakEnd").value = "23:15";
  $("actualClockIn").value = "18:21";
  $("desiredLeave").value = "00:30";
  $("targetPriority").value = "save_upt";
  $("ptoOrder").value = "flex_first";
  $("predictStart").value = "18:15";
  $("predictEnd").value = "03:45";
  $("predictLunchStart").value = "22:45";
  syncSpendLimits(true);
  updateMain();
  updateUptPrediction();
  toast("Example loaded: earliest leave 12:30 AM; 3:45 AM predicts 45 min UPT");
}
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
async function shareApp() {
  const shareData = { title:"TimeBank — UPT & PTO Calculator", text:"UPT/PTO shift calculator", url:location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
  } catch (_) {}
}

document.querySelectorAll("input, select").forEach(el => {
  el.addEventListener("input", () => {
    if (el.id.startsWith("predict")) updateUptPrediction();
    else updateMain();
  });
  el.addEventListener("change", () => {
    if (el.id.startsWith("predict")) updateUptPrediction();
    else updateMain();
  });
});

$("useAllBtn").addEventListener("click", () => { syncSpendLimits(true); updateMain(); });
$("demoBtn").addEventListener("click", loadExample);
$("shareBtn").addEventListener("click", shareApp);

const hadSavedState = loadState();
syncSpendLimits(!hadSavedState);
updateMain();
updateUptPrediction();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
