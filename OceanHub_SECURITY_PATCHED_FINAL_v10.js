var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// OceanHub_SECURITY_PATCHED_FINAL_v10.js
var RATE_LIMIT_MAX = 30;
var RATE_LIMIT_WINDOW = 3600;
var VALID_CACHE_TTL = 3600;
var NONCE_TTL = 120;
var PIN_BRUTE_LIMIT = 5;
var PIN_BRUTE_WINDOW = 600;
var BLACKLIST_WINDOW = 300;
var BLACKLIST_THRESHOLD = 10;
var BLACKLIST_BAN_TIME = 3600;
var SESSION_TTL = 604800;
var LOGIN_RATE_LIMIT = 5;
var LOGIN_RATE_WINDOW = 600;
var REGISTER_RATE_LIMIT = 5;
var REGISTER_RATE_WINDOW = 600;
var FORGOT_RATE_LIMIT = 5;
var FORGOT_RATE_WINDOW = 600;
var TOTP_RATE_LIMIT = 5;
var TOTP_RATE_WINDOW = 600;
var RESET_TOKEN_TTL = 1800;
function getPayPalMode(env) {
  return String(env?.PAYPAL_MODE || "live").toLowerCase() === "sandbox" ? "sandbox" : "live";
}
__name(getPayPalMode, "getPayPalMode");
function getPayPalApiUrl(env) {
  return getPayPalMode(env) === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
__name(getPayPalApiUrl, "getPayPalApiUrl");
function getBaseUrl(env) {
  const raw = env?.BASE_URL;
  if (!raw) throw new Error("BASE_URL no configurada");
  return raw.replace(/\/+$/, "");
}
__name(getBaseUrl, "getBaseUrl");
function getSenderEmail(env) {
  if (!env?.SENDER_EMAIL) throw new Error("SENDER_EMAIL no configurado");
  return env.SENDER_EMAIL;
}
__name(getSenderEmail, "getSenderEmail");
function getSenderName(env) {
  return env?.SENDER_NAME || "Ocean Hub";
}
__name(getSenderName, "getSenderName");
var PRODUCTS = {
  "price_aprendiz": { name: "\u{1F420} DLC Aprendiz", price: 5, description: "Acceso b\xE1sico por 7 d\xEDas", days: 7 },
  "price_tiburon": { name: "\u{1F988} DLC Tibur\xF3n", price: 15, description: "Premium por 30 d\xEDas", days: 30 },
  "price_rey": { name: "\u{1F451} DLC Rey del Oc\xE9ano", price: 30, description: "Acceso permanente VIP", days: 365 }
};
var SUSCRIPCION_PLANES = {
  "aprendiz": { name: "\u{1F420} Aprendiz", price: 4.99, days: 45, description: "Acceso b\xE1sico por 45 d\xEDas" },
  "tiburon": { name: "\u{1F988} Tibur\xF3n", price: 9.99, days: 100, description: "Premium por 100 d\xEDas" },
  "rey_oceano": { name: "\u{1F451} Rey del Oc\xE9ano", price: 14.99, days: 365, description: "Acceso permanente VIP" }
};
var PACKS = {
  "pack5": { name: "Pack 5 claves", price: 20, quantity: 5 },
  "pack10": { name: "Pack 10 claves", price: 35, quantity: 10 },
  "pack25": { name: "Pack 25 claves", price: 75, quantity: 25 }
};
var EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  MXN: 17.5,
  ARS: 850,
  COP: 3900,
  BRL: 5
};
var TRANSLATIONS = {
  es: {
    welcome: "Bienvenido a Ocean Hub",
    login: "Iniciar sesi\xF3n",
    register: "Registrarse",
    logout: "Cerrar sesi\xF3n",
    profile: "Perfil",
    home: "Inicio",
    shop: "Tienda",
    sell: "Vender",
    dlc: "DLCs",
    verify: "Verificar clave",
    claim: "Canjear c\xF3digo",
    subscribe: "Suscripci\xF3n",
    admin: "Administraci\xF3n",
    email: "Email",
    password: "Contrase\xF1a",
    name: "Nombre",
    confirm: "Confirmar",
    cancel: "Cancelar",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    view: "Ver",
    loading: "Cargando...",
    error: "Error",
    success: "\xC9xito"
  },
  en: {
    welcome: "Welcome to Ocean Hub",
    login: "Login",
    register: "Register",
    logout: "Logout",
    profile: "Profile",
    home: "Home",
    shop: "Shop",
    sell: "Sell",
    dlc: "DLCs",
    verify: "Verify key",
    claim: "Redeem code",
    subscribe: "Subscription",
    admin: "Admin",
    email: "Email",
    password: "Password",
    name: "Name",
    confirm: "Confirm",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    view: "View",
    loading: "Loading...",
    error: "Error",
    success: "Success"
  }
};
function getTranslation(env, lang, key, fallback = key) {
  const langMap = TRANSLATIONS[lang] || TRANSLATIONS["en"];
  return langMap[key] || fallback;
}
__name(getTranslation, "getTranslation");
async function hashKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashKey, "hashKey");
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || "unknown";
}
__name(getClientIP, "getClientIP");
async function sendDiscordWebhook(env, message, embed = null) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  const payload = { content: message, embeds: embed ? [embed] : [] };
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Discord webhook error:", e);
  }
}
__name(sendDiscordWebhook, "sendDiscordWebhook");
async function sendTelegramMessage(env, message) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (e) {
    console.error("Telegram error:", e);
  }
}
__name(sendTelegramMessage, "sendTelegramMessage");
function maskAlertValue(value) {
  const s = String(value ?? "");
  if (!s) return "";
  if (s.includes("@")) {
    const [local, domain] = s.split("@");
    return `${(local || "").slice(0, 2)}***@${domain || ""}`;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) {
    const parts = s.split(".");
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  if (s.includes(":")) return `${s.slice(0, 4)}***`;
  return s.length <= 6 ? "***" : `${s.slice(0, 3)}***${s.slice(-3)}`;
}
__name(maskAlertValue, "maskAlertValue");
async function sendAlert(env, message, severity = "info", key = null, ip = null) {
  let safeMessage = String(message ?? "");
  if (key) safeMessage = safeMessage.split(String(key)).join(maskAlertValue(key));
  if (ip) safeMessage = safeMessage.split(String(ip)).join(maskAlertValue(ip));
  const fullMsg = `\u{1F6A8} [${severity.toUpperCase()}] ${safeMessage}${key ? ` | Clave: ${maskAlertValue(key)}` : ""}${ip ? ` | IP: ${maskAlertValue(ip)}` : ""}`;
  await sendDiscordWebhook(env, fullMsg);
  await sendTelegramMessage(env, fullMsg);
}
__name(sendAlert, "sendAlert");
async function logAdminAction(env, action, key, ip, details = {}) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const logKey = `admin_log_${today}_${Date.now()}_${generateRandomHex(4)}`;
  const entry = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), action, key, ip, details };
  await env.STATS.put(logKey, JSON.stringify(entry), { expirationTtl: 2592e3 });
  let dayIndex = await env.STATS.get(`admin_log_index_${today}`, "json") || [];
  dayIndex.push(logKey);
  if (dayIndex.length > 500) dayIndex = dayIndex.slice(-500);
  await env.STATS.put(`admin_log_index_${today}`, JSON.stringify(dayIndex), { expirationTtl: 2592e3 });
  await sendAlert(env, `\u{1F510} Acci\xF3n admin: **${action}** sobre \`${key}\` desde IP ${ip}`, "admin", key, ip);
}
__name(logAdminAction, "logAdminAction");
function generateRandomHex(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateRandomHex, "generateRandomHex");
async function getValidHMACSecrets(env) {
  const current = env.HMAC_SECRET_CURRENT;
  const previous = env.HMAC_SECRET_PREVIOUS || "";
  const secrets = current ? [current] : [];
  if (previous && previous.length > 10) secrets.push(previous);
  return secrets;
}
__name(getValidHMACSecrets, "getValidHMACSecrets");
function bytesToBase32(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += alphabet[parseInt(chunk, 2)];
  }
  return out;
}
__name(bytesToBase32, "bytesToBase32");
function generateTOTPSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return bytesToBase32(bytes);
}
__name(generateTOTPSecret, "generateTOTPSecret");
function buildOTPAuthURI(secret, email, issuer = "Ocean Hub") {
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
__name(buildOTPAuthURI, "buildOTPAuthURI");
async function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const cleaned = base32.replace(/=+$/, "").toUpperCase();
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}
__name(base32ToBytes, "base32ToBytes");
async function verifyTOTP(env, secret, token, window = 1) {
  if (!token || token.length !== 6 || isNaN(token)) return false;
  try {
    const keyBytes = await base32ToBytes(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    const timeStep = 30;
    const now = Math.floor(Date.now() / 1e3);
    const currentCounter = Math.floor(now / timeStep);
    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setUint32(4, counter, false);
      const signature = await crypto.subtle.sign("HMAC", key, buffer);
      const hmac = new Uint8Array(signature);
      const offset = hmac[hmac.length - 1] & 15;
      const code = ((hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255) % 1e6;
      const codeStr = code.toString().padStart(6, "0");
      if (codeStr === token) return true;
    }
    return false;
  } catch (e) {
    console.error("TOTP error:", e);
    return false;
  }
}
__name(verifyTOTP, "verifyTOTP");
async function isIPBlacklisted(env, ip) {
  const blacklist = await env.STATS.get(`blacklist_${ip}`, "json");
  if (!blacklist) return false;
  const now = Math.floor(Date.now() / 1e3);
  if (now > blacklist.until) {
    await env.STATS.delete(`blacklist_${ip}`);
    return false;
  }
  return true;
}
__name(isIPBlacklisted, "isIPBlacklisted");
async function addIPToBlacklist(env, ip) {
  const until = Math.floor(Date.now() / 1e3) + BLACKLIST_BAN_TIME;
  await env.STATS.put(`blacklist_${ip}`, JSON.stringify({ until, reason: "too many failures" }), { expirationTtl: BLACKLIST_BAN_TIME });
  await sendAlert(env, `\u{1F6AB} IP ${ip} bloqueada por 1 hora (demasiados fallos)`, "security", null, ip);
}
__name(addIPToBlacklist, "addIPToBlacklist");
async function registerIPFailure(env, ip) {
  const key = `ip_failures_${ip}`;
  let data = await env.STATS.get(key, "json") || { count: 0, first: Math.floor(Date.now() / 1e3) };
  const now = Math.floor(Date.now() / 1e3);
  if (now - data.first > BLACKLIST_WINDOW) {
    data = { count: 1, first: now };
  } else {
    data.count++;
  }
  await env.STATS.put(key, JSON.stringify(data), { expirationTtl: BLACKLIST_WINDOW });
  if (data.count >= BLACKLIST_THRESHOLD) {
    await addIPToBlacklist(env, ip);
  }
}
__name(registerIPFailure, "registerIPFailure");
async function getAdminLogs(env, limit = 50, offset = 0) {
  const days = [];
  const today = /* @__PURE__ */ new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  let allLogs = [];
  for (const day of days) {
    const index = await env.STATS.get(`admin_log_index_${day}`, "json") || [];
    for (const key of index) {
      const raw = await env.STATS.get(key);
      if (raw) allLogs.push(JSON.parse(raw));
    }
    if (allLogs.length > 1e3) break;
  }
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const total = allLogs.length;
  const slice = allLogs.slice(offset, offset + limit);
  return { logs: slice, total };
}
__name(getAdminLogs, "getAdminLogs");
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, salt, storedHash) {
  const hash = await hashPassword(password, salt);
  return timingSafeCompare(hash, storedHash);
}
__name(verifyPassword, "verifyPassword");
async function getUserByEmail(env, email) {
  const userData = await env.STATS.get(`user_${email}`);
  if (!userData) return null;
  return JSON.parse(userData);
}
__name(getUserByEmail, "getUserByEmail");
async function createUser(env, email, name, password, referralCode = null) {
  email = String(email || "").trim().toLowerCase();
  name = String(name || "").trim().slice(0, 80);
  if (email.length > 254) throw new Error("Email demasiado largo");
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email)) {
    throw new Error("Email no v\xE1lido");
  }
  if (name.length > 80) throw new Error("Nombre demasiado largo");
  if (String(password || "").length < 8 || String(password).length > 128) throw new Error("La contrase\xF1a debe tener entre 8 y 128 caracteres");
  const existing = await getUserByEmail(env, email);
  if (existing) throw new Error("El email ya est\xE1 registrado");
  const salt = generateRandomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const userList = await env.STATS.get("user_list", "json") || [];
  let role = "user";
  const adminEmails = env.ADMIN_EMAILS ? JSON.parse(env.ADMIN_EMAILS) : [];
  role = "user";
  const ownReferralCode = generateRandomHex(8).toUpperCase();
  const user = {
    email,
    name: name || email.split("@")[0],
    passwordHash,
    salt,
    role,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    last_login: null,
    referral_code: ownReferralCode,
    referido_por: referralCode || null,
    points: 0,
    otp_secret: null,
    dark_mode: false,
    language: "es",
    sessionVersion: 0
  };
  await env.STATS.put(`user_${email}`, JSON.stringify(user));
  userList.push(email);
  await env.STATS.put("user_list", JSON.stringify(userList));
  if (referralCode) {
    const referidor = await getUserByReferralCode(env, referralCode);
    if (referidor) {
      const refEntry = {
        referidor_id: referidor.email,
        referido_id: email,
        fecha_registro: (/* @__PURE__ */ new Date()).toISOString(),
        comision_ganada: 0
      };
      const refList = await env.STATS.get("referidos_list", "json") || [];
      refList.push(refEntry);
      await env.STATS.put("referidos_list", JSON.stringify(refList));
      await sendAlert(env, `\u{1F517} Nuevo referido: ${email} fue referido por ${referidor.email}`, "referral");
    }
  }
  await sendEmail(env, email, "Bienvenido a Ocean Hub", `<h1>\u{1F30A} \xA1Bienvenido!</h1><p>Gracias por registrarte en Ocean Hub. Tu c\xF3digo de referido es: <strong>${ownReferralCode}</strong></p>`);
  return user;
}
__name(createUser, "createUser");
async function getUserByReferralCode(env, code) {
  const userList = await env.STATS.get("user_list", "json") || [];
  for (let email of userList) {
    const user = await getUserByEmail(env, email);
    if (user && user.referral_code === code) return user;
  }
  return null;
}
__name(getUserByReferralCode, "getUserByReferralCode");
async function authenticateUser(env, email, password) {
  const user = await getUserByEmail(env, email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.salt, user.passwordHash);
  if (!valid) return null;
  user.last_login = (/* @__PURE__ */ new Date()).toISOString();
  await env.STATS.put(`user_${email}`, JSON.stringify(user));
  await logUserAction(env, email, "login", { ip: "unknown", userAgent: "" });
  return user;
}
__name(authenticateUser, "authenticateUser");
async function createSession(env, user) {
  const sessionToken = generateRandomHex(32);
  const session = { email: user.email, role: user.role, sessionVersion: Number(user.sessionVersion || 0), created: Date.now() };
  await env.STATS.put(`session_${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return sessionToken;
}
__name(createSession, "createSession");
async function validateSession(env, token) {
  if (!token) return null;
  const data = await env.STATS.get(`session_${token}`);
  if (!data) return null;
  return JSON.parse(data);
}
__name(validateSession, "validateSession");
async function destroySession(env, token) {
  if (token) {
    await env.STATS.delete(`session_${token}`);
  }
}
__name(destroySession, "destroySession");
async function requireAuth(env, request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(/session_token=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const session = await validateSession(env, token);
  if (!session) return null;
  const user = await getUserByEmail(env, session.email);
  if (!user) return null;
  if (Number(session.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
    await destroySession(env, token);
    return null;
  }
  return { user, sessionToken: token };
}
__name(requireAuth, "requireAuth");
async function requireAdmin(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return null;
  if (auth.user.role !== "admin") return null;
  if (String(env.ADMIN_REQUIRE_2FA || "false").toLowerCase() === "true" && !auth.user.otp_secret) return null;
  return auth;
}
__name(requireAdmin, "requireAdmin");
async function getSuscripcionUsuario(env, email) {
  const data = await env.STATS.get(`suscripcion_${email}`, "json");
  return data || null;
}
__name(getSuscripcionUsuario, "getSuscripcionUsuario");
async function crearSuscripcion(env, email, plan, dias = null) {
  const planData = SUSCRIPCION_PLANES[plan];
  if (!planData) throw new Error("Plan no v\xE1lido");
  const days = dias || planData.days;
  const inicio = /* @__PURE__ */ new Date();
  const fin = /* @__PURE__ */ new Date();
  fin.setDate(fin.getDate() + days);
  const suscripcion = {
    email,
    plan,
    fecha_inicio: inicio.toISOString(),
    fecha_fin: fin.toISOString(),
    renovacion_automatica: true,
    activa: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await env.STATS.put(`suscripcion_${email}`, JSON.stringify(suscripcion));
  await sendAlert(env, `\u{1F4C5} Nueva suscripci\xF3n: ${email} -> ${plan} (${days} d\xEDas)`, "suscripcion");
  await sendEmail(env, email, "Suscripci\xF3n activada", `<h1>\u2705 Suscripci\xF3n activada</h1><p>Plan: ${planData.name}</p><p>Duraci\xF3n: ${days} d\xEDas</p><p>Fecha de fin: ${fin.toISOString()}</p>`);
  return suscripcion;
}
__name(crearSuscripcion, "crearSuscripcion");
async function renovarSuscripcion(env, email, dias = null) {
  const sus = await getSuscripcionUsuario(env, email);
  if (!sus) throw new Error("No hay suscripci\xF3n activa");
  const planData = SUSCRIPCION_PLANES[sus.plan];
  const days = dias || planData.days;
  const ahora = /* @__PURE__ */ new Date();
  const finActual = new Date(sus.fecha_fin);
  let nuevaFecha;
  if (finActual < ahora) {
    nuevaFecha = new Date(ahora);
  } else {
    nuevaFecha = new Date(finActual);
  }
  nuevaFecha.setDate(nuevaFecha.getDate() + days);
  sus.fecha_fin = nuevaFecha.toISOString();
  sus.activa = true;
  await env.STATS.put(`suscripcion_${email}`, JSON.stringify(sus));
  await sendAlert(env, `\u{1F504} Suscripci\xF3n renovada: ${email} +${days} d\xEDas (nueva fecha: ${nuevaFecha.toISOString()})`, "suscripcion");
  await sendEmail(env, email, "Suscripci\xF3n renovada", `<h1>\u{1F504} Suscripci\xF3n renovada</h1><p>Tu suscripci\xF3n ha sido renovada por ${days} d\xEDas.</p><p>Nueva fecha de fin: ${nuevaFecha.toISOString()}</p>`);
  return sus;
}
__name(renovarSuscripcion, "renovarSuscripcion");
async function cancelarRenovacionSuscripcion(env, email) {
  const sus = await getSuscripcionUsuario(env, email);
  if (!sus) throw new Error("No hay suscripci\xF3n activa");
  sus.renovacion_automatica = false;
  await env.STATS.put(`suscripcion_${email}`, JSON.stringify(sus));
  return sus;
}
__name(cancelarRenovacionSuscripcion, "cancelarRenovacionSuscripcion");
async function obtenerCodigoCanje(env, codigo) {
  const data = await env.STATS.get(`codigo_canje_${codigo}`, "json");
  return data || null;
}
__name(obtenerCodigoCanje, "obtenerCodigoCanje");
async function usarCodigoCanje(env, codigo, email) {
  const entry = await obtenerCodigoCanje(env, codigo);
  if (!entry) throw new Error("C\xF3digo no v\xE1lido");
  if (entry.usado) throw new Error("C\xF3digo ya utilizado");
  entry.usado = true;
  entry.fecha_uso = (/* @__PURE__ */ new Date()).toISOString();
  entry.usuario_uso = email;
  await env.STATS.put(`codigo_canje_${codigo}`, JSON.stringify(entry));
  await logUserAction(env, email, "canje", { codigo });
  return entry;
}
__name(usarCodigoCanje, "usarCodigoCanje");
async function getReferidosDe(env, email) {
  const list = await env.STATS.get("referidos_list", "json") || [];
  return list.filter((r) => r.referidor_id === email);
}
__name(getReferidosDe, "getReferidosDe");
async function getComisionesDe(env, email) {
  const list = await env.STATS.get("referidos_list", "json") || [];
  return list.filter((r) => r.referidor_id === email).reduce((sum, r) => sum + (r.comision_ganada || 0), 0);
}
__name(getComisionesDe, "getComisionesDe");
async function addComisionToReferidor(env, email, monto) {
  const refList = await env.STATS.get("referidos_list", "json") || [];
  let found = false;
  for (let r of refList) {
    if (r.referido_id === email) {
      r.comision_ganada = (r.comision_ganada || 0) + monto;
      found = true;
      break;
    }
  }
  if (found) {
    await env.STATS.put("referidos_list", JSON.stringify(refList));
  }
}
__name(addComisionToReferidor, "addComisionToReferidor");
async function getReseller(env, email) {
  const data = await env.STATS.get(`reseller_${email}`, "json");
  return data || null;
}
__name(getReseller, "getReseller");
async function setReseller(env, email, data) {
  await env.STATS.put(`reseller_${email}`, JSON.stringify(data));
}
__name(setReseller, "setReseller");
async function registrarMovimiento(env, email, tipo, cantidad, descripcion) {
  const id = `movimiento_${Date.now()}_${generateRandomHex(3)}`;
  const entry = { email, tipo, cantidad, descripcion, fecha: (/* @__PURE__ */ new Date()).toISOString() };
  await env.STATS.put(id, JSON.stringify(entry));
  let index = await env.STATS.get(`movimientos_${email}`, "json") || [];
  index.push(id);
  if (index.length > 500) index = index.slice(-500);
  await env.STATS.put(`movimientos_${email}`, JSON.stringify(index));
}
__name(registrarMovimiento, "registrarMovimiento");
async function getMovimientos(env, email, limit = 50, offset = 0) {
  const index = await env.STATS.get(`movimientos_${email}`, "json") || [];
  const total = index.length;
  const slice = index.slice(Math.max(0, total - offset - limit), total - offset);
  const movimientos = [];
  for (let id of slice) {
    const raw = await env.STATS.get(id);
    if (raw) movimientos.push(JSON.parse(raw));
  }
  return { movimientos, total };
}
__name(getMovimientos, "getMovimientos");
async function convertirMoneda(cantidadUSD, moneda) {
  const rate = EXCHANGE_RATES[moneda.toUpperCase()];
  if (!rate) return null;
  return cantidadUSD * rate;
}
__name(convertirMoneda, "convertirMoneda");
var STATIC_KEYS = [];
async function initStaticKeys(env) {
  if (STATIC_KEYS.length) return;
  let raw = [];
  try {
    raw = env.STATIC_KEYS_JSON ? JSON.parse(env.STATIC_KEYS_JSON) : [];
  } catch {
    throw new Error("STATIC_KEYS_JSON no es JSON v\xE1lido");
  }
  if (!Array.isArray(raw)) throw new Error("STATIC_KEYS_JSON debe ser un array");
  for (const k of raw) if (k?.key) STATIC_KEYS.push({ ...k, hash: await hashKey(k.key), dynamic: false });
}
__name(initStaticKeys, "initStaticKeys");
async function withKVLock(env, name, fn) {
  if (!env.KV_LOCKER) {
    throw new Error(`KV_LOCKER no configurado: se requiere Durable Object para ${name}`);
  }
  const id = env.KV_LOCKER.idFromName(name);
  const stub = env.KV_LOCKER.get(id);
  const lockToken = generateRandomHex(16);
  let acquire = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    acquire = await stub.fetch("https://kv-lock/acquire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: lockToken, ttl: 6e4 })
    });
    if (acquire.ok) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(100 + attempt * 50, 500)));
  }
  if (!acquire?.ok) throw new Error("No se pudo adquirir el bloqueo KV");
  try {
    return await fn();
  } finally {
    await stub.fetch("https://kv-lock/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: lockToken })
    }).catch(() => {
    });
  }
}
__name(withKVLock, "withKVLock");
var KVLocker = class {
  static {
    __name(this, "KVLocker");
  }
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/acquire" && request.method === "POST") {
      const { token, ttl = 6e4 } = await request.json();
      const current = await this.state.storage.get("lock");
      const now = Date.now();
      if (current && current.expires > now) return new Response("busy", { status: 409 });
      await this.state.storage.put("lock", { token, expires: now + Math.min(Math.max(ttl, 1e3), 12e4) });
      return new Response("ok");
    }
    if (url.pathname === "/release" && request.method === "POST") {
      const { token } = await request.json();
      const current = await this.state.storage.get("lock");
      if (current?.token === token) await this.state.storage.delete("lock");
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }
};
async function getStats(env) {
  try {
    let raw = await env.STATS.get("global_stats", "json");
    if (!raw) {
      const newStats = {
        total_verifications: 0,
        valid_verifications: 0,
        invalid_verifications: 0,
        keys_usage: {},
        last_verifications: [],
        hourly_usage: {},
        daily_usage: {},
        start_time: (/* @__PURE__ */ new Date()).toISOString(),
        sales: { total: 0, revenue: 0, last_sale: null, by_product: {} }
      };
      for (let k of STATIC_KEYS) {
        newStats.keys_usage[k.hash] = { count: 0, last_used: null, history: [], blocked: false };
      }
      await env.STATS.put("global_stats", JSON.stringify(newStats));
      return newStats;
    }
    for (let k of STATIC_KEYS) {
      if (!raw.keys_usage[k.hash]) {
        raw.keys_usage[k.hash] = { count: 0, last_used: null, history: [], blocked: false };
      }
    }
    const dyn = await getDynamicKeys(env);
    for (let hash in dyn) {
      if (!raw.keys_usage[hash]) {
        raw.keys_usage[hash] = { count: 0, last_used: null, history: [], blocked: false };
      }
    }
    return raw;
  } catch (e) {
    console.error("\u274C getStats:", e);
    return null;
  }
}
__name(getStats, "getStats");
async function getDynamicKeys(env) {
  try {
    const raw = await env.STATS.get("dynamic_keys", "json");
    return raw || {};
  } catch {
    return {};
  }
}
__name(getDynamicKeys, "getDynamicKeys");
async function saveDynamicKey(env, keyData) {
  return await withKVLock(env, "dynamic_keys", async () => {
    try {
      const dyn = await getDynamicKeys(env);
      const hash = await hashKey(keyData.key);
      keyData.hash = hash;
      keyData.blocked = keyData.blocked || false;
      keyData.count = keyData.count || 0;
      keyData.history = keyData.history || [];
      keyData.tags = keyData.tags || [];
      keyData.notas = keyData.notas || "";
      keyData.un_solo_uso = keyData.un_solo_uso || false;
      keyData.change_log = keyData.change_log || [];
      dyn[hash] = keyData;
      await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
      let stats = await getStats(env);
      if (stats && !stats.keys_usage[hash]) {
        stats.keys_usage[hash] = { count: keyData.count || 0, last_used: null, history: keyData.history || [], blocked: keyData.blocked || false };
        await env.STATS.put("global_stats", JSON.stringify(stats));
      }
      return true;
    } catch (e) {
      console.error("\u274C saveDynamicKey:", e);
      return false;
    }
  });
}
__name(saveDynamicKey, "saveDynamicKey");
async function deleteDynamicKey(env, key) {
  return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
      delete dyn[hash];
      await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
      return true;
    }
    return false;
  });
}
__name(deleteDynamicKey, "deleteDynamicKey");
async function getKeyBindings(env) {
  try {
    const raw = await env.STATS.get("key_bindings", "json");
    return raw || {};
  } catch {
    return {};
  }
}
__name(getKeyBindings, "getKeyBindings");
async function setKeyBinding(env, key, ip) {
  const hash = await hashKey(key);
  const bindings = await getKeyBindings(env);
  if (!bindings[hash]) {
    bindings[hash] = { ips: [ip], created: Date.now() };
  } else if (!bindings[hash].ips.includes(ip)) {
    if (bindings[hash].ips.length < 5) {
      bindings[hash].ips.push(ip);
    }
  }
  await env.STATS.put("key_bindings", JSON.stringify(bindings));
}
__name(setKeyBinding, "setKeyBinding");
async function blockKey(env, key) {
  return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
      dyn[hash].blocked = true;
      dyn[hash].change_log = dyn[hash].change_log || [];
      dyn[hash].change_log.push({ action: "block", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    }
    let stats = await getStats(env);
    if (stats && stats.keys_usage[hash]) {
      stats.keys_usage[hash].blocked = true;
      await env.STATS.put("global_stats", JSON.stringify(stats));
    }
  });
}
__name(blockKey, "blockKey");
async function unblockKey(env, key) {
  return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
      dyn[hash].blocked = false;
      dyn[hash].change_log = dyn[hash].change_log || [];
      dyn[hash].change_log.push({ action: "unblock", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    }
    let stats = await getStats(env);
    if (stats && stats.keys_usage[hash]) {
      stats.keys_usage[hash].blocked = false;
      await env.STATS.put("global_stats", JSON.stringify(stats));
    }
  });
}
__name(unblockKey, "unblockKey");
async function resetKeyUsage(env, key) {
  return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
      dyn[hash].count = 0;
      dyn[hash].history = [];
      dyn[hash].change_log = dyn[hash].change_log || [];
      dyn[hash].change_log.push({ action: "reset_usage", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    }
    let stats = await getStats(env);
    if (stats && stats.keys_usage[hash]) {
      stats.keys_usage[hash].count = 0;
      stats.keys_usage[hash].history = [];
      await env.STATS.put("global_stats", JSON.stringify(stats));
    }
  });
}
__name(resetKeyUsage, "resetKeyUsage");
async function unbindKey(env, key) {
  const hash = await hashKey(key);
  const bindings = await getKeyBindings(env);
  if (bindings[hash]) {
    delete bindings[hash];
    await env.STATS.put("key_bindings", JSON.stringify(bindings));
    return true;
  }
  return false;
}
__name(unbindKey, "unbindKey");
async function registrarCompra(env, compraData) {
  try {
    if (!compraData.estado) compraData.estado = "Activa";
    const id = `compra_${Date.now()}_${generateRandomHex(3)}`;
    await env.STATS.put(id, JSON.stringify(compraData));
    let index = await env.STATS.get("compras_index", "json") || [];
    index.push(id);
    if (index.length > 1e3) {
      const toRemove = index.slice(0, index.length - 1e3);
      for (let oldId of toRemove) {
        await env.STATS.delete(oldId);
      }
      index = index.slice(-1e3);
    }
    await env.STATS.put("compras_index", JSON.stringify(index));
    return true;
  } catch (e) {
    console.error("\u274C Error registrando compra:", e);
    return false;
  }
}
__name(registrarCompra, "registrarCompra");
async function getCompras(env, limit = 50, offset = 0, filtros = {}) {
  try {
    const index = await env.STATS.get("compras_index", "json") || [];
    let compras = [];
    for (let i = 0; i < index.length; i += 50) {
      const batch = index.slice(i, i + 50);
      const values = await Promise.all(batch.map((id) => env.STATS.get(id)));
      for (const raw of values) {
        if (!raw) continue;
        const c = JSON.parse(raw);
        if (!c.estado) c.estado = "Activa";
        let match = true;
        if (filtros.email && c.email !== filtros.email) match = false;
        if (filtros.estado && c.estado !== filtros.estado) match = false;
        if (filtros.producto && c.producto !== filtros.producto) match = false;
        if (filtros.desde && new Date(c.fecha) < new Date(filtros.desde)) match = false;
        if (filtros.hasta && new Date(c.fecha) > new Date(filtros.hasta)) match = false;
        if (match) compras.push(c);
      }
    }
    compras.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const total = compras.length;
    const slice = compras.slice(offset, offset + limit);
    return { compras: slice, total };
  } catch (e) {
    console.error("\u274C Error obteniendo compras:", e);
    return { compras: [], total: 0 };
  }
}
__name(getCompras, "getCompras");
async function checkRateLimit(env, ip, key) {
  return await withKVLock(env, `rate:${ip}`, async () => {
    const ipKey = `rl_ip_${ip}`;
    const now = Math.floor(Date.now() / 1e3);
    let record = await env.STATS.get(ipKey, "json");
    if (!record) {
      record = { count: 1, start: now };
      await env.STATS.put(ipKey, JSON.stringify(record), { expirationTtl: RATE_LIMIT_WINDOW });
    } else {
      if (now - record.start > RATE_LIMIT_WINDOW) {
        record = { count: 1, start: now };
        await env.STATS.put(ipKey, JSON.stringify(record), { expirationTtl: RATE_LIMIT_WINDOW });
      } else {
        if (record.count >= RATE_LIMIT_MAX) return false;
        record.count++;
        await env.STATS.put(ipKey, JSON.stringify(record), { expirationTtl: RATE_LIMIT_WINDOW });
      }
    }
    if (key) {
      const hash = await hashKey(key);
      const keyLimitKey = `rl_key_${hash}`;
      let keyRecord = await env.STATS.get(keyLimitKey, "json");
      if (!keyRecord) {
        keyRecord = { count: 1, start: now };
        await env.STATS.put(keyLimitKey, JSON.stringify(keyRecord), { expirationTtl: 3600 });
      } else {
        if (now - keyRecord.start > 3600) {
          keyRecord = { count: 1, start: now };
          await env.STATS.put(keyLimitKey, JSON.stringify(keyRecord), { expirationTtl: 3600 });
        } else {
          if (keyRecord.count >= 5) return false;
          keyRecord.count++;
          await env.STATS.put(keyLimitKey, JSON.stringify(keyRecord), { expirationTtl: 3600 });
        }
      }
    }
    return true;
  });
}
__name(checkRateLimit, "checkRateLimit");
function generateNonce() {
  return generateRandomHex(16).toUpperCase();
}
__name(generateNonce, "generateNonce");
async function getNonce(env, ip) {
  const nonce = generateNonce();
  const nonceKey = `nonce_${nonce}`;
  await env.STATS.put(nonceKey, "1", { expirationTtl: NONCE_TTL });
  return nonce;
}
__name(getNonce, "getNonce");
async function verifyNonce(env, nonce, ip) {
  const nonceKey = `nonce_${nonce}`;
  const stored = await env.STATS.get(nonceKey);
  if (!stored) return false;
  await env.STATS.delete(nonceKey);
  return true;
}
__name(verifyNonce, "verifyNonce");
function computeHmac(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const message = encoder.encode(data);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  ).then((key) => {
    return crypto.subtle.sign("HMAC", key, message);
  }).then((sig) => {
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}
__name(computeHmac, "computeHmac");
function timingSafeCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(timingSafeCompare, "timingSafeCompare");
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}
__name(escapeHTML, "escapeHTML");
function escapeJSAttribute(value) {
  return escapeHTML(JSON.stringify(String(value ?? "")));
}
__name(escapeJSAttribute, "escapeJSAttribute");
function adminProtectedPath(path) {
  return path === "/admin" || path.startsWith("/admin/") || [
    "/admin-action",
    "/generate",
    "/generate-batch",
    "/export-csv",
    "/export-json",
    "/qr-totp",
    "/renew-key",
    "/search-key",
    "/verify-batch",
    "/webhook",
    "/webhook/test",
    "/shorten",
    "/key-info"
  ].includes(path);
}
__name(adminProtectedPath, "adminProtectedPath");
async function getCachedValidKey(env, key) {
  const cacheKey = `valid_${key}`;
  const cached = await env.STATS.get(cacheKey);
  if (cached) return JSON.parse(cached);
  return null;
}
__name(getCachedValidKey, "getCachedValidKey");
async function setCachedValidKey(env, key, data) {
  const cacheKey = `valid_${key}`;
  await env.STATS.put(cacheKey, JSON.stringify(data), { expirationTtl: VALID_CACHE_TTL });
}
__name(setCachedValidKey, "setCachedValidKey");
async function updateStats(env, key, valid, ip = "unknown", userAgent = "") {
  return await withKVLock(env, "global_stats", async () => {
    try {
      let stats = await getStats(env);
      if (!stats) return null;
      const hash = await hashKey(key);
      stats.total_verifications = (stats.total_verifications || 0) + 1;
      if (valid) stats.valid_verifications = (stats.valid_verifications || 0) + 1;
      else stats.invalid_verifications = (stats.invalid_verifications || 0) + 1;
      if (!stats.keys_usage[hash]) stats.keys_usage[hash] = { count: 0, last_used: null, history: [], blocked: false };
      if (valid) stats.keys_usage[hash].count = (stats.keys_usage[hash].count || 0) + 1;
      stats.keys_usage[hash].last_used = (/* @__PURE__ */ new Date()).toISOString();
      if (!stats.keys_usage[hash].history) stats.keys_usage[hash].history = [];
      stats.keys_usage[hash].history.unshift({ valid, timestamp: (/* @__PURE__ */ new Date()).toISOString(), ip, userAgent });
      if (stats.keys_usage[hash].history.length > 10) stats.keys_usage[hash].history.pop();
      if (!stats.last_verifications) stats.last_verifications = [];
      stats.last_verifications.unshift({ key, valid, timestamp: (/* @__PURE__ */ new Date()).toISOString(), ip, userAgent });
      if (stats.last_verifications.length > 50) stats.last_verifications.pop();
      const hourKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 13);
      if (!stats.hourly_usage) stats.hourly_usage = {};
      stats.hourly_usage[hourKey] = (stats.hourly_usage[hourKey] || 0) + 1;
      const now = /* @__PURE__ */ new Date();
      const hours = Object.keys(stats.hourly_usage);
      for (let h of hours) {
        const hDate = /* @__PURE__ */ new Date(h + ":00:00Z");
        if (now.getTime() - hDate.getTime() > 864e5) delete stats.hourly_usage[h];
      }
      const dayKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (!stats.daily_usage) stats.daily_usage = {};
      if (!stats.daily_usage[dayKey]) stats.daily_usage[dayKey] = { valid: 0, invalid: 0 };
      if (valid) stats.daily_usage[dayKey].valid++;
      else stats.daily_usage[dayKey].invalid++;
      const days = Object.keys(stats.daily_usage);
      for (let d of days) {
        const dDate = /* @__PURE__ */ new Date(d + "T00:00:00Z");
        if (now.getTime() - dDate.getTime() > 7 * 864e5) delete stats.daily_usage[d];
      }
      await env.STATS.put("global_stats", JSON.stringify(stats));
      if (valid) {
        const dyn = await getDynamicKeys(env);
        if (dyn[hash]) {
          dyn[hash].count = (dyn[hash].count || 0) + 1;
          dyn[hash].last_used = (/* @__PURE__ */ new Date()).toISOString();
          if (!dyn[hash].history) dyn[hash].history = [];
          dyn[hash].history.unshift({ valid: true, timestamp: (/* @__PURE__ */ new Date()).toISOString(), ip, userAgent });
          if (dyn[hash].history.length > 10) dyn[hash].history.pop();
          await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
        }
      }
      return stats;
    } catch (e) {
      console.error("\u274C updateStats:", e);
      return null;
    }
  });
}
__name(updateStats, "updateStats");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function sendEmail(env, to, subject, html) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY no configurada. No se env\xEDa email a", to);
    return;
  }
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: getSenderName(env), email: getSenderEmail(env) },
        to: [{ email: to }],
        subject,
        htmlContent: html
      })
    });
  } catch (e) {
    console.error("Brevo email error:", e);
  }
}
__name(sendEmail, "sendEmail");
async function logUserAction(env, email, action, details = {}) {
  const id = `userlog_${Date.now()}_${generateRandomHex(3)}`;
  const entry = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), email, action, details };
  await env.STATS.put(id, JSON.stringify(entry), { expirationTtl: 2592e3 });
  let idx = await env.STATS.get(`userlog_idx_${email}`, "json") || [];
  idx.push(id);
  if (idx.length > 500) idx = idx.slice(-500);
  await env.STATS.put(`userlog_idx_${email}`, JSON.stringify(idx), { expirationTtl: 2592e3 });
}
__name(logUserAction, "logUserAction");
async function getLoginHistory(env, email, limit = 20) {
  const idx = await env.STATS.get(`userlog_idx_${email}`, "json") || [];
  const logins = [];
  for (let i = idx.length - 1; i >= 0 && logins.length < limit; i--) {
    const raw = await env.STATS.get(idx[i]);
    if (!raw) continue;
    const entry = JSON.parse(raw);
    if (entry.action === "login" || entry.action === "login_2fa" || entry.action === "register" || entry.action === "password_reset") {
      logins.push(entry);
    }
  }
  return logins;
}
__name(getLoginHistory, "getLoginHistory");
async function getCoupon(env, code) {
  return await env.STATS.get(`coupon_${code}`, "json");
}
__name(getCoupon, "getCoupon");
async function useCoupon(env, code) {
  return await withKVLock(env, `coupon:${code}`, async () => {
    const coupon = await getCoupon(env, code);
    if (!coupon) throw new Error("Cup\xF3n inv\xE1lido");
    if (coupon.expires && new Date(coupon.expires) < /* @__PURE__ */ new Date()) throw new Error("Cup\xF3n expirado");
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error("Cup\xF3n agotado");
    coupon.usedCount++;
    await env.STATS.put(`coupon_${code}`, JSON.stringify(coupon));
    return coupon;
  });
}
__name(useCoupon, "useCoupon");
async function triggerWebhooks(env, email, event, data) {
  const webhook = await env.STATS.get(`webhook_${email}`, "json");
  if (!webhook || !webhook.url) return;
  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data, timestamp: (/* @__PURE__ */ new Date()).toISOString() })
  }).catch((e) => console.error("Webhook error:", e));
}
__name(triggerWebhooks, "triggerWebhooks");
async function backupKV(env) {
  const all = {};
  let cursor;
  do {
    const list = await env.STATS.list({ cursor });
    for (const key of list.keys) {
      const value = await env.STATS.get(key.name);
      all[key.name] = value;
    }
    cursor = list.cursor;
  } while (cursor);
  if (env.R2) {
    await env.R2.put(`backup_${Date.now()}.json`, JSON.stringify(all));
  }
  return all;
}
__name(backupKV, "backupKV");
async function updateLeaderboard(env) {
  const users = await getAllUsers(env);
  const scores = [];
  for (const u of users) {
    const compras = (await getCompras(env, 1e3, 0, { email: u.email })).total;
    const referidos = (await getReferidosDe(env, u.email)).length;
    const score = compras * 10 + referidos * 20 + (u.points || 0);
    scores.push({ email: u.email, name: u.name, score });
  }
  scores.sort((a, b) => b.score - a.score);
  await env.STATS.put("leaderboard", JSON.stringify(scores.slice(0, 100)));
}
__name(updateLeaderboard, "updateLeaderboard");
function getCookieBannerScript() {
  return `
    <script>
    (function() {
        const consent = localStorage.getItem('cookie_consent');
        if (!consent) {
            const banner = document.createElement('div');
            banner.id = 'cookieBanner';
            banner.innerHTML = \`
                <div style="position:fixed;bottom:0;left:0;right:0;background:rgba(10,26,43,0.98);color:#e0f0ff;padding:18px 24px;z-index:99999;border-top:2px solid #00ccff;box-shadow:0 -8px 30px rgba(0,0,0,0.6);font-family:'Segoe UI',sans-serif;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:15px;">
                    <div style="flex:1;min-width:250px;font-size:0.9rem;">
                        \u{1F36A} Utilizamos cookies propias y de terceros para mejorar tu experiencia, analizar el tr\xE1fico y personalizar contenido. 
                        Puedes aceptar todas, rechazar las no esenciales o configurar tus preferencias. 
                        M\xE1s informaci\xF3n en nuestra 
                        <a href="/privacidad" style="color:#00ccff;">Pol\xEDtica de Privacidad</a>.
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button onclick="acceptAllCookies()" style="background:#00ccff;color:#0a1a2b;border:none;padding:10px 20px;border-radius:30px;cursor:pointer;font-weight:bold;">Aceptar todas</button>
                        <button onclick="rejectCookies()" style="background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);padding:10px 20px;border-radius:30px;cursor:pointer;">Solo esenciales</button>
                        <a href="/privacidad" style="background:transparent;color:#88ddff;padding:10px 20px;border-radius:30px;text-decoration:none;border:1px solid #88ddff;">M\xE1s info</a>
                    </div>
                </div>
            \`;
            document.body.appendChild(banner);
        }
        window.acceptAllCookies = function() {
            localStorage.setItem('cookie_consent', 'all');
            document.getElementById('cookieBanner').remove();
        };
        window.rejectCookies = function() {
            localStorage.setItem('cookie_consent', 'essential');
            document.getElementById('cookieBanner').remove();
        };
    })();
    <\/script>
    `;
}
__name(getCookieBannerScript, "getCookieBannerScript");
function getLegalFooter() {
  return `
    <footer style="margin-top:60px;padding:25px 20px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#88aacc;font-size:0.85rem;font-family:'Segoe UI',sans-serif;">
        <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-bottom:10px;">
            <a href="/aviso-legal" style="color:#88ddff;text-decoration:none;">\u2696\uFE0F Aviso Legal</a>
            <a href="/privacidad" style="color:#88ddff;text-decoration:none;">\u{1F512} Pol\xEDtica de Privacidad</a>
            <a href="/terminos" style="color:#88ddff;text-decoration:none;">\u{1F4C4} T\xE9rminos y Condiciones</a>
            <a href="/cookies" style="color:#88ddff;text-decoration:none;">\u{1F36A} Pol\xEDtica de Cookies</a>
        </div>
        <div>\u{1F30A} Ocean Hub \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} - Todos los derechos reservados</div>
    </footer>
    `;
}
__name(getLegalFooter, "getLegalFooter");
async function handlePrivacidad(env) {
  const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pol\xEDtica de Privacidad - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>\u{1F512} Pol\xEDtica de Privacidad</h1>
    <p><strong>\xDAltima actualizaci\xF3n:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>

    <h2>1. Responsable del tratamiento</h2>
    <p>Ocean Hub (en adelante, "nosotros" o "el Servicio") es el responsable del tratamiento de los datos personales que los usuarios (en adelante, "t\xFA" o "el Usuario") proporcionan a trav\xE9s del sitio web y los servicios ofrecidos.</p>

    <h2>2. Datos que recopilamos</h2>
    <ul>
        <li><strong>Datos de registro:</strong> correo electr\xF3nico, nombre de usuario y contrase\xF1a (almacenada siempre cifrada mediante PBKDF2).</li>
        <li><strong>Datos de uso:</strong> direcci\xF3n IP, agente de usuario (User-Agent), fecha y hora de acceso, historial de inicios de sesi\xF3n, acciones realizadas en la cuenta (compras, canjes, cambios de perfil).</li>
        <li><strong>Datos de pago:</strong> gestionados exclusivamente por PayPal. No almacenamos datos de tarjetas bancarias.</li>
        <li><strong>Cookies:</strong> utilizamos cookies t\xE9cnicas y anal\xEDticas para el correcto funcionamiento del sitio.</li>
    </ul>

    <h2>3. Finalidad del tratamiento</h2>
    <p>Utilizamos tus datos para: (a) gestionar tu cuenta y el acceso a los servicios; (b) procesar compras, suscripciones y canjes; (c) enviarte comunicaciones relacionadas con tu cuenta (verificaci\xF3n, compras, renovaciones); (d) prevenir el fraude y garantizar la seguridad; (e) cumplir con obligaciones legales.</p>

    <h2>4. Base legal</h2>
    <p>El tratamiento se basa en la ejecuci\xF3n del contrato (para prestarte los servicios), tu consentimiento (para cookies no esenciales y comunicaciones comerciales) y el inter\xE9s leg\xEDtimo (para seguridad y prevenci\xF3n de fraude).</p>

    <h2>5. Conservaci\xF3n de datos</h2>
    <p>Conservamos tus datos mientras tu cuenta est\xE9 activa. Si la eliminas, tus datos personales se borrar\xE1n en un plazo m\xE1ximo de 30 d\xEDas, excepto aquellos que debamos conservar por obligaci\xF3n legal.</p>

    <h2>6. Destinatarios</h2>
    <p>Tus datos pueden ser comunicados a: proveedores de pago (PayPal), proveedores de correo electr\xF3nico (Brevo), proveedores de infraestructura (Cloudflare), y autoridades competentes cuando la ley lo exija.</p>

    <h2>7. Tus derechos</h2>
    <p>Puedes ejercer los derechos de acceso, rectificaci\xF3n, supresi\xF3n, oposici\xF3n, limitaci\xF3n y portabilidad escribiendo a nuestro correo de contacto. Tambi\xE9n tienes derecho a presentar una reclamaci\xF3n ante la autoridad de protecci\xF3n de datos de tu pa\xEDs.</p>

    <h2>8. Seguridad</h2>
    <p>Aplicamos medidas t\xE9cnicas y organizativas para proteger tus datos: contrase\xF1as cifradas, comunicaciones HTTPS, verificaci\xF3n en dos pasos, control de accesos y monitorizaci\xF3n de seguridad.</p>

    <h2>9. Contacto</h2>
    <p>Para cualquier consulta sobre privacidad escr\xEDbenos a: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <a href="/home" class="back">\u2190 Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handlePrivacidad, "handlePrivacidad");
async function handleAvisoLegal(env) {
  const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Aviso Legal - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>\u2696\uFE0F Aviso Legal</h1>
    <p><strong>\xDAltima actualizaci\xF3n:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>

    <h2>1. Informaci\xF3n general</h2>
    <p>El presente Aviso Legal regula el uso del sitio web <strong>Ocean Hub</strong> y los servicios ofrecidos a trav\xE9s del mismo.</p>

    <h2>2. Titular</h2>
    <p>El titular del sitio web es Ocean Hub. Para cualquier comunicaci\xF3n puede utilizarse la direcci\xF3n de correo: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <h2>3. Objeto</h2>
    <p>Ocean Hub es una plataforma digital dedicada a la venta y gesti\xF3n de licencias digitales (DLCs), claves de acceso y suscripciones para servicios de terceros. No estamos afiliados a Roblox Corporation ni a ninguna otra plataforma mencionada.</p>

    <h2>4. Condiciones de uso</h2>
    <p>El acceso al sitio atribuye la condici\xF3n de Usuario e implica la aceptaci\xF3n plena de este Aviso Legal, de la Pol\xEDtica de Privacidad y de los T\xE9rminos y Condiciones. El Usuario se compromete a hacer un uso l\xEDcito del sitio, no realizar actividades fraudulentas, no compartir claves con terceros no autorizados y no intentar vulnerar la seguridad del sistema.</p>

    <h2>5. Propiedad intelectual</h2>
    <p>Todos los contenidos del sitio (textos, im\xE1genes, logotipos, c\xF3digo fuente, dise\xF1o) son propiedad de Ocean Hub o de sus leg\xEDtimos titulares, y est\xE1n protegidos por las leyes de propiedad intelectual. Queda prohibida su reproducci\xF3n total o parcial sin autorizaci\xF3n expresa.</p>

    <h2>6. Exclusi\xF3n de responsabilidad</h2>
    <p>Ocean Hub no se hace responsable de: (a) interrupciones del servicio por causas t\xE9cnicas o de fuerza mayor; (b) uso indebido de las claves por parte del Usuario; (c) contenido de sitios de terceros enlazados; (d) da\xF1os indirectos derivados del uso del servicio.</p>

    <h2>7. Enlaces externos</h2>
    <p>El sitio puede contener enlaces a p\xE1ginas de terceros. Ocean Hub no controla dichos sitios y no asume responsabilidad alguna sobre sus contenidos o pol\xEDticas.</p>

    <h2>8. Modificaciones</h2>
    <p>Ocean Hub se reserva el derecho de modificar este Aviso Legal en cualquier momento. Las modificaciones entrar\xE1n en vigor desde su publicaci\xF3n.</p>

    <h2>9. Legislaci\xF3n aplicable</h2>
    <p>Este Aviso Legal se rige por la legislaci\xF3n vigente en el pa\xEDs del titular. Cualquier controversia ser\xE1 sometida a los juzgados y tribunales competentes.</p>

    <a href="/home" class="back">\u2190 Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleAvisoLegal, "handleAvisoLegal");
async function handleTerminos(env) {
  const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>T\xE9rminos y Condiciones - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>\u{1F4C4} T\xE9rminos y Condiciones</h1>
    <p><strong>\xDAltima actualizaci\xF3n:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>

    <h2>1. Aceptaci\xF3n</h2>
    <p>El uso de Ocean Hub implica la aceptaci\xF3n plena de estos T\xE9rminos y Condiciones. Si no est\xE1s de acuerdo, debes abstenerte de usar el servicio.</p>

    <h2>2. Descripci\xF3n del servicio</h2>
    <p>Ocean Hub ofrece: venta de claves de licencia digital, suscripciones, sistema de referidos, panel de revendedores, canje de c\xF3digos y verificaci\xF3n de claves. Los productos son bienes digitales de acceso inmediato.</p>

    <h2>3. Registro de usuario</h2>
    <p>Para acceder a determinadas funciones es necesario registrarse. El Usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas con su cuenta. Debe notificarnos de inmediato cualquier uso no autorizado.</p>

    <h2>4. Compras y pagos</h2>
    <p>Los pagos se procesan a trav\xE9s de PayPal. Los precios se muestran en USD y pueden variar seg\xFAn la moneda. Una vez adquirida una clave digital, no se admiten devoluciones salvo error comprobado o duplicidad.</p>

    <h2>5. Pol\xEDtica de reembolsos</h2>
    <p>Al tratarse de productos digitales de acceso inmediato, no se realizan reembolsos una vez entregada la clave, salvo casos excepcionales: clave inv\xE1lida desde el momento de la entrega, duplicidad de pago, o error t\xE9cnico imputable a Ocean Hub.</p>

    <h2>6. Uso aceptable</h2>
    <p>El Usuario se compromete a NO: (a) revender claves sin autorizaci\xF3n; (b) usar el servicio para actividades ilegales; (c) intentar vulnerar la seguridad; (d) acosar o amenazar a otros usuarios; (e) crear m\xFAltiples cuentas para abusar del sistema de referidos.</p>

    <h2>7. Suspensi\xF3n y cancelaci\xF3n</h2>
    <p>Nos reservamos el derecho de suspender o cancelar cuentas que incumplan estos T\xE9rminos, sin previo aviso y sin derecho a reembolso. Tambi\xE9n podemos bloquear claves vinculadas a actividades fraudulentas.</p>

    <h2>8. Programa de referidos</h2>
    <p>Los usuarios pueden obtener comisiones por referir nuevos clientes. Las comisiones se acreditan seg\xFAn las condiciones vigentes y pueden ser modificadas. No se permite el autofraude (referirse a s\xED mismo o crear cuentas falsas).</p>

    <h2>9. Revendedores</h2>
    <p>Los revendedores autorizados adquieren packs de claves a precio reducido y pueden revenderlas. Deben respetar los precios m\xEDnimos y no realizar publicidad enga\xF1osa. Ocean Hub puede revocar el rol de revendedor en cualquier momento.</p>

    <h2>10. Limitaci\xF3n de responsabilidad</h2>
    <p>Ocean Hub no se responsabiliza del mal uso de las claves por parte del Usuario, ni de bloqueos realizados por plataformas de terceros. La responsabilidad m\xE1xima se limita al importe abonado por el producto.</p>

    <h2>11. Modificaciones</h2>
    <p>Podemos modificar estos T\xE9rminos en cualquier momento. Se recomienda revisarlos peri\xF3dicamente. El uso continuado del servicio implica la aceptaci\xF3n de las nuevas condiciones.</p>

    <h2>12. Contacto</h2>
    <p>Para cualquier duda sobre estos T\xE9rminos: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <a href="/home" class="back">\u2190 Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleTerminos, "handleTerminos");
async function handleCookies(env) {
  const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pol\xEDtica de Cookies - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>\u{1F36A} Pol\xEDtica de Cookies</h1>
    <p><strong>\xDAltima actualizaci\xF3n:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>

    <h2>1. \xBFQu\xE9 son las cookies?</h2>
    <p>Las cookies son peque\xF1os archivos que se almacenan en tu dispositivo al visitar un sitio web. Nos permiten recordar tus preferencias, mantener tu sesi\xF3n activa y analizar c\xF3mo usas el sitio.</p>

    <h2>2. Tipos de cookies que usamos</h2>
    <ul>
        <li><strong>Esenciales (t\xE9cnicas):</strong> necesarias para el funcionamiento (sesi\xF3n, carrito, seguridad). No pueden desactivarse.</li>
        <li><strong>Preferencias:</strong> recuerdan tu idioma, modo oscuro y otras opciones.</li>
        <li><strong>Anal\xEDticas:</strong> nos ayudan a entender el uso del sitio (estad\xEDsticas an\xF3nimas).</li>
    </ul>

    <h2>3. C\xF3mo gestionarlas</h2>
    <p>Al acceder al sitio ver\xE1s un banner donde puedes aceptar todas, rechazar las no esenciales o configurarlas. Tambi\xE9n puedes borrarlas desde la configuraci\xF3n de tu navegador.</p>

    <h2>4. Base legal</h2>
    <p>El uso de cookies esenciales se basa en el inter\xE9s leg\xEDtimo (funcionamiento del servicio). Las cookies no esenciales requieren tu consentimiento previo, conforme al RGPD y la LSSI.</p>

    <a href="/home" class="back">\u2190 Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleCookies, "handleCookies");
async function checkActionRateLimit(env, bucket, identifier, max, windowSeconds) {
  const safeId = await hashKey(String(identifier || "unknown"));
  return await withKVLock(env, `rate-action:${bucket}:${safeId}`, async () => {
    const now = Math.floor(Date.now() / 1e3);
    const storageKey = `rl_action_${bucket}_${safeId}`;
    let record = await env.STATS.get(storageKey, "json");
    if (!record || now - record.start >= windowSeconds) {
      record = { count: 1, start: now };
      await env.STATS.put(storageKey, JSON.stringify(record), { expirationTtl: windowSeconds });
      return true;
    }
    if (record.count >= max) return false;
    record.count++;
    await env.STATS.put(storageKey, JSON.stringify(record), { expirationTtl: windowSeconds });
    return true;
  });
}
__name(checkActionRateLimit, "checkActionRateLimit");
async function handleForgotPassword(env, request) {
  if (request.method === "GET") {
    return new Response(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recuperar contrase\xF1a - Ocean Hub</title>
        <style>
            body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;padding:20px;}
            .card{background:rgba(255,255,255,0.06);border-radius:30px;padding:40px;max-width:400px;width:100%;border:1px solid rgba(0,200,255,0.2);}
            h2{color:#00ccff;text-align:center;}
            input{width:100%;padding:12px;border-radius:10px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:1rem;margin:8px 0;}
            button{background:#00ccff;border:none;color:#0a1a2b;padding:12px;border-radius:40px;font-weight:bold;font-size:1.1rem;cursor:pointer;width:100%;transition:0.3s;}
            button:hover{background:#33ddff;}
            .back{margin-top:20px;color:#00ccff;text-decoration:none;text-align:center;display:block;}
        </style>
        </head><body>
        <div class="card">
            <h2>\u{1F511} Recuperar contrase\xF1a</h2>
            <p style="text-align:center;color:#88aacc;font-size:0.9rem;">Introduce tu email y te enviaremos un enlace para restablecer tu contrase\xF1a.</p>
            <form method="POST" action="/forgot-password">
                <input type="email" name="email" placeholder="Tu email" required>
                <button type="submit">Enviar enlace</button>
            </form>
            <a href="/login" class="back">\u2190 Volver al login</a>
        </div>
        ${getCookieBannerScript()}
        </body></html>
        `, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  try {
    const ip = getClientIP(request);
    const allowed = await checkActionRateLimit(env, "forgot", ip, FORGOT_RATE_LIMIT, FORGOT_RATE_WINDOW);
    if (!allowed) return new Response("Demasiadas solicitudes. Espera 10 minutos.", { status: 429 });
    const formData = await request.formData();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!email) return new Response("Email requerido", { status: 400 });
    const user = await getUserByEmail(env, email);
    if (user) {
      const resetToken = generateRandomHex(32);
      await env.STATS.put(`pwd_reset_${resetToken}`, JSON.stringify({
        email,
        created: (/* @__PURE__ */ new Date()).toISOString(),
        ip: getClientIP(request)
      }), { expirationTtl: RESET_TOKEN_TTL });
      const resetUrl = `${getBaseUrl(env)}/reset-password?token=${encodeURIComponent(resetToken)}`;
      const html = `
                <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                    <h2 style="color:#00ccff;">\u{1F511} Recuperaci\xF3n de contrase\xF1a</h2>
                    <p>Hola ${escapeHTML(user.name || email)},</p>
                    <p>Has solicitado restablecer tu contrase\xF1a en <strong>Ocean Hub</strong>. Pulsa el siguiente bot\xF3n para crear una nueva:</p>
                    <p style="text-align:center;margin:30px 0;">
                        <a href="${resetUrl}" style="background:#00ccff;color:#0a1a2b;padding:14px 30px;border-radius:40px;text-decoration:none;font-weight:bold;">Restablecer contrase\xF1a</a>
                    </p>
                    <p style="font-size:0.85rem;color:#88aacc;">O copia este enlace:<br><code style="background:#112233;padding:6px 10px;border-radius:6px;word-break:break-all;">${resetUrl}</code></p>
                    <p style="font-size:0.85rem;color:#88aacc;">Este enlace caduca en 30 minutos. Si no solicitaste este cambio, ignora este correo.</p>
                    <hr style="border-color:rgba(255,255,255,0.1);margin:25px 0;">
                    <p style="font-size:0.8rem;color:#88aacc;">IP de la solicitud: ${escapeHTML(getClientIP(request))}</p>
                </div>
            `;
      await sendEmail(env, email, "\u{1F511} Recuperaci\xF3n de contrase\xF1a - Ocean Hub", html);
      await sendAlert(env, `\u{1F511} Solicitud de reset de contrase\xF1a para ${email}`, "reset_password", null, getClientIP(request));
    }
    return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;padding:20px;text-align:center;">
            <h2 style="color:#00cc88;">\u2705 Solicitud enviada</h2>
            <p>Si el email est\xE1 registrado, recibir\xE1s un enlace de recuperaci\xF3n en tu correo en los pr\xF3ximos minutos.</p>
            <p style="color:#88aacc;font-size:0.9rem;">Revisa tambi\xE9n la carpeta de spam.</p>
            <a href="/login" style="color:#00ccff;margin-top:20px;">\u2190 Volver al login</a>
        </body></html>
        `, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error("forgot-password error:", e);
    return new Response("Error procesando la solicitud: " + e.message, { status: 500 });
  }
}
__name(handleForgotPassword, "handleForgotPassword");
async function handleResetPassword(env, request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;">
            <h2 style="color:#ff6666;">\u274C Enlace inv\xE1lido</h2>
            <p>Falta el token de recuperaci\xF3n.</p>
            <a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a>
        </body></html>
        `, { status: 400, headers: { "Content-Type": "text/html" } });
  }
  if (request.method === "GET") {
    const data = await env.STATS.get(`pwd_reset_${token}`, "json");
    if (!data) {
      return new Response(`
            <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;">
                <h2 style="color:#ff6666;">\u274C Enlace expirado o inv\xE1lido</h2>
                <p>Este enlace ya ha sido usado o ha caducado.</p>
                <a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a>
            </body></html>
            `, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    return new Response(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nueva contrase\xF1a - Ocean Hub</title>
        <style>
            body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;padding:20px;}
            .card{background:rgba(255,255,255,0.06);border-radius:30px;padding:40px;max-width:400px;width:100%;border:1px solid rgba(0,200,255,0.2);}
            h2{color:#00ccff;text-align:center;}
            input{width:100%;padding:12px;border-radius:10px;border:none;background:rgba(255,255,255,0.08);color:white;font-size:1rem;margin:8px 0;}
            button{background:#00ccff;border:none;color:#0a1a2b;padding:12px;border-radius:40px;font-weight:bold;font-size:1.1rem;cursor:pointer;width:100%;transition:0.3s;}
            button:hover{background:#33ddff;}
            .error{color:#ff6666;text-align:center;font-size:0.9rem;margin-top:10px;}
        </style>
        </head><body>
        <div class="card">
            <h2>\u{1F511} Nueva contrase\xF1a</h2>
            <p style="text-align:center;color:#88aacc;font-size:0.9rem;">Introduce tu nueva contrase\xF1a (m\xEDnimo 8 caracteres).</p>
            <form method="POST" action="/reset-password?token=${encodeURIComponent(token)}">
                <input type="password" name="password" placeholder="Nueva contrase\xF1a" required minlength="8" maxlength="128">
                <input type="password" name="password2" placeholder="Repite la contrase\xF1a" required minlength="8" maxlength="128">
                <button type="submit">Cambiar contrase\xF1a</button>
            </form>
        </div>
        ${getCookieBannerScript()}
        </body></html>
        `, { headers: { "Content-Type": "text/html" } });
  }
  try {
    const resetResult = await withKVLock(env, `pwd-reset:${token}`, async () => {
      const data = await env.STATS.get(`pwd_reset_${token}`, "json");
      if (!data) return { error: "expired" };
      const formData = await request.formData();
      const password = String(formData.get("password") || "");
      const password2 = String(formData.get("password2") || "");
      if (password.length < 8 || password.length > 128) return { error: "password" };
      if (password !== password2) return { error: "mismatch" };
      const user2 = await getUserByEmail(env, data.email);
      if (!user2) return { error: "user" };
      const newSalt = generateRandomHex(16);
      const newHash = await hashPassword(password, newSalt);
      user2.salt = newSalt;
      user2.passwordHash = newHash;
      user2.sessionVersion = Number(user2.sessionVersion || 0) + 1;
      await env.STATS.put(`user_${user2.email}`, JSON.stringify(user2));
      await env.STATS.delete(`pwd_reset_${token}`);
      return { ok: true, user: user2 };
    });
    if (resetResult.error === "expired") {
      return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">\u274C Enlace expirado o inv\xE1lido</h2><a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a></body></html>`, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    if (resetResult.error === "password") {
      return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">\u274C Contrase\xF1a inv\xE1lida</h2><p>Debe tener entre 8 y 128 caracteres.</p><a href="/reset-password?token=${encodeURIComponent(token)}" style="color:#00ccff;">Volver a intentar</a></body></html>`, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    if (resetResult.error === "mismatch") {
      return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">\u274C Las contrase\xF1as no coinciden</h2><a href="/reset-password?token=${encodeURIComponent(token)}" style="color:#00ccff;">Volver a intentar</a></body></html>`, { status: 400, headers: { "Content-Type": "text/html" } });
    }
    if (resetResult.error === "user") {
      return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">\u274C Usuario no encontrado</h2></body></html>`, { status: 404, headers: { "Content-Type": "text/html" } });
    }
    const user = resetResult.user;
    await logUserAction(env, user.email, "password_reset", { ip: getClientIP(request) });
    await sendAlert(env, `\u{1F511} Contrase\xF1a restablecida para ${user.email}`, "password_reset", null, getClientIP(request));
    await sendEmail(env, user.email, "Tu contrase\xF1a ha sido cambiada - Ocean Hub", `
            <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                <h2 style="color:#00cc88;">\u2705 Contrase\xF1a actualizada</h2>
                <p>Hola ${escapeHTML(user.name || user.email)},</p>
                <p>Tu contrase\xF1a ha sido cambiada correctamente.</p>
                <p style="font-size:0.9rem;color:#88aacc;">Si NO realizaste este cambio, contacta con nosotros de inmediato.</p>
                <p style="font-size:0.85rem;color:#88aacc;">IP del cambio: ${escapeHTML(getClientIP(request))}<br>Fecha: ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
            </div>
        `);
    return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;text-align:center;padding:20px;">
            <h2 style="color:#00cc88;">\u2705 Contrase\xF1a actualizada</h2>
            <p>Ya puedes iniciar sesi\xF3n con tu nueva contrase\xF1a.</p>
            <a href="/login" style="color:#00ccff;margin-top:20px;">\u2192 Iniciar sesi\xF3n</a>
        </body></html>
        `, { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    console.error("reset-password error:", e);
    return new Response("Error: " + e.message, { status: 500 });
  }
}
__name(handleResetPassword, "handleResetPassword");
async function handleGetNonce(env, request) {
  const ip = getClientIP(request);
  const nonce = await getNonce(env, ip);
  return jsonResponse({ nonce });
}
__name(handleGetNonce, "handleGetNonce");
async function handleVerify(env, request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  let key = pathParts[2] || null;
  if (key) {
    try {
      key = decodeURIComponent(key);
    } catch (e) {
    }
  }
  if (!key) return jsonResponse({ success: false, error: "Falta clave" }, 400);
  const ip = getClientIP(request);
  const userAgent = request.headers.get("User-Agent") || "";
  if (await isIPBlacklisted(env, ip)) {
    return jsonResponse({ success: false, error: "IP bloqueada temporalmente" }, 403);
  }
  const allowed = await checkRateLimit(env, ip, key);
  if (!allowed) return jsonResponse({ success: false, error: "Demasiadas verificaciones. Espera 1 hora." }, 429);
  let timestamp = url.searchParams.get("t");
  let nonce = url.searchParams.get("n");
  let hmac = url.searchParams.get("h");
  if (!timestamp || !nonce || !hmac) return jsonResponse({ success: false, error: "Faltan par\xE1metros de seguridad" }, 400);
  const now = Math.floor(Date.now() / 1e3);
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(now - ts) > 120) return jsonResponse({ success: false, error: "Timestamp inv\xE1lido" }, 400);
  const nonceValid = await verifyNonce(env, nonce, ip);
  if (!nonceValid) return jsonResponse({ success: false, error: "Nonce inv\xE1lido" }, 400);
  const dataToSign = `${key}:${timestamp}:${nonce}`;
  const secrets = await getValidHMACSecrets(env);
  let signatureValid = false;
  for (const secret of secrets) {
    const computedHmac = await computeHmac(dataToSign, secret);
    if (timingSafeCompare(computedHmac, hmac)) {
      signatureValid = true;
      break;
    }
  }
  if (!signatureValid) {
    await registerIPFailure(env, ip);
    return jsonResponse({ success: false, error: "Firma inv\xE1lida" }, 400);
  }
  const cached = await getCachedValidKey(env, key);
  if (cached) {
    await updateStats(env, key, true, ip, userAgent);
    return jsonResponse({ ...cached, cached: true });
  }
  const keyHash = await hashKey(key);
  const dynamicKeys = await getDynamicKeys(env);
  let kData = null;
  let staticKey = STATIC_KEYS.find((k) => k.hash === keyHash);
  if (staticKey) kData = { ...staticKey, dynamic: false };
  else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };
  if (!kData) {
    await updateStats(env, key, false, ip, userAgent);
    await registerIPFailure(env, ip);
    return jsonResponse({ success: false, valid: false, error: "\u274C Clave inv\xE1lida" });
  }
  if (kData.type === "honeypot") {
    await sendAlert(env, `\u{1F41F} Honeypot activado para IP ${ip} con clave ${key}`, "honeypot", key, ip);
    const response = { success: true, valid: true, message: "\u2705 Clave v\xE1lida (honeypot)", rango: kData.rango, timeLeft: "\u221E", dias_restantes: "\u221E" };
    await setCachedValidKey(env, key, response);
    await updateStats(env, key, true, ip, userAgent);
    return jsonResponse(response);
  }
  let isBlocked = false;
  let currentUses = 0;
  const stats = await getStats(env);
  const usage = stats.keys_usage?.[keyHash] || { count: 0, blocked: false };
  isBlocked = usage.blocked || false;
  currentUses = usage.count || 0;
  if (isBlocked) return jsonResponse({ success: false, valid: false, error: "\u{1F6AB} Clave bloqueada" });
  if (kData.un_solo_uso && currentUses >= 1) {
    await blockKey(env, key);
    return jsonResponse({ success: false, valid: false, error: "\u26D4 Clave de un solo uso ya utilizada" });
  }
  const bindings = await getKeyBindings(env);
  if (bindings[keyHash] && !bindings[keyHash].ips.includes(ip)) {
    await sendAlert(env, `\u{1F511} Clave ${key} usada desde IP nueva: ${ip} (se detectaron ${bindings[keyHash].ips.length} IP(s) conocidas)`, "security", key, ip);
    return jsonResponse({ success: false, valid: false, error: "\u{1F512} Clave vinculada a otra IP" });
  }
  if (!bindings[keyHash]) await setKeyBinding(env, key, ip);
  if (kData.maxUses && currentUses >= kData.maxUses) {
    return jsonResponse({ success: false, valid: false, error: "\u26D4 L\xEDmite de usos alcanzado" });
  }
  if (currentUses > 0 && kData.history && kData.history.length >= 5) {
    const recent = kData.history.slice(0, 5);
    const first = new Date(recent[recent.length - 1].timestamp).getTime();
    const last = new Date(recent[0].timestamp).getTime();
    if (last - first < 6e5) {
      await sendAlert(env, `\u26A0\uFE0F Uso excesivo de clave ${key}: ${currentUses} usos en pocos minutos`, "abuse", key, ip);
    }
  }
  if (kData.dynamic && kData.created_at) {
    const created = new Date(kData.created_at);
    const nowDate = /* @__PURE__ */ new Date();
    const diffSeconds = (nowDate.getTime() - created.getTime()) / 1e3;
    let maxSeconds = 0;
    const exp = kData.expires;
    if (exp !== "permanente") {
      const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.startsWith("d\xEDa")) maxSeconds = num * 86400;
        else if (unit.startsWith("hora")) maxSeconds = num * 3600;
        else if (unit.startsWith("minuto")) maxSeconds = num * 60;
        else if (unit.startsWith("a\xF1o")) maxSeconds = num * 31536e3;
      }
    } else maxSeconds = Infinity;
    if (diffSeconds > maxSeconds) return jsonResponse({ success: false, valid: false, error: "\u23F0 Clave expirada" });
  }
  await updateStats(env, key, true, ip, userAgent);
  let timeLeft = "\u221E";
  if (kData.expires !== "permanente" && kData.dynamic && kData.created_at) {
    const created = new Date(kData.created_at);
    const nowDate = /* @__PURE__ */ new Date();
    const diffSeconds = (nowDate.getTime() - created.getTime()) / 1e3;
    let maxSeconds = 0;
    const exp = kData.expires;
    const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit.startsWith("d\xEDa")) maxSeconds = num * 86400;
      else if (unit.startsWith("hora")) maxSeconds = num * 3600;
      else if (unit.startsWith("minuto")) maxSeconds = num * 60;
      else if (unit.startsWith("a\xF1o")) maxSeconds = num * 31536e3;
    }
    const remaining = Math.max(0, maxSeconds - diffSeconds);
    if (remaining > 0) {
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor(remaining % 86400 / 3600);
      const minutes = Math.floor(remaining % 3600 / 60);
      const secs = Math.floor(remaining % 60);
      if (days > 0) timeLeft = `${days}d ${hours}h`;
      else if (hours > 0) timeLeft = `${hours}h ${minutes}m`;
      else if (minutes > 0) timeLeft = `${minutes}m ${secs}s`;
      else timeLeft = `${secs}s`;
    } else timeLeft = "expirada";
  } else if (!kData.dynamic && kData.expires !== "permanente") {
    timeLeft = kData.expires;
  }
  const message = `\u2705 Clave v\xE1lida (${kData.rango}) - Restante: ${timeLeft}`;
  const responseData = { success: true, valid: true, message, rango: kData.rango, timeLeft, dias_restantes: timeLeft === "\u221E" ? "\u221E" : timeLeft.includes("d\xEDa") ? timeLeft : Math.floor(parseInt(timeLeft) / 86400).toString() };
  await setCachedValidKey(env, key, responseData);
  return jsonResponse(responseData);
}
__name(handleVerify, "handleVerify");
async function handleVerifyWeb(env, request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return jsonResponse({ success: false, error: "Falta clave" }, 400);
  const ip = getClientIP(request);
  const userAgent = request.headers.get("User-Agent") || "";
  if (await isIPBlacklisted(env, ip)) {
    return jsonResponse({ success: false, error: "IP bloqueada temporalmente" }, 403);
  }
  const allowed = await checkRateLimit(env, ip, key);
  if (!allowed) return jsonResponse({ success: false, error: "Demasiadas verificaciones. Espera 1 hora." }, 429);
  const keyHash = await hashKey(key);
  const dynamicKeys = await getDynamicKeys(env);
  let kData = null;
  let staticKey = STATIC_KEYS.find((k) => k.hash === keyHash);
  if (staticKey) kData = { ...staticKey, dynamic: false };
  else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };
  if (!kData) {
    await updateStats(env, key, false, ip, userAgent);
    await registerIPFailure(env, ip);
    return jsonResponse({ success: false, valid: false, error: "\u274C Clave inv\xE1lida" });
  }
  if (kData.type === "honeypot") {
    await sendAlert(env, `\u{1F41F} Honeypot activado para IP ${ip} con clave ${key}`, "honeypot", key, ip);
    return jsonResponse({ success: true, valid: true, message: "\u2705 Clave v\xE1lida (honeypot)", rango: kData.rango });
  }
  let isBlocked = false;
  let currentUses = 0;
  const stats = await getStats(env);
  const usage = stats.keys_usage?.[keyHash] || { count: 0, blocked: false };
  isBlocked = usage.blocked || false;
  currentUses = usage.count || 0;
  if (isBlocked) return jsonResponse({ success: false, valid: false, error: "\u{1F6AB} Clave bloqueada" });
  if (kData.un_solo_uso && currentUses >= 1) return jsonResponse({ success: false, valid: false, error: "\u26D4 Clave de un solo uso ya utilizada" });
  if (kData.maxUses && currentUses >= kData.maxUses) return jsonResponse({ success: false, valid: false, error: "\u26D4 L\xEDmite de usos alcanzado" });
  if (kData.dynamic && kData.created_at) {
    const created = new Date(kData.created_at);
    const nowDate = /* @__PURE__ */ new Date();
    const diffSeconds = (nowDate.getTime() - created.getTime()) / 1e3;
    let maxSeconds = 0;
    const exp = kData.expires;
    if (exp !== "permanente") {
      const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.startsWith("d\xEDa")) maxSeconds = num * 86400;
        else if (unit.startsWith("hora")) maxSeconds = num * 3600;
        else if (unit.startsWith("minuto")) maxSeconds = num * 60;
        else if (unit.startsWith("a\xF1o")) maxSeconds = num * 31536e3;
      }
    } else maxSeconds = Infinity;
    if (diffSeconds > maxSeconds) return jsonResponse({ success: false, valid: false, error: "\u23F0 Clave expirada" });
  }
  await updateStats(env, key, true, ip, userAgent);
  let timeLeft = "\u221E";
  if (kData.expires !== "permanente" && kData.dynamic && kData.created_at) {
    const created = new Date(kData.created_at);
    const nowDate = /* @__PURE__ */ new Date();
    const diffSeconds = (nowDate.getTime() - created.getTime()) / 1e3;
    let maxSeconds = 0;
    const exp = kData.expires;
    const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit.startsWith("d\xEDa")) maxSeconds = num * 86400;
      else if (unit.startsWith("hora")) maxSeconds = num * 3600;
      else if (unit.startsWith("minuto")) maxSeconds = num * 60;
      else if (unit.startsWith("a\xF1o")) maxSeconds = num * 31536e3;
    }
    const remaining = Math.max(0, maxSeconds - diffSeconds);
    if (remaining > 0) {
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor(remaining % 86400 / 3600);
      const minutes = Math.floor(remaining % 3600 / 60);
      const secs = Math.floor(remaining % 60);
      if (days > 0) timeLeft = `${days}d ${hours}h`;
      else if (hours > 0) timeLeft = `${hours}h ${minutes}m`;
      else if (minutes > 0) timeLeft = `${minutes}m ${secs}s`;
      else timeLeft = `${secs}s`;
    } else timeLeft = "expirada";
  }
  return jsonResponse({ success: true, valid: true, message: `\u2705 Clave v\xE1lida (${kData.rango})`, rango: kData.rango, timeLeft });
}
__name(handleVerifyWeb, "handleVerifyWeb");
async function handleKeyInfo(env, url) {
  const key = url.searchParams.get("key");
  if (!key) return jsonResponse({ error: "Falta clave" }, 400);
  const keyHash = await hashKey(key);
  const stats = await getStats(env);
  const dynamicKeys = await getDynamicKeys(env);
  let kData = null;
  let staticKey = STATIC_KEYS.find((k) => k.hash === keyHash);
  if (staticKey) kData = { ...staticKey, dynamic: false };
  else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };
  if (!kData) return jsonResponse({ error: "Clave no encontrada" }, 404);
  const usage = stats.keys_usage?.[keyHash] || { count: 0, history: [], blocked: false };
  return jsonResponse({
    rango: kData.rango,
    type: kData.type,
    expires: kData.expires,
    uses: usage.count || 0,
    maxUses: kData.maxUses || null,
    blocked: usage.blocked || false,
    dynamic: kData.dynamic || false,
    history: usage.history || [],
    tags: kData.tags || [],
    notas: kData.notas || "",
    un_solo_uso: kData.un_solo_uso || false,
    created_at: kData.created_at || null
  });
}
__name(handleKeyInfo, "handleKeyInfo");
async function handleAdminAction(env, url, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const ip = getClientIP(request);
  const pinFailKey = `pin_fail_${ip}`;
  const failRecord = await env.STATS.get(pinFailKey, "json");
  if (failRecord && failRecord.count >= PIN_BRUTE_LIMIT) {
    const now = Math.floor(Date.now() / 1e3);
    if (now - failRecord.first_fail < PIN_BRUTE_WINDOW) {
      return jsonResponse({ error: "Demasiados intentos de PIN. Espera 10 minutos." }, 429);
    } else await env.STATS.delete(pinFailKey);
  }
  const pin = url.searchParams.get("pin");
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) {
    let record = failRecord || { count: 0, first_fail: Math.floor(Date.now() / 1e3) };
    record.count++;
    await env.STATS.put(pinFailKey, JSON.stringify(record), { expirationTtl: PIN_BRUTE_WINDOW });
    return jsonResponse({ error: "PIN incorrecto" }, 403);
  }
  await env.STATS.delete(pinFailKey);
  const action = url.searchParams.get("action");
  const key = url.searchParams.get("key");
  if (!key) return jsonResponse({ error: "Falta clave" }, 400);
  let result;
  switch (action) {
    case "block":
      await blockKey(env, key);
      result = { message: "Clave bloqueada" };
      break;
    case "unblock":
      await unblockKey(env, key);
      result = { message: "Clave desbloqueada" };
      break;
    case "reset":
      await resetKeyUsage(env, key);
      result = { message: "Usos reiniciados" };
      break;
    case "delete": {
      const deleted = await deleteDynamicKey(env, key);
      if (deleted) {
        let stats = await getStats(env);
        const hash = await hashKey(key);
        if (stats && stats.keys_usage[hash]) {
          delete stats.keys_usage[hash];
          await env.STATS.put("global_stats", JSON.stringify(stats));
        }
        result = { message: "Clave eliminada" };
      } else result = { error: "No es una clave din\xE1mica o no existe" };
      break;
    }
    case "unbind": {
      const unbound = await unbindKey(env, key);
      result = { message: unbound ? "IP desvinculada" : "No estaba vinculada" };
      break;
    }
    case "renew": {
      const hash = await hashKey(key);
      const days = parseInt(url.searchParams.get("days")) || 30;
      result = await withKVLock(env, "dynamic_keys", async () => {
        const dyn = await getDynamicKeys(env);
        if (!dyn[hash]) return { error: "Clave no encontrada" };
        let current = dyn[hash].expires;
        let num = parseInt(current) || 30;
        if (current.includes("a\xF1o")) num = 365;
        else if (current.includes("mes")) num = 30;
        const newExp = `${num + days} d\xEDas`;
        dyn[hash].expires = newExp;
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: "renew", days_added: days, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
        await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
        await sendAlert(env, `\u{1F504} Clave ${key} renovada +${days} d\xEDas (nueva exp: ${newExp})`, "admin", key);
        return { message: `Clave renovada. Nueva expiraci\xF3n: ${newExp}` };
      });
      break;
    }
    default:
      result = { error: "Acci\xF3n no v\xE1lida" };
  }
  await logAdminAction(env, action, key, ip, result);
  return jsonResponse(result);
}
__name(handleAdminAction, "handleAdminAction");
async function handleAdminCompras(env, url, headers) {
  const auth = await requireAdmin(env, new Request(url.toString(), { headers }));
  if (!auth) return new Response("\u26D4 No autorizado", { status: 403 });
  const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const { compras, total } = await getCompras(env, limit, offset);
  const totalPages = Math.ceil(total / limit);
  let rows = "";
  for (const c of compras) {
    rows += `<tr><td>${escapeHTML(c.email || "")}</td><td>${escapeHTML(c.producto || c.plan || "")}</td><td>${Number(c.precio || c.amount || 0).toFixed(2)}</td><td>${escapeHTML(c.fecha || c.created_at || "")}</td><td>${escapeHTML(c.estado || "")}</td></tr>`;
  }
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Compras - Ocean Hub</title><style>body{background:#0a1a2b;color:#e0f0ff;font-family:Segoe UI,sans-serif;padding:30px}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.04)}th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}th{color:#00ccff}.back{color:#00ccff}</style></head><body><h1>\u{1F9FE} Compras</h1><div style="overflow:auto"><table><thead><tr><th>Email</th><th>Producto</th><th>Precio</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div><p>P\xE1gina ${page} de ${Math.max(totalPages, 1)}</p><a class="back" href="/admin">\u2190 Volver al panel</a></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleAdminCompras, "handleAdminCompras");
async function handleGenerate(env, request, url) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const pin = body.pin;
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) return jsonResponse({ error: "PIN incorrecto" }, 403);
  let { key, type, rango, expires, maxUses, tags, notas, un_solo_uso } = body;
  if (!key) {
    let attempts = 0;
    let exists = true;
    while (exists && attempts < 10) {
      key = "DLC-" + generateRandomHex(6).toUpperCase().match(/.{1,4}/g).join("-");
      const hash = await hashKey(key);
      const dyn = await getDynamicKeys(env);
      exists = !!dyn[hash] || STATIC_KEYS.some((k) => k.hash === hash);
      attempts++;
    }
    if (exists) return jsonResponse({ error: "No se pudo generar una clave \xFAnica" }, 500);
  } else {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) return jsonResponse({ error: "La clave ya existe" }, 400);
    if (STATIC_KEYS.some((k) => k.hash === hash)) return jsonResponse({ error: "La clave ya existe como est\xE1tica" }, 400);
  }
  if (un_solo_uso) {
    maxUses = 1;
  }
  const keyData = {
    key,
    type: type || "premium",
    rango: rango || "\u{1F988} Tibur\xF3n",
    expires: expires || "30 d\xEDas",
    maxUses: maxUses || void 0,
    un_solo_uso: un_solo_uso || false,
    tags: tags ? tags.split(",").map((t) => t.trim()) : [],
    notas: notas || "",
    dynamic: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    blocked: false,
    count: 0,
    history: [],
    change_log: [{ action: "created", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
  };
  const saved = await saveDynamicKey(env, keyData);
  if (!saved) return jsonResponse({ error: "Error al guardar la clave en el KV" }, 500);
  await logAdminAction(env, "generate", key, getClientIP(request), { keyData });
  return jsonResponse({ message: "Clave generada correctamente", key, keyData });
}
__name(handleGenerate, "handleGenerate");
async function handleGenerateBatch(env, url, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const pin = url.searchParams.get("pin");
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) return jsonResponse({ error: "PIN incorrecto" }, 403);
  let count = parseInt(url.searchParams.get("count")) || 5;
  count = Math.min(Math.max(count, 1), 50);
  const keys = [];
  for (let i = 0; i < count; i++) {
    let key = "DLC-" + generateRandomHex(6).toUpperCase().match(/.{1,4}/g).join("-");
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (!dyn[hash] && !STATIC_KEYS.some((k) => k.hash === hash)) {
      const keyData = { key, type: "premium", rango: "\u{1F988} Tibur\xF3n", expires: "30 d\xEDas", dynamic: true, created_at: (/* @__PURE__ */ new Date()).toISOString(), blocked: false, count: 0, history: [], tags: [], notas: "", un_solo_uso: false, change_log: [{ action: "created_batch", timestamp: (/* @__PURE__ */ new Date()).toISOString() }] };
      const saved = await saveDynamicKey(env, keyData);
      if (saved) keys.push(key);
    }
  }
  if (keys.length === 0) return jsonResponse({ error: "No se pudo generar ninguna clave" });
  return jsonResponse({ message: `Generadas ${keys.length} claves`, keys });
}
__name(handleGenerateBatch, "handleGenerateBatch");
async function handleExportCsv(env, url) {
  const filtros = {
    rango: url.searchParams.get("rango") || null,
    type: url.searchParams.get("type") || null,
    estado: url.searchParams.get("estado") || null,
    desde: url.searchParams.get("desde") || null,
    hasta: url.searchParams.get("hasta") || null
  };
  const stats = await getStats(env) || {};
  const dynamicKeys = await getDynamicKeys(env) || {};
  let allKeys = [];
  for (let k of STATIC_KEYS) {
    const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: "", un_solo_uso: false });
  }
  for (let hash in dynamicKeys) {
    const k = dynamicKeys[hash];
    const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: (k.tags || []).join(", "), notas: k.notas || "", un_solo_uso: k.un_solo_uso || false });
  }
  if (filtros.rango) allKeys = allKeys.filter((k) => k.rango.toLowerCase().includes(filtros.rango.toLowerCase()));
  if (filtros.type) allKeys = allKeys.filter((k) => k.type === filtros.type);
  if (filtros.estado) {
    if (filtros.estado === "activa") allKeys = allKeys.filter((k) => !k.blocked);
    else if (filtros.estado === "bloqueada") allKeys = allKeys.filter((k) => k.blocked);
    else if (filtros.estado === "expirada") {
      allKeys = allKeys.filter((k) => k.expires !== "permanente" && !k.blocked);
    }
  }
  let csv = "Clave,Rango,Tipo,Duraci\xF3n,Usos,Estado,Din\xE1mica,Tags,Notas,UnSoloUso\n";
  allKeys.forEach((k) => {
    csv += `${k.key},${k.rango},${k.type},${k.expires},${k.uses},${k.blocked ? "Bloqueada" : "Activa"},${k.dynamic ? "S\xED" : "No"},${k.tags},${k.notas},${k.un_solo_uso ? "S\xED" : "No"}
`;
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="ocean_hub_keys_export.csv"'
    }
  });
}
__name(handleExportCsv, "handleExportCsv");
async function handleExportJson(env, url) {
  const stats = await getStats(env);
  const dynamicKeys = await getDynamicKeys(env);
  let allKeys = [];
  for (let k of STATIC_KEYS) {
    const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: "", un_solo_uso: false });
  }
  for (let hash in dynamicKeys) {
    const k = dynamicKeys[hash];
    const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [], notas: k.notas || "", un_solo_uso: k.un_solo_uso || false });
  }
  const rango = url.searchParams.get("rango");
  const type = url.searchParams.get("type");
  const estado = url.searchParams.get("estado");
  if (rango) allKeys = allKeys.filter((k) => k.rango.toLowerCase().includes(rango.toLowerCase()));
  if (type) allKeys = allKeys.filter((k) => k.type === type);
  if (estado) {
    if (estado === "activa") allKeys = allKeys.filter((k) => !k.blocked);
    else if (estado === "bloqueada") allKeys = allKeys.filter((k) => k.blocked);
  }
  return jsonResponse({ keys: allKeys, total: allKeys.length, exported_at: (/* @__PURE__ */ new Date()).toISOString() });
}
__name(handleExportJson, "handleExportJson");
async function handleWebhook(env, request) {
  const body = await request.json();
  const { message, severity, key, ip } = body;
  await sendAlert(env, `\u{1F6A8} **ALERTA**
${message}
Clave: ${key || "N/A"}
IP: ${ip || "N/A"}`, severity, key, ip);
  return jsonResponse({ status: "alert sent" });
}
__name(handleWebhook, "handleWebhook");
async function handleQR(env, url) {
  const totpSecret = String(env.TOTP_SECRET || "").trim().replace(/=+$/, "").toUpperCase();
  if (!/^[A-Z2-7]{16,128}$/.test(totpSecret)) {
    return jsonResponse({ error: "TOTP_SECRET no configurado correctamente" }, 503);
  }
  const otpauth = buildOTPAuthURI(totpSecret, "admin", "Ocean Hub");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
  return new Response(`
    <html>
    <body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
      <h2 style="color:#00ccff;">\u{1F4F1} Escanea este QR con Google Authenticator</h2>
      <img src="${qrUrl}" style="border:4px solid #00ccff;border-radius:20px;">
      <p style="margin-top:20px;color:#88aacc;">No compartas el secreto TOTP.</p>
      <a href="/admin" style="color:#00ccff;margin-top:20px;">Volver al panel</a>
    </body>
    </html>
  `, { headers: { "Content-Type": "text/html" } });
}
__name(handleQR, "handleQR");
async function handleSSE(env) {
  const stats = await getStats(env);
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(stats)}

`));
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1e4));
        const newStats = await getStats(env);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(newStats)}

`));
      }
    }
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}
__name(handleSSE, "handleSSE");
async function handleStatus(env) {
  const stats = await getStats(env);
  const uptime = stats ? Math.floor((Date.now() - new Date(stats.start_time).getTime()) / 1e3) : 0;
  const dynamicKeys = await getDynamicKeys(env);
  const totalKeys = STATIC_KEYS.length + Object.keys(dynamicKeys).length;
  return jsonResponse({
    status: "online",
    uptime_seconds: uptime,
    total_keys: totalKeys,
    valid_verifications: stats?.valid_verifications || 0,
    total_verifications: stats?.total_verifications || 0,
    active_keys: Object.values(stats?.keys_usage || {}).filter((u) => !u.blocked).length,
    server_time: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleStatus, "handleStatus");
async function handleClaimKey(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return new Response("No autorizado", { status: 403 });
  if (!await checkRateLimit(env, getClientIP(request), null)) return jsonResponse({ error: "Demasiados intentos" }, 429);
  const url = new URL(request.url);
  const codigo = url.searchParams.get("codigo");
  const email = auth.user.email;
  if (request.method === "GET" && !codigo) {
    return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;max-width:400px;">
                    <h2 style="color:#00ccff;">\u{1F3AB} Canjear c\xF3digo</h2>
                    <form method="GET" action="/claim-key">
                        <input type="text" name="codigo" placeholder="C\xF3digo de canje" style="padding:10px;border-radius:8px;border:none;margin:5px;width:100%;">
                        <input type="email" name="email" placeholder="Tu email" style="padding:10px;border-radius:8px;border:none;margin:5px;width:100%;">
                        <button type="submit" style="padding:10px 30px;background:#00ccff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Canjear</button>
                    </form>
                </div>
            </body></html>
        `, { headers: { "Content-Type": "text/html" } });
  }
  if (!codigo || !email) {
    return new Response("\u274C Faltan par\xE1metros: codigo y email son obligatorios.", { status: 400 });
  }
  try {
    const entry = await usarCodigoCanje(env, codigo, email);
    const productoId = entry.producto_id;
    const producto = PRODUCTS[productoId] || PRODUCTS.price_aprendiz;
    const key = "DLC-CANJE-" + generateRandomHex(5).toUpperCase();
    const keyData = {
      key,
      type: "premium",
      rango: "\u{1F3AB} Canjeado",
      expires: `${producto.days || 30} d\xEDas`,
      dynamic: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      blocked: false,
      count: 0,
      history: [],
      tags: ["canje"],
      notas: `Canjeado por ${email} con c\xF3digo ${codigo}`,
      un_solo_uso: false,
      change_log: [{ action: "created_from_canje", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
    };
    await saveDynamicKey(env, keyData);
    await registrarCompra(env, {
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      email,
      user_id: "",
      clave: key,
      producto: producto.name,
      precio: producto.price,
      payment_id: codigo,
      proveedor: "canje",
      estado: "activa"
    });
    await sendAlert(env, `\u{1F3AB} C\xF3digo canjeado: ${email} us\xF3 ${codigo} para obtener clave ${key}`, "canje", key);
    await logUserAction(env, email, "claim", { codigo, key });
    await sendEmail(env, email, "Clave canjeada", `<h1>\u2705 Clave canjeada</h1><p>Tu clave es: <code>${key}</code></p><p>Producto: ${producto.name}</p>`);
    return new Response(`\u2705 \xA1C\xF3digo canjeado! Tu clave es: <code>${key}</code>`, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    return new Response(`\u274C ${err.message}`, { status: 400 });
  }
}
__name(handleClaimKey, "handleClaimKey");
async function handleRenewKey(env, request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const days = parseInt(url.searchParams.get("days")) || 30;
  if (!key) return jsonResponse({ error: "Falta clave" }, 400);
  const hash = await hashKey(key);
  return await withKVLock(env, "dynamic_keys", async () => {
    const dyn = await getDynamicKeys(env);
    if (!dyn[hash]) return jsonResponse({ error: "Clave no encontrada o no din\xE1mica" }, 404);
    let current = dyn[hash].expires;
    let num = parseInt(current) || 30;
    if (current.includes("a\xF1o")) num = 365;
    else if (current.includes("mes")) num = 30;
    const newExp = `${num + days} d\xEDas`;
    dyn[hash].expires = newExp;
    dyn[hash].change_log = dyn[hash].change_log || [];
    dyn[hash].change_log.push({ action: "renew", days_added: days, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    await sendAlert(env, `\u{1F504} Clave ${key} renovada +${days} d\xEDas (nueva exp: ${newExp})`, "admin", key);
    return jsonResponse({ message: `Clave renovada. Nueva expiraci\xF3n: ${newExp}` });
  });
}
__name(handleRenewKey, "handleRenewKey");
async function handleInvoice(env, url, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const id = url.pathname.split("/")[2];
  if (!id) return jsonResponse({ error: "Falta ID" }, 400);
  const raw = await env.STATS.get(id);
  if (!raw) return jsonResponse({ error: "Factura no encontrada" }, 404);
  const data = JSON.parse(raw);
  if (data.email !== auth.user.email) {
    return jsonResponse({ error: "Factura no encontrada" }, 404);
  }
  const html = `
    <html><head><title>Factura ${id}</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:40px;}h1{color:#00ccff;}</style>
    </head>
    <body>
        <h1>\u{1F30A} Ocean Hub - Factura</h1>
        <p><strong>ID:</strong> ${escapeHTML(id)}</p>
        <p><strong>Fecha:</strong> ${escapeHTML(data.fecha)}</p>
        <p><strong>Producto:</strong> ${escapeHTML(data.producto)}</p>
        <p><strong>Precio:</strong> $${escapeHTML(data.precio)}</p>
        <p><strong>Clave:</strong> ${escapeHTML(data.clave)}</p>
        <p><strong>Email:</strong> ${escapeHTML(data.email)}</p>
    </body></html>
    `;
  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}
__name(handleInvoice, "handleInvoice");
async function handlePublicStats(env) {
  const stats = await getStats(env);
  if (!stats) return jsonResponse({ error: "No stats" }, 500);
  return jsonResponse({
    total_verifications: stats.total_verifications || 0,
    valid_verifications: stats.valid_verifications || 0,
    invalid_verifications: stats.invalid_verifications || 0,
    active_keys: Object.values(stats.keys_usage || {}).filter((u) => !u.blocked).length,
    uptime: stats.start_time ? Math.floor((Date.now() - new Date(stats.start_time).getTime()) / 1e3) : 0
  });
}
__name(handlePublicStats, "handlePublicStats");
async function handleSearchKey(env, url) {
  const q = url.searchParams.get("q") || "";
  const stats = await getStats(env);
  const dynamicKeys = await getDynamicKeys(env);
  let results = [];
  for (let k of STATIC_KEYS) {
    if (k.key.toLowerCase().includes(q.toLowerCase())) {
      const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
      results.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: false });
    }
  }
  for (let hash in dynamicKeys) {
    const k = dynamicKeys[hash];
    if (k.key.toLowerCase().includes(q.toLowerCase())) {
      const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
      results.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [] });
    }
  }
  return jsonResponse({ results, count: results.length });
}
__name(handleSearchKey, "handleSearchKey");
async function handleVerifyBatch(env, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const keys = body.keys;
  if (!Array.isArray(keys) || keys.length === 0) return jsonResponse({ error: "Se requiere un array de claves" }, 400);
  if (keys.length > 100) return jsonResponse({ error: "M\xE1ximo 100 claves por lote" }, 413);
  const results = [];
  for (let k of keys) {
    const hash = await hashKey(k);
    const dyn = await getDynamicKeys(env);
    const exists = dyn[hash] || STATIC_KEYS.some((sk) => sk.hash === hash);
    results.push({ key: k, valid: !!exists });
  }
  return jsonResponse({ results });
}
__name(handleVerifyBatch, "handleVerifyBatch");
async function handleShorten(env, request) {
  const url = new URL(request.url);
  const longUrl = url.searchParams.get("url");
  if (!longUrl) return jsonResponse({ error: "Falta par\xE1metro url" }, 400);
  let parsedUrl;
  try {
    parsedUrl = new URL(longUrl);
  } catch {
    return jsonResponse({ error: "URL inv\xE1lida" }, 400);
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) return jsonResponse({ error: "Solo se permiten URLs HTTP/HTTPS" }, 400);
  const id = generateRandomHex(4).toLowerCase();
  await env.STATS.put(`short_${id}`, longUrl, { expirationTtl: 86400 * 30 });
  const short = `${url.origin}/s/${id}`;
  return jsonResponse({ short, id, original: longUrl });
}
__name(handleShorten, "handleShorten");
async function handleWebhookTest(env) {
  await sendAlert(env, "\u{1F9EA} Mensaje de prueba desde Ocean Hub Webhook", "test");
  return jsonResponse({ status: "test sent" });
}
__name(handleWebhookTest, "handleWebhookTest");
async function handleAdminLogs(env, url) {
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const { logs, total } = await getAdminLogs(env, limit, offset);
  let rows = logs.map((log) => `<tr><td>${log.timestamp}</td><td>${log.action}</td><td>${log.key || "N/A"}</td><td>${log.ip}</td><td>${JSON.stringify(log.details)}</td></tr>`).join("");
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Admin Logs</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:10px;border-bottom:1px solid #333;}</style>
    </head><body>
    <h1 style="color:#00ccff;">\u{1F4CB} Logs de administraci\xF3n</h1>
    <table><thead><tr><th>Fecha</th><th>Acci\xF3n</th><th>Clave</th><th>IP</th><th>Detalles</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Total: ${total} registros</p>
    <a href="/admin" style="color:#00ccff;">Volver</a>
    </body></html>
    `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleAdminLogs, "handleAdminLogs");
async function handleBatchExpire(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  const days = parseInt(body.days) || 30;
  if (!keys.length) return jsonResponse({ error: "Faltan claves" }, 400);
  let modified = 0, notFound = 0;
  await withKVLock(env, "dynamic_keys", async () => {
    const dyn = await getDynamicKeys(env);
    for (let k of keys) {
      const hash = await hashKey(k);
      if (dyn[hash]) {
        const current = dyn[hash].expires;
        let num = parseInt(current) || 30;
        if (current.includes("a\xF1o")) num = 365;
        else if (current.includes("mes")) num = 30;
        dyn[hash].expires = `${num + days} d\xEDas`;
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: "batch_expire", days_added: days, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
        modified++;
      } else {
        notFound++;
      }
    }
    await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
  });
  await sendAlert(env, `\u{1F4E6} Caducidad en lote: ${modified} claves extendidas +${days} d\xEDas (${notFound} no encontradas)`, "admin");
  return jsonResponse({ message: `${modified} claves actualizadas, ${notFound} no encontradas` });
}
__name(handleBatchExpire, "handleBatchExpire");
async function handleAdminConsole(env, request) {
  const url = new URL(request.url);
  const body = await request.json();
  const cmd = body.cmd;
  if (!cmd) return jsonResponse({ error: "Falta comando" }, 400);
  let result = "";
  if (cmd.startsWith("/ban ")) {
    const ip = cmd.split(" ")[1];
    if (ip) {
      await addIPToBlacklist(env, ip);
      result = `IP ${ip} bloqueada`;
    }
  } else if (cmd.startsWith("/unban ")) {
    const ip = cmd.split(" ")[1];
    if (ip) {
      await env.STATS.delete(`blacklist_${ip}`);
      result = `IP ${ip} desbloqueada`;
    }
  } else if (cmd.startsWith("/block ")) {
    const key = cmd.split(" ")[1];
    if (key) {
      await blockKey(env, key);
      result = `Clave ${key} bloqueada`;
    }
  } else if (cmd.startsWith("/unblock ")) {
    const key = cmd.split(" ")[1];
    if (key) {
      await unblockKey(env, key);
      result = `Clave ${key} desbloqueada`;
    }
  } else if (cmd.startsWith("/reset ")) {
    const key = cmd.split(" ")[1];
    if (key) {
      await resetKeyUsage(env, key);
      result = `Usos de ${key} reiniciados`;
    }
  } else if (cmd === "/stats") {
    const stats = await getStats(env);
    result = JSON.stringify(stats, null, 2);
  } else {
    result = "Comando no reconocido. Usa /ban IP, /unban IP, /block key, /unblock key, /reset key, /stats";
  }
  return jsonResponse({ result });
}
__name(handleAdminConsole, "handleAdminConsole");
async function handleShortRedirect(env, url) {
  const id = url.pathname.split("/")[2];
  if (!id) return new Response("Falta ID", { status: 400 });
  const long = await env.STATS.get(`short_${id}`);
  if (!long) return new Response("URL no encontrada", { status: 404 });
  return Response.redirect(long, 302);
}
__name(handleShortRedirect, "handleShortRedirect");
async function handleAdminIngresos(env, url) {
  const { compras } = await getCompras(env, 1e4, 0);
  const ahora = /* @__PURE__ */ new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const semana = new Date(ahora.getTime() - 7 * 864e5);
  const mes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate());
  let ventasDia = 0, ventasSemana = 0, ventasMes = 0, totalIngresos = 0;
  const porProducto = {};
  compras.forEach((c) => {
    const fecha = new Date(c.fecha);
    const precio = parseFloat(c.precio) || 0;
    totalIngresos += precio;
    if (fecha >= hoy) ventasDia += precio;
    if (fecha >= semana) ventasSemana += precio;
    if (fecha >= mes) ventasMes += precio;
    const prod = c.producto || "Desconocido";
    porProducto[prod] = (porProducto[prod] || 0) + precio;
  });
  let productoMasVendido = "Ninguno";
  let maxVentas = 0;
  for (let [prod, total] of Object.entries(porProducto)) {
    if (total > maxVentas) {
      maxVentas = total;
      productoMasVendido = prod;
    }
  }
  return jsonResponse({
    dia: ventasDia,
    semana: ventasSemana,
    mes: ventasMes,
    total: totalIngresos,
    producto_mas_vendido: productoMasVendido,
    total_compras: compras.length
  });
}
__name(handleAdminIngresos, "handleAdminIngresos");
async function handleCronRenew(env) {
  const userList = await env.STATS.get("user_list", "json") || [];
  let renovadas = 0;
  let alertadas = 0;
  for (let email of userList) {
    const sus = await getSuscripcionUsuario(env, email);
    if (!sus || !sus.activa) continue;
    const fin = new Date(sus.fecha_fin);
    const ahora = /* @__PURE__ */ new Date();
    const diffDias = Math.ceil((fin.getTime() - ahora.getTime()) / 864e5);
    if (diffDias === 3) {
      await sendAlert(env, `\u23F3 La suscripci\xF3n de ${email} (${sus.plan}) caduca en 3 d\xEDas`, "suscripcion");
      await sendEmail(env, email, "Tu suscripci\xF3n caduca en 3 d\xEDas", `<h1>\u23F3 Aviso</h1><p>Tu suscripci\xF3n caduca en 3 d\xEDas. Renueva para no perder los beneficios.</p>`);
      alertadas++;
    }
    if (diffDias <= 0 && sus.renovacion_automatica) {
      try {
        await renovarSuscripcion(env, email, SUSCRIPCION_PLANES[sus.plan].days);
        renovadas++;
      } catch (e) {
        console.error("Error renovando:", e);
      }
    }
  }
  return jsonResponse({ message: `Renovadas ${renovadas} suscripciones, alertadas ${alertadas}` });
}
__name(handleCronRenew, "handleCronRenew");
async function handleGenerarPrueba(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const pin = body.pin;
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) return jsonResponse({ error: "PIN incorrecto" }, 403);
  const horas = parseInt(body.horas) || 1;
  const key = "DLC-PRUEBA-" + generateRandomHex(4).toUpperCase();
  const keyData = {
    key,
    type: "prueba",
    rango: "\u{1F9EA} Prueba",
    expires: `${horas} hora${horas > 1 ? "s" : ""}`,
    maxUses: 1,
    un_solo_uso: true,
    tags: ["prueba"],
    notas: `Clave de prueba de ${horas}h generada por admin`,
    dynamic: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    blocked: false,
    count: 0,
    history: [],
    change_log: [{ action: "created_prueba", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
  };
  await saveDynamicKey(env, keyData);
  await sendAlert(env, `\u{1F9EA} Clave de prueba generada: ${key} (${horas}h)`, "admin", key);
  return jsonResponse({ message: "Clave de prueba generada", key, horas });
}
__name(handleGenerarPrueba, "handleGenerarPrueba");
async function handleRegister(env, request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") || null;
  if (request.method === "GET") {
    const acceptLang = request.headers.get("Accept-Language") || "es";
    const lang = acceptLang.split(",")[0].split("-")[0];
    const t = /* @__PURE__ */ __name((key) => getTranslation(env, lang, key), "t");
    return new Response(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>${t("register")} - Ocean Hub</title>
        <style>
            body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column; padding: 20px; }
            .card { background: rgba(255,255,255,0.06); border-radius: 30px; padding: 40px; max-width: 400px; width: 100%; border: 1px solid rgba(0,200,255,0.2); }
            h2 { color: #00ccff; text-align: center; }
            input { width: 100%; padding: 12px; border-radius: 10px; border: none; background: rgba(255,255,255,0.08); color: white; font-size: 1rem; margin: 8px 0; }
            button { background: #00ccff; border: none; color: #0a1a2b; padding: 12px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; width: 100%; transition: 0.3s; }
            button:hover { background: #33ddff; }
            .error { color: #ff6666; text-align: center; }
            .success { color: #00cc88; text-align: center; }
            .back { margin-top: 20px; color: #00ccff; text-decoration: none; }
        </style>
        </head>
        <body>
        <div class="card">
            <h2>\u{1F30A} ${t("register")}</h2>
            ${ref ? `<p style="color:#88ddff;">\u{1F517} Registr\xE1ndote con el referido: <strong>${escapeHTML(ref)}</strong></p>` : ""}
            <form method="POST" action="/register${ref ? "?ref=" + encodeURIComponent(ref) : ""}">
                <input type="text" name="name" placeholder="${t("name")} (opcional)">
                <input type="email" name="email" placeholder="${t("email")}" required>
                <input type="password" name="password" placeholder="${t("password")} (8-128 caracteres)" required minlength="8" maxlength="128">
                ${ref ? `<input type="hidden" name="ref" value="${escapeHTML(ref)}">` : ""}
                <button type="submit">${t("register")}</button>
            </form>
            <p style="text-align:center; margin-top:15px;">\xBFYa tienes cuenta? <a href="/login" style="color:#00ccff;">${t("login")}</a></p>
            <a href="/welcome" class="back">\u2190 ${t("home")}</a>
        </div>
        ${getCookieBannerScript()}
        ${getLegalFooter()}
        </body>
        </html>
        `, { headers: { "Content-Type": "text/html" } });
  }
  const registerAllowed = await checkActionRateLimit(env, "register", getClientIP(request), REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW);
  if (!registerAllowed) {
    return new Response("Demasiados registros desde esta conexi\xF3n. Espera 10 minutos.", { status: 429 });
  }
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const name = formData.get("name") || "";
  const referralCode = formData.get("ref") || ref || null;
  if (!email || !password || password.length < 8 || password.length > 128) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">\u274C Error</h2>
                <p>Email y contrase\xF1a (8-128 caracteres) son obligatorios.</p>
                <a href="/register" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { "Content-Type": "text/html" } });
  }
  try {
    const user = await createUser(env, email, name, password, referralCode);
    const token = await createSession(env, user);
    const cookie = `session_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
    await logUserAction(env, email, "register", { referralCode });
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#00cc88;">\u2705 Registro exitoso</h2>
            <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
            <p>Tu c\xF3digo de referido: <code style="background:#112233;padding:4px 12px;border-radius:6px;">${escapeHTML(user.referral_code)}</code></p>
            <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
        </body></html>
        `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie } });
  } catch (err) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">\u274C Error</h2>
                <p>No se pudo completar la operaci\xF3n. Int\xE9ntalo de nuevo.</p>
                <a href="/register" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { "Content-Type": "text/html" } });
  }
}
__name(handleRegister, "handleRegister");
async function handleLogin(env, request) {
  const url = new URL(request.url);
  const ip = getClientIP(request);
  if (request.method !== "GET") {
    const ipAllowed = await checkActionRateLimit(env, "login-ip", ip, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
    if (!ipAllowed) {
      return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">\u26D4 Demasiados intentos</h2>
                    <p>Espera 10 minutos antes de intentar de nuevo.</p>
                    <a href="/login" style="color:#00ccff;">Volver</a>
                </div>
            </body></html>
            `, { status: 429, headers: { "Content-Type": "text/html" } });
    }
  }
  if (request.method === "GET") {
    const acceptLang = request.headers.get("Accept-Language") || "es";
    const lang = acceptLang.split(",")[0].split("-")[0];
    const t = /* @__PURE__ */ __name((key) => getTranslation(env, lang, key), "t");
    return new Response(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>${t("login")} - Ocean Hub</title>
        <style>
            body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column; padding: 20px; }
            .card { background: rgba(255,255,255,0.06); border-radius: 30px; padding: 40px; max-width: 400px; width: 100%; border: 1px solid rgba(0,200,255,0.2); }
            h2 { color: #00ccff; text-align: center; }
            input { width: 100%; padding: 12px; border-radius: 10px; border: none; background: rgba(255,255,255,0.08); color: white; font-size: 1rem; margin: 8px 0; }
            button { background: #00ccff; border: none; color: #0a1a2b; padding: 12px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; width: 100%; transition: 0.3s; }
            button:hover { background: #33ddff; }
            .back { margin-top: 20px; color: #00ccff; text-decoration: none; }
            .auth-options { display: flex; justify-content: center; gap: 15px; margin: 15px 0; }
            .auth-options a { color: #88ddff; text-decoration: none; padding: 8px 16px; border-radius: 20px; background: rgba(255,255,255,0.05); }
            .auth-options a:hover { background: rgba(255,255,255,0.1); }
            .forgot { text-align:center; margin-top:10px; }
            .forgot a { color:#88ddff; text-decoration:none; font-size:0.9rem; }
            .forgot a:hover { color:#00ccff; }
        </style>
        </head>
        <body>
        <div class="card">
            <h2>\u{1F510} ${t("login")}</h2>
            <div class="auth-options">
                <a href="/auth/discord">\u{1F7E3} Discord</a>
                <a href="/auth/google">\u{1F534} Google</a>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1); margin: 15px 0;">
            <form method="POST" action="/login">
                <input type="email" name="email" placeholder="${t("email")}" required>
                <input type="password" name="password" placeholder="${t("password")}" required>
                <button type="submit">${t("login")}</button>
            </form>
            <p class="forgot"><a href="/forgot-password">\xBFOlvidaste tu contrase\xF1a?</a></p>
            <p style="text-align:center; margin-top:15px;">\xBFNo tienes cuenta? <a href="/register" style="color:#00ccff;">${t("register")}</a></p>
            <a href="/welcome" class="back">\u2190 ${t("home")}</a>
        </div>
        ${getCookieBannerScript()}
        ${getLegalFooter()}
        </body>
        </html>
        `, { headers: { "Content-Type": "text/html" } });
  }
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accountRateKey = email ? await hashKey(email) : "unknown";
  const accountAllowed = await checkActionRateLimit(env, "login-account", accountRateKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
  if (!accountAllowed) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:monospace;">
            <h2 style="color:#ff6666;">\u26D4 Demasiados intentos</h2>
            <p>Espera 10 minutos antes de intentar de nuevo.</p>
            <a href="/login" style="color:#00ccff;">Volver</a>
        </body></html>
        `, { status: 429, headers: { "Content-Type": "text/html" } });
  }
  if (!email || !password) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">\u274C Error</h2>
                <p>Email y contrase\xF1a son obligatorios.</p>
                <a href="/login" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { "Content-Type": "text/html" } });
  }
  const user = await authenticateUser(env, email, password);
  if (!user) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">\u274C Credenciales incorrectas</h2>
                <a href="/login" style="color:#00ccff;">Volver a intentar</a>
                <p style="margin-top:15px;"><a href="/forgot-password" style="color:#88ddff;font-size:0.9rem;">\xBFOlvidaste tu contrase\xF1a?</a></p>
            </div>
        </body></html>
        `, { status: 401, headers: { "Content-Type": "text/html" } });
  }
  if (user.otp_secret) {
    const tempToken = generateRandomHex(16);
    await env.STATS.put(`2fa_temp_${tempToken}`, user.email, { expirationTtl: 300 });
    const cookie2 = `2fa_temp=${tempToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=300; Path=/verify-2fa`;
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#ffaa00;">\u{1F510} Verificaci\xF3n en dos pasos</h2>
            <form action="/verify-2fa" method="POST">
                <input type="text" name="code" placeholder="C\xF3digo de 6 d\xEDgitos" style="padding:10px;border-radius:8px;border:none;font-size:18px;text-align:center;">
                <button type="submit" style="padding:10px 30px;background:#00ccff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Verificar</button>
            </form>
        </body></html>
        `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie2 } });
  }
  const token = await createSession(env, user);
  const cookie = `session_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">\u2705 Sesi\xF3n iniciada</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie } });
}
__name(handleLogin, "handleLogin");
async function handleVerify2FA(env, request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return new Response("No autorizado", { status: 401 });
  const match = cookie.match(/2fa_temp=([^;]+)/);
  if (!match) return new Response("No autorizado", { status: 401 });
  const tempToken = match[1];
  const email = await env.STATS.get(`2fa_temp_${tempToken}`);
  if (!email) return new Response("Token expirado", { status: 401 });
  const totpAllowed = await checkActionRateLimit(env, "login-2fa", await hashKey(email), TOTP_RATE_LIMIT, TOTP_RATE_WINDOW);
  if (!totpAllowed) return new Response("Demasiados c\xF3digos 2FA. Espera 10 minutos.", { status: 429 });
  const formData = await request.formData();
  const code = String(formData.get("code") || "").trim();
  const user = await getUserByEmail(env, email);
  if (!user) return new Response("Usuario no encontrado", { status: 404 });
  const valid = await verifyTOTP(env, user.otp_secret, code);
  if (!valid) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <h2 style="color:#ff6666;">\u274C C\xF3digo incorrecto</h2>
            <a href="/login" style="color:#00ccff;">Volver a intentar</a>
        </body></html>
        `, { status: 401, headers: { "Content-Type": "text/html" } });
  }
  await env.STATS.delete(`2fa_temp_${tempToken}`);
  await logUserAction(env, email, "login_2fa", { ip: getClientIP(request) });
  const sessionToken = await createSession(env, user);
  const cookieSession = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">\u2705 Verificaci\xF3n exitosa</h2>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookieSession } });
}
__name(handleVerify2FA, "handleVerify2FA");
async function handleLogout(env, request) {
  const auth = await requireAuth(env, request);
  if (auth) {
    await destroySession(env, auth.sessionToken);
  }
  const cookie = "session_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/";
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00ccff;">\u{1F44B} Sesi\xF3n cerrada</h2>
        <p>Has cerrado sesi\xF3n correctamente.</p>
        <a href="/welcome" style="color:#00ccff;">Volver al inicio</a>
    </body></html>
    `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie } });
}
__name(handleLogout, "handleLogout");
async function handleProfile(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) {
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">\u{1F512} Acceso denegado</h2>
                <p>Debes iniciar sesi\xF3n para ver tu perfil.</p>
                <a href="/login" style="color:#00ccff;">Iniciar sesi\xF3n</a>
            </div>
        </body></html>
        `, { status: 401, headers: { "Content-Type": "text/html" } });
  }
  const user = auth.user;
  const { compras } = await getCompras(env, 100, 0, { email: user.email });
  const suscripcion = await getSuscripcionUsuario(env, user.email);
  const referidos = await getReferidosDe(env, user.email);
  const comisiones = await getComisionesDe(env, user.email);
  const loginHistory = await getLoginHistory(env, user.email, 20);
  let suscripcionHtml = "<p>No tienes una suscripci\xF3n activa.</p>";
  let diasRestantes = 0;
  if (suscripcion && suscripcion.activa) {
    const fin = new Date(suscripcion.fecha_fin);
    const ahora = /* @__PURE__ */ new Date();
    diasRestantes = Math.max(0, Math.ceil((fin.getTime() - ahora.getTime()) / 864e5));
    const planNombre = SUSCRIPCION_PLANES[suscripcion.plan]?.name || suscripcion.plan;
    suscripcionHtml = `
            <div style="background:rgba(0,200,255,0.1);border-radius:15px;padding:15px;margin:10px 0;">
                <p><strong>Plan:</strong> ${planNombre}</p>
                <p><strong>D\xEDas restantes:</strong> ${diasRestantes} d\xEDas</p>
                <p><strong>Renovaci\xF3n autom\xE1tica:</strong> ${suscripcion.renovacion_automatica ? "\u2705 Activada" : "\u274C Desactivada"}</p>
                ${suscripcion.renovacion_automatica ? `<button onclick="cancelarRenovacion()" style="background:#ff4444;border:none;color:white;padding:8px 16px;border-radius:20px;cursor:pointer;">Cancelar renovaci\xF3n</button>` : ""}
                <button onclick="renovarSuscripcion()" style="background:#00ccff;border:none;color:#0a1a2b;padding:8px 16px;border-radius:20px;cursor:pointer;margin-left:10px;">Renovar +30 d\xEDas</button>
            </div>
        `;
  }
  let comprasHtml = "";
  if (compras.length === 0) {
    comprasHtml = '<p style="color:#88aacc;">No has comprado ning\xFAn DLC a\xFAn.</p>';
  } else {
    comprasHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Clave</th><th>Precio</th><th>Estado</th></tr></thead>
            <tbody>`;
    compras.forEach((c) => {
      const estado = c.estado || "Activa";
      const color = estado === "Activa" ? "#00cc88" : estado === "Expirada" ? "#ff6666" : "#ffaa00";
      comprasHtml += `<tr><td>${escapeHTML(new Date(c.fecha).toLocaleString())}</td><td>${escapeHTML(c.producto)}</td><td><code>${escapeHTML(c.clave)}</code></td><td>$${Number(c.precio || 0).toFixed(2)}</td><td style="color:${color};">${escapeHTML(estado)}</td></tr>`;
    });
    comprasHtml += `</tbody></table>`;
  }
  let referidosHtml = "<p>No has referido a nadie a\xFAn.</p>";
  if (referidos.length > 0) {
    referidosHtml = `<ul style="list-style:none;padding:0;">`;
    referidos.forEach((r) => {
      referidosHtml += `<li style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHTML(r.referido_id)} (Comisi\xF3n: $${Number(r.comision_ganada || 0).toFixed(2)})</li>`;
    });
    referidosHtml += `</ul><p><strong>Comisiones totales:</strong> $${Number(comisiones || 0).toFixed(2)}</p>`;
  }
  let loginHistoryHtml = '<p style="color:#88aacc;">No hay registros de sesi\xF3n a\xFAn.</p>';
  if (loginHistory.length > 0) {
    loginHistoryHtml = `<div style="max-height:300px;overflow-y:auto;background:rgba(0,0,0,0.2);border-radius:12px;padding:10px;">`;
    loginHistory.forEach((h) => {
      const accionLabel = {
        "login": "\u{1F513} Inicio de sesi\xF3n",
        "login_2fa": "\u{1F510} Inicio de sesi\xF3n (con 2FA)",
        "register": "\u2728 Registro de cuenta",
        "password_reset": "\u{1F511} Cambio de contrase\xF1a"
      }[h.action] || h.action;
      const fecha = new Date(h.timestamp).toLocaleString();
      const ip = h.details?.ip || "desconocida";
      loginHistoryHtml += `
                <div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:0.9rem;">
                    <span>${accionLabel}</span>
                    <span style="color:#88aacc;">${fecha}</span>
                    <span style="color:#88ccff;font-family:monospace;">IP: ${ip}</span>
                </div>
            `;
    });
    loginHistoryHtml += `</div>`;
  }
  const adminLink = user.role === "admin" ? `<p><a href="/admin" style="color:#00ccff;">\u{1F510} Ir al panel de administraci\xF3n</a></p>` : "";
  const darkMode = user.dark_mode ? "dark" : "light";
  const darkModeToggle = `<button id="darkModeBtn" onclick="toggleDarkMode()" style="background:none;border:1px solid #00ccff;color:#00ccff;padding:6px 12px;border-radius:20px;cursor:pointer;">${darkMode === "dark" ? "\u2600\uFE0F Modo claro" : "\u{1F319} Modo oscuro"}</button>`;
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Mi perfil - Ocean Hub</title>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding: 20px; display: flex; justify-content: center; }
        body.light-mode { background: #f0f8ff; color: #0a1a2b; }
        body.light-mode .card { background: rgba(0,0,0,0.04); border-color: #88bbdd; }
        body.light-mode .info-item { background: rgba(0,0,0,0.06); }
        .container { max-width: 900px; width: 100%; }
        .card { background: rgba(255,255,255,0.06); border-radius: 30px; padding: 30px; border: 1px solid rgba(0,200,255,0.2); }
        h1 { color: #00ccff; }
        .info { display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0; }
        .info-item { background: rgba(0,0,0,0.2); padding: 10px 20px; border-radius: 15px; }
        .info-item strong { color: #88ccff; }
        .btn { display: inline-block; padding: 10px 25px; background: #00ccff; color: #0a1a2b; border-radius: 40px; text-decoration: none; font-weight: bold; margin-top: 10px; }
        .btn:hover { background: #33ddff; }
        .btn-danger { background: #ff4444; color: white; }
        .btn-danger:hover { background: #ff6666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
        th { color: #88ccff; }
        code { background: #112233; padding: 2px 8px; border-radius: 6px; color: #00ddff; }
        .back { margin-top: 20px; display: inline-block; color: #00ccff; text-decoration: none; }
        .role-badge { background: rgba(0,200,255,0.2); padding: 4px 14px; border-radius: 20px; }
        .role-badge.admin { background: rgba(255,200,0,0.2); color: #ffcc00; }
        .section { margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
        .section h2 { color: #88ccff; }
        .referral-code { background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 30px; font-family: monospace; font-size: 1.2rem; display: inline-block; }
        .points-badge { background: rgba(255,215,0,0.2); color: #ffd700; padding: 4px 12px; border-radius: 20px; }
    </style>
    <script>
        function toggleDarkMode() {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            // dark = true cuando NO est\xE1 en light-mode
            fetch('/toggle-dark-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dark: !isLight })
            }).then(() => {
                const btn = document.getElementById('darkModeBtn');
                if (btn) btn.textContent = isLight ? '\u{1F319} Modo oscuro' : '\u2600\uFE0F Modo claro';
            }).catch(err => alert('Error al guardar preferencia: ' + err));
        }
        function copyReferral() {
            const code = document.getElementById('referralCode')?.textContent?.trim();
            if (!code) return;
            navigator.clipboard.writeText(code).then(() => {
                alert('\u2705 C\xF3digo de referido copiado: ' + code);
            }).catch(() => {
                prompt('Copia este c\xF3digo:', code);
            });
        }
        function cancelarRenovacion() {
            if (!confirm('\xBFCancelar renovaci\xF3n autom\xE1tica de tu suscripci\xF3n?')) return;
            fetch('/cancelar-renovacion', { method: 'POST' })
                .then(res => res.json())
                .then(data => { alert(data.message || data.error); location.reload(); })
                .catch(err => alert('Error: ' + err));
        }
        function renovarSuscripcion() {
            if (!confirm('\xBFRenovar suscripci\xF3n +30 d\xEDas?')) return;
            fetch('/renovar-suscripcion', { method: 'POST' })
                .then(res => res.json())
                .then(data => { alert(data.message || data.error); location.reload(); })
                .catch(err => alert('Error: ' + err));
        }
        function activar2FA() {
            if (!confirm('\xBFActivar 2FA?
Se generar\xE1 un secreto. Gu\xE1rdalo o escanea el QR.')) return;
            fetch('/activar-2fa', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.error) { alert('\u274C ' + data.error); return; }
                    const modal = document.getElementById('twofaModal');
                    const img = document.getElementById('twofaQr');
                    const secretEl = document.getElementById('twofaSecret');
                    if (img && data.qrUrl) img.src = data.qrUrl;
                    if (secretEl) secretEl.textContent = data.secret || '';
                    if (modal) modal.style.display = 'flex';
                })
                .catch(err => alert('Error: ' + err));
        }
        function desactivar2FA() {
            if (!confirm('\xBFDesactivar 2FA? Tu cuenta quedar\xE1 menos protegida.')) return;
            fetch('/desactivar-2fa', { method: 'POST' })
                .then(res => res.json())
                .then(data => { alert(data.message || data.error || 'Listo'); location.reload(); })
                .catch(err => alert('Error: ' + err));
        }
        function closeTwoFAModal() {
            document.getElementById('twofaModal').style.display = 'none';
            location.reload();
        }
        function copySecret() {
            const s = document.getElementById('twofaSecret')?.textContent?.trim();
            if (!s) return;
            navigator.clipboard.writeText(s).then(() => alert('\u2705 Secreto copiado')).catch(() => prompt('Copia el secreto:', s));
        }
        document.addEventListener('DOMContentLoaded', function() {
            const isDark = ${darkMode === "dark"};
            if (!isDark) document.body.classList.add('light-mode');
            const btn = document.getElementById('darkModeBtn');
            if (btn) btn.textContent = isDark ? '\u2600\uFE0F Modo claro' : '\u{1F319} Modo oscuro';
        });
    <\/script>
    </head>
    <body>
    <div class="container">
        <div class="card">
            <h1>\u{1F30A} Mi perfil <span class="points-badge">\u2B50 ${user.points || 0} puntos</span></h1>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                ${darkModeToggle}
            </div>
            <div class="info">
                <div class="info-item"><strong>Email:</strong> ${escapeHTML(user.email)}</div>
                <div class="info-item"><strong>Nombre:</strong> ${escapeHTML(user.name || "No especificado")}</div>
                <div class="info-item"><strong>Rol:</strong> <span class="role-badge ${user.role === "admin" ? "admin" : ""}">${escapeHTML(user.role)}</span></div>
                <div class="info-item"><strong>Miembro desde:</strong> ${new Date(user.created_at).toLocaleDateString()}</div>
                <div class="info-item"><strong>2FA:</strong> ${user.otp_secret ? "\u2705 Activado" : "\u274C Desactivado"} 
                    ${user.otp_secret ? `<button onclick="desactivar2FA()" style="background:#ff4444;border:none;color:white;padding:4px 12px;border-radius:20px;cursor:pointer;">Desactivar</button>` : `<button onclick="activar2FA()" style="background:#00ccff;border:none;color:#0a1a2b;padding:4px 12px;border-radius:20px;cursor:pointer;">Activar</button>`}
                </div>
            </div>
            <div>
                <p><strong>C\xF3digo de referido:</strong> <span class="referral-code" id="referralCode">${escapeHTML(user.referral_code)}</span>
                <button onclick="copyReferral()" style="margin-left:8px;background:#00ccff;border:none;color:#0a1a2b;padding:4px 12px;border-radius:20px;cursor:pointer;">\u{1F4CB} Copiar</button></p>
                <p style="font-size:0.9rem; color:#88aacc;">Comparte este c\xF3digo para que otros te referencien y ganes comisiones.</p>
            </div>
            ${adminLink}

            <div class="section">
                <h2>\u{1F4C5} Suscripci\xF3n</h2>
                ${suscripcionHtml}
            </div>

            <div class="section">
                <h2>\u{1F3AE} Mis DLCs comprados</h2>
                ${comprasHtml}
            </div>

            <div class="section">
                <h2>\u{1F517} Mis referidos</h2>
                ${referidosHtml}
            </div>

            <div class="section">
                <h2>\u{1F510} Historial de inicios de sesi\xF3n</h2>
                <p style="font-size:0.85rem;color:#88aacc;margin-bottom:10px;">Aqu\xED puedes ver desde qu\xE9 IP y cu\xE1ndo se accedi\xF3 a tu cuenta. Si ves algo sospechoso, cambia tu contrase\xF1a.</p>
                ${loginHistoryHtml}
            </div>

            <div style="margin-top:20px; display:flex; gap:15px; flex-wrap:wrap;">
                <a href="/dlc" class="btn">Ver todos los DLCs</a>
                <a href="/home" class="btn">Volver al inicio</a>
                <a href="/logout" class="btn btn-danger">Cerrar sesi\xF3n</a>
            </div>
        </div>
    </div>
    <div id="twofaModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;justify-content:center;align-items:center;padding:20px;">
      <div style="background:#1b3a5c;border-radius:24px;padding:28px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(0,200,255,0.3);">
        <h2 style="color:#00ccff;margin-top:0;">\u{1F4F1} Configura tu 2FA</h2>
        <p style="color:#aaddff;font-size:0.95rem;">Escanea el QR con Google Authenticator, Authy o similar.</p>
        <img id="twofaQr" src="" alt="QR 2FA" style="width:260px;height:260px;border-radius:16px;background:#fff;padding:8px;margin:12px 0;">
        <p style="font-size:0.9rem;">O introduce el secreto manualmente:</p>
        <code id="twofaSecret" style="display:block;background:#112233;padding:10px;border-radius:10px;word-break:break-all;color:#00ddff;"></code>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button onclick="copySecret()" style="background:#00ccff;border:none;color:#0a1a2b;padding:10px 18px;border-radius:30px;font-weight:bold;cursor:pointer;">\u{1F4CB} Copiar secreto</button>
          <button onclick="closeTwoFAModal()" style="background:rgba(255,255,255,0.1);border:1px solid #88ddff;color:#e0f0ff;padding:10px 18px;border-radius:30px;cursor:pointer;">Listo</button>
        </div>
      </div>
    </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { "Content-Type": "text/html" } });
}
__name(handleProfile, "handleProfile");
async function getPayPalAccessToken(env) {
  const clientId = env.PAYPAL_CLIENT_ID;
  const secret = env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("Credenciales de PayPal no configuradas");
  const auth = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${getPayPalApiUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  return data.access_token;
}
__name(getPayPalAccessToken, "getPayPalAccessToken");
async function createPayPalOrder(env, priceId, metadata = {}, couponCode = null) {
  const product = PRODUCTS[priceId];
  if (!product) throw new Error("Producto no encontrado");
  let price = product.price;
  let desc = product.name;
  if (couponCode) {
    const coupon = await getCoupon(env, couponCode);
    if (coupon.discountPercent) {
      price = price * (1 - coupon.discountPercent / 100);
    } else if (coupon.fixedAmount) {
      price = Math.max(0, price - coupon.fixedAmount);
    }
    desc += ` (cup\xF3n ${couponCode})`;
  }
  const accessToken = await getPayPalAccessToken(env);
  const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: price.toFixed(2) },
        description: desc,
        custom_id: JSON.stringify({
          tipo: "dlc",
          price_id: priceId,
          key: metadata.key || "",
          user_id: metadata.user_id || "",
          email: metadata.email || "",
          coupon: couponCode || null
        })
      }],
      application_context: {
        return_url: `${getBaseUrl(env)}/paypal/capture`,
        cancel_url: `${getBaseUrl(env)}/shop/cancel`
      }
    })
  });
  return await response.json();
}
__name(createPayPalOrder, "createPayPalOrder");
async function createPayPalOrderSuscripcion(env, plan, email, couponCode = null) {
  const planData = SUSCRIPCION_PLANES[plan];
  if (!planData) throw new Error("Plan no v\xE1lido");
  let price = planData.price;
  if (couponCode) {
    const coupon = await getCoupon(env, couponCode);
    if (coupon.discountPercent) {
      price = price * (1 - coupon.discountPercent / 100);
    } else if (coupon.fixedAmount) {
      price = Math.max(0, price - coupon.fixedAmount);
    }
  }
  const accessToken = await getPayPalAccessToken(env);
  const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: price.toFixed(2) },
        description: `Suscripci\xF3n ${planData.name}`,
        custom_id: JSON.stringify({
          tipo: "suscripcion",
          plan,
          email,
          coupon: couponCode || null
        })
      }],
      application_context: {
        return_url: `${getBaseUrl(env)}/paypal/capture`,
        cancel_url: `${getBaseUrl(env)}/shop/cancel`
      }
    })
  });
  return await response.json();
}
__name(createPayPalOrderSuscripcion, "createPayPalOrderSuscripcion");
async function capturePayPalOrder(env, orderId) {
  const accessToken = await getPayPalAccessToken(env);
  const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  return await response.json();
}
__name(capturePayPalOrder, "capturePayPalOrder");
// ==================================================
// [ AIR FLOW — OCEAN HUB AI ]
// Gemini principal + OpenRouter respaldo
// ==================================================
const AIR_FLOW_MAX_MESSAGES = 12;
const AIR_FLOW_MAX_MESSAGE_CHARS = 6000;
const AIR_FLOW_MAX_TOTAL_CHARS = 30000;
const AIR_FLOW_RATE_LIMIT = 20;
const AIR_FLOW_RATE_WINDOW = 60;
const AIR_FLOW_HISTORY_LIMIT = 20;
const AIR_FLOW_MAX_IMAGE_BYTES = 3000000;

