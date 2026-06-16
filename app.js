const storageKey = "money-climb-state-v1";

const defaultSettings = {
  goal: 1000,
  hourlyRate: 37,
  durationHours: 4,
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
  app: document.querySelector(".app"),
  views: document.querySelectorAll(".view"),
  tabButtons: document.querySelectorAll("[data-tab]"),
  sessionStatus: document.querySelector("#sessionStatus"),
  liveLabel: document.querySelector("#liveLabel"),
  earnedAmount: document.querySelector("#earnedAmount"),
  perMinute: document.querySelector("#perMinute"),
  percentToGoal: document.querySelector("#percentToGoal"),
  goalLabel: document.querySelector("#goalLabel"),
  goalStage: document.querySelector("#goalStage"),
  stageEarned: document.querySelector("#stageEarned"),
  stageGoal: document.querySelector("#stageGoal"),
  timeLeft: document.querySelector("#timeLeft"),
  timeProgress: document.querySelector("#timeProgress"),
  remainingAmount: document.querySelector("#remainingAmount"),
  remainingProgress: document.querySelector("#remainingProgress"),
  compoundPercent: document.querySelector("#compoundPercent"),
  compoundValue: document.querySelector("#compoundValue"),
  returnLabel: document.querySelector("#returnLabel"),
  yearsLabel: document.querySelector("#yearsLabel"),
  historyStrip: document.querySelector("#historyStrip"),
  historyList: document.querySelector("#historyList"),
  goalInput: document.querySelector("#goalInput"),
  rateInput: document.querySelector("#rateInput"),
  durationInput: document.querySelector("#durationInput"),
  returnInput: document.querySelector("#returnInput"),
  yearsInput: document.querySelector("#yearsInput"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resetDayButton: document.querySelector("#resetDayButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton")
};

let state = readState();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      return {
        settings: { ...defaultSettings, ...(saved.settings || {}) },
        session: saved.session || null,
        history: saved.history || {}
      };
    }
  } catch (error) {
    // If storage is blocked, keep the app usable for the current browser session.
  }
  return {
    settings: { ...defaultSettings },
    session: null,
    history: {}
  };
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // The visible app should still run when private browsing blocks persistence.
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSession(now = Date.now()) {
  const settings = state.settings;
  const existing = state.session;
  if (existing && existing.date === todayKey()) return existing;
  const durationMs = settings.durationHours * 60 * 60 * 1000;
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
  const pausedExtra = session.paused ? Math.max(0, now - session.pausedAt) : 0;
  return Math.max(0, now - session.startedAt - session.pausedTotalMs - pausedExtra);
}

function currentEarned(now = Date.now()) {
  const session = getSession(now);
  const activeMs = sessionElapsedMs(session, now);
  const earnedDuringSession = (state.settings.hourlyRate / 3600000) * activeMs;
  return Math.min(state.settings.goal, session.baseEarned + earnedDuringSession);
}

