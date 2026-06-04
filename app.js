const STORAGE_KEY = "bp-health-tracker-logs-v1";
const SAST_TIME_ZONE = "Africa/Johannesburg";
const LOGS_API_URL = "/api/logs";
const AI_FOOD_BACKEND_URL = "/api/analyze-food-photo";
const AI_LOGS_BACKEND_URL = "/api/analyze-logs";
const AI_CHAT_BACKEND_URL = "/api/chat";
const AI_NUTRITION_BACKEND_URL = "/api/analyze-nutrition";
const REMINDERS_KEY = "bp-health-tracker-reminders-v1";
const AUTH_TOKEN_KEY = "bp-health-tracker-auth-token-v1";
let logsCache = [];
let editingLogId = null;
let portionEntries = [];
let lastReminderMinute = "";
let sessionReady = false;

const bpCategories = [
  {
    key: "crisis",
    label: "Crisis range",
    test: (sys, dia) => sys > 180 || dia > 120,
    summary: "This reading is in a crisis range.",
  },
  {
    key: "stage2",
    label: "Stage 2 high",
    test: (sys, dia) => sys >= 140 || dia >= 90,
    summary: "This reading is high and should be discussed with your clinician.",
  },
  {
    key: "stage1",
    label: "Stage 1 high",
    test: (sys, dia) => (sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89),
    summary: "This reading is in the stage 1 high blood pressure range.",
  },
  {
    key: "elevated",
    label: "Elevated",
    test: (sys, dia) => sys >= 120 && sys <= 129 && dia < 80,
    summary: "This reading is elevated.",
  },
  {
    key: "normal",
    label: "Normal",
    test: (sys, dia) => sys < 120 && dia < 80,
    summary: "This reading is in the normal range.",
  },
];

const helpfulFoods = [
  "avocado",
  "egg",
  "eggs",
  "meat",
  "chicken",
  "fish",
  "salad",
  "spinach",
  "swiss chard",
  "chard",
  "beet tops",
  "celery",
  "hibiscus",
  "beetroot",
  "beets",
  "cacao",
  "keto shake",
  "flaxseed",
  "olive oil",
];

const cautionFoods = [
  "bread",
  "rice",
  "pasta",
  "potato",
  "chips",
  "sugar",
  "sweets",
  "juice",
  "soda",
  "cake",
  "biscuit",
  "cookies",
  "starch",
  "processed",
  "fast food",
];

const exercisePlan = [
  "Cycling zone 2 for 30 minutes, then 5 minutes of slow breathing.",
  "Resistance training for 30 minutes: squats, rows, presses, and core work.",
  "Isometric day: 4 rounds of wall sit or hand-grip holds, plus easy walking.",
  "Cycling intervals: 6 rounds of 1 minute hard effort and 2 minutes easy.",
  "Yoga and mobility for 25 minutes, then 6 breaths per minute for 5 minutes.",
  "Mixed day: 20 minutes cycling, 15 minutes resistance, 5 minutes breathing.",
  "Recovery day: gentle cycling or walking, stretching, and early sleep focus.",
];

const foodDailyLimits = {
  potassium: { target: 4700, unit: "mg", direction: "atLeast" },
  magnesium: { target: 800, unit: "mg", direction: "atLeast" },
  netCarbs: { target: 50, unit: "g", direction: "atMost" },
  carbFiberRatio: { target: 7, unit: ":1", direction: "atMost" },
  glycemicLoad: { target: 10, unit: "", direction: "atMost" },
};

const foodDatabase = [
  { key: "avocado", label: "Avocado", potassium: 700, magnesium: 40, carbs: 12, fiber: 10, netCarbs: 2, glycemicLoad: 1, helpful: true },
  { key: "spinach", label: "Spinach", potassium: 840, magnesium: 80, carbs: 7, fiber: 4, netCarbs: 3, glycemicLoad: 1, helpful: true },
  { key: "swiss chard", label: "Swiss chard", potassium: 1000, magnesium: 150, carbs: 7, fiber: 4, netCarbs: 3, glycemicLoad: 1, helpful: true },
  { key: "chard", label: "Chard", potassium: 1000, magnesium: 150, carbs: 7, fiber: 4, netCarbs: 3, glycemicLoad: 1, helpful: true },
  { key: "beet tops", label: "Beet tops", potassium: 1300, magnesium: 100, carbs: 8, fiber: 4, netCarbs: 4, glycemicLoad: 2, helpful: true },
  { key: "celery", label: "Celery", potassium: 260, magnesium: 10, carbs: 4, fiber: 2, netCarbs: 2, glycemicLoad: 1, helpful: true },
  { key: "eggs", label: "Eggs", potassium: 130, magnesium: 12, carbs: 1, fiber: 0, netCarbs: 1, glycemicLoad: 0, helpful: true },
  { key: "egg", label: "Egg", potassium: 65, magnesium: 6, carbs: 1, fiber: 0, netCarbs: 1, glycemicLoad: 0, helpful: true },
  { key: "chicken", label: "Chicken", potassium: 330, magnesium: 25, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0, helpful: true },
  { key: "fish", label: "Fish", potassium: 400, magnesium: 35, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0, helpful: true },
  { key: "meat", label: "Meat", potassium: 320, magnesium: 25, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0, helpful: true },
  { key: "salad", label: "Salad", potassium: 350, magnesium: 30, carbs: 6, fiber: 3, netCarbs: 3, glycemicLoad: 1, helpful: true },
  { key: "hibiscus", label: "Hibiscus tea", potassium: 20, magnesium: 0, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0, helpful: true },
  { key: "beetroot", label: "Beetroot", potassium: 520, magnesium: 35, carbs: 13, fiber: 4, netCarbs: 9, glycemicLoad: 5, helpful: true },
  { key: "beets", label: "Beets", potassium: 520, magnesium: 35, carbs: 13, fiber: 4, netCarbs: 9, glycemicLoad: 5, helpful: true },
  { key: "cacao", label: "Cacao", potassium: 200, magnesium: 80, carbs: 8, fiber: 5, netCarbs: 3, glycemicLoad: 1, helpful: true },
  { key: "flaxseed", label: "Flaxseed", potassium: 230, magnesium: 110, carbs: 8, fiber: 8, netCarbs: 0, glycemicLoad: 0, helpful: true },
  { key: "bread", label: "Bread", potassium: 80, magnesium: 20, carbs: 24, fiber: 2, netCarbs: 22, glycemicLoad: 12, caution: true },
  { key: "rice", label: "Rice", potassium: 55, magnesium: 20, carbs: 45, fiber: 1, netCarbs: 44, glycemicLoad: 23, caution: true },
  { key: "pasta", label: "Pasta", potassium: 60, magnesium: 25, carbs: 43, fiber: 2, netCarbs: 41, glycemicLoad: 18, caution: true },
  { key: "potato", label: "Potato", potassium: 900, magnesium: 45, carbs: 37, fiber: 4, netCarbs: 33, glycemicLoad: 20, caution: true },
  { key: "sugar", label: "Sugar", potassium: 0, magnesium: 0, carbs: 25, fiber: 0, netCarbs: 25, glycemicLoad: 18, caution: true },
  { key: "soda", label: "Soda", potassium: 0, magnesium: 0, carbs: 39, fiber: 0, netCarbs: 39, glycemicLoad: 26, caution: true },
];

