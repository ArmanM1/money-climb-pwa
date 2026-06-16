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

const fallbackItemPrices = {
  "Coffee paid off": 7,
  "Lunch covered": 18,
  "Gas covered": 55,
  "Dinner covered": 90,
  "Weekend fund": 250
};

function defaultDepartureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function defaultUnlock() {
  return {
    mode: "flight",
    origin: "DEN",
    destination: "JFK",
    departureDate: defaultDepartureDate(),
    targetPrice: 280,
    fallbackItem: "Weekend fund",
    flightToken: "",
    lastPrice: null,
    lastChecked: null,
    source: "Target fare"
  };
}

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
  unlockCard: document.querySelector("#unlockCard"),
  unlockTitle: document.querySelector("#unlockTitle"),
  unlockMeta: document.querySelector("#unlockMeta"),
  unlockProgress: document.querySelector("#unlockProgress"),
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
  historyList: document.querySelector("#historyList"),
  unlockModal: document.querySelector("#unlockModal"),
  unlockBackdrop: document.querySelector("#unlockBackdrop"),
  closeUnlockButton: document.querySelector("#closeUnlockButton"),
  unlockModeInput: document.querySelector("#unlockModeInput"),
  targetPriceInput: document.querySelector("#targetPriceInput"),
  originInput: document.querySelector("#originInput"),
  destinationInput: document.querySelector("#destinationInput"),
  departureDateInput: document.querySelector("#departureDateInput"),
  fallbackItemInput: document.querySelector("#fallbackItemInput"),
  flightTokenInput: document.querySelector("#flightTokenInput"),
  checkFareButton: document.querySelector("#checkFareButton"),
  saveUnlockButton: document.querySelector("#saveUnlockButton"),
  unlockStatus: document.querySelector("#unlockStatus"),
  unlockPreviewType: document.querySelector("#unlockPreviewType"),
  unlockPreviewRoute: document.querySelector("#unlockPreviewRoute"),
  unlockPreviewPrice: document.querySelector("#unlockPreviewPrice")
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
    history: raw.history || {},
    unlock: normalizeUnlock(raw.unlock || raw.flightUnlock || {})
  };
}

