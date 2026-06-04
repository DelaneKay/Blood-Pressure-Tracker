const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 5178);
const HOST = process.env.HOST || "127.0.0.1";
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "health_tracker.db");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const APP_USERNAME = process.env.APP_USERNAME || "admin";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const sessions = new Map();

if (IS_PRODUCTION && (!APP_PASSWORD || !SESSION_SECRET)) {
  throw new Error("Production requires APP_PASSWORD and SESSION_SECRET environment variables.");
}

const db = USE_SUPABASE ? null : initDatabase();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && request.url === "/api/session") {
      sendJson(response, 200, { authenticated: isAuthenticated(request), authRequired: isAuthRequired() });
      return;
    }

    if (request.method === "POST" && request.url === "/api/login") {
      await handleLogin(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/logout") {
      handleLogout(request, response);
      return;
    }

    if (request.url?.startsWith("/api/") && !isAuthenticated(request)) {
      sendJson(response, 401, { message: "Login required." });
      return;
    }

    if (request.url?.startsWith("/api/logs")) {
      await handleLogsApi(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/analyze-logs") {
      await handleLogsAnalysis(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/chat") {
      await handleChat(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/analyze-food-photo") {
      await handleFoodPhotoAnalysis(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/database-backup") {
      serveDatabaseBackup(response);
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { message: "Method not allowed" });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { message: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Blood Pressure Health Tracker running at http://${HOST}:${PORT}`);
});

function initDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  database.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return database;
}

async function listLogs() {
  if (USE_SUPABASE) {
    const rows = await supabaseRequest("/rest/v1/logs?select=payload&order=timestamp_sast.desc,updated_at.desc");
    return rows.map((row) => row.payload).filter((log) => log?.id);
  }

  const rows = db.prepare("SELECT payload FROM logs ORDER BY json_extract(payload, '$.timestampSast') DESC, updated_at DESC").all();
  return rows.map((row) => safeJson(row.payload)).filter((log) => log.id);
}

async function upsertLog(log) {
  if (USE_SUPABASE) {
    await supabaseRequest("/rest/v1/logs?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([
        {
          id: log.id,
          timestamp_sast: log.timestampSast || null,
          payload: log,
        },
      ]),
    });
    return;
  }

  db.prepare(
    `
    INSERT INTO logs (id, payload, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
  `
  ).run(log.id, JSON.stringify(log));
}

async function replaceAllLogs(logs) {
  if (USE_SUPABASE) {
    await clearAllLogs();
    if (!logs.length) return;
    await supabaseRequest("/rest/v1/logs?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(
        logs
          .filter((log) => log.id)
          .map((log) => ({
            id: log.id,
            timestamp_sast: log.timestampSast || null,
            payload: log,
          }))
      ),
    });
    return;
  }

  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM logs");
    const statement = db.prepare("INSERT INTO logs (id, payload) VALUES (?, ?)");
    logs.forEach((log) => {
      if (log.id) statement.run(log.id, JSON.stringify(log));
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function deleteLogById(id) {
  if (USE_SUPABASE) {
    await supabaseRequest(`/rest/v1/logs?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  db.prepare("DELETE FROM logs WHERE id = ?").run(id);
}

async function clearAllLogs() {
  if (USE_SUPABASE) {
    await supabaseRequest("/rest/v1/logs?id=not.is.null", { method: "DELETE" });
    return;
  }
  db.exec("DELETE FROM logs");
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${text.slice(0, 240)}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? safeJson(text) : null;
}

async function handleLogin(request, response) {
  if (!isAuthRequired()) {
    sendJson(response, 200, { ok: true });
    return;
  }

  const body = await readJsonBody(request);
  const username = String(body.username || "");
  const password = String(body.password || "");
  if (username !== APP_USERNAME || password !== APP_PASSWORD) {
    sendJson(response, 401, { message: "Invalid username or password." });
    return;
  }

  const sessionId = crypto.randomBytes(32).toString("hex");
  const signature = signSession(sessionId);
  sessions.set(sessionId, { username, createdAt: Date.now() });
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": buildSessionCookie(`${sessionId}.${signature}`),
  });
  response.end(JSON.stringify({ ok: true }));
}

function handleLogout(request, response) {
  const session = getSessionCookie(request);
  if (session?.id) sessions.delete(session.id);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": buildSessionCookie("", true),
  });
  response.end(JSON.stringify({ ok: true }));
}

function isAuthRequired() {
  return Boolean(APP_PASSWORD);
}

function isAuthenticated(request) {
  if (!isAuthRequired()) return true;
  const session = getSessionCookie(request);
  if (!session) return false;
  if (signSession(session.id) !== session.signature) return false;
  return sessions.has(session.id);
}

function getSessionCookie(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  const value = cookies.bp_session;
  if (!value || !value.includes(".")) return null;
  const [id, signature] = value.split(".");
  return { id, signature };
}

function signSession(sessionId) {
  return crypto.createHmac("sha256", SESSION_SECRET || "local-dev-session-secret").update(sessionId).digest("hex");
}

function buildSessionCookie(value, clear = false) {
  const parts = [
    `bp_session=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    clear ? "Max-Age=0" : "Max-Age=604800",
  ];
  if (IS_PRODUCTION) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    cookies[key] = value;
    return cookies;
  }, {});
}

async function handleLogsApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/logs") {
    sendJson(response, 200, await listLogs());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logs") {
    const log = await readJsonBody(request);
    if (!log.id) {
      sendJson(response, 400, { message: "Log id is required." });
      return;
    }
    await upsertLog(log);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/logs") {
    const logs = await readJsonBody(request);
    if (!Array.isArray(logs)) {
      sendJson(response, 400, { message: "Expected an array of logs." });
      return;
    }
    await replaceAllLogs(logs);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/logs") {
    await clearAllLogs();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/logs/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/logs/", ""));
    await deleteLogById(id);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { message: "Logs API route not found." });
}