const form = document.querySelector("#healthForm");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const todayLabel = document.querySelector("#todayLabel");
const todayStatus = document.querySelector("#todayStatus");
const loginOverlay = document.querySelector("#loginOverlay");
const loginForm = document.querySelector("#loginForm");
const loginUsername = document.querySelector("#loginUsername");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const logoutBtn = document.querySelector("#logoutBtn");
const bpMetric = document.querySelector("#bpMetric");
const bpMetricStatus = document.querySelector("#bpMetricStatus");
const pulseMetric = document.querySelector("#pulseMetric");
const weightMetric = document.querySelector("#weightMetric");
const weightMetricTrend = document.querySelector("#weightMetricTrend");
const targetMetric = document.querySelector("#targetMetric");
const categoryBadge = document.querySelector("#categoryBadge");
const readingSummary = document.querySelector("#readingSummary");
const recommendations = document.querySelector("#recommendations");
const targetList = document.querySelector("#targetList");
const targetScore = document.querySelector("#targetScore");
const nutritionSummary = document.querySelector("#nutritionSummary");
const nutritionList = document.querySelector("#nutritionList");
const nutritionAdvice = document.querySelector("#nutritionAdvice");
const foodScoreBadge = document.querySelector("#foodScoreBadge");
const coachText = document.querySelector("#coachText");
const deepAnalysis = document.querySelector("#deepAnalysis");
const historyBody = document.querySelector("#historyBody");
const activityBody = document.querySelector("#activityBody");
const trendChart = document.querySelector("#trendChart");
const alertBox = document.querySelector("#alertBox");
const resetTodayBtn = document.querySelector("#resetTodayBtn");
const exportBtn = document.querySelector("#exportBtn");
const importJsonInput = document.querySelector("#importJsonInput");
const databaseBackupBtn = document.querySelector("#databaseBackupBtn");
const analyzeAllBtn = document.querySelector("#analyzeAllBtn");
const saveLogBtn = document.querySelector("#saveLogBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const portionFood = document.querySelector("#portionFood");
const portionServings = document.querySelector("#portionServings");
const addPortionBtn = document.querySelector("#addPortionBtn");
const portionList = document.querySelector("#portionList");
const foodPhotoInput = document.querySelector("#foodPhoto");
const foodPhotoPreview = document.querySelector("#foodPhotoPreview");
const analyzePhotoBtn = document.querySelector("#analyzePhotoBtn");
const useIdentifiedFoodsBtn = document.querySelector("#useIdentifiedFoodsBtn");
const photoAnalysisStatus = document.querySelector("#photoAnalysisStatus");
const confirmedFoodsInput = document.querySelector("#confirmedFoods");
const identifiedFoods = document.querySelector("#identifiedFoods");
const photoAiBadge = document.querySelector("#photoAiBadge");
const weeklyReport = document.querySelector("#weeklyReport");
const monthlyReport = document.querySelector("#monthlyReport");
const morningReminder = document.querySelector("#morningReminder");
const eveningReminder = document.querySelector("#eveningReminder");
const medicineReminder = document.querySelector("#medicineReminder");
const saveRemindersBtn = document.querySelector("#saveRemindersBtn");
const requestNotificationsBtn = document.querySelector("#requestNotificationsBtn");
const reminderStatus = document.querySelector("#reminderStatus");
const reminderBadge = document.querySelector("#reminderBadge");
const chatForm = document.querySelector("#chatForm");
const chatQuestion = document.querySelector("#chatQuestion");
const chatMessages = document.querySelector("#chatMessages");
const chatStatusBadge = document.querySelector("#chatStatusBadge");
const quickQuestions = document.querySelectorAll(".quick-question");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const moreNavBtn = document.querySelector("#moreNavBtn");
const overflowNav = document.querySelector("#overflowNav");

const today = new Date();
const sastNow = getSastNowParts(today);
const isoToday = sastNow.date;
dateInput.value = sastNow.date;
timeInput.value = sastNow.time;
todayLabel.textContent = today.toLocaleDateString(undefined, {
  timeZone: SAST_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function loadLogs() {
  return logsCache;
}

async function appFetch(url, options = {}) {
  const response = await fetch(url, withAuth(options));
  if (response.status === 401) {
    showLogin();
    throw new Error("Login required.");
  }
  return response;
}

function withAuth(options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { ...options, headers };
}

function showLogin() {
  loginOverlay.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  sessionReady = false;
}

function hideLogin() {
  loginOverlay.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
  sessionReady = true;
}

async function checkSession() {
  const response = await fetch("/api/session", withAuth());
  const session = await response.json();
  if (session.authenticated) hideLogin();
  else showLogin();
  return session;
}

async function login() {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: loginUsername.value.trim(), password: loginPassword.value }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Login failed.");
  }
  const result = await response.json();
  if (result.token) localStorage.setItem(AUTH_TOKEN_KEY, result.token);
  loginPassword.value = "";
  hideLogin();
  await refreshLogs();
  render();
}

async function logout() {
  await fetch("/api/logout", withAuth({ method: "POST" }));
  localStorage.removeItem(AUTH_TOKEN_KEY);
  logsCache = [];
  render();
  showLogin();
}

async function refreshLogs() {
  const response = await appFetch(LOGS_API_URL);
  if (!response.ok) throw new Error("Could not load logs from SQLite.");
  logsCache = await response.json();
  return logsCache;
}

async function saveLog(log) {
  const response = await appFetch(LOGS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Could not save log.");
  }
  await refreshLogs();
}

async function deleteLog(id) {
  const response = await appFetch(`${LOGS_API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Could not delete log.");
  await refreshLogs();
}

async function replaceLogs(logs) {
  const response = await appFetch(LOGS_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logs),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Could not import logs.");
  }
  await refreshLogs();
}

function populateFoodOptions() {
  const helpful = foodDatabase
    .filter((item) => item.helpful)
    .sort((a, b) => a.label.localeCompare(b.label));
  portionFood.innerHTML = helpful.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`).join("");
}

function getSastNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: SAST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((values, part) => {
      values[part.type] = part.value;
      return values;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour.padStart(2, "0")}:${parts.minute.padStart(2, "0")}`,
  };
}

function buildSastTimestamp(date, time) {
  return `${date}T${time || "00:00"}:00+02:00`;
}

function logSortValue(log) {
  return `${log.date || ""}T${log.time || "00:00"}`;
}

function classifyBloodPressure(sys, dia) {
  return bpCategories.find((category) => category.test(sys, dia)) || bpCategories.at(-1);
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function hasBloodPressure(log) {
  return Number.isFinite(Number(log?.systolic)) && Number.isFinite(Number(log?.diastolic)) && Number(log.systolic) > 0 && Number(log.diastolic) > 0;
}

function hasAnyLogContent(log) {
  return Boolean(
    hasBloodPressure(log) ||
      Number(log.systolic) > 0 ||
      Number(log.diastolic) > 0 ||
      Number(log.pulse) > 0 ||
      Number(log.weight) > 0 ||
      Number(log.manualPotassium) > 0 ||
      Number(log.manualMagnesium) > 0 ||
      Number(log.estimatedNutrition?.potassium) > 0 ||
      Number(log.estimatedNutrition?.magnesium) > 0 ||
      Number(log.estimatedNutrition?.netCarbs) > 0 ||
      log.food ||
      log.notes ||
      log.atenolol ||
      log.adco ||
      Number(log.exerciseMinutes) > 0 ||
      log.exerciseDone !== "none" ||
      log.foodPhotoName ||
      log.confirmedFoods
  );
}

function formatBloodPressure(log) {
  if (hasBloodPressure(log)) return `${log.systolic}/${log.diastolic}`;
  if (Number(log?.systolic) > 0 || Number(log?.diastolic) > 0) return `${log?.systolic || "--"}/${log?.diastolic || "--"}`;
  return "--/--";
}

function getBloodPressureCategory(log) {
  return hasBloodPressure(log) ? classifyBloodPressure(Number(log.systolic), Number(log.diastolic)) : null;
}

function getFormData() {
  const data = new FormData(form);
  const currentSast = getSastNowParts();
  const date = data.get("date") || currentSast.date;
  const time = data.get("time") || currentSast.time;
  const confirmedFoods = data.get("confirmedFoods")?.trim() || "";
  const portionFoodText = portionEntries
    .map((entry) => `${formatNumber(Number(entry.servings) || 1)} ${entry.key}`)
    .join(", ");
  const food = [data.get("food")?.trim(), confirmedFoods, portionFoodText].filter(Boolean).join(", ");
  const estimatedNutrition = estimateFoodNutrition(food, portionEntries);
  const sys = toPositiveNumber(data.get("systolic"));
  const dia = toPositiveNumber(data.get("diastolic"));
  const pulse = toPositiveNumber(data.get("pulse"));
  const weight = toPositiveNumber(data.get("weight"));
  const manualPotassium = Number(data.get("potassium")) || 0;
  const manualMagnesium = Number(data.get("magnesium")) || 0;
  const category = sys && dia ? classifyBloodPressure(sys, dia) : null;

  const log = {
    id: editingLogId || `${date}-${time}-${Date.now()}`,
    date,
    time,
    timestampSast: buildSastTimestamp(date, time),
    systolic: sys,
    diastolic: dia,
    pulse,
    weight,
    atenolol: data.get("atenolol") === "on",
    adco: data.get("adco") === "on",
    potassium: Math.max(manualPotassium, estimatedNutrition.potassium),
    magnesium: Math.max(manualMagnesium, estimatedNutrition.magnesium),
    manualPotassium,
    manualMagnesium,
    estimatedNutrition,
    portionEntries: [...portionEntries],
    food,
    confirmedFoods,
    foodPhotoName: foodPhotoInput.files[0]?.name || "",
    foodPhotoAnalyzed: Boolean(confirmedFoods),
    exerciseDone: data.get("exerciseDone"),
    exerciseMinutes: Number(data.get("exerciseMinutes")) || 0,
    notes: data.get("notes")?.trim() || "",
    categoryKey: category?.key || "notLogged",
    categoryLabel: category?.label || "Not logged",
  };
  if (!hasAnyLogContent(log)) {
    throw new Error("Add at least one item to save: meal, BP, pulse, weight, medication, exercise, nutrients, or notes.");
  }
  return log;
}

function foodScore(food) {
  const normalized = food.toLowerCase();
  const nutrition = estimateFoodNutrition(food);
  const helpful = helpfulFoods.filter((item) => normalized.includes(item));
  const caution = cautionFoods.filter((item) => normalized.includes(item));
  nutrition.matches.forEach((item) => {
    if (item.helpful) helpful.push(item.label.toLowerCase());
    if (item.caution) caution.push(item.label.toLowerCase());
  });
  return { helpful: [...new Set(helpful)], caution: [...new Set(caution)] };
}

function estimateFoodNutrition(food, portions = []) {
  const normalized = food.toLowerCase();
  const matches = [];

  portions.forEach((entry) => {
    const item = foodDatabase.find((foodItem) => foodItem.key === entry.key);
    if (item) matches.push({ ...item, servings: Number(entry.servings) || 1, fromPortion: true });
  });

  foodDatabase.forEach((item) => {
    if (matches.some((match) => match.key === item.key && match.fromPortion)) return;
    if (item.key === "egg" && normalized.includes("eggs")) return;
    if (item.key === "chard" && normalized.includes("swiss chard")) return;
    const phrase = item.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "\\s+");
    const phrasePattern = new RegExp(`\\b${phrase}\\b`);
    if (!phrasePattern.test(normalized)) return;
    const countPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?${phrase}\\b`);
    const countMatch = normalized.match(countPattern);
    const servings = countMatch ? Number(countMatch[1]) : 1;
    matches.push({ ...item, servings });
  });

  const totals = matches.reduce(
    (sum, item) => {
      sum.potassium += item.potassium * item.servings;
      sum.magnesium += item.magnesium * item.servings;
      sum.carbs += item.carbs * item.servings;
      sum.fiber += item.fiber * item.servings;
      sum.netCarbs += item.netCarbs * item.servings;
      sum.glycemicLoad += item.glycemicLoad * item.servings;
      return sum;
    },
    { potassium: 0, magnesium: 0, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0 }
  );

  totals.carbFiberRatio = totals.fiber > 0 ? Number((totals.carbs / totals.fiber).toFixed(1)) : totals.carbs > 0 ? 99 : 0;
  totals.matches = matches;
  return totals;
}