const AIR_FLOW_MODE_PROMPTS = {
  General: `Eres Air Flow, el asistente de IA integrado en Ocean Hub. Responde principalmente en español, con tono amigable, claro y natural. No inventes acciones que no realizaste. No reveles claves, contraseñas, tokens, secretos, sesiones ni datos privados.`,
  Programación: `Eres Air Flow, especialista en programación dentro de Ocean Hub. Ayuda con JavaScript, HTML, CSS, Cloudflare Workers, APIs y Roblox Lua. Da código seguro, claro y explicado. No inventes que ejecutaste o desplegaste código si no lo hiciste. Nunca reveles secretos ni credenciales.`,
  "Ocean Hub": `Eres Air Flow, el asistente integrado de Ocean Hub. Puedes explicar las funciones públicas de Ocean Hub, sus secciones y el uso general de la plataforma. No tienes permiso para revelar secretos, claves API, contraseñas, tokens, sesiones ni información privada de otros usuarios.`,
  Estudio: `Eres Air Flow en modo Estudio. Explica temas paso a paso con lenguaje apropiado para estudiantes, ejemplos sencillos y respuestas claras. No reveles secretos ni datos privados.`
};

function airFlowSafeMode(mode) {
  return AIR_FLOW_MODE_PROMPTS[mode] ? mode : "General";
}

function airFlowNormalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-AIR_FLOW_MAX_MESSAGES).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content || "").slice(0, AIR_FLOW_MAX_MESSAGE_CHARS)
  })).filter((m) => m.content.trim());
}

async function airFlowHistoryKey(email) {
  return `airflow_history_${await hashKey(email)}`;
}

async function getAirFlowHistory(env, email) {
  try {
    const history = await env.STATS.get(await airFlowHistoryKey(email), "json");
    return Array.isArray(history) ? history.slice(0, AIR_FLOW_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

async function saveAirFlowConversation(env, email, conversation) {
  return await withKVLock(env, `airflow_history:${email}`, async () => {
    const all = await getAirFlowHistory(env, email);
    const idx = all.findIndex((c) => c.id === conversation.id);
    const cleanMessages = airFlowNormalizeMessages(conversation.messages).map((m) => ({ role: m.role, content: m.content }));
    const item = {
      id: String(conversation.id || generateRandomHex(12)).slice(0, 80),
      title: String(conversation.title || "Nueva conversación").slice(0, 100),
      mode: airFlowSafeMode(conversation.mode),
      updatedAt: new Date().toISOString(),
      messages: cleanMessages
    };
    if (idx >= 0) all.splice(idx, 1);
    all.unshift(item);
    while (all.length > AIR_FLOW_HISTORY_LIMIT) all.pop();
    await env.STATS.put(await airFlowHistoryKey(email), JSON.stringify(all));
    return item;
  });
}

async function checkAirFlowRateLimit(env, request, email) {
  const ip = getClientIP(request) || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / AIR_FLOW_RATE_WINDOW);
  const rawKey = `airflow_rl_${email}_${ip}_${bucket}`;
  return await withKVLock(env, `airflow_rl:${email}:${ip}:${bucket}`, async () => {
    const current = Number(await env.STATS.get(rawKey) || "0");
    if (current >= AIR_FLOW_RATE_LIMIT) return false;
    await env.STATS.put(rawKey, String(current + 1), { expirationTtl: AIR_FLOW_RATE_WINDOW + 10 });
    return true;
  });
}

function airFlowNormalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, 2).map((a) => ({
    type: a?.type === "image" ? "image" : "file",
    name: String(a?.name || "archivo").slice(0, 120),
    mimeType: String(a?.mimeType || "application/octet-stream").slice(0, 100),
    data: String(a?.data || "").slice(0, 4500000),
    content: String(a?.content || "").slice(0, 12000)
  })).filter((a) => a.data || a.content);
}