async function handleFoodPhotoAnalysis(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("paste_your_new_key_here")) {
    sendJson(response, 400, {
      message: "Gemini API key is not configured. Add a new private key to .env first.",
    });
    return;
  }

  const body = await readJsonBody(request);
  const image = parseDataUrl(body.imageDataUrl);
  if (!image) {
    sendJson(response, 400, { message: "Missing or invalid image data." });
    return;
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Identify the foods in this meal photo. Return strict JSON only with this shape: " +
                  '{"foods":[{"name":"food name","confidence":"low|medium|high","portion":"rough portion if visible"}],"notes":"short note"} ' +
                  "Use common food names. Do not give medical advice.",
              },
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const text = await geminiResponse.text();
    sendJson(response, 502, { message: `Gemini request failed: ${text.slice(0, 240)}` });
    return;
  }

  const payload = await geminiResponse.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = safeJson(text);
  sendJson(response, 200, {
    foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    notes: parsed.notes || "",
  });
}

async function handleLogsAnalysis(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("paste_your_new_key_here")) {
    sendJson(response, 400, {
      message: "Gemini API key is not configured. Add a new private key to .env first.",
    });
    return;
  }

  const body = await readJsonBody(request);
  const logs = Array.isArray(body.logs) ? body.logs.slice(0, 90) : [];
  if (!logs.length) {
    sendJson(response, 400, { message: "No logs available for AI analysis." });
    return;
  }

  const prompt = [
    "You are analyzing a personal blood-pressure tracking log for a user who is already on prescribed medication.",
    "Return strict JSON only with this shape:",
    '{"summary":"short summary","patterns":["pattern"],"recommendations":["recommendation"],"questionsForDoctor":["question"],"safetyNotes":["note"]}',
    "Be conservative. Do not diagnose. Do not tell the user to stop or change medication. Mention emergency care for crisis-range readings with severe symptoms.",
    "Use the logs below:",
    JSON.stringify(logs),
  ].join("\n");

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const text = await geminiResponse.text();
    sendJson(response, 502, { message: `Gemini request failed: ${text.slice(0, 240)}` });
    return;
  }

  const payload = await geminiResponse.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  sendJson(response, 200, safeJson(text));
}

async function handleChat(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("paste_your_new_key_here")) {
    sendJson(response, 400, {
      message: "Gemini API key is not configured. Add a new private key to .env first.",
    });
    return;
  }

  const body = await readJsonBody(request);
  const question = String(body.question || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  if (!question) {
    sendJson(response, 400, { message: "Question is required." });
    return;
  }

  const logs = (await listLogs()).slice(0, 90);
  const prompt = [
    "You are the AI coach inside a private blood-pressure and low-carb tracking app.",
    "You may use the user's logs, targets, food notes, and the low-carb/BP concepts below.",
    "You can discuss ideas commonly associated with Dr Eric Berg DC such as low carb eating, potassium-rich greens, magnesium, vitamin D, stress reduction, slow breathing, sleep, and exercise, but do not claim to be Dr Berg and do not present his content as medical authority.",
    "Be conservative and practical. Do not diagnose. Do not tell the user to stop, start, or change prescribed medication. Encourage clinician review for medication, supplements, kidney disease concerns, persistent high readings, or crisis-range readings.",
    "Emergency safety: for readings above 180 systolic or above 120 diastolic with severe symptoms such as chest pain, shortness of breath, weakness, confusion, vision changes, or severe headache, advise emergency care.",
    "User targets and notes: potassium 4700mg/day from food when safe, magnesium target 800mg from user's notes, low carb, low glycemic index under 55, glycemic load under 10, carb-to-fiber ratio under 7, slow breathing around 6 breaths/minute, cycling instead of running, resistance training, isometrics, yoga, sleep, stress management, avocado, spinach, swiss chard, beet tops, celery, hibiscus tea, garlic, fish/cod liver oil, beetroot, cacao.",
    "Answer in a warm, concise way. If the user asks about their logs, cite specific patterns from the logs. If data is missing, say what to log next.",
    "Recent chat history:",
    JSON.stringify(history),
    "Saved logs:",
    JSON.stringify(logs),
    "User question:",
    question,
  ].join("\n");

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
        },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const text = await geminiResponse.text();
    sendJson(response, 502, { message: `Gemini request failed: ${text.slice(0, 240)}` });
    return;
  }

  const payload = await geminiResponse.json();
  const answer = payload.candidates?.[0]?.content?.parts?.[0]?.text || "I could not generate a response right now.";
  sendJson(response, 200, { answer });
}

function serveDatabaseBackup(response) {
  if (USE_SUPABASE) {
    listLogs()
      .then((logs) => {
        const stamp = new Date().toISOString().slice(0, 10);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="health_tracker_${stamp}.json"`,
        });
        response.end(JSON.stringify(logs, null, 2));
      })
      .catch((error) => sendJson(response, 500, { message: error.message }));
    return;
  }

  fs.readFile(DB_PATH, (error, data) => {
    if (error) {
      sendJson(response, 404, { message: "Database file not found." });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="health_tracker_${stamp}.db"`,
    });
    response.end(data);
  });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(response, 403, { message: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(data);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        reject(new Error("Request is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}