function latestBloodPressureLog(logs) {
  return [...logs].filter(hasBloodPressure).sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)))[0] || null;
}

function getLogsForDate(logs, date) {
  return logs.filter((log) => log.date === date);
}

function sumNutrition(logs) {
  const matches = logs.flatMap((log) => log.estimatedNutrition?.matches || []);
  const totals = logs.reduce(
    (sum, log) => {
      const nutrition = log.estimatedNutrition || {};
      sum.potassium += Number(log.potassium) || Number(nutrition.potassium) || 0;
      sum.magnesium += Number(log.magnesium) || Number(nutrition.magnesium) || 0;
      sum.carbs += Number(nutrition.carbs) || 0;
      sum.fiber += Number(nutrition.fiber) || 0;
      sum.netCarbs += Number(nutrition.netCarbs) || 0;
      sum.glycemicLoad += Number(nutrition.glycemicLoad) || 0;
      return sum;
    },
    { potassium: 0, magnesium: 0, carbs: 0, fiber: 0, netCarbs: 0, glycemicLoad: 0 }
  );
  totals.carbFiberRatio = totals.fiber > 0 ? Number((totals.carbs / totals.fiber).toFixed(1)) : totals.carbs > 0 ? 99 : 0;
  totals.matches = matches;
  return totals;
}

function buildDailySummary(logs, date = isoToday) {
  const entries = getLogsForDate(logs, date);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)));
  const latest = sorted[0];
  const latestWeight = sorted.find((log) => log.weight)?.weight || null;
  const latestPulse = sorted.find((log) => Number(log.pulse) > 0)?.pulse || null;
  const latestBp = sorted.find(hasBloodPressure) || null;
  const nutrition = sumNutrition(entries);
  return {
    id: `daily-${date}`,
    date,
    time: latest.time,
    timestampSast: latest.timestampSast,
    systolic: latestBp?.systolic || null,
    diastolic: latestBp?.diastolic || null,
    pulse: latestPulse,
    weight: latestWeight,
    atenolol: entries.some((log) => log.atenolol),
    adco: entries.some((log) => log.adco),
    potassium: nutrition.potassium,
    magnesium: nutrition.magnesium,
    manualPotassium: 0,
    manualMagnesium: 0,
    estimatedNutrition: nutrition,
    portionEntries: entries.flatMap((log) => log.portionEntries || []),
    food: entries.map((log) => log.food).filter(Boolean).join(", "),
    confirmedFoods: entries.map((log) => log.confirmedFoods).filter(Boolean).join(", "),
    exerciseDone: entries.some((log) => log.exerciseDone && log.exerciseDone !== "none") ? "mixed" : "none",
    exerciseMinutes: entries.reduce((sum, log) => sum + (Number(log.exerciseMinutes) || 0), 0),
    notes: entries.map((log) => log.notes).filter(Boolean).join(" | "),
    entryCount: entries.length,
  };
}

function describeActivityType(log) {
  const types = [];
  if (log.food || log.confirmedFoods || (log.portionEntries || []).length) types.push("Meal");
  if (log.atenolol || log.adco) types.push("Medication");
  if (Number(log.exerciseMinutes) > 0 || (log.exerciseDone && log.exerciseDone !== "none")) types.push("Exercise");
  if (log.weight) types.push("Weight");
  if (Number(log.pulse) > 0) types.push("Pulse");
  if (Number(log.potassium) > 0 || Number(log.magnesium) > 0) types.push("Nutrients");
  if (log.notes) types.push("Notes");
  return types.length ? types.join(", ") : "Log";
}