function normalizeUnlock(raw) {
  const base = defaultUnlock();
  const merged = { ...base, ...raw };
  const fallbackPrice = fallbackItemPrices[merged.fallbackItem] || base.targetPrice;
  return {
    ...merged,
    mode: merged.mode === "item" ? "item" : "flight",
    origin: sanitizeAirport(merged.origin || base.origin),
    destination: sanitizeAirport(merged.destination || base.destination),
    departureDate: merged.departureDate || base.departureDate,
    targetPrice: Math.max(1, Number(merged.targetPrice) || fallbackPrice),
    lastPrice: Number.isFinite(Number(merged.lastPrice)) ? Number(merged.lastPrice) : null
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

function sanitizeAirport(value) {
  return String(value || "")
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase();
}

function updateInputs() {
  els.goalInput.value = state.settings.goal;
  els.rateInput.value = state.settings.hourlyRate;
  els.durationInput.value = state.settings.durationHours;
  els.compoundInput.value = state.settings.compoundPortion;
  els.returnInput.value = state.settings.annualReturn;
  els.yearsInput.value = state.settings.years;
  updateUnlockInputs();
  updatePlanPreview();
}

function updateUnlockInputs() {
  const unlock = state.unlock;
  els.unlockModeInput.value = unlock.mode;
  els.targetPriceInput.value = unlock.targetPrice;
  els.originInput.value = unlock.origin;
  els.destinationInput.value = unlock.destination;
  els.departureDateInput.value = unlock.departureDate;
  els.fallbackItemInput.value = unlock.fallbackItem;
  els.flightTokenInput.value = unlock.flightToken || "";
  updateUnlockPreview();
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

function readUnlockInputs() {
  const fallbackItem = els.fallbackItemInput.value || defaultUnlock().fallbackItem;
  return {
    ...state.unlock,
    mode: els.unlockModeInput.value === "item" ? "item" : "flight",
    origin: sanitizeAirport(els.originInput.value) || "DEN",
    destination: sanitizeAirport(els.destinationInput.value) || "JFK",
    departureDate: els.departureDateInput.value || defaultDepartureDate(),
    targetPrice: Math.max(1, Number(els.targetPriceInput.value) || fallbackItemPrices[fallbackItem] || defaultUnlock().targetPrice),
    fallbackItem,
    flightToken: els.flightTokenInput.value.trim()
  };
}

function openUnlockModal() {
  updateUnlockInputs();
  els.unlockStatus.textContent = state.unlock.lastChecked
    ? `Last checked ${new Date(state.unlock.lastChecked).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`
    : "No browser-safe free fare source is configured. The app will use your target fare unless a live source returns a price.";
  els.unlockModal.hidden = false;
}

function closeUnlockModal() {
  els.unlockModal.hidden = true;
}

function saveUnlockSettings() {
  state.unlock = normalizeUnlock(readUnlockInputs());
  saveState();
  renderUnlock(currentEarned());
  closeUnlockModal();
}

async function checkFlightFare() {
  state.unlock = normalizeUnlock(readUnlockInputs());
  saveState();

  if (state.unlock.mode !== "flight") {
    els.unlockStatus.textContent = "Fallback item saved. Switch to Flight to check fares.";
    renderUnlock(currentEarned());
    return;
  }

  if (!state.unlock.flightToken) {
    state.unlock.lastPrice = null;
    state.unlock.source = "Target fare";
    state.unlock.lastChecked = new Date().toISOString();
    saveState();
    els.unlockStatus.textContent = "No free no-key flight price API is available in the browser, so this uses your target fare. Add a Travelpayouts token to try live fare data.";
    renderUnlock(currentEarned());
    return;
  }

  els.unlockStatus.textContent = `Checking ${state.unlock.origin} to ${state.unlock.destination} fares...`;
  try {
    const params = new URLSearchParams({
      origin: state.unlock.origin,
      destination: state.unlock.destination,
      departure_at: state.unlock.departureDate,
      currency: "usd",
      limit: "1",
      token: state.unlock.flightToken
    });
    const response = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params.toString()}`);
    if (!response.ok) throw new Error(`Fare source returned ${response.status}`);
    const data = await response.json();
    const result = Array.isArray(data.data) ? data.data[0] : null;
    const livePrice = Number(result?.price);
    if (!Number.isFinite(livePrice) || livePrice <= 0) throw new Error("No fare returned for that route/date");
    state.unlock.lastPrice = Math.round(livePrice);
    state.unlock.source = "Live fare";
    state.unlock.lastChecked = new Date().toISOString();
    els.unlockStatus.textContent = `Live fare found: ${dollars.format(state.unlock.lastPrice)}.`;
  } catch (error) {
    state.unlock.lastPrice = null;
    state.unlock.source = "Target fare";
    state.unlock.lastChecked = new Date().toISOString();
    els.unlockStatus.textContent = "Live fare check did not return a browser-usable price. Using your target fare fallback.";
  }
  saveState();
  renderUnlock(currentEarned());
}

function maybePollFlightFare() {
  if (state.unlock.mode !== "flight" || !state.unlock.flightToken) return;
  const lastChecked = state.unlock.lastChecked ? Date.parse(state.unlock.lastChecked) : 0;
  if (Date.now() - lastChecked > 15 * 60 * 1000) {
    checkFlightFare();
  }
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
  renderUnlock(earned);
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
    .map((point) => {
      const left = point.pct === 100 ? 100 : point.pct;
      const hoursAtPoint = state.settings.durationHours * (point.pct / 100);
      return `
        <div class="milestone ${questProgress >= point.pct ? "done" : ""} ${point.pct === 100 ? "finish" : ""}" style="--x:${left}%">
          <b>${dollars.format(point.amount)}</b>
          <span>${point.pct}%</span>
          <em>${point.pct === 100 ? "" : formatDurationFromHours(hoursAtPoint)}</em>
        </div>
      `;
    })
    .join("");
}

function unlockPrice() {
  const unlock = state.unlock;
  if (unlock.mode === "item") return fallbackItemPrices[unlock.fallbackItem] || unlock.targetPrice;
  return unlock.lastPrice || unlock.targetPrice;
}

function unlockLabel() {
  const unlock = state.unlock;
  if (unlock.mode === "item") return unlock.fallbackItem;
  return `${unlock.origin} → ${unlock.destination}`;
}

function renderUnlock(earned) {
  const price = Math.max(1, unlockPrice());
  const away = Math.max(0, price - earned);
  const minutesLeft = state.settings.hourlyRate > 0 ? Math.ceil((away / state.settings.hourlyRate) * 60) : Infinity;
  const progress = clamp((earned / price) * 100, 0, 100);
  const source = state.unlock.mode === "flight" ? state.unlock.source : "Fallback item";
  els.unlockTitle.textContent = unlockLabel();
  els.unlockMeta.textContent = away <= 0
    ? `${dollars.format(price)} unlocked · ${source}`
    : `${dollars.format(away)} away · ${Number.isFinite(minutesLeft) ? `${minutesLeft} min left` : "rate needed"}`;
  els.unlockProgress.style.width = `${Math.max(progress, 2)}%`;
  updateUnlockPreview();
}

function updateUnlockPreview() {
  const unlock = state.unlock;
  const price = Math.max(1, unlockPrice());
  els.unlockPreviewType.textContent = unlock.mode === "flight" ? "Flight to unlock" : "Fallback item";
  els.unlockPreviewRoute.textContent = unlockLabel();
  els.unlockPreviewPrice.textContent = unlock.mode === "flight"
    ? `${dollars.format(price)} ${unlock.source.toLowerCase()}`
    : `${dollars.format(price)} unlock target`;
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

[
  els.unlockModeInput,
  els.targetPriceInput,
  els.originInput,
  els.destinationInput,
  els.departureDateInput,
  els.fallbackItemInput,
  els.flightTokenInput
].forEach((input) => {
  input.addEventListener("input", () => {
    state.unlock = normalizeUnlock(readUnlockInputs());
    updateUnlockPreview();
  });
});

els.startButton.addEventListener("click", startToday);
els.pauseButton.addEventListener("click", togglePause);
els.resetDayButton.addEventListener("click", resetToday);
els.clearHistoryButton.addEventListener("click", clearHistory);
els.unlockCard.addEventListener("click", openUnlockModal);
els.unlockBackdrop.addEventListener("click", closeUnlockModal);
els.closeUnlockButton.addEventListener("click", closeUnlockModal);
els.saveUnlockButton.addEventListener("click", saveUnlockSettings);
els.checkFareButton.addEventListener("click", checkFlightFare);

updateInputs();
updateLive();
setInterval(updateLive, 1000);
setInterval(maybePollFlightFare, 15 * 60 * 1000);
maybePollFlightFare();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}