function airFlowBuildGeminiContents(messages, attachments) {
  const clean = airFlowNormalizeMessages(messages);
  const result = clean.map(airFlowMessageToGemini);
  const images = airFlowNormalizeAttachments(attachments).filter((a) => a.type === "image" && a.data.startsWith("data:image/"));
  const lastUser = [...result].reverse().find((m) => m.role === "user");
  if (lastUser && images.length) {
    for (const image of images) {
      const comma = image.data.indexOf(",");
      if (comma > 0) {
        lastUser.parts.push({ inlineData: { mimeType: image.mimeType || image.data.slice(5, comma).split(";")[0], data: image.data.slice(comma + 1) } });
      }
    }
  }
  return result;
}

function airFlowBuildOpenRouterMessages(messages, attachments) {
  const clean = airFlowNormalizeMessages(messages);
  const result = clean.map(airFlowOpenRouterMessage);
  const images = airFlowNormalizeAttachments(attachments).filter((a) => a.type === "image" && a.data.startsWith("data:image/"));
  const lastUser = [...result].reverse().find((m) => m.role === "user");
  if (lastUser && images.length) {
    const text = String(lastUser.content || "");
    lastUser.content = [{ type: "text", text }, ...images.map((image) => ({ type: "image_url", image_url: { url: image.data } }))];
  }
  return result;
}

function airFlowMessageToGemini(message) {
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  };
}