function describeActivityDetails(log) {
  const details = [];
  if (log.food) details.push(log.food);
  if (log.weight) details.push(`${log.weight}kg`);
  if (Number(log.exerciseMinutes) > 0) details.push(`${log.exerciseMinutes} min ${log.exerciseDone || "exercise"}`);
  if (log.atenolol || log.adco) details.push(`Meds: ${[log.atenolol ? "Atenolol/Kiara" : "", log.adco ? "Adco-Retic" : ""].filter(Boolean).join(", ")}`);
  if (Number(log.potassium) > 0 || Number(log.magnesium) > 0) details.push(`K ${formatNumber(Number(log.potassium) || 0)}mg, Mg ${formatNumber(Number(log.magnesium) || 0)}mg`);
  if (log.notes) details.push(log.notes);
  return details.length ? details.join(" | ") : "-";
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(log) {
  return log.time ? `${log.time} SAST` : "Not logged";
}

function renderPortions() {
  portionList.innerHTML = portionEntries.length
    ? portionEntries
        .map((entry, index) => {
          const item = foodDatabase.find((foodItem) => foodItem.key === entry.key);
          const label = item?.label || entry.key;
          return `
            <div class="portion-row">
              <span><strong>${escapeHtml(label)}</strong><br>${formatNumber(Number(entry.servings) || 1)} serving(s)</span>
              <button type="button" data-index="${index}">Remove</button>
            </div>
          `;
        })
        .join("")
    : `<p class="mini-copy">Add foods with servings here for better nutrient estimates.</p>`;
}

function addPortion() {
  const key = portionFood.value;
  const servings = Number(portionServings.value) || 1;
  const existing = portionEntries.find((entry) => entry.key === key);
  if (existing) existing.servings = Number(existing.servings) + servings;
  else portionEntries.push({ key, servings });
  renderPortions();
}

function switchToTab(tabId) {
  tabButtons.forEach((item) => item.classList.toggle("active", item.dataset.tab === tabId));
  moreNavBtn.classList.toggle("active", ["historyTab", "activityTab", "referenceTab"].includes(tabId));
  overflowNav.classList.add("hidden");
  moreNavBtn.setAttribute("aria-expanded", "false");
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.querySelector(`#${tabId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  if (tabId === "insightsTab") drawChart(loadLogs());
}

function loadLogIntoForm(log) {
  editingLogId = log.id;
  dateInput.value = log.date || isoToday;
  timeInput.value = log.time || getSastNowParts().time;
  document.querySelector("#weight").value = log.weight || "";
  document.querySelector("#systolic").value = log.systolic || "";
  document.querySelector("#diastolic").value = log.diastolic || "";
  document.querySelector("#pulse").value = log.pulse || "";
  document.querySelector("#atenolol").checked = Boolean(log.atenolol);
  document.querySelector("#adco").checked = Boolean(log.adco);
  document.querySelector("#potassium").value = log.manualPotassium || log.potassium || "";
  document.querySelector("#magnesium").value = log.manualMagnesium || log.magnesium || "";
  document.querySelector("#food").value = log.food || "";
  confirmedFoodsInput.value = log.confirmedFoods || "";
  document.querySelector("#exerciseDone").value = log.exerciseDone || "none";
  document.querySelector("#exerciseMinutes").value = log.exerciseMinutes || "";
  document.querySelector("#notes").value = log.notes || "";
  portionEntries = Array.isArray(log.portionEntries) ? [...log.portionEntries] : [];
  renderPortions();
  saveLogBtn.textContent = "Update log";
  cancelEditBtn.classList.remove("hidden");
  switchToTab("logTab");
}

function resetFormForNewLog() {
  form.reset();
  const now = getSastNowParts();
  dateInput.value = now.date;
  timeInput.value = now.time;
  document.querySelector("#atenolol").checked = false;
  document.querySelector("#adco").checked = false;
  confirmedFoodsInput.value = "";
  identifiedFoods.innerHTML = "";
  foodPhotoInput.value = "";
  portionEntries = [];
  renderPortions();
  renderPhotoPreview(null);
  photoAiBadge.textContent = "AI-ready";
  editingLogId = null;
  saveLogBtn.textContent = "Save log";
  cancelEditBtn.classList.add("hidden");
}

function getRecommendations(log, logs, bpLog = null) {
  if (!log) return [];

  const tips = [];
  const category = getBloodPressureCategory(bpLog || log);
  const food = foodScore(log.food);

  if (!category) {
    tips.push("No blood pressure reading is logged today yet. Meal, weight, exercise, and nutrient patterns are still being tracked.");
  } else if (category.key === "crisis") {
    tips.push("If you have chest pain, shortness of breath, weakness, vision changes, confusion, severe headache, or other concerning symptoms, seek emergency care now. If no symptoms, recheck after resting and contact your clinician urgently.");
  } else if (category.key === "stage2") {
    tips.push("Rest for 5 minutes, repeat the reading, log both results, and contact your clinician if this stays high or is unusual for you.");
  } else if (category.key === "stage1") {
    tips.push("Focus today on low sodium, low carb meals, cycling or resistance work, and slow breathing. Watch the trend over several days.");
  } else if (category.key === "elevated") {
    tips.push("This is a good day to tighten salt, sleep, stress, and exercise habits before it climbs higher.");
  } else {
    tips.push("Keep doing what is working: consistent medication logging, low carb meals, movement, sleep, and stress control.");
  }

  if (!log.atenolol || !log.adco) {
    tips.push("One prescribed medicine was not marked as taken. If you missed it, follow your clinician's instructions rather than doubling doses.");
  }

  if (log.potassium < 3500) {
    tips.push("Potassium looks low against the 4,700mg target. Prefer food sources like avocado, spinach, swiss chard, beet tops, celery, and greens, and ask your clinician before supplements.");
  }

  if (log.magnesium < 400) {
    tips.push("Magnesium is under your target. Your notes prefer magnesium glycinate; confirm dose and safety with your clinician.");
  }

  if (food.caution.length) {
    tips.push(`Food caution found: ${food.caution.join(", ")}. These may work against low-carb or blood-pressure goals, especially with high salt or refined carbs.`);
  }

  if (food.helpful.length) {
    tips.push(`Helpful foods logged: ${food.helpful.join(", ")}.`);
  }

  if (log.exerciseMinutes < 20) {
    tips.push(`Exercise idea for today: ${exercisePlan[new Date(`${log.date}T12:00:00`).getDay()]}`);
  }

  const previous = logs
    .filter((entry) => entry.weight && entry.date < log.date)
    .sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)))[0];

  if (previous && log.weight) {
    const weightDiff = Number((log.weight - previous.weight).toFixed(1));
    if (Math.abs(weightDiff) >= 0.5) {
      tips.push(`Weight changed by ${weightDiff > 0 ? "+" : ""}${weightDiff}kg since the previous logged weight. Watch whether systolic pressure moves in the same direction over the next week.`);
    }
  }

  return tips;
}

function getTargets(log) {
  const food = log ? foodScore(log.food) : { helpful: [], caution: [] };
  return [
    {
      label: "Medicine logged",
      met: Boolean(log?.atenolol && log?.adco),
      detail: "Atenolol/Kiara and Adco-Retic",
    },
    {
      label: "Potassium",
      met: Number(log?.potassium) >= 4700,
      detail: `${Number(log?.potassium) || 0}/4700mg`,
    },
    {
      label: "Magnesium",
      met: Number(log?.magnesium) >= 800,
      detail: `${Number(log?.magnesium) || 0}/800mg`,
    },
    {
      label: "Low-carb food quality",
      met: Boolean(log?.food) && food.caution.length === 0,
      detail: food.caution.length ? "Caution foods found" : "No caution foods detected",
    },
    {
      label: "Helpful BP foods",
      met: food.helpful.length > 0,
      detail: food.helpful.length ? food.helpful.slice(0, 3).join(", ") : "Add greens, avocado, celery, fish, or eggs",
    },
    {
      label: "Exercise",
      met: Number(log?.exerciseMinutes) >= 20,
      detail: `${Number(log?.exerciseMinutes) || 0} minutes`,
    },
  ];
}

function updateInsights(log, logs, latestBp = null) {
  if (!log && !latestBp) {
    categoryBadge.textContent = "Waiting";
    categoryBadge.className = "badge";
    readingSummary.textContent = "Add your blood pressure reading to get the daily status and next steps.";
    recommendations.innerHTML = "";
    targetList.innerHTML = "";
    targetScore.textContent = "0/6";
    targetMetric.textContent = "0/6";
    bpMetric.textContent = "--/--";
    bpMetricStatus.textContent = "No reading yet";
    pulseMetric.textContent = "--";
    weightMetric.textContent = "--";
    weightMetricTrend.textContent = "Trend starts after 2 logs";
    nutritionSummary.textContent = "Save a food log to estimate potassium, magnesium, net carbs, fiber ratio, and food quality.";
    nutritionList.innerHTML = "";
    nutritionAdvice.innerHTML = "";
    foodScoreBadge.textContent = "Waiting";
    foodScoreBadge.className = "badge neutral";
    coachText.textContent = "Your coach will combine today's blood pressure, medication, food, exercise, weight, and nutrient notes after you save a log.";
    deepAnalysis.innerHTML = "";
    todayStatus.textContent = "No reading yet";
    alertBox.classList.add("hidden");
    return;
  }

  const bpLog = latestBp || (hasBloodPressure(log) ? log : null);
  const category = getBloodPressureCategory(bpLog);
  categoryBadge.textContent = category?.label || "BP not logged";
  categoryBadge.className = `badge ${category?.key || "neutral"}`;
  todayStatus.textContent = category ? `${formatBloodPressure(bpLog)} - ${category.label}` : "BP not logged today";
  bpMetric.textContent = bpLog ? formatBloodPressure(bpLog) : "--/--";
  bpMetricStatus.textContent = category ? `${category.label} - ${formatDate(bpLog.date)} ${formatTime(bpLog)}` : "Add reading when available";
  pulseMetric.textContent = bpLog?.pulse || log?.pulse || "--";
  weightMetric.textContent = log?.weight ? `${log.weight}kg` : "--";
  weightMetricTrend.textContent = log ? getWeightTrendText(log, logs) : "Trend starts after 2 logs";
  readingSummary.textContent = category
    ? `${category.summary} ${bpLog?.pulse ? `Pulse is ${bpLog.pulse} bpm. ` : ""}This is your latest BP reading, while today's meals and activities are tracked cumulatively.`
    : "Today's entries do not include a blood pressure reading yet. Food, nutrients, weight, exercise, and notes are still saved for trend analysis.";

  if (category?.key === "crisis") {
    alertBox.textContent = "Crisis-range reading: rest and recheck. If you have severe symptoms, seek emergency care now. Contact your clinician urgently if the reading remains very high.";
    alertBox.classList.remove("hidden");
  } else {
    alertBox.classList.add("hidden");
  }

  const tips = getRecommendations(log || bpLog, logs, bpLog);
  recommendations.innerHTML = tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");

  const targets = getTargets(log);
  const metCount = targets.filter((target) => target.met).length;
  targetScore.textContent = `${metCount}/${targets.length}`;
  targetMetric.textContent = `${metCount}/${targets.length}`;
  targetList.innerHTML = targets
    .map(
      (target) => `
        <div class="target-item">
          <span><strong>${escapeHtml(target.label)}</strong><br>${escapeHtml(target.detail)}</span>
          <span>${target.met ? "Met" : "Open"}</span>
        </div>
      `
    )
    .join("");

  if (log) {
    renderNutrition(log);
    nutritionSummary.textContent = `${nutritionSummary.textContent} Today's totals combine ${log.entryCount || 1} log(s).`;
  } else {
    nutritionSummary.textContent = "Save a food log today to estimate potassium, magnesium, net carbs, fiber ratio, and food quality.";
    nutritionList.innerHTML = "";
    nutritionAdvice.innerHTML = "";
    foodScoreBadge.textContent = "Waiting";
    foodScoreBadge.className = "badge neutral";
  }
  coachText.textContent = buildCoachMessage(log || bpLog, logs, category, targets, tips);
}

function getWeightTrendText(log, logs) {
  const previous = logs
    .filter((entry) => entry.weight && entry.date < log.date)
    .sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)))[0];
  if (!previous || !log.weight) return "Trend starts after 2 logs";
  const diff = Number((log.weight - previous.weight).toFixed(1));
  if (diff === 0) return "No change since previous log";
  return `${diff > 0 ? "+" : ""}${diff}kg since previous log`;
}

