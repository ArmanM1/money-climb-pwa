const storageKey = "money-climb-state-v2";
const oldStorageKey = "money-climb-state-v1";

const defaultSettings = {
  goal: 1000,
  hourlyRate: 37,
  durationHours: 4,
  compoundPortion: 40,
  annualReturn: 7,
  years: 40
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const els = {
  views: document.querySelectorAll(".view"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  sessionStatus: document.querySelector("#sessionStatus"),
  homeStreak: document.querySelector("#homeStreak"),
  homeToday: document.querySelector("#homeToday"),
  homeBest: document.querySelector("#homeBest"),
  homeWeek: document.querySelector("#homeWeek"),
  homeCheckpoints: document.querySelector("#homeCheckpoints"),
  liveLabel: document.querySelector("#liveLabel"),
  earnedAmount: document.querySelector("#earnedAmount"),
  perMinute: document.querySelector("#perMinute"),
  percentToGoal: document.querySelector("#percentToGoal"),
  goalLabel: document.querySelector("#goalLabel"),
  goalLine: document.querySelector("#goalLine"),
  workdayStage: document.querySelector("#workdayStage"),
  workdayBeam: document.querySelector("#workdayBeam"),
  milestoneRow: document.querySelector("#milestoneRow"),
  projectedEod: document.querySelector("#projectedEod"),
  plannedTodayLabel: document.querySelector("#plannedTodayLabel"),
  stageEarned: document.querySelector("#stageEarned"),
  stagePlanned: document.querySelector("#stagePlanned"),
  workdayStartLabel: document.querySelector("#workdayStartLabel"),
  workdayEndLabel: document.querySelector("#workdayEndLabel"),
  timeLeft: document.querySelector("#timeLeft"),
  timeProgress: document.querySelector("#timeProgress"),
  compoundPercent: document.querySelector("#compoundPercent"),
  compoundValue: document.querySelector("#compoundValue"),
  returnLabel: document.querySelector("#returnLabel"),
  yearsLabel: document.querySelector("#yearsLabel"),
  projectedPreview: document.querySelector("#projectedPreview"),
  goalPreview: document.querySelector("#goalPreview"),
  goalInput: document.querySelector("#goalInput"),
  rateInput: document.querySelector("#rateInput"),
  durationInput: document.querySelector("#durationInput"),
  compoundInput: document.querySelector("#compoundInput"),
  returnInput: document.querySelector("#returnInput"),
  yearsInput: document.querySelector("#yearsInput"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resetDayButton: document.querySelector("#resetDayButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  checkpointList: document.querySelector("#checkpointList"),
  checkpointSummary: document.querySelector("#checkpointSummary"),
  statsTotal: document.querySelector("#statsTotal"),
  statsAverage: document.querySelector("#statsAverage"),
  statsBest: document.querySelector("#statsBest"),
  statsStreak: document.querySelector("#statsStreak"),
  historyList: document.querySelector("#historyList")
};

let state = readState();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") return normalizeState(saved);
    const old = JSON.parse(localStorage.getItem(oldStorageKey) || "null");
    if (old && typeof old === "object") return normalizeState(old);
  } catch (error) {
    // Keep the app usable if storage parsing fails.
  }
  return normalizeState({});
}

function normalizeState(raw) {
  return {
    settings: { ...defaultSettings, ...(raw.settings || {}) },
    session: raw.session || null,
    history: raw.history || {}
  };
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // Private browsing can block persistence; current session still works.
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function plannedToday() {
  return state.settings.hourlyRate * state.settings.durationHours;
}

function getSession(now = Date.now(), create = true) {
  const existing = state.session;
  if (existing && existing.date === todayKey()) return existing;
  if (!create) return null;
  const durationMs = state.settings.durationHours * 60 * 60 * 1000;
  state.session = {
    date: todayKey(),
    startedAt: now,
    durationMs,
    baseEarned: state.history[todayKey()] || 0,
    paused: true,
    pausedAt: now,
    pausedTotalMs: 0
  };
  saveState();
  return state.session;
}

function sessionElapsedMs(session, now = Date.now()) {
  if (!session) return 0;
  const pausedExtra = session.paused ? Math.max(0, now - session.pausedAt) : 0;
  return Math.max(0, now - session.startedAt - session.pausedTotalMs - pausedExtra);
}

function currentEarned(now = Date.now()) {
  const session = getSession(now);
  const activeMs = sessionElapsedMs(session, now);
  const earnedDuringSession = (state.settings.hourlyRate / 3600000) * activeMs;
  return Math.max(0, session.baseEarned + earnedDuringSession);
}

function formatHours(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function setLineProgress(node, percent) {
  if (!node) return;
  const safePercent = `${clamp(percent, 0, 100)}%`;
  node.style.setProperty("--value", safePercent);
  const fill = node.querySelector("i");
  if (fill) fill.style.width = safePercent;
}

function setWorkdayProgress(percent) {
  setLineProgress(els.workdayBeam, percent);
}

function formatClock(ms) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDurationFromHours(hours) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `+${minutes}m<br>est.`;
  if (!minutes) return `+${wholeHours}h<br>est.`;
  return `+${wholeHours}h ${minutes}m<br>est.`;
}

function updateInputs() {
  els.goalInput.value = state.settings.goal;
  els.rateInput.value = state.settings.hourlyRate;
  els.durationInput.value = state.settings.durationHours;
  els.compoundInput.value = state.settings.compoundPortion;
  els.returnInput.value = state.settings.annualReturn;
  els.yearsInput.value = state.settings.years;
  updatePlanPreview();
}

function readDraftSettings() {
  return {
    goal: Number(els.goalInput.value) || defaultSettings.goal,
    hourlyRate: Number(els.rateInput.value) || 0,
    durationHours: Number(els.durationInput.value) || defaultSettings.durationHours,
    compoundPortion: clamp(Number(els.compoundInput.value) || 0, 0, 100),
    annualReturn: Number(els.returnInput.value) || 0,
    years: Math.max(1, Math.round(Number(els.yearsInput.value) || defaultSettings.years))
  };
}

function updatePlanPreview() {
  const draft = readDraftSettings();
  const projected = draft.hourlyRate * draft.durationHours;
  const goalPercent = draft.goal ? clamp((projected / draft.goal) * 100, 0, 999) : 0;
  els.projectedPreview.textContent = `${dollars.format(projected)} from this plan`;
  els.goalPreview.textContent = `${Math.round(goalPercent)}% goal`;
}


function updateLive() {
  const now = Date.now();
  const session = getSession(now);
  const earned = currentEarned(now);
  const planned = Math.max(plannedToday(), 1);
  const goalProgress = clamp((earned / state.settings.goal) * 100, 0, 100);
  const questProgress = clamp((earned / planned) * 100, 0, 100);
  const elapsed = sessionElapsedMs(session, now);
  const remainingSessionMs = Math.max(0, session.durationMs - elapsed);
  const timeProgress = clamp((elapsed / session.durationMs) * 100, 0, 100);
  const projectedEod = Math.max(earned, earned + (state.settings.hourlyRate / 3600000) * remainingSessionMs);
  const compoundBase = earned * (state.settings.compoundPortion / 100);
  const compoundMultiplier = Math.pow(1 + state.settings.annualReturn / 100, state.settings.years);
  const compounded = compoundBase * compoundMultiplier;

  state.history[todayKey()] = Math.round(earned);
  saveState();

  els.liveLabel.textContent = session.paused ? "Paused earned" : "Live earned";
  els.sessionStatus.textContent = session.paused ? "Paused" : "Tracking today";
  els.earnedAmount.textContent = money.format(earned);
  els.perMinute.textContent = `+${money.format(state.settings.hourlyRate / 60)}`;
  els.percentToGoal.textContent = `${Math.round(goalProgress)}%`;
  els.goalLabel.textContent = dollars.format(state.settings.goal);
  setLineProgress(els.goalLine, Math.max(goalProgress, 2));
  els.projectedEod.textContent = dollars.format(projectedEod);
  els.plannedTodayLabel.textContent = dollars.format(planned);
  els.stageEarned.textContent = dollars.format(earned);
  els.stagePlanned.textContent = dollars.format(planned);
  setWorkdayProgress(Math.max(questProgress, 2));
  els.workdayStartLabel.textContent = formatClock(session.startedAt);
  els.workdayEndLabel.textContent = formatClock(session.startedAt + session.durationMs);
  els.timeLeft.textContent = formatHours(remainingSessionMs);
  els.timeProgress.style.width = `${timeProgress}%`;
  els.compoundPercent.textContent = `${state.settings.compoundPortion}%`;
  els.compoundValue.textContent = dollars.format(compounded);
  els.returnLabel.textContent = `${state.settings.annualReturn}%`;
  els.yearsLabel.textContent = state.settings.years;
  els.pauseButton.textContent = session.paused ? "Resume" : "Pause";

  renderMilestones(questProgress);
  renderHome(earned);
  renderStats();
}

function checkpoints() {
  const planned = plannedToday();
  return [
    { pct: 25, label: "Warmup", amount: planned * 0.25 },
    { pct: 50, label: "Cruise", amount: planned * 0.5 },
    { pct: 75, label: "Push", amount: planned * 0.75 },
    { pct: 100, label: "Finish", amount: planned }
  ];
}

function renderMilestones(questProgress) {
  els.milestoneRow.innerHTML = checkpoints()
    .filter((point) => point.pct < 100)
    .map((point) => {
      const hoursAtPoint = state.settings.durationHours * (point.pct / 100);
      return `
        <div class="milestone ${questProgress >= point.pct ? "done" : ""}" style="--x:${point.pct}%">
          <b>${dollars.format(point.amount)}</b>
          <span>${point.pct}%</span>
          <em>${formatDurationFromHours(hoursAtPoint)}</em>
        </div>
      `;
    })
    .join("");
}

function sortedHistoryEntries() {
  return Object.entries(state.history)
    .filter(([, amount]) => Number.isFinite(Number(amount)))
    .sort(([a], [b]) => a.localeCompare(b));
}

function renderHome(todayEarned) {
  const entries = sortedHistoryEntries();
  const amounts = entries.map(([, amount]) => Number(amount));
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const best = Math.max(0, ...amounts);
  const week = entries.slice(-7).reduce((sum, [, amount]) => sum + Number(amount), 0);
  const reached = checkpoints().filter((point) => todayEarned >= point.amount).length;
  const streak = calculateStreak();
  els.homeStreak.textContent = streak;
  els.homeToday.textContent = dollars.format(todayEarned);
  els.homeBest.textContent = dollars.format(best);
  els.homeWeek.textContent = dollars.format(week);
  els.homeCheckpoints.textContent = `${reached}/4`;
  els.statsTotal.textContent = dollars.format(total);
  els.statsAverage.textContent = dollars.format(amounts.length ? total / amounts.length : 0);
  els.statsBest.textContent = dollars.format(best);
  els.statsStreak.textContent = streak;
}

function calculateStreak() {
  let count = 0;
  const history = state.history;
  const date = new Date(`${todayKey()}T12:00:00`);
  while (count < 366) {
    const key = date.toISOString().slice(0, 10);
    if (!history[key] || Number(history[key]) <= 0) break;
    count += 1;
    date.setDate(date.getDate() - 1);
  }
  return count;
}

function weekdayLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function friendlyDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderStats() {
  const earned = currentEarned();
  const checkpointData = checkpoints();
  const reached = checkpointData.filter((point) => earned >= point.amount).length;
  els.checkpointSummary.textContent = `${reached} reached`;
  els.checkpointList.innerHTML = checkpointData
    .map((point, index) => {
      const done = earned >= point.amount;
      return `
        <div class="checkpoint-card ${done ? "done" : ""}">
          <div class="badge">${index + 1}</div>
          <div>
            <strong>${point.label}</strong>
            <span>${point.pct}% of planned workday</span>
          </div>
          <em>${dollars.format(point.amount)}</em>
        </div>
      `;
    })
    .join("");

  const entries = sortedHistoryEntries().slice().reverse();
  if (!entries.length) {
    els.historyList.innerHTML = '<div class="empty-history">No saved days yet. Start a workday and your journey history will stay here.</div>';
    return;
  }
  els.historyList.innerHTML = entries
    .map(([date, amount]) => {
      const pct = clamp((Number(amount) / state.settings.goal) * 100, 0, 100);
      return `
        <div class="history-card">
          <div>
            <span>${date === todayKey() ? "Today" : `${friendlyDate(date)} · ${weekdayLabel(date)}`}</span>
            <strong>${dollars.format(Number(amount))}</strong>
            <div class="progress-line" style="margin-top:10px"><i style="width:${Math.max(pct, 2)}%"></i></div>
          </div>
          <em>${Math.round(pct)}%</em>
        </div>
      `;
    })
    .join("");
}

function switchTab(tab) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${tab}View`));
  els.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "start") updateInputs();
  if (tab === "stats") renderStats();
}

function startToday() {
  state.settings = readDraftSettings();
  const now = Date.now();
  state.session = {
    date: todayKey(),
    startedAt: now,
    durationMs: state.settings.durationHours * 60 * 60 * 1000,
    baseEarned: state.history[todayKey()] || 0,
    paused: false,
    pausedAt: null,
    pausedTotalMs: 0
  };
  saveState();
  switchTab("live");
  updateLive();
}

function togglePause() {
  const now = Date.now();
  const session = getSession(now);
  if (session.paused) {
    session.pausedTotalMs += Math.max(0, now - session.pausedAt);
    session.paused = false;
    session.pausedAt = null;
  } else {
    session.paused = true;
    session.pausedAt = now;
  }
  saveState();
  updateLive();
}

function resetToday() {
  state.history[todayKey()] = 0;
  state.session = null;
  getSession();
  saveState();
  updateLive();
}

function clearHistory() {
  state.history = {};
  state.session = null;
  saveState();
  updateLive();
  switchTab("home");
}

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.tab) switchTab(button.dataset.tab);
  });
});

[els.goalInput, els.rateInput, els.durationInput, els.compoundInput, els.returnInput, els.yearsInput].forEach((input) => {
  input.addEventListener("input", updatePlanPreview);
});

els.startButton.addEventListener("click", startToday);
els.pauseButton.addEventListener("click", togglePause);
els.resetDayButton.addEventListener("click", resetToday);
els.clearHistoryButton.addEventListener("click", clearHistory);

updateInputs();
updateLive();
setInterval(updateLive, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}