async function callGeminiAirFlow(env, messages, mode, attachments = []) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_NOT_CONFIGURED");
  const model = String(env.GEMINI_MODEL || "gemini-3.8-flash").trim();
  const contents = airFlowBuildGeminiContents(messages, attachments);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AIR_FLOW_MODE_PROMPTS[airFlowSafeMode(mode)] }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1600
      }
    })
  });
  if (!response.ok) {
    throw new Error(`GEMINI_HTTP_${response.status}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim();
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return { text, provider: "Gemini", model };
}

function airFlowOpenRouterMessage(message) {
  return { role: message.role, content: message.content };
}

async function callOpenRouterAirFlow(env, messages, mode, attachments = []) {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_NOT_CONFIGURED");
  const model = String(env.OPENROUTER_MODEL || "openrouter/free").trim();
  const system = { role: "system", content: AIR_FLOW_MODE_PROMPTS[airFlowSafeMode(mode)] };
  const clean = airFlowBuildOpenRouterMessages(messages, attachments);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      ...(env.BASE_URL ? { "HTTP-Referer": String(env.BASE_URL) } : {}),
      "X-Title": "Ocean Hub - Air Flow"
    },
    body: JSON.stringify({
      model,
      messages: [system, ...clean],
      temperature: 0.7,
      max_tokens: 1600
    })
  });
  if (!response.ok) {
    throw new Error(`OPENROUTER_HTTP_${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => part?.text || "").join("").trim()
    : String(content || "").trim();
  if (!text) throw new Error("OPENROUTER_EMPTY_RESPONSE");
  return { text, provider: "OpenRouter", model };
}

function airFlowTitleFromMessage(content) {
  const cleaned = String(content || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Nueva conversación";
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}

async function handleAirFlow(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return Response.redirect(`${new URL(request.url).origin}/welcome`, 302);
  const userName = escapeHTML(auth.user?.nombre || auth.user?.name || (auth.user?.email || "Usuario").split("@")[0]);
  return new Response(`
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>✨ Air Flow · Ocean Hub</title>
<style>
*{box-sizing:border-box}html,body{height:100%;margin:0}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#02050b;color:#eef7ff;overflow:hidden}.app{height:100%;display:flex;position:relative;background:radial-gradient(circle at 50% 15%,rgba(0,153,255,.11),transparent 34%),radial-gradient(circle at 50% 100%,rgba(89,34,255,.11),transparent 40%),#02050b}.glow{position:absolute;inset:auto -20% -30%;height:45%;background:radial-gradient(ellipse at 50% 0%,rgba(0,210,255,.12),transparent 60%),linear-gradient(180deg,transparent,rgba(0,130,255,.04));pointer-events:none}.sidebar{width:290px;border-right:1px solid rgba(120,170,255,.13);background:rgba(3,8,16,.82);backdrop-filter:blur(22px);display:flex;flex-direction:column;padding:18px;z-index:4}.brand{display:flex;align-items:center;gap:12px;margin-bottom:14px}.brand-logo{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#05111f 30%,#081b32 60%,#10102a 100%);border:1px solid #2a6bff;box-shadow:0 0 28px rgba(30,120,255,.35)}.brand-title{font-size:20px;font-weight:800}.brand-title span{background:linear-gradient(90deg,#63dfff,#785dff);-webkit-background-clip:text;background-clip:text;color:transparent}.new-chat{width:100%;border:1px solid rgba(87,132,255,.35);background:linear-gradient(135deg,rgba(30,91,255,.16),rgba(0,210,255,.08));color:#fff;border-radius:14px;padding:12px 14px;font-weight:700;cursor:pointer}.history{margin-top:18px;overflow:auto;display:flex;flex-direction:column;gap:8px}.history-item{border:1px solid transparent;background:rgba(255,255,255,.03);color:#b9cae0;border-radius:12px;padding:11px 12px;text-align:left;cursor:pointer}.history-item:hover,.history-item.active{border-color:rgba(80,170,255,.28);background:rgba(64,118,255,.09);color:#fff}.history-item small{display:block;margin-top:4px;opacity:.55;font-size:11px}.side-footer{margin-top:auto;color:#6f829f;font-size:11px;line-height:1.5}.main{min-width:0;flex:1;display:flex;flex-direction:column;position:relative}.topbar{height:74px;border-bottom:1px solid rgba(120,170,255,.10);display:flex;align-items:center;padding:0 20px;gap:14px;background:rgba(2,5,11,.58);backdrop-filter:blur(20px);z-index:3}.icon-btn{width:42px;height:42px;border-radius:12px;border:1px solid rgba(120,170,255,.15);background:rgba(255,255,255,.03);color:#dcecff;font-size:19px;cursor:pointer}.air-title{font-size:19px;font-weight:800}.air-title b{background:linear-gradient(90deg,#f7fbff 0%,#73e2ff 42%,#7d6aff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.air-subtitle{font-size:11px;color:#7890ad;margin-top:2px}.top-actions{margin-left:auto;display:flex;gap:8px;align-items:center}.status{padding:7px 10px;border:1px solid rgba(53,255,170,.16);color:#88ffc7;background:rgba(33,190,120,.06);border-radius:999px;font-size:11px}.hero{flex:1;min-height:0;position:relative;display:flex;flex-direction:column}.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 24px 150px;text-align:center}.logo-ring{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;position:relative;margin-bottom:24px;background:radial-gradient(circle,rgba(0,0,0,.96) 32%,rgba(31,88,255,.13) 56%,rgba(0,229,255,.08) 70%,transparent 72%);border:1px solid rgba(75,185,255,.40);box-shadow:0 0 50px rgba(36,148,255,.16),inset 0 0 40px rgba(90,70,255,.12);animation:float 5s ease-in-out infinite}.logo-mark{font-size:54px;filter:drop-shadow(0 0 17px rgba(0,206,255,.45))}.welcome h1{font-size:clamp(34px,5vw,60px);line-height:1.05;margin:0;font-weight:700;letter-spacing:-2px}.welcome h1 span{background:linear-gradient(90deg,#fff 0%,#7bdfff 48%,#8064ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.tagline{margin:20px 0 28px;letter-spacing:5px;font-size:12px;color:#8aa7c8;font-weight:700}.suggestions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;max-width:900px}.suggestion{border:1px solid rgba(103,146,255,.22);background:rgba(255,255,255,.035);color:#b8c8df;border-radius:999px;padding:10px 14px;cursor:pointer}.suggestion:hover{border-color:#3d8fff;color:#fff;background:rgba(61,143,255,.08)}.chat{flex:1;overflow:auto;padding:34px 22px 180px;display:none}.message-wrap{max-width:930px;margin:0 auto 20px;display:flex;gap:12px}.message-wrap.user{justify-content:flex-end}.bubble{max-width:min(82%,760px);padding:14px 16px;border-radius:18px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.assistant .bubble{background:rgba(13,25,43,.86);border:1px solid rgba(89,145,255,.13);box-shadow:0 10px 35px rgba(0,0,0,.16)}.user .bubble{background:linear-gradient(135deg,#1646c8,#31308f);border:1px solid rgba(130,175,255,.25)}.avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:0 0 34px;background:radial-gradient(circle,#0d1f38,#0a0922);border:1px solid rgba(70,161,255,.32)}.msg-tools{display:flex;gap:6px;margin-top:8px}.msg-tools button{border:0;background:transparent;color:#6f85a1;font-size:12px;cursor:pointer;padding:2px 4px}.msg-tools button:hover{color:#fff}.code{position:relative;background:#050a12;border:1px solid rgba(93,139,255,.16);border-radius:12px;padding:14px;margin:10px 0;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}.code button{position:absolute;top:8px;right:8px;border:1px solid rgba(130,170,255,.18);background:#0d1624;color:#dce8ff;border-radius:8px;padding:5px 8px;cursor:pointer}.input-dock{position:absolute;left:0;right:0;bottom:0;padding:20px 20px 24px;background:linear-gradient(180deg,transparent 0%,rgba(2,5,11,.72) 24%,rgba(2,5,11,.97) 55%);z-index:3}.input-shell{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:9px 10px 9px 14px;border-radius:28px;border:1px solid rgba(89,121,255,.54);background:rgba(7,13,25,.92);box-shadow:0 0 34px rgba(44,84,255,.10),inset 0 0 35px rgba(16,40,70,.16)}.input-shell textarea{flex:1;resize:none;max-height:150px;min-height:46px;border:0;outline:0;background:transparent;color:#fff;font:inherit;padding:12px 2px}.input-shell textarea::placeholder{color:#6c7f98}.round{width:46px;height:46px;border-radius:50%;border:1px solid rgba(92,139,255,.30);background:#0a1424;color:#ddecff;cursor:pointer;font-size:18px}.send{background:radial-gradient(circle at 35% 30%,#36e7ff,#244aff 52%,#10132c);box-shadow:0 0 28px rgba(37,100,255,.35);font-size:20px}.send:disabled{opacity:.5;cursor:default}.bottom-note{text-align:center;color:#58708e;font-size:10px;margin-top:8px}.thinking{display:inline-flex;gap:4px;align-items:center}.thinking i{width:6px;height:6px;border-radius:50%;background:#79dfff;animation:pulse 1s infinite}.thinking i:nth-child(2){animation-delay:.16s}.thinking i:nth-child(3){animation-delay:.32s}.overlay{display:none;position:absolute;inset:0;background:rgba(0,0,0,.52);z-index:5}.mode-menu{position:absolute;top:64px;left:20px;background:#07101c;border:1px solid rgba(89,145,255,.18);border-radius:15px;min-width:210px;padding:8px;box-shadow:0 20px 60px rgba(0,0,0,.45);display:none;z-index:8}.mode-menu button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;background:transparent;color:#b6c7df;border-radius:10px;cursor:pointer}.mode-menu button:hover,.mode-menu button.active{background:rgba(70,127,255,.11);color:#fff}.empty-history{padding:14px;color:#637a97;font-size:12px;text-align:center}.mobile-side{display:none}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes pulse{0%,80%,100%{transform:scale(.65);opacity:.4}40%{transform:scale(1);opacity:1}}@media(max-width:800px){.sidebar{position:absolute;left:0;top:0;bottom:0;transform:translateX(-102%);transition:.25s;width:290px;box-shadow:30px 0 60px rgba(0,0,0,.45)}.sidebar.open{transform:translateX(0)}.overlay.show{display:block}.topbar{padding:0 12px}.status{display:none}.welcome{padding:15px 18px 155px}.welcome h1{letter-spacing:-1px}.logo-ring{width:112px;height:112px}.logo-mark{font-size:45px}.tagline{letter-spacing:3px}.suggestion{font-size:12px}.bubble{max-width:90%}.chat{padding-left:12px;padding-right:12px}.input-dock{padding:14px 10px 16px}.input-shell{padding-left:10px}.side-footer{padding-bottom:20px}}
</style>
</head>
<body>
<div class="app">
  <div class="glow"></div>
  <div class="overlay" id="overlay"></div>
  <aside class="sidebar" id="sidebar">
    <div class="brand"><div class="brand-logo">✦</div><div><div class="brand-title">Air <span>Flow</span></div><div style="font-size:11px;color:#6983a3">Ocean Hub AI</div></div></div>
    <button class="new-chat" id="newChat">＋ Nuevo chat</button>
    <div class="history" id="history"><div class="empty-history">Tus conversaciones aparecerán aquí.</div></div>
    <div class="side-footer">Las respuestas de IA pueden contener errores. No compartas datos sensibles.</div>
  </aside>
  <main class="main">
    <div class="topbar">
      <button class="icon-btn" id="menuBtn" aria-label="Menú">☰</button>
      <div style="position:relative"><button class="icon-btn" id="modeBtn" aria-label="Modo">✦</button><div class="mode-menu" id="modeMenu">
        <button data-mode="General" class="active">🌊 General</button>
        <button data-mode="Programación">💻 Programación</button>
        <button data-mode="Ocean Hub">🌊 Ocean Hub</button>
        <button data-mode="Estudio">📚 Estudio</button>
      </div></div>
      <div><div class="air-title">Air <b>Flow</b></div><div class="air-subtitle" id="modeLabel">Tu asistente de IA · General</div></div>
      <div class="top-actions"><div class="status" id="status">● Conectando</div><button class="icon-btn" id="homeBtn" title="Volver a Ocean Hub">⌂</button></div>
    </div>
    <section class="hero">
      <div class="welcome" id="welcome">
        <div class="logo-ring"><div class="logo-mark">➤</div></div>
        <h1>Pregunta lo que quieras, <span>${userName}</span></h1>
        <div class="tagline">TU DESTINO. TU RITMO. TU AIR FLOW.</div>
        <div class="suggestions">
          <button class="suggestion">💡 Dame una idea para mi proyecto</button>
          <button class="suggestion">💻 Ayúdame con código</button>
          <button class="suggestion">🌊 ¿Qué puedo hacer en Ocean Hub?</button>
          <button class="suggestion">📚 Explícame algo fácil</button>
        </div>
      </div>
      <div class="chat" id="chat"></div>
      <div class="input-dock">
        <div class="input-shell">
          <input id="fileInput" type="file" accept="image/*,.txt,.md,.json,.js,.html,.css,.lua" hidden>
          <button class="round" id="attachBtn" title="Adjuntar archivo">＋</button>
          <textarea id="input" rows="1" placeholder="Pregunta lo que quieras..."></textarea>
          <button class="round" id="micBtn" title="Voz">🎤</button>
          <button class="round send" id="sendBtn" title="Enviar">✦</button>
        </div>
        <div class="bottom-note">Air Flow usa Gemini y OpenRouter desde el servidor de Ocean Hub. Nunca compartas contraseñas ni claves.</div>
      </div>
    </section>
  </main>
</div>
<script>
(() => {
  const state = { messages: [], mode: 'General', conversationId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), attached: null, sending: false };
  const el = (id) => document.getElementById(id);
  const welcome = el('welcome'), chat = el('chat'), input = el('input'), sendBtn = el('sendBtn'), history = el('history'), sidebar = el('sidebar'), overlay = el('overlay'), status = el('status'), modeBtn = el('modeBtn'), modeMenu = el('modeMenu'), modeLabel = el('modeLabel');
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const renderText = (s) => {
    const escaped = escapeHtml(s);
const fence = String.fromCharCode(96).repeat(3);
    const fencedRe = new RegExp(fence + '([\\s\\S]*?)' + fence, 'g');
    return escaped.replace(fencedRe, (_, code) => '<div class="code"><button data-copy="' + encodeURIComponent(code) + '">📋 Copiar</button><pre>' + code + '</pre></div>').replace(/\n/g, '<br>');
  };
  function openChat(){welcome.style.display='none';chat.style.display='block'}
  function closeSide(){sidebar.classList.remove('open');overlay.classList.remove('show')}
  function scrollChat(){chat.scrollTop=chat.scrollHeight}
  function addMessage(role, content, opts={}){
    openChat();
    const wrap=document.createElement('div');wrap.className='message-wrap ' + role;
    const avatar=role==='assistant'?'<div class="avatar">✦</div>':'';
    const bubble=document.createElement('div');bubble.className='bubble';bubble.innerHTML=renderText(content);
    wrap.innerHTML=role==='assistant'?avatar+'<div><div class="bubble"></div><div class="msg-tools"><button data-action="copy">📋 Copiar</button><button data-action="speak">🔊 Leer</button><button data-action="regen">🔄 Regenerar</button></div></div>':'<div class="bubble"></div>';
    wrap.querySelector('.bubble').innerHTML=renderText(content);
    wrap.dataset.index=String(state.messages.length);
    if(opts.thinking){wrap.querySelector('.bubble').innerHTML='<span class="thinking"><i></i><i></i><i></i></span>';}
    chat.appendChild(wrap);scrollChat();return wrap;
  }
  async function loadHistory(){
    try{const r=await fetch('/air-flow/api/history');const d=await r.json();history.innerHTML='';if(!Array.isArray(d.history)||!d.history.length){history.innerHTML='<div class="empty-history">Tus conversaciones aparecerán aquí.</div>';return}d.history.forEach(item=>{const b=document.createElement('button');b.className='history-item';b.innerHTML=escapeHtml(item.title)+'<small>'+escapeHtml(item.mode || 'General')+'</small>';b.onclick=()=>openConversation(item);history.appendChild(b)})}catch{history.innerHTML='<div class="empty-history">No se pudo cargar el historial.</div>'}}
  function resetChat(){state.messages=[];state.conversationId=crypto.randomUUID?crypto.randomUUID():String(Date.now());state.attached=null;chat.innerHTML='';welcome.style.display='flex';chat.style.display='none';input.value='';input.placeholder='Pregunta lo que quieras...';closeSide()}
  function openConversation(item){state.messages=Array.isArray(item.messages)?item.messages.slice(-12):[];state.conversationId=item.id || (crypto.randomUUID?crypto.randomUUID():String(Date.now()));state.mode=item.mode || 'General';setMode(state.mode);chat.innerHTML='';state.messages.forEach(m=>addMessage(m.role,m.content));openChat();closeSide()}
  function setMode(mode){state.mode=mode;modeLabel.textContent='Tu asistente de IA · '+mode;modeMenu.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));modeMenu.style.display='none'}
  async function health(){try{const r=await fetch('/air-flow/api/health');const d=await r.json();if(d.gemini||d.openrouter){status.textContent='● Air Flow Online';status.style.color='#88ffc7'}else{status.textContent='● IA no configurada';status.style.color='#ffbf69'}}catch{status.textContent='● Estado desconocido'}}
  async function requestAnswer(){
    state.sending=true;sendBtn.disabled=true;
    const thinking=addMessage('assistant','',{thinking:true});
    try{
      const attachments=state.attached ? [state.attached] : [];
      const r=await fetch('/air-flow/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:state.conversationId,mode:state.mode,messages:state.messages,attachments})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error || 'No se pudo completar la solicitud');
      thinking.querySelector('.bubble').innerHTML=renderText(d.text||'No recibí una respuesta.');
      state.messages.push({role:'assistant',content:d.text||''});
      status.textContent='● '+(d.provider || 'Air Flow')+' Online';
      scrollChat();loadHistory();
    }catch(e){thinking.querySelector('.bubble').innerHTML=escapeHtml(e.message || 'No se pudo completar la solicitud.');}
    finally{state.attached=null;state.sending=false;sendBtn.disabled=false;input.placeholder='Pregunta lo que quieras...';scrollChat()}
  }
  async function send(){
    const text=input.value.trim(); if(!text || state.sending)return;
    const payloadText=state.attached?.type==='file' ? text+'\n\n[Archivo adjunto: '+state.attached.name+']\n'+state.attached.content : text;
    const displayText=state.attached?.type==='image' ? text+'\n\n[Imagen adjunta: '+state.attached.name+']' : payloadText;
    state.messages.push({role:'user',content:displayText});
    addMessage('user',displayText);input.value='';input.style.height='auto';
    await requestAnswer();
  }
  function fillSuggestion(text){input.value=text;input.focus();input.dispatchEvent(new Event('input'))}
  el('menuBtn').onclick=()=>{sidebar.classList.add('open');overlay.classList.add('show')};overlay.onclick=closeSide;el('newChat').onclick=resetChat;el('homeBtn').onclick=()=>location.href='/home';modeBtn.onclick=()=>{modeMenu.style.display=modeMenu.style.display==='block'?'none':'block'};
  modeMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  document.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>fillSuggestion(b.textContent.replace(/^\S+\s/,'').trim()));
  sendBtn.onclick=send;
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px'});
  el('attachBtn').onclick=()=>el('fileInput').click();
  el('fileInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>3000000){alert('El archivo supera 3 MB.');e.target.value='';return}if(file.type.startsWith('image/')){const reader=new FileReader();reader.onload=()=>{state.attached={type:'image',name:file.name,mimeType:file.type,data:String(reader.result)};input.placeholder='Describe qué quieres analizar de la imagen...';};reader.readAsDataURL(file)}else{const text=await file.text();state.attached={type:'file',name:file.name,mimeType:file.type || 'text/plain',content:text.slice(0,12000)};input.placeholder='Escribe qué quieres hacer con el archivo...'}};
  el('micBtn').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('El reconocimiento de voz no está disponible en este navegador.');return}const rec=new SR();rec.lang='es-ES';rec.interimResults=false;rec.onresult=e=>{input.value=(input.value+' '+e.results[0][0].transcript).trim();input.dispatchEvent(new Event('input'));};rec.start()};
  chat.addEventListener('click',async e=>{const copy=e.target.closest('[data-action="copy"],[data-copy]');if(copy){let text='';if(copy.dataset.copy)text=decodeURIComponent(copy.dataset.copy);else{text=copy.parentElement.parentElement.querySelector('.bubble')?.innerText||''}try{await navigator.clipboard.writeText(text);copy.textContent='✓ Copiado';setTimeout(()=>copy.textContent='📋 Copiar',1200)}catch{}}const speak=e.target.closest('[data-action="speak"]');if(speak){const box=speak.parentElement.previousElementSibling;if(box&&('speechSynthesis' in window)){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(box.innerText))}}const regen=e.target.closest('[data-action="regen"]');if(regen&&!state.sending){const idx=[...chat.querySelectorAll('.message-wrap')].indexOf(regen.closest('.message-wrap'));if(idx>=0&&state.messages[idx]?.role==='assistant'){state.messages=state.messages.slice(0,idx);chat.innerHTML='';state.messages.forEach(m=>addMessage(m.role,m.content));await requestAnswer()}}});
  loadHistory();health();
})();
</script>
</body>
</html>`, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

async function handleAirFlowChat(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 401);
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);
  if (!(await checkAirFlowRateLimit(env, request, auth.user.email))) {
    return jsonResponse({ error: "Has enviado demasiados mensajes. Espera un momento y vuelve a intentarlo." }, 429);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Solicitud inválida" }, 400); }
  const mode = airFlowSafeMode(body?.mode);
  const messages = airFlowNormalizeMessages(body?.messages);
  const attachments = airFlowNormalizeAttachments(body?.attachments);
  const serialized = JSON.stringify({ messages, attachments });
  if (!messages.length) return jsonResponse({ error: "Escribe un mensaje primero." }, 400);
  if (serialized.length > AIR_FLOW_MAX_TOTAL_CHARS + 4600000) return jsonResponse({ error: "La solicitud es demasiado grande. Usa un archivo más pequeño." }, 413);
  for (const attachment of attachments) {
    if (attachment.type === "image") {
      if (!attachment.data.startsWith("data:image/")) return jsonResponse({ error: "Imagen adjunta inválida." }, 400);
      if (attachment.data.length > 4300000) return jsonResponse({ error: "La imagen es demasiado grande." }, 413);
    } else if (attachment.content.length > 12000) {
      return jsonResponse({ error: "El archivo de texto es demasiado grande." }, 413);
    }
  }

  let result = null;
  let providerError = null;
  try {
    result = await callGeminiAirFlow(env, messages, mode, attachments);
  } catch (e) {
    providerError = String(e?.message || "Gemini error").slice(0, 120);
    try {
      result = await callOpenRouterAirFlow(env, messages, mode, attachments);
    } catch (fallbackError) {
      console.error("Air Flow providers unavailable", { primary: providerError, fallback: String(fallbackError?.message || "OpenRouter error").slice(0, 120) });
      return jsonResponse({ error: "Air Flow no está disponible ahora mismo. Revisa la configuración de tus proveedores de IA." }, 503);
    }
  }

  const conversationId = String(body?.conversationId || generateRandomHex(12)).slice(0, 80);
  const firstUser = messages.find((m) => m.role === "user");
  try {
    await saveAirFlowConversation(env, auth.user.email, {
      id: conversationId,
      title: airFlowTitleFromMessage(firstUser?.content || "Nueva conversación"),
      mode,
      messages: [...messages, { role: "assistant", content: result.text }]
    });
  } catch (e) {
    console.error("Air Flow history save failed", String(e?.message || e).slice(0, 160));
  }
  return jsonResponse({ text: result.text, provider: result.provider, model: result.model });
}

async function handleAirFlowHistory(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 401);
  const history = await getAirFlowHistory(env, auth.user.email);
  return jsonResponse({ history: history.map((item) => ({ id: item.id, title: item.title, mode: item.mode, updatedAt: item.updatedAt, messages: item.messages })) });
}

async function handleAirFlowHealth(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 401);
  return jsonResponse({
    online: Boolean(env.GEMINI_API_KEY || env.OPENROUTER_API_KEY),
    gemini: Boolean(env.GEMINI_API_KEY),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    geminiModel: String(env.GEMINI_MODEL || "gemini-3.8-flash"),
    openrouterModel: String(env.OPENROUTER_MODEL || "openrouter/free")
  });
}

async function handleHome(env) {
  const stats = await getStats(env) || {};
  const dynamicKeys = await getDynamicKeys(env) || {};
  let totalClavesDisponibles = 0;
  let valorTotalUSD = 0;
  const PRECIO_PROMEDIO = 5;
  for (let hash in dynamicKeys) {
    const k = dynamicKeys[hash];
    if (!k.blocked) {
      totalClavesDisponibles++;
      valorTotalUSD += PRECIO_PROMEDIO;
    }
  }
  for (let k of STATIC_KEYS) {
    if (!k.blocked && k.type !== "honeypot") {
      totalClavesDisponibles++;
      valorTotalUSD += PRECIO_PROMEDIO;
    }
  }
  const monedas = ["EUR", "GBP", "MXN", "ARS", "COP", "BRL"];
  const valoresMoneda = {};
  for (let mon of monedas) {
    const val = await convertirMoneda(valorTotalUSD, mon);
    if (val !== null) valoresMoneda[mon] = val.toFixed(2);
  }
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F30A} Ocean Hub - Inicio</title>
    <style>
        body { background: linear-gradient(145deg, #0a1a2b 0%, #1b3a5c 100%); color: #e0f0ff; font-family: 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; margin: 0; }
        h1 { font-size: 4rem; text-shadow: 0 0 20px #00ccff; }
        .cards { display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; max-width: 1000px; }
        .card { background: rgba(255,255,255,0.08); border-radius: 30px; padding: 30px; width: 200px; text-align: center; border: 1px solid rgba(0,200,255,0.2); transition: 0.3s; }
        .card:hover { transform: scale(1.05); box-shadow: 0 0 40px rgba(0,200,255,0.2); }
        .card a { color: #00ccff; text-decoration: none; font-size: 1.5rem; font-weight: bold; }
        .air-flow-card { border-color: rgba(100,120,255,0.45); background: linear-gradient(145deg, rgba(33,77,190,0.15), rgba(100,55,220,0.08)); }
        .air-flow-card a { background: linear-gradient(90deg,#70e7ff,#7e6cff); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .card p { color: #88aacc; margin-top: 10px; }
        .user-actions { margin-top: 20px; display: flex; gap: 15px; }
        .user-actions a { color: #00ccff; text-decoration: none; font-weight: bold; }
        .user-actions a:hover { text-decoration: underline; }
        .global-stats { background: rgba(0,0,0,0.3); border-radius: 20px; padding: 20px; margin: 30px 0; width: 100%; max-width: 800px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
        .global-stats .stat { text-align: center; padding: 10px 20px; }
        .global-stats .stat .num { font-size: 2rem; font-weight: bold; color: #00ccff; }
        .global-stats .stat .label { opacity: 0.7; font-size: 0.9rem; }
        .global-stats .stat .moneda { color: #ffcc00; }
    </style>
    </head>
    <body>
        <h1>\u{1F30A} Ocean Hub</h1>
        <p style="font-size:1.2rem; margin-bottom: 20px;">Elige tu destino</p>
        
        <div class="global-stats">
            <div class="stat"><div class="num">${totalClavesDisponibles}</div><div class="label">Claves disponibles</div></div>
            <div class="stat"><div class="num">$${valorTotalUSD.toFixed(2)}</div><div class="label">Valor total (USD)</div></div>
            ${Object.entries(valoresMoneda).map(([mon, val]) => `<div class="stat"><div class="num moneda">${val}</div><div class="label">${mon}</div></div>`).join("")}
        </div>

        <div class="cards">
            <div class="card"><a href="/shop">\u{1F6D2} Tienda</a><p>Compra DLCs</p></div>
            <div class="card"><a href="/pay">\u{1F4B3} Pagar</a><p>Procesa tu pago</p></div>
            <div class="card"><a href="/sell">\u{1F4B0} Vender</a><p>Gestiona tus claves</p></div>
            <div class="card"><a href="/dlc">\u{1F3AE} DLCs</a><p>Ver todos los DLCs</p></div>
            <div class="card"><a href="/key">\u{1F511} Verificar</a><p>Valida tu clave</p></div>
            <div class="card"><a href="/profile">\u{1F464} Perfil</a><p>Tu cuenta</p></div>
            <div class="card"><a href="/claim-key">\u{1F3AB} Canjear</a><p>Canjea tu c\xF3digo</p></div>
            <div class="card"><a href="/suscribirse">\u{1F4C5} Suscripci\xF3n</a><p>Planes mensuales</p></div>
            <div class="card"><a href="/leaderboard">\u{1F3C6} Ranking</a><p>Top usuarios</p></div>
            <div class="card air-flow-card"><a href="/air-flow">\u2728 Air Flow</a><p>Tu asistente de IA</p></div>
        </div>
        <div class="user-actions">
            <a href="/profile">Mi perfil</a>
            <a href="/logout">Cerrar sesi\xF3n</a>
        </div>
        ${getCookieBannerScript()}
        ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { "Content-Type": "text/html" } });
}
__name(handleHome, "handleHome");
async function handleSell(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) {
    return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">\u{1F512} Necesitas iniciar sesi\xF3n</h2>
                    <a href="/login" style="color:#00ccff;">Iniciar sesi\xF3n</a>
                </div>
            </body></html>
        `, { status: 401, headers: { "Content-Type": "text/html" } });
  }
  const user = auth.user;
  const reseller = await getReseller(env, user.email);
  if (!reseller || reseller.role !== "reseller") {
    return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ffaa00;">\u26A0\uFE0F No eres revendedor</h2>
                    <p>Si quieres ser revendedor, contacta con el administrador.</p>
                    <a href="/home" style="color:#00ccff;">Volver al inicio</a>
                </div>
            </body></html>
        `, { status: 403, headers: { "Content-Type": "text/html" } });
  }
  const { movimientos } = await getMovimientos(env, user.email, 20, 0);
  const clavesDisponibles = reseller.claves_asignadas.filter((k) => !reseller.claves_vendidas.includes(k));
  const clavesVendidas = reseller.claves_vendidas;
  const dynKeys = await getDynamicKeys(env);
  const clavesInfo = {};
  for (let k of reseller.claves_asignadas) {
    const hash = await hashKey(k);
    if (dynKeys[hash]) {
      clavesInfo[k] = dynKeys[hash];
    }
  }
  const { compras } = await getCompras(env, 1e4, 0, { email: user.email });
  const ventasPorDia = {};
  compras.forEach((c) => {
    const dia = new Date(c.fecha).toISOString().slice(0, 10);
    ventasPorDia[dia] = (ventasPorDia[dia] || 0) + parseFloat(c.precio || 0);
  });
  const labels = Object.keys(ventasPorDia).sort().slice(-7);
  const data = labels.map((d) => ventasPorDia[d]);
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F4B0} Panel de Revendedor - Ocean Hub</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #ffcc00; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: rgba(255,255,255,0.05); border-radius: 15px; padding: 20px; text-align: center; }
        .stat-card .number { font-size: 2.5rem; font-weight: bold; color: #00ccff; }
        .stat-card .label { opacity: 0.7; }
        .section { margin: 30px 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        th { color: #88ccff; }
        .btn { padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; transition: 0.3s; }
        .btn-primary { background: #00ccff; color: #0a1a2b; }
        .btn-primary:hover { background: #33ddff; }
        .btn-success { background: #00cc88; color: #0a1a2b; }
        .btn-success:hover { background: #33dd88; }
        .btn-danger { background: #ff4444; color: white; }
        .btn-danger:hover { background: #ff6666; }
        .btn-warning { background: #ffaa00; color: #0a1a2b; }
        .btn-warning:hover { background: #ffcc33; }
        .pack-grid { display: flex; gap: 20px; flex-wrap: wrap; }
        .pack-card { background: rgba(255,255,255,0.05); border-radius: 15px; padding: 20px; width: 200px; text-align: center; }
        .pack-card .price { font-size: 1.8rem; color: #ffcc00; }
        .back { display: inline-block; margin-top: 30px; color: #00ccff; text-decoration: none; }
        .clave-item { font-family: monospace; background: #112233; padding: 4px 12px; border-radius: 6px; display: inline-block; }
        .badge { background: rgba(0,200,255,0.2); padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; }
        .chart-container { background: rgba(255,255,255,0.04); border-radius: 20px; padding: 20px; margin: 20px 0; }
    </style>
    </head>
    <body>
    <div class="container">
        <h1>\u{1F4B0} Panel de Revendedor</h1>
        <div class="stats-grid">
            <div class="stat-card"><div class="number">$${reseller.saldo.toFixed(2)}</div><div class="label">Saldo disponible</div></div>
            <div class="stat-card"><div class="number">$${reseller.total_comisiones.toFixed(2)}</div><div class="label">Total ganado</div></div>
            <div class="stat-card"><div class="number">${clavesDisponibles.length}</div><div class="label">Claves disponibles</div></div>
            <div class="stat-card"><div class="number">${clavesVendidas.length}</div><div class="label">Claves vendidas</div></div>
            <div class="stat-card"><div class="number">${reseller.comision_porcentaje || 0}%</div><div class="label">Comisi\xF3n por venta</div></div>
        </div>

        <div class="chart-container">
            <h3>Ventas diarias (\xFAltimos 7 d\xEDas)</h3>
            <canvas id="salesChart"></canvas>
        </div>

        <div class="section">
            <h2>\u{1F511} Mis claves disponibles</h2>
            ${clavesDisponibles.length === 0 ? "<p>No tienes claves asignadas.</p>" : `
            <table>
                <thead><tr><th>Clave</th><th>Rango</th><th>Expiraci\xF3n</th><th>Acci\xF3n</th></tr></thead>
                <tbody>
                    ${clavesDisponibles.map((k) => {
    const info = clavesInfo[k] || {};
    return `<tr>
                            <td><span class="clave-item">${k}</span></td>
                            <td>${info.rango || "N/A"}</td>
                            <td>${info.expires || "N/A"}</td>
                            <td><button class="btn btn-primary" onclick="copiarClave('${k}')">\u{1F4CB} Copiar</button></td>
                        </tr>`;
  }).join("")}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>\u{1F4CA} Claves vendidas</h2>
            ${clavesVendidas.length === 0 ? "<p>A\xFAn no has vendido ninguna clave.</p>" : `
            <table>
                <thead><tr><th>Clave</th></tr></thead>
                <tbody>
                    ${clavesVendidas.map((k) => `<tr><td><span class="clave-item">${k}</span></td></tr>`).join("")}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>\u{1F4E6} Comprar m\xE1s claves (packs)</h2>
            <p>Usa tu saldo para comprar packs de claves y revenderlas.</p>
            <div class="pack-grid">
                ${Object.entries(PACKS).map(([id, pack]) => `
                <div class="pack-card">
                    <h3>${pack.name}</h3>
                    <p>${pack.quantity} claves</p>
                    <div class="price">$${pack.price.toFixed(2)}</div>
                    <button class="btn btn-success" onclick="comprarPack('${id}')">Comprar</button>
                </div>
                `).join("")}
            </div>
        </div>

        <div class="section">
            <h2>\u{1F4DC} Historial de movimientos</h2>
            ${movimientos.length === 0 ? "<p>Sin movimientos a\xFAn.</p>" : `
            <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Descripci\xF3n</th></tr></thead>
                <tbody>
                    ${movimientos.map((m) => `
                    <tr>
                        <td>${new Date(m.fecha).toLocaleString()}</td>
                        <td>${m.tipo}</td>
                        <td style="color:${m.cantidad >= 0 ? "#00cc88" : "#ff6666"};">${m.cantidad >= 0 ? "+" : ""}$${m.cantidad.toFixed(2)}</td>
                        <td>${m.descripcion}</td>
                    </tr>
                    `).join("")}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>\u{1F4B8} Solicitar retiro</h2>
            <p>Saldo disponible: <strong>$${reseller.saldo.toFixed(2)}</strong></p>
            <button class="btn btn-warning" onclick="solicitarRetiro()">Solicitar retiro</button>
        </div>

        <a href="/home" class="back">\u2190 Volver al inicio</a>
    </div>
    <script>
        function copiarClave(clave) {
            navigator.clipboard.writeText(clave).then(() => alert('Clave copiada al portapapeles'));
        }
        function comprarPack(packId) {
            if (confirm('\xBFComprar este pack por $' + ${JSON.stringify(PACKS)}[packId].price + '?')) {
                fetch('/comprar-pack', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pack: packId })
                })
                .then(res => res.json())
                .then(data => {
                    alert(data.message || 'Pack comprado');
                    location.reload();
                })
                .catch(err => alert('Error: ' + err));
            }
        }
        function solicitarRetiro() {
            const monto = prompt('\xBFCu\xE1nto deseas retirar? (m\xE1ximo $' + ${reseller.saldo.toFixed(2)} + ')');
            if (monto) {
                fetch('/solicitar-retiro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ monto: parseFloat(monto) })
                })
                .then(res => res.json())
                .then(data => alert(data.message))
                .catch(err => alert('Error: '+err));
            }
        }
        const ctx = document.getElementById('salesChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Ventas (USD)',
                    data: ${JSON.stringify(data)},
                    backgroundColor: 'rgba(0,204,255,0.6)',
                    borderColor: '#00ccff',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
        });
    <\/script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleSell, "handleSell");
async function handleHacerReseller(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { email, porcentaje } = body;
  if (!email) return jsonResponse({ error: "Falta email" }, 400);
  const user = await getUserByEmail(env, email);
  if (!user) return jsonResponse({ error: "Usuario no encontrado" }, 404);
  let reseller = await getReseller(env, email);
  if (!reseller) {
    reseller = {
      email,
      role: "reseller",
      saldo: 0,
      comision_porcentaje: porcentaje || 25,
      claves_asignadas: [],
      claves_vendidas: [],
      total_vendido: 0,
      total_comisiones: 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } else {
    reseller.comision_porcentaje = porcentaje || reseller.comision_porcentaje;
  }
  await setReseller(env, email, reseller);
  user.role = "reseller";
  await env.STATS.put(`user_${email}`, JSON.stringify(user));
  await logAdminAction(env, "hacer_reseller", email, getClientIP(request), { porcentaje });
  return jsonResponse({ message: `Usuario ${email} ahora es revendedor con ${reseller.comision_porcentaje}% de comisi\xF3n` });
}
__name(handleHacerReseller, "handleHacerReseller");
async function handleAsignarClaves(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { email, claves } = body;
  if (!email || !Array.isArray(claves) || claves.length === 0) {
    return jsonResponse({ error: "Faltan datos" }, 400);
  }
  const reseller = await getReseller(env, email);
  if (!reseller) return jsonResponse({ error: "El usuario no es revendedor" }, 400);
  const dyn = await getDynamicKeys(env);
  const asignadas = [];
  for (let k of claves) {
    const hash = await hashKey(k);
    if (dyn[hash]) {
      if (!reseller.claves_asignadas.includes(k) && !reseller.claves_vendidas.includes(k)) {
        reseller.claves_asignadas.push(k);
        asignadas.push(k);
      }
    }
  }
  if (asignadas.length === 0) {
    return jsonResponse({ error: "Ninguna clave v\xE1lida para asignar" }, 400);
  }
  await setReseller(env, email, reseller);
  await logAdminAction(env, "asignar_claves", email, getClientIP(request), { claves: asignadas });
  return jsonResponse({ message: `Asignadas ${asignadas.length} claves a ${email}`, claves: asignadas });
}
__name(handleAsignarClaves, "handleAsignarClaves");
async function handleListResellers(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const list = await env.STATS.list({ prefix: "reseller_" });
  const resellers = [];
  for (let key of list.keys) {
    const raw = await env.STATS.get(key.name);
    if (raw) resellers.push(JSON.parse(raw));
  }
  return jsonResponse({ resellers });
}
__name(handleListResellers, "handleListResellers");
async function handleComprarPack(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  return await withKVLock(env, `reseller:${auth.user.email}`, async () => {
    const body = await request.json();
    const packId = body.pack;
    const pack = PACKS[packId];
    if (!pack) return jsonResponse({ error: "Pack no v\xE1lido" }, 400);
    const reseller = await getReseller(env, auth.user.email);
    if (!reseller) return jsonResponse({ error: "No eres revendedor" }, 403);
    if (reseller.saldo < pack.price) {
      return jsonResponse({ error: "Saldo insuficiente" }, 400);
    }
    reseller.saldo -= pack.price;
    const clavesGeneradas = [];
    for (let i = 0; i < pack.quantity; i++) {
      const key = "DLC-PACK-" + generateRandomHex(5).toUpperCase();
      const keyData = {
        key,
        type: "premium",
        rango: "\u{1F4E6} Pack",
        expires: "30 d\xEDas",
        dynamic: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        blocked: false,
        count: 0,
        history: [],
        tags: ["pack"],
        notas: `Generado para revendedor ${auth.user.email}`,
        un_solo_uso: false,
        change_log: [{ action: "created_from_pack", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
      };
      await saveDynamicKey(env, keyData);
      clavesGeneradas.push(key);
    }
    reseller.claves_asignadas.push(...clavesGeneradas);
    await setReseller(env, auth.user.email, reseller);
    await registrarMovimiento(env, auth.user.email, "compra_pack", -pack.price, `Compra de ${pack.name} (${pack.quantity} claves)`);
    await sendAlert(env, `\u{1F4E6} ${auth.user.email} compr\xF3 pack ${pack.name} por $${pack.price}`, "pack");
    return jsonResponse({ message: `Pack comprado. ${pack.quantity} claves generadas y asignadas.`, claves: clavesGeneradas });
  });
}
__name(handleComprarPack, "handleComprarPack");
async function handleSolicitarRetiro(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  return await withKVLock(env, `reseller:${auth.user.email}`, async () => {
    const body = await request.json();
    const monto = parseFloat(body.monto);
    if (isNaN(monto) || monto <= 0) return jsonResponse({ error: "Monto inv\xE1lido" }, 400);
    const reseller = await getReseller(env, auth.user.email);
    if (!reseller) return jsonResponse({ error: "No eres revendedor" }, 403);
    if (reseller.saldo < monto) return jsonResponse({ error: "Saldo insuficiente" }, 400);
    reseller.saldo -= monto;
    await setReseller(env, auth.user.email, reseller);
    await registrarMovimiento(env, auth.user.email, "retiro", -monto, `Retiro de $${monto} solicitado`);
    await sendAlert(env, `\u{1F4B8} ${auth.user.email} solicit\xF3 retiro de $${monto}`, "retiro");
    return jsonResponse({ message: `Solicitud de retiro de $${monto} registrada. El administrador procesar\xE1 el pago.` });
  });
}
__name(handleSolicitarRetiro, "handleSolicitarRetiro");
async function handleShop(env, request) {
  const url = new URL(request.url);
  const couponCode = url.searchParams.get("coupon") || null;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F6D2} Tienda - Ocean Hub</title>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { max-width: 1000px; width: 100%; }
        h1 { color: #00ccff; text-align: center; }
        .product-grid { display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; margin: 30px 0; }
        .product-card { background: rgba(255,255,255,0.06); border-radius: 20px; padding: 25px; width: 250px; border: 1px solid rgba(0,200,255,0.2); text-align: center; transition: 0.3s; }
        .product-card:hover { transform: scale(1.03); box-shadow: 0 0 30px rgba(0,200,255,0.2); }
        .product-card .price { font-size: 2rem; color: #ffcc00; margin: 15px 0; }
        .btn-buy { background: #0070ba; border: none; color: white; padding: 12px 30px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; transition: 0.3s; }
        .btn-buy:hover { background: #003087; }
        .back { margin-top: 30px; color: #00ccff; text-decoration: none; font-size: 1.2rem; }
        .coupon-input { margin: 20px 0; }
        .coupon-input input { padding: 10px; border-radius: 8px; border: none; width: 200px; }
        .coupon-input button { padding: 10px 20px; border-radius: 8px; border: none; background: #ffcc00; cursor: pointer; }
    </style>
    </head>
    <body>
    <div class="container">
        <h1>\u{1F6D2} Tienda de DLCs</h1>
        ${couponCode ? `<div style="background:rgba(255,215,0,0.2);border-radius:15px;padding:10px;margin:10px 0;">\u{1F3AB} Cup\xF3n aplicado: <strong>${escapeHTML(couponCode)}</strong> (descuento activo)</div>` : `
        <div class="coupon-input">
            <input type="text" id="couponInput" placeholder="C\xF3digo de cup\xF3n">
            <button onclick="aplicarCupon()">Aplicar</button>
        </div>
        `}
        <div class="product-grid">
            ${Object.entries(PRODUCTS).map(([id, p]) => `
            <div class="product-card">
                <h3>${escapeHTML(p.name)}</h3>
                <p>${escapeHTML(p.description)}</p>
                <div class="price">$${p.price.toFixed(2)}</div>
                <button class="btn-buy" onclick="comprar('${id}')">Comprar</button>
            </div>
            `).join("")}
        </div>
        <a href="/home" class="back">\u2190 Volver al inicio</a>
    </div>
    <script>
        function comprar(priceId) {
            const coupon = document.getElementById('couponInput') ? document.getElementById('couponInput').value : null;
            let url = '/shop/create-checkout?price_id=' + priceId;
            if (coupon) url += '&coupon=' + encodeURIComponent(coupon);
            fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.links && data.links.length) {
                    const approveLink = data.links.find(link => link.rel === 'approve');
                    if (approveLink) {
                        window.location.href = approveLink.href;
                    } else {
                        alert('Error: no se encontr\xF3 enlace de aprobaci\xF3n.');
                    }
                } else if (data.error) {
                    alert('Error: ' + data.error);
                } else {
                    alert('Error inesperado al crear la orden.');
                }
            })
            .catch(err => alert('Error: '+err));
        }
        function aplicarCupon() {
            const coupon = document.getElementById('couponInput').value.trim();
            if (coupon) {
                window.location.href = '/shop?coupon=' + encodeURIComponent(coupon);
            }
        }
    <\/script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleShop, "handleShop");
async function handlePay() {
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
        <div style="text-align:center;">
            <h2 style="color:#00ccff;">\u{1F4B3} Procesar pago</h2>
            <p>Para realizar un pago, ve a la tienda y selecciona tu producto.</p>
            <a href="/shop" style="color:#00ccff;">Ir a la tienda</a>
        </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body></html>
    `, { headers: { "Content-Type": "text/html" } });
}
__name(handlePay, "handlePay");
async function handleDlc() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F3AE} DLCs - Ocean Hub</title>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { max-width: 800px; width: 100%; }
        h1 { color: #00ccff; text-align: center; }
        .dlc-list { margin: 30px 0; }
        .dlc-item { background: rgba(255,255,255,0.05); border-radius: 15px; padding: 15px 20px; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; }
        .dlc-item .name { font-weight: bold; color: #88ddff; }
        .dlc-item .price { color: #ffcc00; font-weight: bold; }
        .back { margin-top: 30px; color: #00ccff; text-decoration: none; }
    </style>
    </head>
    <body>
    <div class="container">
        <h1>\u{1F3AE} DLCs disponibles</h1>
        <div class="dlc-list">
            ${Object.entries(PRODUCTS).map(([id, p]) => `
            <div class="dlc-item">
                <span class="name">${p.name}</span>
                <span>${p.description}</span>
                <span class="price">$${p.price.toFixed(2)}</span>
            </div>
            `).join("")}
        </div>
        <a href="/shop" class="back">\u2190 Comprar en la tienda</a>
        <br>
        <a href="/home" class="back">\u2190 Volver al inicio</a>
    </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleDlc, "handleDlc");
async function handleKey() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F511} Verificar clave - Ocean Hub</title>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column; padding: 20px; }
        .card { background: rgba(255,255,255,0.06); border-radius: 30px; padding: 40px; max-width: 500px; width: 100%; border: 1px solid rgba(0,200,255,0.2); text-align: center; }
        h2 { color: #00ccff; }
        input { width: 100%; padding: 12px; border-radius: 10px; border: none; background: rgba(255,255,255,0.08); color: white; font-size: 1rem; margin: 8px 0; }
        button { background: #00ccff; border: none; color: #0a1a2b; padding: 12px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; width: 100%; transition: 0.3s; }
        button:hover { background: #33ddff; }
        .result { margin-top: 20px; }
        .back { margin-top: 20px; color: #00ccff; text-decoration: none; }
    </style>
    </head>
    <body>
    <div class="card">
        <h2>\u{1F511} Verificar clave</h2>
        <p>Ingresa tu clave DLC para comprobar su validez.</p>
        <input type="text" id="keyInput" placeholder="Ej: DLC-PREMIUM-7F2A9B">
        <button onclick="verificar()">Verificar</button>
        <div id="result" class="result"></div>
        <a href="/home" class="back">\u2190 Volver al inicio</a>
    </div>
    <script>
        async function verificar() {
            const key = document.getElementById('keyInput').value.trim();
            if (!key) { alert('Ingresa una clave'); return; }
            try {
                const res = await fetch('/verify-web?key=' + encodeURIComponent(key));
                const data = await res.json();
                const resultDiv = document.getElementById('result');
                if (data.success && data.valid) {
                    resultDiv.innerHTML = '<p style="color:#00cc88;">\u2705 Clave v\xE1lida</p><p>' + (data.message || '') + '</p>';
                } else {
                    resultDiv.innerHTML = '<p style="color:#ff6666;">\u274C Clave inv\xE1lida</p><p>' + (data.error || data.message || '') + '</p>';
                }
            } catch (e) {
                document.getElementById('result').innerHTML = '<p style="color:#ff6666;">Error al verificar: ' + e.message + '</p>';
            }
        }
    <\/script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { "Content-Type": "text/html" } });
}
__name(handleKey, "handleKey");
async function handlePayPalCapture(env, request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token") || url.searchParams.get("orderId");
  if (!orderId) {
    return new Response("Falta el ID de la orden", { status: 400 });
  }
  try {
    const captureData = await capturePayPalOrder(env, orderId);
    if (captureData?.status !== "COMPLETED") return new Response("Pago no completado", { status: 402 });
    const paymentKey = `paypal_processed_${orderId}`;
    if (await env.STATS.get(paymentKey)) return new Response("Pago ya procesado", { status: 200 });
    await env.STATS.put(paymentKey, "1", { expirationTtl: 31536e3 });
    let customData = {};
    try {
      const customId = captureData.purchase_units?.[0]?.custom_id || "{}";
      customData = JSON.parse(customId);
    } catch (e) {
    }
    const tipo = customData.tipo || "dlc";
    const email = customData.email || "an\xF3nimo";
    const couponCode = customData.coupon || null;
    if (tipo === "suscripcion") {
      const plan = customData.plan || "tiburon";
      const planData = SUSCRIPCION_PLANES[plan];
      if (!planData) throw new Error("Plan no v\xE1lido");
      let subscriptionPrice = planData.price;
      if (couponCode) {
        const coupon = await getCoupon(env, couponCode);
        if (!coupon) throw new Error("Cup\xF3n inv\xE1lido");
        if (coupon.expires && new Date(coupon.expires) < /* @__PURE__ */ new Date()) throw new Error("Cup\xF3n expirado");
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error("Cup\xF3n agotado");
        if (coupon.discountPercent) {
          subscriptionPrice = subscriptionPrice * (1 - coupon.discountPercent / 100);
        } else if (coupon.fixedAmount) {
          subscriptionPrice = Math.max(0, subscriptionPrice - coupon.fixedAmount);
        }
      }
      const susActual = await getSuscripcionUsuario(env, email);
      if (susActual && susActual.activa) {
        await renovarSuscripcion(env, email, planData.days);
      } else {
        await crearSuscripcion(env, email, plan, planData.days);
      }
      if (couponCode) {
        await useCoupon(env, couponCode);
      }
      await registrarCompra(env, {
        fecha: (/* @__PURE__ */ new Date()).toISOString(),
        email,
        user_id: "",
        clave: "Suscripci\xF3n",
        producto: `Suscripci\xF3n ${planData.name}`,
        precio: Number(subscriptionPrice.toFixed(2)),
        payment_id: orderId,
        proveedor: "paypal",
        estado: "activa"
      });
      await sendAlert(env, `\u2705 Suscripci\xF3n activada: ${email} -> ${planData.name} (${planData.days} d\xEDas)`, "suscripcion");
      await triggerWebhooks(env, email, "subscription_activated", { plan: planData.name, days: planData.days });
      await logUserAction(env, email, "subscription_purchase", { plan: planData.name, orderId });
      const user = await getUserByEmail(env, email);
      if (user) {
        user.points = (user.points || 0) + 10;
        await env.STATS.put(`user_${email}`, JSON.stringify(user));
      }
      return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
                <h2 style="color:#00cc88;">\u2705 \xA1Suscripci\xF3n activada!</h2>
                <p>Plan: ${planData.name}</p>
                <p>Duraci\xF3n: ${planData.days} d\xEDas</p>
                <a href="/profile" style="color:#00ccff;">Ver mi perfil</a>
            </body></html>
            `, { headers: { "Content-Type": "text/html" } });
    } else {
      const priceId = customData.price_id || "price_aprendiz";
      const product = PRODUCTS[priceId];
      if (!product) throw new Error("Producto no encontrado");
      let price = product.price;
      if (couponCode) {
        const coupon = await useCoupon(env, couponCode);
        if (coupon.discountPercent) {
          price = price * (1 - coupon.discountPercent / 100);
        } else if (coupon.fixedAmount) {
          price = Math.max(0, price - coupon.fixedAmount);
        }
      }
      const key = "DLC-PAY-" + generateRandomHex(5).toUpperCase();
      const keyData = {
        key,
        type: "premium",
        rango: product.name,
        expires: `${product.days || 30} d\xEDas`,
        dynamic: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        blocked: false,
        count: 0,
        history: [],
        tags: ["paypal"],
        notas: `Comprado por ${email} con PayPal (${orderId})`,
        un_solo_uso: false,
        change_log: [{ action: "created_from_paypal", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
      };
      await saveDynamicKey(env, keyData);
      await registrarCompra(env, {
        fecha: (/* @__PURE__ */ new Date()).toISOString(),
        email,
        user_id: customData.user_id || "",
        clave: key,
        producto: product.name,
        precio: price,
        payment_id: orderId,
        proveedor: "paypal",
        estado: "activa"
      });
      const user = await getUserByEmail(env, email);
      if (user && user.referido_por) {
        const comision = price * 0.1;
        await addComisionToReferidor(env, email, comision);
        await sendAlert(env, `\u{1F4B0} Comisi\xF3n de $${comision.toFixed(2)} a\xF1adida al referidor de ${email}`, "comision");
      }
      if (user) {
        user.points = (user.points || 0) + 10;
        await env.STATS.put(`user_${email}`, JSON.stringify(user));
      }
      await sendAlert(env, `\u2705 Compra registrada: ${email} -> ${product.name} (clave: ${key})`, "compra");
      await sendEmail(env, email, "\u{1F389} Tu compra en Ocean Hub", `
                <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                    <h2 style="color:#00cc88;">\u2705 \xA1Gracias por tu compra!</h2>
                    <p>Hola${user ? " " + escapeHTML(user.name || "") : ""},</p>
                    <p>Tu compra se ha procesado correctamente. Aqu\xED tienes los detalles:</p>
                    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;">
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Producto</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:bold;">${escapeHTML(product.name)}</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Precio</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#ffcc00;font-weight:bold;">$${price.toFixed(2)} USD</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Duraci\xF3n</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">${product.days} d\xEDas</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">ID de pago</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);font-family:monospace;font-size:0.85rem;">${orderId}</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Fecha</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">${(/* @__PURE__ */ new Date()).toLocaleString()}</td></tr>
                    </table>
                    <p style="margin-top:25px;">Tu clave DLC es:</p>
                    <p style="text-align:center;margin:20px 0;">
                        <code style="background:#112233;padding:14px 24px;border-radius:10px;font-size:1.2rem;color:#00ddff;display:inline-block;letter-spacing:1px;">${key}</code>
                    </p>
                    <p style="text-align:center;">
                        <a href="${getBaseUrl(env)}/key" style="background:#00ccff;color:#0a1a2b;padding:12px 28px;border-radius:40px;text-decoration:none;font-weight:bold;">Verificar mi clave</a>
                    </p>
                    <hr style="border-color:rgba(255,255,255,0.1);margin:25px 0;">
                    <p style="font-size:0.85rem;color:#88aacc;">Guarda este correo. Puedes ver todas tus claves en tu <a href="${getBaseUrl(env)}/profile" style="color:#00ccff;">perfil</a>.</p>
                    <p style="font-size:0.8rem;color:#88aacc;">Si no reconoces esta compra, cont\xE1ctanos respondiendo a este mensaje.</p>
                </div>
            `);
      await triggerWebhooks(env, email, "dlc_purchased", { key, product: product.name });
      await logUserAction(env, email, "dlc_purchase", { key, product: product.name, orderId });
      await withKVLock(env, "global_stats", async () => {
        const stats = await getStats(env);
        if (!stats) return;
        stats.sales.total = (stats.sales.total || 0) + 1;
        stats.sales.revenue = (stats.sales.revenue || 0) + price;
        stats.sales.last_sale = (/* @__PURE__ */ new Date()).toISOString();
        stats.sales.by_product[product.name] = (stats.sales.by_product[product.name] || 0) + 1;
        await env.STATS.put("global_stats", JSON.stringify(stats));
      });
      return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
                <h2 style="color:#00cc88;">\u2705 \xA1Pago exitoso!</h2>
                <p>Tu clave DLC es: <code style="background:#112233;padding:8px 16px;border-radius:8px;font-size:1.2rem;">${key}</code></p>
                <p>Producto: ${escapeHTML(product.name)}</p>
                <p>Te hemos enviado un correo con los detalles.</p>
                <a href="/profile" style="color:#00ccff;">Ver mis claves</a>
            </body></html>
            `, { headers: { "Content-Type": "text/html" } });
    }
  } catch (e) {
    console.error("Error en captura PayPal:", e);
    return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#ff6666;">\u274C Error al procesar el pago</h2>
            <p>${e.message}</p>
            <a href="/shop" style="color:#00ccff;">Volver a la tienda</a>
        </body></html>
        `, { status: 500, headers: { "Content-Type": "text/html" } });
  }
}
__name(handlePayPalCapture, "handlePayPalCapture");
function calcularIngresosDesdeCompras(compras) {
  const ahora = /* @__PURE__ */ new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const semana = new Date(ahora.getTime() - 7 * 864e5);
  const mes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate());
  let ventasDia = 0, ventasSemana = 0, ventasMes = 0, totalIngresos = 0;
  const porProducto = {};
  compras.forEach((c) => {
    const fecha = new Date(c.fecha);
    const precio = parseFloat(c.precio) || 0;
    totalIngresos += precio;
    if (fecha >= hoy) ventasDia += precio;
    if (fecha >= semana) ventasSemana += precio;
    if (fecha >= mes) ventasMes += precio;
    const prod = c.producto || "Desconocido";
    porProducto[prod] = (porProducto[prod] || 0) + precio;
  });
  let productoMasVendido = "Ninguno";
  let maxVentas = 0;
  for (let [prod, total] of Object.entries(porProducto)) {
    if (total > maxVentas) {
      maxVentas = total;
      productoMasVendido = prod;
    }
  }
  return { dia: ventasDia, semana: ventasSemana, mes: ventasMes, total: totalIngresos, producto_mas_vendido: productoMasVendido, total_compras: compras.length };
}
__name(calcularIngresosDesdeCompras, "calcularIngresosDesdeCompras");
async function handleAdminRoute(env, url, headers, request) {
  const auth = await requireAdmin(env, request);
  if (auth) {
    const { compras } = await getCompras(env, 1e4, 0);
    const ingresosData2 = calcularIngresosDesdeCompras(compras);
    const stats2 = await getStats(env) || {};
    const dynamicKeys2 = await getDynamicKeys(env) || {};
    let allKeys2 = [];
    for (let k of STATIC_KEYS) {
      const usage = stats2.keys_usage?.[k.hash] || { count: 0, blocked: false };
      allKeys2.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || "\u221E", uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: "", un_solo_uso: false });
    }
    for (let hash in dynamicKeys2) {
      const k = dynamicKeys2[hash];
      const usage = stats2.keys_usage?.[hash] || { count: 0, blocked: false };
      allKeys2.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || "\u221E", uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [], notas: k.notas || "", un_solo_uso: k.un_solo_uso || false });
    }
    const hourlyLabels2 = [];
    const hourlyData2 = [];
    if (stats2.hourly_usage) {
      const hours = Object.keys(stats2.hourly_usage).sort();
      hours.slice(-24).forEach((h) => {
        hourlyLabels2.push(h.replace("T", " "));
        hourlyData2.push(stats2.hourly_usage[h]);
      });
    }
    const dailyLabels2 = [];
    const dailyValid2 = [];
    const dailyInvalid2 = [];
    if (stats2.daily_usage) {
      const days = Object.keys(stats2.daily_usage).sort().slice(-7);
      days.forEach((d) => {
        dailyLabels2.push(d);
        dailyValid2.push(stats2.daily_usage[d].valid || 0);
        dailyInvalid2.push(stats2.daily_usage[d].invalid || 0);
      });
    }
    const resellerLink = `<a href="/admin/resellers" style="background:rgba(255,200,0,0.2);">\u{1F465} Revendedores</a>`;
    const userManagerLink = `<a href="/admin/users" style="background:rgba(0,200,255,0.2);">\u{1F464} Usuarios</a>`;
    const backupLink = `<button onclick="doBackup()" style="background:rgba(255,100,0,0.3);">\u{1F4BE} Backup</button>`;
    const uploadLink = `<button onclick="openUploadModal()" style="background:rgba(0,200,100,0.3);">\u{1F4E4} Subir CSV</button>`;
    let tableRows2 = "";
    allKeys2.forEach((k) => {
      const isBlocked = k.blocked || false;
      const isDynamic = k.dynamic || false;
      const used = k.uses || 0;
      const maxUses = k.maxUses || "\u221E";
      const statusBadge = isBlocked ? '<span style="color:#ff6666;">\u{1F6AB} Bloqueada</span>' : '<span style="color:#00cc88;">\u2705 Activa</span>';
      const deleteBtn = isDynamic ? `<button onclick="action('delete','${k.key}')" class="btn-sm" style="background:#cc0000;">Eliminar</button>` : "";
      const tags = k.tags && k.tags.length ? k.tags.join(", ") : "";
      tableRows2 += `
                <tr>
                    <td><strong>${escapeHTML(k.key)}</strong></td>
                    <td>${escapeHTML(k.rango)}</td>
                    <td><span style="background:rgba(0,200,255,0.2);padding:2px 10px;border-radius:20px;">${k.type}</span></td>
                    <td>${escapeHTML(k.expires)}</td>
                    <td>${used}${maxUses !== "\u221E" ? "/" + maxUses : ""}</td>
                    <td>${statusBadge}</td>
                    <td>${isDynamic ? "\u{1F3B2} S\xED" : "\u{1F4CC} No"}</td>
                    <td style="font-size:0.8rem;">${k.un_solo_uso ? "\u{1F512} 1 uso" : ""} ${tags}</td>
                    <td style="display:flex;flex-wrap:wrap;gap:4px;">
                        <button onclick="action('block','${k.key}')" class="btn-sm" style="background:#ff4444;">Bloquear</button>
                        <button onclick="action('unblock','${k.key}')" class="btn-sm" style="background:#ff8800;">Desbloquear</button>
                        <button onclick="action('reset','${k.key}')" class="btn-sm" style="background:#ffaa00;">Reiniciar</button>
                        ${deleteBtn}
                        <button onclick="action('unbind','${k.key}')" class="btn-sm" style="background:#8888ff;">Desvincular</button>
                        ${isDynamic ? `<button onclick="action('renew','${k.key}')" class="btn-sm" style="background:#00cc88;">Renovar +30d</button>` : ""}
                    </td>
                </tr>
            `;
    });
    const html2 = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>\u{1F30A} Ocean Hub - Admin</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding:20px; }
                .container { max-width:1400px; margin:0 auto; }
                h1 { color: #00ccff; margin-bottom:20px; display:flex; align-items:center; gap:15px; }
                h1 small { font-size:0.9rem; color:#88bbdd; font-weight:normal; }
                .admin-badge { background: rgba(255,200,0,0.2); color: #ffcc00; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-left: 10px; }

                .hud-actions {
                    background: rgba(0, 20, 40, 0.7);
                    border: 3px solid #00ccff;
                    border-radius: 20px;
                    padding: 20px 25px;
                    margin: 20px 0 30px 0;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 15px;
                    backdrop-filter: blur(6px);
                    box-shadow: 0 0 40px rgba(0,200,255,0.15), inset 0 0 30px rgba(0,200,255,0.05);
                    position: relative;
                }
                .hud-actions::before {
                    content: "\u26A1 PANEL DE CONTROL";
                    position: absolute;
                    top: -12px;
                    left: 20px;
                    background: #0a1a2b;
                    padding: 0 15px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    color: #88ddff;
                    letter-spacing: 2px;
                    border-radius: 30px;
                    border: 1px solid #00ccff;
                    backdrop-filter: blur(4px);
                }
                .hud-actions button, .hud-actions a {
                    padding: 10px 22px;
                    border: none;
                    border-radius: 40px;
                    background: rgba(0,200,255,0.15);
                    color: white;
                    cursor: pointer;
                    transition: all 0.25s;
                    text-decoration: none;
                    font-size: 0.95rem;
                    font-weight: 500;
                    border: 1px solid transparent;
                }
                .hud-actions button:hover, .hud-actions a:hover {
                    background: #00ccff;
                    color: #0a1a2b;
                    transform: scale(1.02);
                    box-shadow: 0 0 25px rgba(0,200,255,0.4);
                }
                .hud-actions a {
                    background: rgba(0,200,255,0.1);
                    border-color: rgba(0,200,255,0.2);
                }
                .hud-actions a:hover {
                    background: #00ccff;
                    border-color: #00ccff;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px,1fr));
                    gap:15px;
                    margin-bottom:25px;
                }
                .stat-box {
                    background:rgba(255,255,255,0.05);
                    border-radius:15px;
                    padding:15px 20px;
                    text-align:center;
                    transition:0.3s;
                }
                .stat-box:hover { background:rgba(255,255,255,0.1); }
                .stat-box .num { font-size:2rem; font-weight:bold; color:#00ccff; }
                .stat-box .label { font-size:0.85rem; opacity:0.7; }
                .stat-box .num.valid { color:#00cc88; }
                .stat-box .num.invalid { color:#ff6666; }

                .table-wrapper {
                    overflow-x:auto;
                    margin-top:20px;
                    border-radius:15px;
                    background:rgba(255,255,255,0.03);
                    padding:5px;
                }
                table {
                    width:100%;
                    border-collapse:collapse;
                    font-size:0.9rem;
                }
                th, td {
                    padding:12px 10px;
                    text-align:left;
                    border-bottom:1px solid rgba(255,255,255,0.06);
                }
                th {
                    background:rgba(0,0,0,0.3);
                    color:#88ccff;
                    font-weight:600;
                    position:sticky;
                    top:0;
                    z-index:10;
                }
                td { vertical-align:middle; }
                td button.btn-sm {
                    padding:4px 12px;
                    border:none;
                    border-radius:20px;
                    color:white;
                    cursor:pointer;
                    transition:0.2s;
                    font-size:0.8rem;
                }
                td button.btn-sm:hover { opacity:0.8; transform:scale(0.96); }

                .chart-container {
                    display:flex;
                    flex-wrap:wrap;
                    gap:20px;
                    margin-top:30px;
                }
                .chart-box {
                    background:rgba(255,255,255,0.04);
                    border-radius:20px;
                    padding:20px;
                    flex:1;
                    min-width:280px;
                }

                .modal {
                    display:none;
                    position:fixed;
                    top:0; left:0; width:100%; height:100%;
                    background:rgba(0,0,0,0.7);
                    backdrop-filter:blur(5px);
                    z-index:1000;
                    justify-content:center;
                    align-items:center;
                }
                .modal.active { display:flex; }
                .modal-content {
                    background:#1b3a5c;
                    border-radius:30px;
                    padding:30px;
                    max-width:500px;
                    width:90%;
                    max-height:80vh;
                    overflow-y:auto;
                    box-shadow:0 20px 60px rgba(0,0,0,0.8);
                    animation:fadeIn 0.3s ease;
                }
                .modal-content h2 { color:#00ccff; margin-bottom:15px; }
                .modal-content input, .modal-content select, .modal-content textarea {
                    width:100%;
                    padding:12px;
                    margin:8px 0;
                    border-radius:12px;
                    border:none;
                    background:rgba(255,255,255,0.08);
                    color:white;
                    font-size:1rem;
                }
                .modal-content input::placeholder, .modal-content textarea::placeholder { color:#aac; }
                .modal-content select option { background:#1b3a5c; }
                .modal-content button {
                    padding:10px 25px;
                    border:none;
                    border-radius:30px;
                    background:#00ccff;
                    color:#0a1a2b;
                    cursor:pointer;
                    font-weight:bold;
                    transition:0.3s;
                    margin-top:10px;
                }
                .modal-content button:hover { background:#33ddff; }
                .modal-content .close {
                    float:right;
                    background:none;
                    border:none;
                    color:white;
                    font-size:2rem;
                    cursor:pointer;
                }
                .modal-content .close:hover { color:#ff6666; }

                .batch-keys {
                    background:rgba(0,0,0,0.3);
                    border-radius:12px;
                    padding:15px;
                    margin:10px 0;
                    font-family: monospace;
                    font-size:0.9rem;
                    word-break:break-all;
                }
                .batch-keys span {
                    display:block;
                    padding:4px 0;
                    border-bottom:1px solid rgba(255,255,255,0.05);
                }

                @keyframes fadeIn {
                    from { opacity:0; transform:scale(0.95); }
                    to { opacity:1; transform:scale(1); }
                }
                @media (max-width:600px) {
                    table { font-size:0.75rem; }
                    td button.btn-sm { font-size:0.7rem; padding:2px 8px; }
                    .stats-grid { grid-template-columns:1fr 1fr; }
                    .hud-actions { flex-direction: column; align-items: stretch; }
                }
                .ingresos-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px,1fr));
                    gap:10px;
                    margin:15px 0;
                }
                .ingreso-item {
                    background:rgba(0,200,255,0.08);
                    border-radius:12px;
                    padding:10px;
                    text-align:center;
                }
                .ingreso-item .valor { font-size:1.5rem; color:#ffcc00; }
                .ingreso-item .etiqueta { font-size:0.8rem; opacity:0.7; }
            </style>
        </head>
        <body>
        <div class="container">
            <h1>\u{1F510} Panel de Administraci\xF3n <small>Ocean Hub</small>
                <span class="admin-badge">\u{1F464} ${escapeHTML(auth.user.email)}</span>
            </h1>

            <div class="stats-grid">
                <div class="stat-box"><div class="num">${stats2.total_verifications || 0}</div><div class="label">Total</div></div>
                <div class="stat-box"><div class="num valid">${stats2.valid_verifications || 0}</div><div class="label">V\xE1lidas</div></div>
                <div class="stat-box"><div class="num invalid">${stats2.invalid_verifications || 0}</div><div class="label">Inv\xE1lidas</div></div>
                <div class="stat-box"><div class="num">${STATIC_KEYS.length}</div><div class="label">Est\xE1ticas</div></div>
                <div class="stat-box"><div class="num">${Object.keys(dynamicKeys2).length}</div><div class="label">Din\xE1micas</div></div>
                <div class="stat-box"><div class="num">${Object.values(stats2.keys_usage || {}).filter((u) => u.count > 0).length}</div><div class="label">Usadas</div></div>
                <div class="stat-box"><div class="num">${stats2.sales?.total || 0}</div><div class="label">Ventas</div></div>
                <div class="stat-box"><div class="num">$${(stats2.sales?.revenue || 0).toFixed(2)}</div><div class="label">Ingresos totales</div></div>
            </div>

            <div class="ingresos-grid">
                <div class="ingreso-item"><div class="valor">$${ingresosData2.dia?.toFixed(2) || "0.00"}</div><div class="etiqueta">Hoy</div></div>
                <div class="ingreso-item"><div class="valor">$${ingresosData2.semana?.toFixed(2) || "0.00"}</div><div class="etiqueta">\xDAltima semana</div></div>
                <div class="ingreso-item"><div class="valor">$${ingresosData2.mes?.toFixed(2) || "0.00"}</div><div class="etiqueta">\xDAltimo mes</div></div>
                <div class="ingreso-item"><div class="valor">${ingresosData2.producto_mas_vendido || "Ninguno"}</div><div class="etiqueta">Producto m\xE1s vendido</div></div>
            </div>

            <div class="hud-actions">
                <button onclick="openGenerateModal()">\u2795 Generar clave</button>
                <button onclick="openBatchModal()">\u{1F3B2} Lote (5)</button>
                <button onclick="openPruebaModal()">\u{1F9EA} Generar prueba</button>
                <button onclick="openResellerModal()">\u{1F465} Hacer revendedor</button>
                <a href="/export-csv">\u{1F4E5} Exportar CSV</a>
                <a href="/export-json">\u{1F4E5} Exportar JSON</a>
                <a href="/admin/compras" style="background:rgba(255,200,0,0.2);">\u{1F4CA} Ver compras</a>
                <a href="/admin/logs" style="background:rgba(0,200,255,0.2);">\u{1F4CB} Logs</a>
                ${resellerLink}
                ${userManagerLink}
                ${backupLink}
                ${uploadLink}
                <button onclick="location.reload()">\u{1F504} Refrescar</button>
                <a href="/profile" style="background:rgba(0,200,255,0.2);">\u{1F464} Mi perfil</a>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Clave</th><th>Rango</th><th>Tipo</th><th>Duraci\xF3n</th><th>Usos</th><th>Estado</th><th>Din\xE1mica</th><th>Tags/Notas</th><th>Acciones</th></tr></thead>
                    <tbody>${tableRows2}</tbody>
                </table>
            </div>

            <div class="chart-container">
                <div class="chart-box"><canvas id="hourlyChart"></canvas></div>
                <div class="chart-box"><canvas id="dailyChart"></canvas></div>
            </div>
        </div>

        <!-- Modal GENERAR CLAVE -->
        <div class="modal" id="genModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('genModal')">&times;</button>
                <h2>\u{1F511} Generar clave</h2>
                <input type="text" id="genKey" placeholder="Clave (dejar vac\xEDo para aleatoria)">
                <input type="text" id="genRango" placeholder="Rango personalizado (ej: \u{1F31F} VIP Especial)" value="\u{1F988} Tibur\xF3n">
                <select id="genType">
                    <option value="gratuita">Gratuita</option>
                    <option value="premium" selected>Premium</option>
                    <option value="vip">VIP</option>
                    <option value="staff">Staff</option>
                    <option value="prueba">Prueba</option>
                </select>
                <input type="text" id="genExpires" placeholder="Duraci\xF3n (ej: 30 d\xEDas, 1 a\xF1o, permanente)" value="30 d\xEDas">
                <input type="number" id="genMaxUses" placeholder="L\xEDmite de usos (infinito si vac\xEDo)">
                <input type="text" id="genTags" placeholder="Tags separados por coma (ej: evento, vip)">
                <textarea id="genNotas" placeholder="Notas internas" rows="2"></textarea>
                <label style="display:flex;align-items:center;gap:10px;margin:8px 0;">
                    <input type="checkbox" id="genUnSoloUso"> Un solo uso
                </label>
                <input type="password" id="genPin" placeholder="PIN de seguridad">
                <button onclick="generateKey()">Generar</button>
                <div id="genResult" style="margin-top:12px;color:#88ddff;"></div>
            </div>
        </div>

        <!-- Modal LOTE -->
        <div class="modal" id="batchModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('batchModal')">&times;</button>
                <h2>\u{1F3B2} Lote de claves</h2>
                <p>Se generar\xE1n <strong>5 claves</strong> con tipo <em>premium</em>, rango <em>\u{1F988} Tibur\xF3n</em> y duraci\xF3n <em>30 d\xEDas</em>.</p>
                <input type="password" id="batchPin" placeholder="PIN de seguridad">
                <button onclick="generateBatch()">Generar lote</button>
                <div id="batchResult" style="margin-top:15px;"></div>
            </div>
        </div>

        <!-- Modal PRUEBA -->
        <div class="modal" id="pruebaModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('pruebaModal')">&times;</button>
                <h2>\u{1F9EA} Generar clave de prueba</h2>
                <p>Clave temporal de un solo uso.</p>
                <select id="pruebaHoras">
                    <option value="1">1 hora</option>
                    <option value="3">3 horas</option>
                    <option value="6">6 horas</option>
                </select>
                <input type="password" id="pruebaPin" placeholder="PIN de seguridad">
                <button onclick="generarPrueba()">Generar</button>
                <div id="pruebaResult" style="margin-top:12px;"></div>
            </div>
        </div>

        <!-- Modal RESELLER -->
        <div class="modal" id="resellerModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('resellerModal')">&times;</button>
                <h2>\u{1F465} Hacer revendedor</h2>
                <p>Convierte un usuario existente en revendedor.</p>
                <input type="email" id="resellerEmail" placeholder="Email del usuario" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <input type="number" id="resellerPorcentaje" placeholder="% de comisi\xF3n (ej: 25)" value="25" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <input type="password" id="resellerPin" placeholder="PIN de seguridad" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <button onclick="hacerReseller()">Convertir</button>
                <div id="resellerResult" style="margin-top:12px;"></div>
            </div>
        </div>

        <!-- Modal SUBIR CSV -->
        <div class="modal" id="uploadModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('uploadModal')">&times;</button>
                <h2>\u{1F4E4} Subir archivo CSV</h2>
                <p>Sube un CSV con una lista de claves (una por l\xEDnea).</p>
                <form id="uploadForm" enctype="multipart/form-data">
                    <input type="file" name="file" accept=".csv,.txt" style="background:transparent;border:1px solid #00ccff;padding:10px;border-radius:10px;">
                    <input type="password" id="uploadPin" placeholder="PIN de seguridad" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                    <button type="button" onclick="uploadKeys()">Subir</button>
                </form>
                <div id="uploadResult" style="margin-top:12px;"></div>
            </div>
        </div>

        <script>
            
            

            function action(type, key) {
                const pin = prompt('Introduce el PIN de seguridad:');
                
                let url = '/admin-action?action='+type+'&key='+encodeURIComponent(key)+'&pin='+encodeURIComponent(pin);
                if (type === 'renew') {
                    const days = prompt('\xBFCu\xE1ntos d\xEDas renovar? (30 por defecto)', '30');
                    if (!days) return;
                    url += '&days='+parseInt(days);
                }
                fetch(url)
                .then(res => res.json())
                .then(data => {
                    alert(data.message || data.error);
                    location.reload();
                })
                .catch(err => alert('Error: ' + err));
            }

            function openGenerateModal() { document.getElementById('genModal').classList.add('active'); }
            function openBatchModal() { document.getElementById('batchModal').classList.add('active'); }
            function openPruebaModal() { document.getElementById('pruebaModal').classList.add('active'); }
            function openResellerModal() { document.getElementById('resellerModal').classList.add('active'); }
            function openUploadModal() { document.getElementById('uploadModal').classList.add('active'); }
            function closeModal(id) { document.getElementById(id).classList.remove('active'); }

            function generateKey() {
                const key = document.getElementById('genKey').value.trim() || undefined;
                const rango = document.getElementById('genRango').value.trim() || '\u{1F988} Tibur\xF3n';
                const type = document.getElementById('genType').value;
                const expires = document.getElementById('genExpires').value.trim() || '30 d\xEDas';
                const maxUses = document.getElementById('genMaxUses').value;
                const tags = document.getElementById('genTags').value.trim();
                const notas = document.getElementById('genNotas').value.trim();
                const un_solo_uso = document.getElementById('genUnSoloUso').checked;
                const pin = document.getElementById('genPin').value;
                
                const payload = { key, rango, type, expires, maxUses: maxUses ? parseInt(maxUses) : undefined, tags, notas, un_solo_uso, pin };
                fetch('/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('genResult').innerHTML = '\u274C ' + data.error;
                    } else {
                        document.getElementById('genResult').innerHTML = '\u2705 ' + data.message;
                        setTimeout(() => location.reload(), 1500);
                    }
                })
                .catch(err => alert('Error: '+err));
            }

            function generateBatch() {
                const pin = document.getElementById('batchPin').value;
                
                const count = 5;
                fetch('/generate-batch?count='+count+'&pin='+encodeURIComponent(pin))
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('batchResult').innerHTML = '\u274C ' + data.error;
                    } else if (data.keys && data.keys.length > 0) {
                        let html = '<div class="batch-keys">';
                        data.keys.forEach(k => { html += '<span>\u{1F511} ' + k + '</span>'; });
                        html += '</div><p style="color:#88ddff;">\u2705 ' + data.keys.length + ' claves generadas.</p>';
                        document.getElementById('batchResult').innerHTML = html;
                        setTimeout(() => location.reload(), 2000);
                    } else {
                        document.getElementById('batchResult').innerHTML = '<p style="color:#ff8888;">No se generaron claves.</p>';
                    }
                })
                .catch(err => alert('Error: '+err));
            }

            function generarPrueba() {
                const horas = parseInt(document.getElementById('pruebaHoras').value);
                const pin = document.getElementById('pruebaPin').value;
                
                fetch('/admin/generar-prueba', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ horas, pin })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('pruebaResult').innerHTML = '\u274C ' + data.error;
                    } else {
                        document.getElementById('pruebaResult').innerHTML = '\u2705 Clave de prueba: <code>' + data.key + '</code> (' + data.horas + 'h)';
                        setTimeout(() => location.reload(), 2000);
                    }
                })
                .catch(err => alert('Error: '+err));
            }

            function hacerReseller() {
                const email = document.getElementById('resellerEmail').value.trim();
                const porcentaje = parseInt(document.getElementById('resellerPorcentaje').value) || 25;
                const pin = document.getElementById('resellerPin').value;
                if (!email) { alert('Introduce un email'); return; }
                
                fetch('/admin/hacer-reseller', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, porcentaje })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('resellerResult').innerHTML = '\u274C ' + data.error;
                    } else {
                        document.getElementById('resellerResult').innerHTML = '\u2705 ' + data.message;
                        setTimeout(() => location.reload(), 1500);
                    }
                })
                .catch(err => alert('Error: '+err));
            }

            function uploadKeys() {
                const pin = document.getElementById('uploadPin').value;
                
                const form = document.getElementById('uploadForm');
                const formData = new FormData(form);
                formData.append('pin', pin);
                fetch('/admin/upload-keys', {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.json())
                .then(data => {
                    document.getElementById('uploadResult').innerHTML = data.message || data.error;
                    if (data.message) setTimeout(() => location.reload(), 2000);
                })
                .catch(err => alert('Error: '+err));
            }

            function doBackup() {
                if (confirm('\xBFRealizar backup del KV? Esto puede tomar unos segundos.')) {
                    fetch('/admin/backup', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => alert(data.message))
                    .catch(err => alert('Error: '+err));
                }
            }

            const hourlyLabels = ${JSON.stringify(hourlyLabels2)};
            const hourlyData = ${JSON.stringify(hourlyData2)};
            const dailyLabels = ${JSON.stringify(dailyLabels2)};
            const dailyValid = ${JSON.stringify(dailyValid2)};
            const dailyInvalid = ${JSON.stringify(dailyInvalid2)};

            new Chart(document.getElementById('hourlyChart'), {
                type: 'bar',
                data: {
                    labels: hourlyLabels,
                    datasets: [{
                        label: 'Verificaciones por hora',
                        data: hourlyData,
                        backgroundColor: 'rgba(0,200,255,0.6)',
                        borderColor: '#00ccff',
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
            });

            new Chart(document.getElementById('dailyChart'), {
                type: 'bar',
                data: {
                    labels: dailyLabels,
                    datasets: [
                        { label: 'V\xE1lidas', data: dailyValid, backgroundColor: 'rgba(0,204,136,0.6)', borderColor: '#00cc88', borderWidth: 1 },
                        { label: 'Inv\xE1lidas', data: dailyInvalid, backgroundColor: 'rgba(255,68,68,0.6)', borderColor: '#ff4444', borderWidth: 1 }
                    ]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
            });
        <\/script>
        ${getCookieBannerScript()}
        </body>
        </html>`;
    return new Response(html2, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response("\u26D4 No autorizado", { status: 403 });
  const stats = await getStats(env) || {};
  const dynamicKeys = await getDynamicKeys(env) || {};
  let allKeys = [];
  for (let k of STATIC_KEYS) {
    const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || "\u221E", uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: "", un_solo_uso: false });
  }
  for (let hash in dynamicKeys) {
    const k = dynamicKeys[hash];
    const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
    allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || "\u221E", uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [], notas: k.notas || "", un_solo_uso: k.un_solo_uso || false });
  }
  const hourlyLabels = [];
  const hourlyData = [];
  if (stats.hourly_usage) {
    const hours = Object.keys(stats.hourly_usage).sort();
    hours.slice(-24).forEach((h) => {
      hourlyLabels.push(h.replace("T", " "));
      hourlyData.push(stats.hourly_usage[h]);
    });
  }
  const dailyLabels = [];
  const dailyValid = [];
  const dailyInvalid = [];
  if (stats.daily_usage) {
    const days = Object.keys(stats.daily_usage).sort().slice(-7);
    days.forEach((d) => {
      dailyLabels.push(d);
      dailyValid.push(stats.daily_usage[d].valid || 0);
      dailyInvalid.push(stats.daily_usage[d].invalid || 0);
    });
  }
  const ingresosResp = await handleAdminIngresos(env, new URL("/admin/ingresos", "http://dummy"));
  const ingresosData = await ingresosResp.json();
  let tableRows = "";
  allKeys.forEach((k) => {
    const isBlocked = k.blocked || false;
    const isDynamic = k.dynamic || false;
    const used = k.uses || 0;
    const maxUses = k.maxUses || "\u221E";
    const statusBadge = isBlocked ? '<span style="color:#ff6666;">\u{1F6AB} Bloqueada</span>' : '<span style="color:#00cc88;">\u2705 Activa</span>';
    const deleteBtn = isDynamic ? `<button onclick="action('delete','${k.key}')" class="btn-sm" style="background:#cc0000;">Eliminar</button>` : "";
    const tags = k.tags && k.tags.length ? k.tags.join(", ") : "";
    tableRows += `
            <tr>
                <td><strong>${escapeHTML(k.key)}</strong></td>
                <td>${escapeHTML(k.rango)}</td>
                <td><span style="background:rgba(0,200,255,0.2);padding:2px 10px;border-radius:20px;">${k.type}</span></td>
                <td>${escapeHTML(k.expires)}</td>
                <td>${used}${maxUses !== "\u221E" ? "/" + maxUses : ""}</td>
                <td>${statusBadge}</td>
                <td>${isDynamic ? "\u{1F3B2} S\xED" : "\u{1F4CC} No"}</td>
                <td style="font-size:0.8rem;">${k.un_solo_uso ? "\u{1F512} 1 uso" : ""} ${tags}</td>
                <td style="display:flex;flex-wrap:wrap;gap:4px;">
                    <button onclick="action('block','${k.key}')" class="btn-sm" style="background:#ff4444;">Bloquear</button>
                    <button onclick="action('unblock','${k.key}')" class="btn-sm" style="background:#ff8800;">Desbloquear</button>
                    <button onclick="action('reset','${k.key}')" class="btn-sm" style="background:#ffaa00;">Reiniciar</button>
                    ${deleteBtn}
                    <button onclick="action('unbind','${k.key}')" class="btn-sm" style="background:#8888ff;">Desvincular</button>
                    ${isDynamic ? `<button onclick="action('renew','${k.key}')" class="btn-sm" style="background:#00cc88;">Renovar +30d</button>` : ""}
                </td>
            </tr>
        `;
  });
  const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>\u{1F30A} Ocean Hub - Admin</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding:20px; }
            .container { max-width:1400px; margin:0 auto; }
            h1 { color: #00ccff; margin-bottom:20px; display:flex; align-items:center; gap:15px; }
            h1 small { font-size:0.9rem; color:#88bbdd; font-weight:normal; }
            .hud-actions {
                background: rgba(0, 20, 40, 0.7); border: 3px solid #00ccff; border-radius: 20px;
                padding: 20px 25px; margin: 20px 0 30px 0; display: flex; flex-wrap: wrap;
                align-items: center; gap: 15px; backdrop-filter: blur(6px);
                box-shadow: 0 0 40px rgba(0,200,255,0.15), inset 0 0 30px rgba(0,200,255,0.05);
                position: relative;
            }
            .hud-actions::before {
                content: "\u26A1 PANEL DE CONTROL"; position: absolute; top: -12px; left: 20px;
                background: #0a1a2b; padding: 0 15px; font-size: 0.8rem; font-weight: bold;
                color: #88ddff; letter-spacing: 2px; border-radius: 30px;
                border: 1px solid #00ccff; backdrop-filter: blur(4px);
            }
            .hud-actions button, .hud-actions a {
                padding: 10px 22px; border: none; border-radius: 40px;
                background: rgba(0,200,255,0.15); color: white; cursor: pointer;
                transition: all 0.25s; text-decoration: none; font-size: 0.95rem;
                font-weight: 500; border: 1px solid transparent;
            }
            .hud-actions button:hover, .hud-actions a:hover {
                background: #00ccff; color: #0a1a2b; transform: scale(1.02);
                box-shadow: 0 0 25px rgba(0,200,255,0.4);
            }
            .hud-actions a { background: rgba(0,200,255,0.1); border-color: rgba(0,200,255,0.2); }
            .hud-actions a:hover { background: #00ccff; border-color: #00ccff; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:15px; margin-bottom:25px; }
            .stat-box { background:rgba(255,255,255,0.05); border-radius:15px; padding:15px 20px; text-align:center; transition:0.3s; }
            .stat-box:hover { background:rgba(255,255,255,0.1); }
            .stat-box .num { font-size:2rem; font-weight:bold; color:#00ccff; }
            .stat-box .label { font-size:0.85rem; opacity:0.7; }
            .stat-box .num.valid { color:#00cc88; }
            .stat-box .num.invalid { color:#ff6666; }
            .table-wrapper { overflow-x:auto; margin-top:20px; border-radius:15px; background:rgba(255,255,255,0.03); padding:5px; }
            table { width:100%; border-collapse:collapse; font-size:0.9rem; }
            th, td { padding:12px 10px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.06); }
            th { background:rgba(0,0,0,0.3); color:#88ccff; font-weight:600; position:sticky; top:0; z-index:10; }
            td { vertical-align:middle; }
            td button.btn-sm { padding:4px 12px; border:none; border-radius:20px; color:white; cursor:pointer; transition:0.2s; font-size:0.8rem; }
            td button.btn-sm:hover { opacity:0.8; transform:scale(0.96); }
            .chart-container { display:flex; flex-wrap:wrap; gap:20px; margin-top:30px; }
            .chart-box { background:rgba(255,255,255,0.04); border-radius:20px; padding:20px; flex:1; min-width:280px; }
            .modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:1000; justify-content:center; align-items:center; }
            .modal.active { display:flex; }
            .modal-content { background:#1b3a5c; border-radius:30px; padding:30px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.8); animation:fadeIn 0.3s ease; }
            .modal-content h2 { color:#00ccff; margin-bottom:15px; }
            .modal-content input, .modal-content select, .modal-content textarea { width:100%; padding:12px; margin:8px 0; border-radius:12px; border:none; background:rgba(255,255,255,0.08); color:white; font-size:1rem; }
            .modal-content input::placeholder, .modal-content textarea::placeholder { color:#aac; }
            .modal-content select option { background:#1b3a5c; }
            .modal-content button { padding:10px 25px; border:none; border-radius:30px; background:#00ccff; color:#0a1a2b; cursor:pointer; font-weight:bold; transition:0.3s; margin-top:10px; }
            .modal-content button:hover { background:#33ddff; }
            .modal-content .close { float:right; background:none; border:none; color:white; font-size:2rem; cursor:pointer; }
            .modal-content .close:hover { color:#ff6666; }
            .batch-keys { background:rgba(0,0,0,0.3); border-radius:12px; padding:15px; margin:10px 0; font-family: monospace; font-size:0.9rem; word-break:break-all; }
            .batch-keys span { display:block; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
            @keyframes fadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            @media (max-width:600px) {
                table { font-size:0.75rem; }
                td button.btn-sm { font-size:0.7rem; padding:2px 8px; }
                .stats-grid { grid-template-columns:1fr 1fr; }
                .hud-actions { flex-direction: column; align-items: stretch; }
            }
            .ingresos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap:10px; margin:15px 0; }
            .ingreso-item { background:rgba(0,200,255,0.08); border-radius:12px; padding:10px; text-align:center; }
            .ingreso-item .valor { font-size:1.5rem; color:#ffcc00; }
            .ingreso-item .etiqueta { font-size:0.8rem; opacity:0.7; }
        </style>
    </head>
    <body>
    <div class="container">
        <h1>\u{1F510} Panel de Administraci\xF3n <small>Ocean Hub</small></h1>

        <div class="stats-grid">
            <div class="stat-box"><div class="num">${stats.total_verifications || 0}</div><div class="label">Total</div></div>
            <div class="stat-box"><div class="num valid">${stats.valid_verifications || 0}</div><div class="label">V\xE1lidas</div></div>
            <div class="stat-box"><div class="num invalid">${stats.invalid_verifications || 0}</div><div class="label">Inv\xE1lidas</div></div>
            <div class="stat-box"><div class="num">${STATIC_KEYS.length}</div><div class="label">Est\xE1ticas</div></div>
            <div class="stat-box"><div class="num">${Object.keys(dynamicKeys).length}</div><div class="label">Din\xE1micas</div></div>
            <div class="stat-box"><div class="num">${Object.values(stats.keys_usage || {}).filter((u) => u.count > 0).length}</div><div class="label">Usadas</div></div>
            <div class="stat-box"><div class="num">${stats.sales?.total || 0}</div><div class="label">Ventas</div></div>
            <div class="stat-box"><div class="num">$${(stats.sales?.revenue || 0).toFixed(2)}</div><div class="label">Ingresos totales</div></div>
        </div>

        <div class="ingresos-grid">
            <div class="ingreso-item"><div class="valor">$${ingresosData.dia?.toFixed(2) || "0.00"}</div><div class="etiqueta">Hoy</div></div>
            <div class="ingreso-item"><div class="valor">$${ingresosData.semana?.toFixed(2) || "0.00"}</div><div class="etiqueta">\xDAltima semana</div></div>
            <div class="ingreso-item"><div class="valor">$${ingresosData.mes?.toFixed(2) || "0.00"}</div><div class="etiqueta">\xDAltimo mes</div></div>
            <div class="ingreso-item"><div class="valor">${ingresosData.producto_mas_vendido || "Ninguno"}</div><div class="etiqueta">Producto m\xE1s vendido</div></div>
        </div>

        <div class="hud-actions">
            <button onclick="openGenerateModal()">\u2795 Generar clave</button>
            <button onclick="openBatchModal()">\u{1F3B2} Lote (5)</button>
            <button onclick="openPruebaModal()">\u{1F9EA} Generar prueba</button>
            <button onclick="openResellerModal()">\u{1F465} Hacer revendedor</button>
            <a href="/export-csv">\u{1F4E5} Exportar CSV</a>
            <a href="/export-json">\u{1F4E5} Exportar JSON</a>
            <a href="/admin/compras" style="background:rgba(255,200,0,0.2);">\u{1F4CA} Ver compras</a>
            <a href="/admin/logs" style="background:rgba(0,200,255,0.2);">\u{1F4CB} Logs</a>
            <a href="/admin/resellers" style="background:rgba(255,200,0,0.2);">\u{1F465} Revendedores</a>
            <a href="/admin/users" style="background:rgba(0,200,255,0.2);">\u{1F464} Usuarios</a>
            <button onclick="doBackup()" style="background:rgba(255,100,0,0.3);">\u{1F4BE} Backup</button>
            <button onclick="openUploadModal()" style="background:rgba(0,200,100,0.3);">\u{1F4E4} Subir CSV</button>
            <button onclick="location.reload()">\u{1F504} Refrescar</button>
            <a href="/profile" style="background:rgba(0,200,255,0.2);">\u{1F464} Mi perfil</a>
        </div>

        <div class="table-wrapper">
            <table>
                <thead><tr><th>Clave</th><th>Rango</th><th>Tipo</th><th>Duraci\xF3n</th><th>Usos</th><th>Estado</th><th>Din\xE1mica</th><th>Tags/Notas</th><th>Acciones</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>

        <div class="chart-container">
            <div class="chart-box"><canvas id="hourlyChart"></canvas></div>
            <div class="chart-box"><canvas id="dailyChart"></canvas></div>
        </div>
    </div>

    <!-- Modales -->
    <div class="modal" id="genModal">
        <div class="modal-content">
            <button class="close" onclick="closeModal('genModal')">&times;</button>
            <h2>\u{1F511} Generar clave</h2>
            <input type="text" id="genKey" placeholder="Clave (dejar vac\xEDo para aleatoria)">
            <input type="text" id="genRango" placeholder="Rango personalizado (ej: \u{1F31F} VIP Especial)" value="\u{1F988} Tibur\xF3n">
            <select id="genType">
                <option value="gratuita">Gratuita</option>
                <option value="premium" selected>Premium</option>
                <option value="vip">VIP</option>
                <option value="staff">Staff</option>
                <option value="prueba">Prueba</option>
            </select>
            <input type="text" id="genExpires" placeholder="Duraci\xF3n (ej: 30 d\xEDas, 1 a\xF1o, permanente)" value="30 d\xEDas">
            <input type="number" id="genMaxUses" placeholder="L\xEDmite de usos (infinito si vac\xEDo)">
            <input type="text" id="genTags" placeholder="Tags separados por coma (ej: evento, vip)">
            <textarea id="genNotas" placeholder="Notas internas" rows="2"></textarea>
            <label style="display:flex;align-items:center;gap:10px;margin:8px 0;">
                <input type="checkbox" id="genUnSoloUso"> Un solo uso
            </label>
            <input type="password" id="genPin" placeholder="PIN de seguridad">
            <button onclick="generateKey()">Generar</button>
            <div id="genResult" style="margin-top:12px;color:#88ddff;"></div>
        </div>
    </div>

    <div class="modal" id="batchModal">
        <div class="modal-content">
            <button class="close" onclick="closeModal('batchModal')">&times;</button>
            <h2>\u{1F3B2} Lote de claves</h2>
            <p>Se generar\xE1n <strong>5 claves</strong> con tipo <em>premium</em>, rango <em>\u{1F988} Tibur\xF3n</em> y duraci\xF3n <em>30 d\xEDas</em>.</p>
            <input type="password" id="batchPin" placeholder="PIN de seguridad">
            <button onclick="generateBatch()">Generar lote</button>
            <div id="batchResult" style="margin-top:15px;"></div>
        </div>
    </div>

    <div class="modal" id="pruebaModal">
        <div class="modal-content">
            <button class="close" onclick="closeModal('pruebaModal')">&times;</button>
            <h2>\u{1F9EA} Generar clave de prueba</h2>
            <p>Clave temporal de un solo uso.</p>
            <select id="pruebaHoras">
                <option value="1">1 hora</option>
                <option value="3">3 horas</option>
                <option value="6">6 horas</option>
            </select>
            <input type="password" id="pruebaPin" placeholder="PIN de seguridad">
            <button onclick="generarPrueba()">Generar</button>
            <div id="pruebaResult" style="margin-top:12px;"></div>
        </div>
    </div>

    <div class="modal" id="resellerModal">
        <div class="modal-content">
            <button class="close" onclick="closeModal('resellerModal')">&times;</button>
            <h2>\u{1F465} Hacer revendedor</h2>
            <p>Convierte un usuario existente en revendedor.</p>
            <input type="email" id="resellerEmail" placeholder="Email del usuario" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
            <input type="number" id="resellerPorcentaje" placeholder="% de comisi\xF3n (ej: 25)" value="25" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
            <input type="password" id="resellerPin" placeholder="PIN de seguridad" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
            <button onclick="hacerReseller()">Convertir</button>
            <div id="resellerResult" style="margin-top:12px;"></div>
        </div>
    </div>

    <div class="modal" id="uploadModal">
        <div class="modal-content">
            <button class="close" onclick="closeModal('uploadModal')">&times;</button>
            <h2>\u{1F4E4} Subir archivo CSV</h2>
            <p>Sube un CSV con una lista de claves (una por l\xEDnea).</p>
            <form id="uploadForm" enctype="multipart/form-data">
                <input type="file" name="file" accept=".csv,.txt" style="background:transparent;border:1px solid #00ccff;padding:10px;border-radius:10px;">
                <input type="password" id="uploadPin" placeholder="PIN de seguridad" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <button type="button" onclick="uploadKeys()">Subir</button>
            </form>
            <div id="uploadResult" style="margin-top:12px;"></div>
        </div>
    </div>

    <script>
        
        

        function action(type, key) {
            const pin = prompt('Introduce el PIN de seguridad:');
            
            let url = '/admin-action?action='+type+'&key='+encodeURIComponent(key)+'&pin='+encodeURIComponent(pin);
            if (type === 'renew') {
                const days = prompt('\xBFCu\xE1ntos d\xEDas renovar? (30 por defecto)', '30');
                if (!days) return;
                url += '&days='+parseInt(days);
            }
            fetch(url)
            .then(res => res.json())
            .then(data => {
                alert(data.message || data.error);
                location.reload();
            })
            .catch(err => alert('Error: ' + err));
        }

        function openGenerateModal() { document.getElementById('genModal').classList.add('active'); }
        function openBatchModal() { document.getElementById('batchModal').classList.add('active'); }
        function openPruebaModal() { document.getElementById('pruebaModal').classList.add('active'); }
        function openResellerModal() { document.getElementById('resellerModal').classList.add('active'); }
        function openUploadModal() { document.getElementById('uploadModal').classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }

        function generateKey() {
            const key = document.getElementById('genKey').value.trim() || undefined;
            const rango = document.getElementById('genRango').value.trim() || '\u{1F988} Tibur\xF3n';
            const type = document.getElementById('genType').value;
            const expires = document.getElementById('genExpires').value.trim() || '30 d\xEDas';
            const maxUses = document.getElementById('genMaxUses').value;
            const tags = document.getElementById('genTags').value.trim();
            const notas = document.getElementById('genNotas').value.trim();
            const un_solo_uso = document.getElementById('genUnSoloUso').checked;
            const pin = document.getElementById('genPin').value;
            
            const payload = { key, rango, type, expires, maxUses: maxUses ? parseInt(maxUses) : undefined, tags, notas, un_solo_uso, pin };
            fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('genResult').innerHTML = '\u274C ' + data.error;
                } else {
                    document.getElementById('genResult').innerHTML = '\u2705 ' + data.message;
                    setTimeout(() => location.reload(), 1500);
                }
            })
            .catch(err => alert('Error: '+err));
        }

        function generateBatch() {
            const pin = document.getElementById('batchPin').value;
            
            const count = 5;
            fetch('/generate-batch?count='+count+'&pin='+encodeURIComponent(pin))
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('batchResult').innerHTML = '\u274C ' + data.error;
                } else if (data.keys && data.keys.length > 0) {
                    let html = '<div class="batch-keys">';
                    data.keys.forEach(k => { html += '<span>\u{1F511} ' + k + '</span>'; });
                    html += '</div><p style="color:#88ddff;">\u2705 ' + data.keys.length + ' claves generadas.</p>';
                    document.getElementById('batchResult').innerHTML = html;
                    setTimeout(() => location.reload(), 2000);
                } else {
                    document.getElementById('batchResult').innerHTML = '<p style="color:#ff8888;">No se generaron claves.</p>';
                }
            })
            .catch(err => alert('Error: '+err));
        }

        function generarPrueba() {
            const horas = parseInt(document.getElementById('pruebaHoras').value);
            const pin = document.getElementById('pruebaPin').value;
            
            fetch('/admin/generar-prueba', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ horas, pin })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('pruebaResult').innerHTML = '\u274C ' + data.error;
                } else {
                    document.getElementById('pruebaResult').innerHTML = '\u2705 Clave de prueba: <code>' + data.key + '</code> (' + data.horas + 'h)';
                    setTimeout(() => location.reload(), 2000);
                }
            })
            .catch(err => alert('Error: '+err));
        }

        function hacerReseller() {
            const email = document.getElementById('resellerEmail').value.trim();
            const porcentaje = parseInt(document.getElementById('resellerPorcentaje').value) || 25;
            const pin = document.getElementById('resellerPin').value;
            if (!email) { alert('Introduce un email'); return; }
            
            fetch('/admin/hacer-reseller', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, porcentaje })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('resellerResult').innerHTML = '\u274C ' + data.error;
                } else {
                    document.getElementById('resellerResult').innerHTML = '\u2705 ' + data.message;
                    setTimeout(() => location.reload(), 1500);
                }
            })
            .catch(err => alert('Error: '+err));
        }

        function uploadKeys() {
            const pin = document.getElementById('uploadPin').value;
            
            const form = document.getElementById('uploadForm');
            const formData = new FormData(form);
            formData.append('pin', pin);
            fetch('/admin/upload-keys', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                document.getElementById('uploadResult').innerHTML = data.message || data.error;
                if (data.message) setTimeout(() => location.reload(), 2000);
            })
            .catch(err => alert('Error: '+err));
        }

        function doBackup() {
            if (confirm('\xBFRealizar backup del KV? Esto puede tomar unos segundos.')) {
                fetch('/admin/backup', { method: 'POST' })
                .then(res => res.json())
                .then(data => alert(data.message))
                .catch(err => alert('Error: '+err));
            }
        }

        const hourlyLabels = ${JSON.stringify(hourlyLabels)};
        const hourlyData = ${JSON.stringify(hourlyData)};
        const dailyLabels = ${JSON.stringify(dailyLabels)};
        const dailyValid = ${JSON.stringify(dailyValid)};
        const dailyInvalid = ${JSON.stringify(dailyInvalid)};

        new Chart(document.getElementById('hourlyChart'), {
            type: 'bar',
            data: {
                labels: hourlyLabels,
                datasets: [{ label: 'Verificaciones por hora', data: hourlyData, backgroundColor: 'rgba(0,200,255,0.6)', borderColor: '#00ccff', borderWidth: 1 }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
        });

        new Chart(document.getElementById('dailyChart'), {
            type: 'bar',
            data: {
                labels: dailyLabels,
                datasets: [
                    { label: 'V\xE1lidas', data: dailyValid, backgroundColor: 'rgba(0,204,136,0.6)', borderColor: '#00cc88', borderWidth: 1 },
                    { label: 'Inv\xE1lidas', data: dailyInvalid, backgroundColor: 'rgba(255,68,68,0.6)', borderColor: '#ff4444', borderWidth: 1 }
                ]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
        });
    <\/script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleAdminRoute, "handleAdminRoute");
async function handleAdminUsers(env, url, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return new Response("No autorizado", { status: 403 });
  const users = await getAllUsers(env);
  let rows = users.map((u) => `
        <tr>
            <td>${escapeHTML(u.email)}</td>
            <td>${escapeHTML(u.name || "")}</td>
            <td>${escapeHTML(u.role)}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>${u.last_login ? new Date(u.last_login).toLocaleString() : "Nunca"}</td>
            <td>${u.points || 0}</td>
            <td>
                <select onchange="cambiarRol(${escapeJSAttribute(u.email)}, this.value)">
                    <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                    <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                    <option value="reseller" ${u.role === "reseller" ? "selected" : ""}>Reseller</option>
                </select>
                <button onclick="eliminarUsuario(${escapeJSAttribute(u.email)})">\u{1F5D1}\uFE0F</button>
            </td>
        </tr>
    `).join("");
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F464} Gesti\xF3n de Usuarios</title>
    <style>
        body { background:#0a1a2b; color:#e0f0ff; font-family:'Segoe UI',sans-serif; padding:20px; }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); }
        th { color:#88ccff; }
        .btn { padding:4px 12px; border-radius:20px; border:none; cursor:pointer; }
        .btn-danger { background:#ff4444; color:white; }
        .btn-danger:hover { background:#ff6666; }
        .back { margin-top:20px; color:#00ccff; text-decoration:none; }
    </style>
    </head>
    <body>
    <h1>\u{1F464} Gesti\xF3n de Usuarios</h1>
    <div style="overflow-x:auto;">
        <table>
            <thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Registro</th><th>\xDAltimo login</th><th>Puntos</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    <a href="/admin" class="back">\u2190 Volver al panel</a>
    <script>
        
        function cambiarRol(email, newRole) {
            if (!confirm('\xBFCambiar rol de '+email+' a '+newRole+'?')) return;
            fetch('/admin/user-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'role', role: newRole })
            })
            .then(res => res.json())
            .then(data => alert(data.message))
            .catch(err => alert('Error: '+err));
        }
        function eliminarUsuario(email) {
            if (!confirm('\xBFEliminar usuario '+email+'? Esta acci\xF3n no se puede deshacer.')) return;
            const pin = prompt('Introduce el PIN de seguridad:');
            if (!pin) return;
            fetch('/admin/user-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'delete', pin })
            })
            .then(res => res.json())
            .then(data => alert(data.message))
            .catch(err => alert('Error: '+err));
        }
    <\/script>
    ${getCookieBannerScript()}
    </body>
    </html>
    `;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleAdminUsers, "handleAdminUsers");
async function handleAdminUserAction(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { email, action, role, pin } = body;
  if (!email) return jsonResponse({ error: "Falta email" }, 400);
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) return jsonResponse({ error: "PIN incorrecto" }, 403);
  const user = await getUserByEmail(env, email);
  if (!user) return jsonResponse({ error: "Usuario no encontrado" }, 404);
  if (action === "role") {
    if (!role) return jsonResponse({ error: "Falta rol" }, 400);
    user.role = role;
    await env.STATS.put(`user_${email}`, JSON.stringify(user));
    await logAdminAction(env, "change_role", email, getClientIP(request), { newRole: role });
    return jsonResponse({ message: `Rol de ${email} actualizado a ${role}` });
  } else if (action === "delete") {
    await env.STATS.delete(`user_${email}`);
    await logAdminAction(env, "delete_user", email, getClientIP(request), {});
    return jsonResponse({ message: `Usuario ${email} eliminado` });
  } else {
    return jsonResponse({ error: "Acci\xF3n no v\xE1lida" }, 400);
  }
}
__name(handleAdminUserAction, "handleAdminUserAction");
async function getAllUsers(env) {
  const users = [];
  let cursor;
  do {
    const page = await env.STATS.list({ prefix: "user_", cursor, limit: 1e3 });
    for (let i = 0; i < page.keys.length; i += 50) {
      const batch = page.keys.slice(i, i + 50);
      const values = await Promise.all(batch.map((k) => env.STATS.get(k.name)));
      for (const raw of values) {
        if (!raw) continue;
        try {
          users.push(JSON.parse(raw));
        } catch (e) {
          console.error("Usuario KV inv\xE1lido:", e);
        }
      }
    }
    cursor = page.list_complete ? void 0 : page.cursor;
  } while (cursor);
  return users;
}
__name(getAllUsers, "getAllUsers");
async function handleBackup(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const backup = await backupKV(env);
  return jsonResponse({ message: "Backup realizado con \xE9xito", keys: Object.keys(backup).length });
}
__name(handleBackup, "handleBackup");
async function handleUploadKeys(env, request) {
  const auth = await requireAdmin(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const formData = await request.formData();
  const file = formData.get("file");
  const pin = formData.get("pin");
  const adminPin = env.ADMIN_SECOND_PIN;
  if (!adminPin || !timingSafeCompare(String(pin || ""), String(adminPin))) return jsonResponse({ error: "PIN incorrecto" }, 403);
  if (!file) return jsonResponse({ error: "No se subi\xF3 ning\xFAn archivo" }, 400);
  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());
  let generated = 0;
  for (const line of lines) {
    const key = line.trim();
    if (!key) continue;
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (!dyn[hash] && !STATIC_KEYS.some((k) => k.hash === hash)) {
      const keyData = {
        key,
        type: "premium",
        rango: "\u{1F4E4} Subido",
        expires: "30 d\xEDas",
        dynamic: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        blocked: false,
        count: 0,
        history: [],
        tags: ["csv"],
        notas: "Subido por CSV",
        un_solo_uso: false,
        change_log: [{ action: "created_from_csv", timestamp: (/* @__PURE__ */ new Date()).toISOString() }]
      };
      await saveDynamicKey(env, keyData);
      generated++;
    }
  }
  await logAdminAction(env, "upload_csv", "batch", getClientIP(request), { count: generated });
  return jsonResponse({ message: `${generated} claves generadas desde CSV` });
}
__name(handleUploadKeys, "handleUploadKeys");
async function handleDiscordAuth(env) {
  const clientId = env.DISCORD_CLIENT_ID;
  if (!clientId) return new Response("Discord OAuth no configurado", { status: 400 });
  const redirectUri = `${getBaseUrl(env)}/auth/discord/callback`;
  const scope = "identify email";
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  return Response.redirect(authUrl, 302);
}
__name(handleDiscordAuth, "handleDiscordAuth");
async function handleDiscordCallback(env, request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("Falta c\xF3digo", { status: 400 });
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response("OAuth no configurado", { status: 400 });
  const redirectUri = `${getBaseUrl(env)}/auth/discord/callback`;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return new Response(`Error al obtener token de Discord:<br><pre>${JSON.stringify(tokenData, null, 2)}</pre>`, {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}` }
  });
  const userData = await userRes.json();
  const email = userData.email;
  if (!email || userData.verified !== true) return new Response("El email de Discord debe estar verificado.", { status: 400 });
  let user = await getUserByEmail(env, email);
  if (!user) {
    const randomPass = generateRandomHex(12);
    try {
      user = await createUser(env, email, userData.username || email.split("@")[0], randomPass, null);
    } catch (e) {
      return new Response("Error al crear usuario: " + e.message, { status: 500 });
    }
  }
  await logUserAction(env, email, "login", { ip: getClientIP(request), method: "discord" });
  const sessionToken = await createSession(env, user);
  const cookie = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">\u2705 Sesi\xF3n iniciada con Discord</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie } });
}
__name(handleDiscordCallback, "handleDiscordCallback");
async function handleGoogleAuth(env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("Google OAuth no configurado", { status: 400 });
  const redirectUri = `${getBaseUrl(env)}/auth/google/callback`;
  const scope = "email profile";
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=online`;
  return Response.redirect(authUrl, 302);
}
__name(handleGoogleAuth, "handleGoogleAuth");
async function handleGoogleCallback(env, request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("Falta c\xF3digo", { status: 400 });
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response("OAuth no configurado", { status: 400 });
  const redirectUri = `${getBaseUrl(env)}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return new Response(`Error al obtener token de Google:<br><pre>${JSON.stringify(tokenData, null, 2)}</pre>`, {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}` }
  });
  const userData = await userRes.json();
  const email = userData.email;
  if (!email || userData.verified_email !== true) return new Response("El email de Google debe estar verificado.", { status: 400 });
  let user = await getUserByEmail(env, email);
  if (!user) {
    const randomPass = generateRandomHex(12);
    try {
      user = await createUser(env, email, userData.name || email.split("@")[0], randomPass, null);
    } catch (e) {
      return new Response("Error al crear usuario: " + e.message, { status: 500 });
    }
  }
  await logUserAction(env, email, "login", { ip: getClientIP(request), method: "google" });
  const sessionToken = await createSession(env, user);
  const cookie = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
  return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">\u2705 Sesi\xF3n iniciada con Google</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { "Content-Type": "text/html", "Set-Cookie": cookie } });
}
__name(handleGoogleCallback, "handleGoogleCallback");
async function handleReview(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { productoId, rating, comment } = body;
  if (!productoId || !rating) return jsonResponse({ error: "Faltan campos" }, 400);
  if (rating < 1 || rating > 5) return jsonResponse({ error: "Rating debe ser entre 1 y 5" }, 400);
  const key = `review_${productoId}_${auth.user.email}`;
  await env.STATS.put(key, JSON.stringify({
    rating,
    comment: comment || "",
    date: (/* @__PURE__ */ new Date()).toISOString(),
    email: auth.user.email,
    name: auth.user.name
  }));
  return jsonResponse({ message: "Review guardada" });
}
__name(handleReview, "handleReview");
async function handleGetReviews(env, url) {
  const productoId = url.searchParams.get("productoId");
  if (!productoId) return jsonResponse({ error: "Falta productoId" }, 400);
  const list = await env.STATS.list({ prefix: `review_${productoId}_` });
  const reviews = [];
  for (const key of list.keys) {
    const raw = await env.STATS.get(key.name);
    if (raw) reviews.push(JSON.parse(raw));
  }
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return jsonResponse({ reviews, average: avg, count: reviews.length });
}
__name(handleGetReviews, "handleGetReviews");
async function handleRegisterWebhook(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { url } = body;
  if (!url) return jsonResponse({ error: "Falta URL" }, 400);
  await env.STATS.put(`webhook_${auth.user.email}`, JSON.stringify({ url, created: (/* @__PURE__ */ new Date()).toISOString() }));
  return jsonResponse({ message: "Webhook registrado" });
}
__name(handleRegisterWebhook, "handleRegisterWebhook");
async function handleActivate2FA(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const secret = generateTOTPSecret();
  const otpauth = buildOTPAuthURI(secret, auth.user.email, "Ocean Hub");
  auth.user.otp_secret = secret;
  await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
  return jsonResponse({ message: "2FA activado. Escanea el QR o usa el secreto manualmente.", secret, otpauth, qrUrl });
}
__name(handleActivate2FA, "handleActivate2FA");
async function handleUser2FAQR(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return new Response("No autorizado", { status: 401 });
  const secret = String(auth.user.otp_secret || "").trim().replace(/=+$/, "").toUpperCase();
  if (!/^[A-Z2-7]{16,128}$/.test(secret)) return new Response("2FA no configurado", { status: 400 });
  const otpauth = buildOTPAuthURI(secret, auth.user.email, "Ocean Hub");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
  return new Response(`<!doctype html><html><body style="background:#0a1a2b;color:white;font-family:Segoe UI,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;text-align:center;padding:20px">
        <h2 style="color:#00ccff">\u{1F4F1} Configurar 2FA</h2>
        <img src="${escapeHTML(qrUrl)}" alt="QR 2FA" style="width:300px;height:300px;border-radius:16px;background:white;padding:8px">
        <p>Escanea el QR con Google Authenticator, Authy u otra app TOTP.</p>
        <p><strong>Secreto:</strong> <code>${escapeHTML(secret)}</code></p>
        <p style="max-width:650px;word-break:break-all;color:#88aacc"><strong>URI:</strong> ${escapeHTML(otpauth)}</p>
        <a href="/profile" style="color:#00ccff">\u2190 Volver al perfil</a>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleUser2FAQR, "handleUser2FAQR");
async function handleDeactivate2FA(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  auth.user.otp_secret = null;
  await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
  return jsonResponse({ message: "2FA desactivado" });
}
__name(handleDeactivate2FA, "handleDeactivate2FA");
async function handleRedeemPoints(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  const { points } = body;
  if (!points || points < 0) return jsonResponse({ error: "Puntos inv\xE1lidos" }, 400);
  if (auth.user.points < points) return jsonResponse({ error: "Puntos insuficientes" }, 400);
  auth.user.points -= points;
  await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
  return jsonResponse({ message: `Canjeados ${points} puntos. Saldo restante: ${auth.user.points}` });
}
__name(handleRedeemPoints, "handleRedeemPoints");
async function handlePayPalWebhook(env, request) {
  if (request.method !== "POST") return jsonResponse({ error: "M\xE9todo no permitido" }, 405);
  if (!env.PAYPAL_WEBHOOK_ID) return jsonResponse({ error: "Webhook no configurado" }, 503);
  const raw = await request.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "JSON inv\xE1lido" }, 400);
  }
  const accessToken = await getPayPalAccessToken(env);
  const verifyPayload = {
    auth_algo: request.headers.get("PAYPAL-AUTH-ALGO"),
    cert_url: request.headers.get("PAYPAL-CERT-URL"),
    transmission_id: request.headers.get("PAYPAL-TRANSMISSION-ID"),
    transmission_sig: request.headers.get("PAYPAL-TRANSMISSION-SIG"),
    transmission_time: request.headers.get("PAYPAL-TRANSMISSION-TIME"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: body
  };
  if (Object.values(verifyPayload).some((v) => !v)) return jsonResponse({ error: "Firma incompleta" }, 400);
  const vr = await fetch(`${getPayPalApiUrl(env)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(verifyPayload)
  });
  const vd = await vr.json();
  if (!vr.ok || vd.verification_status !== "SUCCESS") return jsonResponse({ error: "Firma no v\xE1lida" }, 403);
  if (body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = body.resource?.supplementary_data?.related_ids?.order_id || body.resource?.id;
    if (!orderId) return jsonResponse({ error: "orderId ausente" }, 400);
    return await handlePayPalCapture(env, new Request(`${getBaseUrl(env)}/paypal/capture?orderId=${encodeURIComponent(orderId)}`));
  }
  return jsonResponse({ status: "ok" });
}
__name(handlePayPalWebhook, "handlePayPalWebhook");
async function handleLeaderboard(env) {
  const data = await env.STATS.get("leaderboard", "json") || [];
  let html = `<html><head><meta charset="UTF-8"><title>\u{1F3C6} Ranking</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:10px;border-bottom:1px solid #333;}</style>
    </head><body><h1 style="color:#ffcc00;">\u{1F3C6} Ranking de usuarios</h1><table><thead><tr><th>#</th><th>Usuario</th><th>Puntuaci\xF3n</th></tr></thead><tbody>`;
  data.forEach((u, i) => {
    html += `<tr><td>${i + 1}</td><td>${escapeHTML(u.name || u.email)}</td><td>${u.score}</td></tr>`;
  });
  html += `</tbody></table><a href="/home" style="color:#00ccff;">\u2190 Volver</a>${getCookieBannerScript()}${getLegalFooter()}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
__name(handleLeaderboard, "handleLeaderboard");
async function handleToggleDarkMode(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
  const body = await request.json();
  auth.user.dark_mode = body.dark || false;
  await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
  return jsonResponse({ message: "Preferencia guardada" });
}
__name(handleToggleDarkMode, "handleToggleDarkMode");
async function handleWelcome(env, request) {
  const auth = await requireAuth(env, request);
  if (auth) {
    return Response.redirect(`${getBaseUrl(env)}/home`, 302);
  }
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\u{1F30A} Ocean Hub</title>
<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { height: 100%; overflow: hidden; }
    body {
        background: linear-gradient(145deg, #0a1a2b 0%, #1b3a5c 100%);
        color: #e0f0ff;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        display: flex; justify-content: center; align-items: center;
        position: relative;
    }
    .ocean-bg { position: fixed; inset: 0; overflow: hidden; z-index: 0; }
    .bubble {
        position: absolute; bottom: -100px;
        background: radial-gradient(circle at 30% 30%, rgba(0,220,255,0.6), rgba(0,120,200,0.15));
        border-radius: 50%;
        opacity: 0.5;
        animation: rise linear infinite;
    }
    @keyframes rise {
        0%   { transform: translateY(0) scale(0.6); opacity: 0; }
        20%  { opacity: 0.6; }
        100% { transform: translateY(-120vh) scale(1.2); opacity: 0; }
    }
    .wave-bg::before, .wave-bg::after {
        content:''; position: absolute; left:50%; top:50%;
        width: 220%; height: 220%;
        background: radial-gradient(circle, rgba(0,200,255,0.10) 0%, transparent 55%);
        border-radius: 45%;
        transform: translate(-50%,-50%) rotate(0deg);
        animation: rotate 22s linear infinite;
    }
    .wave-bg::after {
        animation-duration: 32s; animation-direction: reverse;
        background: radial-gradient(circle, rgba(0,100,200,0.10) 0%, transparent 55%);
    }
    @keyframes rotate { to { transform: translate(-50%,-50%) rotate(360deg); } }

    #loadingScreen {
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        background: linear-gradient(145deg, #0a1a2b 0%, #1b3a5c 100%);
        z-index: 100;
        transition: opacity 0.9s ease;
    }
    #loadingScreen.hidden { opacity: 0; pointer-events: none; }

    .loader {
        width: 90px; height: 90px;
        border: 4px solid rgba(0,200,255,0.15);
        border-top-color: #00ccff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 30px;
        box-shadow: 0 0 40px rgba(0,200,255,0.5), inset 0 0 20px rgba(0,200,255,0.2);
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    #loadingScreen h1 {
        font-size: 3rem;
        text-shadow: 0 0 25px #00ccff, 0 0 55px #0088ff;
        letter-spacing: 2px;
        animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.65; } }
    #loadingScreen p {
        margin-top: 18px;
        color: #88aacc;
        letter-spacing: 1px;
        font-size: 0.95rem;
    }
    .loading-dots::after {
        content: '';
        animation: dots 1.5s steps(4,end) infinite;
    }
    @keyframes dots { 0%{content:'';} 25%{content:'.';} 50%{content:'..';} 75%{content:'...';} }

    #welcomeContent {
        display: none;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 30px 20px;
        max-width: 520px;
        width: 100%;
        z-index: 5;
        position: relative;
    }
    #welcomeContent.visible {
        display: flex;
        animation: fadeUp 0.9s ease;
    }
    @keyframes fadeUp {
        from { opacity:0; transform: translateY(40px); }
        to   { opacity:1; transform: translateY(0); }
    }

    #welcomeContent h1 {
        font-size: 3rem;
        text-shadow: 0 0 25px #00ccff, 0 0 55px #0088ff;
        margin-bottom: 8px;
        letter-spacing: 1px;
    }
    #welcomeContent .subtitle {
        color: #88ddff;
        margin-bottom: 28px;
        font-size: 1.05rem;
        letter-spacing: 0.5px;
    }

    .terms-box {
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(0,200,255,0.3);
        border-radius: 18px;
        padding: 20px 22px;
        margin-bottom: 22px;
        text-align: left;
        font-size: 0.9rem;
        line-height: 1.6;
        max-height: 170px;
        overflow-y: auto;
        width: 100%;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    }
    .terms-box::-webkit-scrollbar { width: 6px; }
    .terms-box::-webkit-scrollbar-thumb { background: #00ccff66; border-radius: 3px; }
    .terms-box a { color: #00ccff; text-decoration: none; font-weight: 600; }
    .terms-box a:hover { text-decoration: underline; }

    .checkbox-container {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 22px;
        cursor: pointer;
        font-size: 0.92rem;
        color: #aaddff;
        text-align: left;
        padding: 0 5px;
        user-select: none;
    }
    .checkbox-container input[type="checkbox"] {
        width: 20px; height: 20px;
        accent-color: #00ccff;
        cursor: pointer;
        flex-shrink: 0;
        margin-top: 1px;
    }

    .buttons {
        display: flex;
        gap: 14px;
        width: 100%;
        justify-content: center;
        flex-wrap: wrap;
    }
    .btn {
        padding: 14px 34px;
        border: none;
        border-radius: 40px;
        font-size: 1.05rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-block;
        min-width: 165px;
        text-align: center;
    }
    .btn-primary {
        background: linear-gradient(135deg, #00ccff, #0088ff);
        color: #0a1a2b;
        box-shadow: 0 8px 25px rgba(0,200,255,0.45);
    }
    .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 40px rgba(0,200,255,0.65);
    }
    .btn-secondary {
        background: rgba(255,255,255,0.06);
        color: #00ccff;
        border: 2px solid #00ccff;
    }
    .btn-secondary:hover {
        background: rgba(0,200,255,0.15);
        transform: translateY(-3px);
        box-shadow: 0 10px 30px rgba(0,200,255,0.35);
    }
    .btn.disabled {
        opacity: 0.35;
        cursor: not-allowed;
        pointer-events: none;
        transform: none !important;
        box-shadow: none !important;
    }

    .footer-note {
        margin-top: 22px;
        font-size: 0.82rem;
        color: #7799bb;
        letter-spacing: 0.3px;
    }

    @media (max-width: 520px) {
        #welcomeContent h1 { font-size: 2.3rem; }
        #loadingScreen h1 { font-size: 2.3rem; }
        .btn { min-width: 130px; padding: 12px 24px; font-size: 1rem; }
    }
</style>
</head>
<body>

    <div class="ocean-bg">
        <div class="wave-bg"></div>
    </div>

    <div id="loadingScreen">
        <div class="loader"></div>
        <h1>\u{1F30A} Ocean Hub</h1>
        <p class="loading-dots">Sumergi\xE9ndonos en el oc\xE9ano</p>
    </div>

    <div id="welcomeContent">
        <h1>\u{1F30A} Ocean Hub</h1>
        <p class="subtitle">Tu portal de DLCs y claves premium</p>

        <div class="terms-box">
            <strong style="color:#00ccff;">\u{1F4DC} Antes de continuar, lee y acepta:</strong>
            <p style="margin-top:10px;">
                Al usar <strong>Ocean Hub</strong> declaras haber le\xEDdo y aceptado nuestros
                <a href="/terminos" target="_blank">T\xE9rminos y Condiciones</a>,
                la <a href="/privacidad" target="_blank">Pol\xEDtica de Privacidad</a>,
                el <a href="/aviso-legal" target="_blank">Aviso Legal</a>
                y la <a href="/cookies" target="_blank">Pol\xEDtica de Cookies</a>.
            </p>
            <p style="margin-top:8px;">
                Confirmas que eres mayor de edad o cuentas con autorizaci\xF3n legal, y que
                usar\xE1s el servicio de forma l\xEDcita y responsable. Todos los productos son
                bienes digitales con entrega inmediata y no reembolsables salvo error
                comprobado.
            </p>
            <p style="margin-top:8px;">
                \u{1F512} Tus datos se tratan conforme al RGPD. Puedes ejercer tus derechos
                escribiendo a nuestro correo de contacto.
            </p>
        </div>

        <label class="checkbox-container">
            <input type="checkbox" id="acceptTerms" onchange="toggleButtons()">
            <span>He le\xEDdo y acepto los t\xE9rminos, pol\xEDticas y condiciones de Ocean Hub.</span>
        </label>

        <div class="buttons">
            <a href="/login" class="btn btn-primary disabled" id="loginBtn"
               onclick="return checkAccepted(event)">\u{1F510} Iniciar sesi\xF3n</a>
            <a href="/register" class="btn btn-secondary disabled" id="registerBtn"
               onclick="return checkAccepted(event)">\u2728 Crear cuenta</a>
        </div>

        <p class="footer-note">\u{1F512} Debes iniciar sesi\xF3n para acceder al contenido de Ocean Hub</p>
    </div>

    <script>
        (function createBubbles() {
            const bg = document.querySelector('.ocean-bg');
            for (let i = 0; i < 18; i++) {
                const b = document.createElement('div');
                b.className = 'bubble';
                const size = 6 + Math.random() * 26;
                b.style.width = size + 'px';
                b.style.height = size + 'px';
                b.style.left = Math.random() * 100 + '%';
                b.style.animationDuration = (8 + Math.random() * 10) + 's';
                b.style.animationDelay = (-Math.random() * 12) + 's';
                bg.appendChild(b);
            }
        })();

        window.addEventListener('load', function() {
            const loadingScreen = document.getElementById('loadingScreen');
            const welcomeContent = document.getElementById('welcomeContent');

            setTimeout(function() {
                loadingScreen.classList.add('hidden');
                setTimeout(function() {
                    loadingScreen.style.display = 'none';
                    welcomeContent.classList.add('visible');

                    if (localStorage.getItem('ocean_terms_accepted') === '1') {
                        document.getElementById('acceptTerms').checked = true;
                        toggleButtons();
                    }
                }, 900);
            }, 2200);
        });

        function toggleButtons() {
            const accepted = document.getElementById('acceptTerms').checked;
            const loginBtn = document.getElementById('loginBtn');
            const registerBtn = document.getElementById('registerBtn');
            if (accepted) {
                loginBtn.classList.remove('disabled');
                registerBtn.classList.remove('disabled');
                localStorage.setItem('ocean_terms_accepted', '1');
            } else {
                loginBtn.classList.add('disabled');
                registerBtn.classList.add('disabled');
                localStorage.removeItem('ocean_terms_accepted');
            }
        }

        function checkAccepted(e) {
            if (!document.getElementById('acceptTerms').checked) {
                e.preventDefault();
                alert('\u26A0\uFE0F Debes aceptar los t\xE9rminos y pol\xEDticas antes de continuar.');
                return false;
            }
            return true;
        }
    <\/script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleWelcome, "handleWelcome");
async function handleSubscribe(env, request) {
  const auth = await requireAuth(env, request);
  if (!auth) {
    return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">\u{1F512} Necesitas iniciar sesi\xF3n</h2>
                    <a href="/login" style="color:#00ccff;">Iniciar sesi\xF3n</a>
                </div>
            </body></html>
        `, { status: 401, headers: { "Content-Type": "text/html" } });
  }
  let planesHtml = "";
  for (const [id, plan] of Object.entries(SUSCRIPCION_PLANES)) {
    planesHtml += `
            <div class="plan-card">
                <h3>${escapeHTML(plan.name)}</h3>
                <p>${escapeHTML(plan.description)}</p>
                <p>Duraci\xF3n: ${plan.days} d\xEDas</p>
                <div class="price">$${plan.price.toFixed(2)}</div>
                <button onclick="comprarSuscripcion('${id}')" class="btn-buy">Suscribirse</button>
            </div>
        `;
  }
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>\u{1F4C5} Suscripci\xF3n - Ocean Hub</title>
    <style>
        body { background: #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { max-width: 1000px; width: 100%; }
        h1 { color: #00ccff; text-align: center; }
        .plan-grid { display: flex; flex-wrap: wrap; gap: 30px; justify-content: center; margin: 30px 0; }
        .plan-card { background: rgba(255,255,255,0.06); border-radius: 20px; padding: 25px; width: 250px; border: 1px solid rgba(0,200,255,0.2); text-align: center; transition: 0.3s; }
        .plan-card:hover { transform: scale(1.03); box-shadow: 0 0 30px rgba(0,200,255,0.2); }
        .plan-card .price { font-size: 2rem; color: #ffcc00; margin: 15px 0; }
        .btn-buy { background: #0070ba; border: none; color: white; padding: 12px 30px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; transition: 0.3s; }
        .btn-buy:hover { background: #003087; }
        .back { margin-top: 30px; color: #00ccff; text-decoration: none; font-size: 1.2rem; }
    </style>
    </head>
    <body>
    <div class="container">
        <h1>\u{1F4C5} Planes de Suscripci\xF3n</h1>
        <div class="plan-grid">${planesHtml}</div>
        <a href="/profile" class="back">\u2190 Volver a mi perfil</a>
    </div>
    <script>
        function comprarSuscripcion(plan) {
            const email = '${auth.user.email}';
            fetch('/shop/create-checkout?tipo=suscripcion&plan=' + plan + '&email=' + encodeURIComponent(email))
                .then(res => res.json())
                .then(data => {
                    if (data.links && data.links.length) {
                        const approveLink = data.links.find(link => link.rel === 'approve');
                        if (approveLink) {
                            window.location.href = approveLink.href;
                        } else {
                            alert('Error: no se encontr\xF3 enlace de aprobaci\xF3n.');
                        }
                    } else {
                        alert('Error al crear la orden: ' + (data.error || 'desconocido'));
                    }
                })
                .catch(err => alert('Error: ' + err));
        }
    <\/script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { "Content-Type": "text/html" } });
}
__name(handleSubscribe, "handleSubscribe");
async function handlePaySubscription(env, request) {
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const email = url.searchParams.get("email");
  if (!plan || !email) {
    return jsonResponse({ error: "Faltan par\xE1metros (plan y email)" }, 400);
  }
  try {
    const order = await createPayPalOrderSuscripcion(env, plan, email);
    return jsonResponse(order);
  } catch (e) {
    return jsonResponse({ error: "No se pudo crear la orden de pago" }, 500);
  }
}
__name(handlePaySubscription, "handlePaySubscription");
async function handleCronJobs(env) {
  await updateLeaderboard(env);
  await backupKV(env);
  return jsonResponse({ message: "Cron jobs ejecutados" });
}
__name(handleCronJobs, "handleCronJobs");
function isPublicRoute(path) {
  const publicPaths = [
    "/welcome",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-2fa",
    "/logout",
    "/privacidad",
    "/aviso-legal",
    "/terminos",
    "/cookies",
    "/status",
    "/stats/public",
    "/get-nonce",
    "/verify-web",
    "/claim-key",
    "/paypal/capture",
    "/paypal/webhook",
    "/shop/success",
    "/shop/cancel",
    "/google53213708c5fda63c.html"
  ];
  if (publicPaths.includes(path)) return true;
  if (path.startsWith("/verify/")) return true;
  if (path.startsWith("/auth/")) return true;
  if (path.startsWith("/s/")) return true;
  return false;
}
__name(isPublicRoute, "isPublicRoute");
async function workerFetch(request, env) {
  await initStaticKeys(env);
  const url = new URL(request.url);
  const path = url.pathname;
  if (adminProtectedPath(path)) {
    const adminAuth = await requireAdmin(env, request);
    if (!adminAuth) return jsonResponse({ error: "No autorizado" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  if (!isPublicRoute(path)) {
    const auth = await requireAuth(env, request);
    if (!auth) {
      return Response.redirect(`${url.origin}/welcome`, 302);
    }
  }
  if (path === "/welcome") return await handleWelcome(env, request);
  if (path === "/" || path === "/home") return await handleHome(env);
  if (path === "/air-flow") return await handleAirFlow(env, request);
  if (path === "/air-flow/api/chat") return await handleAirFlowChat(env, request);
  if (path === "/air-flow/api/history") return await handleAirFlowHistory(env, request);
  if (path === "/air-flow/api/health") return await handleAirFlowHealth(env, request);
  if (path === "/shop") return await handleShop(env, request);
  if (path === "/pay") return await handlePay();
  if (path === "/sell") return await handleSell(env, request);
  if (path === "/dlc") return await handleDlc();
  if (path === "/key") return await handleKey();
  if (path === "/get-nonce") return await handleGetNonce(env, request);
  if (path.startsWith("/verify") && !path.startsWith("/verify-web") && !path.startsWith("/verify-batch")) {
    return await handleVerify(env, request);
  }
  if (path === "/verify-web") return await handleVerifyWeb(env, request);
  if (path === "/key-info") return await handleKeyInfo(env, url);
  if (path === "/admin") return await handleAdminRoute(env, url, request.headers, request);
  if (path === "/admin/compras") return await handleAdminCompras(env, url, request.headers);
  if (path === "/admin-action") return await handleAdminAction(env, url, request);
  if (path === "/generate") return await handleGenerate(env, request, url);
  if (path === "/generate-batch") return await handleGenerateBatch(env, url, request);
  if (path === "/export-csv") return await handleExportCsv(env, url);
  if (path === "/export-json") return await handleExportJson(env, url);
  if (path === "/webhook") return await handleWebhook(env, request);
  if (path === "/qr-totp") return await handleQR(env, url);
  if (path === "/sse") return await handleSSE(env);
  if (path === "/shop/create-checkout") {
    const tipo = url.searchParams.get("tipo") || "dlc";
    const email = url.searchParams.get("email") || "";
    const coupon = url.searchParams.get("coupon") || null;
    if (tipo === "suscripcion") {
      const plan = url.searchParams.get("plan");
      if (!plan) return jsonResponse({ error: "Falta plan" }, 400);
      try {
        const order = await createPayPalOrderSuscripcion(env, plan, email, coupon);
        return jsonResponse(order);
      } catch (e) {
        return jsonResponse({ error: "No se pudo crear la orden de pago" }, 500);
      }
    } else {
      const priceId = url.searchParams.get("price_id") || "price_aprendiz";
      const metadata = {
        email,
        user_id: url.searchParams.get("user_id") || ""
      };
      try {
        const order = await createPayPalOrder(env, priceId, metadata, coupon);
        return jsonResponse(order);
      } catch (e) {
        return jsonResponse({ error: "No se pudo crear la orden de pago" }, 500);
      }
    }
  }
  if (path === "/paypal/capture") return await handlePayPalCapture(env, request);
  if (path === "/paypal/webhook") return await handlePayPalWebhook(env, request);
  if (path === "/shop/success") return new Response("\u{1F30A} Pago exitoso! Tu clave ser\xE1 enviada a tu correo.", { status: 200 });
  if (path === "/shop/cancel") return new Response("\u{1F30A} Pago cancelado.", { status: 200 });
  if (path === "/register") return await handleRegister(env, request);
  if (path === "/login") return await handleLogin(env, request);
  if (path === "/logout") return await handleLogout(env, request);
  if (path === "/profile") return await handleProfile(env, request);
  if (path === "/verify-2fa") return await handleVerify2FA(env, request);
  if (path === "/forgot-password") return await handleForgotPassword(env, request);
  if (path === "/reset-password") return await handleResetPassword(env, request);
  if (path === "/privacidad") return await handlePrivacidad(env);
  if (path === "/aviso-legal") return await handleAvisoLegal(env);
  if (path === "/terminos") return await handleTerminos(env);
  if (path === "/cookies") return await handleCookies(env);
  if (path === "/suscribirse") return await handleSubscribe(env, request);
  if (path === "/pay-subscription") return await handlePaySubscription(env, request);
  if (path === "/renovar-suscripcion") {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
    await renovarSuscripcion(env, auth.user.email, 30);
    return jsonResponse({ message: "Suscripci\xF3n renovada +30 d\xEDas" });
  }
  if (path === "/cancelar-renovacion") {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: "No autorizado" }, 403);
    await cancelarRenovacionSuscripcion(env, auth.user.email);
    return jsonResponse({ message: "Renovaci\xF3n autom\xE1tica cancelada" });
  }
  if (path === "/admin/hacer-reseller") return await handleHacerReseller(env, request);
  if (path === "/admin/asignar-claves") return await handleAsignarClaves(env, request);
  if (path === "/admin/resellers") return await handleListResellers(env, request);
  if (path === "/comprar-pack") return await handleComprarPack(env, request);
  if (path === "/solicitar-retiro") return await handleSolicitarRetiro(env, request);
  if (path === "/status") return await handleStatus(env);
  if (path === "/claim-key") return await handleClaimKey(env, request);
  if (path === "/renew-key") return await handleRenewKey(env, request);
  if (path.startsWith("/invoice/")) return await handleInvoice(env, url, request);
  if (path === "/stats/public") return await handlePublicStats(env);
  if (path === "/search-key") return await handleSearchKey(env, url);
  if (path === "/verify-batch") return await handleVerifyBatch(env, request);
  if (path === "/shorten") return await handleShorten(env, request);
  if (path === "/webhook/test") return await handleWebhookTest(env);
  if (path === "/admin/logs") return await handleAdminLogs(env, url);
  if (path === "/admin/batch-expire") return await handleBatchExpire(env, request);
  if (path === "/admin/console") return await handleAdminConsole(env, request);
  if (path === "/admin/ingresos") return await handleAdminIngresos(env, url);
  if (path === "/cron-renew") return await handleCronRenew(env);
  if (path === "/admin/generar-prueba") return await handleGenerarPrueba(env, request);
  if (path.startsWith("/s/")) return await handleShortRedirect(env, url);
  if (path === "/admin/users") return await handleAdminUsers(env, url, request);
  if (path === "/admin/user-action") return await handleAdminUserAction(env, request);
  if (path === "/admin/backup") return await handleBackup(env, request);
  if (path === "/admin/upload-keys") return await handleUploadKeys(env, request);
  if (path === "/google53213708c5fda63c.html") return new Response("google-site-verification: google53213708c5fda63c.html", { headers: { "Content-Type": "text/html" } });
  if (path === "/auth/discord") return await handleDiscordAuth(env);
  if (path === "/auth/discord/callback") return await handleDiscordCallback(env, request);
  if (path === "/auth/google") return await handleGoogleAuth(env);
  if (path === "/auth/google/callback") return await handleGoogleCallback(env, request);
  if (path === "/review") return await handleReview(env, request);
  if (path === "/reviews") return await handleGetReviews(env, url);
  if (path === "/webhook/register") return await handleRegisterWebhook(env, request);
  if (path === "/activar-2fa") return await handleActivate2FA(env, request);
  if (path === "/desactivar-2fa") return await handleDeactivate2FA(env, request);
  if (path === "/qr-2fa") return await handleUser2FAQR(env, request);
  if (path === "/canjear-puntos") return await handleRedeemPoints(env, request);
  if (path === "/leaderboard") return await handleLeaderboard(env);
  if (path === "/toggle-dark-mode") return await handleToggleDarkMode(env, request);
  if (path === "/cron-jobs") return await handleCronJobs(env);
  return new Response("\u{1F30A} 404 - Ruta no encontrada", { status: 404 });
}
__name(workerFetch, "workerFetch");
async function applySecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const nonceBytes = new Uint8Array(18);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const contentType = headers.get("Content-Type") || "";
  let body = response.body;
  if (contentType.includes("text/html")) {
    let html = await response.text();
    html = html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
    html = html.replace(/<style(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`);
    body = html;
  }
  headers.set("Content-Security-Policy", `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.paypal.com https://www.paypalobjects.com; script-src-attr 'unsafe-inline'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api-m.paypal.com https://api.brevo.com; frame-src 'self' https://www.paypal.com; upgrade-insecure-requests`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
__name(applySecurityHeaders, "applySecurityHeaders");
var OceanHub_SECURITY_PATCHED_FINAL_v8_default = {
  async fetch(request, env) {
    if (!env?.KV_LOCKER) {
      return await applySecurityHeaders(jsonResponse({
        error: "Servicio temporalmente no disponible",
        code: "KV_LOCKER_NOT_CONFIGURED"
      }, 503));
    }
    try {
      const response = await workerFetch(request, env);
      return await applySecurityHeaders(response);
    } catch (error) {
      console.error("\u274C Error no controlado en el Worker:", error);
      return await applySecurityHeaders(jsonResponse({
        error: "Error interno del servidor"
      }, 500));
    }
  }
};
export {
  KVLocker,
  OceanHub_SECURITY_PATCHED_FINAL_v10_default as default,
  workerFetch
};
//# sourceMappingURL=OceanHub_SECURITY_PATCHED_FINAL_v10.js.map