function renderNutrition(log) {
  const nutrition = log.estimatedNutrition || estimateFoodNutrition(log.food);
  const combined = {
    ...nutrition,
    potassium: Math.max(Number(log.manualPotassium) || 0, nutrition.potassium || Number(log.potassium) || 0),
    magnesium: Math.max(Number(log.manualMagnesium) || 0, nutrition.magnesium || Number(log.magnesium) || 0),
  };

  const checks = [
    { key: "potassium", label: "Potassium", value: combined.potassium, ...foodDailyLimits.potassium },
    { key: "magnesium", label: "Magnesium", value: combined.magnesium, ...foodDailyLimits.magnesium },
    { key: "netCarbs", label: "Net carbs", value: combined.netCarbs, ...foodDailyLimits.netCarbs },
    { key: "carbFiberRatio", label: "Carb:fiber ratio", value: combined.carbFiberRatio, ...foodDailyLimits.carbFiberRatio },
    { key: "glycemicLoad", label: "Glycemic load", value: combined.glycemicLoad, ...foodDailyLimits.glycemicLoad },
  ];

  const met = checks.filter(isLimitMet).length;
  foodScoreBadge.textContent = `${met}/${checks.length}`;
  foodScoreBadge.className = `badge ${met >= 4 ? "normal" : met >= 2 ? "elevated" : "stage2"}`;
  const matched = nutrition.matches?.length ? nutrition.matches.map((item) => item.label).join(", ") : "no known foods matched";
  nutritionSummary.textContent = `Matched ${matched}. Manual potassium or magnesium entries are used when they are higher than the food estimate.`;
  nutritionList.innerHTML = checks.map(renderNutritionItem).join("");
  renderNutritionAdvice(log, checks);
}

function isLimitMet(check) {
  if (check.direction === "atLeast") return check.value >= check.target;
  return check.value <= check.target;
}

function renderNutritionItem(check) {
  const met = isLimitMet(check);
  const percent =
    check.direction === "atLeast"
      ? Math.min((check.value / check.target) * 100, 100)
      : Math.min((check.value / check.target) * 100, 140);
  const highClass = check.direction === "atMost" && check.value > check.target ? "high" : met ? "" : "warn";
  const unit = check.unit || "";
  const targetText = check.direction === "atLeast" ? `target ${check.target}${unit}` : `limit ${check.target}${unit}`;

  return `
    <div class="nutrition-item">
      <span><strong>${escapeHtml(check.label)}</strong><br>${formatNumber(check.value)}${escapeHtml(unit)} / ${escapeHtml(targetText)}</span>
      <div class="progress-track" aria-hidden="true"><span class="progress-fill ${highClass}" style="width: ${Math.max(4, Math.min(percent, 100))}%"></span></div>
      <span>${met ? "Met" : "Open"}</span>
    </div>
  `;
}

function renderNutritionAdvice(log, checks) {
  const localItems = buildLocalNutritionAdvice(log, checks);
  nutritionAdvice.innerHTML = renderAdviceCards(localItems);
  requestNutritionAdvice(log, checks, localItems);
}

function buildLocalNutritionAdvice(log, checks) {
  const foodText = (log.food || "").toLowerCase();
  const matched = log.estimatedNutrition?.matches || [];
  const matchedNames = matched.map((item) => item.label).join(", ");
  const items = checks.map((check) => {
    const met = isLimitMet(check);
    if (check.key === "potassium") {
      return {
        title: met ? "Potassium target reached" : "Potassium still low",
        priority: met ? "low" : "high",
        advice: met
          ? `${matchedNames || "Your logged food"} likely helped. Keep using avocado, spinach, swiss chard/silverbeet, beet greens, celery, fish, and low-carb greens if they suit you.`
          : "Add South Africa-friendly potassium foods: avocado, spinach, swiss chard/silverbeet, beet greens, broccoli, mushrooms, pilchards/sardines, mackerel, or low-carb greens. Use potassium supplements only with clinician guidance.",
      };
    }
    if (check.key === "magnesium") {
      return {
        title: met ? "Magnesium target reached" : "Magnesium still low",
        priority: met ? "low" : "medium",
        advice: met
          ? `${matchedNames || "Your logged food"} likely contributed. Keep using spinach, cacao, pumpkin seeds, almonds, peanuts, fish, and leafy greens where they fit your carb plan.`
          : "Add magnesium foods: pumpkin seeds, almonds, peanuts, spinach, swiss chard/silverbeet, cacao, mackerel, sardines, or plain yoghurt/maas if tolerated and compatible with your plan.",
      };
    }
    if (check.key === "netCarbs") {
      return {
        title: met ? "Net carbs within limit" : "Net carbs over limit",
        priority: met ? "low" : "high",
        advice: met
          ? "Good. Stay with eggs, meat, fish, chicken, avocado, spinach, cabbage, cauliflower, broccoli, salad, and unsweetened rooibos."
          : `Likely carb drivers: ${findLikelyCarbDrivers(foodText)}. Swap toward eggs, chicken, fish, mince, avocado, cabbage, cauliflower, spinach, broccoli, cucumber, salad, or green beans.`,
      };
    }
    if (check.key === "carbFiberRatio") {
      return {
        title: met ? "Carb:fiber ratio is good" : "Carb:fiber ratio too high",
        priority: met ? "low" : "medium",
        advice: met
          ? "Lower is better here, and your ratio is below 7:1. High-fiber low-carb vegetables are helping."
          : "For carb:fiber ratio, lower is better. Choose carbs with more fiber: leafy greens, cabbage, broccoli, cauliflower, green beans, avocado, chia/flaxseed. Reduce refined starches and sweet drinks.",
      };
    }
    return {
      title: met ? "Glycemic load within limit" : "Glycemic load over limit",
      priority: met ? "low" : "high",
      advice: met
        ? "Good. This suggests the meal is less likely to spike glucose heavily."
        : `Likely glycemic-load drivers: ${findLikelyCarbDrivers(foodText)}. Use lower-load meals built around protein, healthy fats, and non-starchy vegetables.`,
    };
  });
  return items;
}

