// ==================================================
// 🌊 OCEAN HUB V29.1 — SOCIAL + editar perfil (bio/avatar) + notificaciones
// Añadido: recuperación de contraseña por email, aviso de compra,
// historial de inicios de sesión, páginas legales y banner de cookies.
// FIX: BASE_URL, SENDER_EMAIL y SENDER_NAME ahora desde env.
// AÑADIDO: Pantalla de bienvenida con gate de autenticación completo
// ==================================================

// ==================== CONFIGURACIÓN ====================
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 3600;
const VALID_CACHE_TTL = 3600;
const NONCE_TTL = 120;
const PIN_BRUTE_LIMIT = 5;
const PIN_BRUTE_WINDOW = 600;
const HMAC_SECRET_ROTATION_DAYS = 7;
const BLACKLIST_WINDOW = 300;
const BLACKLIST_THRESHOLD = 10;
const BLACKLIST_BAN_TIME = 3600;
const IP_REPUTATION_WINDOW = 600;
const OTP_TTL = 300;
const SESSION_TTL = 2592000; // 30 días; la sesión queda persistida en KV y en la cookie segura.
const OAUTH_STATE_TTL = 600; // 10 minutos, un solo uso.
const SALT_ROUNDS = 16;
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 600;
const REGISTER_RATE_LIMIT = 5;
const REGISTER_RATE_WINDOW = 600;
const FORGOT_RATE_LIMIT = 5;
const FORGOT_RATE_WINDOW = 600;
const TOTP_RATE_LIMIT = 5;
const TOTP_RATE_WINDOW = 600;
const RESET_TOKEN_TTL = 1800;

function getPayPalMode(env) {
    return String(env?.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
}

function getPayPalApiUrl(env) {
    return getPayPalMode(env) === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

function getBaseUrl(env) {
    const raw = env?.BASE_URL; if (!raw) throw new Error('BASE_URL no configurada');
    return raw.replace(/\/+$/, '');
}

function getSenderEmail(env) {
    if (!env?.SENDER_EMAIL) throw new Error('SENDER_EMAIL no configurado'); return env.SENDER_EMAIL;
}

function getSenderName(env) {
    return env?.SENDER_NAME || 'Ocean Hub';
}

function buildSessionCookie(token, maxAge = SESSION_TTL) {
    return `session_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}

function buildSessionResponseHeaders(sessionCookie, clearOAuth = false) {
    const headers = new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    headers.append('Set-Cookie', sessionCookie);
    if (clearOAuth) headers.append('Set-Cookie', clearOAuthStateCookie());
    return headers;
}

function buildOAuthStateCookie(state) {
    return `oauth_state=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${OAUTH_STATE_TTL}; Path=/auth`;
}

function clearOAuthStateCookie() {
    return 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/auth';
}

function getCookieValue(request, name) {
    const cookie = request.headers.get('Cookie') || '';
    const escapedName = name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch { return null; }
}

async function createOAuthState(env, provider) {
    const state = generateRandomHex(32);
    await env.STATS.put(
        `oauth_state_${state}`,
        JSON.stringify({ provider, createdAt: Date.now() }),
        { expirationTtl: OAUTH_STATE_TTL }
    );
    return state;
}

async function consumeOAuthState(env, request, provider) {
    const state = getCookieValue(request, 'oauth_state');
    if (!state || !/^[a-f0-9]{64}$/i.test(state)) return false;
    const raw = await env.STATS.get(`oauth_state_${state}`);
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }
    await env.STATS.delete(`oauth_state_${state}`);
    return !!data && data.provider === provider && Date.now() - Number(data.createdAt || 0) <= OAUTH_STATE_TTL * 1000;
}

function getRequestDevice(request) {
    const ua = String(request.headers.get('User-Agent') || 'Desconocido').trim();
    return ua.length > 180 ? ua.slice(0, 180) + '…' : ua;
}

async function recordSuccessfulLogin(env, user, request, method) {
    const ip = getClientIP(request);
    const now = new Date();
    user.last_login = now.toISOString();
    await env.STATS.put(`user_${user.email}`, JSON.stringify(user));
    await logUserAction(env, user.email, 'login', {
        ip,
        userAgent: getRequestDevice(request),
        method
    });

    // El envío no bloquea el login si Brevo está caído/no configurado.
    await sendEmail(
        env,
        user.email,
        `🔐 Nuevo inicio de sesión en Ocean Hub`,
        `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#102a43">
            <h2>🌊 Inicio de sesión detectado</h2>
            <p>Hola <strong>${escapeHTML(user.name || user.email)}</strong>, se inició una sesión en tu cuenta de Ocean Hub.</p>
            <ul>
                <li><strong>Fecha:</strong> ${escapeHTML(now.toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' }))}</li>
                <li><strong>Método:</strong> ${escapeHTML(method)}</li>
                <li><strong>IP:</strong> ${escapeHTML(ip)}</li>
                <li><strong>Dispositivo:</strong> ${escapeHTML(getRequestDevice(request))}</li>
            </ul>
            <p>Si no reconoces este inicio de sesión, cambia tu contraseña y revisa la seguridad de tu cuenta.</p>
        </div>`
    );
}

const PRODUCTS = {
    "price_aprendiz": { name: "🐠 DLC Aprendiz", price: 5.00, description: "Acceso básico por 7 días", days: 7 },
    "price_tiburon": { name: "🦈 DLC Tiburón", price: 15.00, description: "Premium por 30 días", days: 30 },
    "price_rey": { name: "👑 DLC Rey del Océano", price: 30.00, description: "Acceso permanente VIP", days: 365 }
};

const SUSCRIPCION_PLANES = {
    "aprendiz": { name: "🐠 Aprendiz", price: 4.99, days: 45, description: "Acceso básico por 45 días" },
    "tiburon": { name: "🦈 Tiburón", price: 9.99, days: 100, description: "Premium por 100 días" },
    "rey_oceano": { name: "👑 Rey del Océano", price: 14.99, days: 365, description: "Acceso permanente VIP" }
};

const PACKS = {
    "pack5": { name: "Pack 5 claves", price: 20.00, quantity: 5 },
    "pack10": { name: "Pack 10 claves", price: 35.00, quantity: 10 },
    "pack25": { name: "Pack 25 claves", price: 75.00, quantity: 25 }
};

const EXCHANGE_RATES = {
    USD: 1, EUR: 0.92, GBP: 0.79, MXN: 17.5, ARS: 850, COP: 3900, BRL: 5.0
};

const TRANSLATIONS = {
    es: {
        welcome: 'Bienvenido a Ocean Hub', login: 'Iniciar sesión', register: 'Registrarse',
        logout: 'Cerrar sesión', profile: 'Perfil', home: 'Inicio', shop: 'Tienda',
        sell: 'Vender', dlc: 'DLCs', verify: 'Verificar clave', claim: 'Canjear código',
        subscribe: 'Suscripción', admin: 'Administración', email: 'Email',
        password: 'Contraseña', name: 'Nombre', confirm: 'Confirmar', cancel: 'Cancelar',
        save: 'Guardar', delete: 'Eliminar', edit: 'Editar', view: 'Ver',
        loading: 'Cargando...', error: 'Error', success: 'Éxito',
    },
    en: {
        welcome: 'Welcome to Ocean Hub', login: 'Login', register: 'Register',
        logout: 'Logout', profile: 'Profile', home: 'Home', shop: 'Shop',
        sell: 'Sell', dlc: 'DLCs', verify: 'Verify key', claim: 'Redeem code',
        subscribe: 'Subscription', admin: 'Admin', email: 'Email',
        password: 'Password', name: 'Name', confirm: 'Confirm', cancel: 'Cancel',
        save: 'Save', delete: 'Delete', edit: 'Edit', view: 'View',
        loading: 'Loading...', error: 'Error', success: 'Success',
    }
};

function getTranslation(env, lang, key, fallback = key) {
    const langMap = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return langMap[key] || fallback;
}

// ==================================================
// [ UTILIDADES ]
// ==================================================

async function hashKey(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           'unknown';
}

async function sendDiscordWebhook(env, message, embed = null) {
    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    const payload = { content: message, embeds: embed ? [embed] : [] };
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e) { console.error('Discord webhook error:', e); }
}

async function sendTelegramMessage(env, message) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });
    } catch (e) { console.error('Telegram error:', e); }
}

function maskAlertValue(value) {
    const s = String(value ?? '');
    if (!s) return '';
    if (s.includes('@')) {
        const [local, domain] = s.split('@');
        return `${(local || '').slice(0, 2)}***@${domain || ''}`;
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) {
        const parts = s.split('.');
        return `${parts[0]}.${parts[1]}.***.***`;
    }
    if (s.includes(':')) return `${s.slice(0, 4)}***`;
    return s.length <= 6 ? '***' : `${s.slice(0, 3)}***${s.slice(-3)}`;
}

async function sendAlert(env, message, severity = 'info', key = null, ip = null) {
    let safeMessage = String(message ?? '');
    if (key) safeMessage = safeMessage.split(String(key)).join(maskAlertValue(key));
    if (ip) safeMessage = safeMessage.split(String(ip)).join(maskAlertValue(ip));
    const fullMsg = `🚨 [${severity.toUpperCase()}] ${safeMessage}${key ? ` | Clave: ${maskAlertValue(key)}` : ''}${ip ? ` | IP: ${maskAlertValue(ip)}` : ''}`;
    await sendDiscordWebhook(env, fullMsg);
    await sendTelegramMessage(env, fullMsg);
}

async function logAdminAction(env, action, key, ip, details = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const logKey = `admin_log_${today}_${Date.now()}_${generateRandomHex(4)}`;
    const entry = { timestamp: new Date().toISOString(), action, key, ip, details };
    await env.STATS.put(logKey, JSON.stringify(entry), { expirationTtl: 2592000 });
    let dayIndex = await env.STATS.get(`admin_log_index_${today}`, 'json') || [];
    dayIndex.push(logKey);
    if (dayIndex.length > 500) dayIndex = dayIndex.slice(-500);
    await env.STATS.put(`admin_log_index_${today}`, JSON.stringify(dayIndex), { expirationTtl: 2592000 });
    await sendAlert(env, `🔐 Acción admin: **${action}** sobre \`${key}\` desde IP ${ip}`, 'admin', key, ip);
}

function generateRandomHex(length = 32) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getValidHMACSecrets(env) {
    const current = env.HMAC_SECRET_CURRENT;
    const previous = env.HMAC_SECRET_PREVIOUS || "";
    const secrets = current ? [current] : [];
    if (previous && previous.length > 10) secrets.push(previous);
    return secrets;
}

// ===== TOTP =====
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

function generateTOTPSecret() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return bytesToBase32(bytes);
}

function buildOTPAuthURI(secret, email, issuer = 'Ocean Hub') {
    const label = `${issuer}:${email}`;
    return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

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

async function verifyTOTP(env, secret, token, window = 1) {
    if (!token || token.length !== 6 || isNaN(token)) return false;
    try {
        const keyBytes = await base32ToBytes(secret);
        const key = await crypto.subtle.importKey(
            "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
        );
        const timeStep = 30;
        const now = Math.floor(Date.now() / 1000);
        const currentCounter = Math.floor(now / timeStep);
        for (let i = -window; i <= window; i++) {
            const counter = currentCounter + i;
            const buffer = new ArrayBuffer(8);
            const view = new DataView(buffer);
            view.setUint32(4, counter, false);
            const signature = await crypto.subtle.sign("HMAC", key, buffer);
            const hmac = new Uint8Array(signature);
            const offset = hmac[hmac.length - 1] & 0x0f;
            const code = (
                ((hmac[offset] & 0x7f) << 24) |
                ((hmac[offset + 1] & 0xff) << 16) |
                ((hmac[offset + 2] & 0xff) << 8) |
                (hmac[offset + 3] & 0xff)
            ) % 1000000;
            const codeStr = code.toString().padStart(6, "0");
            if (codeStr === token) return true;
        }
        return false;
    } catch (e) {
        console.error("TOTP error:", e);
        return false;
    }
}

// ==================================================
// [ SEGURIDAD ADICIONAL ]
// ==================================================

async function isIPBlacklisted(env, ip) {
    const blacklist = await env.STATS.get(`blacklist_${ip}`, 'json');
    if (!blacklist) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > blacklist.until) {
        await env.STATS.delete(`blacklist_${ip}`);
        return false;
    }
    return true;
}

async function addIPToBlacklist(env, ip) {
    const until = Math.floor(Date.now() / 1000) + BLACKLIST_BAN_TIME;
    await env.STATS.put(`blacklist_${ip}`, JSON.stringify({ until, reason: 'too many failures' }), { expirationTtl: BLACKLIST_BAN_TIME });
    await sendAlert(env, `🚫 IP ${ip} bloqueada por 1 hora (demasiados fallos)`, 'security', null, ip);
}

async function registerIPFailure(env, ip) {
    const key = `ip_failures_${ip}`;
    let data = await env.STATS.get(key, 'json') || { count: 0, first: Math.floor(Date.now() / 1000) };
    const now = Math.floor(Date.now() / 1000);
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



async function createOTP(env, key) {
    const otp = (crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000).toString();
    const hash = await hashKey(key);
    await env.STATS.put(`otp_${otp}`, hash, { expirationTtl: OTP_TTL });
    return otp;
}

async function getAdminLogs(env, limit = 50, offset = 0) {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    let allLogs = [];
    for (const day of days) {
        const index = await env.STATS.get(`admin_log_index_${day}`, 'json') || [];
        for (const key of index) {
            const raw = await env.STATS.get(key);
            if (raw) allLogs.push(JSON.parse(raw));
        }
        if (allLogs.length > 1000) break;
    }
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const total = allLogs.length;
    const slice = allLogs.slice(offset, offset + limit);
    return { logs: slice, total };
}

// ==================================================
// [ FUNCIONES DE USUARIOS ]
// ==================================================

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, salt, storedHash) {
    const hash = await hashPassword(password, salt);
    return timingSafeCompare(hash, storedHash);
}

async function getUserByEmail(env, email) {
    const userData = await env.STATS.get(`user_${email}`);
    if (!userData) return null;
    return JSON.parse(userData);
}

async function createUser(env, email, name, password, referralCode = null) {
    email = String(email || '').trim().toLowerCase(); name = String(name || '').trim().slice(0, 80);
    if (email.length > 254) throw new Error('Email demasiado largo');
    if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email)) {
        throw new Error('Email no válido');
    }
    if (name.length > 80) throw new Error('Nombre demasiado largo');
    if (String(password || '').length < 8 || String(password).length > 128) throw new Error('La contraseña debe tener entre 8 y 128 caracteres');
    const existing = await getUserByEmail(env, email);
    if (existing) throw new Error('El email ya está registrado');
    const salt = generateRandomHex(16);
    const passwordHash = await hashPassword(password, salt);
    const userList = await env.STATS.get('user_list', 'json') || [];
    let role = 'user';
    const adminEmails = env.ADMIN_EMAILS ? JSON.parse(env.ADMIN_EMAILS) : [];
    // El registro público nunca concede rol admin.
    role = 'user';
    const ownReferralCode = generateRandomHex(8).toUpperCase();
    const baseName = (name || email.split('@')[0] || 'user').trim();
    const username = await socialEnsureUniqueUsername(env, baseName);
    const user = {
        email, name: baseName.slice(0, 80), username, passwordHash, salt, role,
        created_at: new Date().toISOString(), last_login: null,
        referral_code: ownReferralCode, referido_por: referralCode || null,
        points: 0, otp_secret: null, dark_mode: false, language: 'es', sessionVersion: 0,
        verified: false, bio: '', avatar_emoji: '👤'
    };
    await env.STATS.put(`user_${email}`, JSON.stringify(user));
    await env.STATS.put(`username_${username.toLowerCase()}`, email);
    userList.push(email);
    await env.STATS.put('user_list', JSON.stringify(userList));

    if (referralCode) {
        const referidor = await getUserByReferralCode(env, referralCode);
        if (referidor) {
            const refEntry = {
                referidor_id: referidor.email, referido_id: email,
                fecha_registro: new Date().toISOString(), comision_ganada: 0
            };
            const refList = await env.STATS.get('referidos_list', 'json') || [];
            refList.push(refEntry);
            await env.STATS.put('referidos_list', JSON.stringify(refList));
            await sendAlert(env, `🔗 Nuevo referido: ${email} fue referido por ${referidor.email}`, 'referral');
        }
    }

    await sendEmail(env, email, 'Bienvenido a Ocean Hub', `<h1>🌊 ¡Bienvenido!</h1><p>Gracias por registrarte en Ocean Hub. Tu código de referido es: <strong>${ownReferralCode}</strong></p>`);
    return user;
}

async function getUserByReferralCode(env, code) {
    const userList = await env.STATS.get('user_list', 'json') || [];
    for (let email of userList) {
        const user = await getUserByEmail(env, email);
        if (user && user.referral_code === code) return user;
    }
    return null;
}

async function authenticateUser(env, email, password) {
    const user = await getUserByEmail(env, email);
    if (!user) return null;
    const valid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return null;
    return user;
}

async function createSession(env, user) {
    const sessionToken = generateRandomHex(32);
    const session = { email: user.email, role: user.role, sessionVersion: Number(user.sessionVersion || 0), created: Date.now() };
    await env.STATS.put(`session_${sessionToken}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    return sessionToken;
}

async function validateSession(env, token) {
    if (!token) return null;
    const data = await env.STATS.get(`session_${token}`);
    if (!data) return null;
    return JSON.parse(data);
}

async function destroySession(env, token) {
    if (token) {
        await env.STATS.delete(`session_${token}`);
    }
}

async function requireAuth(env, request) {
    const cookie = request.headers.get('Cookie');
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

async function requireAdmin(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return null;
    if (auth.user.role !== 'admin') return null;
    // Para endurecer administradores sin romper instalaciones existentes,
    // ADMIN_REQUIRE_2FA=true exige que la cuenta admin tenga 2FA configurado.
    if (String(env.ADMIN_REQUIRE_2FA || 'false').toLowerCase() === 'true' && !auth.user.otp_secret) return null;
    return auth;
}

// ==================================================
// [ SISTEMA DE SUSCRIPCIONES ]
// ==================================================

async function getSuscripcionUsuario(env, email) {
    const data = await env.STATS.get(`suscripcion_${email}`, 'json');
    return data || null;
}

async function crearSuscripcion(env, email, plan, dias = null) {
    const planData = SUSCRIPCION_PLANES[plan];
    if (!planData) throw new Error('Plan no válido');
    const days = dias || planData.days;
    const inicio = new Date();
    const fin = new Date();
    fin.setDate(fin.getDate() + days);
    const suscripcion = {
        email, plan, fecha_inicio: inicio.toISOString(), fecha_fin: fin.toISOString(),
        renovacion_automatica: true, activa: true, created_at: new Date().toISOString()
    };
    await env.STATS.put(`suscripcion_${email}`, JSON.stringify(suscripcion));
    await sendAlert(env, `📅 Nueva suscripción: ${email} -> ${plan} (${days} días)`, 'suscripcion');
    await sendEmail(env, email, 'Suscripción activada', `<h1>✅ Suscripción activada</h1><p>Plan: ${planData.name}</p><p>Duración: ${days} días</p><p>Fecha de fin: ${fin.toISOString()}</p>`);
    return suscripcion;
}

async function renovarSuscripcion(env, email, dias = null) {
    const sus = await getSuscripcionUsuario(env, email);
    if (!sus) throw new Error('No hay suscripción activa');
    const planData = SUSCRIPCION_PLANES[sus.plan];
    const days = dias || planData.days;
    const ahora = new Date();
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
    await sendAlert(env, `🔄 Suscripción renovada: ${email} +${days} días (nueva fecha: ${nuevaFecha.toISOString()})`, 'suscripcion');
    await sendEmail(env, email, 'Suscripción renovada', `<h1>🔄 Suscripción renovada</h1><p>Tu suscripción ha sido renovada por ${days} días.</p><p>Nueva fecha de fin: ${nuevaFecha.toISOString()}</p>`);
    return sus;
}

async function cancelarRenovacionSuscripcion(env, email) {
    const sus = await getSuscripcionUsuario(env, email);
    if (!sus) throw new Error('No hay suscripción activa');
    sus.renovacion_automatica = false;
    await env.STATS.put(`suscripcion_${email}`, JSON.stringify(sus));
    return sus;
}

// ==================================================
// [ SISTEMA DE CÓDIGOS DE CANJE ]
// ==================================================

async function generarCodigoCanje(env, productoId, email) {
    const codigo = generateRandomHex(4).toUpperCase();
    const entry = {
        codigo, producto_id: productoId, email_creador: email, usado: false,
        fecha_creacion: new Date().toISOString(), fecha_uso: null, usuario_uso: null
    };
    await env.STATS.put(`codigo_canje_${codigo}`, JSON.stringify(entry));
    return codigo;
}

async function obtenerCodigoCanje(env, codigo) {
    const data = await env.STATS.get(`codigo_canje_${codigo}`, 'json');
    return data || null;
}

async function usarCodigoCanje(env, codigo, email) {
    const entry = await obtenerCodigoCanje(env, codigo);
    if (!entry) throw new Error('Código no válido');
    if (entry.usado) throw new Error('Código ya utilizado');
    entry.usado = true;
    entry.fecha_uso = new Date().toISOString();
    entry.usuario_uso = email;
    await env.STATS.put(`codigo_canje_${codigo}`, JSON.stringify(entry));
    await logUserAction(env, email, 'canje', { codigo });
    return entry;
}

// ==================================================
// [ SISTEMA DE REFERIDOS ]
// ==================================================

async function getReferidosDe(env, email) {
    const list = await env.STATS.get('referidos_list', 'json') || [];
    return list.filter(r => r.referidor_id === email);
}

async function getComisionesDe(env, email) {
    const list = await env.STATS.get('referidos_list', 'json') || [];
    return list.filter(r => r.referidor_id === email).reduce((sum, r) => sum + (r.comision_ganada || 0), 0);
}

async function addComisionToReferidor(env, email, monto) {
    const refList = await env.STATS.get('referidos_list', 'json') || [];
    let found = false;
    for (let r of refList) {
        if (r.referido_id === email) {
            r.comision_ganada = (r.comision_ganada || 0) + monto;
            found = true;
            break;
        }
    }
    if (found) {
        await env.STATS.put('referidos_list', JSON.stringify(refList));
    }
}

// ==================================================
// [ SISTEMA DE RESELLERS ]
// ==================================================

async function getReseller(env, email) {
    const data = await env.STATS.get(`reseller_${email}`, 'json');
    return data || null;
}

async function setReseller(env, email, data) {
    await env.STATS.put(`reseller_${email}`, JSON.stringify(data));
}

async function registrarMovimiento(env, email, tipo, cantidad, descripcion) {
    const id = `movimiento_${Date.now()}_${generateRandomHex(3)}`;
    const entry = { email, tipo, cantidad, descripcion, fecha: new Date().toISOString() };
    await env.STATS.put(id, JSON.stringify(entry));
    let index = await env.STATS.get(`movimientos_${email}`, 'json') || [];
    index.push(id);
    if (index.length > 500) index = index.slice(-500);
    await env.STATS.put(`movimientos_${email}`, JSON.stringify(index));
}

async function getMovimientos(env, email, limit = 50, offset = 0) {
    const index = await env.STATS.get(`movimientos_${email}`, 'json') || [];
    const total = index.length;
    const slice = index.slice(Math.max(0, total - offset - limit), total - offset);
    const movimientos = [];
    for (let id of slice) {
        const raw = await env.STATS.get(id);
        if (raw) movimientos.push(JSON.parse(raw));
    }
    return { movimientos, total };
}

async function convertirMoneda(cantidadUSD, moneda) {
    const rate = EXCHANGE_RATES[moneda.toUpperCase()];
    if (!rate) return null;
    return cantidadUSD * rate;
}

// ==================================================
// [ CLAVES ESTÁTICAS ]
// ==================================================

const STATIC_KEYS_RAW = []; // Configurar secretos en STATIC_KEYS_JSON


let STATIC_KEYS = [];

async function initStaticKeys(env) {
    if (STATIC_KEYS.length) return;
    let raw = [];
    try { raw = env.STATIC_KEYS_JSON ? JSON.parse(env.STATIC_KEYS_JSON) : []; }
    catch { throw new Error('STATIC_KEYS_JSON no es JSON válido'); }
    if (!Array.isArray(raw)) throw new Error('STATIC_KEYS_JSON debe ser un array');
    for (const k of raw) if (k?.key) STATIC_KEYS.push({ ...k, hash: await hashKey(k.key), dynamic:false });
}

// ==================================================
// [ BLOQUEO DISTRIBUIDO PARA MUTACIONES KV ]
// ==================================================
const LOCAL_KV_LOCKS = new Map();

async function withKVLock(env, name, fn, ttlMs = 60000) {
    // Las mutaciones protegidas por este helper requieren un Durable Object.
    // Un lock en memoria NO es seguro entre isolates/instancias de Cloudflare,
    // así que fallamos cerrado si KV_LOCKER no está configurado.
    if (!env.KV_LOCKER) {
        throw new Error(`KV_LOCKER no configurado: se requiere Durable Object para ${name}`);
    }

    const id = env.KV_LOCKER.idFromName(name);
    const stub = env.KV_LOCKER.get(id);
    const lockToken = generateRandomHex(16);
    let acquire = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        acquire = await stub.fetch('https://kv-lock/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: lockToken, ttl: ttlMs })
        });
        if (acquire.ok) break;
        await new Promise(resolve => setTimeout(resolve, Math.min(100 + attempt * 50, 500)));
    }
    if (!acquire?.ok) throw new Error('No se pudo adquirir el bloqueo KV');
    try {
        return await fn();
    } finally {
        await stub.fetch('https://kv-lock/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: lockToken })
        }).catch(() => {});
    }
}

// REQUIERE binding Durable Object: KV_LOCKER -> KVLocker en wrangler.toml.
class KVLocker {
    constructor(state) { this.state = state; }
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/acquire' && request.method === 'POST') {
            const { token, ttl = 60000 } = await request.json();
            const current = await this.state.storage.get('lock');
            const now = Date.now();
            if (current && current.expires > now) return new Response('busy', { status: 409 });
            await this.state.storage.put('lock', { token, expires: now + Math.min(Math.max(ttl, 1000), 120000) });
            return new Response('ok');
        }
        if (url.pathname === '/release' && request.method === 'POST') {
            const { token } = await request.json();
            const current = await this.state.storage.get('lock');
            if (current?.token === token) await this.state.storage.delete('lock');
            return new Response('ok');
        }
        return new Response('not found', { status: 404 });
    }
}

// ==================================================
// [ FUNCIONES KV ]
// ==================================================

async function getStats(env) {
    try {
        let raw = await env.STATS.get("global_stats", "json");
        if (!raw) {
            const newStats = {
                total_verifications: 0, valid_verifications: 0, invalid_verifications: 0,
                keys_usage: {}, last_verifications: [], hourly_usage: {}, daily_usage: {},
                start_time: new Date().toISOString(),
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
        console.error("❌ getStats:", e);
        return null;
    }
}

async function getDynamicKeys(env) {
    try {
        const raw = await env.STATS.get("dynamic_keys", "json");
        return raw || {};
    } catch { return {}; }
}

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
        keyData.notas = keyData.notas || '';
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
        console.error("❌ saveDynamicKey:", e);
        return false;
    }

    });
}

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

async function getKeyBindings(env) {
    try {
        const raw = await env.STATS.get("key_bindings", "json");
        return raw || {};
    } catch { return {}; }
}

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

async function blockKey(env, key) {
    return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
        dyn[hash].blocked = true;
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: 'block', timestamp: new Date().toISOString() });
        await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    }
    let stats = await getStats(env);
    if (stats && stats.keys_usage[hash]) {
        stats.keys_usage[hash].blocked = true;
        await env.STATS.put("global_stats", JSON.stringify(stats));
    }

    });
}

async function unblockKey(env, key) {
    return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
        dyn[hash].blocked = false;
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: 'unblock', timestamp: new Date().toISOString() });
        await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    }
    let stats = await getStats(env);
    if (stats && stats.keys_usage[hash]) {
        stats.keys_usage[hash].blocked = false;
        await env.STATS.put("global_stats", JSON.stringify(stats));
    }

    });
}

async function resetKeyUsage(env, key) {
    return await withKVLock(env, "dynamic_keys", async () => {
    const hash = await hashKey(key);
    const dyn = await getDynamicKeys(env);
    if (dyn[hash]) {
        dyn[hash].count = 0;
        dyn[hash].history = [];
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: 'reset_usage', timestamp: new Date().toISOString() });
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

async function registrarCompra(env, compraData) {
    try {
        if (!compraData.estado) compraData.estado = 'Activa';
        const id = `compra_${Date.now()}_${generateRandomHex(3)}`;
        await env.STATS.put(id, JSON.stringify(compraData));
        let index = await env.STATS.get('compras_index', 'json') || [];
        index.push(id);
        if (index.length > 1000) {
            const toRemove = index.slice(0, index.length - 1000);
            for (let oldId of toRemove) {
                await env.STATS.delete(oldId);
            }
            index = index.slice(-1000);
        }
        await env.STATS.put('compras_index', JSON.stringify(index));
        return true;
    } catch (e) {
        console.error('❌ Error registrando compra:', e);
        return false;
    }
}

async function getCompras(env, limit = 50, offset = 0, filtros = {}) {
    try {
        const index = await env.STATS.get('compras_index', 'json') || [];
        let compras = [];
        for (let i = 0; i < index.length; i += 50) {
            const batch = index.slice(i, i + 50);
            const values = await Promise.all(batch.map(id => env.STATS.get(id)));
            for (const raw of values) {
                if (!raw) continue;
                const c = JSON.parse(raw);
                if (!c.estado) c.estado = 'Activa';
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
        console.error('❌ Error obteniendo compras:', e);
        return { compras: [], total: 0 };
    }
}

// ==================================================
// [ RATE LIMITING ]
// ==================================================

async function checkRateLimit(env, ip, key) {
    return await withKVLock(env, `rate:${ip}`, async () => {
    const ipKey = `rl_ip_${ip}`;
    const now = Math.floor(Date.now() / 1000);
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

// ==================================================
// [ HMAC Y NONCE ]
// ==================================================

function generateNonce() {
    return generateRandomHex(16).toUpperCase();
}

async function getNonce(env, ip) {
    const nonce = generateNonce();
    const nonceKey = `nonce_${nonce}`;
    await env.STATS.put(nonceKey, "1", { expirationTtl: NONCE_TTL });
    return nonce;
}

async function verifyNonce(env, nonce, ip) {
    const nonceKey = `nonce_${nonce}`;
    const stored = await env.STATS.get(nonceKey);
    if (!stored) return false;
    await env.STATS.delete(nonceKey);
    return true;
}

function computeHmac(data, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const message = encoder.encode(data);
    return crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => {
        return crypto.subtle.sign('HMAC', key, message);
    }).then(sig => {
        return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

function timingSafeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
}

function escapeJSAttribute(value) {
    return escapeHTML(JSON.stringify(String(value ?? '')));
}

function adminProtectedPath(path) {
    return path === '/admin' || path.startsWith('/admin/') ||
        ['/admin-action','/generate','/generate-batch','/export-csv','/export-json',
         '/qr-totp','/renew-key','/search-key','/verify-batch','/webhook',
         '/webhook/test','/shorten','/key-info','/cron-renew','/cron-jobs'].includes(path);
}

// ==================================================
// [ CACHÉ DE CLAVES VÁLIDAS ]
// ==================================================

async function getCachedValidKey(env, key) {
    const cacheKey = `valid_${key}`;
    const cached = await env.STATS.get(cacheKey);
    if (cached) return JSON.parse(cached);
    return null;
}

async function setCachedValidKey(env, key, data) {
    const cacheKey = `valid_${key}`;
    await env.STATS.put(cacheKey, JSON.stringify(data), { expirationTtl: VALID_CACHE_TTL });
}

// ==================================================
// [ ACTUALIZAR ESTADÍSTICAS ]
// ==================================================

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
        stats.keys_usage[hash].last_used = new Date().toISOString();

        if (!stats.keys_usage[hash].history) stats.keys_usage[hash].history = [];
        stats.keys_usage[hash].history.unshift({ valid, timestamp: new Date().toISOString(), ip, userAgent });
        if (stats.keys_usage[hash].history.length > 10) stats.keys_usage[hash].history.pop();

        if (!stats.last_verifications) stats.last_verifications = [];
        stats.last_verifications.unshift({ key, valid, timestamp: new Date().toISOString(), ip, userAgent });
        if (stats.last_verifications.length > 50) stats.last_verifications.pop();

        const hourKey = new Date().toISOString().slice(0, 13);
        if (!stats.hourly_usage) stats.hourly_usage = {};
        stats.hourly_usage[hourKey] = (stats.hourly_usage[hourKey] || 0) + 1;
        const now = new Date();
        const hours = Object.keys(stats.hourly_usage);
        for (let h of hours) {
            const hDate = new Date(h + ":00:00Z");
            if ((now.getTime() - hDate.getTime()) > 86400000) delete stats.hourly_usage[h];
        }

        const dayKey = new Date().toISOString().slice(0, 10);
        if (!stats.daily_usage) stats.daily_usage = {};
        if (!stats.daily_usage[dayKey]) stats.daily_usage[dayKey] = { valid: 0, invalid: 0 };
        if (valid) stats.daily_usage[dayKey].valid++;
        else stats.daily_usage[dayKey].invalid++;
        const days = Object.keys(stats.daily_usage);
        for (let d of days) {
            const dDate = new Date(d + "T00:00:00Z");
            if ((now.getTime() - dDate.getTime()) > 7 * 86400000) delete stats.daily_usage[d];
        }

        await env.STATS.put("global_stats", JSON.stringify(stats));

        if (valid) {
            const dyn = await getDynamicKeys(env);
            if (dyn[hash]) {
                dyn[hash].count = (dyn[hash].count || 0) + 1;
                dyn[hash].last_used = new Date().toISOString();
                if (!dyn[hash].history) dyn[hash].history = [];
                dyn[hash].history.unshift({ valid: true, timestamp: new Date().toISOString(), ip, userAgent });
                if (dyn[hash].history.length > 10) dyn[hash].history.pop();
                await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
            }
        }

        return stats;
    } catch (e) {
        console.error("❌ updateStats:", e);
        return null;
    }

    });
}

// ==================================================
// [ FUNCIÓN JSON CON CORS ]
// ==================================================

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ==================================================
// [ CORREO ELECTRÓNICO (BREVO) ]
// ==================================================
async function sendEmail(env, to, subject, html) {
    const apiKey = env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('BREVO_API_KEY no configurada. No se envía email a', to);
        return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: getSenderName(env), email: getSenderEmail(env) },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            console.error('Brevo email error:', response.status, errorBody.slice(0, 500));
        }
    } catch (e) {
        console.error('Brevo email error:', e);
    } finally {
        clearTimeout(timeout);
    }
}

// ==================================================
// [ LOGS DE USUARIO ]
// ==================================================
async function logUserAction(env, email, action, details = {}) {
    const id = `userlog_${Date.now()}_${generateRandomHex(3)}`;
    const entry = { timestamp: new Date().toISOString(), email, action, details };
    await env.STATS.put(id, JSON.stringify(entry), { expirationTtl: 2592000 });
    let idx = await env.STATS.get(`userlog_idx_${email}`, 'json') || [];
    idx.push(id);
    if (idx.length > 500) idx = idx.slice(-500);
    await env.STATS.put(`userlog_idx_${email}`, JSON.stringify(idx), { expirationTtl: 2592000 });
}

async function getLoginHistory(env, email, limit = 20) {
    const idx = await env.STATS.get(`userlog_idx_${email}`, 'json') || [];
    const logins = [];
    for (let i = idx.length - 1; i >= 0 && logins.length < limit; i--) {
        const raw = await env.STATS.get(idx[i]);
        if (!raw) continue;
        const entry = JSON.parse(raw);
        if (entry.action === 'login' || entry.action === 'login_2fa' || entry.action === 'register' || entry.action === 'password_reset') {
            logins.push(entry);
        }
    }
    return logins;
}

// ==================================================
// [ CUPONES ]
// ==================================================
async function getCoupon(env, code) {
    return await env.STATS.get(`coupon_${code}`, 'json');
}

async function useCoupon(env, code) {
    return await withKVLock(env, `coupon:${code}`, async () => {
        const coupon = await getCoupon(env, code);
        if (!coupon) throw new Error('Cupón inválido');
        if (coupon.expires && new Date(coupon.expires) < new Date()) throw new Error('Cupón expirado');
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error('Cupón agotado');
        coupon.usedCount++;
        await env.STATS.put(`coupon_${code}`, JSON.stringify(coupon));
        return coupon;
    });
}

// ==================================================
// [ WEBHOOKS PERSONALIZADOS ]
// ==================================================
function isSafeWebhookUrl(value) {
    try {
        const url = new URL(String(value || ''));
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (url.protocol !== 'https:' || url.username || url.password) return false;
        if (url.port && url.port !== '443') return false;
        if (!host || host === 'localhost' || host.endsWith('.localhost') ||
            host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') ||
            host.endsWith('.test') || host.endsWith('.invalid')) return false;
        // Only DNS hostnames are accepted; literal IPv4/IPv6 addresses are rejected.
        if (host.includes(':') || /^[0-9.]+$/.test(host)) return false;
        return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
    } catch {
        return false;
    }
}

async function triggerWebhooks(env, email, event, data) {
    const webhook = await env.STATS.get(`webhook_${email}`, 'json');
    if (!webhook || !isSafeWebhookUrl(webhook.url)) return;
    await fetch(webhook.url, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
    }).catch(e => console.error('Webhook error:', e));
}

// ==================================================
// [ BACKUP AUTOMÁTICO ]
// ==================================================
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
    // Nunca enviar el backup completo por email: puede contener sesiones y datos sensibles.
    return all;
}

// ==================================================
// [ RANKING ]
// ==================================================
async function updateLeaderboard(env) {
    const users = await getAllUsers(env);
    const scores = [];
    for (const u of users) {
        const compras = (await getCompras(env, 1000, 0, { email: u.email })).total;
        const referidos = (await getReferidosDe(env, u.email)).length;
        const score = compras * 10 + referidos * 20 + (u.points || 0);
        scores.push({ email: u.email, name: u.name, score });
    }
    scores.sort((a,b) => b.score - a.score);
    await env.STATS.put('leaderboard', JSON.stringify(scores.slice(0, 100)));
}

// ==================================================
// [ BANNER DE COOKIES Y FOOTER LEGAL ]
// ==================================================
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
                        🍪 Utilizamos cookies propias y de terceros para mejorar tu experiencia, analizar el tráfico y personalizar contenido. 
                        Puedes aceptar todas, rechazar las no esenciales o configurar tus preferencias. 
                        Más información en nuestra 
                        <a href="/privacidad" style="color:#00ccff;">Política de Privacidad</a>.
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button onclick="acceptAllCookies()" style="background:#00ccff;color:#0a1a2b;border:none;padding:10px 20px;border-radius:30px;cursor:pointer;font-weight:bold;">Aceptar todas</button>
                        <button onclick="rejectCookies()" style="background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);padding:10px 20px;border-radius:30px;cursor:pointer;">Solo esenciales</button>
                        <a href="/privacidad" style="background:transparent;color:#88ddff;padding:10px 20px;border-radius:30px;text-decoration:none;border:1px solid #88ddff;">Más info</a>
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
    </script>
    `;
}

function getLegalFooter() {
    return `
    <footer style="margin-top:60px;padding:25px 20px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;color:#88aacc;font-size:0.85rem;font-family:'Segoe UI',sans-serif;">
        <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-bottom:10px;">
            <a href="/aviso-legal" style="color:#88ddff;text-decoration:none;">⚖️ Aviso Legal</a>
            <a href="/privacidad" style="color:#88ddff;text-decoration:none;">🔒 Política de Privacidad</a>
            <a href="/terminos" style="color:#88ddff;text-decoration:none;">📄 Términos y Condiciones</a>
            <a href="/cookies" style="color:#88ddff;text-decoration:none;">🍪 Política de Cookies</a>
        </div>
        <div>🌊 Ocean Hub © ${new Date().getFullYear()} - Todos los derechos reservados</div>
    </footer>
    `;
}

// ==================================================
// [ PÁGINAS LEGALES ]
// ==================================================

async function handlePrivacidad(env) {
    const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Política de Privacidad - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>🔒 Política de Privacidad</h1>
    <p><strong>Última actualización:</strong> ${new Date().toLocaleDateString()}</p>

    <h2>1. Responsable del tratamiento</h2>
    <p>Ocean Hub (en adelante, "nosotros" o "el Servicio") es el responsable del tratamiento de los datos personales que los usuarios (en adelante, "tú" o "el Usuario") proporcionan a través del sitio web y los servicios ofrecidos.</p>

    <h2>2. Datos que recopilamos</h2>
    <ul>
        <li><strong>Datos de registro:</strong> correo electrónico, nombre de usuario y contraseña (almacenada siempre cifrada mediante PBKDF2).</li>
        <li><strong>Datos de uso:</strong> dirección IP, agente de usuario (User-Agent), fecha y hora de acceso, historial de inicios de sesión, acciones realizadas en la cuenta (compras, canjes, cambios de perfil).</li>
        <li><strong>Datos de pago:</strong> gestionados exclusivamente por PayPal. No almacenamos datos de tarjetas bancarias.</li>
        <li><strong>Cookies:</strong> utilizamos cookies técnicas y analíticas para el correcto funcionamiento del sitio.</li>
    </ul>

    <h2>3. Finalidad del tratamiento</h2>
    <p>Utilizamos tus datos para: (a) gestionar tu cuenta y el acceso a los servicios; (b) procesar compras, suscripciones y canjes; (c) enviarte comunicaciones relacionadas con tu cuenta (verificación, compras, renovaciones); (d) prevenir el fraude y garantizar la seguridad; (e) cumplir con obligaciones legales.</p>

    <h2>4. Base legal</h2>
    <p>El tratamiento se basa en la ejecución del contrato (para prestarte los servicios), tu consentimiento (para cookies no esenciales y comunicaciones comerciales) y el interés legítimo (para seguridad y prevención de fraude).</p>

    <h2>5. Conservación de datos</h2>
    <p>Conservamos tus datos mientras tu cuenta esté activa. Si la eliminas, tus datos personales se borrarán en un plazo máximo de 30 días, excepto aquellos que debamos conservar por obligación legal.</p>

    <h2>6. Destinatarios</h2>
    <p>Tus datos pueden ser comunicados a: proveedores de pago (PayPal), proveedores de correo electrónico (Brevo), proveedores de infraestructura (Cloudflare), y autoridades competentes cuando la ley lo exija.</p>

    <h2>7. Tus derechos</h2>
    <p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a nuestro correo de contacto. También tienes derecho a presentar una reclamación ante la autoridad de protección de datos de tu país.</p>

    <h2>8. Seguridad</h2>
    <p>Aplicamos medidas técnicas y organizativas para proteger tus datos: contraseñas cifradas, comunicaciones HTTPS, verificación en dos pasos, control de accesos y monitorización de seguridad.</p>

    <h2>9. Contacto</h2>
    <p>Para cualquier consulta sobre privacidad escríbenos a: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <a href="/home" class="back">← Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleAvisoLegal(env) {
    const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Aviso Legal - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>⚖️ Aviso Legal</h1>
    <p><strong>Última actualización:</strong> ${new Date().toLocaleDateString()}</p>

    <h2>1. Información general</h2>
    <p>El presente Aviso Legal regula el uso del sitio web <strong>Ocean Hub</strong> y los servicios ofrecidos a través del mismo.</p>

    <h2>2. Titular</h2>
    <p>El titular del sitio web es Ocean Hub. Para cualquier comunicación puede utilizarse la dirección de correo: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <h2>3. Objeto</h2>
    <p>Ocean Hub es una plataforma digital dedicada a la venta y gestión de licencias digitales (DLCs), claves de acceso y suscripciones para servicios de terceros. No estamos afiliados a Roblox Corporation ni a ninguna otra plataforma mencionada.</p>

    <h2>4. Condiciones de uso</h2>
    <p>El acceso al sitio atribuye la condición de Usuario e implica la aceptación plena de este Aviso Legal, de la Política de Privacidad y de los Términos y Condiciones. El Usuario se compromete a hacer un uso lícito del sitio, no realizar actividades fraudulentas, no compartir claves con terceros no autorizados y no intentar vulnerar la seguridad del sistema.</p>

    <h2>5. Propiedad intelectual</h2>
    <p>Todos los contenidos del sitio (textos, imágenes, logotipos, código fuente, diseño) son propiedad de Ocean Hub o de sus legítimos titulares, y están protegidos por las leyes de propiedad intelectual. Queda prohibida su reproducción total o parcial sin autorización expresa.</p>

    <h2>6. Exclusión de responsabilidad</h2>
    <p>Ocean Hub no se hace responsable de: (a) interrupciones del servicio por causas técnicas o de fuerza mayor; (b) uso indebido de las claves por parte del Usuario; (c) contenido de sitios de terceros enlazados; (d) daños indirectos derivados del uso del servicio.</p>

    <h2>7. Enlaces externos</h2>
    <p>El sitio puede contener enlaces a páginas de terceros. Ocean Hub no controla dichos sitios y no asume responsabilidad alguna sobre sus contenidos o políticas.</p>

    <h2>8. Modificaciones</h2>
    <p>Ocean Hub se reserva el derecho de modificar este Aviso Legal en cualquier momento. Las modificaciones entrarán en vigor desde su publicación.</p>

    <h2>9. Legislación aplicable</h2>
    <p>Este Aviso Legal se rige por la legislación vigente en el país del titular. Cualquier controversia será sometida a los juzgados y tribunales competentes.</p>

    <a href="/home" class="back">← Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleTerminos(env) {
    const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Términos y Condiciones - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>📄 Términos y Condiciones</h1>
    <p><strong>Última actualización:</strong> ${new Date().toLocaleDateString()}</p>

    <h2>1. Aceptación</h2>
    <p>El uso de Ocean Hub implica la aceptación plena de estos Términos y Condiciones. Si no estás de acuerdo, debes abstenerte de usar el servicio.</p>

    <h2>2. Descripción del servicio</h2>
    <p>Ocean Hub ofrece: venta de claves de licencia digital, suscripciones, sistema de referidos, panel de revendedores, canje de códigos y verificación de claves. Los productos son bienes digitales de acceso inmediato.</p>

    <h2>3. Registro de usuario</h2>
    <p>Para acceder a determinadas funciones es necesario registrarse. El Usuario es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades realizadas con su cuenta. Debe notificarnos de inmediato cualquier uso no autorizado.</p>

    <h2>4. Compras y pagos</h2>
    <p>Los pagos se procesan a través de PayPal. Los precios se muestran en USD y pueden variar según la moneda. Una vez adquirida una clave digital, no se admiten devoluciones salvo error comprobado o duplicidad.</p>

    <h2>5. Política de reembolsos</h2>
    <p>Al tratarse de productos digitales de acceso inmediato, no se realizan reembolsos una vez entregada la clave, salvo casos excepcionales: clave inválida desde el momento de la entrega, duplicidad de pago, o error técnico imputable a Ocean Hub.</p>

    <h2>6. Uso aceptable</h2>
    <p>El Usuario se compromete a NO: (a) revender claves sin autorización; (b) usar el servicio para actividades ilegales; (c) intentar vulnerar la seguridad; (d) acosar o amenazar a otros usuarios; (e) crear múltiples cuentas para abusar del sistema de referidos.</p>

    <h2>7. Suspensión y cancelación</h2>
    <p>Nos reservamos el derecho de suspender o cancelar cuentas que incumplan estos Términos, sin previo aviso y sin derecho a reembolso. También podemos bloquear claves vinculadas a actividades fraudulentas.</p>

    <h2>8. Programa de referidos</h2>
    <p>Los usuarios pueden obtener comisiones por referir nuevos clientes. Las comisiones se acreditan según las condiciones vigentes y pueden ser modificadas. No se permite el autofraude (referirse a sí mismo o crear cuentas falsas).</p>

    <h2>9. Revendedores</h2>
    <p>Los revendedores autorizados adquieren packs de claves a precio reducido y pueden revenderlas. Deben respetar los precios mínimos y no realizar publicidad engañosa. Ocean Hub puede revocar el rol de revendedor en cualquier momento.</p>

    <h2>10. Limitación de responsabilidad</h2>
    <p>Ocean Hub no se responsabiliza del mal uso de las claves por parte del Usuario, ni de bloqueos realizados por plataformas de terceros. La responsabilidad máxima se limita al importe abonado por el producto.</p>

    <h2>11. Modificaciones</h2>
    <p>Podemos modificar estos Términos en cualquier momento. Se recomienda revisarlos periódicamente. El uso continuado del servicio implica la aceptación de las nuevas condiciones.</p>

    <h2>12. Contacto</h2>
    <p>Para cualquier duda sobre estos Términos: <a href="mailto:${getSenderEmail(env)}">${getSenderEmail(env)}</a></p>

    <a href="/home" class="back">← Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleCookies(env) {
    const html = `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Política de Cookies - Ocean Hub</title>
    <style>body{background:#0a1a2b;color:#e0f0ff;font-family:'Segoe UI',sans-serif;padding:40px 20px;line-height:1.7;max-width:900px;margin:0 auto;}h1{color:#00ccff;}h2{color:#88ddff;margin-top:30px;}a{color:#00ccff;}.back{display:inline-block;margin-top:30px;padding:10px 20px;background:#00ccff;color:#0a1a2b;border-radius:30px;text-decoration:none;font-weight:bold;}</style>
    </head><body>
    <h1>🍪 Política de Cookies</h1>
    <p><strong>Última actualización:</strong> ${new Date().toLocaleDateString()}</p>

    <h2>1. ¿Qué son las cookies?</h2>
    <p>Las cookies son pequeños archivos que se almacenan en tu dispositivo al visitar un sitio web. Nos permiten recordar tus preferencias, mantener tu sesión activa y analizar cómo usas el sitio.</p>

    <h2>2. Tipos de cookies que usamos</h2>
    <ul>
        <li><strong>Esenciales (técnicas):</strong> necesarias para el funcionamiento (sesión, carrito, seguridad). No pueden desactivarse.</li>
        <li><strong>Preferencias:</strong> recuerdan tu idioma, modo oscuro y otras opciones.</li>
        <li><strong>Analíticas:</strong> nos ayudan a entender el uso del sitio (estadísticas anónimas).</li>
    </ul>

    <h2>3. Cómo gestionarlas</h2>
    <p>Al acceder al sitio verás un banner donde puedes aceptar todas, rechazar las no esenciales o configurarlas. También puedes borrarlas desde la configuración de tu navegador.</p>

    <h2>4. Base legal</h2>
    <p>El uso de cookies esenciales se basa en el interés legítimo (funcionamiento del servicio). Las cookies no esenciales requieren tu consentimiento previo, conforme al RGPD y la LSSI.</p>

    <a href="/home" class="back">← Volver al inicio</a>
    ${getCookieBannerScript()}
    </body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function checkActionRateLimit(env, bucket, identifier, max, windowSeconds) {
    const safeId = await hashKey(String(identifier || 'unknown'));
    return await withKVLock(env, `rate-action:${bucket}:${safeId}`, async () => {
        const now = Math.floor(Date.now() / 1000);
        const storageKey = `rl_action_${bucket}_${safeId}`;
        let record = await env.STATS.get(storageKey, 'json');
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

// ==================================================
// [ RECUPERACIÓN DE CONTRASEÑA POR EMAIL ]
// ==================================================

async function handleForgotPassword(env, request) {
    if (request.method === 'GET') {
        return new Response(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recuperar contraseña - Ocean Hub</title>
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
            <h2>🔑 Recuperar contraseña</h2>
            <p style="text-align:center;color:#88aacc;font-size:0.9rem;">Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
            <form method="POST" action="/forgot-password">
                <input type="email" name="email" placeholder="Tu email" required>
                <button type="submit">Enviar enlace</button>
            </form>
            <a href="/login" class="back">← Volver al login</a>
        </div>
        ${getCookieBannerScript()}
        </body></html>
        `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    try {
        const ip = getClientIP(request);
        const allowed = await checkActionRateLimit(env, 'forgot', ip, FORGOT_RATE_LIMIT, FORGOT_RATE_WINDOW);
        if (!allowed) return new Response('Demasiadas solicitudes. Espera 10 minutos.', { status: 429 });
        const formData = await request.formData();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        if (!email) return new Response('Email requerido', { status: 400 });

        const user = await getUserByEmail(env, email);
        if (user) {
            const resetToken = generateRandomHex(32);
            await env.STATS.put(`pwd_reset_${resetToken}`, JSON.stringify({
                email,
                created: new Date().toISOString(),
                ip: getClientIP(request)
            }), { expirationTtl: RESET_TOKEN_TTL });

            const resetUrl = `${getBaseUrl(env)}/reset-password?token=${encodeURIComponent(resetToken)}`;
            const html = `
                <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                    <h2 style="color:#00ccff;">🔑 Recuperación de contraseña</h2>
                    <p>Hola ${escapeHTML(user.name || email)},</p>
                    <p>Has solicitado restablecer tu contraseña en <strong>Ocean Hub</strong>. Pulsa el siguiente botón para crear una nueva:</p>
                    <p style="text-align:center;margin:30px 0;">
                        <a href="${resetUrl}" style="background:#00ccff;color:#0a1a2b;padding:14px 30px;border-radius:40px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a>
                    </p>
                    <p style="font-size:0.85rem;color:#88aacc;">O copia este enlace:<br><code style="background:#112233;padding:6px 10px;border-radius:6px;word-break:break-all;">${resetUrl}</code></p>
                    <p style="font-size:0.85rem;color:#88aacc;">Este enlace caduca en 30 minutos. Si no solicitaste este cambio, ignora este correo.</p>
                    <hr style="border-color:rgba(255,255,255,0.1);margin:25px 0;">
                    <p style="font-size:0.8rem;color:#88aacc;">IP de la solicitud: ${escapeHTML(getClientIP(request))}</p>
                </div>
            `;
            await sendEmail(env, email, '🔑 Recuperación de contraseña - Ocean Hub', html);
            await sendAlert(env, `🔑 Solicitud de reset de contraseña para ${email}`, 'reset_password', null, getClientIP(request));
        }

        return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;padding:20px;text-align:center;">
            <h2 style="color:#00cc88;">✅ Solicitud enviada</h2>
            <p>Si el email está registrado, recibirás un enlace de recuperación en tu correo en los próximos minutos.</p>
            <p style="color:#88aacc;font-size:0.9rem;">Revisa también la carpeta de spam.</p>
            <a href="/login" style="color:#00ccff;margin-top:20px;">← Volver al login</a>
        </body></html>
        `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch (e) {
        console.error('forgot-password error:', e);
        return new Response('Error procesando la solicitud: ' + e.message, { status: 500 });
    }
}

async function handleResetPassword(env, request) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
        return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;">
            <h2 style="color:#ff6666;">❌ Enlace inválido</h2>
            <p>Falta el token de recuperación.</p>
            <a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a>
        </body></html>
        `, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    if (request.method === 'GET') {
        const data = await env.STATS.get(`pwd_reset_${token}`, 'json');
        if (!data) {
            return new Response(`
            <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;">
                <h2 style="color:#ff6666;">❌ Enlace expirado o inválido</h2>
                <p>Este enlace ya ha sido usado o ha caducado.</p>
                <a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a>
            </body></html>
            `, { status: 400, headers: { 'Content-Type': 'text/html' } });
        }

        return new Response(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nueva contraseña - Ocean Hub</title>
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
            <h2>🔑 Nueva contraseña</h2>
            <p style="text-align:center;color:#88aacc;font-size:0.9rem;">Introduce tu nueva contraseña (mínimo 8 caracteres).</p>
            <form method="POST" action="/reset-password?token=${encodeURIComponent(token)}">
                <input type="password" name="password" placeholder="Nueva contraseña" required minlength="8" maxlength="128">
                <input type="password" name="password2" placeholder="Repite la contraseña" required minlength="8" maxlength="128">
                <button type="submit">Cambiar contraseña</button>
            </form>
        </div>
        ${getCookieBannerScript()}
        </body></html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }

    try {
        const resetResult = await withKVLock(env, `pwd-reset:${token}`, async () => {
            const data = await env.STATS.get(`pwd_reset_${token}`, 'json');
            if (!data) return { error: 'expired' };

            const formData = await request.formData();
            const password = String(formData.get('password') || '');
            const password2 = String(formData.get('password2') || '');

            if (password.length < 8 || password.length > 128) return { error: 'password' };
            if (password !== password2) return { error: 'mismatch' };

            const user = await getUserByEmail(env, data.email);
            if (!user) return { error: 'user' };

            const newSalt = generateRandomHex(16);
            const newHash = await hashPassword(password, newSalt);
            user.salt = newSalt;
            user.passwordHash = newHash;
            user.sessionVersion = Number(user.sessionVersion || 0) + 1;
            await env.STATS.put(`user_${user.email}`, JSON.stringify(user));

            // El token se elimina dentro del lock: dos solicitudes simultáneas
            // no pueden reutilizar el mismo enlace de recuperación.
            await env.STATS.delete(`pwd_reset_${token}`);
            return { ok: true, user };
        });

        if (resetResult.error === 'expired') {
            return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">❌ Enlace expirado o inválido</h2><a href="/forgot-password" style="color:#00ccff;">Solicitar nuevo enlace</a></body></html>`, { status: 400, headers: { 'Content-Type': 'text/html' } });
        }
        if (resetResult.error === 'password') {
            return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">❌ Contraseña inválida</h2><p>Debe tener entre 8 y 128 caracteres.</p><a href="/reset-password?token=${encodeURIComponent(token)}" style="color:#00ccff;">Volver a intentar</a></body></html>`, { status: 400, headers: { 'Content-Type': 'text/html' } });
        }
        if (resetResult.error === 'mismatch') {
            return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">❌ Las contraseñas no coinciden</h2><a href="/reset-password?token=${encodeURIComponent(token)}" style="color:#00ccff;">Volver a intentar</a></body></html>`, { status: 400, headers: { 'Content-Type': 'text/html' } });
        }
        if (resetResult.error === 'user') {
            return new Response(`<html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h2 style="color:#ff6666;">❌ Usuario no encontrado</h2></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html' } });
        }

        const user = resetResult.user;

        await logUserAction(env, user.email, 'password_reset', { ip: getClientIP(request) });
        await sendAlert(env, `🔑 Contraseña restablecida para ${user.email}`, 'password_reset', null, getClientIP(request));

        await sendEmail(env, user.email, 'Tu contraseña ha sido cambiada - Ocean Hub', `
            <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                <h2 style="color:#00cc88;">✅ Contraseña actualizada</h2>
                <p>Hola ${escapeHTML(user.name || user.email)},</p>
                <p>Tu contraseña ha sido cambiada correctamente.</p>
                <p style="font-size:0.9rem;color:#88aacc;">Si NO realizaste este cambio, contacta con nosotros de inmediato.</p>
                <p style="font-size:0.85rem;color:#88aacc;">IP del cambio: ${escapeHTML(getClientIP(request))}<br>Fecha: ${new Date().toLocaleString()}</p>
            </div>
        `);

        return new Response(`
        <!DOCTYPE html><html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:'Segoe UI',sans-serif;text-align:center;padding:20px;">
            <h2 style="color:#00cc88;">✅ Contraseña actualizada</h2>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <a href="/login" style="color:#00ccff;margin-top:20px;">→ Iniciar sesión</a>
        </body></html>
        `, { headers: { 'Content-Type': 'text/html' } });
    } catch (e) {
        console.error('reset-password error:', e);
        return new Response('Error: ' + e.message, { status: 500 });
    }
}

// ==================================================
// [ MANEJADORES DE RUTAS — VERIFICACIÓN Y ADMIN ]
// ==================================================

async function handleGetNonce(env, request) {
    const ip = getClientIP(request);
    const nonce = await getNonce(env, ip);
    return jsonResponse({ nonce });
}

async function handleVerify(env, request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    let key = pathParts[2] || null;
    if (key) {
        try { key = decodeURIComponent(key); } catch (e) {}
    }
    if (!key) return jsonResponse({ success: false, error: 'Falta clave' }, 400);

    const ip = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || '';

    if (await isIPBlacklisted(env, ip)) {
        return jsonResponse({ success: false, error: 'IP bloqueada temporalmente' }, 403);
    }

    const allowed = await checkRateLimit(env, ip, key);
    if (!allowed) return jsonResponse({ success: false, error: 'Demasiadas verificaciones. Espera 1 hora.' }, 429);

    let timestamp = url.searchParams.get('t');
    let nonce = url.searchParams.get('n');
    let hmac = url.searchParams.get('h');

    if (!timestamp || !nonce || !hmac) return jsonResponse({ success: false, error: 'Faltan parámetros de seguridad' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(now - ts) > 120) return jsonResponse({ success: false, error: 'Timestamp inválido' }, 400);

    const nonceValid = await verifyNonce(env, nonce, ip);
    if (!nonceValid) return jsonResponse({ success: false, error: 'Nonce inválido' }, 400);

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
        return jsonResponse({ success: false, error: 'Firma inválida' }, 400);
    }

    const cached = await getCachedValidKey(env, key);
    if (cached) {
        await updateStats(env, key, true, ip, userAgent);
        return jsonResponse({ ...cached, cached: true });
    }

    const keyHash = await hashKey(key);
    const dynamicKeys = await getDynamicKeys(env);
    let kData = null;
    let staticKey = STATIC_KEYS.find(k => k.hash === keyHash);
    if (staticKey) kData = { ...staticKey, dynamic: false };
    else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };

    if (!kData) {
        await updateStats(env, key, false, ip, userAgent);
        await registerIPFailure(env, ip);
        return jsonResponse({ success: false, valid: false, error: '❌ Clave inválida' });
    }

    if (kData.type === 'honeypot') {
        await sendAlert(env, `🐟 Honeypot activado para IP ${ip} con clave ${key}`, 'honeypot', key, ip);
        const response = { success: true, valid: true, message: '✅ Clave válida (honeypot)', rango: kData.rango, timeLeft: '∞', dias_restantes: '∞' };
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

    if (isBlocked) return jsonResponse({ success: false, valid: false, error: '🚫 Clave bloqueada' });

    if (kData.un_solo_uso && currentUses >= 1) {
        await blockKey(env, key);
        return jsonResponse({ success: false, valid: false, error: '⛔ Clave de un solo uso ya utilizada' });
    }

    const bindings = await getKeyBindings(env);
    if (bindings[keyHash] && !bindings[keyHash].ips.includes(ip)) {
        await sendAlert(env, `🔑 Clave ${key} usada desde IP nueva: ${ip} (se detectaron ${bindings[keyHash].ips.length} IP(s) conocidas)`, 'security', key, ip);
        return jsonResponse({ success: false, valid: false, error: '🔒 Clave vinculada a otra IP' });
    }
    if (!bindings[keyHash]) await setKeyBinding(env, key, ip);

    if (kData.maxUses && currentUses >= kData.maxUses) {
        return jsonResponse({ success: false, valid: false, error: '⛔ Límite de usos alcanzado' });
    }

    if (currentUses > 0 && kData.history && kData.history.length >= 5) {
        const recent = kData.history.slice(0, 5);
        const first = new Date(recent[recent.length-1].timestamp).getTime();
        const last = new Date(recent[0].timestamp).getTime();
        if (last - first < 600000) {
            await sendAlert(env, `⚠️ Uso excesivo de clave ${key}: ${currentUses} usos en pocos minutos`, 'abuse', key, ip);
        }
    }

    if (kData.dynamic && kData.created_at) {
        const created = new Date(kData.created_at);
        const nowDate = new Date();
        const diffSeconds = (nowDate.getTime() - created.getTime()) / 1000;
        let maxSeconds = 0;
        const exp = kData.expires;
        if (exp !== "permanente") {
            const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
            if (match) {
                const num = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                if (unit.startsWith("día")) maxSeconds = num * 86400;
                else if (unit.startsWith("hora")) maxSeconds = num * 3600;
                else if (unit.startsWith("minuto")) maxSeconds = num * 60;
                else if (unit.startsWith("año")) maxSeconds = num * 31536000;
            }
        } else maxSeconds = Infinity;
        if (diffSeconds > maxSeconds) return jsonResponse({ success: false, valid: false, error: '⏰ Clave expirada' });
    }

    await updateStats(env, key, true, ip, userAgent);

    let timeLeft = '∞';
    if (kData.expires !== "permanente" && kData.dynamic && kData.created_at) {
        const created = new Date(kData.created_at);
        const nowDate = new Date();
        const diffSeconds = (nowDate.getTime() - created.getTime()) / 1000;
        let maxSeconds = 0;
        const exp = kData.expires;
        const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
        if (match) {
            const num = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit.startsWith("día")) maxSeconds = num * 86400;
            else if (unit.startsWith("hora")) maxSeconds = num * 3600;
            else if (unit.startsWith("minuto")) maxSeconds = num * 60;
            else if (unit.startsWith("año")) maxSeconds = num * 31536000;
        }
        const remaining = Math.max(0, maxSeconds - diffSeconds);
        if (remaining > 0) {
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const secs = Math.floor(remaining % 60);
            if (days > 0) timeLeft = `${days}d ${hours}h`;
            else if (hours > 0) timeLeft = `${hours}h ${minutes}m`;
            else if (minutes > 0) timeLeft = `${minutes}m ${secs}s`;
            else timeLeft = `${secs}s`;
        } else timeLeft = 'expirada';
    } else if (!kData.dynamic && kData.expires !== "permanente") {
        timeLeft = kData.expires;
    }

    const message = `✅ Clave válida (${kData.rango}) - Restante: ${timeLeft}`;
    const responseData = { success: true, valid: true, message, rango: kData.rango, timeLeft, dias_restantes: timeLeft === '∞' ? '∞' : (timeLeft.includes("día") ? timeLeft : Math.floor(parseInt(timeLeft) / 86400).toString()) };
    await setCachedValidKey(env, key, responseData);
    return jsonResponse(responseData);
}

async function handleVerifyWeb(env, request) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse({ success: false, error: 'Falta clave' }, 400);

    const ip = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || '';

    if (await isIPBlacklisted(env, ip)) {
        return jsonResponse({ success: false, error: 'IP bloqueada temporalmente' }, 403);
    }

    const allowed = await checkRateLimit(env, ip, key);
    if (!allowed) return jsonResponse({ success: false, error: 'Demasiadas verificaciones. Espera 1 hora.' }, 429);

    const keyHash = await hashKey(key);
    const dynamicKeys = await getDynamicKeys(env);
    let kData = null;
    let staticKey = STATIC_KEYS.find(k => k.hash === keyHash);
    if (staticKey) kData = { ...staticKey, dynamic: false };
    else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };

    if (!kData) {
        await updateStats(env, key, false, ip, userAgent);
        await registerIPFailure(env, ip);
        return jsonResponse({ success: false, valid: false, error: '❌ Clave inválida' });
    }

    if (kData.type === 'honeypot') {
        await sendAlert(env, `🐟 Honeypot activado para IP ${ip} con clave ${key}`, 'honeypot', key, ip);
        return jsonResponse({ success: true, valid: true, message: '✅ Clave válida (honeypot)', rango: kData.rango });
    }

    let isBlocked = false;
    let currentUses = 0;
    const stats = await getStats(env);
    const usage = stats.keys_usage?.[keyHash] || { count: 0, blocked: false };
    isBlocked = usage.blocked || false;
    currentUses = usage.count || 0;

    if (isBlocked) return jsonResponse({ success: false, valid: false, error: '🚫 Clave bloqueada' });
    if (kData.un_solo_uso && currentUses >= 1) return jsonResponse({ success: false, valid: false, error: '⛔ Clave de un solo uso ya utilizada' });
    if (kData.maxUses && currentUses >= kData.maxUses) return jsonResponse({ success: false, valid: false, error: '⛔ Límite de usos alcanzado' });

    if (kData.dynamic && kData.created_at) {
        const created = new Date(kData.created_at);
        const nowDate = new Date();
        const diffSeconds = (nowDate.getTime() - created.getTime()) / 1000;
        let maxSeconds = 0;
        const exp = kData.expires;
        if (exp !== "permanente") {
            const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
            if (match) {
                const num = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                if (unit.startsWith("día")) maxSeconds = num * 86400;
                else if (unit.startsWith("hora")) maxSeconds = num * 3600;
                else if (unit.startsWith("minuto")) maxSeconds = num * 60;
                else if (unit.startsWith("año")) maxSeconds = num * 31536000;
            }
        } else maxSeconds = Infinity;
        if (diffSeconds > maxSeconds) return jsonResponse({ success: false, valid: false, error: '⏰ Clave expirada' });
    }

    await updateStats(env, key, true, ip, userAgent);

    let timeLeft = '∞';
    if (kData.expires !== "permanente" && kData.dynamic && kData.created_at) {
        const created = new Date(kData.created_at);
        const nowDate = new Date();
        const diffSeconds = (nowDate.getTime() - created.getTime()) / 1000;
        let maxSeconds = 0;
        const exp = kData.expires;
        const match = exp.match(/^(\d+)\s*(día|dias|hora|horas|minuto|minutos|año|años)/i);
        if (match) {
            const num = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit.startsWith("día")) maxSeconds = num * 86400;
            else if (unit.startsWith("hora")) maxSeconds = num * 3600;
            else if (unit.startsWith("minuto")) maxSeconds = num * 60;
            else if (unit.startsWith("año")) maxSeconds = num * 31536000;
        }
        const remaining = Math.max(0, maxSeconds - diffSeconds);
        if (remaining > 0) {
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const secs = Math.floor(remaining % 60);
            if (days > 0) timeLeft = `${days}d ${hours}h`;
            else if (hours > 0) timeLeft = `${hours}h ${minutes}m`;
            else if (minutes > 0) timeLeft = `${minutes}m ${secs}s`;
            else timeLeft = `${secs}s`;
        } else timeLeft = 'expirada';
    }

    return jsonResponse({ success: true, valid: true, message: `✅ Clave válida (${kData.rango})`, rango: kData.rango, timeLeft });
}

async function handleKeyInfo(env, url) {
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse({ error: 'Falta clave' }, 400);
    const keyHash = await hashKey(key);
    const stats = await getStats(env);
    const dynamicKeys = await getDynamicKeys(env);
    let kData = null;
    let staticKey = STATIC_KEYS.find(k => k.hash === keyHash);
    if (staticKey) kData = { ...staticKey, dynamic: false };
    else if (dynamicKeys[keyHash]) kData = { ...dynamicKeys[keyHash], dynamic: true };
    if (!kData) return jsonResponse({ error: 'Clave no encontrada' }, 404);
    const usage = stats.keys_usage?.[keyHash] || { count: 0, history: [], blocked: false };
    return jsonResponse({
        rango: kData.rango, type: kData.type, expires: kData.expires,
        uses: usage.count || 0, maxUses: kData.maxUses || null,
        blocked: usage.blocked || false, dynamic: kData.dynamic || false,
        history: usage.history || [], tags: kData.tags || [],
        notas: kData.notas || '', un_solo_uso: kData.un_solo_uso || false,
        created_at: kData.created_at || null
    });
}

async function handleAdminAction(env, url, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const ip = getClientIP(request);

    const pinFailKey = `pin_fail_${ip}`;
    const failRecord = await env.STATS.get(pinFailKey, 'json');
    if (failRecord && failRecord.count >= PIN_BRUTE_LIMIT) {
        const now = Math.floor(Date.now() / 1000);
        if (now - failRecord.first_fail < PIN_BRUTE_WINDOW) {
            return jsonResponse({ error: 'Demasiados intentos de PIN. Espera 10 minutos.' }, 429);
        } else await env.STATS.delete(pinFailKey);
    }

    const pin = url.searchParams.get('pin');
    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) {
        let record = failRecord || { count: 0, first_fail: Math.floor(Date.now() / 1000) };
        record.count++;
        await env.STATS.put(pinFailKey, JSON.stringify(record), { expirationTtl: PIN_BRUTE_WINDOW });
        return jsonResponse({ error: 'PIN incorrecto' }, 403);
    }
    await env.STATS.delete(pinFailKey);

    const action = url.searchParams.get('action');
    const key = url.searchParams.get('key');
    if (!key) return jsonResponse({ error: 'Falta clave' }, 400);

    let result;
    switch (action) {
        case 'block':
            await blockKey(env, key);
            result = { message: 'Clave bloqueada' };
            break;
        case 'unblock':
            await unblockKey(env, key);
            result = { message: 'Clave desbloqueada' };
            break;
        case 'reset':
            await resetKeyUsage(env, key);
            result = { message: 'Usos reiniciados' };
            break;
        case 'delete': {
            const deleted = await deleteDynamicKey(env, key);
            if (deleted) {
                let stats = await getStats(env);
                const hash = await hashKey(key);
                if (stats && stats.keys_usage[hash]) { delete stats.keys_usage[hash]; await env.STATS.put("global_stats", JSON.stringify(stats)); }
                result = { message: 'Clave eliminada' };
            } else result = { error: 'No es una clave dinámica o no existe' };
            break;
        }
        case 'unbind': {
            const unbound = await unbindKey(env, key);
            result = { message: unbound ? 'IP desvinculada' : 'No estaba vinculada' };
            break;
        }
        case 'renew': {
            const hash = await hashKey(key);
            const days = parseInt(url.searchParams.get('days')) || 30;
            result = await withKVLock(env, "dynamic_keys", async () => {
                const dyn = await getDynamicKeys(env);
                if (!dyn[hash]) return { error: 'Clave no encontrada' };
                let current = dyn[hash].expires;
                let num = parseInt(current) || 30;
                if (current.includes('año')) num = 365;
                else if (current.includes('mes')) num = 30;
                const newExp = `${num + days} días`;
                dyn[hash].expires = newExp;
                dyn[hash].change_log = dyn[hash].change_log || [];
                dyn[hash].change_log.push({ action: 'renew', days_added: days, timestamp: new Date().toISOString() });
                await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
                await sendAlert(env, `🔄 Clave ${key} renovada +${days} días (nueva exp: ${newExp})`, 'admin', key);
                return { message: `Clave renovada. Nueva expiración: ${newExp}` };
            });
            break;
        }
        default: result = { error: 'Acción no válida' };
    }
    await logAdminAction(env, action, key, ip, result);
    return jsonResponse(result);
}

async function handleAdminCompras(env, url, headers) {
    const auth = await requireAdmin(env, new Request(url.toString(), { headers }));
    if (!auth) return new Response('⛔ No autorizado', { status: 403 });

    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;
    const { compras, total } = await getCompras(env, limit, offset);
    const totalPages = Math.ceil(total / limit);

    let rows = '';
    for (const c of compras) {
        rows += `<tr><td>${escapeHTML(c.email || '')}</td><td>${escapeHTML(c.producto || c.plan || '')}</td><td>${Number(c.precio || c.amount || 0).toFixed(2)}</td><td>${escapeHTML(c.fecha || c.created_at || '')}</td><td>${escapeHTML(c.estado || '')}</td></tr>`;
    }
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Compras - Ocean Hub</title><style>body{background:#0a1a2b;color:#e0f0ff;font-family:Segoe UI,sans-serif;padding:30px}table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.04)}th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}th{color:#00ccff}.back{color:#00ccff}</style></head><body><h1>🧾 Compras</h1><div style="overflow:auto"><table><thead><tr><th>Email</th><th>Producto</th><th>Precio</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div><p>Página ${page} de ${Math.max(totalPages,1)}</p><a class="back" href="/admin">← Volver al panel</a></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleGenerate(env, request, url) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const pin = body.pin;
    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) return jsonResponse({ error: 'PIN incorrecto' }, 403);

    let { key, type, rango, expires, maxUses, tags, notas, un_solo_uso } = body;
    if (!key) {
        let attempts = 0;
        let exists = true;
        while (exists && attempts < 10) {
            key = 'DLC-' + generateRandomHex(6).toUpperCase().match(/.{1,4}/g).join('-');
            const hash = await hashKey(key);
            const dyn = await getDynamicKeys(env);
            exists = !!dyn[hash] || STATIC_KEYS.some(k => k.hash === hash);
            attempts++;
        }
        if (exists) return jsonResponse({ error: 'No se pudo generar una clave única' }, 500);
    } else {
        const hash = await hashKey(key);
        const dyn = await getDynamicKeys(env);
        if (dyn[hash]) return jsonResponse({ error: 'La clave ya existe' }, 400);
        if (STATIC_KEYS.some(k => k.hash === hash)) return jsonResponse({ error: 'La clave ya existe como estática' }, 400);
    }

    if (un_solo_uso) {
        maxUses = 1;
    }

    const keyData = {
        key, type: type || 'premium', rango: rango || '🦈 Tiburón',
        expires: expires || '30 días', maxUses: maxUses || undefined,
        un_solo_uso: un_solo_uso || false,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        notas: notas || '', dynamic: true, created_at: new Date().toISOString(),
        blocked: false, count: 0, history: [],
        change_log: [{ action: 'created', timestamp: new Date().toISOString() }]
    };
    const saved = await saveDynamicKey(env, keyData);
    if (!saved) return jsonResponse({ error: 'Error al guardar la clave en el KV' }, 500);
    await logAdminAction(env, 'generate', key, getClientIP(request), { keyData });
    return jsonResponse({ message: 'Clave generada correctamente', key, keyData });
}

async function handleGenerateBatch(env, url, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const pin = url.searchParams.get('pin');
    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) return jsonResponse({ error: 'PIN incorrecto' }, 403);
    let count = parseInt(url.searchParams.get('count')) || 5;
    count = Math.min(Math.max(count, 1), 50);

    const keys = [];
    for (let i=0; i<count; i++) {
        let key = 'DLC-' + generateRandomHex(6).toUpperCase().match(/.{1,4}/g).join('-');
        const hash = await hashKey(key);
        const dyn = await getDynamicKeys(env);
        if (!dyn[hash] && !STATIC_KEYS.some(k => k.hash === hash)) {
            const keyData = { key, type: 'premium', rango: '🦈 Tiburón', expires: '30 días', dynamic: true, created_at: new Date().toISOString(), blocked: false, count: 0, history: [], tags: [], notas: '', un_solo_uso: false, change_log: [{ action: 'created_batch', timestamp: new Date().toISOString() }] };
            const saved = await saveDynamicKey(env, keyData);
            if (saved) keys.push(key);
        }
    }
    if (keys.length === 0) return jsonResponse({ error: 'No se pudo generar ninguna clave' });
    return jsonResponse({ message: `Generadas ${keys.length} claves`, keys });
}

async function handleExportCsv(env, url) {

    const filtros = {
        rango: url.searchParams.get('rango') || null,
        type: url.searchParams.get('type') || null,
        estado: url.searchParams.get('estado') || null,
        desde: url.searchParams.get('desde') || null,
        hasta: url.searchParams.get('hasta') || null
    };

    const stats = await getStats(env) || {};
    const dynamicKeys = await getDynamicKeys(env) || {};
    let allKeys = [];
    for (let k of STATIC_KEYS) {
        const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: '', un_solo_uso: false });
    }
    for (let hash in dynamicKeys) {
        const k = dynamicKeys[hash];
        const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: (k.tags || []).join(', '), notas: k.notas || '', un_solo_uso: k.un_solo_uso || false });
    }

    if (filtros.rango) allKeys = allKeys.filter(k => k.rango.toLowerCase().includes(filtros.rango.toLowerCase()));
    if (filtros.type) allKeys = allKeys.filter(k => k.type === filtros.type);
    if (filtros.estado) {
        if (filtros.estado === 'activa') allKeys = allKeys.filter(k => !k.blocked);
        else if (filtros.estado === 'bloqueada') allKeys = allKeys.filter(k => k.blocked);
        else if (filtros.estado === 'expirada') {
            allKeys = allKeys.filter(k => k.expires !== 'permanente' && !k.blocked);
        }
    }

    let csv = 'Clave,Rango,Tipo,Duración,Usos,Estado,Dinámica,Tags,Notas,UnSoloUso\n';
    allKeys.forEach(k => {
        csv += `${k.key},${k.rango},${k.type},${k.expires},${k.uses},${k.blocked ? 'Bloqueada' : 'Activa'},${k.dynamic ? 'Sí' : 'No'},${k.tags},${k.notas},${k.un_solo_uso ? 'Sí' : 'No'}\n`;
    });
    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="ocean_hub_keys_export.csv"'
        }
    });
}

async function handleExportJson(env, url) {

    const stats = await getStats(env);
    const dynamicKeys = await getDynamicKeys(env);
    let allKeys = [];
    for (let k of STATIC_KEYS) {
        const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: '', un_solo_uso: false });
    }
    for (let hash in dynamicKeys) {
        const k = dynamicKeys[hash];
        const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [], notas: k.notas || '', un_solo_uso: k.un_solo_uso || false });
    }

    const rango = url.searchParams.get('rango');
    const type = url.searchParams.get('type');
    const estado = url.searchParams.get('estado');
    if (rango) allKeys = allKeys.filter(k => k.rango.toLowerCase().includes(rango.toLowerCase()));
    if (type) allKeys = allKeys.filter(k => k.type === type);
    if (estado) {
        if (estado === 'activa') allKeys = allKeys.filter(k => !k.blocked);
        else if (estado === 'bloqueada') allKeys = allKeys.filter(k => k.blocked);
    }

    return jsonResponse({ keys: allKeys, total: allKeys.length, exported_at: new Date().toISOString() });
}

async function handleWebhook(env, request) {
    const body = await request.json();
    const { message, severity, key, ip } = body;
    await sendAlert(env, `🚨 **ALERTA**\n${message}\nClave: ${key || 'N/A'}\nIP: ${ip || 'N/A'}`, severity, key, ip);
    return jsonResponse({ status: 'alert sent' });
}

async function handleQR(env, url) {
    const totpSecret = String(env.TOTP_SECRET || '').trim().replace(/=+$/,'').toUpperCase();
    if (!/^[A-Z2-7]{16,128}$/.test(totpSecret)) {
        return jsonResponse({ error: 'TOTP_SECRET no configurado correctamente' }, 503);
    }
    const otpauth = buildOTPAuthURI(totpSecret, 'admin', 'Ocean Hub');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
    return new Response(`
    <html>
    <body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
      <h2 style="color:#00ccff;">📱 Escanea este QR con Google Authenticator</h2>
      <img src="${qrUrl}" style="border:4px solid #00ccff;border-radius:20px;">
      <p style="margin-top:20px;color:#88aacc;">No compartas el secreto TOTP.</p>
      <a href="/admin" style="color:#00ccff;margin-top:20px;">Volver al panel</a>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}

async function handleSSE(env) {
    const stats = await getStats(env);
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(stats)}\n\n`));
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                const newStats = await getStats(env);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(newStats)}\n\n`));
            }
        }
    });
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
        }
    });
}

// ==================================================
// [ HANDLERS ROADMAP ]
// ==================================================

async function handleStatus(env) {
    const stats = await getStats(env);
    const uptime = stats ? Math.floor((Date.now() - new Date(stats.start_time).getTime()) / 1000) : 0;
    const dynamicKeys = await getDynamicKeys(env);
    const totalKeys = STATIC_KEYS.length + Object.keys(dynamicKeys).length;
    return jsonResponse({
        status: 'online', uptime_seconds: uptime, total_keys: totalKeys,
        valid_verifications: stats?.valid_verifications || 0,
        total_verifications: stats?.total_verifications || 0,
        active_keys: Object.values(stats?.keys_usage || {}).filter(u => !u.blocked).length,
        server_time: new Date().toISOString()
    });
}

async function handleClaimKey(env, request) {
    const auth = await requireAuth(env, request); if (!auth) return new Response('No autorizado',{status:403});
    if (!(await checkRateLimit(env, getClientIP(request), null))) return jsonResponse({error:'Demasiados intentos'},429);
    const url = new URL(request.url);
    const codigo = url.searchParams.get('codigo');
    const email = auth.user.email;

    if (request.method === 'GET' && !codigo) {
        return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;max-width:400px;">
                    <h2 style="color:#00ccff;">🎫 Canjear código</h2>
                    <form method="GET" action="/claim-key">
                        <input type="text" name="codigo" placeholder="Código de canje" style="padding:10px;border-radius:8px;border:none;margin:5px;width:100%;">
                        <input type="email" name="email" placeholder="Tu email" style="padding:10px;border-radius:8px;border:none;margin:5px;width:100%;">
                        <button type="submit" style="padding:10px 30px;background:#00ccff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Canjear</button>
                    </form>
                </div>
            </body></html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }

    if (!codigo || !email) {
        return new Response('❌ Faltan parámetros: codigo y email son obligatorios.', { status: 400 });
    }

    try {
        const entry = await usarCodigoCanje(env, codigo, email);
        const productoId = entry.producto_id;
        const producto = PRODUCTS[productoId] || PRODUCTS.price_aprendiz;
        const key = 'DLC-CANJE-' + generateRandomHex(5).toUpperCase();
        const keyData = {
            key, type: 'premium', rango: '🎫 Canjeado',
            expires: `${producto.days || 30} días`, dynamic: true,
            created_at: new Date().toISOString(), blocked: false, count: 0,
            history: [], tags: ['canje'],
            notas: `Canjeado por ${email} con código ${codigo}`,
            un_solo_uso: false,
            change_log: [{ action: 'created_from_canje', timestamp: new Date().toISOString() }]
        };
        await saveDynamicKey(env, keyData);
        await registrarCompra(env, {
            fecha: new Date().toISOString(), email: email, user_id: '',
            clave: key, producto: producto.name, precio: producto.price,
            payment_id: codigo, proveedor: 'canje', estado: 'activa'
        });
        await sendAlert(env, `🎫 Código canjeado: ${email} usó ${codigo} para obtener clave ${key}`, 'canje', key);
        await logUserAction(env, email, 'claim', { codigo, key });
        await sendEmail(env, email, 'Clave canjeada', `<h1>✅ Clave canjeada</h1><p>Tu clave es: <code>${key}</code></p><p>Producto: ${producto.name}</p>`);
        return new Response(`✅ ¡Código canjeado! Tu clave es: <code>${key}</code>`, { headers: { 'Content-Type': 'text/html' } });
    } catch (err) {
        return new Response(`❌ ${err.message}`, { status: 400 });
    }
}

async function handleRenewKey(env, request) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const days = parseInt(url.searchParams.get('days')) || 30;
    if (!key) return jsonResponse({ error: 'Falta clave' }, 400);

    const hash = await hashKey(key);
    return await withKVLock(env, "dynamic_keys", async () => {
        const dyn = await getDynamicKeys(env);
        if (!dyn[hash]) return jsonResponse({ error: 'Clave no encontrada o no dinámica' }, 404);
        let current = dyn[hash].expires;
        let num = parseInt(current) || 30;
        if (current.includes('año')) num = 365;
        else if (current.includes('mes')) num = 30;
        const newExp = `${num + days} días`;
        dyn[hash].expires = newExp;
        dyn[hash].change_log = dyn[hash].change_log || [];
        dyn[hash].change_log.push({ action: 'renew', days_added: days, timestamp: new Date().toISOString() });
        await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
        await sendAlert(env, `🔄 Clave ${key} renovada +${days} días (nueva exp: ${newExp})`, 'admin', key);
        return jsonResponse({ message: `Clave renovada. Nueva expiración: ${newExp}` });
    });
}

async function handleInvoice(env, url, request) {
    const auth = await requireAuth(env, request); if (!auth) return jsonResponse({ error:'No autorizado' },403);
    const id = url.pathname.split('/')[2];
    if (!id) return jsonResponse({ error: 'Falta ID' }, 400);
    const raw = await env.STATS.get(id);
    if (!raw) return jsonResponse({ error: 'Factura no encontrada' }, 404);
    const data = JSON.parse(raw);
    if (data.email !== auth.user.email) {
        return jsonResponse({ error: 'Factura no encontrada' }, 404);
    }
    const html = `
    <html><head><title>Factura ${id}</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:40px;}h1{color:#00ccff;}</style>
    </head>
    <body>
        <h1>🌊 Ocean Hub - Factura</h1>
        <p><strong>ID:</strong> ${escapeHTML(id)}</p>
        <p><strong>Fecha:</strong> ${escapeHTML(data.fecha)}</p>
        <p><strong>Producto:</strong> ${escapeHTML(data.producto)}</p>
        <p><strong>Precio:</strong> $${escapeHTML(data.precio)}</p>
        <p><strong>Clave:</strong> ${escapeHTML(data.clave)}</p>
        <p><strong>Email:</strong> ${escapeHTML(data.email)}</p>
    </body></html>
    `;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}

async function handlePublicStats(env) {
    const stats = await getStats(env);
    if (!stats) return jsonResponse({ error: 'No stats' }, 500);
    return jsonResponse({
        total_verifications: stats.total_verifications || 0,
        valid_verifications: stats.valid_verifications || 0,
        invalid_verifications: stats.invalid_verifications || 0,
        active_keys: Object.values(stats.keys_usage || {}).filter(u => !u.blocked).length,
        uptime: stats.start_time ? Math.floor((Date.now() - new Date(stats.start_time).getTime()) / 1000) : 0
    });
}

async function handleSearchKey(env, url) {
    const q = url.searchParams.get('q') || '';
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

async function handleVerifyBatch(env, request) {
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }
    const keys = body.keys;
    if (!Array.isArray(keys) || keys.length === 0) return jsonResponse({ error: 'Se requiere un array de claves' }, 400);
    if (keys.length > 100) return jsonResponse({ error: 'Máximo 100 claves por lote' }, 413);
    const results = [];
    for (let k of keys) {
        const hash = await hashKey(k);
        const dyn = await getDynamicKeys(env);
        const exists = dyn[hash] || STATIC_KEYS.some(sk => sk.hash === hash);
        results.push({ key: k, valid: !!exists });
    }
    return jsonResponse({ results });
}

async function handleShorten(env, request) {
    const url = new URL(request.url);
    const longUrl = url.searchParams.get('url');
    if (!longUrl) return jsonResponse({ error: 'Falta parámetro url' }, 400);
    let parsedUrl; try { parsedUrl = new URL(longUrl); } catch { return jsonResponse({ error: 'URL inválida' }, 400); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return jsonResponse({ error: 'Solo se permiten URLs HTTP/HTTPS' }, 400);
    const id = generateRandomHex(4).toLowerCase();
    await env.STATS.put(`short_${id}`, longUrl, { expirationTtl: 86400 * 30 });
    const short = `${url.origin}/s/${id}`;
    return jsonResponse({ short, id, original: longUrl });
}

async function handleWebhookTest(env) {
    await sendAlert(env, '🧪 Mensaje de prueba desde Ocean Hub Webhook', 'test');
    return jsonResponse({ status: 'test sent' });
}

async function handleAdminLogs(env, url) {
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    const { logs, total } = await getAdminLogs(env, limit, offset);
    let rows = logs.map(log => `<tr><td>${log.timestamp}</td><td>${log.action}</td><td>${log.key || 'N/A'}</td><td>${log.ip}</td><td>${JSON.stringify(log.details)}</td></tr>`).join('');
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Admin Logs</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:10px;border-bottom:1px solid #333;}</style>
    </head><body>
    <h1 style="color:#00ccff;">📋 Logs de administración</h1>
    <table><thead><tr><th>Fecha</th><th>Acción</th><th>Clave</th><th>IP</th><th>Detalles</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Total: ${total} registros</p>
    <a href="/admin" style="color:#00ccff;">Volver</a>
    </body></html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleBatchExpire(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const keys = Array.isArray(body.keys) ? body.keys : [];
    const days = parseInt(body.days) || 30;
    if (!keys.length) return jsonResponse({ error: 'Faltan claves' }, 400);
    let modified = 0, notFound = 0;
    await withKVLock(env, "dynamic_keys", async () => {
        const dyn = await getDynamicKeys(env);
        for (let k of keys) {
            const hash = await hashKey(k);
            if (dyn[hash]) {
                const current = dyn[hash].expires;
                let num = parseInt(current) || 30;
                if (current.includes('año')) num = 365;
                else if (current.includes('mes')) num = 30;
                dyn[hash].expires = `${num + days} días`;
                dyn[hash].change_log = dyn[hash].change_log || [];
                dyn[hash].change_log.push({ action: 'batch_expire', days_added: days, timestamp: new Date().toISOString() });
                modified++;
            } else {
                notFound++;
            }
        }
        await env.STATS.put("dynamic_keys", JSON.stringify(dyn));
    });
    await sendAlert(env, `📦 Caducidad en lote: ${modified} claves extendidas +${days} días (${notFound} no encontradas)`, 'admin');
    return jsonResponse({ message: `${modified} claves actualizadas, ${notFound} no encontradas` });
}

async function handleAdminConsole(env, request) {
    const url = new URL(request.url);
    const body = await request.json();
    const cmd = body.cmd;
    if (!cmd) return jsonResponse({ error: 'Falta comando' }, 400);
    let result = '';
    if (cmd.startsWith('/ban ')) {
        const ip = cmd.split(' ')[1];
        if (ip) { await addIPToBlacklist(env, ip); result = `IP ${ip} bloqueada`; }
    } else if (cmd.startsWith('/unban ')) {
        const ip = cmd.split(' ')[1];
        if (ip) { await env.STATS.delete(`blacklist_${ip}`); result = `IP ${ip} desbloqueada`; }
    } else if (cmd.startsWith('/block ')) {
        const key = cmd.split(' ')[1];
        if (key) { await blockKey(env, key); result = `Clave ${key} bloqueada`; }
    } else if (cmd.startsWith('/unblock ')) {
        const key = cmd.split(' ')[1];
        if (key) { await unblockKey(env, key); result = `Clave ${key} desbloqueada`; }
    } else if (cmd.startsWith('/reset ')) {
        const key = cmd.split(' ')[1];
        if (key) { await resetKeyUsage(env, key); result = `Usos de ${key} reiniciados`; }
    } else if (cmd === '/stats') {
        const stats = await getStats(env);
        result = JSON.stringify(stats, null, 2);
    } else {
        result = 'Comando no reconocido. Usa /ban IP, /unban IP, /block key, /unblock key, /reset key, /stats';
    }
    return jsonResponse({ result });
}

async function handleShortRedirect(env, url) {
    const id = url.pathname.split('/')[2];
    if (!id) return new Response('Falta ID', { status: 400 });
    const long = await env.STATS.get(`short_${id}`);
    if (!long) return new Response('URL no encontrada', { status: 404 });
    return Response.redirect(long, 302);
}

async function handleAdminIngresos(env, url) {
    const { compras } = await getCompras(env, 10000, 0);
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const semana = new Date(ahora.getTime() - 7 * 86400000);
    const mes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate());

    let ventasDia = 0, ventasSemana = 0, ventasMes = 0, totalIngresos = 0;
    const porProducto = {};
    compras.forEach(c => {
        const fecha = new Date(c.fecha);
        const precio = parseFloat(c.precio) || 0;
        totalIngresos += precio;
        if (fecha >= hoy) ventasDia += precio;
        if (fecha >= semana) ventasSemana += precio;
        if (fecha >= mes) ventasMes += precio;
        const prod = c.producto || 'Desconocido';
        porProducto[prod] = (porProducto[prod] || 0) + precio;
    });
    let productoMasVendido = 'Ninguno';
    let maxVentas = 0;
    for (let [prod, total] of Object.entries(porProducto)) {
        if (total > maxVentas) { maxVentas = total; productoMasVendido = prod; }
    }

    return jsonResponse({
        dia: ventasDia, semana: ventasSemana, mes: ventasMes,
        total: totalIngresos, producto_mas_vendido: productoMasVendido,
        total_compras: compras.length
    });
}

async function handleCronRenew(env, request) {
    if (!request || request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const userList = await env.STATS.get('user_list', 'json') || [];
    let renovadas = 0;
    let alertadas = 0;
    for (let email of userList) {
        const sus = await getSuscripcionUsuario(env, email);
        if (!sus || !sus.activa) continue;
        const fin = new Date(sus.fecha_fin);
        const ahora = new Date();
        const diffDias = Math.ceil((fin.getTime() - ahora.getTime()) / 86400000);
        if (diffDias === 3) {
            await sendAlert(env, `⏳ La suscripción de ${email} (${sus.plan}) caduca en 3 días`, 'suscripcion');
            await sendEmail(env, email, 'Tu suscripción caduca en 3 días', `<h1>⏳ Aviso</h1><p>Tu suscripción caduca en 3 días. Renueva para no perder los beneficios.</p>`);
            alertadas++;
        }
        if (diffDias <= 0 && sus.renovacion_automatica) {
            try {
                await renovarSuscripcion(env, email, SUSCRIPCION_PLANES[sus.plan].days);
                renovadas++;
            } catch (e) { console.error('Error renovando:', e); }
        }
    }
    return jsonResponse({ message: `Renovadas ${renovadas} suscripciones, alertadas ${alertadas}` });
}

async function handleGenerarPrueba(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const pin = body.pin;
    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) return jsonResponse({ error: 'PIN incorrecto' }, 403);
    const horas = parseInt(body.horas) || 1;
    const key = 'DLC-PRUEBA-' + generateRandomHex(4).toUpperCase();
    const keyData = {
        key, type: 'prueba', rango: '🧪 Prueba',
        expires: `${horas} hora${horas > 1 ? 's' : ''}`,
        maxUses: 1, un_solo_uso: true, tags: ['prueba'],
        notas: `Clave de prueba de ${horas}h generada por admin`,
        dynamic: true, created_at: new Date().toISOString(),
        blocked: false, count: 0, history: [],
        change_log: [{ action: 'created_prueba', timestamp: new Date().toISOString() }]
    };
    await saveDynamicKey(env, keyData);
    await sendAlert(env, `🧪 Clave de prueba generada: ${key} (${horas}h)`, 'admin', key);
    return jsonResponse({ message: 'Clave de prueba generada', key, horas });
}

// ==================================================
// [ HANDLERS DE USUARIOS ]
// ==================================================

async function handleRegister(env, request) {
    const url = new URL(request.url);
    const ref = url.searchParams.get('ref') || null;

    if (request.method === 'GET') {
        const acceptLang = request.headers.get('Accept-Language') || 'es';
        const lang = acceptLang.split(',')[0].split('-')[0];
        const t = (key) => getTranslation(env, lang, key);
        return new Response(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>${t('register')} - Ocean Hub</title>
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
            <h2>🌊 ${t('register')}</h2>
            ${ref ? `<p style="color:#88ddff;">🔗 Registrándote con el referido: <strong>${escapeHTML(ref)}</strong></p>` : ''}
            <form method="POST" action="/register${ref ? '?ref='+encodeURIComponent(ref) : ''}">
                <input type="text" name="name" placeholder="${t('name')} (opcional)">
                <input type="email" name="email" placeholder="${t('email')}" required>
                <input type="password" name="password" placeholder="${t('password')} (8-128 caracteres)" required minlength="8" maxlength="128">
                ${ref ? `<input type="hidden" name="ref" value="${escapeHTML(ref)}">` : ''}
                <button type="submit">${t('register')}</button>
            </form>
            <p style="text-align:center; margin-top:15px;">¿Ya tienes cuenta? <a href="/login" style="color:#00ccff;">${t('login')}</a></p>
            <a href="/welcome" class="back">← ${t('home')}</a>
        </div>
        ${getCookieBannerScript()}
        ${getLegalFooter()}
        </body>
        </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }

    const registerAllowed = await checkActionRateLimit(env, 'register', getClientIP(request), REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW);
    if (!registerAllowed) {
        return new Response('Demasiados registros desde esta conexión. Espera 10 minutos.', { status: 429 });
    }
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name') || '';
    const referralCode = formData.get('ref') || ref || null;

    if (!email || !password || password.length < 8 || password.length > 128) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">❌ Error</h2>
                <p>Email y contraseña (8-128 caracteres) son obligatorios.</p>
                <a href="/register" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    try {
        const user = await createUser(env, email, name, password, referralCode);
        const token = await createSession(env, user);
        const cookie = buildSessionCookie(token);
        await logUserAction(env, email, 'register', { referralCode });
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#00cc88;">✅ Registro exitoso</h2>
            <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
            <p>Tu código de referido: <code style="background:#112233;padding:4px 12px;border-radius:6px;">${escapeHTML(user.referral_code)}</code></p>
            <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
        </body></html>
        `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
    } catch (err) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">❌ Error</h2>
                <p>No se pudo completar la operación. Inténtalo de nuevo.</p>
                <a href="/register" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }
}

async function handleLogin(env, request) {
    const url = new URL(request.url);
    const ip = getClientIP(request);

    if (request.method !== 'GET') {
        const ipAllowed = await checkActionRateLimit(env, 'login-ip', ip, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
        if (!ipAllowed) {
            return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">⛔ Demasiados intentos</h2>
                    <p>Espera 10 minutos antes de intentar de nuevo.</p>
                    <a href="/login" style="color:#00ccff;">Volver</a>
                </div>
            </body></html>
            `, { status: 429, headers: { 'Content-Type': 'text/html' } });
        }
    }

    if (request.method === 'GET') {
        const acceptLang = request.headers.get('Accept-Language') || 'es';
        const lang = acceptLang.split(',')[0].split('-')[0];
        const t = (key) => getTranslation(env, lang, key);
        return new Response(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>${t('login')} - Ocean Hub</title>
        <style>
            * { box-sizing: border-box; }
            body { background: radial-gradient(circle at 20% 20%, rgba(0,204,255,.16), transparent 35%), radial-gradient(circle at 80% 80%, rgba(77,93,255,.14), transparent 35%), #0a1a2b; color: #e0f0ff; font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column; padding: 20px; overflow:hidden; position:relative; }
            body::before, body::after { content:''; position:fixed; width:280px; height:280px; border-radius:50%; filter:blur(70px); opacity:.28; pointer-events:none; animation: floatOrb 9s ease-in-out infinite alternate; background:#00ccff; }
            body::before { top:-120px; left:-100px; }
            body::after { right:-100px; bottom:-120px; background:#6c63ff; animation-delay:-4s; }
            .card { position:relative; z-index:1; background:linear-gradient(145deg, rgba(255,255,255,.10), rgba(255,255,255,.035)); backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); border-radius:30px; padding:40px; max-width:430px; width:100%; border:1px solid rgba(0,200,255,.25); box-shadow:0 25px 80px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.08); animation: cardIn .75s cubic-bezier(.2,.8,.2,1) both; }
            h2 { color: #00ccff; text-align: center; text-shadow:0 0 24px rgba(0,204,255,.45); animation:titlePulse 2.8s ease-in-out infinite; }
            input { width: 100%; padding: 13px 14px; border-radius: 12px; border: 1px solid transparent; outline:none; background: rgba(255,255,255,0.08); color: white; font-size: 1rem; margin: 8px 0; transition:.25s ease; }
            input:focus { border-color:#00ccff; box-shadow:0 0 0 4px rgba(0,204,255,.10), 0 0 24px rgba(0,204,255,.12); transform:translateY(-1px); }
            button { background: linear-gradient(135deg,#00ccff,#4d8dff); border: none; color: #0a1a2b; padding: 12px; border-radius: 40px; font-weight: bold; font-size: 1.2rem; cursor: pointer; width: 100%; transition: 0.3s; box-shadow:0 10px 28px rgba(0,140,255,.22); }
            button:hover { transform:translateY(-2px); box-shadow:0 14px 34px rgba(0,180,255,.30); }
            button:active { transform:translateY(0) scale(.99); }
            .back { margin-top: 20px; color: #00ccff; text-decoration: none; transition:.25s; }
            .back:hover { transform:translateX(-3px); display:inline-block; }
            .auth-options { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:18px 0; }
            .auth-options a { display:flex; align-items:center; justify-content:center; gap:9px; color:#fff; text-decoration:none; padding:12px 14px; border-radius:14px; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.08); transition:.25s ease; }
            .auth-options a:hover { background:rgba(255,255,255,.11); transform:translateY(-2px); border-color:rgba(0,204,255,.28); box-shadow:0 10px 25px rgba(0,0,0,.18); }
            .oauth-icon { width:20px; height:20px; flex:0 0 20px; }
            @keyframes cardIn { from{opacity:0;transform:translateY(30px) scale(.97)} to{opacity:1;transform:none} }
            @keyframes floatOrb { from{transform:translate3d(0,0,0) scale(1)} to{transform:translate3d(35px,-25px,0) scale(1.12)} }
            @keyframes titlePulse { 0%,100%{text-shadow:0 0 20px rgba(0,204,255,.35)} 50%{text-shadow:0 0 34px rgba(0,204,255,.70)} }
            @media (max-width:520px) { .card{padding:28px 20px;border-radius:24px}.auth-options{grid-template-columns:1fr} }
            .forgot { text-align:center; margin-top:10px; }
            .forgot a { color:#88ddff; text-decoration:none; font-size:0.9rem; }
            .forgot a:hover { color:#00ccff; }
        </style>
        </head>
        <body>
        <div class="card">
            <h2>🔐 ${t('login')}</h2>
            <div class="auth-options">
                <a href="/auth/discord" aria-label="Continuar con Discord">
                    <svg class="oauth-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#5865F2" d="M19.54 5.02A18.1 18.1 0 0 0 15.1 3.65a.07.07 0 0 0-.07.03c-.2.36-.43.83-.59 1.2a16.3 16.3 0 0 0-4.88 0c-.16-.37-.4-.84-.6-1.2a.07.07 0 0 0-.07-.03 18.1 18.1 0 0 0-4.44 1.37.06.06 0 0 0-.03.03C1.6 9.1.83 13.08 1.22 17a.08.08 0 0 0 .03.05 18.2 18.2 0 0 0 5.47 2.74.07.07 0 0 0 .08-.03c.42-.57.8-1.16 1.13-1.79a.07.07 0 0 0-.04-.1 12 12 0 0 1-1.7-.81.07.07 0 0 1-.01-.12l.34-.26a.07.07 0 0 1 .07-.01c3.55 1.62 7.39 1.62 10.9 0a.07.07 0 0 1 .07.01l.34.26a.07.07 0 0 1-.01.12c-.54.32-1.1.59-1.7.81a.07.07 0 0 0-.04.1c.34.62.72 1.22 1.14 1.79a.07.07 0 0 0 .08.03 18.2 18.2 0 0 0 5.47-2.74.07.07 0 0 0 .03-.05c.46-4.54-.78-8.48-3.28-11.95a.06.06 0 0 0-.03-.03ZM8.2 14.67c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.07 0 1.91.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Zm7.6 0c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.07 0 1.91.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Z"/></svg>
                    <span>Discord</span>
                </a>
                <a href="/auth/google" aria-label="Continuar con Google">
                    <svg class="oauth-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.23a4.47 4.47 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.92-4.2 2.92-7.27Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.54 13.59A5.86 5.86 0 0 1 6.23 12c0-.55.1-1.09.31-1.59V7.88H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.05 4.12l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.48 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 8.1 9.46 6.38 12 6.38Z"/></svg>
                    <span>Google</span>
                </a>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1); margin: 15px 0;">
            <form method="POST" action="/login">
                <input type="email" name="email" placeholder="${t('email')}" required>
                <input type="password" name="password" placeholder="${t('password')}" required>
                <button type="submit">${t('login')}</button>
            </form>
            <p class="forgot"><a href="/forgot-password">¿Olvidaste tu contraseña?</a></p>
            <p style="text-align:center; margin-top:15px;">¿No tienes cuenta? <a href="/register" style="color:#00ccff;">${t('register')}</a></p>
            <a href="/welcome" class="back">← ${t('home')}</a>
        </div>
        ${getCookieBannerScript()}
        ${getLegalFooter()}
        </body>
        </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }

    const formData = await request.formData();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const accountRateKey = email ? await hashKey(email) : 'unknown';
    const accountAllowed = await checkActionRateLimit(env, 'login-account', accountRateKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
    if (!accountAllowed) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;text-align:center;padding:50px;font-family:monospace;">
            <h2 style="color:#ff6666;">⛔ Demasiados intentos</h2>
            <p>Espera 10 minutos antes de intentar de nuevo.</p>
            <a href="/login" style="color:#00ccff;">Volver</a>
        </body></html>
        `, { status: 429, headers: { 'Content-Type': 'text/html' } });
    }

    if (!email || !password) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">❌ Error</h2>
                <p>Email y contraseña son obligatorios.</p>
                <a href="/login" style="color:#00ccff;">Volver a intentar</a>
            </div>
        </body></html>
        `, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    const user = await authenticateUser(env, email, password);
    if (!user) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">❌ Credenciales incorrectas</h2>
                <a href="/login" style="color:#00ccff;">Volver a intentar</a>
                <p style="margin-top:15px;"><a href="/forgot-password" style="color:#88ddff;font-size:0.9rem;">¿Olvidaste tu contraseña?</a></p>
            </div>
        </body></html>
        `, { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    if (user.otp_secret) {
        const tempToken = generateRandomHex(16);
        await env.STATS.put(`2fa_temp_${tempToken}`, user.email, { expirationTtl: 300 });
        const cookie = `2fa_temp=${tempToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=300; Path=/verify-2fa`;
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#ffaa00;">🔐 Verificación en dos pasos</h2>
            <form action="/verify-2fa" method="POST">
                <input type="text" name="code" placeholder="Código de 6 dígitos" style="padding:10px;border-radius:8px;border:none;font-size:18px;text-align:center;">
                <button type="submit" style="padding:10px 30px;background:#00ccff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Verificar</button>
            </form>
        </body></html>
        `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
    }

    await recordSuccessfulLogin(env, user, request, 'Contraseña');
    const token = await createSession(env, user);
    const cookie = buildSessionCookie(token);
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Sesión iniciada</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
}

async function handleVerify2FA(env, request) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return new Response('No autorizado', { status: 401 });
    const match = cookie.match(/2fa_temp=([^;]+)/);
    if (!match) return new Response('No autorizado', { status: 401 });
    const tempToken = match[1];
    const email = await env.STATS.get(`2fa_temp_${tempToken}`);
    if (!email) return new Response('Token expirado', { status: 401 });

    const totpAllowed = await checkActionRateLimit(env, 'login-2fa', await hashKey(email), TOTP_RATE_LIMIT, TOTP_RATE_WINDOW);
    if (!totpAllowed) return new Response('Demasiados códigos 2FA. Espera 10 minutos.', { status: 429 });
    const formData = await request.formData();
    const code = String(formData.get('code') || '').trim();
    const user = await getUserByEmail(env, email);
    if (!user) return new Response('Usuario no encontrado', { status: 404 });

    const valid = await verifyTOTP(env, user.otp_secret, code);
    if (!valid) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <h2 style="color:#ff6666;">❌ Código incorrecto</h2>
            <a href="/login" style="color:#00ccff;">Volver a intentar</a>
        </body></html>
        `, { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    await env.STATS.delete(`2fa_temp_${tempToken}`);
    await recordSuccessfulLogin(env, user, request, 'Contraseña + 2FA');
    await logUserAction(env, email, 'login_2fa', { ip: getClientIP(request) });
    const sessionToken = await createSession(env, user);
    const cookieSession = buildSessionCookie(sessionToken);
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Verificación exitosa</h2>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookieSession } });
}

async function handleLogout(env, request) {
    const auth = await requireAuth(env, request);
    if (auth) {
        await destroySession(env, auth.sessionToken);
    }
    const cookie = 'session_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/';
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00ccff;">👋 Sesión cerrada</h2>
        <p>Has cerrado sesión correctamente.</p>
        <a href="/welcome" style="color:#00ccff;">Volver al inicio</a>
    </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
}

// ==================================================
// [ PERFIL DE USUARIO ]
// ==================================================
async function handleProfile(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) {
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
            <div style="text-align:center;">
                <h2 style="color:#ff6666;">🔒 Acceso denegado</h2>
                <p>Debes iniciar sesión para ver tu perfil.</p>
                <a href="/login" style="color:#00ccff;">Iniciar sesión</a>
            </div>
        </body></html>
        `, { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    const user = auth.user;
    const { compras } = await getCompras(env, 100, 0, { email: user.email });
    const suscripcion = await getSuscripcionUsuario(env, user.email);
    const referidos = await getReferidosDe(env, user.email);
    const comisiones = await getComisionesDe(env, user.email);
    const loginHistory = await getLoginHistory(env, user.email, 20);

    let suscripcionHtml = '<p>No tienes una suscripción activa.</p>';
    let diasRestantes = 0;
    if (suscripcion && suscripcion.activa) {
        const fin = new Date(suscripcion.fecha_fin);
        const ahora = new Date();
        diasRestantes = Math.max(0, Math.ceil((fin.getTime() - ahora.getTime()) / 86400000));
        const planNombre = SUSCRIPCION_PLANES[suscripcion.plan]?.name || suscripcion.plan;
        suscripcionHtml = `
            <div style="background:rgba(0,200,255,0.1);border-radius:15px;padding:15px;margin:10px 0;">
                <p><strong>Plan:</strong> ${planNombre}</p>
                <p><strong>Días restantes:</strong> ${diasRestantes} días</p>
                <p><strong>Renovación automática:</strong> ${suscripcion.renovacion_automatica ? '✅ Activada' : '❌ Desactivada'}</p>
                ${suscripcion.renovacion_automatica ? `<button onclick="cancelarRenovacion()" style="background:#ff4444;border:none;color:white;padding:8px 16px;border-radius:20px;cursor:pointer;">Cancelar renovación</button>` : ''}
                <button onclick="renovarSuscripcion()" style="background:#00ccff;border:none;color:#0a1a2b;padding:8px 16px;border-radius:20px;cursor:pointer;margin-left:10px;">Renovar +30 días</button>
            </div>
        `;
    }

    let comprasHtml = '';
    if (compras.length === 0) {
        comprasHtml = '<p style="color:#88aacc;">No has comprado ningún DLC aún.</p>';
    } else {
        comprasHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Clave</th><th>Precio</th><th>Estado</th></tr></thead>
            <tbody>`;
        compras.forEach(c => {
            const estado = c.estado || 'Activa';
            const color = estado === 'Activa' ? '#00cc88' : (estado === 'Expirada' ? '#ff6666' : '#ffaa00');
            comprasHtml += `<tr><td>${escapeHTML(new Date(c.fecha).toLocaleString())}</td><td>${escapeHTML(c.producto)}</td><td><code>${escapeHTML(c.clave)}</code></td><td>$${Number(c.precio || 0).toFixed(2)}</td><td style="color:${color};">${escapeHTML(estado)}</td></tr>`;
        });
        comprasHtml += `</tbody></table>`;
    }

    let referidosHtml = '<p>No has referido a nadie aún.</p>';
    if (referidos.length > 0) {
        referidosHtml = `<ul style="list-style:none;padding:0;">`;
        referidos.forEach(r => {
            referidosHtml += `<li style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHTML(r.referido_id)} (Comisión: $${Number(r.comision_ganada || 0).toFixed(2)})</li>`;
        });
        referidosHtml += `</ul><p><strong>Comisiones totales:</strong> $${Number(comisiones || 0).toFixed(2)}</p>`;
    }

    let loginHistoryHtml = '<p style="color:#88aacc;">No hay registros de sesión aún.</p>';
    if (loginHistory.length > 0) {
        loginHistoryHtml = `<div style="max-height:300px;overflow-y:auto;background:rgba(0,0,0,0.2);border-radius:12px;padding:10px;">`;
        loginHistory.forEach(h => {
            const accionLabel = {
                'login': '🔓 Inicio de sesión',
                'login_2fa': '🔐 Inicio de sesión (con 2FA)',
                'register': '✨ Registro de cuenta',
                'password_reset': '🔑 Cambio de contraseña'
            }[h.action] || h.action;
            const fecha = new Date(h.timestamp).toLocaleString();
            const ip = h.details?.ip || 'desconocida';
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

    const adminLink = user.role === 'admin' ? `<p><a href="/admin" style="color:#00ccff;">🔐 Ir al panel de administración</a></p>` : '';
    const darkMode = user.dark_mode ? 'dark' : 'light';
    const darkModeToggle = `<button type="button" id="darkModeBtn" style="background:none;border:1px solid #00ccff;color:#00ccff;padding:6px 12px;border-radius:20px;cursor:pointer;">${darkMode === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}</button>`;

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
        (function() {
            function postJSON(url, body) {
                return fetch(url, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: body ? JSON.stringify(body) : undefined
                }).then(async function(res) {
                    var data = {};
                    try { data = await res.json(); } catch (e) {}
                    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
                    return data;
                });
            }

            function toggleDarkMode() {
                document.body.classList.toggle('light-mode');
                var isLight = document.body.classList.contains('light-mode');
                var btn = document.getElementById('darkModeBtn');
                if (btn) btn.textContent = isLight ? '🌙 Modo oscuro' : '☀️ Modo claro';
                postJSON('/toggle-dark-mode', { dark: !isLight }).catch(function(err) {
                    alert('Error al guardar preferencia: ' + err.message);
                });
            }

            function copyReferral() {
                var el = document.getElementById('referralCode');
                var code = el ? (el.textContent || '').trim() : '';
                if (!code) { alert('No hay código'); return; }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(function() {
                        alert('✅ Código de referido copiado: ' + code);
                    }).catch(function() { prompt('Copia este código:', code); });
                } else {
                    prompt('Copia este código:', code);
                }
            }

            function cancelarRenovacion() {
                if (!confirm('¿Cancelar renovación automática de tu suscripción?')) return;
                postJSON('/cancelar-renovacion').then(function(data) {
                    alert(data.message || data.error || 'Listo');
                    location.reload();
                }).catch(function(err) { alert('Error: ' + err.message); });
            }

            function renovarSuscripcion() {
                if (!confirm('¿Continuar a PayPal para pagar la renovación de tu suscripción?')) return;
                postJSON('/renovar-suscripcion').then(function(data) {
                    var approval = Array.isArray(data.links) && data.links.find(function(link) {
                        return link && link.rel === 'approve' && /^https:\/\//i.test(link.href || '');
                    });
                    if (!approval) throw new Error('PayPal no devolvió el enlace de aprobación. Inténtalo más tarde.');
                    location.href = approval.href;
                }).catch(function(err) { alert('No se pudo iniciar el pago: ' + err.message); });
            }

            function activar2FA() {
                if (!confirm('¿Activar 2FA?\\nSe generará un secreto. Guárdalo o escanea el QR.')) return;
                postJSON('/activar-2fa').then(function(data) {
                    if (data.error) { alert('❌ ' + data.error); return; }
                    var modal = document.getElementById('twofaModal');
                    var img = document.getElementById('twofaQr');
                    var secretEl = document.getElementById('twofaSecret');
                    if (img && data.qrUrl) img.src = data.qrUrl;
                    if (secretEl) secretEl.textContent = data.secret || '';
                    if (modal) modal.style.display = 'flex';
                    else alert((data.message || '2FA activado') + '\\n\\nSecreto: ' + (data.secret || ''));
                }).catch(function(err) { alert('Error al activar 2FA: ' + err.message); });
            }

            function desactivar2FA() {
                if (!confirm('¿Desactivar 2FA? Tu cuenta quedará menos protegida.')) return;
                postJSON('/desactivar-2fa').then(function(data) {
                    alert(data.message || data.error || 'Listo');
                    location.reload();
                }).catch(function(err) { alert('Error: ' + err.message); });
            }

            function closeTwoFAModal() {
                var modal = document.getElementById('twofaModal');
                if (modal) modal.style.display = 'none';
                location.reload();
            }

            function copySecret() {
                var el = document.getElementById('twofaSecret');
                var s = el ? (el.textContent || '').trim() : '';
                if (!s) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(s).then(function() {
                        alert('✅ Secreto copiado');
                    }).catch(function() { prompt('Copia el secreto:', s); });
                } else {
                    prompt('Copia el secreto:', s);
                }
            }

            // Exponer por si quedan onclick residuales
            window.toggleDarkMode = toggleDarkMode;
            window.copyReferral = copyReferral;
            window.cancelarRenovacion = cancelarRenovacion;
            window.renovarSuscripcion = renovarSuscripcion;
            window.activar2FA = activar2FA;
            window.desactivar2FA = desactivar2FA;
            window.closeTwoFAModal = closeTwoFAModal;
            window.copySecret = copySecret;

            document.addEventListener('DOMContentLoaded', function() {
                var isDark = ${darkMode === 'dark'};
                if (!isDark) document.body.classList.add('light-mode');
                var btn = document.getElementById('darkModeBtn');
                if (btn) {
                    btn.textContent = isDark ? '☀️ Modo claro' : '🌙 Modo oscuro';
                    btn.addEventListener('click', toggleDarkMode);
                }
                var copyBtn = document.getElementById('copyReferralBtn');
                if (copyBtn) copyBtn.addEventListener('click', copyReferral);
                var actBtn = document.getElementById('activar2FABtn');
                if (actBtn) actBtn.addEventListener('click', activar2FA);
                var deactBtn = document.getElementById('desactivar2FABtn');
                if (deactBtn) deactBtn.addEventListener('click', desactivar2FA);
                var closeBtn = document.getElementById('closeTwoFABtn');
                if (closeBtn) closeBtn.addEventListener('click', closeTwoFAModal);
                var copySecBtn = document.getElementById('copySecretBtn');
                if (copySecBtn) copySecBtn.addEventListener('click', copySecret);
            });
        })();
    </script>
    </head>
    <body>
    <div class="container">
        <div class="card">
            <h1>🌊 Mi perfil <span class="points-badge">⭐ ${user.points || 0} puntos</span></h1>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                ${darkModeToggle}
            </div>
            <div class="info">
                <div class="info-item"><strong>Email:</strong> ${escapeHTML(user.email)}</div>
                <div class="info-item"><strong>Nombre:</strong> ${escapeHTML(user.name || 'No especificado')}</div>
                <div class="info-item"><strong>Rol:</strong> <span class="role-badge ${user.role === 'admin' ? 'admin' : ''}">${escapeHTML(user.role)}</span></div>
                <div class="info-item"><strong>Miembro desde:</strong> ${new Date(user.created_at).toLocaleDateString()}</div>
                <div class="info-item"><strong>2FA:</strong> ${user.otp_secret ? '✅ Activado' : '❌ Desactivado'} 
                    ${user.otp_secret ? `<button type="button" id="desactivar2FABtn" style="background:#ff4444;border:none;color:white;padding:4px 12px;border-radius:20px;cursor:pointer;">Desactivar</button>` : `<button type="button" id="activar2FABtn" style="background:#00ccff;border:none;color:#0a1a2b;padding:4px 12px;border-radius:20px;cursor:pointer;">Activar</button>`}
                </div>
            </div>
            <div>
                <p><strong>Código de referido:</strong> <span class="referral-code" id="referralCode">${escapeHTML(user.referral_code)}</span>
                <button type="button" id="copyReferralBtn" style="margin-left:8px;background:#00ccff;border:none;color:#0a1a2b;padding:4px 12px;border-radius:20px;cursor:pointer;">📋 Copiar</button></p>
                <p style="font-size:0.9rem; color:#88aacc;">Comparte este código para que otros te referencien y ganes comisiones.</p>
            </div>
            ${adminLink}

            <div class="section">
                <h2>📅 Suscripción</h2>
                ${suscripcionHtml}
            </div>

            <div class="section">
                <h2>🎮 Mis DLCs comprados</h2>
                ${comprasHtml}
            </div>

            <div class="section">
                <h2>🔗 Mis referidos</h2>
                ${referidosHtml}
            </div>

            <div class="section">
                <h2>🔐 Historial de inicios de sesión</h2>
                <p style="font-size:0.85rem;color:#88aacc;margin-bottom:10px;">Aquí puedes ver desde qué IP y cuándo se accedió a tu cuenta. Si ves algo sospechoso, cambia tu contraseña.</p>
                ${loginHistoryHtml}
            </div>

            <div style="margin-top:20px; display:flex; gap:15px; flex-wrap:wrap;">
                <a href="/dlc" class="btn">Ver todos los DLCs</a>
                <a href="/home" class="btn">Volver al inicio</a>
                <a href="/logout" class="btn btn-danger">Cerrar sesión</a>
            </div>
        </div>
    </div>
    <div id="twofaModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;justify-content:center;align-items:center;padding:20px;">
      <div style="background:#1b3a5c;border-radius:24px;padding:28px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(0,200,255,0.3);">
        <h2 style="color:#00ccff;margin-top:0;">📱 Configura tu 2FA</h2>
        <p style="color:#aaddff;font-size:0.95rem;">Escanea el QR con Google Authenticator, Authy o similar.</p>
        <img id="twofaQr" src="" alt="QR 2FA" style="width:260px;height:260px;border-radius:16px;background:#fff;padding:8px;margin:12px 0;">
        <p style="font-size:0.9rem;">O introduce el secreto manualmente:</p>
        <code id="twofaSecret" style="display:block;background:#112233;padding:10px;border-radius:10px;word-break:break-all;color:#00ddff;"></code>
        <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button type="button" id="copySecretBtn" style="background:#00ccff;border:none;color:#0a1a2b;padding:10px 18px;border-radius:30px;font-weight:bold;cursor:pointer;">📋 Copiar secreto</button>
          <button type="button" id="closeTwoFABtn" style="background:rgba(255,255,255,0.1);border:1px solid #88ddff;color:#e0f0ff;padding:10px 18px;border-radius:30px;cursor:pointer;">Listo</button>
        </div>
      </div>
    </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { 'Content-Type': 'text/html' } });
}

// ==================================================
// [ FUNCIONES DE PAYPAL ]
// ==================================================

async function getPayPalAccessToken(env) {
    const clientId = env.PAYPAL_CLIENT_ID;
    const secret = env.PAYPAL_SECRET;
    if (!clientId || !secret) throw new Error('Credenciales de PayPal no configuradas');
    const auth = btoa(`${clientId}:${secret}`);
    const response = await fetch(`${getPayPalApiUrl(env)}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

async function createPayPalOrder(env, priceId, metadata = {}, couponCode = null) {
    const product = PRODUCTS[priceId];
    if (!product) throw new Error('Producto no encontrado');

    let price = product.price;
    let desc = product.name;
    if (couponCode) {
        const coupon = await getCoupon(env, couponCode);
        if (coupon.discountPercent) {
            price = price * (1 - coupon.discountPercent / 100);
        } else if (coupon.fixedAmount) {
            price = Math.max(0, price - coupon.fixedAmount);
        }
        desc += ` (cupón ${couponCode})`;
    }

    const accessToken = await getPayPalAccessToken(env);
    const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: 'USD', value: price.toFixed(2) },
                description: desc,
                custom_id: JSON.stringify({
                    tipo: 'dlc', price_id: priceId,
                    key: metadata.key || '', user_id: metadata.user_id || '',
                    email: metadata.email || '', coupon: couponCode || null,
                }),
            }],
            application_context: {
                return_url: `${getBaseUrl(env)}/paypal/capture`,
                cancel_url: `${getBaseUrl(env)}/shop/cancel`,
            },
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
        console.error('PayPal order creation failed:', response.status, data?.name || data?.message || 'unknown error');
        throw new Error('No se pudo crear la orden de PayPal');
    }
    return data;
}

async function createPayPalOrderSuscripcion(env, plan, email, couponCode = null) {
    const planData = SUSCRIPCION_PLANES[plan];
    if (!planData) throw new Error('Plan no válido');
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
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: { currency_code: 'USD', value: price.toFixed(2) },
                description: `Suscripción ${planData.name}`,
                custom_id: JSON.stringify({
                    tipo: 'suscripcion', plan: plan, email: email, coupon: couponCode || null,
                }),
            }],
            application_context: {
                return_url: `${getBaseUrl(env)}/paypal/capture`,
                cancel_url: `${getBaseUrl(env)}/shop/cancel`,
            },
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) {
        console.error('PayPal order creation failed:', response.status, data?.name || data?.message || 'unknown error');
        throw new Error('No se pudo crear la orden de PayPal');
    }
    return data;
}

async function capturePayPalOrder(env, orderId) {
    const accessToken = await getPayPalAccessToken(env);
    const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(`PayPal capture failed with HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return data;
}

async function getPayPalOrderData(env, orderId) {
    const accessToken = await getPayPalAccessToken(env);
    const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`PayPal order lookup failed with HTTP ${response.status}`);
    return data;
}

// ==================================================
// [ RUTAS WEB: HOME, SHOP, PAY, SELL, DLC, KEY ]
// ==================================================

// ==================================================
// [ ✈️ AIR FLOW — SERVER SUITE V11 ]
// ==================================================

const AF_MAX_MESSAGE_CHARS = 6000;
const AF_MAX_HISTORY_MESSAGES = 16;
const AF_MAX_HISTORY_CHARS = 28000;
const AF_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const AF_RATE_WINDOW = 60;
const AF_RATE_MAX = 20;
const AF_GEMINI_MODEL_DEFAULT = 'gemini-2.5-flash';
const AF_OPENROUTER_MODEL_DEFAULT = 'openrouter/free';
const AF_LIVE_MODEL_DEFAULT = 'gemini-3.8-live';
const AF_IMAGE_MODEL_DEFAULT = 'gemini-nano-banana-2.1';
const AF_MEMORY_TTL = 60 * 60 * 24 * 365;
const AF_MAX_MEMORIES = 100;
const AF_MAX_CONVERSATIONS = 30;
const AF_MAX_METRIC_KEYS = 48;

const AF_PERSONALITY = `You are Air Flow, the AI assistant built into Ocean Hub.
PERSONALITY:
- Energetic, warm, natural, confident and direct.
- Be friendly and playful when it fits, never forced.
- Prefer concise answers; do not add filler or repeat the question.
- Match the user's language and tone.
- Never invent facts, sources, actions, tool results or access.
- State uncertainty clearly.
- Do not reveal API keys, secrets, PINs, sessions or private data.
- Never expose hidden reasoning or chain-of-thought.
QUALITY FILTER:
Before finalizing, check: direct answer, not too long, no repetition, natural tone, no invented claims.
OCEAN HUB CONTEXT:
Air Flow may use server-provided tools only when the request explicitly enables them.
When web research is enabled, cite sources and distinguish sourced facts from inference.
When a tool is unavailable, say so briefly and continue helpfully.`;

const AF_MODE_RULES = {
    QUICK: 'Be fast and concise.',
    THINK: 'Reason carefully internally and provide only the useful conclusion and key steps.',
    RESEARCH: 'Research current information, compare credible sources, identify uncertainty, and include concise source links.',
    CODE: 'Act as a practical coding assistant. Prefer complete working snippets and point out concrete errors.',
    STUDY: 'Teach clearly with simple explanations and examples. Avoid unnecessary complexity.',
    GAMING: 'Focus on practical game development, Roblox, Unity or Unreal help.',
    CREATE: 'Be creative and polished for visual, writing and product ideas.',
    TRAVEL: 'Use current web information when enabled. Do not claim live availability or bookings you did not verify.',
    PLANNER: 'Convert the request into a compact, actionable plan with clear steps.',
    AGENT: 'Plan tasks as explicit steps. Require confirmation before any sensitive action.',
    SHOPPING: 'Research current products and compare specifications and prices only when current data is available.',
    SECURITY: 'Prioritize privacy, abuse prevention, permissions and auditability.',
};

function afMode(mode) {
    const m = String(mode || 'QUICK').toUpperCase().slice(0, 20);
    return AF_MODE_RULES[m] ? m : 'QUICK';
}

function afNormalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    const out = [];
    let total = 0;
    for (const item of messages.slice(-AF_MAX_HISTORY_MESSAGES)) {
        if (!item || typeof item !== 'object') continue;
        const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
        if (!role) continue;
        const content = String(item.content || '').trim().slice(0, 5000);
        if (!content) continue;
        if (total + content.length > AF_MAX_HISTORY_CHARS) break;
        out.push({ role, content });
        total += content.length;
    }
    return out;
}

function afQualityFilter(text) {
    let out = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!out) return '';
    const paragraphs = out.split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
    const seen = new Set();
    const deduped = [];
    for (const p of paragraphs) {
        const key = p.toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
        if (!seen.has(key)) { seen.add(key); deduped.push(p); }
    }
    out = deduped.join('\n\n');
    if (out.length > 12000) out = out.slice(0, 11980).trimEnd() + '…';
    return out;
}

async function afRateLimit(env, request, email, bucket = 'chat') {
    const ip = getClientIP(request);
    const key = await hashKey(`${bucket}:${String(email || '').toLowerCase()}:${ip}`);
    return await withKVLock(env, `af_rl:${bucket}:${key}`, async () => {
        const kvKey = `af_rl_${bucket}_${key}`;
        const now = Math.floor(Date.now() / 1000);
        let record = await env.STATS.get(kvKey, 'json');
        if (!record || now - Number(record.start || 0) >= AF_RATE_WINDOW) {
            record = { count: 1, start: now };
        } else {
            if (Number(record.count || 0) >= AF_RATE_MAX) return false;
            record.count++;
        }
        await env.STATS.put(kvKey, JSON.stringify(record), { expirationTtl: AF_RATE_WINDOW + 5 });
        return true;
    });
}

function afExtractGeminiText(data) {
    const parts = [];
    for (const candidate of (data?.candidates || [])) {
        for (const part of (candidate?.content?.parts || [])) {
            if (typeof part?.text === 'string') parts.push(part.text);
        }
    }
    return parts.join('').trim();
}

function afExtractOpenRouterText(data) {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) return content.map(x => typeof x === 'string' ? x : String(x?.text || '')).join('').trim();
    return '';
}

function afExtractSourcesFromGemini(data) {
    const sources = [];
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
        const web = chunk?.web;
        if (web?.uri) sources.push({ title: String(web.title || web.uri), url: String(web.uri) });
    }
    return sources;
}

function afExtractUrls(text) {
    const out = [];
    const seen = new Set();
    const re = /https?:\/\/[^\s)\]}>]+/g;
    for (const raw of String(text || '').match(re) || []) {
        const url = raw.replace(/[),.;]+$/g, '');
        if (!seen.has(url)) { seen.add(url); out.push({ title: url, url }); }
        if (out.length >= 10) break;
    }
    return out;
}

async function afGetActivePersonality(env) {
    try {
        const value = await env.STATS.get('af_personality_active', 'json');
        if (value?.prompt) return String(value.prompt).slice(0, 8000);
    } catch (_) {}
    return AF_PERSONALITY;
}

function afBuildPrompt(mode, memories = [], personality = AF_PERSONALITY) {
    const m = afMode(mode);
    let prompt = `${personality}\n\nMODE: ${m}\nRULE: ${AF_MODE_RULES[m]}`;
    if (memories.length) {
        prompt += `\n\nUSER-CONTROLLED MEMORY (use only when relevant; never infer sensitive data):\n${memories.map(x => `- ${x.type}: ${x.value}`).join('\n')}`;
    }
    return prompt;
}

async function afGetMemory(env, email) {
    const safe = await hashKey(String(email || '').toLowerCase());
    return await env.STATS.get(`af_memory_${safe}`, 'json') || { preferences: [], projects: [], personality: [], conversation: [] };
}

async function afSaveMemory(env, email, memory) {
    const safe = await hashKey(String(email || '').toLowerCase());
    const normalized = {
        preferences: Array.isArray(memory.preferences) ? memory.preferences.slice(0, 30) : [],
        projects: Array.isArray(memory.projects) ? memory.projects.slice(0, 30) : [],
        personality: Array.isArray(memory.personality) ? memory.personality.slice(0, 10) : [],
        conversation: Array.isArray(memory.conversation) ? memory.conversation.slice(0, 20) : []
    };
    await env.STATS.put(`af_memory_${safe}`, JSON.stringify(normalized), { expirationTtl: AF_MEMORY_TTL });
    return normalized;
}

async function afRememberExplicit(env, email, message) {
    const text = String(message || '').trim();
    const match = text.match(/^(?:recuerda|remember)\s+(?:que|that)\s+(.+)/i);
    if (!match) return false;
    const value = match[1].trim().slice(0, 500);
    const memory = await afGetMemory(env, email);
    memory.preferences = Array.isArray(memory.preferences) ? memory.preferences : [];
    memory.preferences.unshift(value);
    memory.preferences = [...new Set(memory.preferences)].slice(0, 30);
    await afSaveMemory(env, email, memory);
    return true;
}

async function afSaveConversation(env, email, history, mode = 'QUICK', conversationId = null) {
    const safe = await hashKey(String(email || '').toLowerCase());
    const key = `af_conversations_${safe}`;
    const current = await env.STATS.get(key, 'json') || [];
    const normalized = afNormalizeMessages(history).slice(-AF_MAX_HISTORY_MESSAGES);
    if (!normalized.length) return null;
    const firstUser = normalized.find(x => x.role === 'user');
    const title = String(firstUser?.content || 'Nueva conversación').slice(0, 90);
    const modeN = afMode(mode);
    const now = new Date().toISOString();
    let item = null;
    let rest = current;
    // Reutilizar conversación por id explícito o por título+modo recientes
    if (conversationId) {
        const idx = current.findIndex(x => String(x?.id || '') === String(conversationId));
        if (idx >= 0) {
            item = { ...current[idx], title: current[idx].title || title, mode: modeN, updated_at: now, messages: normalized };
            rest = current.filter((_, i) => i !== idx);
        }
    }
    if (!item) {
        const idx = current.findIndex(x => x?.title === title && afMode(x?.mode) === modeN);
        if (idx >= 0) {
            item = { ...current[idx], mode: modeN, updated_at: now, messages: normalized };
            rest = current.filter((_, i) => i !== idx);
        }
    }
    if (!item) {
        item = { id: crypto.randomUUID(), title, mode: modeN, updated_at: now, messages: normalized };
        rest = current;
    }
    const merged = [item, ...rest].slice(0, AF_MAX_CONVERSATIONS);
    await env.STATS.put(key, JSON.stringify(merged), { expirationTtl: AF_MEMORY_TTL });
    return item;
}

async function afGetConversations(env, email, q = '') {
    const safe = await hashKey(String(email || '').toLowerCase());
    const items = await env.STATS.get(`af_conversations_${safe}`, 'json') || [];
    const term = String(q || '').trim().toLowerCase();
    return term ? items.filter(x => String(x?.title || '').toLowerCase().includes(term) || JSON.stringify(x?.messages || []).toLowerCase().includes(term)).slice(0, 20) : items.slice(0, 20);
}

async function afLogMetric(env, payload) {
    try {
        const now = new Date();
        const hour = now.toISOString().slice(0, 13);
        const key = `af_metric_${hour}`;
        const current = await env.STATS.get(key, 'json') || {
            requests: 0, errors: 0, searches: 0, vision: 0, files: 0, agent: 0, create: 0, feedback_up: 0, feedback_down: 0,
            tokens: 0, latency_ms_total: 0, by_model: {}, by_mode: {}
        };
        current.requests += payload.request ? 1 : 0;
        current.errors += payload.error ? 1 : 0;
        current.searches += payload.search ? 1 : 0;
        current.vision += payload.vision ? 1 : 0;
        current.files += payload.file ? 1 : 0;
        current.agent += payload.agent ? 1 : 0;
        current.create += payload.create ? 1 : 0;
        current.feedback_up += payload.feedback === 'up' ? 1 : 0;
        current.feedback_down += payload.feedback === 'down' ? 1 : 0;
        current.tokens += Math.max(0, Number(payload.tokens || 0));
        current.latency_ms_total += Math.max(0, Number(payload.latency || 0));
        if (payload.model) current.by_model[payload.model] = (current.by_model[payload.model] || 0) + 1;
        if (payload.mode) current.by_mode[payload.mode] = (current.by_mode[payload.mode] || 0) + 1;
        await env.STATS.put(key, JSON.stringify(current), { expirationTtl: AF_MAX_METRIC_KEYS * 3600 });
    } catch (e) {
        console.error('Air Flow metric error:', e?.message || e);
    }
}

function afShouldSearch(mode, message) {
    const m = afMode(mode);
    if (['RESEARCH', 'TRAVEL', 'SHOPPING'].includes(m)) return true;
    return /\b(investiga|busca|actual|últimas|ultimas|hoy|noticias|fuentes|verifica|fact.?check|compar(a|e)|precio|vuelos?|hoteles?|restaurantes?|qué pasó|que paso)\b/i.test(String(message || ''));
}

function afRouter(mode, message) {
    const m = afMode(mode);
    if (m === 'CREATE') return { primary: 'gemini', reason: 'creation' };
    if (m === 'RESEARCH' || m === 'TRAVEL' || m === 'SHOPPING') return { primary: 'gemini', reason: 'grounding' };
    if (m === 'CODE' || m === 'STUDY') return { primary: 'gemini', reason: 'quality' };
    if (/\b(código|code|javascript|python|roblox|lua|cloudflare|debug)\b/i.test(message || '')) return { primary: 'gemini', reason: 'coding' };
    return { primary: 'gemini', reason: 'default' };
}

async function afCallGemini(env, messages, mode, options = {}) {
    const apiKey = String(env.GEMINI_API_KEY || '').trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
    const model = String(options.model || env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT).trim();
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = {
        systemInstruction: { parts: [{ text: afBuildPrompt(mode, options.memories || [], options.personality || AF_PERSONALITY) }] },
        contents,
        generationConfig: (model === AF_GEMINI_MODEL_DEFAULT || model.startsWith('gemini-3.')) ? { maxOutputTokens: options.maxOutputTokens || 1400 } : { temperature: 0.7, maxOutputTokens: options.maxOutputTokens || 1400 }
    };
    if (options.web) body.tools = [{ google_search: {} }];
    body.generationConfig.maxOutputTokens = options.maxOutputTokens || 4096;
    const level = String(env.GEMINI_THINKING || (['THINK', 'CODE', 'RESEARCH'].includes(afMode(mode)) ? 'medium' : 'low')).toLowerCase();
    if (/^gemini-3/.test(model) && ['low', 'medium', 'high'].includes(level)) body.generationConfig.thinkingConfig = { thinkingLevel: level };
    const started = Date.now();
    let response, data;
    for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body)
        });
        data = await response.json().catch(() => ({}));
        if (response.ok || response.status !== 400 || !body.generationConfig.thinkingConfig) break;
        delete body.generationConfig.thinkingConfig;
    }
    const latency = Date.now() - started;
    if (!response.ok) {
        console.error('Air Flow Gemini error:', response.status, JSON.stringify(data).slice(0, 1200));
        const gst = String(data?.error?.status || '').toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 30);
        throw new Error(`GEMINI_HTTP_${response.status}${gst ? '_' + gst : ''}`);
    }
    const text = afQualityFilter(afExtractGeminiText(data));
    if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
    return {
        text,
        provider: 'Gemini',
        model,
        latency,
        tokens: Number(data?.usageMetadata?.totalTokenCount || 0),
        sources: afExtractSourcesFromGemini(data),
        searched: !!options.web
    };
}

async function afCallOpenRouter(env, messages, mode, options = {}) {
    const apiKey = String(env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY_NOT_CONFIGURED');
    const model = String(options.model || env.OPENROUTER_MODEL || AF_OPENROUTER_MODEL_DEFAULT).trim();
    const body = {
        model,
        messages: [{ role: 'system', content: afBuildPrompt(mode, options.memories || [], options.personality || AF_PERSONALITY) }, ...messages],
        max_tokens: options.maxOutputTokens || 1400,
        temperature: 0.7
    };
    if (options.web) body.plugins = [{ id: 'web', max_results: 5 }];
    const started = Date.now();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': (env.BASE_URL || 'https://oceanhud.yoelenmanuelzorrilla.workers.dev'), 'X-Title': 'Ocean Hub - Air Flow' },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    const latency = Date.now() - started;
    if (!response.ok) {
        console.error('Air Flow OpenRouter error:', response.status, JSON.stringify(data).slice(0, 1200));
        throw new Error(`OPENROUTER_HTTP_${response.status}`);
    }
    const text = afQualityFilter(afExtractOpenRouterText(data));
    if (!text) throw new Error('OPENROUTER_EMPTY_RESPONSE');
    return {
        text,
        provider: 'OpenRouter',
        model,
        latency,
        tokens: Number(data?.usage?.total_tokens || 0),
        sources: afExtractUrls(text),
        searched: !!options.web
    };
}

const AF_MODEL_CATALOG = [
    // Gemini
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', provider: 'gemini' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'gemini' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', provider: 'gemini' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', provider: 'gemini' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'gemini' },
    // OpenRouter — gratis / baratos
    { id: 'openrouter/free', label: 'OpenRouter · Free', provider: 'openrouter' },
    { id: 'google/gemini-2.0-flash-exp:free', label: 'OR · Gemini 2.0 Flash Exp Free', provider: 'openrouter' },
    { id: 'google/gemini-2.5-flash-preview:free', label: 'OR · Gemini 2.5 Flash Free', provider: 'openrouter' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'OR · Llama 3.3 70B Free', provider: 'openrouter' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'OR · Llama 3.2 3B Free', provider: 'openrouter' },
    { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'OR · Qwen 2.5 72B Free', provider: 'openrouter' },
    { id: 'qwen/qwen3-4b:free', label: 'OR · Qwen3 4B Free', provider: 'openrouter' },
    { id: 'deepseek/deepseek-r1:free', label: 'OR · DeepSeek R1 Free', provider: 'openrouter' },
    { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'OR · DeepSeek V3 Free', provider: 'openrouter' },
    { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'OR · Mistral Small Free', provider: 'openrouter' },
    { id: 'microsoft/phi-4-reasoning:free', label: 'OR · Phi-4 Reasoning Free', provider: 'openrouter' },
    { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free', label: 'OR · Nemotron Ultra Free', provider: 'openrouter' },
    // OpenRouter — premium (requiere créditos)
    { id: 'openai/gpt-4o-mini', label: 'OR · GPT-4o Mini', provider: 'openrouter' },
    { id: 'openai/gpt-4o', label: 'OR · GPT-4o', provider: 'openrouter' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'OR · Claude 3.5 Sonnet', provider: 'openrouter' },
    { id: 'anthropic/claude-sonnet-4', label: 'OR · Claude Sonnet 4', provider: 'openrouter' },
    { id: 'google/gemini-2.5-pro', label: 'OR · Gemini 2.5 Pro', provider: 'openrouter' },
    { id: 'x-ai/grok-3-mini', label: 'OR · Grok 3 Mini', provider: 'openrouter' },
    { id: 'x-ai/grok-3', label: 'OR · Grok 3', provider: 'openrouter' }
];

// Variables Cloudflare (vars / secrets):
//   AF_EXTRA_MODELS = [{"id":"modelo/id","label":"Nombre","provider":"gemini"|"openrouter"}]
//   GEMINI_MODEL / OPENROUTER_MODEL = modelo por defecto
//   AF_ALLOWED_MODELS = "id1,id2" (opcional: filtrar solo estos)
function afCatalog(env) {
    let extra = [];
    try { extra = JSON.parse(env.AF_EXTRA_MODELS || '[]'); } catch (_) {}
    if (!Array.isArray(extra)) extra = [];
    const more = extra.filter(m => m && m.id && ['gemini', 'openrouter'].includes(m.provider))
        .map(m => ({ id: String(m.id).slice(0, 120), label: String(m.label || m.id).slice(0, 80), provider: m.provider }));
    let list = [...AF_MODEL_CATALOG, ...more.filter(m => !AF_MODEL_CATALOG.some(c => c.id === m.id))];
    // Defaults desde env
    const gDef = String(env.GEMINI_MODEL || '').trim();
    const oDef = String(env.OPENROUTER_MODEL || '').trim();
    if (gDef && !list.some(m => m.id === gDef)) list.unshift({ id: gDef, label: gDef + ' (env)', provider: 'gemini' });
    if (oDef && !list.some(m => m.id === oDef)) list.unshift({ id: oDef, label: oDef + ' (env)', provider: 'openrouter' });
    // Filtro opcional
    const allowed = String(env.AF_ALLOWED_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.length) list = list.filter(m => allowed.includes(m.id));
    return list;
}

async function handleAirFlowModelsV13(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const models = afCatalog(env).filter(m => m.provider === 'gemini' ? !!env.GEMINI_API_KEY : !!env.OPENROUTER_API_KEY);
    const def = String(env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT);
    return jsonResponse({ models, default: models.some(m => m.id === def) ? def : (models[0] ? models[0].id : '') });
}

async function afGenerate(env, history, message, mode, options = {}) {
    const memories = options.memories || [];
    const messages = [...afNormalizeMessages(history), { role: 'user', content: message }];
    const search = options.web ?? afShouldSearch(mode, message);
    const personality = options.personality || await afGetActivePersonality(env);
    const route = afRouter(mode, message);
    const choice = options.modelId ? afCatalog(env).find(m => m.id === options.modelId) : null;
    const first = choice ? choice.provider : route.primary;
    const attempts = [];
    const geminiFallbacks = [
        choice && choice.provider === 'gemini' ? choice.id : null,
        env.GEMINI_MODEL || null,
        AF_GEMINI_MODEL_DEFAULT,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-3.1-flash-lite'
    ].filter(Boolean);
    const orFallbacks = [
        choice && choice.provider === 'openrouter' ? choice.id : null,
        env.OPENROUTER_MODEL || null,
        AF_OPENROUTER_MODEL_DEFAULT,
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemini-2.0-flash-exp:free'
    ].filter(Boolean);
    const order = first === 'openrouter' ? ['openrouter', 'gemini'] : ['gemini', 'openrouter'];
    const seen = new Set();
    for (const p of order) {
        const list = p === 'gemini' ? geminiFallbacks : orFallbacks;
        for (const m of list) {
            const key = p + ':' + m;
            if (seen.has(key)) continue;
            seen.add(key);
            attempts.push([p, m]);
        }
        // último intento sin modelo forzado (usa default interno)
        const keyEmpty = p + ':';
        if (!seen.has(keyEmpty)) { seen.add(keyEmpty); attempts.push([p, undefined]); }
    }
    const errors = [];
    for (const [provider, model] of attempts) {
        try {
            const opts = { ...options, web: search, memories, personality, model };
            const result = provider === 'gemini'
                ? await afCallGemini(env, messages, mode, opts)
                : await afCallOpenRouter(env, messages, mode, opts);
            if (search && !result.sources.length) result.sources = afExtractUrls(result.text);
            return result;
        } catch (e) {
            errors.push(String(e?.message || e));
        }
    }
    console.error('Air Flow provider router failed:', errors.join(' | '));
    throw new Error('AIR_FLOW_NO_PROVIDER ' + errors.join(' ').replace(/[^A-Za-z0-9_ -]/g, ''));
}

async function handleAirFlowChatV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'chat'))) return jsonResponse({ error: 'Demasiados mensajes. Espera un momento.' }, 429);
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const message = String(body?.message || '').trim();
    const mode = afMode(body?.mode);
    if (!message) return jsonResponse({ error: 'Escribe un mensaje.' }, 400);
    if (message.length > AF_MAX_MESSAGE_CHARS) return jsonResponse({ error: `El mensaje no puede superar ${AF_MAX_MESSAGE_CHARS} caracteres.` }, 413);
    if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) return jsonResponse({ error: 'Air Flow no tiene proveedores configurados.' }, 503);
    const started = Date.now();
    try {
        await afRememberExplicit(env, auth.user.email, message);
        const memory = await afGetMemory(env, auth.user.email);
        const memoryItems = [
            ...(memory.preferences || []).slice(0, 10).map(value => ({ type: 'preference', value })),
            ...(memory.projects || []).slice(0, 10).map(value => ({ type: 'project', value })),
            ...(memory.personality || []).slice(0, 5).map(value => ({ type: 'personality', value }))
        ];
        const result = await afGenerate(env, body?.history, message, mode, { memories: memoryItems, modelId: String(body?.model || '').slice(0, 80) });
        const history = afNormalizeMessages([...(body?.history || []), { role: 'user', content: message }, { role: 'assistant', content: result.text }]);
        const conversationId = String(body?.conversationId || body?.conversation_id || '').trim() || null;
        const saved = await afSaveConversation(env, auth.user.email, history, mode, conversationId);
        await afLogMetric(env, { request: true, search: result.searched, tokens: result.tokens, latency: Date.now() - started, model: result.model, mode });
        return jsonResponse({ reply: result.text, provider: result.provider, model: result.model, sources: result.sources || [], searched: !!result.searched, mode, conversationId: saved?.id || null });
    } catch (error) {
        await afLogMetric(env, { request: true, error: true, latency: Date.now() - started, mode });
        const raw = String(error?.message || error || 'AIR_FLOW_ERROR');
        const code = raw.replace(/[^A-Za-z0-9_ \-:\/.]/g, '').slice(0, 240) || 'AIR_FLOW_ERROR';
        console.error('Air Flow V11 chat failed:', raw);
        return jsonResponse({
            error: code.includes('API_KEY') || code.includes('NOT_CONFIGURED')
                ? 'Falta configurar GEMINI_API_KEY u OPENROUTER_API_KEY en Cloudflare.'
                : ('Air Flow no pudo responder: ' + code.slice(0, 120)),
            code
        }, 502);
    }
}


// --- Ruta por modo: /air-flow/mode/{MODE} y aliases /air-flow/{mode} ---
const AF_MODE_ROUTE_ALIASES = {
    quick: 'QUICK', think: 'THINK', research: 'RESEARCH', code: 'CODE',
    study: 'STUDY', gaming: 'GAMING', travel: 'TRAVEL', shopping: 'SHOPPING',
    planner: 'PLANNER', agent: 'AGENT', create: 'CREATE', security: 'SECURITY'
};

async function handleAirFlowModeRoute(env, request, forcedMode) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method === 'GET') {
        return jsonResponse({
            ok: true,
            mode: afMode(forcedMode),
            rule: AF_MODE_RULES[afMode(forcedMode)] || AF_MODE_RULES.QUICK,
            endpoint: 'POST with { message, history?, model? }'
        });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'chat'))) return jsonResponse({ error: 'Demasiados mensajes. Espera un momento.' }, 429);
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const message = String(body?.message || '').trim();
    const mode = afMode(forcedMode || body?.mode);
    if (!message) return jsonResponse({ error: 'Escribe un mensaje.' }, 400);
    if (message.length > AF_MAX_MESSAGE_CHARS) return jsonResponse({ error: `El mensaje no puede superar ${AF_MAX_MESSAGE_CHARS} caracteres.` }, 413);
    if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) return jsonResponse({ error: 'Air Flow no tiene proveedores configurados.' }, 503);
    const started = Date.now();
    try {
        await afRememberExplicit(env, auth.user.email, message);
        const memory = await afGetMemory(env, auth.user.email);
        const memoryItems = [
            ...(memory.preferences || []).slice(0, 10).map(value => ({ type: 'preference', value })),
            ...(memory.projects || []).slice(0, 10).map(value => ({ type: 'project', value })),
            ...(memory.personality || []).slice(0, 5).map(value => ({ type: 'personality', value }))
        ];
        const result = await afGenerate(env, body?.history, message, mode, { memories: memoryItems, modelId: String(body?.model || '').slice(0, 80) });
        const history = afNormalizeMessages([...(body?.history || []), { role: 'user', content: message }, { role: 'assistant', content: result.text }]);
        const conversationId = String(body?.conversationId || body?.conversation_id || '').trim() || null;
        const saved = await afSaveConversation(env, auth.user.email, history, mode, conversationId);
        await afLogMetric(env, { request: true, search: result.searched, tokens: result.tokens, latency: Date.now() - started, model: result.model, mode });
        return jsonResponse({ reply: result.text, provider: result.provider, model: result.model, sources: result.sources || [], searched: !!result.searched, mode, conversationId: saved?.id || null });
    } catch (error) {
        await afLogMetric(env, { request: true, error: true, latency: Date.now() - started, mode });
        const raw = String(error?.message || error || 'AIR_FLOW_ERROR');
        const code = raw.replace(/[^A-Za-z0-9_ \-:\/.]/g, '').slice(0, 240) || 'AIR_FLOW_ERROR';
        console.error('Air Flow chat error:', raw);
        return jsonResponse({
            error: code.includes('API_KEY') ? 'Falta configurar GEMINI_API_KEY u OPENROUTER_API_KEY en Cloudflare.'
                 : code.includes('NOT_CONFIGURED') ? 'Proveedor de IA no configurado. Revisa las variables del Worker.'
                 : ('Air Flow no pudo responder: ' + code.slice(0, 120)),
            code
        }, 502);
    }
}

async function handleAirFlowVisionV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'vision'))) return jsonResponse({ error: 'Límite de visión alcanzado. Espera un momento.' }, 429);
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const data = String(body?.image?.data || '');
    const mime = String(body?.image?.mimeType || 'image/png');
    const prompt = String(body?.prompt || 'Analiza esta imagen con detalle. Si contiene texto, transcríbelo y explica lo importante.').slice(0, 3000);
    if (!data) return jsonResponse({ error: 'Falta la imagen.' }, 400);
    let rawBytes = 0;
    try { rawBytes = Math.floor(data.replace(/^data:[^;]+;base64,/, '').length * 0.75); } catch { rawBytes = AF_MAX_UPLOAD_BYTES + 1; }
    if (rawBytes > AF_MAX_UPLOAD_BYTES) return jsonResponse({ error: 'La imagen es demasiado grande.' }, 413);
    try {
        const apiKey = String(env.GEMINI_API_KEY || '').trim();
        if (!apiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
        const model = String(env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT).trim();
        const started = Date.now();
        const cleanB64 = data.replace(/^data:[^;]+;base64,/, '');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: afBuildPrompt('VISION') }] },
                contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: cleanB64 } }] }],
                generationConfig: { maxOutputTokens: 1600 }
            })
        });
        const out = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
        const text = afQualityFilter(afExtractGeminiText(out));
        if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
        await afLogMetric(env, { vision: true, request: true, latency: Date.now() - started, tokens: Number(out?.usageMetadata?.totalTokenCount || 0), model, mode: 'VISION' });
        return jsonResponse({ reply: text, provider: 'Gemini', model, capabilities: ['vision', 'ocr', 'image_analysis'] });
    } catch (error) {
        console.error('Air Flow Vision failed:', error?.message || error);
        return jsonResponse({ error: 'No pude analizar la imagen ahora.' }, 502);
    }
}

async function handleAirFlowFileV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'file'))) return jsonResponse({ error: 'Límite de archivos alcanzado. Espera un momento.' }, 429);
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const file = body?.file || {};
    const data = String(file.data || '');
    const mime = String(file.mimeType || 'text/plain');
    const name = String(file.name || 'archivo').slice(0, 160);
    const prompt = String(body?.prompt || `Analiza el archivo ${name}. Resume su contenido, detecta puntos importantes y responde según lo solicitado.`).slice(0, 3000);
    if (!data) return jsonResponse({ error: 'Falta el archivo.' }, 400);
    const cleanB64 = data.replace(/^data:[^;]+;base64,/, '');
    const rawBytes = Math.floor(cleanB64.length * 0.75);
    if (rawBytes > AF_MAX_UPLOAD_BYTES) return jsonResponse({ error: 'El archivo supera el límite de 10 MB.' }, 413);
    if (/^(text\/|application\/(json|csv))/.test(mime)) {
        try {
            const text = await afReadFileAsText(data, mime);
            if (text) {
                const result = await afGenerate(env, [], `${prompt}\n\nCONTENIDO DEL ARCHIVO:\n${text}`, 'RESEARCH', { web: false });
                const owner = await hashKey(String(auth.user.email || '').toLowerCase());
                const fileId = crypto.randomUUID();
                const indexKey = `af_files_${owner}`;
                const index = await env.STATS.get(indexKey, 'json') || [];
                await env.STATS.put(`af_file_${owner}_${fileId}`, JSON.stringify({ id: fileId, name, mime, text, created_at: new Date().toISOString() }), { expirationTtl: AF_MEMORY_TTL });
                const nextIndex = [{ id: fileId, name, mime, created_at: new Date().toISOString() }, ...index].slice(0, 20);
                await env.STATS.put(indexKey, JSON.stringify(nextIndex), { expirationTtl: AF_MEMORY_TTL });
                await afLogMetric(env, { file: true, request: true, latency: result.latency, tokens: result.tokens, model: result.model, mode: 'FILES' });
                return jsonResponse({ reply: result.text, provider: result.provider, model: result.model, file: { id: fileId, name, mime, searchable_text: true } });
            }
        } catch (_) {}
    }
    try {
        const apiKey = String(env.GEMINI_API_KEY || '').trim();
        if (!apiKey) throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
        const model = String(env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT).trim();
        const started = Date.now();
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: afBuildPrompt('RESEARCH') }] },
                contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: cleanB64 } }] }],
                generationConfig: { maxOutputTokens: 1800 }
            })
        });
        const out = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
        const reply = afQualityFilter(afExtractGeminiText(out));
        if (!reply) throw new Error('GEMINI_EMPTY_RESPONSE');
        await afLogMetric(env, { file: true, request: true, latency: Date.now() - started, tokens: Number(out?.usageMetadata?.totalTokenCount || 0), model, mode: 'FILES' });
        return jsonResponse({ reply, provider: 'Gemini', model, file: { name, mime, searchable_text: false } });
    } catch (error) {
        console.error('Air Flow File failed:', error?.message || error);
        return jsonResponse({ error: 'No pude analizar este archivo. Prueba con PDF, imagen o texto compatible y menor de 10 MB.' }, 502);
    }
}

async function handleAirFlowMemoryV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const memory = await afGetMemory(env, auth.user.email);
    if (request.method === 'GET') return jsonResponse({ memory });
    if (request.method !== 'POST' && request.method !== 'DELETE') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body = {};
    try { body = request.method === 'DELETE' ? {} : await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    if (request.method === 'DELETE') {
        const kind = String(body?.type || '').trim();
        if (!kind) return jsonResponse({ error: 'Falta type.' }, 400);
        if (kind === 'all') {
            await afSaveMemory(env, auth.user.email, { preferences: [], projects: [], personality: [], conversation: [] });
            return jsonResponse({ ok: true, message: 'Memoria permanente eliminada.' });
        }
        const next = { ...memory, [kind]: [] };
        await afSaveMemory(env, auth.user.email, next);
        return jsonResponse({ ok: true, memory: next });
    }
    const type = String(body?.type || 'preferences');
    const value = String(body?.value || '').trim().slice(0, 500);
    if (!['preferences', 'projects', 'personality', 'conversation'].includes(type) || !value) return jsonResponse({ error: 'Tipo o valor inválido.' }, 400);
    memory[type] = Array.isArray(memory[type]) ? memory[type] : [];
    memory[type].unshift(value);
    memory[type] = [...new Set(memory[type])].slice(0, type === 'conversation' ? 20 : 30);
    const saved = await afSaveMemory(env, auth.user.email, memory);
    return jsonResponse({ ok: true, memory: saved });
}

async function handleAirFlowConversationsV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const url = new URL(request.url);
    if (request.method === 'GET') {
        return jsonResponse({ conversations: await afGetConversations(env, auth.user.email, url.searchParams.get('q') || '') });
    }
    if (request.method !== 'DELETE') return jsonResponse({ error: 'Método no permitido' }, 405);
    const id = String(url.searchParams.get('id') || '').trim();
    if (!id) return jsonResponse({ error: 'Falta id.' }, 400);
    const safe = await hashKey(String(auth.user.email || '').toLowerCase());
    const key = `af_conversations_${safe}`;
    const current = await env.STATS.get(key, 'json') || [];
    const next = current.filter(x => String(x?.id || '') !== id);
    await env.STATS.put(key, JSON.stringify(next.slice(0, AF_MAX_CONVERSATIONS)), { expirationTtl: AF_MEMORY_TTL });
    return jsonResponse({ ok: true, conversations: next.slice(0, 20) });
}

async function handleAirFlowFeedbackV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const feedback = body?.feedback === 'down' ? 'down' : 'up';
    await afLogMetric(env, { feedback, mode: afMode(body?.mode) });
    return jsonResponse({ ok: true });
}

async function handleAirFlowAgentV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'agent'))) return jsonResponse({ error: 'Límite del agente alcanzado.' }, 429);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const goal = String(body?.goal || '').trim().slice(0, 4000);
    const approve = body?.approve === true;
    if (!goal) return jsonResponse({ error: 'Falta el objetivo.' }, 400);

    const lower = goal.toLowerCase();
    const steps = [];
    if (/investig|fuentes|noticias|actual|web/.test(lower)) steps.push({ id: 'research', label: 'Investigar', tool: 'web_search', sensitive: false });
    steps.push({ id: 'analyze', label: 'Analizar y organizar', tool: 'model_analysis', sensitive: false });
    if (/presenta|documento|pdf|informe|archivo/.test(lower)) steps.push({ id: 'create', label: 'Crear documento', tool: 'create_text_document', sensitive: false });
    if (/enviar|comprar|borrar|eliminar|publicar|mensaje/.test(lower)) steps.push({ id: 'sensitive', label: 'Acción sensible', tool: 'external_action', sensitive: true, requires_confirmation: true });

    if (!approve) {
        await afLogMetric(env, { agent: true, request: true, mode: 'AGENT' });
        return jsonResponse({ status: 'requires_confirmation', plan: steps, goal });
    }

    const results = [];
    let context = '';
    for (const step of steps) {
        if (step.sensitive) {
            results.push({ id: step.id, status: 'blocked', message: 'Esta acción requiere una integración externa y confirmación específica.' });
            continue;
        }
        if (step.id === 'research') {
            try {
                const r = await afGenerate(env, [], goal, 'RESEARCH', { web: true, maxOutputTokens: 1800 });
                context += `\n\nRESEARCH:\n${r.text}`;
                results.push({ id: step.id, status: 'completed', output: r.text, sources: r.sources || [] });
            } catch (e) {
                results.push({ id: step.id, status: 'error', message: 'No se pudo completar la investigación.' });
            }
        } else if (step.id === 'analyze') {
            try {
                const r = await afGenerate(env, [], `Organiza y resume el objetivo del usuario.${context}\n\nOBJETIVO:\n${goal}`, 'THINK', { web: false, maxOutputTokens: 1600 });
                context += `\n\nANALYSIS:\n${r.text}`;
                results.push({ id: step.id, status: 'completed', output: r.text });
            } catch (e) {
                results.push({ id: step.id, status: 'error', message: 'No se pudo completar el análisis.' });
            }
        } else if (step.id === 'create') {
            const artifactId = crypto.randomUUID();
            const content = `# Air Flow — Resultado\n\n## Objetivo\n${goal}\n\n## Resultado\n${context.trim()}\n`;
            await env.STATS.put(`af_artifact_${artifactId}`, JSON.stringify({ id: artifactId, owner: auth.user.email, name: 'air-flow-result.md', mime: 'text/markdown', content, created_at: new Date().toISOString() }), { expirationTtl: 86400 * 7 });
            results.push({ id: step.id, status: 'completed', artifact: `/air-flow/artifact/${artifactId}` });
        }
    }
    await afLogMetric(env, { agent: true, request: true, mode: 'AGENT' });
    return jsonResponse({ status: 'completed', goal, plan: steps, results });
}

async function handleAirFlowArtifactV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return new Response('No autorizado', { status: 403 });
    const id = new URL(request.url).pathname.split('/').pop();
    const artifact = await env.STATS.get(`af_artifact_${id}`, 'json');
    if (!artifact || artifact.owner !== auth.user.email) return new Response('Archivo no encontrado', { status: 404 });
    return new Response(String(artifact.content || ''), { headers: { 'Content-Type': `${artifact.mime || 'text/plain'}; charset=utf-8`, 'Content-Disposition': `attachment; filename="${String(artifact.name || 'air-flow-result.md').replace(/"/g, '')}"` } });
}

async function handleAirFlowCreateImageV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'create'))) return jsonResponse({ error: 'Límite de creación alcanzado.' }, 429);
    const apiKey = String(env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return jsonResponse({ error: 'Falta GEMINI_API_KEY.' }, 503);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const prompt = String(body?.prompt || '').trim().slice(0, 3000);
    if (!prompt) return jsonResponse({ error: 'Falta el prompt.' }, 400);
    const model = String(env.GEMINI_IMAGE_MODEL || AF_IMAGE_MODEL_DEFAULT).trim();
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${AF_PERSONALITY}\nCreate an image from this request:\n${prompt}` }] }],
                generationConfig: { responseModalities: ['IMAGE'] }
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
        for (const candidate of data?.candidates || []) {
            for (const part of candidate?.content?.parts || []) {
                const blob = part?.inlineData || part?.inline_data;
                if (blob?.data) {
                    await afLogMetric(env, { create: true, request: true, model, mode: 'CREATE' });
                    return jsonResponse({ ok: true, model, mimeType: blob.mimeType || blob.mime_type || 'image/png', data: blob.data });
                }
            }
        }
        throw new Error('GEMINI_NO_IMAGE');
    } catch (e) {
        console.error('Air Flow image creation failed:', e?.message || e);
        return jsonResponse({ error: 'La generación de imágenes no está disponible en este momento.' }, 502);
    }
}

async function handleAirFlowLiveTokenV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'live'))) return jsonResponse({ error: 'Límite de sesiones Live alcanzado.' }, 429);
    const apiKey = String(env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return jsonResponse({ error: 'Falta GEMINI_API_KEY.' }, 503);
    const model = String(env.GEMINI_LIVE_MODEL || AF_LIVE_MODEL_DEFAULT).trim();
    const expire = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSession = new Date(Date.now() + 60 * 1000).toISOString();
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                uses: 1,
                expireTime: expire,
                newSessionExpireTime: newSession,
                liveConnectConstraints: {
                    model: `models/${model}`,
                    config: { responseModalities: ['AUDIO'], inputAudioTranscription: {}, outputAudioTranscription: {}, sessionResumption: {}, contextWindowCompression: { slidingWindow: {} } }
                }
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.name) throw new Error(`GEMINI_LIVE_TOKEN_HTTP_${response.status}`);
        return jsonResponse({ token: data.name, model, expires_at: expire, websocket: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained' });
    } catch (e) {
        console.error('Air Flow Live token failed:', e?.message || e);
        return jsonResponse({ error: 'Air Flow Live no está disponible ahora.' }, 502);
    }
}

async function handleAirFlowPermissionsV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const key = `af_permissions_${await hashKey(String(auth.user.email).toLowerCase())}`;
    const current = await env.STATS.get(key, 'json') || { tools: {} };
    if (request.method === 'GET') return jsonResponse({ permissions: current });
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const tool = String(body?.tool || '').slice(0, 60);
    if (!tool) return jsonResponse({ error: 'Falta tool.' }, 400);
    current.tools[tool] = body?.enabled === true;
    await env.STATS.put(key, JSON.stringify(current), { expirationTtl: AF_MEMORY_TTL });
    return jsonResponse({ permissions: current });
}

async function handleAirFlowAdminV11(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const url = new URL(request.url);
    const hours = Math.min(48, Math.max(1, Number(url.searchParams.get('hours') || 24)));
    const metrics = [];
    for (let i = 0; i < hours; i++) {
        const d = new Date(Date.now() - i * 3600000);
        const hour = d.toISOString().slice(0, 13);
        const value = await env.STATS.get(`af_metric_${hour}`, 'json');
        if (value) metrics.push({ hour, ...value });
    }
    const total = metrics.reduce((a, x) => ({
        requests: a.requests + (x.requests || 0), errors: a.errors + (x.errors || 0), searches: a.searches + (x.searches || 0),
        vision: a.vision + (x.vision || 0), files: a.files + (x.files || 0), agent: a.agent + (x.agent || 0), create: a.create + (x.create || 0),
        feedback_up: a.feedback_up + (x.feedback_up || 0), feedback_down: a.feedback_down + (x.feedback_down || 0), tokens: a.tokens + (x.tokens || 0),
        latency_ms_total: a.latency_ms_total + (x.latency_ms_total || 0)
    }), { requests:0, errors:0, searches:0, vision:0, files:0, agent:0, create:0, feedback_up:0, feedback_down:0, tokens:0, latency_ms_total:0 });
    const models = {};
    const modes = {};
    for (const item of metrics) {
        for (const [k, v] of Object.entries(item.by_model || {})) models[k] = (models[k] || 0) + v;
        for (const [k, v] of Object.entries(item.by_mode || {})) modes[k] = (modes[k] || 0) + v;
    }
    const avgLatency = total.requests ? Math.round(total.latency_ms_total / total.requests) : 0;
    return jsonResponse({ period_hours: hours, total, avg_latency_ms: avgLatency, by_model: models, by_mode: modes, note: 'Las métricas se agregan en KV y no incluyen el contenido de las conversaciones.' });
}

async function handleAirFlowPersonalityLabV11(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const key = 'af_personality_versions';
    const versions = await env.STATS.get(key, 'json') || [{ id: 'default', created_at: new Date().toISOString(), prompt: AF_PERSONALITY }];
    if (request.method === 'GET') return jsonResponse({ active: versions[0], versions: versions.slice(0, 20) });
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const action = String(body?.action || 'test');
    if (action === 'save') {
        const prompt = String(body?.prompt || '').trim().slice(0, 8000);
        if (!prompt) return jsonResponse({ error: 'Falta prompt.' }, 400);
        const next = [{ id: crypto.randomUUID(), created_at: new Date().toISOString(), prompt }, ...versions].slice(0, 20);
        await env.STATS.put(key, JSON.stringify(next), { expirationTtl: AF_MEMORY_TTL });
        return jsonResponse({ active: next[0], versions: next });
    }
    if (action === 'activate') {
        const id = String(body?.id || '');
        const selected = versions.find(x => x.id === id);
        if (!selected) return jsonResponse({ error: 'Versión no encontrada.' }, 404);
        await env.STATS.put('af_personality_active', JSON.stringify(selected), { expirationTtl: AF_MEMORY_TTL });
        const next = [selected, ...versions.filter(x => x.id !== id)].slice(0, 20);
        await env.STATS.put(key, JSON.stringify(next), { expirationTtl: AF_MEMORY_TTL });
        return jsonResponse({ active: selected, versions: next });
    }
    const prompt = String(body?.input || 'Dame una respuesta corta de ejemplo.').slice(0, 1500);
    const mode = afMode(body?.mode || 'QUICK');
    const results = [];
    if (env.GEMINI_API_KEY) {
        try { results.push({ provider: 'Gemini', text: (await afCallGemini(env, [{ role:'user', content:prompt }], mode, { memories: [] })).text }); } catch (_) {}
    }
    if (env.OPENROUTER_API_KEY) {
        try { results.push({ provider: 'OpenRouter', text: (await afCallOpenRouter(env, [{ role:'user', content:prompt }], mode, { memories: [] })).text }); } catch (_) {}
    }
    return jsonResponse({ active: versions[0], results });
}

async function handleAirFlowStatusV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    return jsonResponse({
        online: !!(env.GEMINI_API_KEY || env.OPENROUTER_API_KEY),
        providers: { gemini: !!env.GEMINI_API_KEY, openrouter: !!env.OPENROUTER_API_KEY },
        models: { gemini: env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT, openrouter: env.OPENROUTER_MODEL || AF_OPENROUTER_MODEL_DEFAULT, live: env.GEMINI_LIVE_MODEL || AF_LIVE_MODEL_DEFAULT, image: env.GEMINI_IMAGE_MODEL || AF_IMAGE_MODEL_DEFAULT },
        capabilities: ['chat','router','fallback','web_search','research','vision','ocr','files','memory','conversations','agent_planner','safe_artifacts','image_generation','live_tokens','permissions','admin_metrics','personality_lab']
    });
}


async function handleAirFlowResearchV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'research'))) return jsonResponse({ error: 'Límite de investigación alcanzado.' }, 429);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const query = String(body?.query || '').trim().slice(0, 4000);
    if (!query) return jsonResponse({ error: 'Falta la consulta.' }, 400);
    try {
        const result = await afGenerate(env, [], query, 'RESEARCH', { web: true, maxOutputTokens: 2200 });
        await afLogMetric(env, { request: true, search: true, latency: result.latency, tokens: result.tokens, model: result.model, mode: 'RESEARCH' });
        return jsonResponse({ ok: true, answer: result.text, sources: result.sources || [], provider: result.provider, model: result.model, searched: true });
    } catch (e) {
        await afLogMetric(env, { request: true, search: true, error: true, mode: 'RESEARCH' });
        return jsonResponse({ error: 'No pude completar la investigación ahora.' }, 502);
    }
}

async function afReadFileAsText(data, mime) {
    const clean = String(data || '').replace(/^data:[^;]+;base64,/, '');
    if (!clean || !/^((text\/)|(application\/(json|csv)))$/i.test(String(mime || ''))) return null;
    try {
        const binary = atob(clean);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
       const text = new TextDecoder('utf-8', {
    fatal: false,
    ignoreBOM: false
}).decode(bytes);
        return text.length <= 120000 ? text : text.slice(0, 120000);
    } catch { return null; }
}

async function handleAirFlowFileSearchV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'GET') return jsonResponse({ error: 'Método no permitido' }, 405);
    const safe = await hashKey(String(auth.user.email || '').toLowerCase());
    const index = await env.STATS.get(`af_files_${safe}`, 'json') || [];
    const q = String(new URL(request.url).searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return jsonResponse({ files: index.map(x => ({ id: x.id, name: x.name, mime: x.mime, created_at: x.created_at })) });
    const results = [];
    for (const item of index.slice(0, 20)) {
        const stored = await env.STATS.get(`af_file_${safe}_${item.id}`, 'json');
        const text = String(stored?.text || '').toLowerCase();
        if (text.includes(q)) {
            const pos = text.indexOf(q);
            const original = String(stored?.text || '');
            results.push({ id: item.id, name: item.name, excerpt: original.slice(Math.max(0, pos - 180), Math.min(original.length, pos + q.length + 240)) });
        }
        if (results.length >= 10) break;
    }
    return jsonResponse({ results });
}

async function handleAirFlowPlannerV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const safe = await hashKey(String(auth.user.email || '').toLowerCase());
    const key = `af_planner_${safe}`;
    const tasks = await env.STATS.get(key, 'json') || [];
    if (request.method === 'GET') return jsonResponse({ tasks: tasks.slice(0, 100) });
    if (request.method !== 'POST' && request.method !== 'DELETE') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body = {}; try { body = request.method === 'POST' ? await request.json() : {}; } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    if (request.method === 'DELETE') {
        const id = String(new URL(request.url).searchParams.get('id') || '').trim();
        if (!id) return jsonResponse({ error: 'Falta id.' }, 400);
        const next = tasks.filter(x => x.id !== id);
        await env.STATS.put(key, JSON.stringify(next), { expirationTtl: AF_MEMORY_TTL });
        return jsonResponse({ tasks: next });
    }
    const action = String(body?.action || 'add');
    if (action === 'complete') {
        const id = String(body?.id || '');
        const next = tasks.map(x => x.id === id ? { ...x, done: !x.done, updated_at: new Date().toISOString() } : x);
        await env.STATS.put(key, JSON.stringify(next), { expirationTtl: AF_MEMORY_TTL });
        return jsonResponse({ tasks: next });
    }
    const title = String(body?.title || '').trim().slice(0, 200);
    if (!title) return jsonResponse({ error: 'Falta title.' }, 400);
    const task = { id: crypto.randomUUID(), title, note: String(body?.note || '').slice(0, 1000), due: String(body?.due || '').slice(0, 80), done: false, created_at: new Date().toISOString() };
    const next = [task, ...tasks].slice(0, 100);
    await env.STATS.put(key, JSON.stringify(next), { expirationTtl: AF_MEMORY_TTL });
    return jsonResponse({ task, tasks: next });
}

async function handleAirFlowCodeReviewV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    if (!(await afRateLimit(env, request, auth.user.email, 'code'))) return jsonResponse({ error: 'Límite de código alcanzado.' }, 429);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const code = String(body?.code || '').slice(0, 50000);
    const language = String(body?.language || 'text').slice(0, 40);
    const question = String(body?.question || 'Revisa este código, detecta errores y propone mejoras seguras.').slice(0, 2500);
    if (!code) return jsonResponse({ error: 'Falta código.' }, 400);
    const localIssues = [];
    const pairs = [['(',')'], ['{','}'], ['[',']']];
    for (const [a,b] of pairs) {
        const ca = (code.match(new RegExp(`\\${a}`, 'g')) || []).length;
        const cb = (code.match(new RegExp(`\\${b}`, 'g')) || []).length;
        if (ca !== cb) localIssues.push(`Posible desbalance de ${a}${b}: ${ca} vs ${cb}`);
    }
    try {
        const prompt = `${question}\nLenguaje: ${language}\n\nCÓDIGO:\n${code}`;
        const result = await afGenerate(env, [], prompt, 'CODE', { web: false, maxOutputTokens: 2200 });
        return jsonResponse({ ok: true, review: result.text, local_issues: localIssues, provider: result.provider, model: result.model, execution: 'disabled_for_safety' });
    } catch (e) {
        return jsonResponse({ error: 'No pude revisar el código ahora.' }, 502);
    }
}

async function handleAirFlowSecurityV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'GET') return jsonResponse({ error: 'Método no permitido' }, 405);
    const perms = await env.STATS.get(`af_permissions_${await hashKey(String(auth.user.email || '').toLowerCase())}`, 'json') || { tools: {} };
    const conversations = await afGetConversations(env, auth.user.email, '');
    return jsonResponse({ permissions: perms, conversations_saved: conversations.length, sensitive_actions_require_confirmation: true, server_code_execution: false });
}


const AF_APP_JS = "(function(){\n'use strict';\nvar state={mode:'QUICK',history:[],busy:false,filePurpose:'files',liveSocket:null,audioContext:null,nextAudioTime:0,conversations:[],conversationId:null,model:'',micStream:null,micContext:null,micSource:null,micProcessor:null,micGain:null};\nvar $=function(id){return document.getElementById(id)};\nvar messages=$('messages'), input=$('input'), send=$('send'), file=$('file'), overlay=$('overlay'), drawer=$('drawer'), recents=$('recents'), sidebar=$('sidebar');\nfunction esc(s){var d=document.createElement('div');d.textContent=String(s==null?'':s);return d.innerHTML;}\nfunction safeUrl(url){try{var u=new URL(url,location.origin);return ['http:','https:'].indexOf(u.protocol)>=0?u.href:null;}catch(e){return null;}}\nfunction markdown(text){\n  var raw=String(text||'').replace(/\\\\r\\\\n/g,'\\\\n');\n  var stash=[];\n  raw=raw.replace(/\\`\\`\\`([\\\\w-]+)?\\\\n([\\\\s\\\\S]*?)\\`\\`\\`/g,function(_,lang,code){var i=stash.push('<pre><button class=\"code-copy\" data-code=\"'+esc(code).replace(/&quot;/g,'&amp;quot;')+'\">Copiar</button><code>'+esc(code)+'</code></pre>')-1;return '\\\\u0000CODE'+i+'\\\\u0000';});\n  raw=esc(raw);\n  raw=raw.replace(/\\\\[([^\\\\]]+)\\\\]\\\\((https?:\\\\/\\\\/[^)]+)\\\\)/g,function(_,label,url){var u=safeUrl(url);return u?'<a href=\"'+esc(u)+'\" target=\"_blank\" rel=\"noopener noreferrer\">'+label+'</a>':label;});\n  raw=raw.replace(/(https?:\\\\/\\\\/[^\\\\s<]+)/g,function(_,url){var u=safeUrl(url);return u?'<a href=\"'+esc(u)+'\" target=\"_blank\" rel=\"noopener noreferrer\">'+esc(url)+'</a>':esc(url);});\n  raw=raw.replace(/\\\\*\\\\*([^*]+)\\\\*\\\\*/g,'<strong>$1</strong>').replace(/\\`([^\\`]+)\\`/g,'<code class=\"inline-code\">$1</code>');\n  raw=raw.replace(/^###\\\\s+(.+)$/gm,'<h4>$1</h4>').replace(/^##\\\\s+(.+)$/gm,'<h3>$1</h3>').replace(/^#\\\\s+(.+)$/gm,'<h2>$1</h2>');\n  raw=raw.replace(/^\\\\s*[-*]\\\\s+(.+)$/gm,'<li>$1</li>').replace(/(?:<li>[^<]*<\\\\/li>\\\\n?)+/g,function(m){return '<ul>'+m+'</ul>';});\n  raw=raw.replace(/\\\\n\\\\n/g,'</p><p>').replace(/\\\\n/g,'<br>');\n  raw='<p>'+raw+'</p>';\n  raw=raw.replace(/<p>\\\\u0000CODE(\\\\d+)\\\\u0000<\\\\/p>/g,function(_,i){return stash[Number(i)];});\n  raw=raw.replace(/<p><\\\\/p>/g,'');\n  return raw;\n}\nfunction removeEmpty(){var e=$('emptyState');if(e)e.remove();}\nfunction scrollBottom(){messages.scrollTop=messages.scrollHeight;}\nfunction addMessage(role,text,sources,actions){\n  removeEmpty();\n  var wrap=document.createElement('div');wrap.className='message '+(role==='user'?'user':'ai');\n  var avatar=document.createElement('div');avatar.className='avatar2';avatar.textContent=role==='user'?'\ud83d\udc64':'\u2708';\n  var bw=document.createElement('div');bw.className='bubble-wrap';\n  var meta=document.createElement('div');meta.className='meta';meta.textContent=role==='user'?'T\u00da':'AIR FLOW';\n  var bubble=document.createElement('div');bubble.className='bubble';bubble.innerHTML=role==='user'?esc(text).replace(/\\\\n/g,'<br>'):markdown(text);\n  bw.appendChild(meta);bw.appendChild(bubble);\n  if(role==='assistant'){\n    if(Array.isArray(sources)&&sources.length){var src=document.createElement('div');src.className='sources';sources.slice(0,10).forEach(function(s){var u=safeUrl(s.url);if(!u)return;var a=document.createElement('a');a.className='source';a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.textContent='\u2197 '+(s.title||u);src.appendChild(a);});bw.appendChild(src);}\n    var act=document.createElement('div');act.className='message-actions';\n    [['copy','\u29c9'],['up','\ud83d\udc4d'],['down','\ud83d\udc4e'],['retry','\u21bb']].forEach(function(it){var b=document.createElement('button');b.className='action';b.dataset.action=it[0];b.textContent=it[1];b.type='button';act.appendChild(b);});\n    bw.appendChild(act);\n  }\n  wrap.appendChild(role==='user'?bw:avatar);wrap.appendChild(role==='user'?avatar:bw);\n  messages.appendChild(wrap);scrollBottom();return wrap;\n}\nfunction thinking(){removeEmpty();var d=document.createElement('div');d.className='message ai thinking';d.id='thinking';d.innerHTML='<div class=\"avatar2\">\u2708</div><div class=\"bubble-wrap\"><div class=\"meta\">AIR FLOW</div><div class=\"bubble\"><span>Air Flow est\u00e1 pensando</span><span class=\"dots\"><i></i><i></i><i></i></span></div></div>';messages.appendChild(d);scrollBottom();return d;}\nfunction setBusy(v){state.busy=v;send.disabled=v;input.disabled=v;document.querySelectorAll('.mode-select,.chip').forEach(function(b){b.disabled=v});if(!v)input.focus();}\nasync function api(url,options){var res=await fetch(url,Object.assign({credentials:'same-origin',cache:'no-store'},options||{}));var data=await res.json().catch(function(){return {};});if(!res.ok)throw new Error(data.error||('HTTP '+res.status));return data;}\nfunction selectMode(mode){state.mode=String(mode||'QUICK').toUpperCase();document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('active',b.dataset.mode===state.mode)});input.placeholder='Pregunta lo que quieras\u2026 \u00b7 '+state.mode;}\nfunction clearChat(){state.history=[];state.conversationId=null;messages.innerHTML='<div class=\"empty\" id=\"emptyState\"><div class=\"empty-card\"><div class=\"empty-orb\">\u2708</div><h2>\u00bfQu\u00e9 hacemos hoy?</h2><p>Puedo conversar, investigar con informaci\u00f3n actual, revisar c\u00f3digo, analizar im\u00e1genes y archivos, crear im\u00e1genes, organizar planes y ayudarte con tus proyectos.</p><div class=\"suggestions\"><button class=\"suggestion\" data-suggest=\"Investiga qu\u00e9 hay de nuevo hoy en tecnolog\u00eda.\">\ud83c\udf10 Investigar algo actual</button><button class=\"suggestion\" data-suggest=\"Ay\u00fadame a corregir este c\u00f3digo y dime qu\u00e9 est\u00e1 mal.\">\ud83d\udcbb Revisar c\u00f3digo</button><button class=\"suggestion\" data-suggest=\"Dame ideas de juegos y proyectos que pueda crear.\">\ud83c\udfae Ideas para un proyecto</button><button class=\"suggestion\" data-suggest=\"Organiza esta idea en un plan paso a paso.\">\ud83d\udcc5 Crear un plan</button></div></div></div>';bindSuggestions();}\nasync function sendMessage(forceText){\n  if(state.busy)return;\n  var text=String(forceText==null?input.value:'').trim();\n  if(!text)return;\n  if(state.mode==='AGENT'){return runAgent(text)}\n  if(text.length>6000){showToast('El mensaje es demasiado largo.');return;}\n  input.value='';resizeInput();\n  addMessage('user',text);state.history.push({role:'user',content:text});\n  var wait=thinking();setBusy(true);\n  try{\n    var modePath='/air-flow/mode/'+String(state.mode||'QUICK').toLowerCase();\n    var d=await api(modePath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:state.history.slice(0,-1),mode:state.mode,model:state.model||'',conversationId:state.conversationId||null})});\n    if(wait)wait.remove();\n    if(d.conversationId)state.conversationId=d.conversationId;\n    addMessage('assistant',d.reply||'No recib\u00ed una respuesta.',d.sources||[]);\n    state.history.push({role:'assistant',content:d.reply||''});\n    if(state.history.length>16)state.history=state.history.slice(-16);\n    $('providerLabel').textContent=(d.provider||'Air Flow')+(d.model?' \u00b7 '+d.model:'');\n    $('composerInfo').textContent=(d.provider||'Air Flow')+(d.searched?' \u00b7 b\u00fasqueda web':' \u00b7 sesi\u00f3n protegida');\n    await loadRecent();\n  }catch(e){if(wait)wait.remove();addMessage('assistant','\u26a0\ufe0f '+(e.message||'No se pudo conectar con Air Flow.'));}\n  finally{setBusy(false);}\n}\nfunction bindSuggestions(){document.querySelectorAll('[data-suggest]').forEach(function(b){b.onclick=function(){var t=b.dataset.suggest;selectMode(t.toLowerCase().indexOf('investiga')>=0?'RESEARCH':t.toLowerCase().indexOf('c\u00f3digo')>=0?'CODE':t.toLowerCase().indexOf('plan')>=0?'PLANNER':'QUICK');sendMessage(t)}})}\nfunction runQuick(text){selectMode(String(text).toLowerCase().indexOf('error')>=0?'CODE':'RESEARCH');sendMessage(text)}\nfunction showToast(text){var t=document.createElement('div');t.textContent=text;t.style.cssText='position:fixed;left:50%;bottom:95px;transform:translateX(-50%);z-index:300;background:#061b31;border:1px solid #198fda;color:#dff6ff;padding:10px 14px;border-radius:999px;font-size:10px;box-shadow:0 10px 35px rgba(0,0,0,.35)';document.body.appendChild(t);setTimeout(function(){t.remove()},2300)}\nfunction openDrawer(title,body){drawer.innerHTML='<div class=\"drawer-head\"><h3>'+esc(title)+'</h3><button class=\"close\" id=\"drawerClose\">\u00d7</button></div><div class=\"drawer-body\">'+body+'</div>';overlay.classList.add('show');$('drawerClose').onclick=closeDrawer;}\nfunction closeDrawer(){overlay.classList.remove('show');if(state.liveSocket){try{state.liveSocket.close()}catch(e){}state.liveSocket=null;}}\nasync function statusPanel(){try{var d=await api('/air-flow/status');openDrawer('\u25c9 Estado de Air Flow','<div class=\"result\">Proveedor Gemini: '+(d.providers?.gemini?'\u2705 configurado':'\u274c no configurado')+'\\\\nProveedor OpenRouter: '+(d.providers?.openrouter?'\u2705 configurado':'\u274c no configurado')+'\\\\n\\\\nModelo principal: '+esc(d.models?.gemini||'\u2014')+'\\\\nModelo Live: '+esc(d.models?.live||'\u2014')+'\\\\nModelo de im\u00e1genes: '+esc(d.models?.image||'\u2014')+'\\\\n\\\\nCapacidades: '+esc((d.capabilities||[]).join(', '))+'</div>')}catch(e){openDrawer('\u25c9 Estado de Air Flow','<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>')}}\nasync function loadRecent(){try{var d=await api('/air-flow/conversations');state.conversations=Array.isArray(d.conversations)?d.conversations:[];renderRecent()}catch(e){recents.innerHTML='<div style=\"padding:10px;color:#607a92;font-size:10px\">No se pudo cargar el historial: '+esc(e.message||'error')+'</div>'}}\nfunction renderRecent(){if(!state.conversations.length){recents.innerHTML='<div style=\"padding:10px;color:#607a92;font-size:10px\">Todav\u00eda no hay conversaciones.</div>';return}recents.innerHTML='';state.conversations.forEach(function(c){var b=document.createElement('div');b.className='recent';b.tabIndex=0;b.innerHTML='<span style=\"color:#4bbfff\">\u2022</span><span style=\"min-width:0;flex:1\"><span class=\"recent-title\">'+esc(c.title||'Nueva conversaci\u00f3n')+'</span><span class=\"recent-mode\">'+esc(c.mode||'QUICK')+'</span></span><button class=\"recent-delete\" title=\"Eliminar\" data-delete=\"'+esc(c.id||'')+'\">\u00d7</button>';b.addEventListener('click',function(e){if(e.target.dataset.delete)return;var msgs=Array.isArray(c.messages)?c.messages.slice(-16):[];state.history=msgs;state.conversationId=c.id||null;messages.innerHTML='';if(!msgs.length){clearChat();return}msgs.forEach(function(m){if(m.role==='user')addMessage('user',m.content);else addMessage('assistant',m.content)});selectMode(c.mode||'QUICK');sidebar.classList.remove('open');});b.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&!e.target.dataset.delete){e.preventDefault();b.click();}});var del=b.querySelector('[data-delete]');if(del)del.addEventListener('click',async function(e){e.stopPropagation();var id=del.dataset.delete;if(!id)return;try{await api('/air-flow/conversations?id='+encodeURIComponent(id),{method:'DELETE'});await loadRecent();}catch(err){showToast(err.message)}});recents.appendChild(b)});}\nfunction resizeInput(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px'}\nfunction chooseFile(kind){state.filePurpose=kind;file.value='';file.removeAttribute('capture');file.accept=kind==='vision'?'image/*':'image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.html,.css,.py,.lua,.xml,.yaml,.yml,.log';if(kind==='camera'){state.filePurpose='vision';file.accept='image/*';file.setAttribute('capture','environment')}file.click()}\nfunction readFile(f){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result)};r.onerror=function(){reject(new Error('No pude leer el archivo.'))};r.readAsDataURL(f)})}\nasync function vision(f){if(!f||!String(f.type||'').startsWith('image/')){showToast('Selecciona una imagen v\u00e1lida.');return}var b64=await readFile(f);openDrawer('\ud83d\udc41 Air Flow Vision','<div class=\"result\">'+esc(f.name||'Imagen')+'</div><textarea id=\"visionPrompt\" placeholder=\"\u00bfQu\u00e9 quieres saber de la imagen?\"></textarea><button class=\"btn primary\" id=\"visionRun\">Analizar imagen</button><div id=\"visionResult\"></div>');$('visionRun').onclick=async function(){var r=$('visionResult');r.innerHTML='<div class=\"result\">Analizando\u2026</div>';try{var d=await api('/air-flow/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:$('visionPrompt').value.trim()||'Analiza esta imagen y explica lo importante.',image:{data:b64,mimeType:f.type}})});r.innerHTML='<div class=\"result\">'+markdown(d.reply||'Sin resultado')+'</div>'}catch(e){r.innerHTML='<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>'}}}\nasync function files(f){var b64=await readFile(f);openDrawer('\ud83d\udcce Air Flow Files','<div class=\"result\">'+esc(f.name||'Archivo')+' \u00b7 '+esc(f.type||'application/octet-stream')+'</div><textarea id=\"filePrompt\" placeholder=\"\u00bfQu\u00e9 quieres que haga con el archivo?\"></textarea><button class=\"btn primary\" id=\"fileRun\">Analizar archivo</button><div id=\"fileResult\"></div>');$('fileRun').onclick=async function(){var r=$('fileResult');r.innerHTML='<div class=\"result\">Analizando\u2026</div>';try{var d=await api('/air-flow/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:$('filePrompt').value.trim()||'Resume y analiza este archivo.',file:{data:b64,mimeType:f.type||'application/octet-stream',name:f.name||'archivo'}})});r.innerHTML='<div class=\"result\">'+markdown(d.reply||'Sin resultado')+'</div>'}catch(e){r.innerHTML='<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>'}}}\nasync function memoryPanel(){try{var d=await api('/air-flow/memory');var m=d.memory||{};openDrawer('\ud83e\udde0 Memoria de Air Flow','<div class=\"result\">'+esc(JSON.stringify(m,null,2))+'</div><button class=\"btn\" id=\"clearMemory\">\ud83d\uddd1 Borrar memoria permanente</button>');$('clearMemory').onclick=async function(){try{await api('/air-flow/memory',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'all'})});showToast('Memoria eliminada.');closeDrawer()}catch(e){showToast(e.message)}}}catch(e){openDrawer('\ud83e\udde0 Memoria','<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>')}}\nasync function runAgent(goal){var wait=thinking();setBusy(true);try{var d=await api('/air-flow/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:goal})});if(wait)wait.remove();addMessage('assistant',(d.plan||[]).map(function(x,i){return (i+1)+'. '+x.label}).join('\\\\n')||'No se pudo crear un plan.');openDrawer('\ud83e\udd16 Air Flow Agent','<div class=\"result\">'+esc(JSON.stringify(d.plan||[],null,2))+'</div><button class=\"btn primary\" id=\"approveAgent\">\u2705 Ejecutar plan</button>');$('approveAgent').onclick=async function(){try{var r=await api('/air-flow/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:goal,approve:true})});openDrawer('\ud83e\udd16 Resultado del Agent','<div class=\"result\">'+esc(JSON.stringify(r.results||r,null,2))+'</div>')}catch(e){showToast(e.message)}}}catch(e){if(wait)wait.remove();addMessage('assistant','\u26a0\ufe0f '+e.message)}finally{setBusy(false)}}\nasync function createImagePanel(){openDrawer('\ud83c\udfa8 Crear imagen','<textarea id=\"createPrompt\" placeholder=\"Describe la imagen que quieres crear...\"></textarea><div class=\"grid2\"><button class=\"btn primary\" id=\"createRun\">Generar</button><button class=\"btn\" id=\"createClear\">Limpiar</button></div><div id=\"createResult\"></div>');$('createClear').onclick=function(){$('createPrompt').value=''};$('createRun').onclick=async function(){var p=$('createPrompt').value.trim();var r=$('createResult');if(!p){r.innerHTML='<div class=\"result\">Escribe una descripci\u00f3n primero.</div>';return}r.innerHTML='<div class=\"result\">Generando imagen\u2026</div>';try{var d=await api('/air-flow/create/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p})});if(!d.data)throw new Error('No se recibi\u00f3 la imagen.');r.innerHTML='';var img=document.createElement('img');img.className='artifact-img';img.alt='Imagen generada por Air Flow';img.src='data:'+(d.mimeType||'image/png')+';base64,'+d.data;r.appendChild(img)}catch(e){r.innerHTML='<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>'}}}\nasync function researchPanel(){var q=String(input.value||'').trim();if(q){selectMode('RESEARCH');return sendMessage(q)}openDrawer('\ud83c\udf10 Investigar','<textarea id=\"researchQ\" placeholder=\"\u00bfQu\u00e9 quieres investigar en la web?\"></textarea><button class=\"btn primary\" id=\"researchRun\">Investigar</button><div id=\"researchResult\"></div>');$('researchRun').onclick=async function(){var q=$('researchQ').value.trim();var r=$('researchResult');if(!q){r.innerHTML='<div class=\"result\">Escribe una consulta.</div>';return}r.innerHTML='<div class=\"result\">Investigando\u2026</div>';try{var d=await api('/air-flow/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});r.innerHTML='<div class=\"result\">'+markdown(d.answer||'Sin resultado')+'</div>';if(Array.isArray(d.sources)&&d.sources.length){var links=document.createElement('div');links.className='sources';d.sources.slice(0,10).forEach(function(s){var u=safeUrl(s.url);if(!u)return;var a=document.createElement('a');a.className='source';a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.textContent='\u2197 '+(s.title||u);links.appendChild(a)});r.appendChild(links)}}catch(e){r.innerHTML='<div class=\"result\">\u26a0\ufe0f '+esc(e.message)+'</div>'}}}\nfunction pcmPlay(base64){try{var raw=atob(base64),len=raw.length,bytes=new Uint8Array(len);for(var i=0;i<len;i++)bytes[i]=raw.charCodeAt(i);var samples=new Int16Array(bytes.buffer);var ctx=state.audioContext||(state.audioContext=new (window.AudioContext||window.webkitAudioContext)({sampleRate:24000}));if(ctx.state==='suspended')ctx.resume();var buffer=ctx.createBuffer(1,samples.length,24000),data=buffer.getChannelData(0);for(var j=0;j<samples.length;j++)data[j]=samples[j]/32768;var src=ctx.createBufferSource();src.buffer=buffer;src.connect(ctx.destination);var when=Math.max(ctx.currentTime,state.nextAudioTime||0);src.start(when);state.nextAudioTime=when+buffer.duration}catch(e){}}\nfunction stopMic(){if(state.micProcessor){try{state.micProcessor.disconnect()}catch(e){}}if(state.micSource){try{state.micSource.disconnect()}catch(e){}}if(state.micGain){try{state.micGain.disconnect()}catch(e){}}if(state.micStream){state.micStream.getTracks().forEach(function(t){t.stop()})}if(state.micContext){try{state.micContext.close()}catch(e){}}state.micStream=null;state.micContext=null;state.micSource=null;state.micProcessor=null;state.micGain=null;var b=document.getElementById('liveMic');if(b)b.textContent='\ud83c\udfa4 Activar micr\u00f3fono';}\nfunction floatTo16BitPCM(input){var out=new Int16Array(input.length);for(var i=0;i<input.length;i++){var s=Math.max(-1,Math.min(1,input[i]));out[i]=s<0?s*0x8000:s*0x7FFF;}return out;}\nfunction bytesToBase64(bytes){var chunk=0x8000,bin='';for(var i=0;i<bytes.length;i+=chunk){bin+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));}return btoa(bin);}\nasync function startMic(){if(!state.liveSocket||state.liveSocket.readyState!==WebSocket.OPEN){showToast('Primero conecta Air Flow Live.');return}if(state.micStream){stopMic();return}if(!navigator.mediaDevices?.getUserMedia){showToast('Tu navegador no permite usar el micr\u00f3fono.');return}try{state.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});state.micContext=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});await state.micContext.resume();state.micSource=state.micContext.createMediaStreamSource(state.micStream);state.micProcessor=state.micContext.createScriptProcessor(4096,1,1);state.micGain=state.micContext.createGain();state.micGain.gain.value=0;state.micProcessor.onaudioprocess=function(ev){if(!state.liveSocket||state.liveSocket.readyState!==WebSocket.OPEN)return;var pcm=floatTo16BitPCM(ev.inputBuffer.getChannelData(0));state.liveSocket.send(JSON.stringify({realtimeInput:{audio:{data:bytesToBase64(new Uint8Array(pcm.buffer)),mimeType:'audio/pcm;rate=16000'}}}));};state.micSource.connect(state.micProcessor);state.micProcessor.connect(state.micGain);state.micGain.connect(state.micContext.destination);var b=document.getElementById('liveMic');if(b)b.textContent='\u23f9 Detener micr\u00f3fono';var st=document.getElementById('liveStatus');if(st)st.textContent='\ud83d\udfe2 Micr\u00f3fono activo \u00b7 habla con Air Flow';}catch(e){stopMic();showToast('No pude acceder al micr\u00f3fono: '+(e.message||'permiso denegado'));}}\nfunction stopLive(){stopMic();if(state.liveSocket){try{state.liveSocket.close()}catch(e){}}state.liveSocket=null;state.nextAudioTime=0;}\nasync function livePanel(){try{var d=await api('/air-flow/live/token',{method:'POST'});if(!d.token)throw new Error('El servidor no devolvi\u00f3 un token Live.');openDrawer('\ud83c\udf99 Air Flow Live','<div id=\"liveStatus\" class=\"result\">Conectando\u2026</div><textarea id=\"liveInput\" placeholder=\"Escribe mientras la sesi\u00f3n Live est\u00e1 activa\u2026\"></textarea><div class=\"grid2\"><button class=\"btn primary\" id=\"liveSend\" disabled>Enviar</button><button class=\"btn\" id=\"liveMic\">\ud83c\udfa4 Activar micr\u00f3fono</button></div><button class=\"btn\" id=\"liveStop\">Cerrar sesi\u00f3n</button><div id=\"liveOutput\" class=\"result\">La respuesta de voz aparecer\u00e1 aqu\u00ed.</div>');$('liveStop').onclick=function(){stopLive();closeDrawer()};$('liveMic').onclick=startMic;var base=d.websocket||'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';var ws=base+(base.indexOf('?')>=0?'&':'?')+'access_token='+encodeURIComponent(d.token);state.liveSocket=new WebSocket(ws);state.liveSocket.onopen=function(){var st=$('liveStatus');if(st)st.textContent='\ud83d\udfe2 Live conectado';try{state.liveSocket.send(JSON.stringify({setup:{model:'models/'+(d.model||'gemini-3.8-live'),generationConfig:{responseModalities:['AUDIO'],outputAudioTranscription:{},sessionResumption:{}}}}))}catch(e){}};state.liveSocket.onmessage=function(ev){try{var x=JSON.parse(ev.data),c=x.serverContent||{};if(x.setupComplete){if($('liveStatus'))$('liveStatus').textContent='\ud83d\udfe2 Live listo';}if(c.inputTranscription?.text){$('liveOutput').textContent+='\\\\nT\u00da: '+c.inputTranscription.text}if(c.outputTranscription?.text){$('liveOutput').textContent+='\\\\nAIR FLOW: '+c.outputTranscription.text}for(var p of ((c.modelTurn&&c.modelTurn.parts)||[])){var b=p&&p.inlineData;if(b?.data)pcmPlay(b.data)}}catch(e){}};state.liveSocket.onerror=function(){if($('liveStatus'))$('liveStatus').textContent='\u26a0\ufe0f Error de conexi\u00f3n Live';};state.liveSocket.onclose=function(){if($('liveStatus'))$('liveStatus').textContent='\u26aa Live desconectado';};$('liveSend').disabled=false;$('liveSend').onclick=function(){var v=$('liveInput').value.trim();if(!v||!state.liveSocket||state.liveSocket.readyState!==WebSocket.OPEN)return;state.liveSocket.send(JSON.stringify({realtimeInput:{text:v}}));$('liveOutput').textContent+='\\\\nT\u00da: '+v;$('liveInput').value='';}}\ncatch(e){openDrawer('\ud83c\udf99 Air Flow Live','<div class=\"result\">\u26a0\ufe0f '+esc(e.message||'Live no est\u00e1 disponible.')+'</div>')}}\nfunction navAction(name){if(name==='chat'){closeDrawer();sidebar.classList.remove('open');return}if(name==='research')return researchPanel();if(name==='vision')return chooseFile('vision');if(name==='files')return chooseFile('files');if(name==='live')return livePanel();if(name==='create')return createImagePanel();if(name==='memory')return memoryPanel();if(name==='agent'){input.value='';selectMode('AGENT');input.focus();return}}\nfunction retryLast(){var last=null;for(var i=state.history.length-1;i>=0;i--){if(state.history[i].role==='user'){last=state.history[i].content;break}}if(!last){showToast('No hay un mensaje para repetir.');return}var idx=state.history.map(function(x){return x.content}).lastIndexOf(last);if(idx>=0)state.history=state.history.slice(0,idx);var msgs=Array.from(messages.querySelectorAll('.message'));var lastUser=-1;for(var k=msgs.length-1;k>=0;k--){if(msgs[k].classList.contains('user')){lastUser=k;break}}if(lastUser>=0)messages.querySelectorAll('.message').forEach(function(m,i){if(i>=lastUser)m.remove()});sendMessage(last)}\ndocument.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){selectMode(b.dataset.mode)})});\ndocument.querySelectorAll('[data-nav]').forEach(function(b){b.addEventListener('click',function(){navAction(b.dataset.nav)})});\ndocument.querySelectorAll('[data-suggest]').forEach(function(b){b.addEventListener('click',function(){var t=b.dataset.suggest;selectMode(t.toLowerCase().indexOf('investiga')>=0?'RESEARCH':t.toLowerCase().indexOf('c\u00f3digo')>=0?'CODE':t.toLowerCase().indexOf('plan')>=0?'PLANNER':'QUICK');sendMessage(t)})});\n$('newChat').onclick=clearChat;$('homeBtn').onclick=function(){location.href='/home'};$('profileBtn').onclick=function(){location.href='/profile'};$('statusBtn').onclick=statusPanel;$('voiceBtn').onclick=livePanel;$('attachBtn').onclick=function(){chooseFile('files')};$('menuBtn').onclick=function(){sidebar.classList.toggle('open')};$('themeBtn').onclick=function(){document.body.classList.toggle('light');document.body.style.background=document.body.classList.contains('light')?'#edf6fc':''};\ninput.addEventListener('input',resizeInput);input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});send.onclick=function(){sendMessage()};\n$('globalSearch').addEventListener('keydown',async function(e){if(e.key!=='Enter')return;e.preventDefault();var q=this.value.trim();if(!q)return;this.value='';selectMode('RESEARCH');sendMessage(q)});\nmessages.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('[data-action]');if(!btn)return;var action=btn.dataset.action;var bubble=btn.closest('.message')?.querySelector('.bubble');if(action==='copy'){navigator.clipboard?.writeText(bubble?.innerText||'').then(function(){showToast('Copiado al portapapeles.')})}else if(action==='up'||action==='down'){api('/air-flow/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback:action,mode:state.mode})}).catch(function(){});showToast(action==='up'?'Gracias por la valoraci\u00f3n \ud83d\udc4d':'Gracias por avisar \ud83d\udc4c')}else if(action==='retry'){retryLast()}});\nmessages.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('.code-copy');if(!c)return;var code=c.parentElement?.querySelector('code')?.innerText||'';navigator.clipboard?.writeText(code).then(function(){c.textContent='Copiado'})});\nfile.addEventListener('change',async function(){var f=file.files?.[0];file.value='';if(!f)return;try{if(state.filePurpose==='vision')await vision(f);else await files(f)}catch(e){showToast(e.message)}});\noverlay.addEventListener('click',function(e){if(e.target===overlay)closeDrawer()});\nasync function loadModels(){try{var d=await api('/air-flow/models');var sel=$('modelSel');if(!sel||!d.models||!d.models.length)return;var saved='';try{saved=localStorage.getItem('af-model')||''}catch(e){}sel.innerHTML='';d.models.forEach(function(m){var o=document.createElement('option');o.value=m.id;o.textContent=m.label;sel.appendChild(o)});state.model=d.models.some(function(m){return m.id===saved})?saved:(d.default||d.models[0].id);sel.value=state.model;sel.onchange=function(){state.model=sel.value;try{localStorage.setItem('af-model',sel.value)}catch(e){}showToast('Modelo: '+sel.options[sel.selectedIndex].text)}}catch(e){}}\nbindSuggestions();resizeInput();loadRecent();loadModels();\n})();";

async function handleAirFlowAppJs() {
    return new Response(AF_APP_JS, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}

async function handleAirFlowPageV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(`${new URL(request.url).origin}/welcome`, 302);
    const nonce = generateNonce();
    const safeName = escapeHTML(auth.user.name || auth.user.email?.split('@')[0] || 'amigo');
    const hasGemini = !!env.GEMINI_API_KEY;
    const hasOpenRouter = !!env.OPENROUTER_API_KEY;
    const providerLabel = hasGemini && hasOpenRouter ? 'Gemini + OpenRouter' : (hasGemini ? 'Gemini' : (hasOpenRouter ? 'OpenRouter' : 'Sin proveedor'));

    return new Response(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#061426">
<title>✈️ Air Flow — Ocean Hub</title>
<style>
:root{--bg:#06111f;--bg2:#081a2d;--panel:rgba(9,25,42,.86);--panel2:rgba(8,20,34,.96);--line:rgba(119,190,255,.15);--line2:rgba(61,176,255,.28);--text:#ecf6ff;--muted:#8ea9c2;--muted2:#67829c;--blue:#159eff;--blue2:#4cc8ff;--green:#27dda5;--danger:#ff667e;--shadow:0 22px 70px rgba(0,0,0,.38)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}body{overflow:hidden;background:radial-gradient(circle at 60% -10%,rgba(0,182,255,.15),transparent 32%),radial-gradient(circle at 20% 90%,rgba(0,105,255,.09),transparent 35%),#06111f}
.app{height:100%;display:grid;grid-template-columns:270px minmax(0,1fr);min-width:0}.sidebar{border-right:1px solid var(--line);background:linear-gradient(180deg,rgba(4,15,28,.98),rgba(4,12,23,.98));display:flex;flex-direction:column;min-width:0}.brand{display:flex;align-items:center;gap:12px;padding:18px 18px 14px}.brand-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#0bbaff,#0b61ff 60%,#0c2a69);display:grid;place-items:center;font-size:22px;box-shadow:0 0 28px rgba(15,154,255,.28)}.brand-title{font-weight:800;font-size:17px;letter-spacing:-.4px}.brand-sub{font-size:10px;color:var(--muted2);margin-top:2px}.new-btn{margin:8px 14px;border:1px solid var(--line2);background:linear-gradient(145deg,rgba(11,68,108,.7),rgba(8,31,53,.9));color:#dff5ff;border-radius:14px;padding:12px 13px;text-align:left;box-shadow:0 9px 28px rgba(0,124,255,.12);font-weight:700}.new-btn:hover{border-color:#35bbff;transform:translateY(-1px)}.nav{padding:2px 10px;display:grid;gap:4px}.nav button,.nav a{border:1px solid transparent;background:transparent;color:#abc1d5;text-decoration:none;border-radius:11px;padding:10px 12px;display:flex;align-items:center;gap:11px;text-align:left}.nav button:hover,.nav a:hover{background:rgba(23,157,255,.07);border-color:rgba(75,181,255,.11);color:#fff}.nav button.active{background:linear-gradient(100deg,rgba(21,140,255,.28),rgba(5,75,145,.26));border-color:rgba(50,183,255,.28);color:#fff}.nav-ico{width:18px;text-align:center}.section-label{padding:16px 16px 7px;color:#5f7891;font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.recents{padding:0 9px;overflow:auto;min-height:80px;flex:1}.recent{width:100%;display:flex;align-items:center;gap:7px;border:1px solid transparent;background:transparent;color:#9fb4c8;border-radius:10px;padding:9px 9px;text-align:left;position:relative}.recent:hover{background:rgba(33,160,255,.06);border-color:rgba(64,180,255,.12);color:#fff}.recent .recent-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}.recent .recent-mode{display:block;color:#5f7891;font-size:8px;margin-top:2px}.recent-delete{margin-left:auto;border:0;background:transparent;color:#5d7690;opacity:0;padding:2px 4px}.recent:hover .recent-delete{opacity:1}.sidebar-bottom{padding:10px 12px 13px;border-top:1px solid var(--line)}.mini-user{display:flex;align-items:center;gap:9px;padding:9px;border:1px solid rgba(96,177,232,.12);background:rgba(5,22,39,.55);border-radius:14px}.avatar{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#e5fbff,#5a79df 44%,#131c58 72%);display:grid;place-items:center;font-size:17px}.mini-user b{font-size:11px}.mini-user small{display:block;color:var(--green);font-size:9px;margin-top:2px}.mini-user button{margin-left:auto;width:27px;height:27px;border:1px solid var(--line);background:rgba(9,29,48,.8);border-radius:50%;color:#c8e6f7}
.main{min-width:0;display:flex;flex-direction:column;height:100%;position:relative}.topbar{height:70px;flex:none;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;padding:12px 20px;background:rgba(5,15,27,.72);backdrop-filter:blur(16px)}.mobile-menu{display:none}.model-picker{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(8,24,40,.76);color:#d8efff;border-radius:12px;padding:9px 11px;font-size:11px}.model-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px rgba(39,221,165,.55)}.top-search{flex:1;max-width:640px;position:relative;margin:auto}.top-search input{width:100%;height:40px;padding:0 15px 0 39px;border-radius:999px;border:1px solid rgba(68,167,228,.23);background:rgba(6,24,42,.82);color:#edf8ff;outline:none}.top-search input:focus{border-color:#28b4ff;box-shadow:0 0 0 3px rgba(0,166,255,.08)}.top-search span{position:absolute;left:14px;top:8px;color:#7fa4c1;font-size:17px}.top-actions{display:flex;align-items:center;gap:8px}.top-icon{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:rgba(8,25,42,.72);color:#b8d6ea}.top-icon:hover{border-color:var(--line2);color:#fff}.content{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}.welcome{padding:34px 28px 4px;max-width:880px;width:100%;margin:0 auto}.eyebrow{color:#6ed6ff;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.welcome h1{font-size:clamp(28px,4vw,45px);line-height:1.08;letter-spacing:-1.6px;margin:10px 0 6px}.welcome h1 span{background:linear-gradient(90deg,#fff,#8cdfff);-webkit-background-clip:text;background-clip:text;color:transparent}.welcome p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.chip{border:1px solid var(--line);background:rgba(9,28,46,.74);color:#b6cee0;border-radius:999px;padding:8px 11px;font-size:10px}.chip:hover,.chip.active{border-color:var(--line2);background:rgba(19,114,181,.13);color:#fff}.chat-wrap{flex:1;min-height:0;display:flex;flex-direction:column;max-width:980px;width:100%;margin:0 auto;padding:12px 20px 8px}.messages{flex:1;overflow:auto;padding:8px 7px 10px;scroll-behavior:smooth}.empty{min-height:100%;display:grid;place-items:center;padding:30px}.empty-card{max-width:610px;text-align:center;border:1px solid rgba(84,183,239,.12);background:rgba(8,28,46,.42);border-radius:24px;padding:30px 28px;box-shadow:inset 0 0 40px rgba(0,162,255,.03)}.empty-orb{width:64px;height:64px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;font-size:26px;background:radial-gradient(circle,#48dfff 0,#117df9 44%,#092d63 73%);box-shadow:0 0 35px rgba(0,183,255,.25)}.empty-card h2{margin:0;font-size:21px}.empty-card p{margin:9px 0 0;color:#7e9ab4;font-size:11px;line-height:1.6}.suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:17px;text-align:left}.suggestion{border:1px solid var(--line);background:rgba(7,26,43,.67);color:#c7dceb;border-radius:14px;padding:12px;font-size:10px}.suggestion:hover{border-color:var(--line2);background:rgba(10,79,126,.15)}.message{display:flex;gap:12px;margin:16px 0}.message.user{justify-content:flex-end}.message .avatar2{width:32px;height:32px;flex:none;border-radius:11px;background:linear-gradient(145deg,#0db9ff,#1a5be2);display:grid;place-items:center;font-size:15px}.message.user .avatar2{background:linear-gradient(145deg,#594ee5,#2740ac)}.bubble-wrap{max-width:min(82%,760px);min-width:0}.message.user .bubble-wrap{display:flex;flex-direction:column;align-items:flex-end}.meta{color:#648098;font-size:8px;letter-spacing:.08em;font-weight:800;text-transform:uppercase;margin:0 4px 5px}.bubble{border:1px solid var(--line);background:linear-gradient(145deg,rgba(12,30,48,.9),rgba(7,21,36,.95));border-radius:16px;padding:12px 14px;color:#e4f2fb;font-size:12px;line-height:1.7;word-wrap:break-word;overflow:hidden}.message.user .bubble{background:linear-gradient(145deg,#0a4f86,#08335e);border-color:rgba(75,190,255,.23)}.bubble p{margin:.2em 0 .7em}.bubble p:last-child{margin-bottom:.05em}.bubble ul,.bubble ol{padding-left:20px}.bubble pre{position:relative;margin:10px 0;padding:34px 10px 10px;border-radius:12px;background:#030a12;border:1px solid rgba(98,171,225,.18);overflow:auto}.bubble code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}.inline-code{background:rgba(73,157,210,.10);border:1px solid rgba(73,157,210,.15);padding:1px 4px;border-radius:5px}.code-copy{position:absolute;right:8px;top:7px;border:1px solid rgba(110,188,233,.15);background:#071a2d;color:#8db6d2;border-radius:7px;padding:4px 7px;font-size:8px}.bubble a{color:#62d3ff;text-decoration:none}.bubble a:hover{text-decoration:underline}.sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.source{border:1px solid rgba(74,183,244,.15);background:rgba(3,28,48,.8);color:#78d7ff;border-radius:999px;padding:5px 8px;font-size:8px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.message-actions{display:flex;gap:5px;margin-top:6px;padding-left:2px}.action{border:1px solid transparent;background:transparent;color:#59758e;border-radius:7px;font-size:13px;padding:3px 5px}.action:hover{background:rgba(71,157,220,.08);color:#b6d4e6}.thinking{opacity:.75}.thinking .bubble{display:flex;align-items:center;gap:7px}.dots{display:flex;gap:4px}.dots i{width:5px;height:5px;border-radius:50%;background:#6bd8ff;animation:pulse 1s infinite}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}@keyframes pulse{0%,80%,100%{opacity:.28;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
.composer-wrap{padding:5px 0 9px;max-width:980px;width:100%;margin:0 auto}.composer{border:1px solid rgba(82,177,238,.24);background:linear-gradient(145deg,rgba(9,29,48,.94),rgba(5,17,30,.97));border-radius:20px;box-shadow:var(--shadow);padding:10px}.composer-top{display:flex;align-items:center;gap:6px}.attach-btn{width:34px;height:34px;border-radius:10px;border:1px solid transparent;background:transparent;color:#9ab9cf}.attach-btn:hover{background:rgba(53,165,231,.08);border-color:var(--line)}.input{flex:1;border:0;outline:none;background:transparent;color:#edf7ff;resize:none;min-height:25px;max-height:150px;padding:7px;font-size:12px;line-height:1.5}.send-btn{width:39px;height:39px;border:0;border-radius:13px;background:linear-gradient(145deg,#0fb8ff,#0b74ec);color:white;box-shadow:0 8px 22px rgba(0,130,255,.25)}.send-btn:disabled{opacity:.45;cursor:not-allowed}.composer-bottom{display:flex;align-items:center;gap:6px;padding-top:6px;overflow:auto}.mode-select{border:1px solid transparent;background:transparent;color:#7695ad;border-radius:999px;padding:5px 8px;font-size:9px;white-space:nowrap}.mode-select:hover,.mode-select.active{border-color:rgba(62,174,242,.18);background:rgba(29,132,203,.09);color:#bfe7fa}.composer-info{margin-left:auto;color:#4f6c84;font-size:8px;white-space:nowrap}.disclaimer{max-width:980px;width:100%;margin:0 auto;padding:0 8px 8px;color:#456179;font-size:8px;text-align:center}.right-space{display:none}
.overlay{position:fixed;inset:0;background:rgba(0,6,13,.64);backdrop-filter:blur(8px);z-index:100;display:none}.overlay.show{display:block}.drawer{position:absolute;right:0;top:0;bottom:0;width:min(520px,96vw);background:linear-gradient(180deg,#071a2d,#04111f);border-left:1px solid var(--line2);padding:18px;overflow:auto;box-shadow:-25px 0 70px rgba(0,0,0,.4)}.drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.drawer-head h3{margin:0;font-size:16px}.close{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:rgba(8,28,46,.7);color:#a9c7da}.drawer-body{margin-top:16px}.drawer textarea,.drawer input{width:100%;border:1px solid var(--line);background:#051424;color:#eaf6ff;border-radius:12px;padding:10px;outline:none}.drawer textarea{min-height:110px;resize:vertical}.drawer .btn{margin-top:9px;border:1px solid var(--line2);background:rgba(17,113,178,.16);color:#dff5ff;border-radius:10px;padding:9px 11px}.drawer .btn.primary{background:linear-gradient(90deg,#0a93ee,#0b5fe5);border-color:transparent;color:#fff}.drawer .result{margin-top:10px;border:1px solid rgba(77,177,236,.15);background:rgba(255,255,255,.03);padding:11px;border-radius:11px;color:#c5d9e8;font-size:10px;line-height:1.6;white-space:pre-wrap;word-break:break-word}.drawer .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.drawer .list-item{padding:10px;border:1px solid rgba(77,177,236,.12);background:rgba(4,22,39,.62);border-radius:11px;margin-bottom:7px}.drawer .list-item b{display:block;font-size:10px}.drawer .list-item small{display:block;color:#6d8aa1;margin-top:3px}.artifact-img{display:block;width:100%;border-radius:13px;margin-top:10px;border:1px solid rgba(103,197,250,.17)}.mobile-only{display:none}
@media(max-width:1050px){.app{grid-template-columns:220px minmax(0,1fr)}.topbar{padding:12px 14px}.welcome{padding-left:20px;padding-right:20px}.chat-wrap,.composer-wrap,.disclaimer{max-width:100%}}
@media(max-width:780px){body{overflow:hidden}.app{display:block}.sidebar{position:fixed;left:0;top:0;bottom:0;width:275px;z-index:120;transform:translateX(-105%);transition:transform .2s ease;box-shadow:20px 0 80px rgba(0,0,0,.4)}.sidebar.open{transform:translateX(0)}.mobile-menu{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:rgba(8,25,42,.72);color:#b8d6ea}.model-picker{display:none}.top-search{max-width:none}.top-actions .top-icon.hide-mobile{display:none}.welcome{padding:25px 17px 4px}.welcome h1{font-size:30px}.chat-wrap{padding:7px 10px 3px}.messages{padding-left:2px;padding-right:2px}.bubble-wrap{max-width:88%}.suggestions{grid-template-columns:1fr}.composer-wrap{padding:3px 8px 7px}.composer{border-radius:17px}.composer-info{display:none}.chip{font-size:9px}.section-label{padding-left:15px}.disclaimer{padding:0 12px 6px}.mobile-only{display:block}}
@media(max-width:430px){.brand{padding-top:14px}.topbar{height:62px}.top-search input{height:37px;font-size:11px}.top-icon{width:35px;height:35px}.welcome p{font-size:12px}.message{gap:8px}.message .avatar2{width:28px;height:28px}.bubble{font-size:11px;padding:10px 11px}.composer-bottom{gap:3px}.mode-select{padding:4px 6px;font-size:8px}}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar" id="sidebar">
    <div class="brand"><div class="brand-mark">✈</div><div><div class="brand-title">Air Flow</div><div class="brand-sub">Ocean Hub AI</div></div></div>
    <button class="new-btn" id="newChat">＋&nbsp; Nueva conversación</button>
    <div class="nav">
      <button class="active" data-nav="chat"><span class="nav-ico">✦</span> Chat</button>
      <button data-nav="research"><span class="nav-ico">🌐</span> Investigar</button>
      <button data-nav="vision"><span class="nav-ico">👁</span> Visión</button>
      <button data-nav="files"><span class="nav-ico">📎</span> Archivos</button>
      <button data-nav="live"><span class="nav-ico">🎙</span> Live</button>
      <button data-nav="create"><span class="nav-ico">🎨</span> Crear imagen</button>
      <button data-nav="memory"><span class="nav-ico">🧠</span> Memoria</button>
      <button data-nav="agent"><span class="nav-ico">🤖</span> Agent</button>
    </div>
    <div class="section-label">Conversaciones recientes</div>
    <div class="recents" id="recents"><div style="padding:10px;color:#506b82;font-size:10px">Cargando…</div></div>
    <div class="sidebar-bottom">
      <div class="mini-user"><div class="avatar">👤</div><div style="min-width:0"><b>${safeName}</b><small>● En línea</small></div><button id="profileBtn" title="Perfil">⌄</button></div>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <button class="mobile-menu" id="menuBtn">☰</button>
      <div class="model-picker"><span class="model-dot"></span><span id="providerLabel">${escapeHTML(providerLabel)}</span><select id="modelSel" title="Modelo" style="background:#06111f;color:#d8efff;border:1px solid rgba(119,190,255,.3);border-radius:8px;margin-left:6px;font-size:11px;padding:3px;max-width:170px"></select></div>
      <div class="top-search"><span>⌕</span><input id="globalSearch" autocomplete="off" placeholder="Buscar en tus conversaciones o preguntar a Air Flow…"></div>
      <div class="top-actions"><button class="top-icon" id="statusBtn" title="Estado">◉</button><button class="top-icon" id="themeBtn" title="Tema">☼</button><button class="top-icon" id="homeBtn" title="Ocean Hub">⌂</button></div>
    </header>

    <section class="content">
      <div class="welcome">
        <div class="eyebrow">OCEAN HUB • AIR FLOW</div>
        <h1>Hola de nuevo, <span>${safeName} 👑</span></h1>
        <p>Conversación, investigación, código, archivos, visión, planificación y creación en un solo lugar.</p>
        <div class="chips" id="modeChips">
          <button class="chip active" data-mode="QUICK">⚡ Quick</button><button class="chip" data-mode="THINK">🧠 Think</button><button class="chip" data-mode="RESEARCH">🌐 Research</button><button class="chip" data-mode="CODE">💻 Code</button><button class="chip" data-mode="STUDY">📚 Study</button><button class="chip" data-mode="GAMING">🎮 Gaming</button><button class="chip" data-mode="TRAVEL">✈️ Travel</button><button class="chip" data-mode="SHOPPING">🛒 Shopping</button><button class="chip" data-mode="PLANNER">📅 Planner</button><button class="chip" data-mode="AGENT">🤖 Agent</button>
        </div>
      </div>

      <div class="chat-wrap">
        <div class="messages" id="messages">
          <div class="empty" id="emptyState"><div class="empty-card"><div class="empty-orb">✈</div><h2>¿Qué hacemos hoy?</h2><p>Puedo conversar, investigar con información actual, revisar código, analizar imágenes y archivos, crear imágenes, organizar planes y ayudarte con tus proyectos.</p><div class="suggestions"><button class="suggestion" data-suggest="Investiga qué hay de nuevo hoy en tecnología.">🌐 Investigar algo actual</button><button class="suggestion" data-suggest="Ayúdame a corregir este código y dime qué está mal.">💻 Revisar código</button><button class="suggestion" data-suggest="Dame ideas de juegos y proyectos que pueda crear.">🎮 Ideas para un proyecto</button><button class="suggestion" data-suggest="Organiza esta idea en un plan paso a paso.">📅 Crear un plan</button></div></div></div>
        </div>
        <div class="composer-wrap">
          <div class="composer">
            <div class="composer-top">
              <button class="attach-btn" id="attachBtn" title="Adjuntar archivo">＋</button>
              <textarea class="input" id="input" rows="1" maxlength="6000" placeholder="Pregunta lo que quieras…"></textarea>
              <button class="attach-btn" id="voiceBtn" title="Air Flow Live">🎙</button>
              <button class="send-btn" id="send" title="Enviar">➤</button>
            </div>
            <div class="composer-bottom">
              <button class="mode-select active" data-mode="QUICK">⚡ Quick</button><button class="mode-select" data-mode="THINK">🧠 Think</button><button class="mode-select" data-mode="RESEARCH">🌐 Research</button><button class="mode-select" data-mode="CODE">💻 Code</button><button class="mode-select" data-mode="STUDY">📚 Study</button><button class="mode-select" data-mode="GAMING">🎮 Gaming</button><button class="mode-select" data-mode="TRAVEL">✈️ Travel</button><button class="mode-select" data-mode="SHOPPING">🛒 Shopping</button><span class="composer-info" id="composerInfo">${escapeHTML(providerLabel)} · sesión protegida</span>
            </div>
          </div>
        </div>
        <div class="disclaimer">Air Flow puede equivocarse. Para información actual, activa Research o usa preguntas verificables. Nunca compartas claves, contraseñas o datos privados.</div>
      </div>
    </section>
  </main>
</div>

<input id="file" type="file" hidden>
<div class="overlay" id="overlay"><aside class="drawer" id="drawer"></aside></div>

<script src="/air-flow/app.js" defer></script>
</script>
</body></html>`, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

const HOME_TEMPLATE = "<!doctype html><html lang=\"es\" data-t=\"d\"><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#04101f\"><title>🌊 Ocean Hub — Inicio</title>\n<style>\n:root{--bg:#030d1c;--sb:#04132a;--cd:rgba(8,28,58,.74);--ln:rgba(90,170,255,.22);--tx:#eaf5ff;--mu:#8fb0cf;--b1:#1b8cff;--b2:#46d3ff;--gr:#2be3a2;--gd:#ffc94d}\n[data-t=l]{--bg:#e6f1fc;--sb:#f5faff;--cd:rgba(255,255,255,.88);--ln:rgba(20,90,170,.22);--tx:#0b2540;--mu:#4b6a88}\n*{box-sizing:border-box;margin:0}\nbody{background:radial-gradient(900px 500px at 70% -10%,rgba(20,140,255,.26),transparent),var(--bg);color:var(--tx);font:14px/1.4 Inter,system-ui,Segoe UI,sans-serif;min-height:100vh}\na{color:inherit;text-decoration:none}button,input{font:inherit;color:inherit}button{cursor:pointer;border:0;background:none}\n.app{display:grid;grid-template-columns:240px minmax(0,1fr) 290px;gap:18px;padding-right:18px}\n.sb{position:sticky;top:0;height:100vh;background:var(--sb);border-right:1px solid var(--ln);padding:18px 14px;display:flex;flex-direction:column;gap:8px}\n.logo{display:flex;gap:10px;align-items:center;padding:4px 6px 14px}.logo b{font-size:22px;display:block;line-height:1}.logo small{color:var(--mu);font-size:11px}\n.lg{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:linear-gradient(145deg,var(--b2),var(--b1));box-shadow:0 0 24px rgba(40,160,255,.5)}\n.nv{display:flex;gap:12px;align-items:center;padding:11px 14px;border-radius:14px;color:var(--mu);width:100%;text-align:left;border:1px solid transparent}\n.nv:hover{background:rgba(60,150,255,.1);color:var(--tx)}.nv.on{background:linear-gradient(90deg,rgba(27,140,255,.45),rgba(27,140,255,.12));border-color:var(--b1);color:#fff}\n.sp{flex:1}.cd{background:var(--cd);border:1px solid var(--ln);border-radius:18px;backdrop-filter:blur(10px)}\n.plus{padding:14px}.plus b{display:flex;gap:8px;align-items:center}.plus span{background:var(--b1);color:#fff;border-radius:8px;padding:1px 7px;font-size:11px}.plus p{color:var(--mu);font-size:12px;margin:6px 0 10px}\n.btn{display:inline-flex;gap:6px;align-items:center;justify-content:center;padding:9px 14px;border-radius:12px;border:1px solid var(--b1);background:rgba(27,140,255,.18);font-size:13px}.btn:hover{background:rgba(27,140,255,.4)}\n.onl{padding:12px 14px;display:flex;gap:10px;align-items:center;font-size:12px;color:var(--mu)}.dot{width:9px;height:9px;border-radius:50%;background:var(--gr);box-shadow:0 0 10px var(--gr);margin-left:auto}\n.me{display:flex;gap:10px;align-items:center;padding:10px 6px;border-top:1px solid var(--ln)}.av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:linear-gradient(145deg,#6a5cff,var(--b1));color:#fff;flex:none}\n.me small{color:var(--gr);font-size:11px;display:block}\nmain{min-width:0;padding:16px 0 20px;display:flex;flex-direction:column;gap:16px}\n.top{display:flex;gap:10px;align-items:center}.top input{flex:1;min-width:0;height:46px;border-radius:23px;border:1px solid var(--ln);background:var(--cd);padding:0 18px;outline:0}.top input:focus{border-color:var(--b2)}\n.ham{display:none;width:42px;height:42px;border-radius:12px;border:1px solid var(--ln);background:var(--cd)}\n.hero{position:relative;overflow:hidden;min-height:250px;padding:30px 32px;background:linear-gradient(180deg,#0a5fb0 0%,#07346b 38%,#031428 100%);color:#fff;isolation:isolate}\n.hero:before{content:\"\";position:absolute;inset:-20% 0 0;z-index:-1;background:repeating-linear-gradient(105deg,rgba(150,230,255,.16) 0 26px,transparent 26px 90px);mask:linear-gradient(180deg,#000,transparent 75%);animation:sway 9s ease-in-out infinite alternate}\n@keyframes sway{to{transform:translateX(40px) skewX(-6deg)}}\n.hero svg{position:absolute;right:2%;top:12%;width:46%;max-width:430px;z-index:-1;opacity:.9;animation:swim 12s ease-in-out infinite alternate}@keyframes swim{to{transform:translate(-30px,12px)}}\n.hero i{position:absolute;bottom:-20px;border-radius:50%;border:1px solid rgba(190,240,255,.6);animation:up 9s linear infinite;z-index:-1}@keyframes up{to{transform:translateY(-330px);opacity:0}}\n.hero small{letter-spacing:.35em;color:var(--b2);font-size:12px}.hero h1{font-size:clamp(34px,5vw,56px);line-height:1.05;margin:4px 0 10px;text-shadow:0 0 30px rgba(70,211,255,.6)}.hero p{max-width:440px;font-size:17px}\n.qa{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:20px}.qa button{display:flex;gap:9px;align-items:center;text-align:left;font-size:12px;color:#bcd9f2}.qa b{display:block;color:#fff;font-size:13px}.qa u{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(30,110,220,.5);border:1px solid var(--ln);text-decoration:none;font-size:17px}\n.wal{display:grid;grid-template-columns:200px 1fr;padding:18px 20px;gap:16px}.wal>div:first-child{border-right:1px solid var(--ln);padding-right:12px}\n.big{font-size:26px;font-weight:700}.mu{color:var(--mu);font-size:12px}.cur{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 10px}.cur div{display:flex;gap:10px;align-items:center}.cur u{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(27,140,255,.25);border:1px solid var(--ln);text-decoration:none;font-weight:700;flex:none}.cur b{font-size:17px;display:block}\n.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}\n.tile{position:relative;overflow:hidden;display:flex;gap:12px;align-items:center;padding:16px;min-height:92px;border-radius:18px;border:1px solid var(--ln);background:linear-gradient(135deg,rgba(20,110,230,.32),rgba(6,26,56,.7));transition:.2s}\n.tile:hover{transform:translateY(-3px);border-color:var(--b2);box-shadow:0 10px 30px rgba(30,140,255,.3)}.tile:nth-child(3n+2){background:linear-gradient(135deg,rgba(40,100,230,.32),rgba(6,26,56,.7))}.tile.gold{border-color:rgba(255,201,77,.5)}\n.tile u{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:22px;text-decoration:none;background:rgba(40,120,255,.45);flex:none}.tile b{display:block;font-size:16px}.tile span{font-size:11.5px;color:var(--mu);display:block;max-width:140px}.tile em{position:absolute;right:10px;bottom:-8px;font-size:52px;font-style:normal;opacity:.45}\nh2{font-size:16px;margin:4px 0 -4px;display:flex;justify-content:space-between;align-items:baseline}h2 a{font-size:12px;color:var(--b2);font-weight:400}\n.srvs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.srv{padding:14px;text-align:center}.srv i{font-size:30px;font-style:normal}.srv b{display:block;margin-top:4px}.srv small{color:var(--mu);display:block;margin:2px 0 8px}.srv .btn{padding:6px 14px;width:100%}.on2{color:var(--gr);font-size:11px}\n.tools{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.tools a{padding:14px;display:flex;gap:10px;align-items:center}.tools u{font-size:22px;text-decoration:none}.tools small{display:block;color:var(--mu)}\n.ban{padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:linear-gradient(90deg,#1a3a7a,#a8498c 70%,#e89a5c);border-radius:18px;color:#fff}.ban small{opacity:.85;display:block}\n.rt{padding-top:16px;display:flex;flex-direction:column;gap:14px;min-width:0}\n.ic{display:flex;gap:6px;justify-content:flex-end;position:relative}.ic button{width:46px;height:46px;border-radius:14px;border:1px solid var(--ln);background:var(--cd);font-size:18px;position:relative}.ic em{position:absolute;top:8px;right:9px;width:9px;height:9px;border-radius:50%;background:#ff5470;display:none}\n.nb{display:none;position:absolute;top:54px;right:0;width:280px;z-index:30;padding:12px;font-size:13px;box-shadow:0 20px 50px rgba(0,0,0,.5)}.nb.show{display:block}.nb div{padding:8px 4px;border-bottom:1px solid var(--ln)}.nb div:last-child{border:0}.nb small{color:var(--mu);display:block}\n.prof{padding:16px;text-align:center}.prof .av{width:64px;height:64px;font-size:26px;margin:0 auto 8px}.prof p{color:var(--mu);font-size:12px;margin:8px 0 12px}\n.act{padding:16px}.act div{display:flex;gap:10px;align-items:center;padding:7px 0;font-size:13px}.act small{display:block;color:var(--mu);font-size:11px}.act u{width:30px;height:30px;border-radius:9px;background:rgba(40,120,255,.35);display:grid;place-items:center;text-decoration:none;flex:none}\n.sea{padding:16px;min-height:130px;font-style:italic;color:var(--b2);background:linear-gradient(160deg,#0b4fa0,#031428)}\nfooter{padding:6px 0;color:var(--mu);font-size:12px;text-align:center}\n.fab{position:fixed;right:22px;bottom:22px;z-index:40;display:flex;gap:8px;align-items:center;padding:13px 18px;border-radius:30px;background:linear-gradient(135deg,var(--b2),var(--b1));color:#fff;font-weight:700;box-shadow:0 10px 30px rgba(20,140,255,.6)}\n.afp{position:fixed;right:22px;bottom:22px;z-index:50;width:min(390px,calc(100vw - 24px));height:min(600px,calc(100vh - 44px));display:none;flex-direction:column;overflow:hidden;background:#05152b;color:#eaf5ff;border:1px solid var(--b1);border-radius:22px;box-shadow:0 25px 70px rgba(0,0,0,.6)}.afp.show{display:flex}\n.afh{display:flex;gap:10px;align-items:center;padding:14px;background:linear-gradient(135deg,#0c4a9a,#06244a)}.afh small{display:block;opacity:.75;font-size:11px}.afh button{margin-left:auto;font-size:22px;padding:0 6px}.afh a{font-size:11px;color:var(--b2);margin-left:auto;padding:4px 8px;border:1px solid var(--ln);border-radius:10px}.afh a+button{margin-left:6px}\n.msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}.m{max-width:88%;padding:10px 13px;border-radius:16px;font-size:13.5px;word-wrap:break-word;overflow-wrap:anywhere}.m.a{background:#0b2a52;border:1px solid var(--ln);align-self:flex-start}.m.u{background:var(--b1);align-self:flex-end;color:#fff}.m.wait{opacity:.7}.m code{background:#031428;padding:1px 5px;border-radius:5px}.m a{color:var(--b2)}.m .src{display:block;font-size:11px;margin-top:6px}\n.chips{display:flex;flex-direction:column;gap:7px;padding:0 14px 8px}.chips button{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--ln);border-radius:12px;background:#0a2447;text-align:left}.chips button:hover{border-color:var(--b2)}.chips .r{display:flex;flex-wrap:wrap;gap:6px}.chips .r button{padding:6px 10px;font-size:12px;border-radius:20px}\n.inp{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--ln)}.inp input{flex:1;min-width:0;height:42px;border-radius:21px;border:1px solid var(--ln);background:#031428;padding:0 14px;outline:0}.inp button{width:42px;height:42px;border-radius:50%;background:var(--b1)}\n.ft{display:flex;justify-content:space-between;padding:0 14px 10px;font-size:11px;color:#8fb0cf}\n.hid{display:none!important}\n@media(max-width:1180px){.app{grid-template-columns:240px minmax(0,1fr)}.rt{display:none}.srvs,.tools{grid-template-columns:repeat(2,1fr)}}\n@media(max-width:820px){.app{display:block;padding:0 12px}.sb{position:fixed;z-index:60;left:0;width:260px;transform:translateX(-105%);transition:.2s}.sb.open{transform:none}.ham{display:block}.tiles{grid-template-columns:repeat(2,1fr)}.wal{grid-template-columns:1fr}.wal>div:first-child{border:0;padding:0}.cur{grid-template-columns:repeat(2,1fr)}.hero{padding:22px 18px}.hero svg{opacity:.35;width:80%}}\n@media(max-width:480px){.tiles,.srvs,.tools{grid-template-columns:1fr}.fab span{display:none}}\n</style></head><body>\n<div class=\"app\">\n<aside class=\"sb\" id=\"sb\">\n <div class=\"logo\"><div class=\"lg\">🌊</div><div><b>Ocean Hub</b><small>Tu mundo, en un solo lugar</small></div></div>\n <a class=\"nv on\" href=\"/home\">🏠 Inicio</a>\n <button class=\"nv\" data-af>💬 Chat con Air Flow</button>\n <a class=\"nv\" href=\"/dlc\">🧰 Herramientas</a>\n <a class=\"nv\" href=\"#servers\" id=\"goSrv\">🗄️ Servidores</a>\n <a class=\"nv\" href=\"/shop\">👑 Tienda</a>\n <a class=\"nv\" href=\"/profile\">⚙️ Ajustes</a>\n <div class=\"sp\"></div>\n <div class=\"cd plus\"><b>👑 Ocean Hub Plus <span>Pro</span></b><p>Más funciones, más poder.</p><a class=\"btn\" href=\"/suscribirse\">Ver beneficios →</a></div>\n <div class=\"cd onl\">🌊 <span>Conectados ahora<br><b id=\"onl\" style=\"color:var(--tx)\">—</b> usuarios online</span><i class=\"dot\"></i></div>\n <div class=\"me\"><div class=\"av\">{{INITIAL}}</div><div><b>{{NAME}} {{CROWN}}</b><small>● En línea</small></div></div>\n</aside>\n<main>\n <div class=\"top\"><button class=\"ham\" id=\"ham\">☰</button><input id=\"q\" placeholder=\"Buscar en Ocean Hub… (o pregúntale a Air Flow)\" autocomplete=\"off\"></div>\n <section class=\"cd hero\">\n  <svg viewBox=\"0 0 400 160\" fill=\"#2b8fe0\"><path d=\"M10 70C60 20 170 10 260 40c50 16 90 8 130-22-8 40-30 66-70 78-40 12-60 40-110 38-60-2-60-40-120-34-30 3-50-6-80-30z\" opacity=\".55\"/><path d=\"M130 100c30 20 60 36 90 26-30 8-60-6-90-26z\" opacity=\".8\"/></svg>\n  <i style=\"left:55%;width:14px;height:14px\"></i><i style=\"left:68%;width:9px;height:9px;animation-delay:3s\"></i><i style=\"left:80%;width:18px;height:18px;animation-delay:5s\"></i>\n  <small>BIENVENIDO A</small><h1>🌊 Ocean Hub</h1>\n  <p>Hola, <b>{{NAME}}</b>. Tu asistente de IA, tus herramientas y tu comunidad, todo en un solo lugar.</p>\n  <div class=\"qa\"><button data-af><u>💬</u><span><b>Chatea</b>con IA avanzada</span></button><a href=\"/dlc\" style=\"display:flex;gap:9px;align-items:center;font-size:12px;color:#bcd9f2\"><u class=\"qa-u\" style=\"width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(30,110,220,.5)\">🧭</u><span><b style=\"display:block;color:#fff;font-size:13px\">Explora</b>herramientas útiles</span></a><a href=\"/leaderboard\" style=\"display:flex;gap:9px;align-items:center;font-size:12px;color:#bcd9f2\"><u style=\"width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(30,110,220,.5);text-decoration:none\">👥</u><span><b style=\"display:block;color:#fff;font-size:13px\">Únete</b>a la comunidad</span></a><a href=\"/suscribirse\" style=\"display:flex;gap:9px;align-items:center;font-size:12px;color:#bcd9f2\"><u style=\"width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(30,110,220,.5);text-decoration:none\">👑</u><span><b style=\"display:block;color:#fff;font-size:13px\">Haz más</b>con Ocean Hub</span></a></div>\n </section>\n <section class=\"cd wal\"><div><div class=\"big\">{{KEYS}}</div><div class=\"mu\">Claves disponibles</div><a href=\"/key\" class=\"mu\" style=\"color:var(--b2)\">Ver detalles →</a></div>\n  <div><div style=\"display:flex;gap:16px;align-items:center;margin-bottom:12px\"><div><div class=\"big\">${{USD}}</div><div class=\"mu\">Valor total (USD)</div></div><a href=\"/pay\" class=\"btn\">Recargar →</a></div><div class=\"cur\">{{CUR}}</div></div></section>\n <section class=\"tiles\" id=\"tiles\">\n  <a class=\"tile\" href=\"/shop\"><u>🛒</u><div><b>Tienda</b><span>Compra DLCs exclusivos, claves y más.</span></div><em>🛍️</em></a>\n  <a class=\"tile\" href=\"/pay\"><u>💳</u><div><b>Pagar</b><span>Procesa tus pagos de forma segura y rápida.</span></div><em>💎</em></a>\n  <a class=\"tile\" href=\"/sell\"><u>👑</u><div><b>Vender</b><span>Gestiona tus claves y recibe tus pagos.</span></div><em>🪙</em></a>\n  <a class=\"tile\" href=\"/dlc\"><u>🎮</u><div><b>DLCs</b><span>Ver todos los DLCs disponibles.</span></div><em>🪸</em></a>\n  <a class=\"tile\" href=\"/key\"><u>🔑</u><div><b>Verificar</b><span>Valida tu clave en segundos.</span></div><em>🛡️</em></a>\n  <a class=\"tile\" href=\"/profile\"><u>👤</u><div><b>Perfil</b><span>Tu cuenta y configuración personal.</span></div><em>🫧</em></a>\n  <a class=\"tile\" href=\"/claim-key\"><u>🎟️</u><div><b>Canjear</b><span>Canjea tu código de producto.</span></div><em>🎁</em></a>\n  <a class=\"tile\" href=\"/suscribirse\"><u>📅</u><div><b>Suscripción</b><span>Planes mensuales y beneficios exclusivos.</span></div><em>👑</em></a>\n  <a class=\"tile gold\" href=\"/leaderboard\"><u>🏆</u><div><b>Ranking</b><span>Top usuarios del servidor.</span></div><em>🏆</em></a>\n </section>\n <h2 id=\"servers\">◈ Servidores destacados <a href=\"/air-flow\">Pregúntale a Air Flow →</a></h2>\n <section class=\"srvs\" id=\"srvs\"></section>\n <h2>♛ Herramientas Premium <a href=\"/shop\">Ver todas →</a></h2>\n <section class=\"tools\" id=\"tools\"><a class=\"cd\" href=\"/shop\"><u>🖱️</u><div>Auto Clicker<small>Herramienta</small></div></a><a class=\"cd\" href=\"/shop\"><u>⚡</u><div>FPS Boost<small>Rendimiento</small></div></a><a class=\"cd\" href=\"/shop\"><u>✨</u><div>Clean UI<small>Interfaz</small></div></a><a class=\"cd\" href=\"/dlc\"><u>🧩</u><div>More Tools<small>Más opciones</small></div></a></section>\n <section class=\"ban\"><div><b>¡Haz crecer tu experiencia!</b><small>Descubre todo lo que Ocean Hub tiene para ti.</small></div><a class=\"btn\" href=\"/shop\" style=\"color:#fff\">Explorar ahora →</a></section>\n <footer>Ocean Hub · © 2026 · Grandes cosas nacen en el mar.</footer>{{LEGAL}}\n</main>\n<aside class=\"rt\">\n <div class=\"ic\"><button id=\"bell\" title=\"Notificaciones\">🔔<em id=\"bdot\"></em></button><button id=\"theme\" title=\"Tema\">🌙</button><button data-af title=\"Air Flow\">✦</button><div class=\"cd nb\" id=\"nb\"></div></div>\n <div class=\"cd prof\"><div class=\"av\">{{INITIAL}}</div><b>{{NAME}} {{CROWN}}</b><p>Miembro de Ocean Hub<br><span id=\"rank\"></span></p><a class=\"btn\" href=\"/profile\" style=\"width:100%\">👤 Tu perfil →</a></div>\n <div class=\"cd act\"><b>● Estado del servidor</b> <span class=\"on2\">Online</span><div id=\"act\"><small>Cargando actividad…</small></div></div>\n <div class=\"cd sea\">La vida es mejor en Ocean Hub 🌊</div>\n</aside>\n</div>\n<button class=\"fab\" data-af>✈️ <span>Air Flow</span></button>\n<section class=\"afp\" id=\"afp\">\n <div class=\"afh\"><div class=\"lg\" style=\"width:36px;height:36px;font-size:18px\">✈️</div><div><b>Air Flow IA</b><small>Tu asistente de confianza</small></div><a href=\"/air-flow\">Abrir completo ↗</a><button id=\"afx\">×</button></div>\n <div class=\"msgs\" id=\"msgs\"><div class=\"m a\">¡Hola {{NAME}}! 👋<br>¿En qué puedo ayudarte hoy? Estoy aquí para mejorar tu experiencia en Ocean Hub. ¡Vamos!</div></div>\n <div class=\"chips\" id=\"chips\"><button data-q=\"srv\">🔍 Buscar un servidor</button><button data-q=\"err\">🛠️ Ayuda con un error</button><button data-q=\"rec\">✨ Recomendaciones</button><button data-q=\"more\">☰ Otras opciones</button><div class=\"r hid\" id=\"more\"><button data-m=\"THINK\">🧠 Think</button><button data-m=\"RESEARCH\">🌐 Research</button><button data-m=\"STUDY\">📚 Study</button><button data-m=\"CREATE\">🎨 Create</button><button data-m=\"PLANNER\">📅 Plan</button><button data-m=\"SECURITY\">🔒 Seguridad</button></div></div>\n <div class=\"inp\"><input id=\"afi\" maxlength=\"6000\" placeholder=\"Pregunta lo que quieras…\" autocomplete=\"off\"><button id=\"afs\">➤</button></div>\n <div class=\"ft\"><span id=\"afm\">● Online · modo QUICK</span><select id=\"afmod\" title=\"Modelo\" style=\"background:#031428;color:#8fb0cf;border:1px solid var(--ln);border-radius:8px;font-size:11px;max-width:150px\"></select><button id=\"afnew\" title=\"Nueva conversación\" style=\"font-size:16px;padding:0 6px\">＋</button></div>\n</section>\n<script>\n(function(){\nvar $=function(s){return document.querySelector(s)},$$=function(s){return [].slice.call(document.querySelectorAll(s))};\nfunction esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}\nfunction ago(f){var m=Math.max(0,Math.round((Date.now()-new Date(f))/60000));return m<1?'Ahora':m<60?'Hace '+m+' min':m<1440?'Hace '+Math.round(m/60)+' h':'Hace '+Math.round(m/1440)+' d'}\nvar SERVERS=[['🌊','Ocean Survival','Supervivencia','12.4K'],['🍇','Blox Fruits','Aventura','48.7K'],['💠','BedWars','Competitivo','32.1K'],['🔥','Strongest Battlegrounds','Acción','26.9K']];\n$('#srvs').innerHTML=SERVERS.map(function(s,i){return '<div class=\"cd srv\"><i>'+s[0]+'</i><b>'+esc(s[1])+'</b><small>'+esc(s[2])+' · '+esc(s[3])+'</small><div class=\"on2\">● En línea</div><button class=\"btn\" data-srv=\"'+i+'\">Unirse</button></div>'}).join('');\n/* ---- tema ---- */\nvar root=document.documentElement,th=$('#theme');\nfunction setT(t,save){root.dataset.t=t;th.textContent=t=='d'?'🌙':'☀️';try{localStorage.setItem('oh-t',t)}catch(e){}if(save)fetch('/toggle-dark-mode',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({dark:t=='d'})}).catch(function(){})}\ntry{setT(localStorage.getItem('oh-t')||'d')}catch(e){setT('d')}\nth.onclick=function(){setT(root.dataset.t=='d'?'l':'d',true)};\n$('#ham').onclick=function(){$('#sb').classList.toggle('open')};\n$('#goSrv').onclick=function(e){e.preventDefault();$('#sb').classList.remove('open');$('#servers').scrollIntoView({behavior:'smooth'})};\n/* ---- datos en vivo ---- */\nvar notes=[];\nfunction load(){fetch('/home-data',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json()}).then(function(d){\n if(d.error)return;$('#onl').textContent=d.online||1;\n var rows=[['⚡','Claves verificadas',d.verifications+' en total'],['📈','Uptime',d.uptime_days+' días activo']];\n (d.activity||[]).forEach(function(a){rows.push(['🛒',a.t,ago(a.f)])});\n $('#act').innerHTML=rows.map(function(r){return '<div><u>'+r[0]+'</u><span>'+esc(r[1])+'<small>'+esc(r[2])+'</small></span></div>'}).join('');\n $('#rank').textContent=d.rank?'🏆 Puesto #'+d.rank+' en el ranking':'';\n notes=(d.mine||[]).map(function(m){return [m.t,ago(m.f)]});\n if(d.sub)notes.unshift(['Suscripción '+d.sub.plan+' activa','Vence: '+new Date(d.sub.fin).toLocaleDateString()]);\n $('#bdot').style.display=notes.length?'block':'none'}).catch(function(){})}\nload();setInterval(function(){if(!document.hidden)load()},100000);\n$('#bell').onclick=function(){var n=$('#nb');n.innerHTML=notes.length?notes.map(function(x){return '<div>'+esc(x[0])+'<small>'+esc(x[1])+'</small></div>'}).join(''):'<div>Sin notificaciones nuevas 🌊</div>';n.classList.toggle('show')};\ndocument.addEventListener('click',function(e){if(!e.target.closest('.ic'))$('#nb').classList.remove('show')});\n/* ---- buscador ---- */\nvar q=$('#q');\nfunction filt(){var v=q.value.trim().toLowerCase(),n=0;$$('.tile,.srv,#tools a').forEach(function(el){var ok=!v||el.textContent.toLowerCase().indexOf(v)>=0;el.classList.toggle('hid',!ok);if(ok)n++});return n}\nq.addEventListener('input',filt);\nq.addEventListener('keydown',function(e){if(e.key=='Enter'&&q.value.trim()&&!filt()){var t=q.value;q.value='';filt();ask(t)}});\ndocument.addEventListener('keydown',function(e){if((e.key=='k'&&(e.ctrlKey||e.metaKey))||(e.key=='/'&&!/INPUT/.test(document.activeElement.tagName))){e.preventDefault();q.focus()}if(e.key=='Escape')close()});\n/* ---- Air Flow ---- */\nvar hist=[],mode='QUICK',busy=false,P=$('#afp'),M=$('#msgs'),I=$('#afi');\nfunction md(t){t=esc(t).replace(/[*][*]([^*]+)[*][*]/g,'<b>$1</b>').replace(/[`]([^`]+)[`]/g,'<code>$1</code>').replace(/(https?:[/][/][^ <\"']+)/g,'<a href=\"$1\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>');return t.replace(/\\n/g,'<br>')}\nfunction say(r,t){var d=document.createElement('div');d.className='m '+r;d.innerHTML=r=='u'?esc(t):md(t);M.appendChild(d);M.scrollTop=M.scrollHeight;return d}\nfunction open(){P.classList.add('show');$$('.fab').forEach(function(f){f.classList.add('hid')});setTimeout(function(){I.focus()},50)}\nfunction close(){P.classList.remove('show');$$('.fab').forEach(function(f){f.classList.remove('hid')})}\nfunction setM(m){mode=m;$('#afm').textContent='● Online · modo '+m}\nfunction ask(t,m){t=String(t||'').trim();if(busy||!t)return;open();if(m)setM(m);say('u',t);var w=say('a','Air Flow está pensando…');w.classList.add('wait');busy=true;\n fetch('/air-flow/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,history:hist.slice(-14),mode:mode,model:curModel})})\n .then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})}).then(function(x){w.classList.remove('wait');\n  if(!x.ok){w.innerHTML=md('⚠️ '+(x.d.error||'No pude responder ahora.')+(x.d.code?' ('+x.d.code+')':''));return}\n  hist.push({role:'user',content:t},{role:'assistant',content:x.d.reply});save();w.innerHTML=md(x.d.reply);\n  (x.d.sources||[]).slice(0,4).forEach(function(s){if(/^https?:/.test(s.url||'')){var a=document.createElement('a');a.className='src';a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='↗ '+(s.title||s.url);w.appendChild(a)}});M.scrollTop=M.scrollHeight})\n .catch(function(){w.classList.remove('wait');w.textContent='⚠️ No se pudo conectar con Air Flow.'}).then(function(){busy=false})}\nfunction sendInput(){var t=I.value;I.value='';ask(t)}\nvar curModel='';function save(){try{localStorage.setItem('af-hist',JSON.stringify(hist.slice(-16)))}catch(e){}}\ntry{hist=JSON.parse(localStorage.getItem('af-hist')||'[]')}catch(e){hist=[]}\nhist.forEach(function(m){say(m.role=='user'?'u':'a',m.content)});\n$('#afnew').onclick=function(){hist=[];save();M.innerHTML='';say('a','Nueva conversación ✈️ ¿En qué te ayudo?')};\nfetch('/air-flow/models',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){var s=$('#afmod');if(!s||!d.models||!d.models.length)return;var sv='';try{sv=localStorage.getItem('af-model')||''}catch(e){}d.models.forEach(function(m){var o=document.createElement('option');o.value=m.id;o.textContent=m.label;s.appendChild(o)});curModel=d.models.some(function(m){return m.id==sv})?sv:(d.default||d.models[0].id);s.value=curModel;s.onchange=function(){curModel=s.value;try{localStorage.setItem('af-model',curModel)}catch(e){}}}).catch(function(){});\n$('#afs').onclick=sendInput;I.addEventListener('keydown',function(e){if(e.key=='Enter'){e.preventDefault();sendInput()}});$('#afx').onclick=close;\n$$('[data-af]').forEach(function(b){b.addEventListener('click',open)});\n$$('[data-srv]').forEach(function(b){b.onclick=function(){var s=SERVERS[b.dataset.srv];ask('Cuéntame sobre el servidor \"'+s[1]+'\" ('+s[2]+') y cómo puedo unirme.','GAMING')}});\n$$('[data-q]').forEach(function(b){b.onclick=function(){var k=b.dataset.q;\n if(k=='srv'){setM('GAMING');I.value='Quiero encontrar un servidor de ';I.focus()}\n else if(k=='err'){setM('CODE');I.value='Tengo este error: ';I.focus()}\n else if(k=='rec')ask('Dame 3 recomendaciones útiles para aprovechar Ocean Hub hoy (tienda, DLCs, suscripción, ranking).','QUICK');\n else $('#more').classList.toggle('hid')}});\n$$('[data-m]').forEach(function(b){b.onclick=function(){setM(b.dataset.m);$('#more').classList.add('hid');I.focus()}});\n})();\n</script>\n{{COOKIE}}\n</body></html>\n";

// Datos en vivo del Home: presencia, actividad reciente, rango y suscripción.
async function handleHomeData(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const email = auth.user.email;
    let online = 0;
    try {
        await env.STATS.put('presence_' + (await hashKey(email)).slice(0, 24), '1', { expirationTtl: 120 });
        online = (await env.STATS.list({ prefix: 'presence_', limit: 1000 })).keys.length;
    } catch (_) {}
    let cache = await env.STATS.get('home_cache', 'json');
    if (!cache || Date.now() - Number(cache.t || 0) > 120000) {
        const { compras } = await getCompras(env, 50, 0, {});
        cache = { t: Date.now(), items: compras.map(c => ({ e: c.email, p: String(c.producto || 'Producto').slice(0, 60), f: c.fecha })) };
        try { await env.STATS.put('home_cache', JSON.stringify(cache), { expirationTtl: 600 }); } catch (_) {}
    }
    const stats = await getStats(env) || {};
    const sub = await getSuscripcionUsuario(env, email);
    const lb = await env.STATS.get('leaderboard', 'json') || [];
    const rank = lb.findIndex(u => u.email === email) + 1;
    return jsonResponse({
        online,
        verifications: stats.total_verifications || 0,
        uptime_days: stats.start_time ? Math.floor((Date.now() - new Date(stats.start_time).getTime()) / 86400000) : 0,
        activity: cache.items.slice(0, 4).map(i => ({ t: i.p, f: i.f })),
        mine: cache.items.filter(i => i.e === email).slice(0, 5).map(i => ({ t: i.p, f: i.f })),
        sub: sub && sub.activa ? { plan: sub.plan, fin: sub.fecha_fin } : null,
        rank: rank || null
    });
}

async function handleHome(env, request) {
    const auth = request ? await requireAuth(env, request) : null;
    const user = auth ? auth.user : {};
    const name = String(user.name || String(user.email || '').split('@')[0] || 'amigo');
    const sub = user.email ? await getSuscripcionUsuario(env, user.email) : null;
    const crown = (user.role === 'admin' || (sub && sub.activa)) ? '👑' : '';

    const dynamicKeys = await getDynamicKeys(env) || {};
    let totalClaves = 0;
    for (const hash in dynamicKeys) { if (!dynamicKeys[hash].blocked) totalClaves++; }
    for (const k of STATIC_KEYS) { if (!k.blocked && k.type !== 'honeypot') totalClaves++; }
    const valorTotalUSD = totalClaves * 5.00;

    const symbols = { EUR: '€', GBP: '£', MXN: '$', ARS: '$', COP: '$', BRL: 'R$' };
    let cur = '';
    for (const mon of ['EUR', 'GBP', 'MXN', 'ARS', 'COP', 'BRL']) {
        const val = await convertirMoneda(valorTotalUSD, mon);
        if (val !== null) cur += `<div><u>${symbols[mon]}</u><span><b>${val.toFixed(2)}</b><small class="mu" style="display:block">${mon}</small></span></div>`;
    }

    const html = HOME_TEMPLATE
        .split('{{NAME}}').join(escapeHTML(name))
        .split('{{INITIAL}}').join(escapeHTML(name.charAt(0).toUpperCase()))
        .split('{{CROWN}}').join(crown)
        .split('{{KEYS}}').join(String(totalClaves))
        .split('{{USD}}').join(valorTotalUSD.toFixed(2))
        .split('{{CUR}}').join(cur)
        .split('{{LEGAL}}').join(getLegalFooter())
        .split('{{COOKIE}}').join(getCookieBannerScript());
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleSell(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) {
        return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">🔒 Necesitas iniciar sesión</h2>
                    <a href="/login" style="color:#00ccff;">Iniciar sesión</a>
                </div>
            </body></html>
        `, { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    const user = auth.user;
    const reseller = await getReseller(env, user.email);
    if (!reseller || reseller.role !== 'reseller') {
        return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ffaa00;">⚠️ No eres revendedor</h2>
                    <p>Si quieres ser revendedor, contacta con el administrador.</p>
                    <a href="/home" style="color:#00ccff;">Volver al inicio</a>
                </div>
            </body></html>
        `, { status: 403, headers: { 'Content-Type': 'text/html' } });
    }

    const { movimientos } = await getMovimientos(env, user.email, 20, 0);
    const clavesDisponibles = reseller.claves_asignadas.filter(k => !reseller.claves_vendidas.includes(k));
    const clavesVendidas = reseller.claves_vendidas;

    const dynKeys = await getDynamicKeys(env);
    const clavesInfo = {};
    for (let k of reseller.claves_asignadas) {
        const hash = await hashKey(k);
        if (dynKeys[hash]) {
            clavesInfo[k] = dynKeys[hash];
        }
    }

    const { compras } = await getCompras(env, 10000, 0, { email: user.email });
    const ventasPorDia = {};
    compras.forEach(c => {
        const dia = new Date(c.fecha).toISOString().slice(0,10);
        ventasPorDia[dia] = (ventasPorDia[dia] || 0) + parseFloat(c.precio || 0);
    });
    const labels = Object.keys(ventasPorDia).sort().slice(-7);
    const data = labels.map(d => ventasPorDia[d]);

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>💰 Panel de Revendedor - Ocean Hub</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
        <h1>💰 Panel de Revendedor</h1>
        <div class="stats-grid">
            <div class="stat-card"><div class="number">$${reseller.saldo.toFixed(2)}</div><div class="label">Saldo disponible</div></div>
            <div class="stat-card"><div class="number">$${reseller.total_comisiones.toFixed(2)}</div><div class="label">Total ganado</div></div>
            <div class="stat-card"><div class="number">${clavesDisponibles.length}</div><div class="label">Claves disponibles</div></div>
            <div class="stat-card"><div class="number">${clavesVendidas.length}</div><div class="label">Claves vendidas</div></div>
            <div class="stat-card"><div class="number">${reseller.comision_porcentaje || 0}%</div><div class="label">Comisión por venta</div></div>
        </div>

        <div class="chart-container">
            <h3>Ventas diarias (últimos 7 días)</h3>
            <canvas id="salesChart"></canvas>
        </div>

        <div class="section">
            <h2>🔑 Mis claves disponibles</h2>
            ${clavesDisponibles.length === 0 ? '<p>No tienes claves asignadas.</p>' : `
            <table>
                <thead><tr><th>Clave</th><th>Rango</th><th>Expiración</th><th>Acción</th></tr></thead>
                <tbody>
                    ${clavesDisponibles.map(k => {
                        const info = clavesInfo[k] || {};
                        return `<tr>
                            <td><span class="clave-item">${k}</span></td>
                            <td>${info.rango || 'N/A'}</td>
                            <td>${info.expires || 'N/A'}</td>
                            <td><button class="btn btn-primary" onclick="copiarClave('${k}')">📋 Copiar</button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>📊 Claves vendidas</h2>
            ${clavesVendidas.length === 0 ? '<p>Aún no has vendido ninguna clave.</p>' : `
            <table>
                <thead><tr><th>Clave</th></tr></thead>
                <tbody>
                    ${clavesVendidas.map(k => `<tr><td><span class="clave-item">${k}</span></td></tr>`).join('')}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>📦 Comprar más claves (packs)</h2>
            <p>Usa tu saldo para comprar packs de claves y revenderlas.</p>
            <div class="pack-grid">
                ${Object.entries(PACKS).map(([id, pack]) => `
                <div class="pack-card">
                    <h3>${pack.name}</h3>
                    <p>${pack.quantity} claves</p>
                    <div class="price">$${pack.price.toFixed(2)}</div>
                    <button class="btn btn-success" onclick="comprarPack('${id}')">Comprar</button>
                </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2>📜 Historial de movimientos</h2>
            ${movimientos.length === 0 ? '<p>Sin movimientos aún.</p>' : `
            <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Descripción</th></tr></thead>
                <tbody>
                    ${movimientos.map(m => `
                    <tr>
                        <td>${new Date(m.fecha).toLocaleString()}</td>
                        <td>${m.tipo}</td>
                        <td style="color:${m.cantidad >= 0 ? '#00cc88' : '#ff6666'};">${m.cantidad >= 0 ? '+' : ''}$${m.cantidad.toFixed(2)}</td>
                        <td>${m.descripcion}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            `}
        </div>

        <div class="section">
            <h2>💸 Solicitar retiro</h2>
            <p>Saldo disponible: <strong>$${reseller.saldo.toFixed(2)}</strong></p>
            <button class="btn btn-warning" onclick="solicitarRetiro()">Solicitar retiro</button>
        </div>

        <a href="/home" class="back">← Volver al inicio</a>
    </div>
    <script>
        function copiarClave(clave) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(clave)
                    .then(() => alert('Clave copiada al portapapeles'))
                    .catch(() => prompt('Copia esta clave:', clave));
            } else {
                prompt('Copia esta clave:', clave);
            }
        }
        function comprarPack(packId) {
            const pack = ${JSON.stringify(PACKS)}[packId];
            if (!pack) {
                alert('❌ Pack no válido.');
                return;
            }
            if (confirm('¿Comprar este pack por $' + pack.price + '?')) {
                fetch('/comprar-pack', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pack: packId })
                })
                .then(async res => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'No se pudo comprar el pack.');
                    return data;
                })
                .then(data => {
                    alert(data.message || 'Pack comprado');
                    location.reload();
                })
                .catch(err => alert('Error: ' + err.message));
            }
        }
        function solicitarRetiro() {
            const monto = prompt('¿Cuánto deseas retirar? (máximo $' + ${reseller.saldo.toFixed(2)} + ')');
            if (!monto) return;
            const parsedMonto = Number.parseFloat(monto);
            if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
                alert('❌ Introduce un monto válido.');
                return;
            }
            fetch('/solicitar-retiro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto: parsedMonto })
            })
            .then(async res => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'No se pudo registrar el retiro.');
                return data;
            })
            .then(data => alert(data.message || 'Solicitud registrada.'))
            .catch(err => alert('Error: ' + err.message));
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
    </script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleHacerReseller(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const { email, porcentaje } = body;
    if (!email) return jsonResponse({ error: 'Falta email' }, 400);

    const user = await getUserByEmail(env, email);
    if (!user) return jsonResponse({ error: 'Usuario no encontrado' }, 404);

    let reseller = await getReseller(env, email);
    if (!reseller) {
        reseller = {
            email, role: 'reseller', saldo: 0,
            comision_porcentaje: porcentaje || 25,
            claves_asignadas: [], claves_vendidas: [],
            total_vendido: 0, total_comisiones: 0,
            created_at: new Date().toISOString()
        };
    } else {
        reseller.comision_porcentaje = porcentaje || reseller.comision_porcentaje;
    }
    await setReseller(env, email, reseller);
    user.role = 'reseller';
    await env.STATS.put(`user_${email}`, JSON.stringify(user));
    await logAdminAction(env, 'hacer_reseller', email, getClientIP(request), { porcentaje });
    return jsonResponse({ message: `Usuario ${email} ahora es revendedor con ${reseller.comision_porcentaje}% de comisión` });
}

async function handleAsignarClaves(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const { email, claves } = body;
    if (!email || !Array.isArray(claves) || claves.length === 0) {
        return jsonResponse({ error: 'Faltan datos' }, 400);
    }

    const reseller = await getReseller(env, email);
    if (!reseller) return jsonResponse({ error: 'El usuario no es revendedor' }, 400);

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
        return jsonResponse({ error: 'Ninguna clave válida para asignar' }, 400);
    }
    await setReseller(env, email, reseller);
    await logAdminAction(env, 'asignar_claves', email, getClientIP(request), { claves: asignadas });
    return jsonResponse({ message: `Asignadas ${asignadas.length} claves a ${email}`, claves: asignadas });
}

async function handleListResellers(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const list = await env.STATS.list({ prefix: 'reseller_' });
    const resellers = [];
    for (let key of list.keys) {
        const raw = await env.STATS.get(key.name);
        if (raw) resellers.push(JSON.parse(raw));
    }
    return jsonResponse({ resellers });
}

async function handleComprarPack(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    return await withKVLock(env, `reseller:${auth.user.email}`, async () => {    const body = await request.json();
    const packId = body.pack;
    const pack = PACKS[packId];
    if (!pack) return jsonResponse({ error: 'Pack no válido' }, 400);

    const reseller = await getReseller(env, auth.user.email);
    if (!reseller) return jsonResponse({ error: 'No eres revendedor' }, 403);

    if (reseller.saldo < pack.price) {
        return jsonResponse({ error: 'Saldo insuficiente' }, 400);
    }

    reseller.saldo -= pack.price;
    const clavesGeneradas = [];
    for (let i = 0; i < pack.quantity; i++) {
        const key = 'DLC-PACK-' + generateRandomHex(5).toUpperCase();
        const keyData = {
            key, type: 'premium', rango: '📦 Pack', expires: '30 días',
            dynamic: true, created_at: new Date().toISOString(),
            blocked: false, count: 0, history: [], tags: ['pack'],
            notas: `Generado para revendedor ${auth.user.email}`,
            un_solo_uso: false,
            change_log: [{ action: 'created_from_pack', timestamp: new Date().toISOString() }]
        };
        await saveDynamicKey(env, keyData);
        clavesGeneradas.push(key);
    }
    reseller.claves_asignadas.push(...clavesGeneradas);
    await setReseller(env, auth.user.email, reseller);
    await registrarMovimiento(env, auth.user.email, 'compra_pack', -pack.price, `Compra de ${pack.name} (${pack.quantity} claves)`);
    await sendAlert(env, `📦 ${auth.user.email} compró pack ${pack.name} por $${pack.price}`, 'pack');
    return jsonResponse({ message: `Pack comprado. ${pack.quantity} claves generadas y asignadas.`, claves: clavesGeneradas });
    });
}

async function handleSolicitarRetiro(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    return await withKVLock(env, `reseller:${auth.user.email}`, async () => {    const body = await request.json();
    const monto = parseFloat(body.monto);
    if (isNaN(monto) || monto <= 0) return jsonResponse({ error: 'Monto inválido' }, 400);

    const reseller = await getReseller(env, auth.user.email);
    if (!reseller) return jsonResponse({ error: 'No eres revendedor' }, 403);
    if (reseller.saldo < monto) return jsonResponse({ error: 'Saldo insuficiente' }, 400);

    reseller.saldo -= monto;
    await setReseller(env, auth.user.email, reseller);
    await registrarMovimiento(env, auth.user.email, 'retiro', -monto, `Retiro de $${monto} solicitado`);
    await sendAlert(env, `💸 ${auth.user.email} solicitó retiro de $${monto}`, 'retiro');
    return jsonResponse({ message: `Solicitud de retiro de $${monto} registrada. El administrador procesará el pago.` });
    });
}

async function handleShop(env, request) {
    const url = new URL(request.url);
    const couponCode = url.searchParams.get('coupon') || null;

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>🛒 Tienda - Ocean Hub</title>
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
        <h1>🛒 Tienda de DLCs</h1>
        ${couponCode ? `<div style="background:rgba(255,215,0,0.2);border-radius:15px;padding:10px;margin:10px 0;">🎫 Cupón aplicado: <strong>${escapeHTML(couponCode)}</strong> (descuento activo)</div>` : `
        <div class="coupon-input">
            <input type="text" id="couponInput" placeholder="Código de cupón">
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
            `).join('')}
        </div>
        <a href="/home" class="back">← Volver al inicio</a>
    </div>
    <script>
        async function comprar(priceId) {
            try {
                const coupon = document.getElementById('couponInput') ? document.getElementById('couponInput').value.trim() : '';
                let url = '/shop/create-checkout?price_id=' + encodeURIComponent(priceId);
                if (coupon) url += '&coupon=' + encodeURIComponent(coupon);
                const res = await fetch(url, { credentials: 'same-origin' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'No se pudo crear la orden.');
                if (data.links && data.links.length) {
                    const approveLink = data.links.find(link => link.rel === 'approve');
                    if (approveLink && approveLink.href) {
                        window.location.href = approveLink.href;
                    } else {
                        throw new Error('No se encontró enlace de aprobación.');
                    }
                } else {
                    throw new Error(data.error || 'Error inesperado al crear la orden.');
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        }
        function aplicarCupon() {
            const input = document.getElementById('couponInput');
            const coupon = input ? input.value.trim() : '';
            if (!coupon) {
                alert('Introduce un código de cupón.');
                if (input) input.focus();
                return;
            }
            window.location.href = '/shop?coupon=' + encodeURIComponent(coupon);
        }
    </script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handlePay() {
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
        <div style="text-align:center;">
            <h2 style="color:#00ccff;">💳 Procesar pago</h2>
            <p>Para realizar un pago, ve a la tienda y selecciona tu producto.</p>
            <a href="/shop" style="color:#00ccff;">Ir a la tienda</a>
        </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
}

async function handleDlc() {
    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>🎮 DLCs - Ocean Hub</title>
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
        <h1>🎮 DLCs disponibles</h1>
        <div class="dlc-list">
            ${Object.entries(PRODUCTS).map(([id, p]) => `
            <div class="dlc-item">
                <span class="name">${p.name}</span>
                <span>${p.description}</span>
                <span class="price">$${p.price.toFixed(2)}</span>
            </div>
            `).join('')}
        </div>
        <a href="/shop" class="back">← Comprar en la tienda</a>
        <br>
        <a href="/home" class="back">← Volver al inicio</a>
    </div>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleKey() {
    return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>🔑 Verificar clave - Ocean Hub</title>
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
        <h2>🔑 Verificar clave</h2>
        <p>Ingresa tu clave DLC para comprobar su validez.</p>
        <input type="text" id="keyInput" placeholder="Ej: DLC-PREMIUM-7F2A9B">
        <button onclick="verificar()">Verificar</button>
        <div id="result" class="result"></div>
        <a href="/home" class="back">← Volver al inicio</a>
    </div>
    <script>
        async function verificar() {
            const key = document.getElementById('keyInput').value.trim();
            const resultDiv = document.getElementById('result');
            if (!key) { alert('Ingresa una clave'); return; }
            try {
                const res = await fetch('/verify-web?key=' + encodeURIComponent(key), {
                    credentials: 'same-origin'
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'No se pudo verificar la clave.');
                resultDiv.textContent = '';
                const title = document.createElement('p');
                title.style.color = (data.success && data.valid) ? '#00cc88' : '#ff6666';
                title.textContent = (data.success && data.valid) ? '✅ Clave válida' : '❌ Clave inválida';
                const detail = document.createElement('p');
                detail.textContent = data.message || data.error || '';
                resultDiv.append(title, detail);
            } catch (e) {
                resultDiv.textContent = 'Error al verificar: ' + e.message;
                resultDiv.style.color = '#ff6666';
            }
        }
    </script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { 'Content-Type': 'text/html' } });
}

// ==================================================
// [ PAYPAL CAPTURE ]
// ==================================================
async function handlePayPalCapture(env, request, preCapturedData = null) {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('token') || url.searchParams.get('orderId');
    if (!orderId) return new Response('Falta el ID de la orden', { status: 400 });
    try {
        // Serialize browser-return and webhook fulfillment for the same PayPal order.
        return await withKVLock(env, `paypal_payment_${orderId}`, () =>
            handlePayPalCaptureUnlocked(env, request, preCapturedData), 110000);
    } catch (error) {
        console.error('Could not lock PayPal payment processing:', error?.message || error);
        return new Response('El pago se está procesando. Espera unos segundos y vuelve a consultar tu perfil.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '10', 'Cache-Control': 'no-store' }
        });
    }
}

async function handlePayPalCaptureUnlocked(env, request, preCapturedData = null) {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('token') || url.searchParams.get('orderId');
    if (!orderId) {
        return new Response('Falta el ID de la orden', { status: 400 });
    }

    try {
        const captureData = preCapturedData || await capturePayPalOrder(env, orderId);
        if (captureData?.status !== 'COMPLETED') return new Response('Pago no completado', { status: 402 });
        const paymentKey = `paypal_processed_${orderId}`;
        if (await env.STATS.get(paymentKey)) return new Response('Pago ya procesado', { status: 200 });
        let customData = {};
        try {
            const customId = captureData.purchase_units?.[0]?.custom_id || '{}';
            customData = JSON.parse(customId);
        } catch (e) {}

        const tipo = customData.tipo || 'dlc';
        const email = customData.email || 'anónimo';
        const couponCode = customData.coupon || null;

        if (tipo === 'suscripcion') {
            const plan = customData.plan || 'tiburon';
            const planData = SUSCRIPCION_PLANES[plan];
            if (!planData) throw new Error('Plan no válido');
            let subscriptionPrice = planData.price;
            if (couponCode) {
                const coupon = await getCoupon(env, couponCode);
                if (!coupon) throw new Error('Cupón inválido');
                if (coupon.expires && new Date(coupon.expires) < new Date()) throw new Error('Cupón expirado');
                if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error('Cupón agotado');
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
                fecha: new Date().toISOString(), email: email, user_id: '',
                clave: 'Suscripción', producto: `Suscripción ${planData.name}`,
                precio: Number(subscriptionPrice.toFixed(2)), payment_id: orderId, proveedor: 'paypal', estado: 'activa'
            });
            // Record completion only after the subscription and purchase record exist.
            await env.STATS.put(paymentKey, '1', { expirationTtl: 31536000 });
            await sendAlert(env, `✅ Suscripción activada: ${email} -> ${planData.name} (${planData.days} días)`, 'suscripcion');
            await triggerWebhooks(env, email, 'subscription_activated', { plan: planData.name, days: planData.days });
            await logUserAction(env, email, 'subscription_purchase', { plan: planData.name, orderId });
            const user = await getUserByEmail(env, email);
            if (user) {
                user.points = (user.points || 0) + 10;
                await env.STATS.put(`user_${email}`, JSON.stringify(user));
            }
            return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
                <h2 style="color:#00cc88;">✅ ¡Suscripción activada!</h2>
                <p>Plan: ${planData.name}</p>
                <p>Duración: ${planData.days} días</p>
                <a href="/profile" style="color:#00ccff;">Ver mi perfil</a>
            </body></html>
            `, { headers: { 'Content-Type': 'text/html' } });
        } else {
            const priceId = customData.price_id || 'price_aprendiz';
            const product = PRODUCTS[priceId];
            if (!product) throw new Error('Producto no encontrado');
            let price = product.price;
            if (couponCode) {
                const coupon = await useCoupon(env, couponCode);
                if (coupon.discountPercent) {
                    price = price * (1 - coupon.discountPercent / 100);
                } else if (coupon.fixedAmount) {
                    price = Math.max(0, price - coupon.fixedAmount);
                }
            }
            const key = 'DLC-PAY-' + generateRandomHex(5).toUpperCase();
            const keyData = {
                key, type: 'premium', rango: product.name,
                expires: `${product.days || 30} días`, dynamic: true,
                created_at: new Date().toISOString(), blocked: false, count: 0,
                history: [], tags: ['paypal'],
                notas: `Comprado por ${email} con PayPal (${orderId})`,
                un_solo_uso: false,
                change_log: [{ action: 'created_from_paypal', timestamp: new Date().toISOString() }]
            };
            await saveDynamicKey(env, keyData);
            await registrarCompra(env, {
                fecha: new Date().toISOString(), email: email,
                user_id: customData.user_id || '', clave: key,
                producto: product.name, precio: price,
                payment_id: orderId, proveedor: 'paypal', estado: 'activa'
            });
            // Record completion after the key has been stored and the purchase is registered.
            await env.STATS.put(paymentKey, '1', { expirationTtl: 31536000 });

            const user = await getUserByEmail(env, email);
            if (user && user.referido_por) {
                const comision = price * 0.10;
                await addComisionToReferidor(env, email, comision);
                await sendAlert(env, `💰 Comisión de $${comision.toFixed(2)} añadida al referidor de ${email}`, 'comision');
            }

            if (user) {
                user.points = (user.points || 0) + 10;
                await env.STATS.put(`user_${email}`, JSON.stringify(user));
            }

            await sendAlert(env, `✅ Compra registrada: ${email} -> ${product.name} (clave: ${key})`, 'compra');
            await sendEmail(env, email, '🎉 Tu compra en Ocean Hub', `
                <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;background:#0a1a2b;color:#e0f0ff;padding:30px;border-radius:20px;">
                    <h2 style="color:#00cc88;">✅ ¡Gracias por tu compra!</h2>
                    <p>Hola${user ? ' ' + escapeHTML(user.name || '') : ''},</p>
                    <p>Tu compra se ha procesado correctamente. Aquí tienes los detalles:</p>
                    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;">
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Producto</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:bold;">${escapeHTML(product.name)}</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Precio</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:#ffcc00;font-weight:bold;">$${price.toFixed(2)} USD</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Duración</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">${product.days} días</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">ID de pago</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);font-family:monospace;font-size:0.85rem;">${orderId}</td></tr>
                        <tr><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">Fecha</td><td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">${new Date().toLocaleString()}</td></tr>
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
                    <p style="font-size:0.8rem;color:#88aacc;">Si no reconoces esta compra, contáctanos respondiendo a este mensaje.</p>
                </div>
            `);
            await triggerWebhooks(env, email, 'dlc_purchased', { key, product: product.name });
            await logUserAction(env, email, 'dlc_purchase', { key, product: product.name, orderId });

            await withKVLock(env, "global_stats", async () => {
                const stats = await getStats(env);
                if (!stats) return;
                stats.sales.total = (stats.sales.total || 0) + 1;
                stats.sales.revenue = (stats.sales.revenue || 0) + price;
                stats.sales.last_sale = new Date().toISOString();
                stats.sales.by_product[product.name] = (stats.sales.by_product[product.name] || 0) + 1;
                await env.STATS.put("global_stats", JSON.stringify(stats));
            });

            return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
                <h2 style="color:#00cc88;">✅ ¡Pago exitoso!</h2>
                <p>Tu clave DLC es: <code style="background:#112233;padding:8px 16px;border-radius:8px;font-size:1.2rem;">${key}</code></p>
                <p>Producto: ${escapeHTML(product.name)}</p>
                <p>Te hemos enviado un correo con los detalles.</p>
                <a href="/profile" style="color:#00ccff;">Ver mis claves</a>
            </body></html>
            `, { headers: { 'Content-Type': 'text/html' } });
        }
    } catch (e) {
        console.error('Error en captura PayPal:', e);
        return new Response(`
        <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
            <h2 style="color:#ff6666;">❌ Error al procesar el pago</h2>
            <p>No pudimos completar la entrega de tu compra. Conserva el ID de la orden y contacta con soporte.</p>
            <a href="/shop" style="color:#00ccff;">Volver a la tienda</a>
        </body></html>
        `, { status: 500, headers: { 'Content-Type': 'text/html' } });
    }
}

// ==================================================
// [ DASHBOARD Y ADMIN ]
// ==================================================

function calcularIngresosDesdeCompras(compras) {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const semana = new Date(ahora.getTime() - 7 * 86400000);
    const mes = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate());

    let ventasDia = 0, ventasSemana = 0, ventasMes = 0, totalIngresos = 0;
    const porProducto = {};
    compras.forEach(c => {
        const fecha = new Date(c.fecha);
        const precio = parseFloat(c.precio) || 0;
        totalIngresos += precio;
        if (fecha >= hoy) ventasDia += precio;
        if (fecha >= semana) ventasSemana += precio;
        if (fecha >= mes) ventasMes += precio;
        const prod = c.producto || 'Desconocido';
        porProducto[prod] = (porProducto[prod] || 0) + precio;
    });
    let productoMasVendido = 'Ninguno';
    let maxVentas = 0;
    for (let [prod, total] of Object.entries(porProducto)) {
        if (total > maxVentas) { maxVentas = total; productoMasVendido = prod; }
    }

    return { dia: ventasDia, semana: ventasSemana, mes: ventasMes, total: totalIngresos, producto_mas_vendido: productoMasVendido, total_compras: compras.length };
}

async function handleMainRoute(env) {
    const stats = await getStats(env) || {};
    const dynamicKeys = await getDynamicKeys(env) || {};
    let allKeys = [];
    for (let k of STATIC_KEYS) {
        const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses, uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [] });
    }
    for (let hash in dynamicKeys) {
        const k = dynamicKeys[hash];
        const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
        allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses, uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [] });
    }
    const totalKeys = allKeys.length;
    const usedKeys = allKeys.filter(k => k.uses > 0).length;
    const blockedKeys = allKeys.filter(k => k.blocked).length;

    let cardsHtml = '';
    allKeys.forEach(k => {
        const isBlocked = k.blocked || false;
        const isDynamic = k.dynamic || false;
        const maxUses = k.maxUses || Infinity;
        const used = k.uses || 0;
        const nearLimit = (used / maxUses) >= 0.8 && maxUses !== Infinity;
        const statusClass = isBlocked ? 'blocked' : (nearLimit ? 'warning' : 'active');
        const icon = isDynamic ? '🎲' : '📌';
        cardsHtml += `
            <div class="key-card ${statusClass}" data-key="${k.key}" data-type="${k.type}" data-status="${statusClass}">
                <div class="card-header">
                    <span class="key-icon">${icon}</span>
                    <span class="key-name">${escapeHTML(k.key)}</span>
                    <span class="key-status">${isBlocked ? '🚫' : '✅'}</span>
                </div>
                <div class="card-body">
                    <span class="key-rango">${escapeHTML(k.rango)}</span>
                    <span class="key-type">${k.type}</span>
                    <span class="key-expires">⏳ ${escapeHTML(k.expires)}</span>
                    <span class="key-uses">Usos: ${used}${maxUses !== Infinity ? `/${maxUses}` : ''}</span>
                    ${k.tags.length > 0 ? `<span class="key-tags">🏷️ ${k.tags.join(', ')}</span>` : ''}
                </div>
                <button class="btn-info" onclick="showKeyInfo(${escapeJSAttribute(k.key)})">📋 Info</button>
            </div>
        `;
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌊 Ocean Hub - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: linear-gradient(145deg, #0a1a2b 0%, #1b3a5c 100%); color: #e0f0ff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100vh; padding: 20px; overflow-x: hidden; }
        .ocean-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; pointer-events: none; }
        .wave { position: absolute; width: 200%; height: 100%; background: repeating-linear-gradient(90deg, rgba(0,200,255,0.05) 0%, rgba(0,150,255,0.1) 50%, rgba(0,200,255,0.05) 100%); animation: waveMove 20s linear infinite; border-radius: 50%; }
        .wave:nth-child(2) { animation-duration: 25s; animation-delay: -5s; opacity: 0.5; }
        .wave:nth-child(3) { animation-duration: 30s; animation-delay: -10s; opacity: 0.3; }
        @keyframes waveMove { 0% { transform: translateX(0) scaleY(0.1); } 50% { transform: translateX(-25%) scaleY(0.2); } 100% { transform: translateX(-50%) scaleY(0.1); } }
        .container { max-width: 1400px; margin: 0 auto; position: relative; z-index: 1; }
        .header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
        h1 { font-size: 2.8rem; text-shadow: 0 0 20px #00ccff, 0 0 40px #0088ff; }
        .header-actions { display: flex; gap: 15px; align-items: center; }
        .header-actions .admin-link { padding: 10px 25px; background: rgba(0,200,255,0.15); border-radius: 40px; color: #00ccff; text-decoration: none; font-weight: bold; border: 1px solid #00ccff; transition: 0.3s; }
        .header-actions .admin-link:hover { background: #00ccff; color: #0a1a2b; }
        .stats-bar { display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; background: rgba(0,0,0,0.25); border-radius: 20px; padding: 20px; backdrop-filter: blur(8px); }
        .stat-item { flex: 1; min-width: 100px; text-align: center; background: rgba(255,255,255,0.05); border-radius: 15px; padding: 12px 8px; transition: 0.3s; }
        .stat-item:hover { background: rgba(255,255,255,0.1); }
        .stat-item .number { font-size: 2rem; font-weight: bold; color: #00ccff; }
        .stat-item .label { font-size: 0.85rem; opacity: 0.8; }
        .stat-item .number.valid { color: #00cc88; }
        .stat-item .number.invalid { color: #ff6666; }
        .stat-item .number.blocked { color: #ffaa00; }
        .controls { display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; }
        .controls input, .controls select { padding: 10px 18px; border-radius: 30px; border: none; background: rgba(255,255,255,0.08); color: white; font-size: 1rem; backdrop-filter: blur(4px); outline: 1px solid rgba(255,255,255,0.15); transition: 0.3s; }
        .controls input:focus, .controls select:focus { outline: 1px solid #00ccff; background: rgba(255,255,255,0.15); }
        .controls input::placeholder { color: #aac; }
        .controls select option { background: #1b3a5c; }
        .key-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px; }
        .key-card { background: rgba(255,255,255,0.06); border-radius: 20px; padding: 20px; backdrop-filter: blur(6px); border-left: 6px solid #00ccff; transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.3s; animation: fadeIn 0.4s ease forwards; opacity: 0; transform: scale(0.96); display: flex; flex-direction: column; gap: 10px; }
        .key-card:hover { transform: translateY(-5px) scale(1.01); box-shadow: 0 12px 35px rgba(0,200,255,0.25); }
        .key-card.blocked { border-left-color: #ff4444; opacity: 0.7; }
        .key-card.warning { border-left-color: #ffaa00; }
        .key-card .card-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .key-icon { font-size: 1.6rem; }
        .key-name { font-weight: bold; font-size: 1.1rem; flex: 1; word-break: break-all; letter-spacing: 0.3px; }
        .key-status { font-size: 1.3rem; }
        .card-body { display: flex; flex-wrap: wrap; gap: 8px; margin: 5px 0; font-size: 0.9rem; }
        .card-body span { background: rgba(0,0,0,0.25); padding: 4px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
        .btn-info { background: rgba(0,200,255,0.15); border: none; color: white; padding: 8px 16px; border-radius: 30px; cursor: pointer; transition: 0.3s; align-self: flex-start; font-size: 0.9rem; }
        .btn-info:hover { background: #00ccff; color: #0a1a2b; }
        @keyframes fadeIn { to { opacity: 1; transform: scale(1); } }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 1000; justify-content: center; align-items: center; }
        .modal-overlay.active { display: flex; }
        .modal { background: #1b3a5c; border-radius: 30px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.8); animation: fadeIn 0.3s ease; }
        .modal h2 { margin-bottom: 15px; color: #00ccff; }
        .modal .close-btn { float: right; background: none; border: none; color: white; font-size: 2rem; cursor: pointer; transition: 0.3s; }
        .modal .close-btn:hover { color: #ff6666; }
        .modal .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .modal .history-item { background: rgba(0,0,0,0.2); margin: 5px 0; padding: 8px 12px; border-radius: 10px; font-size: 0.9rem; display: flex; justify-content: space-between; }
        .modal .history-item.valid { border-left: 4px solid #00cc88; }
        .modal .history-item.invalid { border-left: 4px solid #ff4444; }
        @media (max-width: 600px) {
            h1 { font-size: 2rem; }
            .stat-item .number { font-size: 1.5rem; }
            .key-grid { grid-template-columns: 1fr; }
            .header { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>
    <div class="ocean-bg">
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="wave"></div>
    </div>

    <div class="container">
        <div class="header">
            <h1>🌊 Ocean Hub</h1>
            <div class="header-actions">
                <a href="/admin" class="admin-link">🔐 Administrar</a>
            </div>
        </div>

        <div class="stats-bar">
            <div class="stat-item"><div class="number">${stats.total_verifications || 0}</div><div class="label">Verificaciones</div></div>
            <div class="stat-item"><div class="number valid">${stats.valid_verifications || 0}</div><div class="label">Válidas</div></div>
            <div class="stat-item"><div class="number invalid">${stats.invalid_verifications || 0}</div><div class="label">Inválidas</div></div>
            <div class="stat-item"><div class="number">${totalKeys}</div><div class="label">Claves totales</div></div>
            <div class="stat-item"><div class="number">${usedKeys}</div><div class="label">Claves usadas</div></div>
            <div class="stat-item"><div class="number blocked">${blockedKeys}</div><div class="label">Bloqueadas</div></div>
            <div class="stat-item"><div class="number">${stats.sales?.total || 0}</div><div class="label">Ventas</div></div>
            <div class="stat-item"><div class="number">$${stats.sales?.revenue?.toFixed(2) || '0.00'}</div><div class="label">Ingresos</div></div>
        </div>

        <div class="controls">
            <input type="text" id="searchInput" placeholder="🔍 Buscar clave..." oninput="filterKeys()">
            <select id="typeFilter" onchange="filterKeys()">
                <option value="all">Todos los tipos</option>
                <option value="gratuita">Gratuita</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
                <option value="staff">Staff</option>
                <option value="prueba">Prueba</option>
                <option value="dinamica">Dinámica</option>
            </select>
            <select id="statusFilter" onchange="filterKeys()">
                <option value="all">Todos los estados</option>
                <option value="active">Activas</option>
                <option value="blocked">Bloqueadas</option>
                <option value="warning">Límite cercano</option>
            </select>
        </div>

        <div class="key-grid" id="keyGrid">
            ${cardsHtml}
        </div>
    </div>

    <div class="modal-overlay" id="infoModal">
        <div class="modal">
            <button class="close-btn" onclick="closeModal()">&times;</button>
            <h2 id="modalTitle">Información de Clave</h2>
            <div id="modalContent"></div>
        </div>
    </div>

    <script>
        const allKeysData = ${JSON.stringify(allKeys.map(k => ({
            key: k.key, type: k.type,
            status: (k.blocked ? 'blocked' : (k.maxUses && (k.uses || 0) / k.maxUses >= 0.8 ? 'warning' : 'active')),
            dynamic: k.dynamic || false
        })))};

        function filterKeys() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const type = document.getElementById('typeFilter').value;
            const status = document.getElementById('statusFilter').value;
            const cards = document.querySelectorAll('.key-card');
            cards.forEach((card, index) => {
                const key = card.dataset.key;
                const cardType = card.dataset.type;
                const cardStatus = card.dataset.status;
                const matchSearch = key.toLowerCase().includes(search);
                const matchType = type === 'all' || cardType === type || (type === 'dinamica' && allKeysData[index]?.dynamic);
                const matchStatus = status === 'all' || cardStatus === status;
                card.style.display = (matchSearch && matchType && matchStatus) ? 'flex' : 'none';
            });
        }

        function escapeInfoText(value) {
            const div = document.createElement('div');
            div.textContent = String(value ?? '');
            return div.innerHTML;
        }

        async function showKeyInfo(key) {
            try {
                const res = await fetch('/key-info?key=' + encodeURIComponent(key), {
                    credentials: 'same-origin'
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'No se pudo cargar la información.');
                const modal = document.getElementById('infoModal');
                document.getElementById('modalTitle').textContent = '🔑 ' + key;
                let html = '';
                html += '<div class="detail-row"><span>Rango</span><span>' + escapeInfoText(data.rango) + '</span></div>';
                html += '<div class="detail-row"><span>Tipo</span><span>' + escapeInfoText(data.type) + '</span></div>';
                html += '<div class="detail-row"><span>Expiración</span><span>' + escapeInfoText(data.expires) + '</span></div>';
                html += '<div class="detail-row"><span>Usos</span><span>' + escapeInfoText(data.uses) + (data.maxUses ? '/' + escapeInfoText(data.maxUses) : '') + '</span></div>';
                html += '<div class="detail-row"><span>Estado</span><span>' + (data.blocked ? '🚫 Bloqueada' : '✅ Activa') + '</span></div>';
                html += '<div class="detail-row"><span>Dinámica</span><span>' + (data.dynamic ? '🎲 Sí' : '📌 No') + '</span></div>';
                html += '<div class="detail-row"><span>Un solo uso</span><span>' + (data.un_solo_uso ? '✅ Sí' : '❌ No') + '</span></div>';
                if (Array.isArray(data.tags) && data.tags.length) {
                    html += '<div class="detail-row"><span>Tags</span><span>' + data.tags.map(escapeInfoText).join(', ') + '</span></div>';
                }
                if (data.notas) {
                    html += '<div class="detail-row"><span>Notas</span><span>' + escapeInfoText(data.notas) + '</span></div>';
                }
                html += '<h3 style="margin-top:20px;">Historial (últimas 10)</h3>';
                if (Array.isArray(data.history) && data.history.length) {
                    data.history.forEach(h => {
                        const cls = h.valid ? 'valid' : 'invalid';
                        html += '<div class="history-item ' + cls + '">';
                        html += '<span>' + (h.valid ? '✅' : '❌') + ' ' + escapeInfoText(new Date(h.timestamp).toLocaleString()) + '</span>';
                        html += '<span>' + escapeInfoText(h.ip) + '</span>';
                        html += '</div>';
                    });
                } else {
                    html += '<p>Sin verificaciones aún.</p>';
                }
                document.getElementById('modalContent').innerHTML = html;
                modal.classList.add('active');
            } catch (err) {
                alert('Error al cargar información: ' + err.message);
            }
        }

        function closeModal() {
            document.getElementById('infoModal').classList.remove('active');
        }
        document.getElementById('infoModal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    </script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================================================
// [ ADMIN ROUTE ]
// ==================================================

async function handleAdminRoute(env, url, headers, request) {
    const auth = await requireAdmin(env, request);
    if (auth) {
        const { compras } = await getCompras(env, 10000, 0);
        const ingresosData = calcularIngresosDesdeCompras(compras);

        const stats = await getStats(env) || {};
        const dynamicKeys = await getDynamicKeys(env) || {};
        let allKeys = [];
        for (let k of STATIC_KEYS) {
            const usage = stats.keys_usage?.[k.hash] || { count: 0, blocked: false };
            allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || '∞', uses: usage.count, blocked: usage.blocked, dynamic: false, tags: [], notas: '', un_solo_uso: false });
        }
        for (let hash in dynamicKeys) {
            const k = dynamicKeys[hash];
            const usage = stats.keys_usage?.[hash] || { count: 0, blocked: false };
            allKeys.push({ key: k.key, rango: k.rango, type: k.type, expires: k.expires, maxUses: k.maxUses || '∞', uses: usage.count, blocked: usage.blocked, dynamic: true, tags: k.tags || [], notas: k.notas || '', un_solo_uso: k.un_solo_uso || false });
        }

        const hourlyLabels = [];
        const hourlyData = [];
        if (stats.hourly_usage) {
            const hours = Object.keys(stats.hourly_usage).sort();
            hours.slice(-24).forEach(h => {
                hourlyLabels.push(h.replace('T', ' '));
                hourlyData.push(stats.hourly_usage[h]);
            });
        }

        const dailyLabels = [];
        const dailyValid = [];
        const dailyInvalid = [];
        if (stats.daily_usage) {
            const days = Object.keys(stats.daily_usage).sort().slice(-7);
            days.forEach(d => {
                dailyLabels.push(d);
                dailyValid.push(stats.daily_usage[d].valid || 0);
                dailyInvalid.push(stats.daily_usage[d].invalid || 0);
            });
        }

        
        const resellerLink = `<a href="/admin/resellers" style="background:rgba(255,200,0,0.2);">👥 Revendedores</a>`;
        const userManagerLink = `<a href="/admin/users" style="background:rgba(0,200,255,0.2);">👤 Usuarios</a>`;
        const backupLink = `<button onclick="doBackup()" style="background:rgba(255,100,0,0.3);">💾 Backup</button>`;
        const uploadLink = `<button onclick="openUploadModal()" style="background:rgba(0,200,100,0.3);">📤 Subir CSV</button>`;

        let tableRows = '';
        allKeys.forEach(k => {
            const isBlocked = k.blocked || false;
            const isDynamic = k.dynamic || false;
            const used = k.uses || 0;
            const maxUses = k.maxUses || '∞';
            const statusBadge = isBlocked ? '<span style="color:#ff6666;">🚫 Bloqueada</span>' : '<span style="color:#00cc88;">✅ Activa</span>';
            const deleteBtn = isDynamic ? `<button onclick="action('delete',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#cc0000;">Eliminar</button>` : '';
            const tags = k.tags && k.tags.length ? k.tags.join(', ') : '';
            tableRows += `
                <tr>
                    <td><strong>${escapeHTML(k.key)}</strong></td>
                    <td>${escapeHTML(k.rango)}</td>
                    <td><span style="background:rgba(0,200,255,0.2);padding:2px 10px;border-radius:20px;">${k.type}</span></td>
                    <td>${escapeHTML(k.expires)}</td>
                    <td>${used}${maxUses !== '∞' ? '/'+maxUses : ''}</td>
                    <td>${statusBadge}</td>
                    <td>${isDynamic ? '🎲 Sí' : '📌 No'}</td>
                    <td style="font-size:0.8rem;">${k.un_solo_uso ? '🔒 1 uso' : ''} ${tags}</td>
                    <td style="display:flex;flex-wrap:wrap;gap:4px;">
                        <button onclick="action('block',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#ff4444;">Bloquear</button>
                        <button onclick="action('unblock',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#ff8800;">Desbloquear</button>
                        <button onclick="action('reset',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#ffaa00;">Reiniciar</button>
                        ${deleteBtn}
                        <button onclick="action('unbind',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#8888ff;">Desvincular</button>
                        ${isDynamic ? `<button onclick="action('renew',${escapeJSAttribute(k.key)})" class="btn-sm" style="background:#00cc88;">Renovar +30d</button>` : ''}
                    </td>
                </tr>
            `;
        });

        const html = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>🌊 Ocean Hub - Admin</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
                    content: "⚡ PANEL DE CONTROL";
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
            <h1>🔐 Panel de Administración <small>Ocean Hub</small>
                <span class="admin-badge">👤 ${escapeHTML(auth.user.email)}</span>
            </h1>

            <div class="stats-grid">
                <div class="stat-box"><div class="num">${stats.total_verifications || 0}</div><div class="label">Total</div></div>
                <div class="stat-box"><div class="num valid">${stats.valid_verifications || 0}</div><div class="label">Válidas</div></div>
                <div class="stat-box"><div class="num invalid">${stats.invalid_verifications || 0}</div><div class="label">Inválidas</div></div>
                <div class="stat-box"><div class="num">${STATIC_KEYS.length}</div><div class="label">Estáticas</div></div>
                <div class="stat-box"><div class="num">${Object.keys(dynamicKeys).length}</div><div class="label">Dinámicas</div></div>
                <div class="stat-box"><div class="num">${Object.values(stats.keys_usage || {}).filter(u => u.count > 0).length}</div><div class="label">Usadas</div></div>
                <div class="stat-box"><div class="num">${stats.sales?.total || 0}</div><div class="label">Ventas</div></div>
                <div class="stat-box"><div class="num">$${(stats.sales?.revenue || 0).toFixed(2)}</div><div class="label">Ingresos totales</div></div>
            </div>

            <div class="ingresos-grid">
                <div class="ingreso-item"><div class="valor">$${ingresosData.dia?.toFixed(2) || '0.00'}</div><div class="etiqueta">Hoy</div></div>
                <div class="ingreso-item"><div class="valor">$${ingresosData.semana?.toFixed(2) || '0.00'}</div><div class="etiqueta">Última semana</div></div>
                <div class="ingreso-item"><div class="valor">$${ingresosData.mes?.toFixed(2) || '0.00'}</div><div class="etiqueta">Último mes</div></div>
                <div class="ingreso-item"><div class="valor">${ingresosData.producto_mas_vendido || 'Ninguno'}</div><div class="etiqueta">Producto más vendido</div></div>
            </div>

            <div class="hud-actions">
                <button onclick="openGenerateModal()">➕ Generar clave</button>
                <button onclick="openBatchModal()">🎲 Lote (5)</button>
                <button onclick="openPruebaModal()">🧪 Generar prueba</button>
                <button onclick="openResellerModal()">👥 Hacer revendedor</button>
                <a href="/export-csv">📥 Exportar CSV</a>
                <a href="/export-json">📥 Exportar JSON</a>
                <a href="/admin/compras" style="background:rgba(255,200,0,0.2);">📊 Ver compras</a>
                <a href="/admin/logs" style="background:rgba(0,200,255,0.2);">📋 Logs</a>
                ${resellerLink}
                ${userManagerLink}
                ${backupLink}
                ${uploadLink}
                <button onclick="location.reload()">🔄 Refrescar</button>
                <a href="/profile" style="background:rgba(0,200,255,0.2);">👤 Mi perfil</a>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Clave</th><th>Rango</th><th>Tipo</th><th>Duración</th><th>Usos</th><th>Estado</th><th>Dinámica</th><th>Tags/Notas</th><th>Acciones</th></tr></thead>
                    <tbody>${tableRows}</tbody>
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
                <h2>🔑 Generar clave</h2>
                <input type="text" id="genKey" placeholder="Clave (dejar vacío para aleatoria)">
                <input type="text" id="genRango" placeholder="Rango personalizado (ej: 🌟 VIP Especial)" value="🦈 Tiburón">
                <select id="genType">
                    <option value="gratuita">Gratuita</option>
                    <option value="premium" selected>Premium</option>
                    <option value="vip">VIP</option>
                    <option value="staff">Staff</option>
                    <option value="prueba">Prueba</option>
                </select>
                <input type="text" id="genExpires" placeholder="Duración (ej: 30 días, 1 año, permanente)" value="30 días">
                <input type="number" id="genMaxUses" placeholder="Límite de usos (infinito si vacío)">
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
                <h2>🎲 Lote de claves</h2>
                <p>Se generarán <strong>5 claves</strong> con tipo <em>premium</em>, rango <em>🦈 Tiburón</em> y duración <em>30 días</em>.</p>
                <input type="password" id="batchPin" placeholder="PIN de seguridad">
                <button onclick="generateBatch()">Generar lote</button>
                <div id="batchResult" style="margin-top:15px;"></div>
            </div>
        </div>

        <!-- Modal PRUEBA -->
        <div class="modal" id="pruebaModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('pruebaModal')">&times;</button>
                <h2>🧪 Generar clave de prueba</h2>
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
                <h2>👥 Hacer revendedor</h2>
                <p>Convierte un usuario existente en revendedor.</p>
                <input type="email" id="resellerEmail" placeholder="Email del usuario" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <input type="number" id="resellerPorcentaje" placeholder="% de comisión (ej: 25)" value="25" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <input type="password" id="resellerPin" placeholder="PIN de seguridad" style="width:100%;padding:10px;border-radius:10px;border:none;margin:8px 0;">
                <button onclick="hacerReseller()">Convertir</button>
                <div id="resellerResult" style="margin-top:12px;"></div>
            </div>
        </div>

        <!-- Modal SUBIR CSV -->
        <div class="modal" id="uploadModal">
            <div class="modal-content">
                <button class="close" onclick="closeModal('uploadModal')">&times;</button>
                <h2>📤 Subir archivo CSV</h2>
                <p>Sube un CSV con una lista de claves (una por línea).</p>
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
                    const days = prompt('¿Cuántos días renovar? (30 por defecto)', '30');
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
                const rango = document.getElementById('genRango').value.trim() || '🦈 Tiburón';
                const type = document.getElementById('genType').value;
                const expires = document.getElementById('genExpires').value.trim() || '30 días';
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
                        document.getElementById('genResult').innerHTML = '❌ ' + data.error;
                    } else {
                        document.getElementById('genResult').innerHTML = '✅ ' + data.message;
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
                        document.getElementById('batchResult').innerHTML = '❌ ' + data.error;
                    } else if (data.keys && data.keys.length > 0) {
                        let html = '<div class="batch-keys">';
                        data.keys.forEach(k => { html += '<span>🔑 ' + k + '</span>'; });
                        html += '</div><p style="color:#88ddff;">✅ ' + data.keys.length + ' claves generadas.</p>';
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
                        document.getElementById('pruebaResult').innerHTML = '❌ ' + data.error;
                    } else {
                        document.getElementById('pruebaResult').innerHTML = '✅ Clave de prueba: <code>' + data.key + '</code> (' + data.horas + 'h)';
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
                        document.getElementById('resellerResult').innerHTML = '❌ ' + data.error;
                    } else {
                        document.getElementById('resellerResult').innerHTML = '✅ ' + data.message;
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
                if (confirm('¿Realizar backup del KV? Esto puede tomar unos segundos.')) {
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
                        { label: 'Válidas', data: dailyValid, backgroundColor: 'rgba(0,204,136,0.6)', borderColor: '#00cc88', borderWidth: 1 },
                        { label: 'Inválidas', data: dailyInvalid, backgroundColor: 'rgba(255,68,68,0.6)', borderColor: '#ff4444', borderWidth: 1 }
                    ]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
            });
        </script>
        ${getCookieBannerScript()}
        </body>
        </html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('⛔ No autorizado', { status: 403 });

}

// ==================================================
// [ HANDLERS ADMIN USUARIOS, BACKUP, UPLOAD, OAUTH ]
// ==================================================

async function handleAdminUsers(env, url, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return new Response('No autorizado', { status: 403 });

    const users = await getAllUsers(env);
    let rows = users.map(u => `
        <tr>
            <td>${escapeHTML(u.email)}</td>
            <td>${escapeHTML(u.name || '')}</td>
            <td>${escapeHTML(u.role)}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>${u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca'}</td>
            <td>${u.points || 0}</td>
            <td>
                <select onchange="cambiarRol(${escapeJSAttribute(u.email)}, this.value)">
                    <option value="user" ${u.role==='user'?'selected':''}>User</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                    <option value="reseller" ${u.role==='reseller'?'selected':''}>Reseller</option>
                </select>
                <button onclick="eliminarUsuario(${escapeJSAttribute(u.email)})">🗑️</button>
            </td>
        </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>👤 Gestión de Usuarios</title>
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
    <h1>👤 Gestión de Usuarios</h1>
    <div style="overflow-x:auto;">
        <table>
            <thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Registro</th><th>Último login</th><th>Puntos</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    <a href="/admin" class="back">← Volver al panel</a>
    <script>
        
        function cambiarRol(email, newRole) {
            if (!confirm('¿Cambiar rol de '+email+' a '+newRole+'?')) return;
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
            if (!confirm('¿Eliminar usuario '+email+'? Esta acción no se puede deshacer.')) return;
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
    </script>
    ${getCookieBannerScript()}
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleAdminUserAction(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const { email, action, role, pin } = body;
    if (!email) return jsonResponse({ error: 'Falta email' }, 400);

    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) return jsonResponse({ error: 'PIN incorrecto' }, 403);

    const user = await getUserByEmail(env, email);
    if (!user) return jsonResponse({ error: 'Usuario no encontrado' }, 404);

    if (action === 'role') {
        if (!role) return jsonResponse({ error: 'Falta rol' }, 400);
        user.role = role;
        await env.STATS.put(`user_${email}`, JSON.stringify(user));
        await logAdminAction(env, 'change_role', email, getClientIP(request), { newRole: role });
        return jsonResponse({ message: `Rol de ${email} actualizado a ${role}` });
    } else if (action === 'delete') {
        await env.STATS.delete(`user_${email}`);
        await logAdminAction(env, 'delete_user', email, getClientIP(request), {});
        return jsonResponse({ message: `Usuario ${email} eliminado` });
    } else {
        return jsonResponse({ error: 'Acción no válida' }, 400);
    }
}

async function getAllUsers(env) {
    const users = [];
    let cursor;
    do {
        const page = await env.STATS.list({ prefix: 'user_', cursor, limit: 1000 });
        for (let i = 0; i < page.keys.length; i += 50) {
            const batch = page.keys.slice(i, i + 50);
            const values = await Promise.all(batch.map(k => env.STATS.get(k.name)));
            for (const raw of values) {
                if (!raw) continue;
                try { users.push(JSON.parse(raw)); } catch (e) { console.error('Usuario KV inválido:', e); }
            }
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return users;
}

async function handleBackup(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const backup = await backupKV(env);
    return jsonResponse({ message: 'Backup realizado con éxito', keys: Object.keys(backup).length });
}

async function handleUploadKeys(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const formData = await request.formData();
    const file = formData.get('file');
    const pin = formData.get('pin');
    const adminPin = env.ADMIN_SECOND_PIN;
    if (!adminPin || !timingSafeCompare(String(pin || ''), String(adminPin))) return jsonResponse({ error: 'PIN incorrecto' }, 403);
    if (!file) return jsonResponse({ error: 'No se subió ningún archivo' }, 400);

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    let generated = 0;
    for (const line of lines) {
        const key = line.trim();
        if (!key) continue;
        const hash = await hashKey(key);
        const dyn = await getDynamicKeys(env);
        if (!dyn[hash] && !STATIC_KEYS.some(k => k.hash === hash)) {
            const keyData = {
                key, type: 'premium', rango: '📤 Subido', expires: '30 días',
                dynamic: true, created_at: new Date().toISOString(),
                blocked: false, count: 0, history: [], tags: ['csv'],
                notas: 'Subido por CSV', un_solo_uso: false,
                change_log: [{ action: 'created_from_csv', timestamp: new Date().toISOString() }]
            };
            await saveDynamicKey(env, keyData);
            generated++;
        }
    }
    await logAdminAction(env, 'upload_csv', 'batch', getClientIP(request), { count: generated });
    return jsonResponse({ message: `${generated} claves generadas desde CSV` });
}

async function handleDiscordAuth(env) {
    const clientId = env.DISCORD_CLIENT_ID;
    if (!clientId) return new Response('Discord OAuth no configurado', { status: 503 });
    const state = await createOAuthState(env, 'discord');
    const redirectUri = `${getBaseUrl(env)}/auth/discord/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify email',
        state
    });
    return new Response(null, {
        status: 302,
        headers: { 'Location': `https://discord.com/oauth2/authorize?${params}`, 'Set-Cookie': buildOAuthStateCookie(state), 'Cache-Control': 'no-store' }
    });
}

async function handleDiscordCallback(env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return new Response('Falta código', { status: 400 });
    if (!(await consumeOAuthState(env, request, 'discord'))) {
        return new Response('Solicitud OAuth inválida o expirada. Vuelve a intentarlo.', { status: 400 });
    }

    const clientId = env.DISCORD_CLIENT_ID;
    const clientSecret = env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) return new Response('OAuth no configurado', { status: 400 });

    const redirectUri = `${getBaseUrl(env)}/auth/discord/callback`;

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId, client_secret: clientSecret,
            grant_type: 'authorization_code', code: code, redirect_uri: redirectUri
        })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
        console.error('Discord OAuth token exchange failed:', tokenRes.status, tokenData?.error);
        return new Response('No se pudo completar el inicio de sesión con Discord.', {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json().catch(() => ({}));
    if (!userRes.ok) {
        console.error('Discord userinfo failed:', userRes.status);
        return new Response('No se pudo obtener la cuenta de Discord.', { status: 400 });
    }
    const email = String(userData.email || '').trim().toLowerCase();
    if (!email || userData.verified !== true) return new Response('El email de Discord debe estar verificado.', { status: 400 });

    let user = await getUserByEmail(env, email);
    if (!user) {
        const randomPass = generateRandomHex(12);
        try {
            user = await createUser(env, email, userData.username || email.split('@')[0], randomPass, null);
        } catch (e) {
            console.error('OAuth user creation failed:', e); return new Response('No se pudo crear la cuenta.', { status: 500 });
        }
    }

    await recordSuccessfulLogin(env, user, request, 'Discord');
    const sessionToken = await createSession(env, user);
    const cookie = buildSessionCookie(sessionToken);
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Sesión iniciada con Discord</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: buildSessionResponseHeaders(cookie, true) });
}

async function handleGoogleAuth(env) {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return new Response('Google OAuth no configurado', { status: 503 });
    const state = await createOAuthState(env, 'google');
    const redirectUri = `${getBaseUrl(env)}/auth/google/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'online',
        prompt: 'select_account'
    });
    return new Response(null, {
        status: 302,
        headers: { 'Location': `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'Set-Cookie': buildOAuthStateCookie(state), 'Cache-Control': 'no-store' }
    });
}

async function handleGoogleCallback(env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return new Response('Falta código', { status: 400 });
    if (!(await consumeOAuthState(env, request, 'google'))) {
        return new Response('Solicitud OAuth inválida o expirada. Vuelve a intentarlo.', { status: 400 });
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return new Response('OAuth no configurado', { status: 400 });

    const redirectUri = `${getBaseUrl(env)}/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId, client_secret: clientSecret, code: code,
            grant_type: 'authorization_code', redirect_uri: redirectUri
        })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
        console.error('Google OAuth token exchange failed:', tokenRes.status, tokenData?.error);
        return new Response('No se pudo completar el inicio de sesión con Google.', {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json().catch(() => ({}));
    if (!userRes.ok) {
        console.error('Google userinfo failed:', userRes.status);
        return new Response('No se pudo obtener la cuenta de Google.', { status: 400 });
    }
    const email = String(userData.email || '').trim().toLowerCase();
    if (!email || userData.verified_email !== true) return new Response('El email de Google debe estar verificado.', { status: 400 });

    let user = await getUserByEmail(env, email);
    if (!user) {
        const randomPass = generateRandomHex(12);
        try {
            user = await createUser(env, email, userData.name || email.split('@')[0], randomPass, null);
        } catch (e) {
            console.error('OAuth user creation failed:', e); return new Response('No se pudo crear la cuenta.', { status: 500 });
        }
    }

    await recordSuccessfulLogin(env, user, request, 'Google');
    const sessionToken = await createSession(env, user);
    const cookie = buildSessionCookie(sessionToken);
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Sesión iniciada con Google</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: buildSessionResponseHeaders(cookie, true) });
}

async function handleReview(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const { productoId, rating, comment } = body;
    if (!productoId || !rating) return jsonResponse({ error: 'Faltan campos' }, 400);
    if (rating < 1 || rating > 5) return jsonResponse({ error: 'Rating debe ser entre 1 y 5' }, 400);

    const key = `review_${productoId}_${auth.user.email}`;
    await env.STATS.put(key, JSON.stringify({
        rating, comment: comment || '',
        date: new Date().toISOString(),
        email: auth.user.email, name: auth.user.name
    }));
    return jsonResponse({ message: 'Review guardada' });
}

async function handleGetReviews(env, url) {
    const productoId = url.searchParams.get('productoId');
    if (!productoId) return jsonResponse({ error: 'Falta productoId' }, 400);
    const list = await env.STATS.list({ prefix: `review_${productoId}_` });
    const reviews = [];
    for (const key of list.keys) {
        const raw = await env.STATS.get(key.name);
        if (raw) reviews.push(JSON.parse(raw));
    }
    const avg = reviews.length ? reviews.reduce((s,r) => s + r.rating, 0) / reviews.length : 0;
    return jsonResponse({ reviews, average: avg, count: reviews.length });
}

async function handleRegisterWebhook(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const { url } = body || {};
    if (!url) return jsonResponse({ error: 'Falta URL' }, 400);
    if (typeof url !== 'string' || url.length > 2048 || !isSafeWebhookUrl(url)) {
        return jsonResponse({ error: 'La URL debe ser HTTPS pública, sin credenciales ni puertos no estándar.' }, 400);
    }
    await env.STATS.put(`webhook_${auth.user.email}`, JSON.stringify({ url: new URL(url).href, created: new Date().toISOString() }));
    return jsonResponse({ message: 'Webhook registrado' });
}

async function handleActivate2FA(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const secret = generateTOTPSecret();
    const otpauth = buildOTPAuthURI(secret, auth.user.email, 'Ocean Hub');
    auth.user.otp_secret = secret;
    await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
    return jsonResponse({ message: '2FA activado. Escanea el QR o usa el secreto manualmente.', secret, otpauth, qrUrl });
}

async function handleUser2FAQR(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return new Response('No autorizado', { status: 401 });
    const secret = String(auth.user.otp_secret || '').trim().replace(/=+$/,'').toUpperCase();
    if (!/^[A-Z2-7]{16,128}$/.test(secret)) return new Response('2FA no configurado', { status: 400 });
    const otpauth = buildOTPAuthURI(secret, auth.user.email, 'Ocean Hub');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauth)}`;
    return new Response(`<!doctype html><html><body style="background:#0a1a2b;color:white;font-family:Segoe UI,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;text-align:center;padding:20px">
        <h2 style="color:#00ccff">📱 Configurar 2FA</h2>
        <img src="${escapeHTML(qrUrl)}" alt="QR 2FA" style="width:300px;height:300px;border-radius:16px;background:white;padding:8px">
        <p>Escanea el QR con Google Authenticator, Authy u otra app TOTP.</p>
        <p><strong>Secreto:</strong> <code>${escapeHTML(secret)}</code></p>
        <p style="max-width:650px;word-break:break-all;color:#88aacc"><strong>URI:</strong> ${escapeHTML(otpauth)}</p>
        <a href="/profile" style="color:#00ccff">← Volver al perfil</a>
    </body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleDeactivate2FA(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    auth.user.otp_secret = null;
    await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
    return jsonResponse({ message: '2FA desactivado' });
}

async function handleRedeemPoints(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    const { points } = body;
    if (!points || points < 0) return jsonResponse({ error: 'Puntos inválidos' }, 400);
    if (auth.user.points < points) return jsonResponse({ error: 'Puntos insuficientes' }, 400);

    auth.user.points -= points;
    await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
    return jsonResponse({ message: `Canjeados ${points} puntos. Saldo restante: ${auth.user.points}` });
}

async function handlePayPalWebhook(env, request) {
    if (request.method !== 'POST') return jsonResponse({ error:'Método no permitido' },405);
    if (!env.PAYPAL_WEBHOOK_ID) return jsonResponse({ error:'Webhook no configurado' },503);
    const raw = await request.text();
    let body; try { body = JSON.parse(raw); } catch { return jsonResponse({error:'JSON inválido'},400); }
    const accessToken = await getPayPalAccessToken(env);
    const verifyPayload = {
        auth_algo: request.headers.get('PAYPAL-AUTH-ALGO'),
        cert_url: request.headers.get('PAYPAL-CERT-URL'),
        transmission_id: request.headers.get('PAYPAL-TRANSMISSION-ID'),
        transmission_sig: request.headers.get('PAYPAL-TRANSMISSION-SIG'),
        transmission_time: request.headers.get('PAYPAL-TRANSMISSION-TIME'),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: body
    };
    if (Object.values(verifyPayload).some(v => !v)) return jsonResponse({error:'Firma incompleta'},400);
    const vr = await fetch(`${getPayPalApiUrl(env)}/v1/notifications/verify-webhook-signature`, {
        method:'POST', headers:{'Authorization':`Bearer ${accessToken}`,'Content-Type':'application/json'},
        body:JSON.stringify(verifyPayload)
    });
    const vd = await vr.json();
    if (!vr.ok || vd.verification_status !== 'SUCCESS') return jsonResponse({error:'Firma no válida'},403);
    if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = body.resource?.supplementary_data?.related_ids?.order_id;
        if (!orderId) return jsonResponse({ error: 'orderId ausente en el evento de PayPal' }, 400);
        try {
            // The webhook describes an already-completed capture. Fetch the order details;
            // do not attempt to capture the same order a second time.
            const orderData = await getPayPalOrderData(env, orderId);
            if (orderData?.status !== 'COMPLETED') {
                return jsonResponse({ error: 'La orden todavía no está completada' }, 409);
            }
            return await handlePayPalCapture(
                env,
                new Request(`${getBaseUrl(env)}/paypal/capture?orderId=${encodeURIComponent(orderId)}`),
                orderData
            );
        } catch (error) {
            console.error('PayPal webhook fulfillment failed:', error?.message || error);
            return jsonResponse({ error: 'No se pudo procesar el evento de PayPal' }, 502);
        }
    }
    return jsonResponse({status:'ok'});
}

async function handleLeaderboard(env) {
    const data = await env.STATS.get('leaderboard', 'json') || [];
    let html = `<html><head><meta charset="UTF-8"><title>🏆 Ranking</title>
    <style>body{background:#0a1a2b;color:white;font-family:monospace;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{padding:10px;border-bottom:1px solid #333;}</style>
    </head><body><h1 style="color:#ffcc00;">🏆 Ranking de usuarios</h1><table><thead><tr><th>#</th><th>Usuario</th><th>Puntuación</th></tr></thead><tbody>`;
    data.forEach((u, i) => {
        html += `<tr><td>${i+1}</td><td>${escapeHTML(u.name || u.email)}</td><td>${u.score}</td></tr>`;
    });
    html += `</tbody></table><a href="/home" style="color:#00ccff;">← Volver</a>${getCookieBannerScript()}${getLegalFooter()}</body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleToggleDarkMode(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const body = await request.json();
    auth.user.dark_mode = body.dark || false;
    await env.STATS.put(`user_${auth.user.email}`, JSON.stringify(auth.user));
    return jsonResponse({ message: 'Preferencia guardada' });
}

// ==================================================
// [ PÁGINA DE BIENVENIDA / GATE - COMPLETA ]
// ==================================================
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
<title>🌊 Ocean Hub</title>
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
        animation: oceanGlow 3s ease-in-out infinite;
    }
    #welcomeContent .subtitle { animation: fadeUp .8s .15s both; }
    .terms-box { animation: fadeUp .8s .25s both; }
    .checkbox-container { animation: fadeUp .8s .35s both; }
    .buttons .btn { animation: buttonFloat .8s .45s both; }
    .buttons .btn:nth-child(2) { animation-delay:.55s; }
    @keyframes oceanGlow {
        0%,100% { transform:translateY(0); filter:drop-shadow(0 0 0 rgba(0,204,255,0)); }
        50% { transform:translateY(-4px); filter:drop-shadow(0 0 18px rgba(0,204,255,.35)); }
    }
    @keyframes buttonFloat {
        from { opacity:0; transform:translateY(18px) scale(.97); }
        to { opacity:1; transform:translateY(0) scale(1); }
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
        <h1>🌊 Ocean Hub</h1>
        <p class="loading-dots">Sumergiéndonos en el océano</p>
    </div>

    <div id="welcomeContent">
        <h1>🌊 Ocean Hub</h1>
        <p class="subtitle">Tu portal de DLCs y claves premium</p>

        <div class="terms-box">
            <strong style="color:#00ccff;">📜 Antes de continuar, lee y acepta:</strong>
            <p style="margin-top:10px;">
                Al usar <strong>Ocean Hub</strong> declaras haber leído y aceptado nuestros
                <a href="/terminos" target="_blank">Términos y Condiciones</a>,
                la <a href="/privacidad" target="_blank">Política de Privacidad</a>,
                el <a href="/aviso-legal" target="_blank">Aviso Legal</a>
                y la <a href="/cookies" target="_blank">Política de Cookies</a>.
            </p>
            <p style="margin-top:8px;">
                Confirmas que eres mayor de edad o cuentas con autorización legal, y que
                usarás el servicio de forma lícita y responsable. Todos los productos son
                bienes digitales con entrega inmediata y no reembolsables salvo error
                comprobado.
            </p>
            <p style="margin-top:8px;">
                🔒 Tus datos se tratan conforme al RGPD. Puedes ejercer tus derechos
                escribiendo a nuestro correo de contacto.
            </p>
        </div>

        <label class="checkbox-container">
            <input type="checkbox" id="acceptTerms" onchange="toggleButtons()">
            <span>He leído y acepto los términos, políticas y condiciones de Ocean Hub.</span>
        </label>

        <div class="buttons">
            <a href="/login" class="btn btn-primary disabled" id="loginBtn"
               onclick="return checkAccepted(event)">🔐 Iniciar sesión</a>
            <a href="/register" class="btn btn-secondary disabled" id="registerBtn"
               onclick="return checkAccepted(event)">✨ Crear cuenta</a>
        </div>

        <p class="footer-note">🔒 Debes iniciar sesión para acceder al contenido de Ocean Hub</p>
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
                alert('⚠️ Debes aceptar los términos y políticas antes de continuar.');
                return false;
            }
            return true;
        }
    </script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================================================
// [ SUSCRIPCIONES ]
// ==================================================

async function handleSubscribe(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) {
        return new Response(`
            <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;">
                <div style="text-align:center;">
                    <h2 style="color:#ff6666;">🔒 Necesitas iniciar sesión</h2>
                    <a href="/login" style="color:#00ccff;">Iniciar sesión</a>
                </div>
            </body></html>
        `, { status: 401, headers: { 'Content-Type': 'text/html' } });
    }

    let planesHtml = '';
    for (const [id, plan] of Object.entries(SUSCRIPCION_PLANES)) {
        planesHtml += `
            <div class="plan-card">
                <h3>${escapeHTML(plan.name)}</h3>
                <p>${escapeHTML(plan.description)}</p>
                <p>Duración: ${plan.days} días</p>
                <div class="price">$${plan.price.toFixed(2)}</div>
                <button onclick="comprarSuscripcion('${id}')" class="btn-buy">Suscribirse</button>
            </div>
        `;
    }

    return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>📅 Suscripción - Ocean Hub</title>
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
        <h1>📅 Planes de Suscripción</h1>
        <div class="plan-grid">${planesHtml}</div>
        <a href="/profile" class="back">← Volver a mi perfil</a>
    </div>
    <script>
        function comprarSuscripcion(plan) {
            const email = ${JSON.stringify(auth.user.email)};
            fetch('/shop/create-checkout?tipo=suscripcion&plan=' + plan + '&email=' + encodeURIComponent(email))
                .then(res => res.json())
                .then(data => {
                    if (data.links && data.links.length) {
                        const approveLink = data.links.find(link => link.rel === 'approve');
                        if (approveLink) {
                            window.location.href = approveLink.href;
                        } else {
                            alert('Error: no se encontró enlace de aprobación.');
                        }
                    } else {
                        alert('Error al crear la orden: ' + (data.error || 'desconocido'));
                    }
                })
                .catch(err => alert('Error: ' + err));
        }
    </script>
    ${getCookieBannerScript()}
    ${getLegalFooter()}
    </body>
    </html>
    `, { headers: { 'Content-Type': 'text/html' } });
}

async function handlePaySubscription(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const url = new URL(request.url);
    const plan = url.searchParams.get('plan');
    if (!plan) return jsonResponse({ error: 'Falta el plan' }, 400);
    // Never trust a client-supplied email for payment entitlement assignment.
    try {
        const order = await createPayPalOrderSuscripcion(env, plan, auth.user.email);
        return jsonResponse(order);
    } catch (e) {
        console.error('Subscription checkout creation failed:', e?.message || e);
        return jsonResponse({ error: 'No se pudo crear la orden de pago' }, 502);
    }
}

async function handleCronJobs(env, request) {
    if (!request || request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    await updateLeaderboard(env);
    if (!env.R2) {
        return jsonResponse({
            error: 'Ranking actualizado, pero el backup no se guardó: falta configurar el binding R2.',
            code: 'R2_NOT_CONFIGURED'
        }, 503);
    }
    await backupKV(env);
    return jsonResponse({ message: 'Ranking actualizado y backup guardado' });
}

// ==================================================
// [ GATE DE AUTENTICACIÓN ]
// ==================================================

function isPublicRoute(path) {
    const publicPaths = [
        '/welcome',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-2fa',
        '/logout',
        '/privacidad',
        '/aviso-legal',
        '/terminos',
        '/cookies',
        '/status',
        '/stats/public',
        '/get-nonce',
        '/verify-web',
        '/claim-key',
        '/paypal/capture',
        '/paypal/webhook',
        '/shop/success',
        '/shop/cancel',
        '/google53213708c5fda63c.html',
        '/air-flow/app.js',
    ];
    if (publicPaths.includes(path)) return true;

    if (path.startsWith('/verify/')) return true;
    if (path.startsWith('/auth/')) return true;
    if (path.startsWith('/s/')) return true;
    if (path.startsWith('/Profile/') || path.startsWith('/profile/') || path.startsWith('/u/')) return true;
    return false;
}

// ==================================================
// [ MANEJADOR PRINCIPAL ]
// ==================================================

// ==================================================
// [ 👥 SOCIAL — PERFILES / VERIFICACIÓN / AMIGOS / BLOQUEO / DM ]
// ==================================================

const SOCIAL_MAX_FRIENDS = 200;
const SOCIAL_MAX_BLOCKS = 200;
const SOCIAL_MAX_DM_MESSAGES = 200;
const SOCIAL_MAX_DM_THREADS = 50;
const SOCIAL_DM_MAX_LEN = 2000;

function socialSlugify(raw) {
    let s = String(raw || 'user').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
    if (!s || /^\d+$/.test(s)) s = 'user' + s;
    if (!/^[a-zA-Z]/.test(s)) s = 'u' + s;
    return s.slice(0, 24) || 'user';
}

async function socialEnsureUniqueUsername(env, baseName) {
    let base = socialSlugify(baseName);
    for (let i = 0; i < 30; i++) {
        const candidate = i === 0 ? base : `${base.slice(0, 18)}${i}`;
        const taken = await env.STATS.get(`username_${candidate.toLowerCase()}`);
        if (!taken) return candidate;
    }
    return socialSlugify(base + generateRandomHex(4));
}

async function socialGetUserByUsername(env, username) {
    const slug = socialSlugify(username);
    if (!slug) return null;
    const email = await env.STATS.get(`username_${slug.toLowerCase()}`);
    if (email) return await getUserByEmail(env, email);
    const list = await env.STATS.get('user_list', 'json') || [];
    const want = String(username || '').trim().toLowerCase();
    for (const em of list.slice(0, 5000)) {
        const u = await getUserByEmail(env, em);
        if (!u) continue;
        if (String(u.username || '').toLowerCase() === want) return u;
        if (!u.username && String(u.name || '').toLowerCase() === want) {
            const un = await socialEnsureUniqueUsername(env, u.name || em.split('@')[0]);
            u.username = un;
            if (typeof u.verified !== 'boolean') u.verified = false;
            await env.STATS.put(`user_${u.email}`, JSON.stringify(u));
            await env.STATS.put(`username_${un.toLowerCase()}`, u.email);
            return u;
        }
    }
    return null;
}

async function socialEnsureUserMeta(env, user) {
    if (!user) return null;
    let changed = false;
    if (!user.username) {
        user.username = await socialEnsureUniqueUsername(env, user.name || user.email?.split('@')[0] || 'user');
        await env.STATS.put(`username_${user.username.toLowerCase()}`, user.email);
        changed = true;
    }
    if (typeof user.verified !== 'boolean') { user.verified = false; changed = true; }
    if (typeof user.bio !== 'string') { user.bio = ''; changed = true; }
    if (!user.avatar_emoji) { user.avatar_emoji = '👤'; changed = true; }
    if (changed) await env.STATS.put(`user_${user.email}`, JSON.stringify(user));
    return user;
}

async function socialSaveUser(env, user) {
    await env.STATS.put(`user_${user.email}`, JSON.stringify(user));
    if (user.username) await env.STATS.put(`username_${String(user.username).toLowerCase()}`, user.email);
}

function socialPublicUser(user) {
    if (!user) return null;
    return {
        username: user.username || socialSlugify(user.name || 'user'),
        name: user.name || user.username || 'Usuario',
        verified: !!user.verified,
        bio: String(user.bio || '').slice(0, 280),
        avatar_emoji: user.avatar_emoji || '👤',
        created_at: user.created_at || null,
        role: user.role === 'admin' ? 'admin' : 'user'
    };
}

async function socialGetFriends(env, email) {
    return await env.STATS.get(`friends_${String(email).toLowerCase()}`, 'json') || { outgoing: [], incoming: [], accepted: [] };
}

async function socialSaveFriends(env, email, data) {
    const clean = {
        outgoing: Array.isArray(data.outgoing) ? [...new Set(data.outgoing)].slice(0, SOCIAL_MAX_FRIENDS) : [],
        incoming: Array.isArray(data.incoming) ? [...new Set(data.incoming)].slice(0, SOCIAL_MAX_FRIENDS) : [],
        accepted: Array.isArray(data.accepted) ? [...new Set(data.accepted)].slice(0, SOCIAL_MAX_FRIENDS) : []
    };
    await env.STATS.put(`friends_${String(email).toLowerCase()}`, JSON.stringify(clean));
    return clean;
}

async function socialGetBlocks(env, email) {
    return await env.STATS.get(`blocks_${String(email).toLowerCase()}`, 'json') || [];
}

async function socialSaveBlocks(env, email, list) {
    const clean = [...new Set((list || []).map(x => String(x).toLowerCase()))].slice(0, SOCIAL_MAX_BLOCKS);
    await env.STATS.put(`blocks_${String(email).toLowerCase()}`, JSON.stringify(clean));
    return clean;
}

async function socialIsBlockedEither(env, a, b) {
    const ea = String(a).toLowerCase();
    const eb = String(b).toLowerCase();
    const ba = await socialGetBlocks(env, ea);
    const bb = await socialGetBlocks(env, eb);
    return ba.includes(eb) || bb.includes(ea);
}

async function socialAreFriends(env, a, b) {
    const fa = await socialGetFriends(env, a);
    return (fa.accepted || []).includes(String(b).toLowerCase());
}

function socialDmKey(emailA, emailB) {
    const pair = [String(emailA).toLowerCase(), String(emailB).toLowerCase()].sort();
    return `dm_${pair[0]}__${pair[1]}`;
}

async function socialGetDmThread(env, emailA, emailB) {
    return await env.STATS.get(socialDmKey(emailA, emailB), 'json') || { messages: [] };
}

async function socialSaveDmThread(env, emailA, emailB, thread) {
    const messages = Array.isArray(thread.messages) ? thread.messages.slice(-SOCIAL_MAX_DM_MESSAGES) : [];
    await env.STATS.put(socialDmKey(emailA, emailB), JSON.stringify({ messages, updated_at: new Date().toISOString() }));
}

async function socialTouchInbox(env, ownerEmail, peerEmail, lastText) {
    const key = `dm_inbox_${String(ownerEmail).toLowerCase()}`;
    const inbox = await env.STATS.get(key, 'json') || [];
    const peer = String(peerEmail).toLowerCase();
    const next = [{ peer, last: String(lastText || '').slice(0, 120), at: new Date().toISOString() }, ...inbox.filter(x => x.peer !== peer)].slice(0, SOCIAL_MAX_DM_THREADS);
    await env.STATS.put(key, JSON.stringify(next));
}


async function handleAdminVerifyUser(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const target = String(body?.username || body?.email || '').trim();
    if (!target) return jsonResponse({ error: 'Indica username o email' }, 400);
    let user = target.includes('@') ? await getUserByEmail(env, target.toLowerCase()) : await socialGetUserByUsername(env, target);
    if (!user) return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    user = await socialEnsureUserMeta(env, user);
    const verified = body?.verified === false || body?.verified === 'false' || body?.action === 'unverify' ? false : true;
    user.verified = verified;
    await socialSaveUser(env, user);
    return jsonResponse({ ok: true, username: user.username, email: user.email, verified: user.verified, profile: `/Profile/${user.username}` });
}

async function handlePublicProfile(env, request, usernameParam) {
    const user = await socialGetUserByUsername(env, usernameParam);
    if (!user) {
        return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Perfil no encontrado</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06111f;color:#ecf6ff;font-family:system-ui,sans-serif}a{color:#4cc8ff}</style></head>
<body><div style="text-align:center"><h1>🌊 404</h1><p>No existe el perfil <b>@${escapeHTML(String(usernameParam||''))}</b></p><a href="/">Inicio</a></div></body></html>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const u = await socialEnsureUserMeta(env, user);
    const pub = socialPublicUser(u);
    const viewer = await requireAuth(env, request);
    let relation = 'none';
    let blocked = false;
    if (viewer) {
        const me = await socialEnsureUserMeta(env, viewer.user);
        if (me.email === u.email) relation = 'self';
        else {
            blocked = await socialIsBlockedEither(env, me.email, u.email);
            const fr = await socialGetFriends(env, me.email);
            if (fr.accepted.includes(u.email.toLowerCase())) relation = 'friends';
            else if (fr.outgoing.includes(u.email.toLowerCase())) relation = 'outgoing';
            else if (fr.incoming.includes(u.email.toLowerCase())) relation = 'incoming';
        }
    }
    const badge = pub.verified ? '<span title="Verificado" style="color:#1da1f2;font-size:22px;vertical-align:middle">✔</span>' : '';
    const adminBadge = pub.role === 'admin' ? '<span style="background:#ffb020;color:#1a1000;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:6px">ADMIN</span>' : '';
    let actions = '';
    if (relation === 'self') {
        actions = `<a class="btn" href="/profile/edit">Editar mi perfil</a><a class="btn secondary" href="/messages">Mensajes</a><a class="btn secondary" href="/friends">Amigos</a>`;
    } else if (viewer && !blocked) {
        if (relation === 'friends') actions = `<a class="btn" href="/messages/${encodeURIComponent(pub.username)}">💬 Chat privado</a><button class="btn danger" data-act="unfriend">Eliminar amigo</button><button class="btn danger" data-act="block">Bloquear</button>`;
        else if (relation === 'outgoing') actions = `<button class="btn secondary" disabled>Solicitud enviada</button><button class="btn danger" data-act="cancel">Cancelar solicitud</button>`;
        else if (relation === 'incoming') actions = `<button class="btn" data-act="accept">Aceptar solicitud</button><button class="btn danger" data-act="reject">Rechazar</button>`;
        else actions = `<button class="btn" data-act="request">＋ Solicitud de amistad</button><button class="btn danger" data-act="block">Bloquear</button>`;
    } else if (viewer && blocked) {
        actions = `<p style="color:#ff8a9a">No puedes interactuar con este usuario.</p><button class="btn" data-act="unblock">Desbloquear</button>`;
    } else {
        actions = `<a class="btn" href="/login">Inicia sesión para interactuar</a>`;
    }

    const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(pub.name)} (@${escapeHTML(pub.username)}) — Ocean Hub</title>
<style>
:root{--bg:#06111f;--card:rgba(9,25,42,.92);--line:rgba(119,190,255,.18);--text:#ecf6ff;--muted:#8ea9c2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,rgba(0,160,255,.16),transparent 40%),#06111f;color:var(--text);font-family:Inter,system-ui,sans-serif}
.wrap{max-width:560px;margin:0 auto;padding:28px 16px 60px}
.card{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.avatar{width:84px;height:84px;border-radius:24px;background:linear-gradient(145deg,#0bbaff,#0b61ff);display:grid;place-items:center;font-size:40px;margin:0 auto 14px}
h1{margin:0;font-size:26px;text-align:center}
.user{text-align:center;color:var(--muted);margin:6px 0 14px;font-size:14px}
.bio{text-align:center;color:#cfe6f8;font-size:14px;line-height:1.5;margin:0 0 18px}
.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.btn{appearance:none;border:1px solid rgba(80,180,255,.35);background:linear-gradient(145deg,#0b7dff,#0a4db8);color:#fff;border-radius:12px;padding:10px 14px;font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.btn.secondary{background:rgba(8,30,50,.8)}.btn.danger{background:rgba(80,20,40,.85);border-color:rgba(255,100,130,.35)}
.meta{text-align:center;color:var(--muted);font-size:12px;margin-top:18px}
a.top{color:#7ecbff;text-decoration:none;font-size:13px}
</style></head><body>
<div class="wrap">
  <p><a class="top" href="/home">← Ocean Hub</a></p>
  <div class="card">
    <div class="avatar">${escapeHTML(pub.avatar_emoji)}</div>
    <h1>${escapeHTML(pub.name)} ${badge}${adminBadge}</h1>
    <div class="user">@${escapeHTML(pub.username)}</div>
    <p class="bio">${escapeHTML(pub.bio || 'Sin biografía todavía.')}</p>
    <div class="actions" id="actions">${actions}</div>
    <div class="meta">Miembro desde ${escapeHTML(String(pub.created_at||'').slice(0,10) || '—')}</div>
  </div>
</div>
<script>
(function(){
  var un=${JSON.stringify(pub.username)};
  async function api(url, body){
    var res = await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    var data = await res.json().catch(function(){return {}});
    if(!res.ok) throw new Error(data.error||('HTTP '+res.status));
    return data;
  }
  document.getElementById('actions').addEventListener('click', async function(e){
    var btn = e.target.closest('[data-act]'); if(!btn) return;
    var act = btn.dataset.act; btn.disabled = true;
    try{
      if(act==='request') await api('/friends/request',{username:un});
      else if(act==='accept') await api('/friends/accept',{username:un});
      else if(act==='reject'||act==='cancel') await api('/friends/reject',{username:un});
      else if(act==='unfriend') await api('/friends/remove',{username:un});
      else if(act==='block') await api('/block',{username:un});
      else if(act==='unblock') await api('/unblock',{username:un});
      location.reload();
    }catch(err){ alert(err.message||'Error'); btn.disabled=false; }
  });
})();
</script>
</body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleFriendsApi(env, request, action) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const me = await socialEnsureUserMeta(env, auth.user);
    if (request.method === 'GET' || action === 'list') {
        const fr = await socialGetFriends(env, me.email);
        async function mapList(emails) {
            const out = [];
            for (const em of (emails || []).slice(0, 100)) {
                const u = await getUserByEmail(env, em);
                if (u) out.push(socialPublicUser(await socialEnsureUserMeta(env, u)));
            }
            return out;
        }
        return jsonResponse({
            me: socialPublicUser(me),
            accepted: await mapList(fr.accepted),
            outgoing: await mapList(fr.outgoing),
            incoming: await mapList(fr.incoming)
        });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const targetUser = await socialGetUserByUsername(env, body?.username || body?.user || '');
    if (!targetUser) return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    const other = await socialEnsureUserMeta(env, targetUser);
    if (other.email === me.email) return jsonResponse({ error: 'No puedes hacer eso contigo mismo' }, 400);
    if (await socialIsBlockedEither(env, me.email, other.email)) return jsonResponse({ error: 'Acción bloqueada entre estos usuarios' }, 403);

    const myFr = await socialGetFriends(env, me.email);
    const otFr = await socialGetFriends(env, other.email);
    const meE = me.email.toLowerCase();
    const otE = other.email.toLowerCase();

    if (action === 'request') {
        if (myFr.accepted.includes(otE)) return jsonResponse({ error: 'Ya sois amigos' }, 400);
        if (myFr.outgoing.includes(otE)) return jsonResponse({ ok: true, status: 'already_sent' });
        if (myFr.incoming.includes(otE)) {
            myFr.incoming = myFr.incoming.filter(x => x !== otE);
            otFr.outgoing = otFr.outgoing.filter(x => x !== meE);
            myFr.accepted.push(otE);
            otFr.accepted.push(meE);
            await socialSaveFriends(env, me.email, myFr);
            await socialSaveFriends(env, other.email, otFr);
            return jsonResponse({ ok: true, status: 'accepted' });
        }
        myFr.outgoing.push(otE);
        otFr.incoming.push(meE);
        await socialSaveFriends(env, me.email, myFr);
        await socialSaveFriends(env, other.email, otFr);
        try {
            await socialPushNotif(env, other.email, {
                type: 'friend_request',
                title: 'Nueva solicitud de amistad',
                body: `@${me.username} quiere ser tu amigo`,
                from_username: me.username,
                href: '/friends'
            });
        } catch (_) {}
        return jsonResponse({ ok: true, status: 'sent' });
    }
    if (action === 'accept') {
        if (!myFr.incoming.includes(otE)) return jsonResponse({ error: 'No hay solicitud pendiente' }, 400);
        myFr.incoming = myFr.incoming.filter(x => x !== otE);
        otFr.outgoing = otFr.outgoing.filter(x => x !== meE);
        if (!myFr.accepted.includes(otE)) myFr.accepted.push(otE);
        if (!otFr.accepted.includes(meE)) otFr.accepted.push(meE);
        await socialSaveFriends(env, me.email, myFr);
        await socialSaveFriends(env, other.email, otFr);
        try {
            await socialPushNotif(env, other.email, {
                type: 'friend_accept',
                title: 'Solicitud aceptada',
                body: `@${me.username} aceptó tu solicitud de amistad`,
                from_username: me.username,
                href: `/messages/${encodeURIComponent(me.username)}`
            });
        } catch (_) {}
        return jsonResponse({ ok: true, status: 'accepted' });
    }
    if (action === 'reject' || action === 'cancel') {
        myFr.incoming = myFr.incoming.filter(x => x !== otE);
        myFr.outgoing = myFr.outgoing.filter(x => x !== otE);
        otFr.incoming = otFr.incoming.filter(x => x !== meE);
        otFr.outgoing = otFr.outgoing.filter(x => x !== meE);
        await socialSaveFriends(env, me.email, myFr);
        await socialSaveFriends(env, other.email, otFr);
        return jsonResponse({ ok: true, status: 'cleared' });
    }
    if (action === 'remove') {
        myFr.accepted = myFr.accepted.filter(x => x !== otE);
        otFr.accepted = otFr.accepted.filter(x => x !== meE);
        await socialSaveFriends(env, me.email, myFr);
        await socialSaveFriends(env, other.email, otFr);
        return jsonResponse({ ok: true, status: 'removed' });
    }
    return jsonResponse({ error: 'Acción desconocida' }, 400);
}

async function handleBlockApi(env, request, action) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const me = await socialEnsureUserMeta(env, auth.user);
    if (request.method === 'GET' || action === 'list') {
        const blocks = await socialGetBlocks(env, me.email);
        const out = [];
        for (const em of blocks.slice(0, 100)) {
            const u = await getUserByEmail(env, em);
            if (u) out.push(socialPublicUser(await socialEnsureUserMeta(env, u)));
        }
        return jsonResponse({ blocks: out });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const targetUser = await socialGetUserByUsername(env, body?.username || '');
    if (!targetUser) return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    const other = await socialEnsureUserMeta(env, targetUser);
    if (other.email === me.email) return jsonResponse({ error: 'No puedes bloquearte a ti mismo' }, 400);
    let blocks = await socialGetBlocks(env, me.email);
    const otE = other.email.toLowerCase();
    if (action === 'block') {
        if (!blocks.includes(otE)) blocks.push(otE);
        const myFr = await socialGetFriends(env, me.email);
        const otFr = await socialGetFriends(env, other.email);
        myFr.accepted = myFr.accepted.filter(x => x !== otE);
        myFr.outgoing = myFr.outgoing.filter(x => x !== otE);
        myFr.incoming = myFr.incoming.filter(x => x !== otE);
        otFr.accepted = otFr.accepted.filter(x => x !== me.email.toLowerCase());
        otFr.outgoing = otFr.outgoing.filter(x => x !== me.email.toLowerCase());
        otFr.incoming = otFr.incoming.filter(x => x !== me.email.toLowerCase());
        await socialSaveFriends(env, me.email, myFr);
        await socialSaveFriends(env, other.email, otFr);
        await socialSaveBlocks(env, me.email, blocks);
        return jsonResponse({ ok: true, blocked: true });
    }
    if (action === 'unblock') {
        blocks = blocks.filter(x => x !== otE);
        await socialSaveBlocks(env, me.email, blocks);
        return jsonResponse({ ok: true, blocked: false });
    }
    return jsonResponse({ error: 'Acción desconocida' }, 400);
}

async function handleMessagesApi(env, request, peerUsername) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const me = await socialEnsureUserMeta(env, auth.user);

    if (!peerUsername) {
        const inbox = await env.STATS.get(`dm_inbox_${me.email.toLowerCase()}`, 'json') || [];
        const threads = [];
        for (const item of inbox.slice(0, SOCIAL_MAX_DM_THREADS)) {
            const u = await getUserByEmail(env, item.peer);
            if (!u) continue;
            const pub = socialPublicUser(await socialEnsureUserMeta(env, u));
            threads.push({ user: pub, last: item.last, at: item.at });
        }
        return jsonResponse({ threads });
    }

    const other = await socialGetUserByUsername(env, peerUsername);
    if (!other) return jsonResponse({ error: 'Usuario no encontrado' }, 404);
    const peer = await socialEnsureUserMeta(env, other);
    if (peer.email === me.email) return jsonResponse({ error: 'No puedes chatear contigo mismo' }, 400);
    if (await socialIsBlockedEither(env, me.email, peer.email)) return jsonResponse({ error: 'No puedes mensajear a este usuario' }, 403);
    if (!(await socialAreFriends(env, me.email, peer.email))) return jsonResponse({ error: 'Solo puedes chatear con amigos. Envía una solicitud primero.' }, 403);

    if (request.method === 'GET') {
        const thread = await socialGetDmThread(env, me.email, peer.email);
        return jsonResponse({
            peer: socialPublicUser(peer),
            messages: (thread.messages || []).map(m => ({
                id: m.id, from: m.from === me.email.toLowerCase() ? 'me' : 'them',
                text: m.text, at: m.at
            }))
        });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    const text = String(body?.text || body?.message || '').trim().slice(0, SOCIAL_DM_MAX_LEN);
    if (!text) return jsonResponse({ error: 'Mensaje vacío' }, 400);
    const thread = await socialGetDmThread(env, me.email, peer.email);
    const msg = { id: crypto.randomUUID(), from: me.email.toLowerCase(), text, at: new Date().toISOString() };
    thread.messages = [...(thread.messages || []), msg];
    await socialSaveDmThread(env, me.email, peer.email, thread);
    await socialTouchInbox(env, me.email, peer.email, text);
    await socialTouchInbox(env, peer.email, me.email, text);
    try {
        await socialPushNotif(env, peer.email, {
            type: 'dm',
            title: `Mensaje de @${me.username}`,
            body: text.slice(0, 100),
            from_username: me.username,
            href: `/messages/${encodeURIComponent(me.username)}`
        });
    } catch (_) {}
    return jsonResponse({ ok: true, message: { id: msg.id, from: 'me', text: msg.text, at: msg.at } });
}

function socialShell(title, bodyHtml, extraScript = '') {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Ocean Hub</title>
<style>
:root{--bg:#06111f;--card:rgba(9,25,42,.92);--line:rgba(119,190,255,.18);--text:#ecf6ff;--muted:#8ea9c2}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 40% 0,rgba(0,150,255,.12),transparent 35%),#06111f;color:var(--text);font-family:Inter,system-ui,sans-serif;min-height:100vh}
.wrap{max-width:720px;margin:0 auto;padding:20px 14px 50px}h1{font-size:22px;margin:0 0 14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:10px}
.row{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}
.user{display:flex;align-items:center;gap:10px}.av{width:40px;height:40px;border-radius:12px;background:linear-gradient(145deg,#0bbaff,#0b61ff);display:grid;place-items:center}
.muted{color:var(--muted);font-size:12px}a{color:#7ecbff}
.btn{border:1px solid rgba(80,180,255,.35);background:#0b6fd6;color:#fff;border-radius:10px;padding:8px 12px;font-size:12px;cursor:pointer;text-decoration:none}
.btn.danger{background:#5a2030}.btn.ghost{background:transparent}
input,textarea{width:100%;background:#081828;border:1px solid var(--line);color:var(--text);border-radius:12px;padding:10px 12px;font:inherit}
.nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;font-size:13px}
.msgs{display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto;padding:8px 0}
.bubble{max-width:80%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.4}
.me{align-self:flex-end;background:#0b5fad}.them{align-self:flex-start;background:#13283f}
.composer{display:flex;gap:8px;margin-top:10px}
</style></head><body><div class="wrap">
<div class="nav"><a href="/home">Inicio</a><a href="/friends">Amigos</a><a href="/messages">Mensajes</a><a href="/notifications">Notificaciones</a><a href="/profile/edit">Editar perfil</a><a href="/profile">Mi perfil</a></div>
${bodyHtml}
</div><script>${extraScript}</script></body></html>`;
}

async function handleFriendsPage(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(new URL('/login', request.url).href, 302);
    const me = await socialEnsureUserMeta(env, auth.user);
    const html = socialShell('Amigos', `
      <h1>👥 Amigos</h1>
      <div class="card"><form id="addForm" class="row"><input id="userInput" placeholder="Nombre de usuario (ej: YoelZorrilla)" required style="flex:1;min-width:180px"><button class="btn" type="submit">Enviar solicitud</button></form>
      <p class="muted" style="margin:8px 0 0">Tu perfil público: <a href="/Profile/${encodeURIComponent(me.username)}">/Profile/${escapeHTML(me.username)}</a></p></div>
      <h2 style="font-size:15px;color:#9ec9e8">Solicitudes recibidas</h2><div id="incoming"></div>
      <h2 style="font-size:15px;color:#9ec9e8">Amigos</h2><div id="accepted"></div>
      <h2 style="font-size:15px;color:#9ec9e8">Enviadas</h2><div id="outgoing"></div>
      <h2 style="font-size:15px;color:#9ec9e8">Bloqueados</h2><div id="blocked"></div>
    `, `
    async function api(url,opts){var r=await fetch(url,Object.assign({credentials:'same-origin'},opts||{}));var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||r.status);return d;}
    function card(u,actions){return '<div class="card row"><div class="user"><div class="av">'+(u.avatar_emoji||'👤')+'</div><div><b>'+u.name+(u.verified?' <span style="color:#1da1f2">✔</span>':'')+'</b><div class="muted"><a href="/Profile/'+encodeURIComponent(u.username)+'">@'+u.username+'</a></div></div></div><div>'+actions+'</div></div>';}
    async function load(){
      var d=await api('/api/friends');
      var b=await api('/blocks');
      document.getElementById('incoming').innerHTML=(d.incoming||[]).map(function(u){return card(u,'<button class="btn" data-a="accept" data-u="'+u.username+'">Aceptar</button> <button class="btn danger" data-a="reject" data-u="'+u.username+'">Rechazar</button>');}).join('')||'<p class="muted">Nada pendiente</p>';
      document.getElementById('accepted').innerHTML=(d.accepted||[]).map(function(u){return card(u,'<a class="btn" href="/messages/'+encodeURIComponent(u.username)+'">Chat</a> <button class="btn danger" data-a="remove" data-u="'+u.username+'">Eliminar</button> <button class="btn danger" data-a="block" data-u="'+u.username+'">Bloquear</button>');}).join('')||'<p class="muted">Aún no tienes amigos</p>';
      document.getElementById('outgoing').innerHTML=(d.outgoing||[]).map(function(u){return card(u,'<button class="btn danger" data-a="cancel" data-u="'+u.username+'">Cancelar</button>');}).join('')||'<p class="muted">Sin solicitudes enviadas</p>';
      document.getElementById('blocked').innerHTML=(b.blocks||[]).map(function(u){return card(u,'<button class="btn" data-a="unblock" data-u="'+u.username+'">Desbloquear</button>');}).join('')||'<p class="muted">Nadie bloqueado</p>';
    }
    document.getElementById('addForm').onsubmit=async function(e){e.preventDefault();try{await api('/friends/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('userInput').value.trim()})});document.getElementById('userInput').value='';await load();}catch(err){alert(err.message)}};
    document.body.addEventListener('click',async function(e){var btn=e.target.closest('[data-a]');if(!btn)return;var a=btn.dataset.a,u=btn.dataset.u;try{
      if(a==='accept')await api('/friends/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});
      else if(a==='reject'||a==='cancel')await api('/friends/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});
      else if(a==='remove')await api('/friends/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});
      else if(a==='block')await api('/block',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});
      else if(a==='unblock')await api('/unblock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});
      await load();
    }catch(err){alert(err.message)}});
    load().catch(function(e){document.getElementById('accepted').innerHTML='<p class="muted">Error: '+e.message+'</p>'});
    `);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleMessagesPage(env, request, peerUsername) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(new URL('/login', request.url).href, 302);
    await socialEnsureUserMeta(env, auth.user);
    if (!peerUsername) {
        const html = socialShell('Mensajes', `
          <h1>💬 Mensajes privados</h1>
          <p class="muted">Solo puedes chatear con amigos. <a href="/friends">Gestionar amigos</a></p>
          <div id="list"><p class="muted">Cargando…</p></div>
        `, `
        async function api(url){var r=await fetch(url,{credentials:'same-origin'});var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||r.status);return d;}
        api('/messages/api').then(function(d){
          var list=d.threads||[];
          document.getElementById('list').innerHTML=list.length?list.map(function(t){return '<a class="card row" href="/messages/'+encodeURIComponent(t.user.username)+'" style="text-decoration:none;color:inherit"><div class="user"><div class="av">'+(t.user.avatar_emoji||'👤')+'</div><div><b>'+t.user.name+(t.user.verified?' <span style="color:#1da1f2">✔</span>':'')+'</b><div class="muted">'+((t.last)||'')+'</div></div></div><div class="muted">'+(t.at||'').slice(11,16)+'</div></a>';}).join(''):'<p class="muted">No hay conversaciones todavía</p>';
        }).catch(function(e){document.getElementById('list').innerHTML='<p class="muted">'+e.message+'</p>'});
        `);
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    const peer = await socialGetUserByUsername(env, peerUsername);
    if (!peer) return new Response('Usuario no encontrado', { status: 404 });
    const pub = socialPublicUser(await socialEnsureUserMeta(env, peer));
    const html = socialShell('Chat con ' + pub.name, `
      <h1>💬 ${escapeHTML(pub.name)} ${pub.verified ? '<span style="color:#1da1f2">✔</span>' : ''} <span class="muted">@${escapeHTML(pub.username)}</span></h1>
      <p class="muted"><a href="/Profile/${encodeURIComponent(pub.username)}">Ver perfil</a></p>
      <div class="card"><div class="msgs" id="msgs"></div>
      <form class="composer" id="form"><input id="text" maxlength="2000" placeholder="Escribe un mensaje…" autocomplete="off" required><button class="btn" type="submit">Enviar</button></form></div>
    `, `
    var un=${JSON.stringify(pub.username)};
    async function api(url,opts){var r=await fetch(url,Object.assign({credentials:'same-origin'},opts||{}));var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||r.status);return d;}
    function render(msgs){var el=document.getElementById('msgs');el.innerHTML=(msgs||[]).map(function(m){return '<div class="bubble '+(m.from==='me'?'me':'them')+'">'+m.text.replace(/</g,'&lt;')+'<div class="muted" style="font-size:10px;margin-top:4px">'+(m.at||'').slice(11,16)+'</div></div>';}).join('');el.scrollTop=el.scrollHeight;}
    async function load(){var d=await api('/messages/api/'+encodeURIComponent(un));render(d.messages);}
    document.getElementById('form').onsubmit=async function(e){e.preventDefault();var t=document.getElementById('text');var v=t.value.trim();if(!v)return;t.value='';try{await api('/messages/api/'+encodeURIComponent(un),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:v})});await load();}catch(err){alert(err.message)}};
    load().catch(function(e){document.getElementById('msgs').innerHTML='<p class="muted">'+e.message+'</p>'});
    setInterval(function(){load().catch(function(){})},8000);
    `);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleAdminSocialPage(env, request) {
    const auth = await requireAdmin(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const html = socialShell('Admin · Verificación', `
      <h1>✔ Verificar usuarios</h1>
      <div class="card">
        <p class="muted">Otorga o quita la insignia de verificación permanente por username o email.</p>
        <form id="f" class="row" style="flex-direction:column;align-items:stretch">
          <input id="target" placeholder="Username o email" required>
          <div style="display:flex;gap:8px">
            <button class="btn" type="submit">Verificar ✔</button>
            <button class="btn danger" type="button" id="unverify">Quitar verificación</button>
          </div>
        </form>
        <pre id="out" class="muted" style="margin-top:12px;white-space:pre-wrap"></pre>
      </div>
    `, `
    async function go(verified){
      var target=document.getElementById('target').value.trim();
      var r=await fetch('/admin/verify-user',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:target,email:target,verified:verified})});
      var d=await r.json().catch(function(){return{}});
      document.getElementById('out').textContent=JSON.stringify(d,null,2);
    }
    document.getElementById('f').onsubmit=function(e){e.preventDefault();go(true)};
    document.getElementById('unverify').onclick=function(){go(false)};
    `);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}



// ==================================================
// [ 👤 EDITAR PERFIL + 🔔 NOTIFICACIONES ]
// ==================================================

const SOCIAL_MAX_NOTIFS = 50;

async function socialGetNotifs(env, email) {
    return await env.STATS.get(`notifs_${String(email).toLowerCase()}`, 'json') || [];
}

async function socialSaveNotifs(env, email, list) {
    const clean = (Array.isArray(list) ? list : []).slice(0, SOCIAL_MAX_NOTIFS);
    await env.STATS.put(`notifs_${String(email).toLowerCase()}`, JSON.stringify(clean));
    return clean;
}

async function socialPushNotif(env, toEmail, notif) {
    const list = await socialGetNotifs(env, toEmail);
    const item = {
        id: crypto.randomUUID(),
        type: String(notif.type || 'info').slice(0, 40),
        title: String(notif.title || '').slice(0, 120),
        body: String(notif.body || '').slice(0, 280),
        from_username: notif.from_username ? String(notif.from_username).slice(0, 40) : null,
        href: notif.href ? String(notif.href).slice(0, 200) : null,
        read: false,
        at: new Date().toISOString()
    };
    list.unshift(item);
    await socialSaveNotifs(env, toEmail, list);
    return item;
}

async function handleEditProfileApi(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    let user = await socialEnsureUserMeta(env, auth.user);
    if (request.method === 'GET') {
        return jsonResponse({
            username: user.username,
            name: user.name,
            bio: user.bio || '',
            avatar_emoji: user.avatar_emoji || '👤',
            verified: !!user.verified,
            profile: `/Profile/${user.username}`
        });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }

    if (body.name !== undefined) {
        const name = String(body.name || '').trim().slice(0, 80);
        if (name.length < 2) return jsonResponse({ error: 'El nombre debe tener al menos 2 caracteres' }, 400);
        user.name = name;
    }
    if (body.bio !== undefined) {
        user.bio = String(body.bio || '').trim().slice(0, 280);
    }
    if (body.avatar_emoji !== undefined) {
        let emoji = String(body.avatar_emoji || '👤').trim().slice(0, 8);
        if (!emoji) emoji = '👤';
        user.avatar_emoji = emoji;
    }
    // Cambio de username (opcional, único)
    if (body.username !== undefined) {
        const wanted = socialSlugify(body.username);
        if (wanted.length < 3) return jsonResponse({ error: 'Username mínimo 3 caracteres' }, 400);
        if (wanted.toLowerCase() !== String(user.username || '').toLowerCase()) {
            const taken = await env.STATS.get(`username_${wanted.toLowerCase()}`);
            if (taken && taken !== user.email) return jsonResponse({ error: 'Ese username ya está en uso' }, 409);
            // liberar viejo
            if (user.username) await env.STATS.delete(`username_${String(user.username).toLowerCase()}`);
            user.username = wanted;
            await env.STATS.put(`username_${wanted.toLowerCase()}`, user.email);
        }
    }
    await socialSaveUser(env, user);
    return jsonResponse({
        ok: true,
        username: user.username,
        name: user.name,
        bio: user.bio || '',
        avatar_emoji: user.avatar_emoji || '👤',
        verified: !!user.verified,
        profile: `/Profile/${user.username}`
    });
}

async function handleEditProfilePage(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(new URL('/login', request.url).href, 302);
    const user = await socialEnsureUserMeta(env, auth.user);
    const pub = socialPublicUser(user);
    const html = socialShell('Editar perfil', `
      <h1>✏️ Editar perfil</h1>
      <div class="card">
        <p class="muted">Tu link público: <a href="/Profile/${encodeURIComponent(pub.username)}">/Profile/${escapeHTML(pub.username)}</a>
        ${pub.verified ? ' <span style="color:#1da1f2">✔ verificado</span>' : ''}</p>
        <form id="editForm" style="display:flex;flex-direction:column;gap:10px">
          <label class="muted">Nombre visible</label>
          <input id="name" value="${escapeHTML(pub.name)}" maxlength="80" required>
          <label class="muted">Username (URL del perfil)</label>
          <input id="username" value="${escapeHTML(pub.username)}" maxlength="24" required pattern="[A-Za-z][A-Za-z0-9_]{2,23}">
          <label class="muted">Bio (máx. 280)</label>
          <textarea id="bio" rows="3" maxlength="280">${escapeHTML(pub.bio || '')}</textarea>
          <label class="muted">Avatar (emoji)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="avatar" value="${escapeHTML(pub.avatar_emoji)}" maxlength="8" style="width:80px;text-align:center;font-size:22px">
            <button type="button" class="btn ghost" data-e="👤">👤</button>
            <button type="button" class="btn ghost" data-e="🌊">🌊</button>
            <button type="button" class="btn ghost" data-e="👑">👑</button>
            <button type="button" class="btn ghost" data-e="🦈">🦈</button>
            <button type="button" class="btn ghost" data-e="⭐">⭐</button>
            <button type="button" class="btn ghost" data-e="🔥">🔥</button>
            <button type="button" class="btn ghost" data-e="💎">💎</button>
            <button type="button" class="btn ghost" data-e="🎮">🎮</button>
          </div>
          <button class="btn" type="submit">Guardar cambios</button>
        </form>
        <pre id="out" class="muted" style="margin-top:10px;white-space:pre-wrap"></pre>
      </div>
    `, `
    document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){document.getElementById('avatar').value=b.dataset.e}});
    document.getElementById('editForm').onsubmit=async function(e){
      e.preventDefault();
      var body={name:document.getElementById('name').value.trim(),username:document.getElementById('username').value.trim(),bio:document.getElementById('bio').value,avatar_emoji:document.getElementById('avatar').value.trim()};
      try{
        var r=await fetch('/profile/edit',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        var d=await r.json().catch(function(){return{}});
        if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
        document.getElementById('out').textContent='✅ Guardado. Perfil: '+d.profile;
        setTimeout(function(){location.href=d.profile},800);
      }catch(err){document.getElementById('out').textContent='⚠️ '+(err.message||'Error')}
    };
    `);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function handleNotificationsApi(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
    const email = auth.user.email;
    if (request.method === 'GET') {
        const list = await socialGetNotifs(env, email);
        const unread = list.filter(x => !x.read).length;
        return jsonResponse({ notifications: list, unread });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
    let body; try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    let list = await socialGetNotifs(env, email);
    if (body.action === 'read_all') {
        list = list.map(x => ({ ...x, read: true }));
        await socialSaveNotifs(env, email, list);
        return jsonResponse({ ok: true, unread: 0, notifications: list });
    }
    if (body.action === 'read' && body.id) {
        list = list.map(x => String(x.id) === String(body.id) ? { ...x, read: true } : x);
        await socialSaveNotifs(env, email, list);
        return jsonResponse({ ok: true, unread: list.filter(x => !x.read).length, notifications: list });
    }
    if (body.action === 'clear') {
        await socialSaveNotifs(env, email, []);
        return jsonResponse({ ok: true, unread: 0, notifications: [] });
    }
    return jsonResponse({ error: 'Acción desconocida' }, 400);
}

async function handleNotificationsPage(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(new URL('/login', request.url).href, 302);
    const html = socialShell('Notificaciones', `
      <h1>🔔 Notificaciones</h1>
      <div class="row" style="margin-bottom:12px">
        <button class="btn ghost" id="readAll">Marcar todas leídas</button>
        <button class="btn danger" id="clearAll">Vaciar</button>
      </div>
      <div id="list"><p class="muted">Cargando…</p></div>
    `, `
    async function api(url,opts){var r=await fetch(url,Object.assign({credentials:'same-origin'},opts||{}));var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||r.status);return d;}
    function render(d){
      var list=d.notifications||[];
      document.getElementById('list').innerHTML=list.length?list.map(function(n){
        var href=n.href||'#';
        return '<a class="card row" href="'+href+'" style="text-decoration:none;color:inherit;opacity:'+(n.read?'.65':'1')+'"><div><b>'+(n.title||'Aviso')+'</b>'+(n.read?'':' <span style="color:#1da1f2">●</span>')+'<div class="muted">'+(n.body||'')+'</div><div class="muted">'+(n.at||'').replace('T',' ').slice(0,16)+'</div></div></a>';
      }).join(''):'<p class="muted">No tienes notificaciones</p>';
    }
    async function load(){render(await api('/api/notifications'))}
    document.getElementById('readAll').onclick=async function(){await api('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read_all'})});await load()};
    document.getElementById('clearAll').onclick=async function(){if(!confirm('¿Vaciar notificaciones?'))return;await api('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear'})});await load()};
    load().catch(function(e){document.getElementById('list').innerHTML='<p class="muted">'+e.message+'</p>'});
    `);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}


export { KVLocker };

export async function workerFetch(request, env) {
        await initStaticKeys(env);
        const url = new URL(request.url);
        const path = url.pathname;

        if (adminProtectedPath(path)) {
            const adminAuth = await requireAdmin(env, request);
            if (!adminAuth) return jsonResponse({ error: 'No autorizado' }, 403);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // ==================================================
        // 🔐 GATE DE AUTENTICACIÓN
        // ==================================================
        if (!isPublicRoute(path)) {
            const auth = await requireAuth(env, request);
            if (!auth) {
                return Response.redirect(`${url.origin}/welcome`, 302);
            }
        }

        // --- Página de bienvenida (gate) ---
        if (path === '/welcome') return await handleWelcome(env, request);

        // --- Rutas web ---
        if (path === '/' || path === '/home') return await handleHome(env, request);
        if (path === '/home-data') return await handleHomeData(env, request);
        if (path === '/air-flow/app.js') return await handleAirFlowAppJs();
        if (path === '/air-flow') return await handleAirFlowPageV11(env, request);
        // --- Rutas por cada modo de Air Flow ---
        if (path.startsWith('/air-flow/mode/')) {
            const modeKey = path.slice('/air-flow/mode/'.length).split('/')[0].toLowerCase();
            const forced = AF_MODE_ROUTE_ALIASES[modeKey] || modeKey.toUpperCase();
            if (AF_MODE_RULES[afMode(forced)]) return await handleAirFlowModeRoute(env, request, forced);
        }
        if (path === '/air-flow/quick') return await handleAirFlowModeRoute(env, request, 'QUICK');
        if (path === '/air-flow/think') return await handleAirFlowModeRoute(env, request, 'THINK');
        if (path === '/air-flow/study') return await handleAirFlowModeRoute(env, request, 'STUDY');
        if (path === '/air-flow/gaming') return await handleAirFlowModeRoute(env, request, 'GAMING');
        if (path === '/air-flow/travel') return await handleAirFlowModeRoute(env, request, 'TRAVEL');
        if (path === '/air-flow/shopping') return await handleAirFlowModeRoute(env, request, 'SHOPPING');
        if (path === '/air-flow/create') return await handleAirFlowModeRoute(env, request, 'CREATE');
        // RESEARCH / PLANNER / CODE / AGENT ya tienen rutas especializadas; también aceptan chat por modo:
        if (path === '/air-flow/mode/research' || path === '/air-flow/mode/planner' || path === '/air-flow/mode/code' || path === '/air-flow/mode/agent') {
            const modeKey = path.split('/').pop().toLowerCase();
            return await handleAirFlowModeRoute(env, request, AF_MODE_ROUTE_ALIASES[modeKey] || modeKey.toUpperCase());
        }
        if (path === '/air-flow/chat' || path === '/air-flow/api/chat') return await handleAirFlowChatV11(env, request);
        if (path === '/air-flow/api/vision') return await handleAirFlowVisionV11(env, request);
        if (path === '/air-flow/api/file') return await handleAirFlowFileV11(env, request);
        if (path === '/air-flow/api/memory') return await handleAirFlowMemoryV11(env, request);
        if (path === '/air-flow/api/conversations') return await handleAirFlowConversationsV11(env, request);
        if (path === '/air-flow/api/feedback') return await handleAirFlowFeedbackV11(env, request);
        if (path === '/air-flow/api/agent') return await handleAirFlowAgentV11(env, request);
        if (path === '/air-flow/api/create/image') return await handleAirFlowCreateImageV11(env, request);
        if (path === '/air-flow/api/live/token') return await handleAirFlowLiveTokenV11(env, request);
        if (path === '/air-flow/api/status') return await handleAirFlowStatusV11(env, request);
        if (path === '/air-flow/health' || path === '/air-flow/api/health') return await handleAirFlowStatusV11(env, request);
        if (path === '/air-flow/vision') return await handleAirFlowVisionV11(env, request);
        if (path === '/air-flow/file') return await handleAirFlowFileV11(env, request);
        if (path === '/air-flow/memory') return await handleAirFlowMemoryV11(env, request);
        if (path === '/air-flow/conversations') return await handleAirFlowConversationsV11(env, request);
        if (path === '/air-flow/feedback') return await handleAirFlowFeedbackV11(env, request);
        if (path === '/air-flow/agent') return await handleAirFlowAgentV11(env, request);
        if (path.startsWith('/air-flow/artifact/')) return await handleAirFlowArtifactV11(env, request);
        if (path === '/air-flow/create/image') return await handleAirFlowCreateImageV11(env, request);
        if (path === '/air-flow/live/token') return await handleAirFlowLiveTokenV11(env, request);
        if (path === '/air-flow/permissions') return await handleAirFlowPermissionsV11(env, request);
        if (path === '/air-flow/status') return await handleAirFlowStatusV11(env, request);
        if (path === '/air-flow/models') return await handleAirFlowModelsV13(env, request);
        if (path === '/air-flow/research') return await handleAirFlowResearchV11(env, request);
        if (path === '/air-flow/files/search') return await handleAirFlowFileSearchV11(env, request);
        if (path === '/air-flow/planner') return await handleAirFlowPlannerV11(env, request);
        if (path === '/air-flow/code/review') return await handleAirFlowCodeReviewV11(env, request);
        if (path === '/air-flow/security') return await handleAirFlowSecurityV11(env, request);
        if (path === '/admin/air-flow') return await handleAirFlowAdminV11(env, request);
        if (path === '/admin/air-flow/personality') return await handleAirFlowPersonalityLabV11(env, request);
        if (path === '/shop') return await handleShop(env, request);
        if (path === '/pay') return await handlePay();
        if (path === '/sell') return await handleSell(env, request);
        if (path === '/dlc') return await handleDlc();
        if (path === '/key') return await handleKey();

        // --- Rutas del sistema ---
        if (path === '/get-nonce') return await handleGetNonce(env, request);
        if (path.startsWith('/verify') && !path.startsWith('/verify-web') && !path.startsWith('/verify-batch')) {
            return await handleVerify(env, request);
        }
        if (path === '/verify-web') return await handleVerifyWeb(env, request);
        if (path === '/key-info') return await handleKeyInfo(env, url);
        if (path === '/admin') return await handleAdminRoute(env, url, request.headers, request);
        if (path === '/admin/compras') return await handleAdminCompras(env, url, request.headers);
        if (path === '/admin-action') return await handleAdminAction(env, url, request);
        if (path === '/generate') return await handleGenerate(env, request, url);
        if (path === '/generate-batch') return await handleGenerateBatch(env, url, request);
        if (path === '/export-csv') return await handleExportCsv(env, url);
        if (path === '/export-json') return await handleExportJson(env, url);
        if (path === '/webhook') return await handleWebhook(env, request);
        if (path === '/qr-totp') return await handleQR(env, url);
        if (path === '/sse') return await handleSSE(env);
        if (path === '/shop/create-checkout') {
            const checkoutAuth = await requireAuth(env, request);
            if (!checkoutAuth) return jsonResponse({ error: 'No autorizado' }, 403);
            const tipo = url.searchParams.get('tipo') || 'dlc';
            // The authenticated account owns the purchase; ignore any email supplied by the client.
            const email = checkoutAuth.user.email;
            const coupon = url.searchParams.get('coupon') || null;
            if (tipo === 'suscripcion') {
                const plan = url.searchParams.get('plan');
                if (!plan) return jsonResponse({ error: 'Falta plan' }, 400);
                try {
                    const order = await createPayPalOrderSuscripcion(env, plan, email, coupon);
                    return jsonResponse(order);
                } catch (e) {
                    return jsonResponse({ error: 'No se pudo crear la orden de pago' }, 500);
                }
            } else {
                const priceId = url.searchParams.get('price_id') || 'price_aprendiz';
                const metadata = {
                    email: email,
                    user_id: url.searchParams.get('user_id') || '',
                };
                try {
                    const order = await createPayPalOrder(env, priceId, metadata, coupon);
                    return jsonResponse(order);
                } catch (e) {
                    return jsonResponse({ error: 'No se pudo crear la orden de pago' }, 500);
                }
            }
        }
        if (path === '/paypal/capture') return await handlePayPalCapture(env, request);
        if (path === '/paypal/webhook') return await handlePayPalWebhook(env, request);
        if (path === '/shop/success') return new Response('🌊 Pago exitoso! Tu clave será enviada a tu correo.', { status: 200 });
        if (path === '/shop/cancel') return new Response('🌊 Pago cancelado.', { status: 200 });

        // --- Rutas de usuario ---
        if (path === '/register') return await handleRegister(env, request);
        if (path === '/login') return await handleLogin(env, request);
        if (path === '/logout') return await handleLogout(env, request);
        if (path === '/profile') return await handleProfile(env, request);
        if (path === '/verify-2fa') return await handleVerify2FA(env, request);

        // --- Recuperación de contraseña ---
        if (path === '/forgot-password') return await handleForgotPassword(env, request);
        if (path === '/reset-password') return await handleResetPassword(env, request);

        // --- Páginas legales ---
        if (path === '/privacidad') return await handlePrivacidad(env);
        if (path === '/aviso-legal') return await handleAvisoLegal(env);
        if (path === '/terminos') return await handleTerminos(env);
        if (path === '/cookies') return await handleCookies(env);

        // --- Suscripciones ---
        if (path === '/suscribirse') return await handleSubscribe(env, request);
        if (path === '/pay-subscription') return await handlePaySubscription(env, request);
        if (path === '/renovar-suscripcion') {
            if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405);
            const auth = await requireAuth(env, request);
            if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
            const subscription = await getSuscripcionUsuario(env, auth.user.email);
            if (!subscription || !SUSCRIPCION_PLANES[subscription.plan]) {
                return jsonResponse({ error: 'No se encontró una suscripción válida para renovar.' }, 400);
            }
            try {
                // A renewal must be paid through PayPal; never extend a subscription for free.
                const order = await createPayPalOrderSuscripcion(env, subscription.plan, auth.user.email);
                if (!order || !order.id || !Array.isArray(order.links)) {
                    console.error('PayPal did not return a valid renewal order:', order?.name || order?.message || 'unknown error');
                    return jsonResponse({ error: 'PayPal no pudo crear la orden de renovación.' }, 502);
                }
                return jsonResponse(order);
            } catch (error) {
                console.error('Could not create subscription renewal order:', error?.message || error);
                return jsonResponse({ error: 'No se pudo iniciar el pago de renovación.' }, 502);
            }
        }
        if (path === '/cancelar-renovacion') {
            const auth = await requireAuth(env, request);
            if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
            await cancelarRenovacionSuscripcion(env, auth.user.email);
            return jsonResponse({ message: 'Renovación automática cancelada' });
        }

        // --- Resellers ---
        if (path === '/admin/hacer-reseller') return await handleHacerReseller(env, request);
        if (path === '/admin/asignar-claves') return await handleAsignarClaves(env, request);
        if (path === '/admin/resellers') return await handleListResellers(env, request);
        if (path === '/comprar-pack') return await handleComprarPack(env, request);
        if (path === '/solicitar-retiro') return await handleSolicitarRetiro(env, request);

        // --- Roadmap ---
        if (path === '/status') return await handleStatus(env);
        if (path === '/claim-key') return await handleClaimKey(env, request);
        if (path === '/renew-key') return await handleRenewKey(env, request);
        if (path.startsWith('/invoice/')) return await handleInvoice(env, url, request);
        if (path === '/stats/public') return await handlePublicStats(env);
        if (path === '/search-key') return await handleSearchKey(env, url);
        if (path === '/verify-batch') return await handleVerifyBatch(env, request);
        if (path === '/shorten') return await handleShorten(env, request);
        if (path === '/webhook/test') return await handleWebhookTest(env);
        if (path === '/admin/logs') return await handleAdminLogs(env, url);
        if (path === '/admin/batch-expire') return await handleBatchExpire(env, request);
        if (path === '/admin/console') return await handleAdminConsole(env, request);
        if (path === '/admin/ingresos') return await handleAdminIngresos(env, url);
        if (path === '/cron-renew') return await handleCronRenew(env, request);
        if (path === '/admin/generar-prueba') return await handleGenerarPrueba(env, request);
        if (path.startsWith('/s/')) return await handleShortRedirect(env, url);

        // --- Admin usuarios, backup, upload ---
        if (path === '/admin/users') return await handleAdminUsers(env, url, request);
        if (path === '/admin/user-action') return await handleAdminUserAction(env, request);
        if (path === '/admin/backup') return await handleBackup(env, request);
        if (path === '/admin/upload-keys') return await handleUploadKeys(env, request);

        if (path === '/google-site-verification=-fN3u75bTpGxDsM2DbBivq0SJ2fuREK-QsMsbvJGnHI') return new Response('google-site-verification=-fN3u75bTpGxDsM2DbBivq0SJ2fuREK-QsMsbvJGnHI', { headers: { 'Content-Type': 'text/html' } });

        // --- OAuth ---
        if (path === '/auth/discord') return await handleDiscordAuth(env);
        if (path === '/auth/discord/callback') return await handleDiscordCallback(env, request);
        if (path === '/auth/google') return await handleGoogleAuth(env);
        if (path === '/auth/google/callback') return await handleGoogleCallback(env, request);

        // --- Reviews, webhooks, 2FA usuario, puntos ---
        if (path === '/review') return await handleReview(env, request);
        if (path === '/reviews') return await handleGetReviews(env, url);
        if (path === '/webhook/register') return await handleRegisterWebhook(env, request);
        if (path === '/activar-2fa') return await handleActivate2FA(env, request);
        if (path === '/desactivar-2fa') return await handleDeactivate2FA(env, request);
        if (path === '/qr-2fa') return await handleUser2FAQR(env, request);
        if (path === '/canjear-puntos') return await handleRedeemPoints(env, request);
        if (path === '/leaderboard') return await handleLeaderboard(env);
        if (path === '/toggle-dark-mode') return await handleToggleDarkMode(env, request);
        if (path === '/cron-jobs') return await handleCronJobs(env, request);

        // --- Social ---
        if (path.startsWith('/Profile/') || path.startsWith('/profile/') || path.startsWith('/u/')) {
            const uname = decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
            return await handlePublicProfile(env, request, uname);
        }
        if (path === '/api/friends') return await handleFriendsApi(env, request, 'list');
        if (path === '/friends/request') return await handleFriendsApi(env, request, 'request');
        if (path === '/friends/accept') return await handleFriendsApi(env, request, 'accept');
        if (path === '/friends/reject') return await handleFriendsApi(env, request, 'reject');
        if (path === '/friends/remove') return await handleFriendsApi(env, request, 'remove');
        if (path === '/friends') return await handleFriendsPage(env, request);
        if (path === '/block') return await handleBlockApi(env, request, 'block');
        if (path === '/unblock') return await handleBlockApi(env, request, 'unblock');
        if (path === '/blocks') return await handleBlockApi(env, request, 'list');
        if (path === '/messages/api') return await handleMessagesApi(env, request, null);
        if (path.startsWith('/messages/api/')) {
            const uname = decodeURIComponent(path.slice('/messages/api/'.length).split('/')[0] || '');
            return await handleMessagesApi(env, request, uname);
        }
        if (path === '/messages') return await handleMessagesPage(env, request, null);
        if (path.startsWith('/messages/')) {
            const uname = decodeURIComponent(path.slice('/messages/'.length).split('/')[0] || '');
            if (uname) return await handleMessagesPage(env, request, uname);
        }
        if (path === '/admin/verify-user') return await handleAdminVerifyUser(env, request);
        if (path === '/admin/social' || path === '/admin/verificacion') return await handleAdminSocialPage(env, request);

        // --- Perfil editable + notificaciones ---
        if (path === '/profile/edit') {
            if (request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html')) {
                return await handleEditProfilePage(env, request);
            }
            return await handleEditProfileApi(env, request);
        }
        if (path === '/api/notifications') return await handleNotificationsApi(env, request);
        if (path === '/notifications') return await handleNotificationsPage(env, request);

        return new Response('🌊 404 - Ruta no encontrada', { status: 404 });
}

async function applySecurityHeaders(response) {
    const headers = new Headers(response.headers);
    const contentType = headers.get('Content-Type') || '';
    let body = response.body;
    // Si es HTML, asegurar que no quede Content-Length obsoleto
    if (contentType.includes('text/html')) {
        try {
            const html = await response.text();
            body = html;
            headers.delete('Content-Length');
            headers.delete('content-length');
        } catch (_) {}
    }
    // IMPORTANTE CSP3: si hay nonce o hash, 'unsafe-inline' se IGNORA.
    // Por eso NO usamos nonce aquí: el app tiene scripts inline legítimos
    // y scripts externos en 'self' (/air-flow/app.js).
    headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.paypal.com https://www.paypalobjects.com",
        "script-src-attr 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://openrouter.ai https://api.openrouter.ai https://api-m.paypal.com https://api-m.sandbox.paypal.com https://api.brevo.com",
        "frame-src 'self' https://www.paypal.com",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "upgrade-insecure-requests"
    ].join('; '));
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    headers.set('X-Frame-Options', 'DENY');
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export default {
    async fetch(request, env) {
        // Fallar cerrado y de forma controlada si el Durable Object requerido no está enlazado.
        if (!env?.KV_LOCKER) {
            return await applySecurityHeaders(jsonResponse({
                error: 'Servicio temporalmente no disponible',
                code: 'KV_LOCKER_NOT_CONFIGURED'
            }, 503));
        }
        try {
            const response = await workerFetch(request, env);
            return await applySecurityHeaders(response);
        } catch (error) {
            console.error('❌ Error no controlado en el Worker:', error);
            return await applySecurityHeaders(jsonResponse({
                error: 'Error interno del servidor'
            }, 500));
        }
    }
};