function formatHours(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function setProgress(node, value) {
  if (!node) return;
  node.style.setProperty("--goal-progress", `${value}%`);
  node.style.setProperty("--value", `${value}%`);
  const fill = node.querySelector("i");
  if (fill) fill.style.width = `${value}%`;
}

function updateInputs() {
  els.goalInput.value = state.settings.goal;
  els.rateInput.value = state.settings.hourlyRate;
  els.durationInput.value = state.settings.durationHours;
  els.returnInput.value = state.settings.annualReturn;
  els.yearsInput.value = state.settings.years;
}

function updateLive() {
  const now = Date.now();
  const session = getSession(now);
  const earned = currentEarned(now);
  const progress = clamp((earned / state.settings.goal) * 100, 0, 100);
  const elapsed = sessionElapsedMs(session, now);
  const remainingSessionMs = Math.max(0, session.durationMs - elapsed);
  const timeProgress = clamp((elapsed / session.durationMs) * 100, 0, 100);
  const remainingMoney = Math.max(0, state.settings.goal - earned);
  const compoundBase = earned;
  const compoundMultiplier = Math.pow(1 + state.settings.annualReturn / 100, state.settings.years);
  const compounded = compoundBase * compoundMultiplier;

  state.history[todayKey()] = Math.round(earned);
  saveState();

  els.liveLabel.textContent = session.paused ? "Paused earned" : "Live earned";
  els.sessionStatus.textContent = session.paused ? "Paused" : "Tracking today";
  els.earnedAmount.textContent = money.format(earned);
  els.perMinute.textContent = `+${money.format(state.settings.hourlyRate / 60)}`;
  els.percentToGoal.textContent = `${Math.round(progress)}%`;
  els.goalLabel.textContent = dollars.format(state.settings.goal);
  els.stageEarned.textContent = dollars.format(earned);
  els.stageGoal.textContent = dollars.format(state.settings.goal);
  els.timeLeft.textContent = formatHours(remainingSessionMs);
  els.remainingAmount.textContent = dollars.format(remainingMoney);
  els.compoundPercent.textContent = `${Math.round(progress)}%`;
  els.compoundValue.textContent = dollars.format(compounded);
  els.returnLabel.textContent = `${state.settings.annualReturn}%`;
  els.yearsLabel.textContent = state.settings.years;

  els.goalStage.style.setProperty("--goal-progress", `${Math.max(progress, 2)}%`);
  setProgress(els.goalStage, Math.max(progress, 2));
  els.timeProgress.style.width = `${timeProgress}%`;
  els.remainingProgress.style.width = `${progress}%`;
  els.pauseButton.textContent = session.paused ? "Resume" : "Pause";

  renderHistoryStrip();
  renderHistoryList();
}

function sortedHistoryEntries() {
  return Object.entries(state.history)
    .filter(([, amount]) => Number.isFinite(Number(amount)))
    .sort(([a], [b]) => a.localeCompare(b));
}

function renderHistoryStrip() {
  const entries = sortedHistoryEntries().slice(-7);
  els.historyStrip.innerHTML = "";
  if (!entries.length) {
    els.historyStrip.innerHTML = '<div class="empty-history" style="grid-column:1/-1;padding:10px 6px">Saved days will appear here after you start tracking.</div>';
    return;
  }
  entries.forEach(([date, amount]) => {
    const percent = clamp((Number(amount) / state.settings.goal) * 100, 4, 100);
    const node = document.createElement("div");
    node.className = `day-bar${date === todayKey() ? " today" : ""}`;
    node.innerHTML = `<i style="--bar:${percent}%"></i><span>${weekdayLabel(date)}</span>`;
    els.historyStrip.appendChild(node);
  });
}

function weekdayLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function friendlyDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderHistoryList() {
  const entries = sortedHistoryEntries().slice().reverse();
  if (!entries.length) {
    els.historyList.innerHTML = '<div class="empty-history">No saved days yet. Start today and your progress will stay here.</div>';
    return;
  }
  els.historyList.innerHTML = entries
    .map(([date, amount]) => {
      const percent = clamp((Number(amount) / state.settings.goal) * 100, 0, 100);
      return `
        <div class="history-card">
          <div>
            <span>${date === todayKey() ? "Today" : friendlyDate(date)}</span>
            <strong>${dollars.format(Number(amount))}</strong>
            <div class="progress-line" style="margin-top:10px"><i style="width:${Math.max(percent, 2)}%"></i></div>
          </div>
          <em>${Math.round(percent)}%</em>
        </div>
      `;
    })
    .join("");
}

function switchTab(tab) {
  els.views.forEach((view) => {
    view.classList.toggle("active", view.id === `${tab}View`);
  });
  els.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  if (tab === "settings") updateInputs();
}

function startToday() {
  state.settings = {
    goal: Number(els.goalInput.value) || defaultSettings.goal,
    hourlyRate: Number(els.rateInput.value) || 0,
    durationHours: Number(els.durationInput.value) || defaultSettings.durationHours,
    annualReturn: Number(els.returnInput.value) || 0,
    years: Math.max(1, Math.round(Number(els.yearsInput.value) || defaultSettings.years))
  };
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
  switchTab("live");
}

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    if (tab) switchTab(tab);
  });
});

els.startButton.addEventListener("click", startToday);
els.pauseButton.addEventListener("click", togglePause);
els.resetDayButton.addEventListener("click", resetToday);
els.clearHistoryButton.addEventListener("click", clearHistory);

if (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) {
  document.body.classList.add("standalone");
}

updateInputs();
const shouldOpenSettings = !state.session;
updateLive();
if (shouldOpenSettings) switchTab("settings");
setInterval(updateLive, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}