function findLikelyCarbDrivers(foodText) {
  const drivers = ["bread", "rice", "pasta", "potato", "sugar", "juice", "soda", "cake", "biscuit", "cookies", "starch", "pap", "maize", "cereal", "oats", "banana", "fruit"];
  const found = drivers.filter((item) => foodText.includes(item));
  return found.length ? found.join(", ") : "starchy or sweet foods in the meal";
}

function renderAdviceCards(items) {
  return items
    .map(
      (item) => `
        <div class="advice-card ${escapeHtml(item.priority || "low")}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.advice)}</span>
        </div>
      `
    )
    .join("");
}

async function requestNutritionAdvice(log, checks, localItems) {
  try {
    const response = await appFetch(AI_NUTRITION_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log, checks }),
    });
    if (!response.ok) return;
    const result = await response.json();
    const aiItems = Array.isArray(result.items) ? result.items : [];
    if (!aiItems.length) return;
    const items = [
      {
        title: "AI summary",
        advice: result.summary || "AI nutrition feedback based on today's limits.",
        priority: "low",
      },
      ...aiItems,
    ];
    nutritionAdvice.innerHTML = renderAdviceCards(items);
  } catch {
    nutritionAdvice.innerHTML = renderAdviceCards(localItems);
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(value % 1 ? 1 : 0));
}

function buildCoachMessage(log, logs, category, targets, tips) {
  const missed = targets.filter((target) => !target.met).map((target) => target.label);
  const sevenDay = logs
    .filter(hasBloodPressure)
    .filter((entry) => entry.date <= log.date)
    .sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)))
    .slice(0, 7);
  const avgSys = average(sevenDay.map((entry) => Number(entry.systolic)));
  const avgDia = average(sevenDay.map((entry) => Number(entry.diastolic)));

  let message = category ? `Coach view: today is ${category.label}. ` : "Coach view: BP was not logged in this entry. ";
  if (sevenDay.length >= 2) {
    message += `Your recent average is ${Math.round(avgSys)}/${Math.round(avgDia)} over ${sevenDay.length} logged day(s). `;
  }
  if (missed.length) {
    message += `Highest-value focus: ${missed.slice(0, 3).join(", ")}. `;
  } else {
    message += "All daily targets are met today. ";
  }
  message += "Use low-carb whole foods, potassium-rich greens if safe for you, 6-breaths-per-minute breathing, cycling or resistance work, sleep, and stress control. ";
  message += tips[0] || "";
  return message;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.reduce((sum, value) => sum + value, 0) / Math.max(clean.length, 1);
}

function renderHistory(logs) {
  const sorted = [...logs].filter(hasBloodPressure).sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)));
  if (!sorted.length) {
    historyBody.innerHTML = `<tr><td colspan="7">No blood pressure readings logged yet.</td></tr>`;
    return;
  }
  historyBody.innerHTML = sorted
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDate(log.date))}</td>
          <td>${escapeHtml(formatTime(log))}</td>
          <td>${formatBloodPressure(log)}</td>
          <td>${log.pulse || "-"}</td>
          <td>${log.weight ? `${log.weight}kg` : "-"}</td>
          <td>${escapeHtml(getBloodPressureCategory(log)?.label || "Not logged")}</td>
          <td>
            <button class="ghost-button edit-btn" type="button" data-id="${escapeHtml(log.id)}">Edit</button>
            <button class="delete-btn" type="button" data-id="${escapeHtml(log.id)}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderActivityHistory(logs) {
  const sorted = [...logs].filter((log) => !hasBloodPressure(log)).sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)));
  if (!sorted.length) {
    activityBody.innerHTML = `<tr><td colspan="5">No other logs yet.</td></tr>`;
    return;
  }
  activityBody.innerHTML = sorted
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDate(log.date))}</td>
          <td>${escapeHtml(formatTime(log))}</td>
          <td>${escapeHtml(describeActivityType(log))}</td>
          <td>${escapeHtml(describeActivityDetails(log))}</td>
          <td>
            <button class="ghost-button edit-btn" type="button" data-id="${escapeHtml(log.id)}">Edit</button>
            <button class="delete-btn" type="button" data-id="${escapeHtml(log.id)}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderReports(logs) {
  weeklyReport.innerHTML = buildReport(logs, 7);
  monthlyReport.innerHTML = buildReport(logs, 30);
}

