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