function buildReport(logs, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const recent = logs.filter((log) => log.date >= cutoffDate);
  if (!recent.length) return `<p class="mini-copy">No logs in the last ${days} days.</p>`;

  const bpLogs = recent.filter(hasBloodPressure);
  const pulseLogs = recent.filter((log) => Number(log.pulse) > 0);
  const avgSys = bpLogs.length ? Math.round(average(bpLogs.map((log) => Number(log.systolic)))) : null;
  const avgDia = bpLogs.length ? Math.round(average(bpLogs.map((log) => Number(log.diastolic)))) : null;
  const avgPulse = pulseLogs.length ? Math.round(average(pulseLogs.map((log) => Number(log.pulse)))) : null;
  const high = bpLogs.filter((log) => ["stage1", "stage2", "crisis"].includes(getBloodPressureCategory(log).key)).length;
  const meds = recent.filter((log) => log.atenolol && log.adco).length;
  const exercise = Math.round(average(recent.map((log) => Number(log.exerciseMinutes) || 0)));
  const caution = recent.filter((log) => foodScore(log.food || "").caution.length).length;
  const weightLogs = recent.filter((log) => log.weight).sort((a, b) => logSortValue(a).localeCompare(logSortValue(b)));
  const weightTrend =
    weightLogs.length >= 2
      ? `${formatNumber(weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight)}kg`
      : "Need 2 weight logs";

  return [
    ["Logs", `${recent.length}/${days} days`],
    ["BP readings", `${bpLogs.length}/${recent.length} logs`],
    ["Average BP", bpLogs.length ? `${avgSys}/${avgDia}` : "No BP readings"],
    ["Average pulse", pulseLogs.length ? `${avgPulse} bpm` : "No pulse logs"],
    ["High readings", `${high}/${bpLogs.length || 0}`],
    ["Medicine logged", `${meds}/${recent.length}`],
    ["Exercise average", `${exercise} min/day`],
    ["Caution food days", `${caution}/${recent.length}`],
    ["Weight change", weightTrend],
  ]
    .map(([label, value]) => `<div class="report-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");
}

function drawChart(logs) {
  const ctx = trendChart.getContext("2d");
  const width = trendChart.width;
  const height = trendChart.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, width, height);

  const chartLogs = [...logs].filter((log) => hasBloodPressure(log) || log.weight).sort((a, b) => logSortValue(a).localeCompare(logSortValue(b))).slice(-30);
  if (!chartLogs.length) {
    ctx.fillStyle = "#647067";
    ctx.font = "22px Arial";
    ctx.fillText("Save a reading to start the chart", 38, 80);
    return;
  }

  const pad = { left: 58, right: 30, top: 28, bottom: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const bpLogs = chartLogs.filter(hasBloodPressure);
  const bpValues = bpLogs.flatMap((log) => [Number(log.systolic), Number(log.diastolic)]);
  const minY = bpValues.length ? Math.min(50, Math.floor(Math.min(...bpValues) / 10) * 10) : 50;
  const maxY = bpValues.length ? Math.max(190, Math.ceil(Math.max(...bpValues) / 10) * 10) : 190;

  drawGrid(ctx, width, height, pad, minY, maxY);
  drawSeries(ctx, chartLogs, "systolic", "#bd3c37", pad, plotW, plotH, minY, maxY);
  drawSeries(ctx, chartLogs, "diastolic", "#2f6f96", pad, plotW, plotH, minY, maxY);
  drawWeightSeries(ctx, chartLogs, pad, plotW, plotH);
  drawLabels(ctx, chartLogs, pad, plotW, height);
}

function drawGrid(ctx, width, height, pad, minY, maxY) {
  ctx.strokeStyle = "#dfe7dc";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#647067";
  ctx.font = "14px Arial";

  for (let value = minY; value <= maxY; value += 20) {
    const y = pad.top + ((maxY - value) / (maxY - minY)) * (height - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(value, 12, y + 5);
  }
}

function pointFor(index, total, value, pad, plotW, plotH, minY, maxY) {
  const x = pad.left + (total === 1 ? plotW / 2 : (index / (total - 1)) * plotW);
  const y = pad.top + ((maxY - value) / (maxY - minY)) * plotH;
  return { x, y };
}

function drawSeries(ctx, logs, field, color, pad, plotW, plotH, minY, maxY) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  let hasPoint = false;

  logs.forEach((log, index) => {
    if (!hasBloodPressure(log)) return;
    const point = pointFor(index, logs.length, Number(log[field]), pad, plotW, plotH, minY, maxY);
    if (!hasPoint) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
    hasPoint = true;
  });
  ctx.stroke();

  logs.forEach((log, index) => {
    if (!hasBloodPressure(log)) return;
    const point = pointFor(index, logs.length, Number(log[field]), pad, plotW, plotH, minY, maxY);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawWeightSeries(ctx, logs, pad, plotW, plotH) {
  const weighted = logs.filter((log) => log.weight);
  if (weighted.length < 2) return;

  const weights = weighted.map((log) => log.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(max - min, 1);
  ctx.strokeStyle = "#2f7d4f";
  ctx.fillStyle = "#2f7d4f";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();

  logs.forEach((log, index) => {
    if (!log.weight) return;
    const x = pad.left + (logs.length === 1 ? plotW / 2 : (index / (logs.length - 1)) * plotW);
    const y = pad.top + ((max - log.weight) / range) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLabels(ctx, logs, pad, plotW, height) {
  ctx.fillStyle = "#647067";
  ctx.font = "13px Arial";
  logs.forEach((log, index) => {
    if (index % Math.ceil(logs.length / 6) !== 0 && index !== logs.length - 1) return;
    const x = pad.left + (logs.length === 1 ? plotW / 2 : (index / (logs.length - 1)) * plotW);
    ctx.fillText(formatDate(log.date), x - 25, height - 16);
  });
}

async function runWholeLogAnalysis() {
  const logs = loadLogs();
  if (!logs.length) {
    deepAnalysis.innerHTML = `<span class="analysis-pill">No logs yet</span>`;
    return;
  }

  deepAnalysis.innerHTML = `<span class="analysis-pill">Analyzing logs...</span>`;
  try {
    const response = await appFetch(AI_LOGS_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "AI analysis failed");
    }
    const result = await response.json();
    const items = [
      result.summary,
      ...(result.patterns || []),
      ...(result.recommendations || []),
      ...(result.questionsForDoctor || []).map((item) => `Ask doctor: ${item}`),
      ...(result.safetyNotes || []).map((item) => `Safety: ${item}`),
    ].filter(Boolean);
    deepAnalysis.innerHTML = items.map((item) => `<span class="analysis-pill">${escapeHtml(item)}</span>`).join("");
    return;
  } catch (error) {
    deepAnalysis.innerHTML = `<span class="analysis-pill">Gemini unavailable, using local analysis</span>`;
  }

  const sorted = [...logs].sort((a, b) => logSortValue(b).localeCompare(logSortValue(a)));
  const latest = sorted[0];
  const recent = sorted.slice(0, 7);
  const recentBp = recent.filter(hasBloodPressure);
  const avgSys = recentBp.length ? Math.round(average(recentBp.map((log) => Number(log.systolic)))) : null;
  const avgDia = recentBp.length ? Math.round(average(recentBp.map((log) => Number(log.diastolic)))) : null;
  const highCount = recentBp.filter((log) => ["stage1", "stage2", "crisis"].includes(getBloodPressureCategory(log).key)).length;
  const medCount = recent.filter((log) => log.atenolol && log.adco).length;
  const exerciseAvg = Math.round(average(recent.map((log) => log.exerciseMinutes || 0)));
  const cautionDays = recent.filter((log) => foodScore(log.food || "").caution.length).length;
  const potassiumAvg = Math.round(average(recent.map((log) => Number(log.potassium) || 0)));
  const magnesiumAvg = Math.round(average(recent.map((log) => Number(log.magnesium) || 0)));
  const suggestions = [];

  suggestions.push(recentBp.length ? `Recent BP average: ${avgSys}/${avgDia}` : "No recent BP readings logged");
  suggestions.push(`${highCount}/${recentBp.length} recent BP readings were high`);
  suggestions.push(`Medicine logged: ${medCount}/${recent.length}`);
  suggestions.push(`Exercise average: ${exerciseAvg} min/day`);
  suggestions.push(`Potassium average: ${potassiumAvg}mg`);
  suggestions.push(`Magnesium average: ${magnesiumAvg}mg`);

  if (getBloodPressureCategory(latest)?.key === "stage2") {
    suggestions.push("Priority: repeat high readings after rest and contact your clinician if they stay high");
  }
  if (medCount < recent.length) suggestions.push("Priority: tighten medicine logging consistency");
  if (exerciseAvg < 20) suggestions.push("Priority: add cycling, resistance, isometric, or yoga work today");
  if (cautionDays) suggestions.push("Priority: reduce starch, sugar, sweet drinks, and processed high-salt foods");
  if (potassiumAvg < 3500) suggestions.push("Priority: use potassium-rich foods if safe for you");
  if (magnesiumAvg < 400) suggestions.push("Priority: review magnesium intake and supplement safety with your clinician");

  deepAnalysis.innerHTML = suggestions.map((item) => `<span class="analysis-pill">${escapeHtml(item)}</span>`).join("");
}

function renderPhotoPreview(file) {
  if (!file) {
    foodPhotoPreview.textContent = "No photo selected";
    photoAnalysisStatus.textContent = "Upload a food photo, then confirm the foods the AI identifies before saving.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    foodPhotoPreview.innerHTML = `<img src="${reader.result}" alt="Selected food preview" />`;
    photoAnalysisStatus.textContent = "Photo loaded. Analyze it when an AI vision backend is connected, or type/confirm foods manually.";
    photoAiBadge.textContent = "Photo ready";
  });
  reader.readAsDataURL(file);
}

async function analyzeFoodPhoto() {
  const file = foodPhotoInput.files[0];
  if (!file) {
    photoAnalysisStatus.textContent = "Choose a food photo first.";
    return;
  }

  if (!AI_FOOD_BACKEND_URL) {
    const fallbackFoods = getFoodCandidatesFromText();
    renderIdentifiedFoods(fallbackFoods);
    photoAnalysisStatus.textContent =
      "AI vision is not connected yet. The confirmation flow is ready: once a backend is added, this button will send the photo, receive identified foods, and ask you to confirm them.";
    photoAiBadge.textContent = "Backend needed";
    return;
  }

  photoAnalysisStatus.textContent = "Sending photo for AI analysis...";
  photoAiBadge.textContent = "Analyzing";
  try {
    const imageDataUrl = await readFileAsDataUrl(file);
    const response = await appFetch(AI_FOOD_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "AI analysis failed");
    }

    const result = await response.json();
    const foods = Array.isArray(result.foods) ? result.foods : [];
    renderIdentifiedFoods(foods.map((item) => item.name || item).filter(Boolean));
    photoAnalysisStatus.textContent = foods.length
      ? "AI identified foods. Confirm the list before saving."
      : "AI did not identify foods clearly. Type the foods manually.";
    photoAiBadge.textContent = "Review";
  } catch (error) {
    photoAnalysisStatus.textContent = `AI backend is not ready: ${error.message}`;
    photoAiBadge.textContent = "Backend error";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Could not read image file")));
    reader.readAsDataURL(file);
  });
}

function getFoodCandidatesFromText() {
  const typed = [document.querySelector("#food").value, confirmedFoodsInput.value].join(", ").toLowerCase();
  const found = foodDatabase.filter((item) => typed.includes(item.key)).map((item) => item.label);
  if (found.length) return [...new Set(found)];
  return ["Avocado", "Eggs", "Spinach", "Chicken", "Salad"];
}

function renderIdentifiedFoods(foods) {
  identifiedFoods.innerHTML = foods
    .map((food) => `<button class="selected" type="button" data-food="${escapeHtml(food.toLowerCase())}">${escapeHtml(food)}</button>`)
    .join("");
}

function useIdentifiedFoods() {
  const selected = [...identifiedFoods.querySelectorAll("button.selected")].map((button) => button.dataset.food);
  const manual = confirmedFoodsInput.value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const foods = [...new Set([...manual, ...selected])];
  confirmedFoodsInput.value = foods.join(", ");
  if (!foods.length) {
    photoAnalysisStatus.textContent = "No confirmed foods yet. Type foods manually or select identified items first.";
    return;
  }
  const foodInput = document.querySelector("#food");
  const existing = foodInput.value.trim();
  foodInput.value = existing ? `${existing}, ${foods.join(", ")}` : foods.join(", ");
  photoAnalysisStatus.textContent = "Confirmed foods added to the food log. Review the text before saving.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const logs = loadLogs();
  const dailySummary = buildDailySummary(logs, isoToday);
  const latestBp = latestBloodPressureLog(logs);
  updateInsights(dailySummary, logs, latestBp);
  renderHistory(logs);
  renderActivityHistory(logs);
  renderReports(logs);
  drawChart(logs);
}

function loadReminders() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMINDERS_KEY)) || {};
    morningReminder.value = saved.morning || "07:00";
    eveningReminder.value = saved.evening || "19:00";
    medicineReminder.value = saved.medicine || "08:00";
    reminderStatus.textContent = "Reminders loaded. Keep the app open for alerts.";
  } catch {
    reminderStatus.textContent = "Could not load reminders.";
  }
}

function saveReminders() {
  localStorage.setItem(
    REMINDERS_KEY,
    JSON.stringify({
      morning: morningReminder.value,
      evening: eveningReminder.value,
      medicine: medicineReminder.value,
    })
  );
  reminderStatus.textContent = "Reminders saved. Keep the app open for alerts.";
}

function checkReminders() {
  const now = getSastNowParts();
  if (lastReminderMinute === now.time) return;
  const reminders = [
    ["Morning BP", morningReminder.value],
    ["Evening BP", eveningReminder.value],
    ["Medication", medicineReminder.value],
  ];
  const due = reminders.find(([, time]) => time === now.time);
  if (!due) return;
  lastReminderMinute = now.time;
  const message = `${due[0]} reminder (${now.time} SAST)`;
  reminderStatus.textContent = message;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Blood Pressure Tracker", { body: message });
  }
}

function getChatHistory() {
  return [...chatMessages.querySelectorAll(".chat-message")]
    .slice(-10)
    .map((message) => ({
      role: message.classList.contains("user") ? "user" : "assistant",
      text: message.innerText,
    }));
}

function addChatMessage(role, text) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.innerHTML = `<strong>${role === "user" ? "You" : "AI Coach"}</strong><p>${escapeHtml(text)}</p>`;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;

  addChatMessage("user", cleanQuestion);
  chatQuestion.value = "";
  chatStatusBadge.textContent = "Thinking";

  try {
    const response = await appFetch(AI_CHAT_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: cleanQuestion,
        history: getChatHistory(),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "AI chat failed.");
    }
    const result = await response.json();
    addChatMessage("assistant", result.answer || "I could not answer that right now.");
    chatStatusBadge.textContent = "Gemini";
  } catch (error) {
    addChatMessage("assistant", `I could not reach the AI backend right now. ${error.message}`);
    chatStatusBadge.textContent = "Error";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const log = getFormData();
    await saveLog(log);
    render();
    resetFormForNewLog();
  } catch (error) {
    alert(error.message);
  }
});

async function handleLogTableClick(event) {
  const editButton = event.target.closest(".edit-btn");
  if (editButton) {
    const log = loadLogs().find((entry) => entry.id === editButton.dataset.id);
    if (log) loadLogIntoForm(log);
    return;
  }

  const button = event.target.closest(".delete-btn");
  if (!button) return;
  try {
    await deleteLog(button.dataset.id);
    render();
  } catch (error) {
    alert(error.message);
  }
}

historyBody.addEventListener("click", handleLogTableClick);
activityBody.addEventListener("click", handleLogTableClick);

resetTodayBtn.addEventListener("click", () => {
  resetFormForNewLog();
});

cancelEditBtn.addEventListener("click", resetFormForNewLog);

addPortionBtn.addEventListener("click", addPortion);

portionList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  portionEntries.splice(Number(button.dataset.index), 1);
  renderPortions();
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadLogs(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `blood-pressure-logs-${isoToday}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

databaseBackupBtn.addEventListener("click", () => {
  if (!sessionReady) {
    showLogin();
    return;
  }
  window.location.href = "/api/database-backup";
});

importJsonInput.addEventListener("change", async () => {
  const file = importJsonInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const logs = JSON.parse(text);
    if (!Array.isArray(logs)) throw new Error("Import file must contain an array of logs.");
    await replaceLogs(logs);
    render();
    importJsonInput.value = "";
  } catch (error) {
    alert(error.message);
  }
});

analyzeAllBtn.addEventListener("click", runWholeLogAnalysis);

saveRemindersBtn.addEventListener("click", saveReminders);

requestNotificationsBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    reminderStatus.textContent = "Browser notifications are not available here.";
    return;
  }
  const permission = await Notification.requestPermission();
  reminderBadge.textContent = permission === "granted" ? "On" : "Off";
  reminderStatus.textContent = permission === "granted" ? "Notifications enabled." : "Notifications were not enabled.";
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendChatQuestion(chatQuestion.value);
});

quickQuestions.forEach((button) => {
  button.addEventListener("click", () => {
    chatQuestion.value = button.textContent.trim();
    switchToTab("chatTab");
    chatQuestion.focus();
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Signing in...";
  try {
    await login();
    loginStatus.textContent = "Signed in.";
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await logout();
});

foodPhotoInput.addEventListener("change", () => {
  renderPhotoPreview(foodPhotoInput.files[0]);
});

analyzePhotoBtn.addEventListener("click", analyzeFoodPhoto);
useIdentifiedFoodsBtn.addEventListener("click", useIdentifiedFoods);

identifiedFoods.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  button.classList.toggle("selected");
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button === moreNavBtn) {
      const isOpen = overflowNav.classList.toggle("hidden") === false;
      moreNavBtn.setAttribute("aria-expanded", String(isOpen));
      return;
    }
    if (button.dataset.tab) switchToTab(button.dataset.tab);
  });
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".tabbar")) return;
  overflowNav.classList.add("hidden");
  moreNavBtn.setAttribute("aria-expanded", "false");
});

populateFoodOptions();
renderPortions();
loadReminders();
setInterval(checkReminders, 30000);

checkSession()
  .then((session) => {
    if (!session.authenticated) {
      render();
      return null;
    }
    return refreshLogs().then(render);
  })
  .catch((error) => {
    console.error(error);
    showLogin();
    render();
  });
