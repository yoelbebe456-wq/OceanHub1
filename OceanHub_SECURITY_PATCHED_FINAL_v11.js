// ==================================================
// 🌊 OCEAN HUB V28.2 - VERSIÓN COMPLETA
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
const SESSION_TTL = 604800;
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
    const user = {
        email, name: name || email.split('@')[0], passwordHash, salt, role,
        created_at: new Date().toISOString(), last_login: null,
        referral_code: ownReferralCode, referido_por: referralCode || null,
        points: 0, otp_secret: null, dark_mode: false, language: 'es', sessionVersion: 0
    };
    await env.STATS.put(`user_${email}`, JSON.stringify(user));
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
    user.last_login = new Date().toISOString();
    await env.STATS.put(`user_${email}`, JSON.stringify(user));
    await logUserAction(env, email, 'login', { ip: 'unknown', userAgent: '' });
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

async function withKVLock(env, name, fn) {
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
            body: JSON.stringify({ token: lockToken, ttl: 60000 })
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
         '/webhook/test','/shorten','/key-info'].includes(path);
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
    try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
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
            })
        });
    } catch (e) {
        console.error('Brevo email error:', e);
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
async function triggerWebhooks(env, email, event, data) {
    const webhook = await env.STATS.get(`webhook_${email}`, 'json');
    if (!webhook || !webhook.url) return;
    await fetch(webhook.url, {
        method: 'POST',
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

async function handleCronRenew(env) {
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
        const cookie = `session_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
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
            <h2>🔐 ${t('login')}</h2>
            <div class="auth-options">
                <a href="/auth/discord">🟣 Discord</a>
                <a href="/auth/google">🔴 Google</a>
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

    const token = await createSession(env, user);
    const cookie = `session_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
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
    await logUserAction(env, email, 'login_2fa', { ip: getClientIP(request) });
    const sessionToken = await createSession(env, user);
    const cookieSession = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
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
                if (!confirm('¿Renovar suscripción +30 días?')) return;
                postJSON('/renovar-suscripcion').then(function(data) {
                    alert(data.message || data.error || 'Listo');
                    location.reload();
                }).catch(function(err) { alert('Error: ' + err.message); });
            }

            function activar2FA() {
                if (!confirm('¿Activar 2FA?\nSe generará un secreto. Guárdalo o escanea el QR.')) return;
                postJSON('/activar-2fa').then(function(data) {
                    if (data.error) { alert('❌ ' + data.error); return; }
                    var modal = document.getElementById('twofaModal');
                    var img = document.getElementById('twofaQr');
                    var secretEl = document.getElementById('twofaSecret');
                    if (img && data.qrUrl) img.src = data.qrUrl;
                    if (secretEl) secretEl.textContent = data.secret || '';
                    if (modal) modal.style.display = 'flex';
                    else alert((data.message || '2FA activado') + '\n\nSecreto: ' + (data.secret || ''));
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
    return await response.json();
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
    return await response.json();
}

async function capturePayPalOrder(env, orderId) {
    const accessToken = await getPayPalAccessToken(env);
    const response = await fetch(`${getPayPalApiUrl(env)}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    return await response.json();
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
const AF_GEMINI_MODEL_DEFAULT = 'gemini-3.8-flash';
const AF_OPENROUTER_MODEL_DEFAULT = 'openrouter/free';
const AF_LIVE_MODEL_DEFAULT = 'gemini-3.8-live';
const AF_IMAGE_MODEL_DEFAULT = 'gemini-3.1-flash-image';
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

async function afSaveConversation(env, email, history, mode = 'QUICK') {
    const safe = await hashKey(String(email || '').toLowerCase());
    const key = `af_conversations_${safe}`;
    const current = await env.STATS.get(key, 'json') || [];
    const normalized = afNormalizeMessages(history).slice(-AF_MAX_HISTORY_MESSAGES);
    const firstUser = normalized.find(x => x.role === 'user');
    const item = {
        id: crypto.randomUUID(),
        title: String(firstUser?.content || 'Nueva conversación').slice(0, 90),
        mode: afMode(mode),
        updated_at: new Date().toISOString(),
        messages: normalized
    };
    const merged = [item, ...current.filter(x => x?.title !== item.title || x?.mode !== item.mode)].slice(0, AF_MAX_CONVERSATIONS);
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
    const model = String(env.GEMINI_MODEL || AF_GEMINI_MODEL_DEFAULT).trim();
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = {
        systemInstruction: { parts: [{ text: afBuildPrompt(mode, options.memories || [], options.personality || AF_PERSONALITY) }] },
        contents,
        generationConfig: (model === AF_GEMINI_MODEL_DEFAULT || model.startsWith('gemini-3.')) ? { maxOutputTokens: options.maxOutputTokens || 1400 } : { temperature: 0.7, maxOutputTokens: options.maxOutputTokens || 1400 }
    };
    if (options.web) body.tools = [{ google_search: {} }];
    const started = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    const latency = Date.now() - started;
    if (!response.ok) {
        console.error('Air Flow Gemini error:', response.status, JSON.stringify(data).slice(0, 1200));
        throw new Error(`GEMINI_HTTP_${response.status}`);
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
    const model = String(env.OPENROUTER_MODEL || AF_OPENROUTER_MODEL_DEFAULT).trim();
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': getBaseUrl(env), 'X-Title': 'Ocean Hub - Air Flow' },
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

async function afGenerate(env, history, message, mode, options = {}) {
    const memories = options.memories || [];
    const messages = [...afNormalizeMessages(history), { role: 'user', content: message }];
    const search = options.web ?? afShouldSearch(mode, message);
    const personality = options.personality || await afGetActivePersonality(env);
    const route = afRouter(mode, message);
    const errors = [];
    const providers = route.primary === 'openrouter' ? ['openrouter', 'gemini'] : ['gemini', 'openrouter'];
    for (const provider of providers) {
        try {
            const result = provider === 'gemini'
                ? await afCallGemini(env, messages, mode, { ...options, web: search, memories, personality })
                : await afCallOpenRouter(env, messages, mode, { ...options, web: search, memories, personality });
            if (search && !result.sources.length) {
                const extra = afExtractUrls(result.text);
                result.sources = extra;
            }
            return result;
        } catch (e) {
            errors.push(String(e?.message || e));
        }
    }
    console.error('Air Flow provider router failed:', errors.join(' | '));
    throw new Error('AIR_FLOW_NO_PROVIDER');
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
        const result = await afGenerate(env, body?.history, message, mode, { memories: memoryItems });
        const history = afNormalizeMessages([...(body?.history || []), { role: 'user', content: message }, { role: 'assistant', content: result.text }]);
        await afSaveConversation(env, auth.user.email, history, mode);
        await afLogMetric(env, { request: true, search: result.searched, tokens: result.tokens, latency: Date.now() - started, model: result.model, mode });
        return jsonResponse({ reply: result.text, provider: result.provider, model: result.model, sources: result.sources || [], searched: !!result.searched, mode });
    } catch (error) {
        await afLogMetric(env, { request: true, error: true, latency: Date.now() - started, mode });
        const code = String(error?.message || 'AIR_FLOW_NO_PROVIDER').replace(/[^A-Z0-9_\-]/g, '').slice(0, 80) || 'AIR_FLOW_NO_PROVIDER';
        console.error('Air Flow V11 chat failed:', error?.message || error);
        return jsonResponse({ error: '⚠️ Air Flow no pudo responder ahora.', code }, 502);
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
    try {
        if (request.method === 'DELETE') {
            const url = new URL(request.url);
            body = { type: url.searchParams.get('type') || 'all' };
        } else {
            body = await request.json();
        }
    } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }
    if (request.method === 'DELETE') {
        const kind = String(body?.type || 'all').trim();
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
    if (request.method !== 'GET') return jsonResponse({ error: 'Método no permitido' }, 405);
    const url = new URL(request.url);
    return jsonResponse({ conversations: await afGetConversations(env, auth.user.email, url.searchParams.get('q') || '') });
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
                    config: {
                        responseModalities: ['AUDIO'],
                        outputAudioTranscription: {},
                        sessionResumption: {}
                    }
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
    if (!clean || !/^(?:text\/.+|application\/(?:json|csv))(?:;.*)?$/i.test(String(mime || ''))) return null;
    try {
        const binary = atob(clean);
        const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        return decoded.length <= 120000 ? decoded : decoded.slice(0, 120000);
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

async function handleAirFlowPageV11(env, request) {
    const auth = await requireAuth(env, request);
    if (!auth) return Response.redirect(`${new URL(request.url).origin}/welcome`, 302);
    const safeName = escapeHTML(auth.user.name || auth.user.email?.split('@')[0] || 'amigo');
    const hasGemini = !!env.GEMINI_API_KEY;
    const hasOpenRouter = !!env.OPENROUTER_API_KEY;
    const providerLabel = hasGemini && hasOpenRouter ? 'Gemini + OpenRouter' : (hasGemini ? 'Gemini' : (hasOpenRouter ? 'OpenRouter' : 'Sin proveedor'));
    return new Response(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>✈️ Air Flow — Ocean Hub</title>
<style>
*{box-sizing:border-box}:root{--bg:#020916;--panel:#06152a;--line:#123b63;--muted:#86a5c6;--text:#ecf7ff;--blue:#159dff;--cyan:#25d7ff;--green:#16e3a5}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,system-ui,-apple-system,sans-serif}
body{overflow:hidden;background:radial-gradient(circle at 18% 15%,rgba(21,157,255,.12),transparent 28%),radial-gradient(circle at 85% 5%,rgba(34,215,255,.08),transparent 26%),#020916}
button,input,textarea{font:inherit}button{color:inherit}.app{height:100%;display:grid;grid-template-columns:226px minmax(0,1fr) 288px;gap:14px;padding:14px;max-width:1540px;margin:auto}
.side,.main,.rail{min-height:0;background:linear-gradient(180deg,rgba(6,19,37,.96),rgba(3,13,28,.98));border:1px solid rgba(66,155,220,.24);box-shadow:0 18px 60px rgba(0,0,0,.28);backdrop-filter:blur(18px)}
.side{border-radius:18px;padding:16px 12px;display:flex;flex-direction:column;overflow:hidden;position:relative}.side:after{content:"";position:absolute;left:-40px;bottom:-70px;width:220px;height:180px;background:radial-gradient(circle,rgba(0,183,255,.28),transparent 68%);filter:blur(10px);pointer-events:none}
.brand{display:flex;align-items:center;gap:10px;padding:8px 9px 14px}.orb{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#00d9ff,#0b65e8);box-shadow:0 0 30px rgba(0,174,255,.3);font-size:21px}.brand b{display:block;font-size:17px}.brand small{display:block;color:#75a5cc;font-size:11px;margin-top:3px}
.nav{display:grid;gap:6px;margin-top:4px}.nav button,.nav a{display:flex;align-items:center;gap:10px;width:100%;border:1px solid transparent;background:transparent;border-radius:11px;padding:11px 12px;color:#acc8e4;cursor:pointer;text-decoration:none;text-align:left}.nav button:hover,.nav a:hover{background:rgba(12,123,235,.11);border-color:rgba(43,157,247,.22);color:#fff}.nav button.active{background:linear-gradient(90deg,rgba(24,136,255,.34),rgba(8,76,152,.12));border-color:rgba(31,160,255,.48);box-shadow:0 7px 25px rgba(0,132,255,.12);color:#fff}.side .foot{margin-top:auto;padding:12px 8px;color:#6f93b9;font-size:11px;line-height:1.55;border-top:1px solid rgba(70,145,203,.16)}.side .foot a{color:#8bdcff;text-decoration:none}
.main{border-radius:18px;display:flex;flex-direction:column;overflow:hidden}.top{height:72px;padding:14px 18px;border-bottom:1px solid rgba(70,145,203,.14);display:flex;align-items:center;justify-content:space-between;gap:12px}.top-left{display:flex;align-items:center;gap:12px}.back{border:1px solid var(--line);background:#071a31;border-radius:10px;padding:8px 10px;cursor:pointer;text-decoration:none}.top-title b{display:block;font-size:15px}.top-title small{color:#6f93b9;font-size:11px}.provider{padding:7px 10px;border-radius:999px;background:rgba(10,144,239,.1);border:1px solid rgba(33,165,255,.25);color:#98d9ff;font-size:11px}
.hero{margin:16px;border-radius:16px;min-height:190px;position:relative;overflow:hidden;border:1px solid rgba(57,157,222,.3);background-image:linear-gradient(90deg,rgba(2,13,28,.92),rgba(2,13,28,.30) 56%,rgba(2,13,28,.04)),url('data:image/jpeg;base64,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');background-size:cover;background-position:center}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(1,8,20,.16) 55%,rgba(1,8,20,.52))}.hero-inner{position:relative;z-index:1;padding:25px 26px;max-width:620px}.hero-eyebrow{color:#82dfff;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.hero h1{margin:8px 0 7px;font-size:clamp(28px,4vw,43px);line-height:1.02}.hero h1 span{background:linear-gradient(90deg,#fff,#77dcff);-webkit-background-clip:text;background-clip:text;color:transparent}.hero p{margin:0 0 16px;color:#c5dbef;line-height:1.55;max-width:510px}.hero-actions{display:flex;gap:8px;flex-wrap:wrap}.pill,.hero-btn{border:1px solid rgba(75,169,230,.25);background:#071a30;color:#b9d7ef;border-radius:10px;padding:9px 12px;cursor:pointer}.pill:hover,.hero-btn:hover{border-color:#2ac8ff;background:#092442}.hero-btn.primary{border:0;background:linear-gradient(135deg,#0ea7ff,#165bf0);color:#fff;box-shadow:0 8px 26px rgba(9,130,249,.28)}
.messages{flex:1;min-height:0;overflow:auto;padding:4px 16px 12px;display:flex;flex-direction:column;gap:10px}.empty-state{text-align:center;padding:26px 12px;color:#7ea6c8}.empty-state strong{display:block;color:#dff4ff;font-size:16px;margin-bottom:5px}.msg{max-width:86%;padding:12px 14px;border-radius:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word;border:1px solid rgba(91,160,210,.13)}.msg.user{align-self:flex-end;background:linear-gradient(135deg,#0d6fa5,#1555be);border-bottom-right-radius:5px;color:#f5fbff}.msg.ai{align-self:flex-start;background:rgba(4,25,48,.8);border-bottom-left-radius:5px}.meta{font-size:10px;color:#6f96bd;margin-bottom:4px}.sources{margin-top:9px;font-size:12px}.sources a{color:#77ddff;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.modebar{display:flex;gap:6px;flex-wrap:wrap;padding:8px 16px;border-top:1px solid rgba(70,145,203,.10);background:rgba(3,12,25,.62)}.modebar .pill.active{background:rgba(10,145,248,.18);border-color:rgba(42,200,255,.48);color:#fff}.composer{padding:12px 14px;border-top:1px solid rgba(70,145,203,.14);display:flex;align-items:end;gap:8px;background:rgba(2,9,18,.7)}textarea,input{outline:none}.composer textarea{flex:1;min-height:50px;max-height:150px;resize:none;border:1px solid rgba(80,158,216,.24);background:#041323;color:#f5fbff;border-radius:13px;padding:12px}.composer textarea:focus,textarea:focus,input:focus{border-color:#25c8ff;box-shadow:0 0 0 3px rgba(37,200,255,.08)}.send{height:50px;width:52px;border:0;border-radius:13px;background:linear-gradient(135deg,#11c5ff,#2f66f6);font-size:19px;font-weight:800;cursor:pointer}
.rail{border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px;overflow:auto}.rail-card{border:1px solid rgba(77,159,219,.21);background:linear-gradient(180deg,rgba(7,31,56,.9),rgba(4,18,35,.93));border-radius:15px;padding:14px}.air-badge{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#16d4ff,#04579c);box-shadow:0 0 28px rgba(0,205,255,.26);font-size:20px}.rail-head{display:flex;align-items:center;gap:10px}.rail-head b{display:block}.rail-head small{display:block;color:#76a4c8;font-size:10px;margin-top:2px}.rail-card h3{margin:0 0 7px;font-size:14px}.rail-card p{margin:0;color:#88aeca;font-size:12px;line-height:1.5}.quick-actions{display:grid;gap:7px;margin-top:12px}.quick-actions button,.quick-actions a{width:100%;border:1px solid rgba(79,157,218,.20);background:#061b34;color:#b8d3eb;border-radius:10px;padding:10px;text-align:left;cursor:pointer;text-decoration:none;display:block}.quick-actions button:hover{border-color:#29caff;background:#082744;color:#fff}.online{display:inline-flex;align-items:center;gap:6px;margin-top:10px;color:#81d7bf;font-size:11px}.dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 11px rgba(22,227,165,.55)}
.panel{position:fixed;inset:7% 10%;z-index:30;background:#061526;border:1px solid rgba(75,169,230,.28);border-radius:17px;box-shadow:0 30px 100px rgba(0,0,0,.65);padding:18px;overflow:auto}.panel.hide{display:none!important}.panel h3{margin:0 0 8px}.panel p{color:#85a7c5}.panel textarea{width:100%;min-height:92px;background:#041322;color:#fff;border:1px solid #17446d;padding:11px;border-radius:10px;margin:7px 0}.panel input{background:#041322;color:#fff;border:1px solid #17446d;border-radius:10px;padding:10px}.close{float:right;border:0;background:transparent;color:#fff;font-size:25px;cursor:pointer}.result{background:rgba(255,255,255,.035);padding:12px;border-radius:11px;margin-top:9px;white-space:pre-wrap;overflow-wrap:anywhere}.perm-list{display:grid;gap:6px;margin-top:12px}.perm-row{display:flex;align-items:center;justify-content:space-between;padding:10px;background:#071b31;border:1px solid rgba(76,154,210,.17);border-radius:10px}.planner-add{display:flex;gap:7px;margin-bottom:10px}.planner-add input{flex:1}.task{display:grid;grid-template-columns:28px 1fr 28px;gap:8px;align-items:center;padding:10px;border:1px solid rgba(76,154,210,.16);border-radius:11px;background:#071b31;margin:7px 0}.task small{display:block;color:#7397b7;margin-top:3px}.task.done b{text-decoration:line-through;color:#7290aa}.task-toggle,.task-delete{border:0;background:transparent;color:#8bdfff;cursor:pointer}.task-delete{font-size:18px}.code-area{min-height:220px!important;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}.small-area{min-height:76px!important}.hide{display:none!important}
@media(max-width:1180px){.app{grid-template-columns:205px minmax(0,1fr)}.rail{display:none}}@media(max-width:760px){body{overflow:auto}.app{height:auto;min-height:100%;display:block;padding:8px}.side{display:none}.main{min-height:calc(100vh - 16px)}.hero{margin:10px}.hero-inner{padding:21px}.modebar{overflow:auto;flex-wrap:nowrap}.composer{position:sticky;bottom:0}.panel{inset:3% 3%}}
</style>
</head><body>
<div class="app">
<aside class="side"><div class="brand"><div class="orb">✈</div><div><b>Air Flow</b><small>Ocean Hub AI</small></div></div>
<div class="nav">
<button class="active" data-mode="QUICK">⚡ Chat</button><button data-mode="RESEARCH">🌐 Research</button><button data-mode="CODE">💻 Code</button><button data-mode="STUDY">📚 Study</button><button data-mode="GAMING">🎮 Gaming</button><button data-mode="TRAVEL">✈️ Travel</button><button data-mode="PLANNER">📅 Planner</button><button data-mode="AGENT">🤖 Agent</button>
<button data-action="vision">👁️ Vision</button><button data-action="files">📎 Files</button><button data-action="memory">🧠 Memory</button><button data-action="live">🎙️ Live</button><button data-action="create">🎨 Create</button>
</div><div class="foot">${providerLabel}<br>Hola, ${safeName}.<br><a href="/home">← Volver a Ocean Hub</a></div></aside>
<main class="main"><div class="top"><div class="top-left"><a class="back" href="/home">←</a><div class="top-title"><b>✈️ Air Flow</b><small>Tu asistente inteligente de Ocean Hub</small></div></div><div class="provider">● ${providerLabel}</div></div>
<section class="hero"><div class="hero-inner"><div class="hero-eyebrow">OCEAN HUB • AIR FLOW</div><h1>Tu <span>Air Flow</span>, ${safeName}.</h1><p>Conversación, investigación, código, archivos, visión, planificación y creación en un solo lugar.</p><div class="hero-actions"><button class="hero-btn primary" data-action="new">＋ Nueva conversación</button><button class="hero-btn" data-action="research">🌐 Investigar</button><button class="hero-btn" data-action="code-review">💻 Revisar código</button></div></div></section>
<div id="messages" class="messages"><div id="empty" class="empty-state"><strong>¿Qué hacemos hoy? ✈️</strong>Puedo conversar, investigar en la web, analizar imágenes/archivos y ayudarte con código, estudio, viajes y proyectos.</div></div>
<div class="modebar"><button class="pill active" data-mode="QUICK">⚡ Quick</button><button class="pill" data-mode="THINK">🧠 Think</button><button class="pill" data-mode="RESEARCH">🌐 Research</button><button class="pill" data-mode="CODE">💻 Code</button><button class="pill" data-mode="STUDY">📚 Study</button><button class="pill" data-mode="GAMING">🎮 Gaming</button><button class="pill" data-mode="TRAVEL">✈️ Travel</button><button class="pill" data-mode="SHOPPING">🛒 Shopping</button><button class="pill" data-mode="PLANNER">📅 Planner</button><button class="pill" data-mode="AGENT">🤖 Agent</button></div>
<div class="composer"><textarea id="input" maxlength="${AF_MAX_MESSAGE_CHARS}" placeholder="Pregunta lo que quieras..."></textarea><input id="file" type="file" class="hide"><button id="attach" class="pill" title="Archivo">📎</button><button id="cam" class="pill" title="Cámara">📷</button><button id="send" class="send">➤</button></div></main>
<aside class="rail"><div class="rail-card"><div class="rail-head"><div class="air-badge">✦</div><div><b>Air Flow <span style="color:#6fd8ff">IA</span></b><small>Tu asistente de confianza</small></div></div>
<div class="result" style="margin-top:12px">¡Hola, ${safeName}! 👋<br><br>¿En qué puedo ayudarte hoy?<br><br>Estoy aquí para mejorar tu experiencia en Ocean Hub.</div>
<div class="quick-actions"><button data-action="research">🔎 Buscar / investigar</button><button data-action="code-review">💻 Ayuda con código</button><button data-action="planner">📅 Planner</button><button data-action="vision">👁️ Analizar imagen</button><button data-action="files">📎 Analizar archivo</button></div></div>
<div class="rail-card"><h3>Estado</h3><p>Consulta el estado de proveedores, modelos y capacidades.</p><div class="quick-actions"><button data-action="status">📡 Ver estado</button><button data-action="permissions">🛡️ Permisos</button><button data-action="memory">🧠 Memoria</button><button data-action="live">🎙️ Live</button></div><span class="online"><span class="dot"></span> sesión protegida</span></div>
<div class="rail-card"><h3>Ocean Hub</h3><p>Tu cuenta y el resto de herramientas siguen disponibles.</p><div class="quick-actions"><button data-action="create">🎨 Crear imagen</button><a href="/shop">🛒 Tienda</a><a href="/profile">👤 Perfil</a></div></div></aside>
</div><div id="panel" class="panel hide"></div>
<script>
let mode='QUICK',conversationHistory=[],busy=false,filePurpose='files',liveSocket=null;
const msgBox=document.getElementById('messages'),input=document.getElementById('input'),send=document.getElementById('send'),file=document.getElementById('file'),panel=document.getElementById('panel');

function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML}
function showPanel(html=''){panel.innerHTML=html;panel.classList.remove('hide');return panel}
function closePanel(){panel.classList.add('hide');panel.innerHTML=''}
function showError(title,message){showPanel('<button class="close" id="panelClose" type="button">×</button><h3>'+esc(title)+'</h3><div class="result">'+esc(message)+'</div>');document.getElementById('panelClose')?.addEventListener('click',closePanel)}
function removeEmpty(){document.getElementById('empty')?.remove()}

async function fetchJSON(url,options={}){
    let response;
    try{response=await fetch(url,options)}catch(e){throw new Error('No se pudo conectar con Ocean Hub. Comprueba tu conexión.')} 
    const type=response.headers.get('content-type')||'';
    let data={};
    if(type.includes('application/json')) data=await response.json().catch(()=>({}));
    else {const text=await response.text().catch(()=> '');data={error:text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,500)}}
    if(!response.ok) throw new Error(data.error||data.code||('HTTP '+response.status));
    return data;
}

function add(role,text,sources=[]){
    removeEmpty();
    const d=document.createElement('div');d.className='msg '+(role==='user'?'user':'ai');
    const m=document.createElement('div');m.className='meta';m.textContent=role==='user'?'TÚ':'AIR FLOW';
    const t=document.createElement('div');t.textContent=String(text??'');d.append(m,t);
    if(Array.isArray(sources)&&sources.length){
        const box=document.createElement('div');box.className='sources';
        sources.forEach(x=>{if(!x?.url)return;const a=document.createElement('a');a.href=String(x.url);a.target='_blank';a.rel='noopener noreferrer';a.textContent='🔗 '+String(x.title||x.url);box.appendChild(a)});
        d.appendChild(box);
    }
    if(role!=='user'){
        const f=document.createElement('div');f.className='feedback';
        [['up','👍'],['down','👎']].forEach(([v,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',async()=>{try{b.disabled=true;await fetchJSON('/air-flow/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback:v,mode})})}catch(_){}});f.appendChild(b)});
        d.appendChild(f);
    }
    msgBox.appendChild(d);msgBox.scrollTop=msgBox.scrollHeight;return d;
}

async function sendMsg(){
    const text=input.value.trim();
    if(!text||busy)return;
    if(mode==='AGENT')return agent(text);
    input.value='';add('user',text);busy=true;send.disabled=true;
    const wait=add('assistant','Air Flow está pensando…');
    try{
        const data=await fetchJSON('/air-flow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:conversationHistory,mode})});
        wait.remove();
        add('assistant',data.reply||'No recibí una respuesta.',data.sources||[]);
        conversationHistory.push({role:'user',content:text},{role:'assistant',content:data.reply||''});
        conversationHistory=conversationHistory.slice(-16);
    }catch(e){
        wait.remove();add('assistant','⚠️ '+(e.message||'Error inesperado.'));
    }finally{busy=false;send.disabled=false;input.focus()}
}

async function agent(goal){
    add('user',goal);busy=true;
    try{
        const d=await fetchJSON('/air-flow/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal})});
        const plan=Array.isArray(d.plan)?d.plan:[];
        add('assistant',plan.length?plan.map((x,i)=>(i+1)+'. '+x.label).join('\n'):'No se pudo crear un plan.');
        showPanel('<button class="close" id="agentClose" type="button">×</button><h3>🤖 Air Flow Agent</h3><div class="result">'+esc(JSON.stringify(plan,null,2))+'</div><button class="pill" id="approveAgentBtn" type="button">✅ Ejecutar plan</button>');
        document.getElementById('agentClose')?.addEventListener('click',closePanel);
        document.getElementById('approveAgentBtn')?.addEventListener('click',()=>approveAgent(goal));
    }catch(e){add('assistant','⚠️ '+(e.message||'No pude crear el plan.'))}
    finally{busy=false}
}

async function approveAgent(goal){
    closePanel();
    try{const d=await fetchJSON('/air-flow/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal,approve:true})});add('assistant',JSON.stringify(d.results??d,null,2))}
    catch(e){add('assistant','⚠️ '+(e.message||'No pude ejecutar el plan.'))}
}

async function memoryPanel(){
    try{
        const d=await fetchJSON('/air-flow/memory');
        showPanel('<button class="close" id="memoryClose" type="button">×</button><h3>🧠 Memoria de Air Flow</h3><p>Solo guarda lo que tú decidas.</p><div class="result">'+esc(JSON.stringify(d.memory||{},null,2))+'</div><button class="pill" id="clearMemBtn" type="button">🗑️ Borrar memoria permanente</button>');
        document.getElementById('memoryClose')?.addEventListener('click',closePanel);document.getElementById('clearMemBtn')?.addEventListener('click',clearMem);
    }catch(e){showError('🧠 Memoria',e.message||'No se pudo cargar la memoria.')}
}
async function clearMem(){try{await fetchJSON('/air-flow/memory?type=all',{method:'DELETE'});closePanel();add('assistant','🧠 Memoria permanente eliminada.')}catch(e){showError('🧠 Memoria',e.message||'No se pudo borrar la memoria.')}}

async function vision(fileObj){
    if(!fileObj||!String(fileObj.type||'').startsWith('image/')){showError('👁️ Vision','Selecciona una imagen válida.');return}
    try{
        const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('No pude leer la imagen.'));fr.readAsDataURL(fileObj)});
        showPanel('<button class="close" id="visionClose" type="button">×</button><h3>👁️ Air Flow Vision</h3><p>'+esc(fileObj.name||'Imagen')+'</p><textarea id="vp" style="width:100%;min-height:90px;background:#0c1624;color:white;border:1px solid #234;padding:10px;border-radius:10px" placeholder="¿Qué quieres saber de la imagen?"></textarea><button class="pill" id="visionRunBtn" type="button">Analizar</button><div id="vr"></div>');
        document.getElementById('visionClose')?.addEventListener('click',closePanel);
        document.getElementById('visionRunBtn')?.addEventListener('click',()=>runVision(b64,fileObj.type));
    }catch(e){showError('👁️ Vision',e.message||'No pude leer la imagen.')}
}
async function runVision(b64,mime){
    const result=document.getElementById('vr');if(!result)return;
    result.innerHTML='<div class="result">Analizando…</div>';
    try{const p=document.getElementById('vp')?.value?.trim()||'Analiza esta imagen y transcribe el texto importante.';const d=await fetchJSON('/air-flow/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p,image:{data:b64,mimeType:mime}})});result.innerHTML='<div class="result">'+esc(d.reply||'No recibí un resultado.')+'</div>'}
    catch(e){result.innerHTML='<div class="result">⚠️ '+esc(e.message||'No pude analizar la imagen.')+'</div>'}
}

async function filesPanel(f){
    if(!f){return}
    try{
        const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('No pude leer el archivo.'));fr.readAsDataURL(f)});
        showPanel('<button class="close" id="fileClose" type="button">×</button><h3>📎 Air Flow Files</h3><p>'+esc(f.name)+'</p><textarea id="fp" style="width:100%;min-height:90px;background:#0c1624;color:white;border:1px solid #234;padding:10px;border-radius:10px" placeholder="¿Qué quieres que haga con el archivo?"></textarea><button class="pill" id="fileRunBtn" type="button">Analizar</button><div id="fr"></div>');
        document.getElementById('fileClose')?.addEventListener('click',closePanel);document.getElementById('fileRunBtn')?.addEventListener('click',()=>runFile(b64,f.type||'application/octet-stream',f.name||'archivo'));
    }catch(e){showError('📎 Files',e.message||'No pude leer el archivo.')}
}
async function runFile(b64,mime,name){
    const result=document.getElementById('fr');if(!result)return;result.innerHTML='<div class="result">Analizando…</div>';
    try{const p=document.getElementById('fp')?.value?.trim()||'Resume y analiza este archivo.';const d=await fetchJSON('/air-flow/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p,file:{data:b64,mimeType:mime,name}})});result.innerHTML='<div class="result">'+esc(d.reply||'No recibí un resultado.')+'</div>'}
    catch(e){result.innerHTML='<div class="result">⚠️ '+esc(e.message||'No pude analizar el archivo.')+'</div>'}
}

async function livePanel(){
    try{
        const d=await fetchJSON('/air-flow/live/token',{method:'POST'});
        if(!d.token)throw new Error('El servidor no devolvió un token Live válido.');
        showPanel('<button class="close" id="liveClose" type="button">×</button><h3>🎙️ Air Flow Live</h3><div id="liveStatus" class="result">Conectando…</div><textarea id="liveInput" style="width:100%;min-height:70px;background:#0c1624;color:white;border:1px solid #234;padding:10px;border-radius:10px" placeholder="Escribe un mensaje para la sesión Live..."></textarea><button class="pill" id="liveSend" type="button" disabled>Enviar</button><button class="pill" id="liveStop" type="button">Cerrar conexión</button><div id="liveOutput" class="result" style="min-height:90px"></div>');
        document.getElementById('liveClose')?.addEventListener('click',stopLive);
        document.getElementById('liveStop')?.addEventListener('click',stopLive);
        connectLive(d.token,d.websocket,d.model);
    }catch(e){showError('🎙️ Live',e.message||'Air Flow Live no está disponible ahora.')}
}
let liveAudioContext=null,liveAudioCursor=0;
function ensureLiveAudio(){
    try{
        if(!liveAudioContext){
            const Ctx=window.AudioContext||window.webkitAudioContext;
            if(!Ctx)return null;
            liveAudioContext=new Ctx({sampleRate:24000});
            liveAudioCursor=liveAudioContext.currentTime;
        }
        if(liveAudioContext.state==='suspended')liveAudioContext.resume().catch(()=>{});
        return liveAudioContext;
    }catch(_){return null}
}
function playLivePcm(base64,mimeType='audio/pcm;rate=24000'){
    const ctx=ensureLiveAudio();if(!ctx||!base64)return;
    try{
        const binary=atob(base64),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
        const rate=Number((String(mimeType).match(/rate=(\d+)/i)||[])[1]||24000);
        if(bytes.length<2)return;
        const samples=new Float32Array(Math.floor(bytes.length/2)),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
        for(let i=0;i<samples.length;i++)samples[i]=Math.max(-1,Math.min(1,view.getInt16(i*2,true)/32768));
        const buffer=ctx.createBuffer(1,samples.length,rate);buffer.copyToChannel(samples,0);
        const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
        const start=Math.max(liveAudioCursor,ctx.currentTime);
        source.start(start);liveAudioCursor=start+buffer.duration;
    }catch(_){}
}
function stopLive(){
    if(liveSocket){try{liveSocket.close()}catch(_){}}
    liveSocket=null;
    if(liveAudioContext){try{liveAudioContext.close()}catch(_){}}
    liveAudioContext=null;liveAudioCursor=0;
    closePanel();
}
function connectLive(token,providedUrl,modelName){
    const status=document.getElementById('liveStatus'),out=document.getElementById('liveOutput'),btn=document.getElementById('liveSend');
    if(!status||!out||!btn)return;
    const base=providedUrl||'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
    const wsUrl=base+(base.includes('?')?'&':'?')+'access_token='+encodeURIComponent(token);
    ensureLiveAudio();
    try{liveSocket=new WebSocket(wsUrl)}catch(e){status.textContent='⚠️ No se pudo abrir WebSocket: '+(e.message||'error');return}
    liveSocket.onopen=()=>{status.textContent='🟢 Live conectado';try{liveSocket.send(JSON.stringify({setup:{model:'models/'+(modelName||'gemini-3.8-live'),generationConfig:{responseModalities:['AUDIO']},outputAudioTranscription:{},systemInstruction:{parts:[{text:'You are Air Flow, a helpful and concise assistant inside Ocean Hub.'}]}}}))}catch(e){status.textContent='⚠️ No se pudo enviar la configuración.'}};
    liveSocket.onmessage=event=>{try{
        const data=JSON.parse(event.data);
        if(data.setupComplete||data.setup_complete){status.textContent='🟢 Live listo';return}
        const sc=data.serverContent||data.server_content||{};
        for(const part of sc.modelTurn?.parts||sc.model_turn?.parts||[]){
            const inline=part?.inlineData||part?.inline_data;
            if(inline?.data)playLivePcm(inline.data,inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');
        }
        const transcript=sc.outputTranscription?.text||sc.output_transcription?.text;
        if(typeof transcript==='string'&&transcript.trim())out.textContent+=(out.textContent?'\n':'')+'AIR FLOW: '+transcript.trim();
        const textParts=[];
        for(const c of sc.modelTurn?.parts||sc.model_turn?.parts||[])if(typeof c?.text==='string')textParts.push(c.text);
        if(textParts.length)out.textContent+=(out.textContent?'\n':'')+textParts.join('');
    }catch(_){}};
    liveSocket.onerror=()=>{status.textContent='⚠️ Error de conexión Live';btn.disabled=true};
    liveSocket.onclose=()=>{status.textContent='⚪ Live desconectado';btn.disabled=true};
    btn.onclick=()=>{const value=document.getElementById('liveInput')?.value?.trim();if(!value||!liveSocket||liveSocket.readyState!==WebSocket.OPEN)return;try{liveSocket.send(JSON.stringify({realtimeInput:{text:value}}));out.textContent+=(out.textContent?'\n':'')+'TÚ: '+value;document.getElementById('liveInput').value=''}catch(e){status.textContent='⚠️ No se pudo enviar el mensaje.'}};
}

async function createPanel(){
    showPanel('<button class="close" id="createClose" type="button">×</button><h3>🎨 Air Flow Create</h3><textarea id="cp" style="width:100%;min-height:110px;background:#0c1624;color:white;border:1px solid #234;padding:10px;border-radius:10px" placeholder="Describe la imagen que quieres crear..."></textarea><button class="pill" id="createRunBtn" type="button">Generar</button><div id="cr"></div>');
    document.getElementById('createClose')?.addEventListener('click',closePanel);document.getElementById('createRunBtn')?.addEventListener('click',createImage);
}
async function createImage(){
    const result=document.getElementById('cr');if(!result)return;
    const p=document.getElementById('cp')?.value?.trim();if(!p){result.innerHTML='<div class="result">⚠️ Describe la imagen primero.</div>';return}
    result.innerHTML='<div class="result">Generando imagen…</div>';
    try{const d=await fetchJSON('/air-flow/create/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:p})});if(!d.data)throw new Error('El servidor no devolvió una imagen.');result.innerHTML='';const img=document.createElement('img');img.style.maxWidth='100%';img.style.borderRadius='14px';img.style.marginTop='12px';img.alt='Imagen generada por Air Flow';img.src='data:'+(d.mimeType||'image/png')+';base64,'+d.data;result.appendChild(img)}
    catch(e){result.innerHTML='<div class="result">⚠️ '+esc(e.message||'Error al generar la imagen.')+'</div>'}
}

async function historyPanel(){
    try{
        const d=await fetchJSON('/air-flow/conversations');const items=Array.isArray(d.conversations)?d.conversations:[];
        showPanel('<button class="close" id="historyClose" type="button">×</button><h3>🕘 Historial</h3><div id="historyList"></div>');
        document.getElementById('historyClose')?.addEventListener('click',closePanel);const list=document.getElementById('historyList');
        if(!items.length){list.innerHTML='<p>No hay conversaciones guardadas.</p>';return}
        items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='drop';b.style.width='100%';b.style.color='inherit';b.style.textAlign='left';b.style.cursor='pointer';b.innerHTML='<b>'+esc(item.title||'Nueva conversación')+'</b><div style="color:#789">'+esc(item.mode||'QUICK')+'</div>';b.addEventListener('click',()=>{conversationHistory=Array.isArray(item.messages)?item.messages.slice(-16):[];msgBox.innerHTML='';conversationHistory.forEach(m=>add(m.role,m.content));closePanel()});list.appendChild(b)});
    }catch(e){showError('🕘 Historial',e.message||'No se pudo cargar el historial.')}
}


async function statusPanel(){
    try{
        const d=await fetchJSON('/air-flow/status');
        showPanel('<button class="close" id="statusClose" type="button">×</button><h3>📡 Estado de Air Flow</h3><div class="result"><b>'+esc(d.online?'🟢 Operativo':'🟠 Sin proveedor configurado')+'</b>\n\nProveedores:\n• Gemini: '+esc(d.providers?.gemini?'Disponible':'No configurado')+'\n• OpenRouter: '+esc(d.providers?.openrouter?'Disponible':'No configurado')+'\n\nModelos:\n• Chat: '+esc(d.models?.gemini||'—')+'\n• Live: '+esc(d.models?.live||'—')+'\n• Imagen: '+esc(d.models?.image||'—')+'</div>');
        document.getElementById('statusClose')?.addEventListener('click',closePanel);
    }catch(e){showError('📡 Estado',e.message||'No se pudo consultar el estado.')}
}
async function permissionsPanel(){
    try{
        const d=await fetchJSON('/air-flow/permissions');
        const tools=d.permissions?.tools||{};
        const names=['chat','research','code','files','vision','memory','live','create','agent'];
        const rows=names.map(name=>'<label class="perm-row"><span>'+esc(name)+'</span><input type="checkbox" data-perm="'+esc(name)+'" '+(tools[name]===true?'checked':'')+'></label>').join('');
        showPanel('<button class="close" id="permClose" type="button">×</button><h3>🛡️ Permisos</h3><p>Controla herramientas de Air Flow. Las acciones sensibles siguen requiriendo confirmación.</p><div class="perm-list">'+rows+'</div><div id="permStatus" class="result">Cambios guardados automáticamente.</div>');
        document.getElementById('permClose')?.addEventListener('click',closePanel);
        document.querySelectorAll('[data-perm]').forEach(el=>el.addEventListener('change',async()=>{
            const status=document.getElementById('permStatus'); if(status)status.textContent='Guardando…';
            try{await fetchJSON('/air-flow/permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:el.dataset.perm,enabled:el.checked})});if(status)status.textContent='✅ Guardado';}
            catch(e){if(status)status.textContent='⚠️ '+(e.message||'No se pudo guardar')}
        }));
    }catch(e){showError('🛡️ Permisos',e.message||'No se pudieron cargar los permisos.')}
}
async function researchPanel(){
    showPanel('<button class="close" id="researchClose" type="button">×</button><h3>🌐 Research</h3><p>Investigación con búsqueda web y fuentes.</p><textarea id="researchInput" placeholder="¿Qué quieres investigar?"></textarea><button class="pill" id="researchRun" type="button">Investigar</button><div id="researchResult"></div>');
    document.getElementById('researchClose')?.addEventListener('click',closePanel);
    document.getElementById('researchRun')?.addEventListener('click',runResearch);
    document.getElementById('researchInput')?.focus();
}
async function runResearch(){
    const inputEl=document.getElementById('researchInput'), result=document.getElementById('researchResult');
    const query=inputEl?.value?.trim(); if(!query){if(result)result.innerHTML='<div class="result">⚠️ Escribe una consulta.</div>';return}
    if(result)result.innerHTML='<div class="result">Investigando…</div>';
    try{
        const d=await fetchJSON('/air-flow/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
        const sources=(Array.isArray(d.sources)?d.sources:[]).map(x=>'<a href="'+esc(x.url||'#')+'" target="_blank" rel="noopener noreferrer">'+esc(x.title||x.url||'Fuente')+'</a>').join('');
        if(result)result.innerHTML='<div class="result">'+esc(d.answer||'Sin resultado')+(sources?'<div class="sources">'+sources+'</div>':'')+'</div>';
    }catch(e){if(result)result.innerHTML='<div class="result">⚠️ '+esc(e.message||'No pude completar la investigación.')+'</div>'}
}
async function plannerPanel(){
    try{
        const d=await fetchJSON('/air-flow/planner');
        const tasks=Array.isArray(d.tasks)?d.tasks:[];
        showPanel('<button class="close" id="plannerClose" type="button">×</button><h3>📅 Planner</h3><div class="planner-add"><input id="taskTitle" maxlength="200" placeholder="Nueva tarea…"><button class="pill" id="taskAdd" type="button">＋ Agregar</button></div><div id="taskList">'+renderPlannerTasks(tasks)+'</div>');
        document.getElementById('plannerClose')?.addEventListener('click',closePanel);
        document.getElementById('taskAdd')?.addEventListener('click',addPlannerTask);
        document.getElementById('taskTitle')?.addEventListener('keydown',e=>{if(e.key==='Enter')addPlannerTask()});
        bindPlannerTaskActions();
    }catch(e){showError('📅 Planner',e.message||'No se pudo cargar Planner.')}
}
function renderPlannerTasks(tasks){
    if(!tasks.length)return '<div class="result">No tienes tareas todavía.</div>';
    return tasks.map(t=>'<div class="task '+(t.done?'done':'')+'"><button type="button" class="task-toggle" data-task-complete="'+esc(t.id)+'">'+(t.done?'✓':'○')+'</button><div><b>'+esc(t.title)+'</b><small>'+esc(t.note||'')+'</small></div><button type="button" class="task-delete" data-task-delete="'+esc(t.id)+'">×</button></div>').join('');
}
function bindPlannerTaskActions(){
    document.querySelectorAll('[data-task-complete]').forEach(b=>b.addEventListener('click',async()=>{
        try{const d=await fetchJSON('/air-flow/planner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete',id:b.dataset.taskComplete})});document.getElementById('taskList').innerHTML=renderPlannerTasks(d.tasks||[]);bindPlannerTaskActions()}
        catch(e){showError('📅 Planner',e.message||'No se pudo actualizar la tarea.')}
    }));
    document.querySelectorAll('[data-task-delete]').forEach(b=>b.addEventListener('click',async()=>{
        try{const d=await fetchJSON('/air-flow/planner?id='+encodeURIComponent(b.dataset.taskDelete),{method:'DELETE'});document.getElementById('taskList').innerHTML=renderPlannerTasks(d.tasks||[]);bindPlannerTaskActions()}
        catch(e){showError('📅 Planner',e.message||'No se pudo eliminar la tarea.')}
    }));
}
async function addPlannerTask(){
    const el=document.getElementById('taskTitle'), title=el?.value?.trim(); if(!title)return;
    try{const d=await fetchJSON('/air-flow/planner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});if(el)el.value='';const list=document.getElementById('taskList');if(list){list.innerHTML=renderPlannerTasks(d.tasks||[]);bindPlannerTaskActions()}}
    catch(e){showError('📅 Planner',e.message||'No se pudo crear la tarea.')}
}
async function codeReviewPanel(){
    showPanel('<button class="close" id="reviewClose" type="button">×</button><h3>💻 Code Review</h3><textarea id="codeInput" class="code-area" placeholder="Pega aquí tu código…"></textarea><input id="codeLang" maxlength="40" placeholder="Lenguaje (js, ts, python, lua...)"><textarea id="codeQuestion" class="small-area" placeholder="¿Qué quieres revisar?">Revisa este código, detecta errores y propone mejoras seguras.</textarea><button class="pill" id="codeReviewRun" type="button">Revisar código</button><div id="codeReviewResult"></div>');
    document.getElementById('reviewClose')?.addEventListener('click',closePanel);
    document.getElementById('codeReviewRun')?.addEventListener('click',runCodeReview);
}
async function runCodeReview(){
    const code=document.getElementById('codeInput')?.value?.trim(), result=document.getElementById('codeReviewResult');
    if(!code){if(result)result.innerHTML='<div class="result">⚠️ Pega el código primero.</div>';return}
    if(result)result.innerHTML='<div class="result">Revisando…</div>';
    try{
        const d=await fetchJSON('/air-flow/code/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,language:document.getElementById('codeLang')?.value?.trim()||'text',question:document.getElementById('codeQuestion')?.value?.trim()||undefined})});
        const local=Array.isArray(d.local_issues)&&d.local_issues.length?'\n\nAlertas locales:\n• '+d.local_issues.join('\n• '):'';
        if(result)result.innerHTML='<div class="result">'+esc((d.review||'Sin revisión')+local)+'</div>';
    }catch(e){if(result)result.innerHTML='<div class="result">⚠️ '+esc(e.message||'No pude revisar el código.')+'</div>'}
}
function selectMode(next){mode=String(next||'QUICK').toUpperCase();document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));input.placeholder='Pregunta lo que quieras… · '+mode}
function chooseFile(purpose){filePurpose=purpose;file.value='';file.removeAttribute('capture');file.accept=purpose==='vision'?'image/*':'image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.html,.css,.py,.lua,.xml,.yaml,.yml,.log';if(purpose==='camera'){filePurpose='vision';file.accept='image/*';file.setAttribute('capture','environment')}file.click()}

for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>selectMode(b.dataset.mode));
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('click',()=>{const a=b.dataset.action;if(a==='memory')return memoryPanel();if(a==='live')return livePanel();if(a==='create')return createPanel();if(a==='vision')return chooseFile('vision');if(a==='files')return chooseFile('files');if(a==='research')return researchPanel();if(a==='planner')return plannerPanel();if(a==='code-review')return codeReviewPanel();if(a==='status')return statusPanel();if(a==='permissions')return permissionsPanel();if(a==='new'){conversationHistory=[];msgBox.innerHTML='<div id="empty" class="msg ai">Nueva conversación. ✈️</div>';input.focus();closePanel()}});
document.getElementById('new')?.addEventListener('click',()=>{conversationHistory=[];msgBox.innerHTML='<div id="empty" class="msg ai">Nueva conversación. ✈️</div>';input.focus()});
document.getElementById('history')?.addEventListener('click',historyPanel);
document.getElementById('attach')?.addEventListener('click',()=>chooseFile('files'));
document.getElementById('cam')?.addEventListener('click',()=>chooseFile('camera'));
file.addEventListener('change',()=>{const f=file.files?.[0];if(!f)return;const purpose=filePurpose;file.value='';if(purpose==='vision')vision(f);else filesPanel(f)});
send.addEventListener('click',sendMsg);
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}});
input.focus();
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function handleHome(env, request) {
    const stats = await getStats(env) || {};
    const dynamicKeys = await getDynamicKeys(env) || {};
    let totalClavesDisponibles = 0;
    let valorTotalUSD = 0;
    const PRECIO_PROMEDIO = 5.00;
    for (let hash in dynamicKeys) {
        const k = dynamicKeys[hash];
        if (!k.blocked) { totalClavesDisponibles++; valorTotalUSD += PRECIO_PROMEDIO; }
    }
    for (let k of STATIC_KEYS) {
        if (!k.blocked && k.type !== 'honeypot') { totalClavesDisponibles++; valorTotalUSD += PRECIO_PROMEDIO; }
    }
    const monedas = ['EUR', 'GBP', 'MXN', 'ARS', 'COP', 'BRL'];
    const valoresMoneda = {};
    for (let mon of monedas) {
        const val = await convertirMoneda(valorTotalUSD, mon);
        if (val !== null) valoresMoneda[mon] = val.toFixed(2);
    }
    const auth = await requireAuth(env, request);
    const safeName = escapeHTML(auth?.user?.name || auth?.user?.email?.split('@')[0] || 'Invitado');
    return new Response(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>🌊 Ocean Hub — Inicio</title>
<style>
*{box-sizing:border-box}:root{--bg:#020a17;--panel:#06172c;--line:#10385e;--muted:#7da0c2;--text:#eff8ff;--blue:#129aff;--cyan:#25d7ff;--green:#17e0a6}
html,body{margin:0;min-height:100%;background:#020916;color:var(--text);font-family:Inter,Segoe UI,system-ui,sans-serif}body{background:radial-gradient(circle at 10% 40%,rgba(0,137,255,.12),transparent 26%),radial-gradient(circle at 92% 20%,rgba(0,218,255,.10),transparent 24%),#020916}a{color:inherit}
.layout{display:grid;grid-template-columns:250px minmax(0,1fr) 288px;min-height:100vh;max-width:1540px;margin:auto}.sidebar{background:linear-gradient(180deg,#031122,#020b18);border-right:1px solid rgba(52,136,200,.24);padding:20px 14px;display:flex;flex-direction:column;position:relative;overflow:hidden}.sidebar:after{content:"";position:absolute;left:-70px;bottom:-60px;width:260px;height:210px;background:radial-gradient(circle,rgba(0,172,255,.24),transparent 68%);filter:blur(11px);pointer-events:none}
.logo{display:flex;align-items:center;gap:10px;padding:2px 12px 18px}.logo-mark{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#08c9ff,#075cec);font-size:24px;box-shadow:0 0 35px rgba(0,161,255,.3)}.logo b{display:block;font-size:18px}.logo small{display:block;color:#71a4cd;font-size:11px;margin-top:3px}
.nav{display:grid;gap:7px}.nav a{display:flex;align-items:center;gap:10px;text-decoration:none;color:#a8c5e0;padding:12px;border:1px solid transparent;border-radius:11px}.nav a:hover{background:rgba(6,126,235,.11);border-color:rgba(28,163,255,.2);color:#fff}.nav a.active{background:linear-gradient(90deg,rgba(18,137,255,.34),rgba(4,64,127,.11));border-color:rgba(31,160,255,.45);box-shadow:0 7px 22px rgba(0,128,255,.14);color:#fff}
.premium{margin:20px 6px 0;border:1px solid rgba(82,195,255,.45);border-radius:17px;padding:15px;background:linear-gradient(155deg,rgba(7,69,123,.38),rgba(5,21,43,.88))}.premium b{display:block}.premium p{font-size:12px;color:#8bb3d7;line-height:1.45}.premium a{display:inline-block;margin-top:7px;padding:9px 15px;border-radius:999px;background:linear-gradient(135deg,#10a7ff,#2357ed);text-decoration:none;font-size:12px;font-weight:700}.side-bottom{margin-top:auto;padding:15px 12px 4px;color:#668bab;font-size:11px;line-height:1.6}
.main{min-width:0;padding:18px 18px 10px;display:flex;flex-direction:column;gap:12px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.search{flex:1;max-width:700px;display:flex;align-items:center;gap:9px;border:1px solid rgba(56,151,218,.28);background:#041426;border-radius:999px;padding:11px 15px;box-shadow:inset 0 0 35px rgba(0,131,235,.06)}.search input{flex:1;border:0;outline:0;background:transparent;color:#eef9ff}.search input::placeholder{color:#6f93b7}.top-actions{display:flex;gap:7px;align-items:center}.top-actions a,.icon-btn{ text-decoration:none;border:1px solid rgba(62,151,214,.2);background:#06182c;border-radius:11px;padding:9px 11px;color:#a8c8e3;cursor:pointer}.user-chip{display:flex;align-items:center;gap:9px;margin-left:6px}.avatar{width:38px;height:38px;border-radius:50%;border:1px solid rgba(86,195,255,.5);background:linear-gradient(145deg,#10294d,#0a628c);display:grid;place-items:center;font-size:17px}.user-chip small{display:block;color:#70a4cb;font-size:10px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 11px rgba(23,224,166,.5);margin-right:4px}
.hero{min-height:315px;border-radius:18px;overflow:hidden;border:1px solid rgba(51,147,213,.34);position:relative;background-image:linear-gradient(90deg,rgba(2,13,28,.88),rgba(2,13,28,.40) 52%,rgba(2,13,28,.06)),url('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5Ojf/2wBDAQoKCg0MDRoPDxo3JR8lNzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzf/wAARCAE9AuQDASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAAAgMBBAUABgcI/8QAThAAAgEDAgMFBQUFBQQIBgIDAQIDAAQREiEFMUETIlFhcQYUMoGRQlKhsdEHI3LB4RVikpPSM0OC8BYkVGNzlKLxNURFU7LCCIM0ZLP/xAAaAQADAQEBAQAAAAAAAAAAAAABAgMABAUG/8QAMhEAAgICAgEDAgQFBQADAAAAAAECEQMhEjFBBBNRIvAyYXGhFIGRsdEFFULB4SNS8f/aAAwDAQACEQMRAD8A+UEkjZqUXcc2NER4bUJzjDcvGvWZwI7tH+8frXdo/wB4/WgqaS2NSC7R/vt9akSv94/WgqaNs1IsajJjQTqxviliR/vH60KZGSDjA8a4kHkMGnu9iUH2r/eP1qXmLIigYK5y2edHDAkltLKZ41dMYibOps9R0pGK20ZcW/0JDP8AeP1og75xqNDUgE509N6yCxqSPnGo1qcMm7MSSuC4XGVxnbxxWTA5VieuNq07JNJ37pOGxmurB3ZzZ0uNG/w66jIMOhO6uRqUcj47VW46iS2fvVsE07BtI8+fKqEDPCZNezytpGeZHjWnbNAYLiCVSkLMAc9NQru/HGqPMlD28nNffyeaEjciTipBYcjn0opoeyldNQbQxXUOR86AA88HbrXBTXZ6lpq0FrbxNSGOOe9QCc7b0SMuTqXNZAYasCME4+Vdv0P0p0QhdcMve8jihaxlyWiIx5kA1SnWiXJXvQvWetRrPjTWtZgmornHPFIAGOe9B35GTT6HI2Rg7VxJQ5Bz6UARymsA6eWaMQsUJLBWAyFPNqKsDpDY5fHemdqoGpSM1Q1Oc4BOOeByoQ5NH3aA8VmoeIMw0nSB1IUVK3scYcd19QwGKju/Ws4rpxllOfunOKYBEDsHb1IFFZGxHigaizh9PZnI6sIwAP5k0wN3izDI8krMWUr8HdPiOdCZXbOWY/M1RTSRJ4b6NkXEKDJKem1KN/bZIADHyQYrNjt5JOQABGcucCnQWkme+sYHjnNMpyfSEeLGu2WDftyWOIDzQGkuzzOW2XyA2FW44rdMZQP5k1aaG3kUGKLQRzfIAx6Uyg32J7kY9IpW0DOwySa2bW2jTvNGhPmoOKTAFRe6NhzNWo3DHbYeNXhBI5c2WUi7bSQQ5L2sDqfGNf0p73VsELLDCo8OzUH8qoA6gT9kcqy+IXDatK0ssUO6JY1OTqzRvNUjaTbsjHkOy5/hWRcZjPeUr6jFLErctRx60ztnjwV0581B+W/Os6o6YQcWJVtRGeXiRRhADgqv0oB8RJ6mnwrrkGBgVkkVbo0OGWgdwTGpHmordFtBHCT2ERY7D92P0pHDYwANtqsXMwM4RH0aAd/OhNJuqIuTfks2AhL/AOxiI841/SteQW6wkC3t+XPsV/SsTh4PMjFXpZMuiDxrly4ouXQ8Mkkuy7E0LTafd7XAHW3T9KxeJJFJKR2UQ9IwP5VpQHEjn1rJvmIc4Ga2HFFT0jSyzapszp4VikxoUY/uimTQJNH27Rxah3SFQD8MVNwxYqzDOfGpXeNgo6V28VrRNNlURxjYxpnzUUxUi047JCc89IoBFJq3NWI49J3otRNbI7JG/wBzGP8AgFXrTg/vCKyx20atyeYqgPpnnRW8/ZjaGEnxZMn8auPdpcQyNcQmScKqpIZMBR129OgqGRvwho15ZVLQwEJ7vbMUBH+zU5PjyoAI3fJijGegQV2Yi2XDHyBx+NaNpf8AYOXtreCI4wvc1MvnqO+aWUUlqOwJ29sTFZWkmPeIh2ed9MYo5IrYDRFbRKv/AIYJ/Ki7zsWbJJOST40yOLUpVYy7/Z09PlUml2w2+kVVtLQkarWM/wD9a/pV9fdYYBGlnaqxzv2ILAeOauWfAOIz97sezXxkOmtIezqJEPeC8sn3YSAAPUiubLmw3TdnViwZ2rSo8y8cBO8UZ9Ix+lHFHEoCrbwHxJiUn8q9Cbaxt+77lDqHPtMuaZFxA25zbxQJ4YiAP4UrzJr6YmWHi/ql/T7RVshJoVBwqIrnGv3YZ/LFaI4eRnNlZ5P2pYkGPkBVPiPE5pnxrkCDoTjf5VUErtIHEh1jkS2ag8LkrpIuvUcHxTb/AGN234ZbKcyxWkuOax2qfpS7u0sdfd4ZAgHjar+lZJv5EDa53byBwKbY8Rn1ZWZgOobcUn8PJfUyv8YmuIbx2xysdlbgDr2KD+VVX4XE51e6wn0iH6Vte+uTlXjLHp2e9WUfiAXuMB/EBS8uHhDcVPtt/f6nlX4TGTtaRbf90P0qF4GjDKwQnyCrXqIEuZZWEsyN4qyahVwWyYOuOHHiqkUz9S46BH0ins8U/CYVG9tDt4xj9KQ3DLfO9vD/AJQ/SvWXpSBWEkk0YbZcrlfrWbd2ckcfaKyyR/eQ5FVhm5dkMmDj0Yy2Fmhz7tAx84lP8qsJ2EK6VtbM+tsh/lR9mcd5seVIuo+yYqfi8PCr8YydMjzlDaLb3nDeY4TaM2NgYIwM/Ssyb3aaQu1tbL/dSFQB8sUl2bkKgjSAWPPp1p4enxx6QuT1GSfbG4tRHoW0t9zuexXP5VXnFsv+4hz4dmv6UaPqVwpWPAJLtzI8BVWSeJIpFbUXIwqgDA8yatHFG+iEskq7EPHE7H9zF5ARj9KD3GOVGcwQpGuxZkA+XLc063F1cSk21uWYDI0rsoHXwobyOZNPa3EDZBLFZNWjyONs+Qq1RTrRLbVlOf3WJNEMEWerGMZNUmdSc6V/wimmSz7U9q87rg7ogGT8zypdzexNAIbe0jjGcmRiWc+Wf0qiil4E2wo7CSXLGEbjVjQBt478h5mkyx2sAIKRyuD0A0A+Zx3vlgUF3f3F3kSN3eelc4z4+Z8zVaLEsipLKI06uwJC/TetXyMk/AEzKWJ0oM+CgUoIXbCqCfSpOGPeOBTkR5VKxrhQMnoPmaNIforsFXOpUJ5chSiAx7o+QFa9twK6uAktwVtoGIAeTmR5LzP5UN29pw66aLha+9yRDeeQalBH2lHLbx3qbaukURl9mqAmddMY55Ubnw9fyrGveGWl85MSCCQ8mUYHzHL6VpSubl3knlOrBIzvk+A8KTDC8koWNCzHkoGfw61LJjjPUkdOOUse06Z464gkt53hlGHQ4IzXV9KPsna8RCy8Qmt7aVRoCPIoYqORI+f4V1eXL/T5W6ao7Y/6thS+q7PAaxQk5OaUJPEUY5ZHKp8rO3jRNSKGiA250TE7VxHnUV1EAxELju6c+bYoCMHBqKkUTE5qc0JqQa1gCAowtANhmrre7qsaRlmOcvLyBBxtp6Y33qkVYkpUPs0t3hWObCtqI1Ad7fkfPwxSr2GS0nQOyklFdSpzseXpS3jcOcZIH2hyp6xBsSuNQPdfyPjXSraqjn6lyvQy1uTPOnaKMoDg46+dMuZtV1p30KVDHoD4kdacLb3K1Y7MzrlgRy8MeYrO1qrkyZKts2PCrycoxSfZKKjOTceixxMGO7fIUau93RtvVPNaHFY17KFkOrslEbH8V/Cs8OcYO48xUcqqbKYXcETny+dMGlh4GgG/rU4GnIIz4daVDMZob09abbBzka18gd81VEjqMZyPA0xHBHRfUbU0WrFlF0akIaME6V36k4rmWGUECNC/kQc1niV+QfHzqGaRW76ire5qiHtO7se2tUdHgZQeg5A+NJEzo2oeIPpjlT4ryRFGkAY5k71ZJju4yGWMOeRxgj6c6yXLpmvj2tFKKeHDLLEx1nPaqcOp8uh9KIrDKuu4YRMwOlkTIbH3gDtXXKdgAj5bbbvbVXDAkZUY8BtU3rTHSvaGPbPGqvs0bHAdeWfD1psVqX+0o+YptncpGdIjXB6v3t/yorqHt5Hkye15nON/CmjCNWhHOV09ELZ9/GsfUUyO2aI5EcTHxZ6zmB0qx048Adx61YRpZkwFjVR9o4H40YyV9AlGVdmhOywjLurMfsx1Xa6XHdQn1oRYTMcRvFKf7rj+dREn73s2iyRscnkaq5Sf5ElGFd2Pgmd2AUL6aeVXQxA3OaVCiRjTsD486dEmtz90dfGrQTXZDI03oZGXYb/DVhMkhFG5pZyF2x6VxIjjzqIkPh0FU6Od7LDyhFKHOcbDHM1luWkkORvnl1pN3cSvsS+kHrVl5rySGPtLgyrpyAr6io88bj51Nzt0Whi4KwFjETFpGKsBsF3OfA+FRNMZWyypnGNlxSu8c7HzqDtjBz/Klsoo+WNQ8gwymc6RtV2yjDSZUEAnYHfFUY0OxPWtvh0YUDI3qkCWWVI1YyLe3LcsCqKylnyepyaZezBgI+XnSoVUnaQEk4xpPL1opfJJbRuWAHZhqIkduurOOZxXR4jhUctqGMBp2wSQFOCRiud7bY1lqAkIx9ayr3JatqFB2DA5142wKzbiABv3jLjwUhj+HKhikuTM+ihICY12B3ptuuGzjarsdtavEQZXWTmAVzn6cqfFYwRyIr3AlL7BYMHB8CTsPxqksq6MkZi27yy6I1ydz4AAc96uRcMkaJ3jSWYqM5jjOgeZY1r3kNrYwqklmSda9pKtwDkbnA+VZ83ErmQTRRySCGTbS0jNtnYVJZZ5PwrQ7io/iZXSVrK7VomhkZNwwGpT9edBIzTSNI+7MSScdaYLCYRLM6FImbSHbYZp8NspVtBdyD9mPun5/wBKZyitifU9FaK3LNgDNaFrYTS92GCSR/BVzgedalvwOdUSS60wxnB0A5cj0rbiuIbK1eKyjZSd9Tb5Pia4s3q/ENnXi9L5yaX7ieHezkccayXja5Bv2QPd9CetWnuzbhljiiiA2ARarw393M6xdkGJ2LAGtIW0GORxkEtnBJ9a83JKXK8mz0sSjKNYdGepvbo4DMFPMtsKtm2nEaqsjHAwTyJp730CNjOT1xTFnV01IrMPIVNzl8UisMcN/VbM08LDE6yd+fU0H9lMBgNgDogyxq/LeIF7iFz+VZV3fSsfiK+CqcfWqQeWRHJHDBfJXueEzIGYoQDy1MCapSWUyIGWM4PJhuPrT27ZnLOWB881At2C4zj+6W/lXZGUkts4ZqEnpGfNDKgw8Ro4ZJolGIgvgSKtmBwxyuR1APKiMSuo0qRj7TvgVR5E1sksbT0Jg4lPbZMYj1feZMkUUHG7hJmacM+rnpOk0SWiM5Muor07Pf8AOr1pw+F8OtssoHIE7/OpzliSdopjjnbSUirb8auUOI17uc4xk1sxXF5MMlo0UjmRk/hRTcMRsMojRiPhZMhfTGKweLSycPkMBv8AOrmkSYx671BKGZ1BUzrk8uBXN2jalu7aCPsZ5lYu2D2hz+FWENpbQvMiIFC5bSOYrxKNFKsh7Ya1GQsi4L+lcbu5eH3VDIyZyI15Zqr9Hek/1Ix9dTtr9D0Fze9pEewS2TJ+NcBh9eVY8igSNqeJuuO3X8TWVeSPFpDOO0zuo30/1qLGxnuVe5eVEgUFmkZwfw8a64YFjjd6OSeeWSVVsvTEAYa4t0H3YwT/ACrrWBrqYpZ27XLKMsznQi+vX8qqwy8OBbVI0xLYXtW7NAPFiMk+gqxJ7TPZwSW1hFbLnYSxoVUDyB3J8zTSjPqC3/RAUsf4pul+W2X5LJbVDJxSaLAB7O3t15nxrKnueGQvNdNGJ7iU5igPKMeLY/Kse5vZJd5ZmkJ86qGfboo8BVoena/E/wDojP1MW/pj/wBmhd8WvpomheXETHdFAUem3Ssedy7d9th0HIUUkurbG1V5tt/EZroUVFUkQ5OT2xbuMnal6vGpZCRkY+tBglsViqSI1srZQ4NANRG9XYeGXt0gMULCMHGtu6ufU1Y9zsrK7SPiM6yKinXHatrYnfYnkKVyQ6YPDOFiWL3y7jma0VtH7rAZ28Bmth7vh3BbeTsLBHupPhWY9oIRvu397y6Vj3nGrubSI5GjhiGiIZ+EeGaqSWt3cR9tcMIYcZDSnSD6DmaRx5fiMm07YfE+KvLCyNL2kjZ1MDkDPn1ONscqxDO6o6qxCv8AEB1qw8cC5MshOOQRedVJWRj+7jKgeJyTQk6OjFGK6FFjRpdSxAiKRkyMHScZpZBPSmQ25kOCDU7fgu+NbKrsxYnJrq1f7PgXaSdVbwC6sfOuo+3IHvw+0eFokOGHh1oakc68BdnvMtMgHJgw8qGgR8HHMHajxiujvaJVRNdUZqSc86wCK6uNRWCFUjnyqBTFUnlTJCthxkA52+Yo2IkZmOzk58jS8eVcdqqnWidWy5BNIm2zIdmUjINXo2glDQqoQFdR0b7j1rM1CIA82I+lFayqkweTJUb7ePT8a6oZKpM5547tovcRuWeNVDBxjAfkcDoRVGOCac/u0LDIGegNWzbq6ajNGJmJLRMCuOux5UuSOS2I7UAAkHSHB1eHKjOLlK5dAg1FVHssSoIuFsrhC5GnKbk79T8qzVGeoHrV8zpNFOhUK7d5V6fLzqgSKTLWqDiTSdhEFef1qMnNCGI3BqQwJywPyNSsrQQ3q1ZSJE5EqxtG+zaxnA8R4GqwG+VGaIPjYqPpVI62JJWqIkYLIwjOpcnB8RXCVgdqb2yuCGjjPTJQZ/Cpe2UQ9os0JP3A2GHyrU/ALXTA7Y+A350xJyo2ZQPApVfYHc12PCgpszimXiRPHvoOORUgMPlSEiySFdcjodqRkg0faMQAcYHLam5p9g4NdDcjILBD40954iSyKUfYApsB8qq51AZ6eVdTKTXQrin2XHuoSuDEXP3jhT+FLa7l1ZiZo1xgKDypIVueNqZHFqOwNNykxeEEWYL65BVdQff7Sg1oRzJvmFck5IHKqEcQTlv4mrUQx0rox8vJy5VF9It5tyM4eMdQe8P1py9njAmQ49f0qoqazvypyqqjYVVWc0kiwViiBJk1E8tI2+tVbiVNOGJGfAb1DShTltx4UsoXBkR3IJ6cxWb1SBGFO2CNjhJgPI7UTGRRnUmB1QgflSSRrIAdj4u21QVdiOWPDlU7L0NeduzZcnLNknPMedcmWGFRFyfiPP6mnIkTyNotj46WkJ0irDxQaBpQo2NwG1A+FMk2TlNLQFrCxfv5yDjFbcIEcZ7oyRzI3FU7CB8jKn5itKeCRVK4ww2qmlo5Zy5SM2Zi0rMdgv41YsFZpYyR3SaIWko0qXOPXlV2xg7ORiW1Y881m9DclVItTnuEUdnlu0J3OAKr3T8xjmcVcsgUjbUMHNQlqBk9jpGkCEE4xtism5YqxIJHpWpN/s2bNZt0hILAqfLIz9K2ILFrdTFNDOceFS0hI3akxhS4EgOM76Tvin3UCJGrRyiTVqyqg5QA7Z9aq6TB2TbXEaPqlj7ReWNRFb1mLIr73E9tEvw9jcZkIPjgV5de7jI2NWIThtqnkx8vNDwnx8HreJ8RSKC3FvPb3DgsSexACDyB5VipdSCR/wB42lm1MoOAT6VW1DQDqBz06ioXBJ6etSx4IwjQ080puz6HwjiYvIGkntYxnkyb6/HbnT5rlJVzHYSOv3tIFeI4TeTWk2uI7EYKnkRXpLbjkRtuxuICQBjKn8K8rN6RwncVaPUw+sU4cZun+hEvGFt7lUgaPsvtYXNXC3vadpFeLIp+yx04rz9xBY3Uuq2nW3zzSVTgHyYdPWltZ3UJKx9nIMZzHIpyKd4INKnT/MivUZE3atfkzfgt5SWLRA4PiDTp3uUC9irIQOgrzVjNdxXSsYnAB31bD61vvLeTxDspIiOuDhvnUsuJxkraK4ssZQdJplTXOCTpkyTuQDvUgTN/um57Hs9/rTpzxELqmkKjycD8BVbtrgsA05G/2n5Uy2vBKWnTstC1uchijZP3iKW1u8WXaMbcyxyKcBGFy9yGPXQpahuPdyuS0sp6ZIApVJ3/AODuMUrX90KF447ok28FG1WII3ZCVtlyeTEY/Ogs2Z2CwW8a45sFyfqav3MI3cjO2xduVLOSTqimKLa5N2I/s+TY3Nyqg8lG5o+3S2PY2yanHxM3T1rKubwRkNrVznfRnA+dGl67xHs0RQf7uSfnR9qbVvoyzQi/p0/6mxLM5hz2gViMak3xXluIQcNt5ma4uJp25lYgMk+bGrU80ksZDyMcdCaxL5QSRnBrp9NhcX2cvqfUc/H9RFxxBmRo4444oi2TgZY+GWO5/CqL3bAbSN6AmglCrkMSR6VWZk31Fh6DNerHHFHmSyNjhdBJFdkR9JzofcH1rrm6nvNpGGnOQqqFUegFUzLGpzpJP940uS4Jzv8AIU/FXYjcmqQ6R0QYXJbr4Ulparl2Y1KIXYLyz40wOPyGzk+GKAvV9OHQspHbLqAzsfwqYOHhN2j1noCdvoOdCxecEUTG4RXZSqNyJHOq0jPkjJ052FehurK7upNGgAxqMgkLgen8qsTW3BeGWRF2HurthgpG4wh9aR5Fpdv8imOVnmYLeWd1AACsfjc6V+prY4RJY8KlF0GjvJsEY0ELF/e35nwqhf8AFpboIgREijGEU5bSPU1lyzStGIjI3ZA5C9M1pRclTLRUm9aNTiXGJbuOWORTKXfWJX5qBnYDkBWNrbV3CA3lSywXOTseg60sykqVAAGfDeg6SpF44wu3ZDpIwAc+JqZb2SXWZO+zfackkVXOTXBcmk5MtwicWJO9OEAXaTOr7o6evhXEBEyCBnoNzQDLHrW/UDd9Bu0ajCqo/hH86WsjqcoMHmDzxVkwokId2Go8lFVpXyNhgVmaLTK8jEucnJrq5hvXVPZdUeSrqNYy3IZpi25+1t868NQkz23JIGHHarqGRnceNPIO+3LnUKqx5wcn0qM1eP0xpkm7dnGoqaigYnrXc+ldUiijHAUSnFcBRFQACKZIVsOF8Nhl1KeYrmwRkfSljI3pqqShYYwKpF2qEap2BRKNwKE1MZw3KiuzMuvMzIqlgcgb4326VXdsMQPhPMeNLL7g/Subo3jVnPkJGFDrRnW4V1AJU/a6VblhtZgWjkEcmc4c7GqUWUbPhvkVDOxO5yTRUlGNNCyi3K0zmXSSMg48KihJzRA4OCN/OojnBscqajI8bmSRg4A0DTnV6npSyPKuA36Vk2gNJhKcHarUNu0yM5dFVebO2M+Q86SYiIw5BwevSoLAdaotdiPfQ02+RlJI28s4P40p43jPfRh6io1dKYkkifAzKPI0NM31IWCTT1t2JAYBPNjgCjklkmjCMdgcgAY3qZbO5hAMiY1cu+CT8gaZL+Yjl+dC2Ts2K5BI8Dz9KLZTj8aNUcaRKBgcg3SpkcSaQsaIFGO4MZ9aokLdnLgjl9asLhkyGAI20gdKrKCzYyB6mrUCAru2GzsuM5qsCc9IYuo4LYHoMZqzENYOdj0HSoihVlZmljXSM4Y4J9KJnRQAhDelXiqOSUr0hwIXbAzXOy6edLjIJ+LSfPauZ1QjXqZc7hWwT88U9k+OxcobbUpVW5MRsaq5kB7hIPkcVbmuTHlYmk7NuSOQcD15flVRrjGQsMe+2WBapTZfGn8FmOYgKLnScjaRSCR64oy6yHIm0jxZstis5c59aaqHO5HyNCM2GWNdmjBNbwlx2TuGXSW1YI9KfZSKkodZN+W69KoxQBhknbzq5BEuVw3LpVYpnNkUdnp+GXFrEp1wPIG55YAD0pt/dwyMTBGYx4FsmsyAhI9W/wDKkvJFg6pmBP2Qtb21y5HFb6LZvUK6XVNvAb1oWEiRxK5iVuuG5H1rFT3dioVlz6b1tywaLXVG8b7fCjbj5GhNLr5Gi2toq3F06ykLpCsckY2q3Z3skaZQgatzkA1i62aXLcs1oW4Xs0y2MjnijOEeNUHk7LN5eEhzIgJbfI2xVKRgTkUN6W1MFZWUbbUTwu0CsIpI8KCS/JvTatGKikFSsiE6JVYaSc5HWrs0shj0nAHgoxWbBFKZlUKS2eQrSuba5ii1SQuF8cUJ1yVlE9FBymfD5bVO67c/Q5pDyYbHZ6h4Haj7ZpP/AJdQfvKSCfWnoRyQ9ZKej5NV4hK3NQB51dghZmA0qfQUkqRkyxAQu551ZaYBTvUW8Qc6ERncc1G1DchVU4ixjzNczpyH2lYgzMTtXGRtJymT0J6UoOC2yAfWmysrAZyAB0aqNfkTsK01vJuxrftHVIiXGRWLYgDfH1rQlnPdOBz5AbVy5lydFsL4qzZLxmMfu98bEsTkVULKJS505HJcUFs2Vx4GudcOa5FGm0dcsnJJlx5/3W0PPnk0HvhCErbwgjYd3NTEpkTCnfTnc86qZwSDSxinoaU5KmWPfrgbagB4BcV08sssJyQQN8E71Sml0gnDHH3TiihnYqMlBnwGTVPbXaRP3W9NlC5Yrq/nR8NuWbKc/Kov1jLuzyMcjljJrH96WB/3cYzn4n3P6CuyEOcaOSWThKz0szJFIQ7Z8dO9ZN/MFJKiu7btE1EnTjO1S6xT240I2RsSTQhDg9mnk5LR569kOTuDnwqm0pPStG6iVWKlDWfJiM7Rg+Z3r0F0cqYstq6Ciitp5jiKF38wu1FJezk5XQmNhoQLiqk09w+dUr48NRobKpNlx7KWEsJpoYQOffBP4VWaSGJs6zJ88ZqgxOdz86szR2tp2TieK7YnLouQoHhnmTQtjrH8svJxCEJp1ac/ZiXJPqTTE4kLcZWFh/FJhvw5VhvdEatACAnkv5UMcjOcAZJo66D/AAy7ZtXnGp7lRG+kRg5CRqAM+PifnVGSUyEA7Ach1q7w7hJnBaZ1jwcBWcL8yeg/Oo4nxQSoLWytLa3iTKlolOZPMk8/KsnWoo0Yxb0UHVlCkrpDDILdRSpVRQRq1HGwUbedEIpJJFVnBZthk8vWulMcAeFkzKG+MNkegrP8yq70Upd2ywpZGnmMZpzkv8IJA8qj3eVlLadKjmW2qTRdOlsSwwN//epYolv2hlQMX09nnvYxzx4dKVcN2IBIMjscKg61jyuzyM5zknNc2XLw0dOLFz/Q3Rvyp0LpFMiOqsTltDHnjxrAjupSNIcg43OcUy1bFwrysABnB1ZyfCgvUJtJI0vTunbNiZ8ucDn0HIVWdsZohKCxUHfqKCQDpVm76JRjWhTNvXULc66p2XSMEfuzjG1ESTTeIWc/D7+4srpQs9vIY5FByAwODuOdLxkZ8a8xP4PTf5gmoojQ0DE0QXNQozTVjNMlYG6BERPwkVPYuoyV28q9NwX2H49xnhTcU4fbRSWilwWaZVPd57GsNCQNs4popMSTkiripKsBnG1NnA2YDHjS1cjlTUgW2rA60SMVOxxUHc0OKCdMbskmiU4GaDmaICmT2ZkdaYBq7vUcqEriiwR3vOmjoDDXSNiSQdqGRWRtLAg0Eh6VaRxLbhZN8bZPTwprUtCO47KwNGpoNOCQedTjFTQzGAjPUelSylSPrSxR4HTanQjDjlkRsqxB8qOIyKdUavqB5hc0tAAeYP4VdguRCmnGeuQ1Ugr7ZObrpF2aW6nto1ls4dPQrEMknxxVBlCEq0ZVgd88xUvdzEsI3ZUPTO9WeH3xtnAnVZoicsrqGx9arcZOjn4yhHS/kBCZZl7OOMHH3I9/mau+4XHuOt2iSI74b4h+GRWhJxeKSI+4pKmgZYQqFHzqhHxaZXzJJ26NuykbrV1GMe3Zy8809qNFb+zZ5CwhMcrKMkK+/wCPOqohlVtLRuD4FTW6J7EYa3mictzSZiMem21Oj4rAVKZlhPIMDkDzoe3F+Q/xGVf8b/YzrThbSIXnkES9O6WZvlV9+Ee52wnMM0wY/wAKqPE43p9jcJHnteIiUHfSCdz51blvyI2Fvo//ALGx/wC9VjCNHJlz5nOl1/T/ANMhb3QdItoAvhoz+da1gbC8iZXs4BIu+FOCfSs65uJtA7WG1bXuCqgkfSqa3k0bnsgkZxjKpvTN0NLE8kfp0/1PTLwywmAxbTxDO5D4H41i39tw+KR198K4JGkDUfwqkZ5X3lmlfyLGrcPDGu0EkfZFTzIbBHrS7fQI43idznr7+TLaSBSQqSMPEkDNWIEtnI7QTNkbCNl29c1cfgUu2Ecf3sAg/Sq/9mXAkZIwGK8+n50vFrs6PexyWpBycPRQGE4VDy1xn6bbUAsnX7rb7aWp1tZ3XMgKAcEMfzFalrwy2nuFSS5jjduehMKPWnSVXRGWbh3KzNkt5YQFkULnpnJq3ZxoBltWfIVuy+ykqqTFPBJtkHXp2+dItuHW/u4lN2rZ20xLqI+uK0Zxe0znnmTiJljlij3Hc57HasedmaTavR3HDrfYf2nCoI5SKcr5HGayp7QRkv2tvKFbAAz3vPHhTKSa0DE0tle0DGVSQRjxrXnJ93UZ61mxyOs+uJEiP/djFXWuXlYdqXZepXAP5UysGTbFxoQSTV5c4UUm2jibUSXUZ2yM1bVIwy7M2+/TNaTJtlC4HeY+dBNcSiNELsUAIAJ2qzcactpA3NVrqJuxjIZWznYc19ayDF7KyTsj5U7+NXWvpyBk428Kz44SXOATjwFXGOpUD5bHTNatjya6Gx3xHxxKx6HkRRrdsQ3dU6ueRk1XRUJOe7+NNSNT8I+takSdIaju1XrR3jYMrFSOoqpFGpOGcL6Dar9vCgjySxbpgbVPJVDRey+OIzBVAfBU5BCgEH1qpd3UkhJZixO+TXHu8lHqaqSOxY71GGON2kPLK6qw1ZgDk4BrnbBG+T4eFAoLHxzRqmo+dVJcrL9m22/KrLd5MjoarQKVXJ3q5AmUOeZrkn3Z0ReqL1kPvZ3G1OmXvHl8qC3DlhpUnHIAVcngZIZJJF7NdjqkIUD5muGUqkduNco0ivE2Rg9KRONLHHTlTIbi0yQ17aL6zr+tMvo7aBDJNe26KFzkk7jp0op1KhnCTjZnzLlSQeYpCSaY8dQa5uI8PdCEv7Ynp38fnXnpuI8XPaLBwxSQcB+3Vl+o511wg2tnJJ70b11h48jnWDdqRIa0OFnitzGBe2EMS9WW6UE+gNWrrh0EgZ4ReuR9lYFbPzDVXHOON0yWTHKWzMsiXTB5itO0wpKdGpVrw25TL+63Kr91zGrH5aqeq26vIkpninXBVX0YP0JrTnGV0Klw7KnEbfbUBWNPbk529MV7X3S3uYzpeUjB3wN/Kq8fA7eUZMlxHn7yD8qGP1MYqpCODlK4s8M0DDbFJkgODtsPGvos/sxZyxgxzShlHeYR6gfPApNz7FGWLVbXUbbZVXQpTr12Dy6Lx9Pn8K/0aPmk0R286rOh869Vxn2d4hYIXntnEY+2u6/UV52SMLkk10pxmri7RWEmtSVFMgZ3G1MtxP2mbcNnxH61OpEz+7DHoWPKhe5dm77EjwG1Lqyu2ujQkhmVB7xPGf7itnHyFWeFxwySsZZSiKpJIwMjwyeVYolJ61YgLkjs11N4YJ/CnUvCIyxutlzil4jIIbaNYY+oHM+p61lOyYOldyMZam3MMozJJ2ag/wB4flVfJ04A3qcn4K4oJLQbTsrd06lHINy+lIaV2OWYk+dHoJ8PrUDskJNw5SMAkkDJ9KRlUkukKuoRJGJGfS6qT5AdMnxrGkKgE59BWlPdLPGExhWH41mO0agjAcnx5D+tcOdpu0dvp1JKmJUEvp2wfGjndS3cUdN/0FJkO9RqyK42/B2Vey7Yy5uS0jEswxmtHWTWNBJ2cgYjNaStqUMORrr9PP6aOXND6rGE711KOc866rcidFn2vt5bv284xbWsTyzy8RlSONBksSxwAK9jw39jHFprZZOIcRtbSQjPZJGZSvkSCBn0zWh7CWUU37Xfai7lAZ7SSUxZ6Mz4J+mR868v+1fj3ELv2zvLT3maO2sWEUMSOVAOkEtt1JPP0ryHKXSPVSXbM7209heLeyYSe67O4snbStzDnSG8GB3U15Ub19/9lJpva/8AZVcRcXczSmKaBpX5sU3Rj5jbfyr4EowoJ6imhJvT8Akq6LFhZXF/dw2lnC81xMwSONBksTX021/YxxlrQPPxKzhuGGexCM4XyLD+QNVf2EWsU3tTd3TgF7W0Jjz0LMFJ+mR86r/ta9pOI3Pthd2SXU0VtZFY4o43KjOkEsccySefkKzlJy4xZlFKNs+l+wnC73gfsNecO4jF2dxG9zkA5BGDgg9Qa+G+znCb/wBoL2Ow4XB2szLqJJwqL1Zj0Ffcv2fcWueOfs/FxfOZLiJJoHkbm+kHBPngisL9g/D0j9nb6+UL201x2ZY9FRRgemWNCM3BTfk0oKVIyn/Yzevb97jNsJyM6BAxXP8AFnP4V879pPZ3iPszxE2XFIQjkao3Q5SRfFT/AMmvp91+z7i1zxd+Kye2VmLwy9osgyNBzsB3tgOWK0/2029rd+xkNw01vLd2txHh42G+rZgN+R2PyrLI+SV3ZuCrSo+D6ule19jP2d3ntbwmXiFtf29ukcrRFJI2YkgA529a8WVANfdv2EuY/ZC/Yb6bxzj/AIFp8spRjaBjSbo8vwn9i/FrqyS44hxCGylcZEHZGRl/iOQAfIZrxvtb7MX/ALKcSNlxAI2V1xSx/DIviP5irll7Zcbb2og4o3ELgzPcqWUyHQVLYK6eWnG2K99//IEKbDhDgDUJplz1xpBx+FaLnGaT8hai42jx3tT+z679neAxcXnv7eaORo1EcaMGGsZG5rM9jfZib2t4q/Dra5jt3SFptcilgQCBjb+Kvqf7WYyf2c2vlLbf/ia8t+wlce2FyT/2B/8A80rLJL22wOK5JHivafgE/AvaC44Q8i3M0LKuqJT3yyggAc+uK9pwT9kHGbmzWXiN5BYGQA9iUMjjw1YIAPlk16CzsYL79vPEHnAYWsQnRTy1CNAD8tWflWz7e+yV57ScUVz7RW1paxIBFauD3T1Y94ZJ8fCleRppXWrDwVN0fKfbT2F4v7LgXVyyXVmx0+8QgjSegYHln6VZm/Z9dj2SPtHa8Qtrm2EAn7JI2D4+0PDI3z6V9YtOELD7F3PA+McXtuIEwyIsusA6cZUbknIPI+lec/Ynex8T9n+I+z92QwhyQp6xSAhh8jn60fdlxcvh/sDgrr5PlHAOFzca4xacMttKy3MgQMw2XqSfIAE1t+2PsXcey9xZ20t7Dd3N2CVigjbIGQBz55JwPSvW/sl9mJbP2u4rNdJ/8L1WyE9ZGOM/4R/6qd7PXsXtP+2K5u3IkgsonFsDuMJhQR82ZvnVHkak/hIXgq/Nmbwj9j/F7q1WbiF7BZOwyIdBkZf4sEAHy3rK9rv2d8X9mbY3rtHd2QIDTQggx55alPIee4rQ/bLxy+f2qPDVnkjtbWJCI1YgMzDJY+PQfKvafsp4lP7Sexl3YcWdrhYna2LSHJaNlGAT1xkj6VP3MkEsjevgPCEnxSPhROKgMQaZcRdlNLFnOh2XPjg4oFQE8wPWu5Ns5XSDjlkRsxuyt4qcVftruNu7dQq7Z2mGzL69DVJYhviRc/nUlGBOMHHPFUjKUSU4xlo2luLORwGZT/HCAD8xQyxMsjPC8SrzVRKpJHkP5VjBjTULfKrrNfgh7HHpl/3onHaJGwHin6U9L6HBA7rHkSAV/LP51na18M+tcq6mOBgU3N+BXii+y+00sracRn+DFW4bF5QDJGAvihBb6ZrNRVTzNS0ukbACnjL5JSg3qJcuLR0HdilAzzZef0quk8tvJlGaNx8qrx3ckTEo3MYIO4I86iS4Mq/vXnZ87EvkY9KDmvAyxy6ls9Xw67muIgLlZYQeUiggN+lWrm4s4RomVyfHQSfk1eNjmeLBWVj5BiMVpwcanRDEZpjER8LPq/OipX2cOX0T5XHr+hq3EdpcBBHfMEG+mRTzqWS2tlURrPIzcm0gA+lZMt/FMgLxlX5EoAMjzHKrNjduhIwXjA2zsaqnXRN4Zxj/ANFu6u7prcQsjpEDnfqfM1QzISFXl9KuzXkMoCntVHkQRTmw0aECObJ0rlDqoixk4L8JmOzqcZPyokyR8Xyq5IurKNbhc/dTB/GuisWLHuyBR1ZcVh3kjWzrdBnfNXoLKW4DdkmrSMnGNhTbbhzsB2aSPnYFV2q8nDpoxpIAYfZ60ssiXk5ZTt2hKcPlhT97FKD00qDmjW0uN3MZRR1bar81jdRxpvqDKCdOdieh86rvYXmksEbFSWW/KA4u+jNliVXcaXZR8LYx9aSdSrscZ22rTj4ZeFixPZDxc4/Ci/s8k6bi4RSM6cLzqiyx+QU/JkQOI3yU1DqucZp9zJ7xhzHGhG2EXG1Xjwnv4EiOMZJVhtR+5xaMBe/4tyPyrPJC7QdmQYyQCoz47cqYkD7ggD151rR8OfGYpNR+5uCaEWUoOqRTCPvSnQPqaDyx+RlGXwVre3OxwAScYxWqsaIpUZzj61Z4ZYwT3Kgy6wBzijJUepOKHi1xYWWqO2HvM+cbPpRfU1zSy858VdllicYc21X6lOde5VaOwurk5hgdl+9jC/U7U54+IznEskFgpTKrHEXkb65P5UE0lxGEKRYmUYEtxuc+IBOBTxculQsoxv6mMNl7u+m5uoI3I2jQmVz/AMK/zNS/YW7aFt7+aTGcCAIMepJ/KvP3XE7oStHNxPJ+0Yl1Y9TtWC3G2hmZlaR31ZDdoR/yabg6uUi0MV/gj9/2Pee+zKQosAmdszO39KZ/bc1qsjrJGSg3SC3H/wCRrxCe2XEUO0hKjo7Fs/Wu/wClt9P2jSTMhwcaAN/Kk4Qbppff6jvB6hbX3/Q9bL+0DiMJwIEC+LE/yrP4h7Zm/wBr2xguAOQd32/GvNN7Q3rgATP/AMRz/KlTX090jGaWZnyNKj4fPNOsWFO4xRde/wBT6/X/AMPR2/tDZjJPAbZtsj97J+tW732vmvbUW0nBoZIxgBS7lR4V5OB7tcNHMyb5wCc/Sr0S3MuVknmKc23wB6mn9qLdtfu/8iTyOKa1RpANI6M1pw+0AOohcsT5czQrBcIzy210dZO5QFQf5ClRtZwr/tFZuXMt9atyXMMUAkkfQpHd1LjV6D+dWSo4JSm3pfsWgl+sH7+8jYHmsYyT88VwlKbJcRK3pqP4VjniMDIQkhJJwBjl+G1Jk4x7srBkXUNgCMH0peAPYyTfR6q0nl0kvIZPMR5q3HcWqElxFnmVZxv5nrXz0+0D4InlZgTkqnT1NVrrjjMgWAFFz3jndv6eVSnDH5ZWP+n5m9n0wcesbUaoS0xZsFYBhQf4jVxPafhbWxaQN2pJVNUndJ6Bm6V8dTikwcsHIyMYB506I8QkGlYHCNvmXuL9TUngwS+Tqj6SWPyl+p7699tbwMY4DFEFPwx7/U9aZZe2kly//WrhkU7PpXOPMCvG23DY5QzX3F7aFwCTHEhkYgfQU22suDh1aS9upAdwAFj1D13qyw4GqUAOEUtyf7no732puIZVKSBD8QOc7HxHgfOsXiNzY38DzQCOK6jYa44z3JFP2lHQg8wPEGr89p7LTwyiK0nSfRlFN4cAjnvjnWHY2Xs8128jX17ahAf9oqyLk5G5GDjl0ofh2oUHFCFUpNlRwNzSTz5VdvbY2s7RGRJBzV0bKuDyIPhVNwueZ+lM/ktFgh8Gr63Mhj0xh0UjGlX0r+pqvBJBGpzbdq55M7kAfIfrT5HuCugosSkfCoxtWiLPb6Ed0k62Ax4CmRwNMcQIzY5scAD18KWIlQhpGGAeQPPyp8zxaB2bvjOyAd0f18636gb+Bc9okJPbXCZH2Yu8fryqlKgkR0RCdW2/OnuMnes284jLA5igRQFbvFhksf0qOecYRtl8MJydLspy280RwO8yk7Lvy6jxqk75c5GPSjuLmSZgWwuOQUYxShzBIz615MpW9HrQi0vqO3YHAJFTGBnvb70/UpQqowTzI2+VI+FiDQarYydly3gi0tLISwU+Gxq4WGnI5YqrH3rUICNzk1E8nZqgJ3znA8K6oSUInNKLlIry3BZ8k/TpXVXYb11czySs6lCNH0ew9p4fZn9r3G7m7J9xuLuaC4ZRnQNezY64I+ma9f7V/s5s/bDiY45wbi8UYuFXtmRO1R8DAZSDscDlXwPWSck702G7mgBEMskYPPQ5XP0rna8pl/1PvftZxng/sB7EH2e4XcLLfvC0SIGBcF865Hxy5nA9K+CM3TwpZYsSSdzzPjUZporigPZ6/wDZj7TRezPtRHc3jFbO4jME7AZ0AkENjyIHyzX0/wBr/wBndj7W8RHG+G8Wig94VTM4USxuAMBgQRg4Ar4EDTVmkWMosjqh5qGIB+VDju0wX4Z+m/ZWDg/D/ZKaw4HdC5t7VZo3myP3kuCWPnuelfN/2M+2Nnwhrjg3FZUht7phJDNIcIr4wVY9ARjfy86+Vq5AwCQPWpBplBU0/IHLpn2a7/Y1BPxFprLi8cfDpH1hTDqdFJzgMDg+Rry/7TLD2S4PNBY+zbSSXinNwyz9pGgxy/iJ32O3zrw63M6x9ms0qx/cDkD6Uranip3bkBtV0GGya+5/sOI/6HcQHjeP/wD81r4VyqRIyjAYj0NHJHmqBF8XZYsgRf2v/jp/+Qr69+3ohuHcJAIP/WJdwc/ZFfGNVTrzzrOP1JmvVH6Mszwr9ofsFDZ+86JOyjEnZkF4JkHVfDn6g1W9hfZvhHshxiazPExecZuYCxULpEUQI6ZOMkjnzx5V+f4p3hOqJ3RvFWIP4VDSszlmJLHcsTufnU/a00npjc+nR9P43x9fZz9sl5xJwWgDJFOF3JjaJQSPMbH5V6r2s9h7D25uIeOcI4rCGkiVHdU7VJAOR2OQRywa+DFsDc70y1vbi3cm3nlh1c+zkK59cU7h006fQql3a0fVfaf2O9kvZL2ab+0LiS64yyERLHLoLueR0b4UefPHnXmP2X8ZHBvbOxkkfTBck20pzgYfYH/Fprx0srySF3Zmc82Y5J+ZqAxp0vpcZO7A3tNH6X9sL+29m/ZzjnE7UKlzcb51DvSsoRT8sA/KvhfsL7RD2a9pbXiMis8IzHOq8yjbHHmNj8q8+zlhuSfnQ9aWGNRi4vdmlO3Z979qvYzhnt9JBxvg3FY1kaMI7ovaI6jlkAgqw5b1Nxc8J/Zf7JScPgu1uOKS6mVNgzyEY1EfZUbfSvhdvcTQZMEskRPMo5XP0qJHZyXZmZjzJOSfnWWB9N6RvdXhbPbewPsOvtfbX1xNxJrT3aRVOIQ+rIJJ5jFeNnKpPIkT60VyFYjGoA7GvdexftTw32e9iOMwm6P9q3hcRQiNtu7pU6sY6k18/CjzqsHNyd9CTUaVDVc0w4Y5UY8s0oL4b01Ukz8BroVsg6LC2dwxIRVfC6u46nb6/hQFWQ4cFSOhGDQLIQd6iSVmOSWOfvHNPpE6k3scr7jarCPGeakelUkPmKvQWskmoIVZgM6RvmqQbfRPIkuwu597HqKU4LgsGQY2Cltz8qMW8zlhHGzleegZxSWTHxY9M07sSNfIDEg4IAI22qQaLs8gkYwOmd6Z7uwUMSuD4GlSY7kkBkipVTzpiwHqRTUhGedOosm5oOCMsRmtJY9EecUFjBEHUyamHUKcGn3OFXCsceYq8VSOHJPlKkUmYk5p8UkikaGYHyNLjjBO5+VW4YQWJAzjwFFIE5JIsrPcaQWkYgfhV2DiF2OcpbVz19786pourartpb65ArHGeW2d6LqtnFOvg04r64ZQuVyeWlcZ8qct3PpID8+tVYE0tgqdwfka2LC0VxkKDXNkcI7ojFNi1vLxI1XWwjYcuhpkl9O0ZyzHPM5rWn4e0sSqsROwxgVRu7SO1Qm7mjh8mOWP/CK5I5Mcn1s6Hjyx+aMqWdiGOWzjbB/OqP7yWXECyO3gqkn8K1TcWCgFYxN90SHOr/gX+Zqjxb2ijmRIoY9LAYYE91fRRt9c114+bdRiL7SkrbDSycb3l3DAekZbW/8AhXP41oW62pkWGCGa5f7TSyCJR6/1rzfvsawdnbdoZmPfdRjb7o/WmR3NybE2yxRxpq1NI2xPln9KaWKUu3/1/wC/uGPGHj7+/wAj0N3xiHh6yCOeOKUAgC1AOD5u38hWNb3qXNyk147TSZ+zl5X+uwqld2vutsbq/hudJ2QBCobzZjyHlQXPFobe0jjt5rdCBnRbIef95juTWhihFfT58lZOc/8AB6y5u5IoGgRIbJJB3tb65SPQcqw5ONWNgzpa24nmAOXkGfoOn515K64pI4P7zSDzxWZLdK2d3P0ApVjhBUy0fTTyO5HqZ/bLiceTbvFbr0VIxvXn7j2k4q7yN75Ll/izg/nWdNK4Ud0YbkR1oEhlc7gjPjSur+lHbDBBL6kMm4jdzKUklJU8xgD8qBXUxlGjUsTkP1HlV+24SpTtJpAnqKbFw6BiSsysfp+dMsc3thebFHUf2M9IO1ABdkAGxKZBPyo1sJNW7LjyNbkFhJgAgMoOwY7Vs2/BtTANEgfGcKc/+1V9qKVyOafrK/Ced4Zw3M6rhyG7pIXOBWnDwvs1J7NQB9t9hXorMcMsluEubiPtezIVI23z6157iXHIdfZxW3asNgGJ/Knh2+K0c8nmybXkdLBiIdmVxzJHxN6bcqyLqG5ZjJNmKI7BXIRQPmaYye0N8o7G1lt4tWQ2OxX/ABNihueASQoZLziNq0vVIiZmHqeX40XNdIpiwvHucl/cpvd2sHxzq2OkfeP6VTfiQZCBGc6shmbOB4Vd7Lg0CNrhubuToZJhGo/4VGT9arPxNLdsWdnawn7yx6iPm2TUZTmu9HXCEf8Aim/2CT+07xAttaOyDcFItvryps/Ab+dPfL69s49ZwczBmH/Cuao3PFb24GZrmRx4Fjt8qBL3tVW3uZCkednH2c9cdalKcZfiZRQyLcUl+7LnufCbfae7ubhhzEQWNfqcmlyXfDY9rfhsTf3ppGc/mBWQ2QW8jvUCGVz9lB96Rgo/GpPIl1EssF7lJ/1r+xrf2vPG2m3EEA/7iNR+POl3Fw06tJJcNJJtsSSfPfyrLXVGw7TubZG258x+tHCHupext4yznJGWHL57UFnfTG/h4RdpfzHPORgK3LrTWeYWyzMCI2JCMeTEc8eONqzwd8H51Yi1zMsKZCs3X86CyNsaUEh0V/LGwKSFWHJvClq7PIRrADHdmOB86BoRrZUYEA7H73pVm6tle402iEJ3UG5Pexv+OaPLIwfQmacIhFrB2JZzo752wWyeXlyo845IAfE71EcAgjWNRsgxUljjZcelditLZ5zabdBHVI+WOWO3LFNktmRASy6vuA5NIi1vKojXLZ2o3umOQ2PQbCimhWpXorSkqTTYLorE6aggYYIVck/Oq70K7Ul7LcU1sN5OfP51QvDBr1zEZI5ePhVyQA8h86zbqxMkpdX0g8871DM5VpWXwqN7dFKdo3k1RxhVH2c1EUTzSBYwMnzwBVpbB9QDuoGd8cwKdDZKu7sdQO2k1xLDOTto7HlilSZVuLd4FbKLIMfGuRikLEzRtJkEKQCM779fStp9LAhhkHmDVKVWtg0kJBGkoQwz3TtT5cKW10JjzN6fYiCRYwVYbE5LeFKuHBlYg5HIGpjUSIxyQVxn0pTLUJN8aLxS5Wd2ZYZyB6mupTKc11Rv8ilfmIzXZrqiplggamhFFRTAwhU0INcTTWCg84qQ1LohtRTA0MzU5oK7NOmLQwtkCgzXVxo3ZqOzUg1FdWsxOaI/DnNDioJopgOzU1Gdq4GlCMLcsj1oxSKbHuMU8ZWxWtBjFEMVAFGFqqJsJQKI4x/ShArjTiEczgUQFCBTAhwSOnnWSM2D5bUSkjpUEY51IPlTIDLAuG7LQUjx/AM/WkFgTsMVBOamONn3AHzOKLbehVFLZYgdFJ1xBhjGAcVJk0klBpz4GllAoGWB8geVRkHrvTptaJ8U3ZYW4n7MxCRlQ7lQcA1y5pag55g+dPXOKorYjpdEjNMFcoG+R9KNVqiRJslc86swr1POgSPercEdUijnyS0WYE0rqPypMx1NirT4VcDwqtjfJGfKqHJF27JiXeraKUAwCM77UqFe6DjrWhY27XEhQaQNJyznCr6npTdKxMkjrZNb7AnYnYVvcJsu2xIhIIzgLzBFZ9jbIv72RWfHg2lfmef0qzNf3E0ggt2EMCjBEQ0j9T86jl5S+mJy843bNiCyijws7oj/AN5t/oN61bTsLdx2cTSeLPsPp+tedtbq2txoWVQ/UjvMa0IOKW4IRVMj9WlbAHriuHNinL5Y+PKk1Wj091fsYhHHsWHNenlXmeJWMUhIuHZSeSrgt/T1NV+I+0ZAaO2OFAxqUac/0rzc3GZ+zlEe5kHxEZIFH0voskVa0X9RneeXzX9C5xmG4tFaCw7JRpxI6Nlj45Y7fIVgraBJEE8qFmBOhWBI9fCgv470Ni6lCjG4L5x5bflSA/C0izNc3IlUnIWNSG8MDpXqQXCO3YYY5VV/0RpNPFZ6lEa5xuSdRH6VSh47cicyWkeWTZHZdWnzA5Z8PCqNxxBeyYRJrznGr/nnWa3FJ9OnUVXoE7oqeWcVovh9I+2tl6/vbyeRjdzyMxOT2jkknzFUHuN8DJxzJqoZ3kY+dOitWlIB1EnYBetc/Ny/CegsagvqIkm7RsZAx0WrNvamTGQ2TsM8z8qvW1rwuxw3FL2OIj/cx9+T542Hzpl77R2do/acChi7MDTmYZkHn4fSgpRT+pk5SnLWOP8APwPteCO2kurKF5Fxy+VaNtZcPh7Qyy6iFJYL3jXi77jd5fOWlmkwea6tvkKVBLKwJEmMeLYor1ELqKJS9FnkrnOv0Pc3d3w141WJ5CQNgV2+lVIDwsTfvJiMnflgevhXlnkaNcvKwY/Z1ZJ+XT50u2Wa5ZmDrFCvxSvyHkPE+Qp/4jxQI+gST+p0evuuNcOtiY7cLcNyXSCR6dM/SoxxOSMG5nXh0L/7tmOsj+Abj54rEt76CyT/AKkCJTzmbeQ/P7PoPrRm52WR+8zbqp/M1aErW2KvTqH4V/NntfZ8cF4ej3Mts946brJcNhCegCjnRce9pS0jT2SQ2m2P3EYUn1bmTXi7ni8j6VOyr9kch/U1Re7a4bSWwSdz0Aqcvb585bYY488lUnSNm84z2qu1xKZZ3GAXbOnxJJ/Ksi74g74GsAYyPH+lZ1xMqtmIlg2dJbnjzqsZGY5bmahk9U+kdmL0kY7LLXJyfOonkjjKhJBJlQxIBGCenyqswJNQ0Z1HBJUdSMVyvJJnWoRQTTE7DlQdoaaYkWHHORv/AEj9aWIfH5mptSHTicZ2DK0Y0sBuc5yfGlszucsSSd8nrTVjHRcmrUNrJK+pstn8f6UVCUtAc4x2UVXwAO2+aasTHGBz6Vb7DtJQsKhvMcjV+G1FvE7zDbz5sfCqRwE5Zvgy5bdkWLIwXGQvl41biiIRlRCHYdB8IrQj4fNOO3kXLv8ADnYADr6Dp41oxWTwwqOzLO+6qObnxxXRDDTIzyXo897uyYkK6Qp2B5k1o8HtMr71KW2b92vQn7xq9JweWR43ucLHjUEHUeXl51YdBGNIGABgAVaGNJ2cfqPUL8C7KMxwxyM0hj1AUegqzcrtnBpDzkoFWOJcdQm59SaeTEhtCCzHrUb5oiS3M0OmpFkc646r8jmhUkHYZqzDbGVWCsgbB2IJJqu0LKcGgzKSejs5JJOPSlvuM53FSwI8KEnag2OkATXZriM1BFIOQaEoHBVuRGDUvnnjauJ086V/mMvyMmI9lIc7qQVYeIqxJbhWVV7xfGn59aRfJpm1DZX3+dRDM+lN89kcrXCmk3FnY02lJHMoB3rqFYZHyVUkeNdQ/kPa+Shmurq6uQ6iRU1AqaZAOzU1FSBWASKmoqRTIAVSKgVNMKdXV1dRMTU786ip6UQHMSdzQ1xNdtWsx3SoztiuJ2rqUJINH86AcqMDI86ZAY2FiWwd6fSYhjemMwFdEXUdkJdhE1w3pRJc55AU1BTRdsDVBgVNdUE0/QhDGuzioqKDCSPOmKMdKFR40wDNGKA2RzqQDmiC0ainSEbJjWrMZxjHSkimKccqtHRGWxmQoyzKo8WYCn2jW00qx+9wIW+05IUepxWPc27JmQMXGdyeYpcZxSPLJOqD7KlG0z1sthc2ya5Ij2ecCRSGU/MbU61TO5rK4ZxS8gZI4JmAICleh9RXteBS2twjrfWUUwO5lX93p59Rt9a6lP6eSVnl5lOGptGFJkt5UdtZyynurgc9THAx61tXEnCO7FZ2geRfjmeRipPkOtKveIIC0t5LuFwq438gF6CnUm/FHNKfH6Y7YuOwSLSzDtPDUCFPoOZ/Cm3F1HGw7WRNKD4SAFT0UbZqhPxOWezeePRCi7ZY95z4DxP4V5y4mmkAdx8ZIUcyf6UbS7Nj9Pkyv63Rs3ntAxZhGSEPJjzPpXJxUTcOlOtVnVtKxgc18fWsWK1MtutxJPEoZioQnL7ddPhV+xtLUqV97jE4baJlILDyblRhvfg6penwwjVdD+F3d2kw7GP94OT4+Gtq1eJ2Nu11FGebs5PeP/PSsm4v4geyilCKv2Y11E/PlVYXkcYkcQ5fkus/yFVkrISxPI7qja4ndxdktrbrE2hiTMoOp/r0paWdyeHTXKQqsYwCXz3jnp5Vh219cxapEmaORzgaB3mz4Um54lcOskTzTNl8kM5xnzHjWdRVIrH00ukPvbh1dklkUvywp1Y+fSqEifu2chscgQuQT5mgjCtIHmBMYO6rtnypVxezmM24lcW2susWrug+OPGo5J62d2PFWkBNKCCFJAAxtVVnGMbAedczAgnYY6E86TuTyya4Mk9nZCCRZSRQwwM+ZH5Cpu+IyRK0EDaW5SSKd/QHw9KsWfDnlCs0qI7HCKzacnxJ6AVHEvZq/sEkLQGWJDj3iHvpyz05fOhNZVDWrFjLC502YLZyc86OFGYF9goOCT4+FNEHMu6hfI5NGysygRo2kbDAyBXHHE7tnW5rpAalB3zip95ZAdBC+YGT/SgaPSf3sgT+6O830oT2RwFjbA3LM2/4bCjcl+RqT/MsWx1KXlH7rO/i58AfzNOkuJJiF7qryVFGFUeA8KqSSlyMgAAYVRyUeArte2PE06nWhHC9lhWPaBSAQDv6VZWdpJNbEjJ5gchVEtpBH18/KuDMRgZ58qpHI0I4WWZJ8g42pemZIBKUYRyEqrkbHHMCjSIZy7DA+LHj4UUztLpBJ0qMKPAeA8BTO3tgVLSEFcHOc+Y5USQuVd1UkIMs3RByyadFATkkhVX4mPJf1PlTGbtEESKViBzp6sfFvE/lQUAOfwVwNtMY2PNyN2/QUZXYYyzY28hVoW4hRZJACW3SM/a8z4CoiY9o3ZJ2szHJbGFFOoV2I530KWARx65u6D48z6U2G2SVs3BeKHBKqq5Zz4f1q5FZxovvV9NnPJjvnyUdfypsKPfSYt4hDEg70hPwjzPIU6gvJNzfZQSHLBdAJGwQfCvr4mrtrw+e+kaGEdwbyNyHzPT0poltv9lYxGcDYuchW8gBufU0TyfvOyfEzgb28Z0xRj+/j8tzVKSQqtssRQQW6MLYLOV2LA4QfxNyx6V0SwswkkxJKfhkdcKB/wB2nUeZpXaYUNI2vfKgjCD+FOvqa6CaS7lYxghc9+Vt8+Q8fTkKZbBJqCtm+byJbFYRGveO+VDyyY8+Siut7sRO7LEpZhgmTvbVUhwselSfMk5J9aByVbaqKKSODJ6qcnUdFm4meVy7sWY9TVaZtS5wKItkA7VXLndTinbOaKbdsVMNYPLNUWXBIJxVuTIODVaUDORU5HZj0KwDncbDO/WpkmyihVVQvgPzoXIPQClE1NujoSsvWPEZLXtNGBrUjOOtU5ZWZiW5mlE74FQQSM0rkwrHFOw9RNC23SgBxUE0tlKJY0JNCTQu4VSx5AZpGx0gZp1i06w255gbUsz5VmYDY7VSnkeQ94k+RqHcqQNWogYz0HpXLLNs6VhVBXLtIrE5IB5mq6kq2RyIxRq+cg8jUEZ51zvbsvFUqPSWMckHD7bRpPaR6zkdSTXUmLi0K28CdkxKRhTg8sV1d8ZRSSs8qWPK5NuJ5WurhXEV5B7p1EKGiooxI51NDRDlRQGTXCoqRRAFU0NTmmFJrq7NdRMdXZrq7FYxFdXYrqxiKkV1dWMSKYnKlimJyp49iy6GFgFHjUEaqWxydqnURjyFPyF4j1A2AFOBwKTHuM03NWiSkFmhJriaimbFSOogKgCjArIzZIFGBUCiFUSJtjB8OKlRULRqMmqImyQKZiuGMVFMT7DwCpDciN6zraKSeRY4ULu3ICtPsWeME91H2DEdOpHjWrw6CK20JDFq1fZJ7z+bHoPKt7Tm18CPOsUXW2FwzgsFkBPfSdo4+wp7oPgT1rRla4vU7OPTFAv2F2A9cVRv5m1g6lKjYsuwHkv61Vn4vFb2XZWzuZnPfXkoHgfGutcMao8/hlzNSe3/AGL817Hw6DEKa5D8LMOvj+lYElzLNIWmZgpOWI5moW8LS9rKVlOf9mvLPSkXF0JEwQ4lTIBHIjJzkfpUJ5E92duH0/B9b+S0b3XIASFUDSq9FHhV+Kdra77aBLfVEpWF3lUrqA5g9SPOvLNKVO3MUKuwbKkg+IqP8T4Ol+kTNhLkz3Ly3RlPaHOqMDJY1dazgigmaS+RZlXMcIBJJ8D4Vn2F1FbFJSWaRWy0ZPdYUqSRpZWODliTgCuiE1RKWOTlS0hyyqozqYsOijYfOpnnyCqkACq2iRVAAYK3ljNOltWjH75kUsO6o3JP8qspSrQ7jFPYaSsASTk4xsd/rQuS3eC4z4U+3RVIaSJnxsNTYX6CrhsmRlcQoVxnfOnNUjCUkSlkjFmVIzLHsB64qtIY+ydndhIPhULnPqelac6R9ozSyOx/u7DNUX1nUtvCQRzKqSfr0qGfG49lsckyu0ZbDLE0aEbGV+fnUxGESDtJCAPurmglgupHLSJISebN/WlGBlbDHHnzrgbaeonTSa7NOXipUaYdEajqBlj558arpx/iMAYW91KuTnVq3+XhVR0jG2ok+opepMYCL6880mTNkb2wQwYq/DZYN/KWJCQhyclliBJ+dV5riaXaWRzjoW5VDMTsAfQCltGVPfGny61Gc5PyWjCK8Akiu33zzNEIyylsYUHHzqdJwWPIdfGp0yloEfjTY1OQ2rGfteHnXIq5+HUfPlRsoJ5knqaaKEb8Bao12AJxsBTFJ2AGGPX7o8vOuSFY4xI/xMO4vj5+lEg8s+OetWVkm0Ex2GkYUfCDUoQGwchuuPs/1o3AXK5/fHmeiD9am3ti5wucZ5n/AJ51RJt6JNpLYRBkwiKQo5KN/wD3NWP3dkMSp2txjuxdB/FRrdR2ZKWyl5yMB1AOk+WefrUW9qFDy3DBAN5Hc5x6+flVUvgk389f3AhgnvJSzkszbu52GP5CmvcRQfubNBM521EdzPkPtfPahlme7UQ26tHbZ2X7Uh8W/SmB4bH9zEgmujzH2U9f0og8/wDQAgZT71xORsnZQfibyUf8irCJJexsZ3FrYR/EmcA+p6muECqBdcSlaSVv9nGPjfyUdB51MjuJA9yia4xmO3B7kI8T4n8ayVBu/v8AsGynscpqs7PHPlLKP/1H40EjxwoqoqIq8oui+b+fl9aW88hmDMxebPUZ0Z8B94/hTY7EFtdyM4ORFnOPNj1NMrfQspxgtkQwyXA1zEiJt9/icfyFXwyooVAFUbADpS9VCTVkqOKcnkey3DLhseNFM22aoqxBzVqRlZe6D6nnRsi4U7JjfIIpc3PIpathhTH3BrWHjTFOee+fOkvyonOCRS2ORzpWy0UV5NqQxqxLvuaQRUmdMAetdnaoNCTSWUJY46UsnJo2O2/Kq7SjVsMCkk6HirGGlzXHYRMwRWY90FhkL54qdeaXcRPKAiKTvn8KnNutDxSvZQLZkHkaFwRnPOox3qdMQVA54ri7R2dNCEGWxTMZk08s1EQ5mmwjvNIFzpGaMUaTOTuLg8+orqtW4seyDTEl23PlXVVLRFzp9Mw6nNNa2nWBbgwyiFjhZCh0k+APKmWthLc2V9doyCOzVGkDE5IZgox8zXCd5Voqa9rcRRpJLBKkb/A7oQG9CedHBaXFxtBbyy5OP3cZbfw2pkgWV8VOabLbzRRLLJDKkTkhXZCFYjmAeRoWt5U7IyxyRpKRpd0IBHiPH5UOgACiq0/DJze3FtZLJe9iT34IXOVH2sEZA9RQQWlxP/sLeaXfH7uMt59BTIDEiuokjeWRY4kaR2OFVFJJ9AK4xSrr1RSDszh8oRoPn4fOjYKBohRpbzyECOCVicYCxk5zy6dalbeZp+wWGQzZ09mEOrPhjnRQBdTTRazmVolglMi/EgQ6h6jnTLi0MEFs/bK8k2oNAEcPEQcYbIwSfLPnTAKxoac0E6zGFoJVmHOMxkN48sZqJYJY2USxSIWGVDIQWHiPGsEVUmrUNk73gtrpjZtpLZmifbAJGwGd8Y5daWtrcNbG5FvN2AODL2Z0A+GrlWRhFSCa4jwqeVYxwGTipzk71Gd6kMNWSNqIC0oAGOlFmkCQYqUkJO/Kr8kRcWNJqUORXUSjAxT1sWwhRKKEUS86dCMYOVSBUCjUgmqImzhT8xKseCdRB156HPT5UrFQV6daboR7LLFfs5xjfNXVs0t7cXF5zcZigHxP5nwH51XgMdlGJ7kKXI7kZGceZH5CqfvbXNwZJ3clue+/pTqSXZHjKf4el96LrzMj9rPhiOXgPT0p0F6LeOV5SNci7nO6jw+dZDyds3cAVRyGdlFOv4vdosMVcsRuGyQeufCisjW14C8MXUX5IbiDtJr8DlRVKaRnJYklick1Ml0ki6XjCsPtoOfqKWZleNR2QBQbsvXzNc88rl2zqhj49IjtXWMoDhScmhNxKHLByGbmRQtg76s1EnZaE0K+sZ1lmBB8MbbVByfhl1FfBYtbmJD++tkk3yCDpI9On1FNQWUmtpHuIznugKGHzO1VIoZpAWhhdlHVVLUIJzv+NMsjSVoVwTbpltnhhjIhkLuwwe5jFKWeQuDqIbxzig0jA3GfCnRWc0oJSJmx47f+9Ui5t6FajFbLcNyZgElZiB8DZzp+vSr8FoZpV1SJkjAVe8T8hVK3tYYSPeJSzjmkR2HkW/TNW4+MSwa4rNUgz3dUYwcevPNehjmox+s48tt//Gekh4GLZFlvpIrdegnfvH/hG9aV9fez0XCAoS4uLnPeZzoQegrx0ENxNh3dUUneWZ8fnR3FvbRoS99BI3IAEmrtcqbb/scbxrlt3+//AOB3HF4IywgsIB6gn86oHjdykLRRpGsROSgUj8c0MksOkJ2kDKOQx/OlNHbSISJdEg5B+8p+fSo5cmR9M6oYcaW4ibi5EuDJboQeWlmU/nSJGt2TAimVs9Jcj8RVhLeNJNU8iso3KxnJPl5Cqkul3PZDGTsnPHlXBkcu2dkOPSAKRDvMJCvhqGalezZ1SOFiScDU/OgMLrvJhP4uf051AXVgKCT51zXvotX5jJpXDNhFhB20pt/Wq3OnmAaSTjyI6nwHl4mp0oSO7jbn/wA9KzTk9hTSWiJGWRiY4ljTooJIHzNCVA3O586skREDGvIHMgb/AKUcVuZ2ACjbnjYepNNwbE5pFUAtgKTjqcY+lWEjWPS0qnB3VRzb+nnVhFiTITErfe+wP1qVhMjNI5LfeYnH/tVI4ycsgr95cTNI2Cx54GAo6AeAFGZFjwsIy/3sZx6eJ86PWHUxwrt442+Q6/OmRQCJDLI2lfvHmf1NUS+CTkvP9AYbbTu6t446n1pjSmVGhgBDk4LKcKo6/M1Hfn7oBSM9PtN6/pTJZI7QCIjMvSJenr4U2kvyEbbfyyY+wsotRbfkZCNz5KKSFlvmDS5SAHMcWefmf1qUtzJm6u2XSuwz8I8gOp8qkiS6JVcpF9oscEjz8B5UO/0N1u9/I33nSOwsBqc7NMBy8k/WpjWO1xHABNck8huqHz8TXB10GKyISID95cHYt5DwFKZ1SILDlI22yNnk9PAedFPywVel9/r/AILCydgXZJBJcn/a3LbiLyXxaohilmbRAGLZ1Enmv95j978qm1tnuCuwjjTkByX08T51sQxpBGEhGF6+Z8T51WMOX6EMudQ0uxVlYrb7nDS4xnoPIfrXSHc08tg1VmzrOkfKrUkqRxqUpyuQBPex40DPzoC1CTSWXUQw1PR8riqmaZEwzg1kzSjoJjg05GytImO+cbVET9K1gcbQy4Uq2Dg+hzVcmmudqSaDGgtAyDbPjVdjT25Uh6SReAsmoNcRSHnCthRkdSajJ12WjFvoKRjpIUVVOc4ponDNio1qzYx6GpSafktFNeCIm3AJ2ply/wD1VlA+0DkGlnCnzNTkHY7g9KF0qNW7KKJqkArpiSWzTRszlhpJztS5N1Ow369a52tHQnsCIZG/OnhihRdWkeVBbLsSfhH510uksTihHSs0tyospwq6kBa3t5JY87MorqqzcRudfdlZAeiHArqPOCAoZn8fue24xxWJ+H8RntRbNw2ezWKFZOJEr8KhVW3AyHUjyAIJzvv5fgbwjgvHIpp0jMsduF1EZOJlJwOuBk/KsDG/KiBrlTt2ddUj6V7QSRReznHLeS+94Blg90km4ks73Ch95FQbJsRsOQOOlebseKzWPsfcJZXz2878UiJWKbQ5URtvsc4zivMk+GKjGaPIHE99xfjMd1e+1Md7fLc2K3kBt4u1DKUE2/Zjl8OeXifGrHtDfrJDf9i1tNaXV1GbZv7TM7Y7TKskX2MLsQcYBxXzoDyqxZXUtjeQ3dsVE0Lh0LIGAI5ZB2NZMzR9C4zdXLXXGLDg/EY7K+Tjc00+bkW7SIQAh1EjIUhsjO2c4qlx/jiNwni/9l3wT3jicOr3d+z7XEDCRwowdLPv55FeGuZ5ru4luLmRpZpXLyO+5ZickmhWsmBo9N7FXcFseJxNteT26pbEXHu5PeBZRJjukj0zjGd62ZOIKeOdvxF7aKytrFIeJQLe+8PdoScITtrk3G4+HAOdq8HjPOo04pgH0SNuITJ7TNacYgMk/unYTx3IiTsSzaUByNHdwNJxjBFNi4pbJeT201zFdcZPC4bdriO7EXaSiQl1E/LVo0rnrpIzXz2K8uIbS4tI3xBclDKukd4qSV3+ZpOnNG/gx9EuuOS278UZLiG2vU4OkIkhvjLKzdshAMm2pwvhnAHPal8DvrN7fgzXt0j3RgvwjNcBGSd2Gks++gnfDHqc+deAAxRA0yYD6P781nxGx7Zre2nt7K9MbtxIXMq5iOlWfkO98Iznc1R4Rxhbmy4RPxPiKvfRzXkUU9zJqaBmjXsmbOSFDkkHkDvXhicdAKEHetaAe24fJe2XFOHLxrjNtMVjuwqG6WVoQ0TDLSAkYYnYZ/OtDhJhThluDxBpraThMkYM/EFCLIYmzEIAOjdT5Hwr54AMchXbeAoms6PcAc6l1weRx5123OjU5BXG/hRSA35EmoomABrgKWgk52AolO/lUb45D6V2TTIBZV19PWmZqlv40aSMh55HgaqsnyTcPgtjBO7AU1TEBvrP0FVUuSAMImfMU5LtgchUH/AD+dVjKJKUZFyDs3cBYJJPLV+gpdzOgkIit0XScZDEg0k3U7AgNIR5HApG5pnkVaJxx7t/3LsV66ZOpRnoqCojnaSQnUUQbkKapmNsbVAJSM+JND3ZdMf2o+B11O00m9KLHFK18/Gp1jSABuDnOam527KKFKkNjkKupOMAjmNqiWd2ZmLZLnLUrWVORjO/SoL8sKo9BQ9x1QeCuzmOpidt/Cow6YfDL4NjFQTk7muJyMEnblk1Ox6JD7YwOec43+tGZAX1BFXyA2oYoJpnCRRszHkAKhUP2iAPM0y5GdDGmlYEGRsHoDgfSgXY701Ig3IMfQYH1NN0RI4OoADnobJ+p2qihJ7ZPklpEo2mPOVTwVBlj+lPLLGNMb95h32yc/w5/OqbyBc6CQD57/WhWQBD3d851eA8KqsqjoR472XZC0aAcnI7o+6PH9KG3YxkLGmuU8sDOKTBiRi88hUZ3PMmtZHijQAN7pGRvjvSv+n4VWD5vl0Sm+CqrOFrPs95PHD5MdTfQVqQpwFeFyF0u7m6EgHaZ0oo9BVCCLVgw2aY6S3OWJ9By/OtuJ+JLwu4tlWcxyFW7qxxKMZ6YziuuF/Bw5cnhuv2/wA/3PPSjhjOQBIg/iz+dVpeHqY3lhuIiq8wXAI+X6VdvHkyEuopV3+JwGH5VU4jYSQntYezaI8pITlfn1HpSZeLXX/R0YpPS5V+5luGVsFmU9DRa7lV/wBq5U9Q21SUZJNEo9R/MUccbrLoTmeWf5157hs7nJUJSNmY91mA3YgZwPGrLQKUlkhb9yGCDWQHbPlTBEio0k6kDBChTgs36UmL92MkBn8OgoqPHsRy5dHNlzkjywByHhTI7cu4G5zyGn+VGiu6kjCqBndsfSiViMAEjbA07UySEcn4CMSICvNgfhHP5npQ9g8jYPI8kXkf1q2lusSZuW7PwjAy5+XT1NHLctIsUcMaQiPk0Y77HxZuZP4U9Jk+TFdhFbMVudbOB/soyBjyY9PTn6UCQTXUgRRkE7RoNh/z4mrRjgijBncdqeUKbufXwHmaXqmkBiVdEbc406/xHmfypqQtvsJXt7VmjRPeZhsdJ7gPgW6/KoWB5tVxcyqFXm7bKg8BUlYogUQCWQfZT4V9TQC2MjB7yTUq7qrHSiVha+/J3vbFDHw9DGh2Nw47x/hHT86X2ENmMvl5jvozv/xHp+dNaRncpYKWxznYYC/wjoPM0qPsogexKyMPimf4FP8AM0v5h619/wAwwpZRcX8mlBtGgH4KKNh2wAmBSPmtuvxN5t4Uguobtmc6ukjjLt/CvT1pavJNlV7qE97fP1PU1r8G4t7+/v70Omk1FVQAjOyqMqPTxPnyp9rbgy65iWfwz/OgiVU5ZLEbk86NGwwNUUfLJybqkaaNgaQMAcsU1JMrVMHvLvjNMDac/hV0zicCwW7wqvcHBBqGkOc1ExymazZoxpiDucAVAOSBt8+VQxyKU5qbZ0pEs9Sj4NJPLNcrUtj8dF5zqSlocGhjkyuDQa8H0prJqPgstyIFL5nFRroTz9a1mSoFzvSWprCkTMIxqblSSZWKsh2VRljis9gWY4BNMnmLZCnu+lA0kjqcYCgb1zZJJnXji0Kfuncj5GhBNQDqpiQs+nRgls4AO+3j4VFb6LddjYYzPKFyQACWbBOkeNG8sMVtIYwxkY6Vcjkvp0pMjvbagsmCw0toOxHh50ntVKAYBVRy8TRcq15F4N78C9RkffYAUMkme6OQqXc75A89qTz38655No6IofE/dI6c6XJISTjr1qCdgOlCAScDcms5OqMkrsW/Ouo3gkJ2Q11JTKKS+Tdk9kJhBcSwcU4bci2kjimWCRiVd3CAYKjIyefLbas9+DXKy8UiBjduGuEl0k98mTsxp8dzXoouIcHj4Hxyfg6XMczTWs2i7dNsS6tCgbkA9fwFVLz2g4Up4rPw62vBdcRkSY9uUKRMJRIVGNyMjn+FJobZn33s3cWtvdyC6tZ5bJgt5BEzF4MnTkkgBhq2JUnBIruF8Ae94bJxGW+s7O1jnEDPcMw7xXUMAAk8ulaftB7VR8UtLpYrrjBe7l7R7aecGCEZ1FRjdxnlnGPOsU8Tj/6OPwsI/atei417adIjK48c5NbRtlqT2auree8S/ubSzitJRE88rsUZmGpQmkEtld+Ww51C+zV0humvrm1sre2kWNriZyUdmGpQmkEtle9kDlvWy/tnDNNfxiTiNlb3E0U8ctmyiVWWMIysCQCpxnntjrWfJxyy4hHdWnFF4k1s9wtxBMJllnQhNBDFsBgRjwxijoGxEPs1MfeXu7+xtbeCVYveHkLpIzLqATQCT3d842609PZS7iF03Ebq0sIrecW5lnZmVpCNQA0A7ad9R2wascL9prWytrmxgPEuG2b3IniazmDSDuhSr5xnOAc9D0xTOH+1FtFxK9vHuONQNPKrB47lZjIgGNMocYY+fTwoqgOw+Bezltftwq3vJbaGO4v5YHuYp2LyhdPdUYK/a2brnesqLgkE1xcJ/bXDY4Y5REkru57UnlpULqx4sQBWmfauzW7sbmDh3YrbcWlvvd0YBBG+jCKfHunpjehsPaPhnDIZ4LAcRgAuBNHPEI1lmXTjs3O+lQdxjPM5HgW0DZQX2XvI/ePfrm0shDdmzJuJDhphuRlQQBjfUcCsZsxuyMQSpKkqcjbwPWvVR+1PD/7Y4nfEcUhW7ujN2MbxvHKh+xIjbH+LfY8qw+JQ2jWUF/blYZru4nY2iOGWCMEaAOo5sN+goX8BZc4d7NT31tayte2lrJesVsoZy2q4IOnbAIUatgWxk1ZsPZC6uoLF5eIWFrJfO8dvBcOwd5FcppwAcb7ZO29P4X7Wrb8KsbSe44rAbFWRFsJlRZlLFhqJ3VgTjIB2xVOP2gTtuASSRSseGTNLLlwTJmbtNj442yetMqAVeCcI/tHjicPuXaBFLtcOBkokYLPjzwpx51oQW/BuNwXsPDeHzWF1bwPcQO9yZRMiDLK4I2bTkgjbIxiqVlxg2XtA3FIoldWlkZoZDs6PkMpI8VYjNXG4nwbh9vd/2FbXwubuJoDJduhEEbfEF0/ESNtRxtnbNHiCyvcez01ras095Yx3aQid7JpcTLGRkHcadWCDozqweVdcezl1DDNm4tXu4IRPPZIxMsceAcnbSSAQSASQPnTuMcV4TxNZr2eyuTxSaII69oBAJAoXtRjvZwM6eWeuNqtcV9rE4jaTs0/Fo7meFYmtknVbZSFCltu8VIGdGBueZo2ajO/sN24bNdwX9lcPbxLNcW0LszxISBknGk4JGQCSM+tWr/2TurJb5WvbGW5sYxLNbQyMXEZx3vhxtqGRnIzyq7e+19rPw6+too76NLuzEC2oMawW7DTuoG7fDzO4yedUbj2khn4zxy+7CVU4jaPAiZBKMQm58u6frW5GoVwLgjcX4bxk29rNc3tvHC0CRZJGZMMcDntV2P2Qu/7KsUntZLTiN1fyQqbglQY1iDDb1zvWRZcSjt+FcUtGjcyXixBGUjC6H1HPrWhwT2hThlrZRmB5Wt+IG6bvABkMYQqPA896Nb0C9HeyfA14rd8PnutDWM3EEs5Iw5V2LKW5jkMDnVTiXAZbSze9hvLO8gjlEMxtZC3YuckBsgZBwcEZGxrYsOPcG4SLKLh9rfvDbcSjvWadk1SBUKlcDYcx+NZ8vFOFx8Paxs4L1Ybu5jlu+1dCyqmcJGQMH4ickeG1Fg/Q8/ipApk3ZmaQwBxFqOgOQWC52zjrigzWozCAFGpIORS80a0yFZcjbWO9zogAOVC3LUPDpUCQEZrp/U5u+g9qTdDAUimA5rnUSKVPyrNWgrTM/rXDOcUTgqxUjcVGCCCRnPjXKzpO1HGOmc1JzoH3SdqE1HlQsNEkAAHUM+HhRpKUzoOM8z1peKYAmk5Vs9CDRV+AOiS5bdiT6mo1Y5bUQ0aQOzOep1c6sQ280wJhtywHMqmcfOqRTb0I5KPZWV8nfLf8VcTV6S1niUdoukHkMiqzRkdAfnRlGS7BGcX0IJBqR8PzoihHNaKCCW4mEUKF3PQdPOkp2M2qsbFqDBYB3zzbw9PD1ra4fFbwsNmuJjudPeOfXkPXc1YseD2MFmzXE3a3J2wp7ievjWjGY41CxvtjlEukGvV9P6Z9s8n1HqoytRsvRwXqorJaJAW5HGtz6k1pS2N8vBpbq54hJEuoIqsoKufDb86ocNsL2+YdjBIy5xkAn5V3tNxJbIf2bEj6YxhnJ3Zvtf8APlXVLtRT/X9Dy4Rcp1V/f8zzHELi5jbJ0Oudio2b6flzrPnvy65hijjOckqN/TPhTL2Yl2GoEOO9gbN4HHjWdKwVn04wfz5/nmuP1OVxbSZ7mDEqVoJiXzHpz9zHQ+HpT45AG1KgZ9OlFJ5+LHypMMUkx1FcLjGCcDHmaciW0QK6jO5PwpsvzJ51zJt7LSroObSBgSdrOdmkHwoPAUMKRREdofQYyfp+tSSW25Y+zGMAfOpit5JX0quM9B/zvTVsn0qbGM+ruD92jHfHedv+fCmBZI5GNuDGp2DNguB69PlTYo4bYlWYGTqEGpv0HzqdU0j4iBjB2Gndvr+lMlsX9Bi2cVvGJLptJbcId3b5c/maAs8rkW6mFcY7u7kevT5VC9nExQ96Q/Eqd5v+JjRapdLDIhj6hDjPq36UyFZKwQ22A5AZuaJ3n9T4fOuljJTXM4t4CcYzu/z6+gpSv2aZgRQP/uPso9PGoOqd+2nmwOXbSc8eCj9K35GvyxvvCQoI7aLSehcZY+i9Pn9KXLFhwbtnMh3EQOqQ+vRaW8wiYLa5gU7GZzh39PD5Uoy6Mqu3iq7E+p5/lS2vJqb6+/v7oe7M6lGCrEvOFDt/xt1qvNKuRoAkcfCMd1fQdamS2neCGaQhYJNXZ6cY2ODt0pkSLGpCDfqTzNDbDpCFhZmLSkknnvufU07ZRgYAHICi50DDfaikkBtsJX0uCMbHNGDhtxg5pI5004zsTjzprFaLhbYUTPSQcqKMju1WznaJD5FEJMoR9aUg7x8KkZAKk7VrM0hWrpQsalh3qF9ue1IVQBNDmuY0NI2USGK1SW3zS+vhUsSBvWs1DlaiL4wRtiko2aJnRVJcj0o2I47CLFj41U4g4ComBknJz0ozeKAAFI8aVcW73DqyqQG+0wxmpzlyVIrCPGSctFZXXkFJJ60xbRsDtWCZ6Hn64ogoVR2LaAObk4LHxroZY0uFfSZ1QhpFOcNv1NSSXk6Yu3SGXFrDaqGEckqkZWSRSqt6Cjij7a1LzlLeFuTacZ/UVv8AtVxyLivDbOJbOG2Fun7rJLHH3QOi15K/4hNcBROI20jCgLgKPIDlQcuG2qLyhBSqLsrzBWY4csByOnnUDESMVHeIxk9BUoyqpJHMUqR9R8qhJpbMlegCcjnULzrjUoCWAFR7KdHNRKdIzjc8j4UQCLuNz4kVDPqOWJNGqFuxbM2eZrqkuufhFdQr8xv5Faurq6oFTq6urqxiRTAaWKIUyAyTXVBrqICc11RXCsYnFSKgVNFGJqQaiuzRQoddkioB8aKnQCDvUYxRV1EANSKkih9aDCETmiQ4oBRA4opgYec1wA6iozRBqYVgkYNDmiJzUVmFHCjzy3oBRYooDLMUoVdxyperf1pWqiXc88U/PwJxrY5WK45YPhTg3jSRHywedE23dzmqJsm0mDKgk35Gg7NiMY5U0URAK4PKhxT2Hk1oqEYqNGeVOeLHKoCZ2xU3EdSBVdtxmmLEDuDRqhYhTgeu1MjjUHcMD6ZqiiI5kaFJGNI2qwhZUKamKHcrrOD8qsWHDp76cRWymRj4DkPHyr2Fn7L8JteHzTcUvGkulHcggxgnw1Y3+VdEMT7OPL6iENN7PBylAOWmih4dd3Cl4rdyg+0+FH4869Xi2tY3a2ghgXq/xv6ZNZ4E12GKHsYORkfm3lV/4T5f9CUfVtr6VX6/f/ZlxcOhj/8A8qbU3/2oTn6t0+VXhE0aiNEWFGGezTmR59frVpYUxGlrEUI5uxyzn+VNEUEeoyEySDc4OAD5nrXTj9Mokp53Lsi2sndcZVPlqY/LpWnapbWqauyMkucZlOcfKqXvUixhI8BWG4jGKieSOyVXlY9sTsv3B4nz8q6OCSOSanN0z2H/AEiuOA2yrKYu2lj1KuN4s8s+BNfN+OcQ94nnfPdL7E889aRf3slw/wC8dnwx73MtVF3kkfUVUeGTyrzsmSELUVt9s7/S+k9unJld5JJGwqtjpgb0+C2mY5VAD4t0qRrP+9QegzRLFqPflkbyArjSbdvZ6DlqkG9pgAzXCE/dByRUxXMMKskaBtWxJQE/jy+VPito8f7Mk/32/lTeyWP43SIeS1ZQa2iLnemJR2YjTbt5DYCrawzlC7v2acisX8zXIFRQ4jd8k6WkGx9B1op1eRF7aYaTyj1ZP+Afzp60TfYpWt4RpXvn7qb/AI8qYxlWFpZZkgjPd7JWwxH50i7SW1k7LAhbGe8Qz7+Q5UkYUFiArfflOWPoKWw15LK5SPMSrHH9+TYfIda59IgFw8iPlsL2rbnzCDp61TkmyQclm+8+5+QpQEjvkDDH7Tc6Dn4QVj8v7+/tFiSUs+pct/fkGfovIfOo94VQzMQzn7ROoj5nYfKs95y3T/Ec0ibU2CST61CWbyi8cN6ZbkuxqOk6j4g/zqs0jtzO3gOVLjxqGRkeGcVLHG1Rc3LssoKPRrcLu820tlIcqT2sX91wN/qPyFO1DG1ZVlhbmORzhEYFvTO9a95bvZXDwOc6T3WHJl5g/MYrpxTbjs5MsYxya8/f+BYbeoLUAap509i0MSioRVmGEyDanWxJNLZMe609R3at2XCLy5UmG3d1HNsYUepO1WRwi4UEEwA+BuI/9VURzSkZJG4rmFaLcKuM84P/ADEf+qmLwa5cbG3/APMx/wCqjaBZiyLvS386324BdkZzbf8Amov9VV5eB3WOdt/5uL/VStr5KRkYTCuArVbgt0Ott/5qL/VS5OFXQ62//mYv9VIV5IzTS5n0LvzPKr54bc5OTBt//sx/6qpz2FyzcocD/v0/WkldaKRcb2yiJGVs5OfOuLliSeZNW04ZcOMFIsjr26frRnhdxzxF/nJ+tS4TLe5D5KcLKsuZASBvtyHrTxI8q57VwW+2eo8hQScOuypGmPA6dsn60qa3vNZ1aOX2ZFx+dBOUfAeMZPTQVyYkTSeY6n4jU2vEo7axniVT2k2zHoRVRrWfBJVf8xf1pRtZvur/AI1/WpNzTtI6MaUPI2S8eQ5/OqzEknNOW1m+6P8AGv60a2NweSD/ABr+tJJTl2grjHors3ShGSdqtf2ddH/dj/Gv60cXDLstjsh/mL+tLwm30HlFeSoV23oo15nHIVek4PxBUL+5ysi7koNQH0zSYkKJnG5oqDT2hXNVoV2TMM7D1ruyVeZo5WION6SWY8hWdIytgOyatlFdXGNs8q6p7KaK1dXsD7JWn/aZ/ov6ULeyVuV7l1MG8SoNdX+1+p/+v7o5v9y9P8/seRrq2OJez15Yo0q4nhXm0fNR5isc1xZcU8T4zVM68eWGVcoO0cDRChFEKRDsmuqVRnOFGf5Uzs4x8Tkn+6P5mmSFboVXU3TF4P8AUV2IvCT6j9KNAsWDvU0eIfCT6j9KnEXhJ9R+lFI1i66m4h8JPqP0rsQ+En1H6VqBYsGizijAh8JPqP0qSIfCX6j9KZIDYGajNNAg6iX6j9KnEHhL9R+lGgWJzRDfnTMQeEv1H6VKiAdJfqP0o0wNimXHI5FcBk05jCVxpk/xD9KgCLPKT6j9K1bMno4KudyR8qnT4ZzRYiPJ2X+IZ/KoZGTBI2PIjcGqUJZA222+dCVHSiyRU58h9KxhfKuJ8aZKSx1EDPkMUs58aXoZbIouVCKnrWMMRyu3TrU6jnag5VK5NMn4FaHry3oiwFRE0eg9oW1DkB1oCcmqXonWwwc86NSR4EedKU4NNAyKaLA0NBQjcEHy3FNSMHGHXHmcUXD+HzX8uiLCqN3kb4UHn+lbYj4dw0fusSyDnI4yx9ByFdWHG5foceXNGD4rb+DXWIQcFitOGh0Z2BlnK6e29DzxVKZ4LGH944dz97l6Y61Ve9urhdSlYY8fFIeY/M1m6oJZHe9ll+E6QgBJPh5CvQ1BaODHglJvm/8AI9rprmfZV0Dlq5D+QrnnBb48r94759BVIGScJGq4WMY8AB4k12beL45WkbwjG31P6UPcSOv2ktIviVyMRMq55kt3m/58K0+G8JurshQp7xwoC7nyArJtuILC6i0hQMcDWw1NnwrTfjx4aVdJXNznJfPLnsP1o+6qtM5ssct8YLs2eLcHm4BaGaeP95jKk4IU+fnXgru6MzlnY4JO+d2q9xb2kuuJJIksjdk2MKTnVvzP/O9YZIY5O/yrizepbjxu2dfpPTOFyn2G7qx6DoO9gCpXsurRj6mgAGeQ/wANNUsTsD8q5E7Z2PQzWmML2rfwpimw6tWVgRf708n8qBEZj3tXzarkdtCsetpo0YfZwWP6fjVEn2TtdFmW2aBEM96g1jVogA5eZHL50qaB7eBLpbc9lIxVJZN9RHPn+dCZ7dVIkkuZN86QwUfzqg82rYAAfWmcqAkWn4jI0PYkw6QxbVoy3+KqzXGFYDXv0UaQfXxpZYnrUFieZpHNjKKI7SY7KAq+HL8q5YzzZjk88frUqd6Jjypa8sN/AS4X4Riukl7KNnAyRy9aEb0EyGSMoDj8qZvWgJJvZRU5b1o25Gi7Fo/ixk+FSyjFcyTXZ02n0V8YNFpJ3FSwwaJSAPOlSC2BuuM1qLdPc20Ik3aJezDdSo3H0zis9h3TiriRNAgjcYYDJ+e9VxWm/gjl4tK+wxUqd6AGpFWslRYTc16LgQgs1F/exiWNW0xQk47Vhzz/AHRtnxyBXnI9t/CtjjEphuEteQt4kjA88Zb8SatCvJzZE26Ro8d4/PxNwZCFjUYSJNkX0HKsJ5zmq7yk9aUWyabkkqRo4vLLJmqVnIFBaWV1eOVtoXkI5kDYep5CtIezd+Y3YtAukZIMm/4CinJ9GlwWmyg1ycUppzmpu7C7tgWkiJUc2Q6hVHXmklOUXTKwxxatFoz0tpSars1Dk+NTeRlFjQ5pPOltJQE0DNSObKKI1ZDmjMpAqpqOalm2570vMbgNMvnSmfNLJqKXm2OopBE1FcBnnRYFAaiVpqsRSqIGimZosK3jTom3qmGHjTElAplIRxNa3laNg0bFWHIqcEVuW1jZccjaO+eOK9x+5uOXaH7j+Oejcx1yK8sk3hT45mPJsVRyUlTJ1TsoX8MUU7pk5UkEEciKpM6j4RtWr7Rxv78ty6ke9RJPnxJGGP8AiBrGIB2zXJke9FoLQDSMTtXUZjjB3Y11R4v5K2vg+jV1Wrnh9zb2lvduoNvcA6HQ5AI5qfA+VVcV9ipKStHyTi49nAkV4v2q4UtnOLq3XTDKcMo5K36GvaVn+0MAn4LdDG6prHqN64/X4I5sLvtbR1eizvFmVdPTPnnWmRgswVeZOBQU222Zm+6px+X86+TXZ9S+hjkAaE+Af+o+NDUVOadsmRXVtW3s5cSWUF5dXvD7GG4UtD71cYZ1BIyFAJxkHfFJ4lwafh8UU5lgubWYlY7i2k1ozDmp5EEZGxA51qMZldVq34fdXVrd3NvCZIbRA87BhlFJwDjOSM+HKgksrmKxhvpYilrPI8cUhIw7LjUB12yN/OsERXVKgYzkeuak4HMgepooBAqc0JI8R9akb0bNROa7NdgDqN/OrnCeG3PF+IwcPsVV7mdtKKzBQTgnmeWwNEFFQGiFCSv3hnwzVnh1hdcRe4SzRXNvbvcS5cDTGgyx357dKNgoRRKPCgByeYz4ZoxTJgaJINHGxTIIyh5r/wA9aDNFqFFCMJ10NjmOYPiKGikb9zGeoJX+f86XqJ6UzaMkwmBI50vBJpm7c6Ps08aFWa6FJpBOrPLpXEDPdzjzphiB+2PnUFANjIPkK1GtAYruVMATrqIqG3NGjWSpGnBG/jXYrlFbXAeER8Slf3m5FpbohPbMhYFuigdTVYQc9IlknGCtmQoJYAAknkBXoLDhtvbRluLRT9qcGOFWC7eLHn8qmDhscRyjYYf7x20/QVNxdLAqxBdhyd13HoP1r0MXpVD6pnDlzvL9OMvXcgaBY4kFtbDkqjAP6nzrHuZ44l0RY1ZzqIy39KTLxBtZY6nfoXOTVaSQyOXdkDNzIqs80aqJsPp3HsbLdSFTlsavPc0MCs8gUkDqc/ZHjS172VXuj73U1ftOHzywsYIHZV7zsByA8TUlcnbLycYL4KslwXXs0GmPoo6+Z8aryuFGW5j7I/nSbm4IkZF7ozsF60kAk/vDj+6K48nqG3ReGKlZdsuJy2V1HcwhBJE6vGSMgEHI260Ny8k9w0118chLlcY5nO46elKjfsjmJVB+8Rk/jS2epObrbG4q7SLGrNSDVYOacp2zRUrA40NU700c99qVEM7nYCrEaB9XeC4BPe61WLJSORqYzbYpA50xiNJyD8qdS0Ta2LkO21KzXTNhaDWNjtvUpS2VjHQeaHO9dqXxqPxpbGoNTvUk70vlUijYKGA1INCBRBaIrCYakI6nlVM71cIqpJ/tGyMb8qWY2MW6nrUCmcxil1JlkGu/d8dqvSyGRyzHLHrVKFdTZPIfnVkVXG9Esi2FUrzoQaJedOibGg7GrvGJe04jcMTuW/kKzy6jILAEedFfyE3k38VVUqRPhcl9/ALPV3g1mL+5PaMVgj3cjmfIVlF69NwgCGwiGMFxrbzJ/pT4I+5PfRs1xhrs9DHNHFEsUCLHGvJVp8VvfXFvJJb2s8kendkjJGPWneydrazz3F5f4NpZx63DcmY8gf0rbuvbG652EAMSqTlQTpA9NhV8mWSlxxxuvno44YY1cmeAuWdXOcqQcelY/ErRHRp4VCuN3UcmHj617Ti3Fbf2gsLx54o4763TtY5lGDIoPeU+O24PlXi2mOciqSfuRqapnbjjS0YzNRWstqlwGv1ne3AOpYGVXO22CQRz8qVcDRO6dAdvSlMAwI8RivJm3dHVGNHpOPcGsoLy8teEtdF7G2FzcNdSKQyEIcIFUbjWOfPFY83DrmC7t7WURrJcRxypmQBdLjKksdhsd88qvn2h18XvL2eySSK8thbTQCQrlQqjIbmDlAaXc+0Ak47ZcTSxgVbRIY0tnJkRhGMDJPPlSW0UpMO69mOI29u9yDbTQJA0/aQTh1ZFYK2McypIyPDflT4fY/i8r9mY4I5CUSNZZwpldkDhE8W0kZHTIFOufbi5nvbGdrXtUtVmjZLm4aU3EcvxK7HG2PDGK6y9uuIQ9v7wJpO0umulEF08GliACp07ldl22IxzocnRuKKTey3EhYi7LWa6rY3Qha5US9kCcto54GDnrtTPaH2afhMl01td293bWsUDyOkgLDtFGNvXOPLBpEntHNK8bSW6sycNksCS57wfV3/Ua+XlVqT2mhufeVuuGK8d3bwRXCrOVLPDgK6nHd2G435msrsOird+zPEbOCWa5e0jEc3YaWuAGd8IcKOuzqc+tI4rwS74Zbw3EsltNBM7xrLbTCRda41LnxGR5eBrQ4n7Utf3cVw3D7cdlfNeCNyXRsqi6CDzX92PrXe0ntQ/HLKG1NtJGsNxJOHkuWlY6wBp3AAAxsByrbMed+ddmorq1gonUaJD40upFazUWFcgcxTBMRyqoGow2KZSEcQ+LzPI1rqYkLbqB/iaqGo1cvSrdjknIhGMDzNVMZ8qhl/EysNRBJNdRFR978K6p0PaPvcV/wAOtfZi5afhkMIv9oLdJ3cuVyO0OonSAeo3NePqKjNfXYcKxW77Z8rlyvJSromqnGDjhF7/AOC35VbrJ9qLhYODyrnDTERr+Z/AVvUyUcUm/hm9PFyyxS+UeDpkP+8/g/mKVTrbHaaT9sFfn0/GvjF2fWvo6pXnUkY51BphT3c9h71w72e4kOEXfELBbBYZ/c3OsOrSAqcA6d8HlvVDjUb8N9lEtrixNnNfX4uIoZXYyrEiFQzA8slsDYZwa8tFPNCcwyyRnxRyv5Vzu8rl5XZ3PNnYkn5mjysFG57F3sFnx+AXzAWN0rWt1nl2Ug0kn0OD8q9pZvwm342OCx3ME0nCuFmGwmV49Et2zh5GRnBTUQSAT4eOK+XaqgnO3SsZH1PiXFhw9PaG6tBa2fE0srNSwmhmdpe1OpjpUL2mnGQo25868t7LcSex4Z7TXiTQreG3hMLSqrEuZlyVDDc4ya8oPlRbGsg2fTfeDPLdXXCJ+Hp7R3HD7GRZWaJC2VPblC3cEmdGeRxnFWkfgHFOJXvCr664fDHB7rfSzR6RE0yAC6WMjnqB5DYldq+TEDwFdWAfXuDcasr3h6XsMFszXN3PJxSGS6ggj0s3cEodGZkCbDRyIPWp9lb0xS+z7cGveF2vAkRhfxzywhxPlwSdWHLEFdJHTw3r5Dz571IA6gfSjVmPqPBlhHsgba5vbee1l4TMwDTW0ccc2liqhMdo0gIzqJFW1uZPcOKLZ3nDU9n34E62MIeFZDIYlDDHx69WrVnn57V8kwOeBn0qfkPpRoFn1j2ouOGtwO8WyitpeDG2hFiGu4FSJu73kjVe1151agT1bPSqPt7Mtz7PpM0sNsiXCLb2SPBNHp0HJgdAGVBgZDDckda+bjnnAz44rsDoBTJUCwia7OKgYoqaxQ2GYE/jb8hQgYpsw7NYoiMsF1N5E7/lihVh1UU9CXoCuqwqxuDkafOlyx6PI8wD1rUBSTdAY8TRDSOYzQ7dSKbBbtPJpTA2yWY4AHnRSb6C2l2coQ8sg1cs+GT3aNIiqsS/FLI2lR8+vyogLW2jARe1m6vINh6L+tc97Kx78hPhnmP0rqx4V/zZzSnN/g/csCztrVgSwuH8WGE+Q5n50yS6kCntZSoHJevyHQVRM5AyDjzHP61XZ9bbZ3rp5wxqoE1ictydl7318HSSoP2ubH5/pVaSTB57nnvk/WkyO2xkbkMDPh6VX7Zc77/PAqM/UPyy0MK8FtNchKxqWzscDJ+vSlSDQSDjbbY7U624tPbvm2VdAGAGGE9cdfnVGV+0kZ3YFmJJCDAqM8sa0UhGXJ2tD47pUIwuo+dbLe0V8nD5rOKRLS1kVQ0fU48Bz3rzeor8Pd9Of1oc4qa9TJKgy9PCbTaGO5LErnJ5seZ/ShD4FDmurnci9DVfPOo1AmhUqBgjrvUhVLYjJPqKNsWkEOdPBwKTgggEUwnbFUiJLY6JsmnIdqREu2acuwxjerxIyRYVkZl1rp6Er1+XjQTMqt3Rz5Cl6qryyEsSTvRlOkJGFsidskClg1YWAuFEzxxZ5azg49P1oClsDhZyT4lMCoNO7LqS6F4NGh6GmvayIMkAqRkFSDkeNAoxTJNA5JrQRPLnUA1xqQuaYUIGnKdqUBjbFMB2pkJIkmqMz6pGI5cqvcx0rPdCrEYOaXJ0PiqzgalUZydI9T0FckLNz7o86tIoRcCkUeXY8pJdHIgVQBRgVAriwUZOwFV6Iu2DK+keZoBNpQHm3LFJkm1nyHKrEVuki57UZPQCkvk9D0or6irqIBxVy8bN1Kc/aqrP2Q2jLMN8nx9KZd597l/irRdJjNW0/vwCTXobaYm2iIO2gflXnBWtwyUPCYSe8m48x/Suz0clzp+RMkbR7DgfGHHA+LcLZQytF26HG+VIyPpVez45Hb2ygu8bFzrSIfGuOvl0rMsOKe4Ryxm3WQOfizpI8s+FBf8AE4r+VZZbURsq6cRNgEee1dnFK9dnJwm57WjQ4JeSiWZYLS1eRY3kVpEycAbr9Kx5bpndmKR5JzgLgVqp7TmJdMXDrRO7pBXOcYxzrBkmWOMuw2Xp4noKb5b0dWHG/KM3iDa7qRsAHYbelVSal2ZiSTkk5NXvZ6w/tTjVtaNEZEcszqJRH3VUse9g4GB0BPhXiZJ3JtHSkUDQ17y99m+E2ttNfR2l3dRiwt7pLaGdxhnlZD3imorhQd1B3qxF7HcDimla6muDG94lusIZzJbBo1cghEbVICxGDgd09eU3Iaj52AaIKa9m/AeE+4pBFFctdtwiS/8AejN3dSOwxox8JC+OQTV+b2S4XHHbGaC8jaG+itrtIJGmcqyMx+wBqBX7GoYJ543KdAPnuKmvUcU4Fbr7RcLtIgltacQ7IrIk5lUKzlSwLKrDkdmGcjwqweB2FxfTaOFcUtYbVLk9lLJk3RiAIVWKghurAA4HKi2jJHjxXbV7FuCcItrSTiFxY3jI0FpItmbkoYjK7qQW05I7gYZGcGrP9i8Ptru8bhourdrKS9tHdpQ5l0W7uGOR3eRBA6HxoWHieGG3SiwSK+gv7I8Ciurey7SdpFuLWMvG0rdusmnXklAic8rhj4b1Qh4Nw2+axm4bwq6MTyXUUsUl4SAIgh7VnC5AAY5AG+BismjUeLK+NC5Gdq9/wz2b4RxPiU+iyvIrCa8W2tjNcOrju5JChCSdww1YGDgmvCTWdzG0g7CYqmW19mcaQ2nV6Z2z47UGzUIzXZopYpIZGjmjeORThkdSCp8CDyrsUEYi6yey/wDDH5mk6iNqsXKH9zjb92PzNI0b0k+wxaoAk5rqNgAdzXVMaz6VXV4c+0fFP+0L/lL+lC3tFxRlI96xnqsag/lX0P8Au+H4f7f5PB/2rP8AK/f/AAe2uZoraEzXEixxj7TdfTxNeF45xJuJXWoArCm0aHw8T5mqc91Ncya7iV5G8XYmlE15nrP9QlnXFaR6PpPQLA+UnbAIwakGuNRXmdHolsMJxsQJeoO2rzHn5UtgVbSwII6GlAZpyzSqoGvI8GAYfjT3fYjVdA4rqZ7w/wB2P/LX9K4XT/di/wApf0o6BsXXUz3qT7sP+Uv6V3vUn3Yv8pf0o/T8m+oCuo/e5Puxf5S/pU+9y/dh/wApf0rfT8g+r4F12KZ71J92H/KX9KkXUn3Yf8lf0o/T8m+r4F1NM96k+7F/lL+lR7zJ92L/ACl/Sj9PyD6gakCp98kH2Yv8pf0qffJPuxf5S/pRTj8mqXwQBUip97lz8MX+Uv6UQu5eWmL/ACl/SmTiK1IEAscKMk9BVpYltQJLkAyDdIDzJ8W8B5czSfep8YD6B1EYC/lQCmVCtN9klmkdnkJZmOSfE0QXSc4z60GAeVQXKj4t6F0ahzXAQYABPpStZc5Y5pLk5GalW50OdsZQSQ4AYJGdqbHIyA6DgnxFV1OOVP008W1tCSXyEZW7xaPLHkQeVKaQ52jfHnRgHnmuLVTnJ+QKvgXJKzAAR6QPPc+tTHI6OrgqrKQQSetAxzS2qbm07sdRT0MZy2dRznw2odvAUGa4mpuV7Y/Eljnmc1ANCTUcqWw0GTtQ1BNdQsNE5rvOors1jB1KtpNCD41I3O1FMDHQgsTuPmabpyaQpwNvGrccgJ72AOmavAjO1sYi92iGxqWkTQAF3qAQ242FWRDYJ69B50BlWKUGEBmA+JxsD5CrAtZrodlEoAXvMxOPrTk4VEme1keRvCMYH1NCSkyuODkY0hZnLOSxJySTnNRjbNa01nAsYITGo7fvNxVOWGLOmJmVumvkak8bRVprQVvPPEhULlCCMleQ8jR6lkGIoX1KMkA52FKtpJJtMIlCnOAGYihuI5bdsORn+62cfpR5UiXtu7oJGDnbPzpmCOlVoy8WrA+IYORTUusH94ox5DlRjL5BKL8Dgd6I5riw6Cp1CqEiN67BqcmlmTBo3RlsLFCTip1EjYGkXTlFA041daVySVjRTboakqs2kHeuncRpyBJ2ANU1NG51EczSc7RT20mLQd4ZBI8BV3tliQd0ZPJRy+dI7NkAJYAn7IO/zoJHZzv02AA5UquIWlMkuNJGBirvEYwLuXHIkEfMA1nBWO/Iedat0va2kF0h1YURS/3XGw+qgfQ1XG7TTFn9LRnHauSV43V42KspyCOlGy5pZU0u10OmjVg4jDKALlTG/wB5RlT8ulaEIsXt5mN1CGAGgF8GvNAYouldsPWTSqSs2jRnureP4X7Q+CD+dZ807zNltgOSjkKAiuCk1HL6ieTXSGsipjd4ZFlido5EOVdGIKnxBHKiCGoKGudxYLRdg4/xW3S5Ed7cdpcBA0xlbtFCsWADZyBkmqUF7eQNK0F1cRGX/aFJWXX/ABYO/wA6HTUaaXiNyGLczgD99J8HZ/Gfg+76eXKrEnE7+VY1kvrpxEQYw07HRjljfbHlVKmomaKAHc3M93M011PLPK3OSVyzH5nejmv76aaKaW8uXlhGIpGmYtGP7pzkfKhCA7AUYh25Uas1i5Li5maRpriaRpSDIXkJLkcs5O+Old7xcAsfeJu8xZv3h7xIwSfEkEiiMZoSgFCqDdjf7Rvuxih99uezhIaJO2bTGRyKjO3ypcV9eW5Bt7qeIglgY5WXBPM7HnsPpQEgUBYGgEsDifEVeR1v7sNKQZGE7guRyJOd/nSPebkroNxNo0dnpMhxp1atPpq3x470PPlUhCaFAciZZJJ5WlmkeSRzlndizMfMnnRKmRXKm9WraFp5VjUgZ3LHkoHMnyA3pooVsrcQHZm3B6wKcfNqoliTV3iMqXF27xjEYwsYP3QMDP0qmxwdqjk7Y8OgSDnlXULZzzrqkVAJqM1Gaip2PQQNTmhrjQsweBXAVynapphTq6ozXZomJrqgUQFYB2KjFFXUTA11cajNAIWa7UKGurWagtVRqNRXVrNR3WmArS6kHBrJ0ZoYc42zUhsDlUCQnlRCTbeqWT2cr+NGHXoaURkZGPpQ5zW5NG4pjXk2wKWzFqiooNtjJJE0Sneho0ODWXZmOxTUbu0gnY1yOc4O4qylTIuNosM400lm65qHboaBzmjKRoxIDEHNTnI3+tAajepWUokmorq7FKEiurqnG2awSK6uqeVYxFTXYookMjhQQM9T0rJAboGiBo2QJIVbcD8a5iMbD9KaqBdkBqNNTbAE0KRnGptl8+tXIZBGFBDqG5YWngrexJuuiYowBmRiF8hVjtBbFQoDF+eOYHl51FzHcKFOljG3w4OQarzM9uw1qAzDrvtVr4keMm9mrBxGOSVfeVlYjursPofGvW8C4Et/diK5v4YQ4yI23I57eVeCtbuOFtS/EB8RGT/SrMXGCCGeecAH4UwooZOTWmd2HJCC2bftJw+PhN7d2nZmZoDu67BlPXHhvXn0spL9kaNRFBq0tI3wr+u1MuuKmS4a6ViXIxqZ8/hVWW/kYJ2czMV38ACeeBWT1UmbJODei9NZ2PDyJYZJZpFOQWwg9cc6zZ7jW7EPgkk7jmfWge+dwRIqt15Y3qq8rN4DfkBSyyRS0Rlcn1SGtO5XB+tKMjHqaFmLHJrjr0hiTg1JybCopFi0mKzASsxRtjnp51trbDSWJXA594HFeejJ1Z8K0TdK0WmNAhI7xHWrYZJLZzZ8bbXEu6IjnRIrHwXeqtxiNS23kPGqbEk7VL65ANTbCmc7Fjip9kiaTWGzy6DlQ3EplIyMAVwTwNQy454pN0VSjdgKQDvnHlRPJ0QBR1wedQdPQUBFJbQ/YWs1GTQ0a46jNa2EHerFndyWshZArKw0vGwyrjwI/wCcUonIx0qAuaKbTtAaTVM01NlOcxTGAn7EwJA9GH8xXPbRg4N3a/5h/Ss/DAZUEDxAqVikfkrepq6y/KI8K8ls28X/AG2zHq7f6aNLSFv/AKjYD1lb/TVCSHs93YH+6DvSAcGkeWn0OoWtM3Rw+DH/AMT4d/nH/TRrwyA//VeGD1nb/TWFrNSHNH3vyB7b+T0ttwWGVwq8X4Vk+NwR/wDrXXPBooQc8W4WSDjAuCf/ANa84szKdjUmc4Ibf58qdZ4i+07NGW0hU4/tCwPpKf8ATSxaRH/5+y/zT+lZjHPOnWoUksd9O+PGp+7b6KrGXk4cshIW9ssj/vD/AKasScKNuq9re2ShuWZTv/6ar29xFGxCqFPXrn0P8qLidz2xiU50AZGedM5KroZJJdlm24ejH/4hYY/8Y/6a2f7DiW07V+I8OUY2zMRn/wBNY/vNuEAhgRHA20cvU5601ILu/wBu+/TJO1b3FFWw+030yJ7OIZxf2GPKU/pVV7OPpfWX+af0p1xwuSFmildUIGclqzlgkE6xFS+T9gjJHlSrMn4M8Ml5GSWSb/8AXrP/ADD+lL9xXAb36zweR1t/pq9PYwuuXfs5MY0ghj88VmT28qDSH1gHYDp8qDl5oLxtdjhbxLsb20/xt/ppoit/+32n+Jv9NZrwSLgupAqu2Qd6R5WvAvt35PQpHwyPLXHEkYD7FtEzsfqABVK+4ojxtb2UJgt2+Ms2qSTHLUfDyG3rWWM0W5pHkbMsaXZzOc0PrRKmTk8hTgoxty6CkSbHbSE6vBR866mFcn4R8q6jsFop11dlfun6/wBKnK/dP1rnLEVFTlfun6/0rsr90/WsYOMjkaM4NK1L90/WpDj7p+tMpIVoMgUOMVHaD7p+tF2i/dP1o2jbIGc0WaEuv3T9a7Wv3T9a3JGph0JqO0H3T9a7WPun61rQKZxqK7WPA/Wu1L90/WtaGOqajUPun612tfun60LRia6o1r90/Wu1j7p+ta0bZNdio1j7p+tdrH3T9aNo2w0BJwKZheRG9KWYKPhz86L3nb4PxplKIjUgjk7AECuCjkQQaH3v+5+NA0+rmp/xVucTKMvgM46VFB2o+6frXdqPun60OSG4sYK4c6WJB90/Wp7QfdP1rKSBTGliaOMddqrmUfd/GpE2OS/jTrJGwOLoe5350IpRmz9k/WuEw+6frR9yNg4sfjahNL7cfdP1rjKPun61nOJuLDqQpY4AzS+2Uc0J/wCKi97XGOywPDV/SgpR8szjLwgmRlxqGM8qE0JuAx+A/wCL+ld2q/cP+L+lDlHwwpS8hYrs1yXMaHLQ6vV6k3cJ5WqjzD0eUfkFS+CVXVypvu8mnUFOPGgTiKpgdhkDl3/6VzX+vP7s7/3/AOlFTh8itZL6JaKQYLKfKjjhGodoT6Cke94+wc+Or+ld71/cP1/pR5wM4zov9lHkaR/iNWrOBpZxpZ3c7AKuSfSsuPigiBAt1LfeLb1ocM9qn4cxaOzRieZMjAn5jBp/fhHobHh3cjch4bevO1vFCRIoJbUMlfrsK83xNYe0ZknkllJ3yP51scQ/aDcXtg9mOHQwo4wWjlYNj1rCi4ysUehbOPP3id6V54zVMs4LwVxr07ggelcxOMVZfjDPjVCCBnbVsfwqrNcrIciIID0BpHKKXZNwd6BY55UYfSgA50kyj7p+td2g+6frS80vIeLYwtk5qM0HaL90/Wp7Rfun60OaNxYVTnpnag7QfdP1qRIv3T9a3JApjQcDblXK3eHSl9qPun61PbAb6Dn1puaBxZaCkkgfjtRYdehpS8UZPijD/wARz/Khk4nqxph0fwtjNU92C8kuGRvodqPjiiCahkso9TVccWOMNAp9Wrm4gr4/cBSPBv6Ufdxvyb28nwWhbFuTCj9yP25FFUxf45xkj+P+lFJxMOQVgCbY7r03uYhXDKWHtNPwvn1GKX7vJgkAHHgaT/aI31RE/wDHy/CiTigjXSLf569/yoPJj+TcMvwMEUh27NvpT0h0jDsit4Hciqb8WZuURX0ehN+G5xHPjr/pWWXGvJnjyPtFySUoSO01+a8qrvKzci3zOaSbpf8A7Z/xf0oTcr/9o/4v6UJZY/I8cTXgacnOOVCQedQt8i8oP/V/Sj/tJR/8vn/j/pSc4fIeM14BGPOmLywAKTJfK5GIAvo39KlLxU3MOoeGqspx+QuMn4H6cnfYVzKoUnDHzo/7bhXGnhdsMf3mP5mly8X7Uk+7IoPQNsPSm9zH8meOYjDMcKCT5VdhgZIAeyDFh8TdPIVUi4isTZNureRY/wAqdHxjRqxbrhiSRrNLGcL7KKL+DpkeMjVHo8NudSqvIrSPqIUYyB1pV1xE3RUtGF08gDRQcVa3iaMRBlPPLUecL7F4NstWh0SaJASOmBvXq+C8Wawmt5ux1rC4YRycjg8q8RFxQxszJCASMZ1f0pv9sPjeMnzL/wBKEp45Kn0WxfQe79r+MW/GeIG77KKNWUfu0HLHieprzr3URQsrKFG2wxWI/GGIx2IHnqqs1zn7H41o5McVUQzm3ujZmu1QEpj59aoy3TMwIGnHPFU+3/u/jXduPu/jWeVMk+TLctySMLn1JzVbmd6Ayg/ZP1qVuFQ5MeryJpOafbBTY3AxtUqrkHQCfSoPEVxgW0Y8871z8SLKF7IKBy0nFHnD5BwkPS1lKamGlfFqasMQTJk7w6YqtLxR5FAaMbedVZbh5Bg7L4CjzgkHiPkutDlYgCo6+JrqqZrqi8khuCP/2Q==');background-size:cover;background-position:center}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(1,8,18,.56))}.hero-content{position:relative;z-index:1;padding:33px 34px;max-width:630px}.eyebrow{font-size:12px;color:#73d9ff;letter-spacing:.08em;text-transform:uppercase}.hero h1{font-size:clamp(32px,4vw,49px);line-height:.98;margin:12px 0 10px}.hero p{max-width:540px;color:#bed6eb;line-height:1.55;margin:0 0 18px}.hero-buttons{display:flex;gap:8px;flex-wrap:wrap}.hero-buttons a{padding:10px 15px;border-radius:10px;text-decoration:none;border:1px solid rgba(91,182,239,.28);background:rgba(2,22,43,.75);font-size:12px}.hero-buttons a.primary{border:0;background:linear-gradient(135deg,#0da8ff,#1e5cf0);font-weight:700}
.stats-row{display:grid;grid-template-columns:1.6fr 1fr;gap:12px}.card{background:linear-gradient(180deg,rgba(6,28,53,.96),rgba(3,17,34,.98));border:1px solid rgba(61,145,211,.22);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18)}.section{padding:15px}.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:11px}.section-head h2{font-size:15px;margin:0}.section-head a{font-size:11px;color:#76d8ff;text-decoration:none}.dest-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.dest{display:block;text-decoration:none;min-height:102px;padding:12px;border:1px solid rgba(60,144,210,.18);border-radius:12px;background:#061a31;transition:.15s}.dest:hover{transform:translateY(-2px);border-color:rgba(55,191,255,.4);box-shadow:0 10px 25px rgba(0,144,255,.1)}.dest .ico{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(23,155,255,.13);font-size:16px;margin-bottom:9px}.dest b{display:block;font-size:12px}.dest p{margin:4px 0 0;color:#7498b8;font-size:10px;line-height:1.35}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.stat{padding:14px;border-radius:12px;background:#061a31;border:1px solid rgba(58,143,210,.16)}.stat b{display:block;font-size:22px;color:#e8f8ff}.stat small{color:#7194b5;font-size:10px}
.lower{display:grid;grid-template-columns:1.1fr 1fr;gap:12px}.feature{min-height:170px;padding:17px;position:relative;overflow:hidden;background:linear-gradient(140deg,#05192f,#042443)}.feature:before{content:"";position:absolute;right:-40px;bottom:-70px;width:230px;height:200px;background:radial-gradient(circle,rgba(4,177,255,.25),transparent 65%)}.feature h3{position:relative;margin:0 0 8px;font-size:21px}.feature p{position:relative;color:#86a9c9;font-size:12px;line-height:1.55;max-width:480px}.feature a{position:relative;display:inline-block;margin-top:6px;padding:9px 13px;border-radius:10px;background:linear-gradient(135deg,#0ba9ff,#165ef1);text-decoration:none;font-size:11px}
.quick-tools{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.tool{display:block;text-decoration:none;padding:11px;border-radius:11px;background:#061a31;border:1px solid rgba(58,143,210,.16)}.tool b{display:block;font-size:11px}.tool small{color:#7197b9;font-size:9px}
.right{border-left:1px solid rgba(52,136,200,.18);background:linear-gradient(180deg,#031122,#020b18);padding:16px 14px;display:flex;flex-direction:column;gap:12px}.air{border:1px solid rgba(58,176,255,.34);border-radius:17px;background:linear-gradient(170deg,#062343,#041329);padding:15px;box-shadow:0 16px 45px rgba(0,107,200,.13)}.air-head{display:flex;align-items:center;gap:10px}.air-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#2bdcff,#0a5eaa);box-shadow:0 0 27px rgba(38,205,255,.3)}.air-head b{font-size:14px}.air-head small{display:block;color:#7da9c9;font-size:10px;margin-top:3px}.bubble{margin-top:12px;padding:12px;border-radius:15px;background:linear-gradient(180deg,#0a305a,#062240);color:#d9efff;line-height:1.5;font-size:11px}.air-actions{display:grid;gap:7px;margin-top:10px}.air-actions a{display:block;text-decoration:none;padding:10px 11px;border:1px solid rgba(67,158,220,.2);border-radius:10px;background:#061c35;color:#b5d0e8;font-size:11px}.air-actions a:hover{border-color:#26caff;color:#fff}.mini-feature{margin-top:auto;border-radius:17px;min-height:270px;padding:18px;display:flex;align-items:flex-end;background:linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.45)),url('data:image/jpeg;base64,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');background-size:cover;background-position:right bottom;border:1px solid rgba(79,164,220,.24)}.mini-feature h3{margin:0;font-size:21px;font-weight:500;font-style:italic}
.footer{padding:8px 2px;color:#607f9f;font-size:10px;display:flex;justify-content:space-between;gap:10px}.footer a{color:#6f9abd;text-decoration:none;margin-left:12px}
@media(max-width:1180px){.layout{grid-template-columns:220px 1fr}.right{display:none}.dest-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:820px){.layout{display:block}.sidebar{display:none}.main{padding:10px}.top{flex-wrap:wrap}.search{max-width:none;order:2;width:100%}.stats-row,.lower{grid-template-columns:1fr}.dest-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.top-actions{margin-left:auto}}
</style></head><body>
<div class="layout">
<aside class="sidebar"><div class="logo"><div class="logo-mark">◉</div><div><b>Ocean Hub</b><small>Tu mundo, sin límites ✧</small></div></div>
<nav class="nav"><a class="active" href="/home">⌂ <span>Inicio</span></a><a href="/air-flow">✈️ <span>Air Flow</span></a><a href="/shop">🛒 <span>Tienda</span></a><a href="/dlc">🎮 <span>Juegos / DLCs</span></a><a href="/sell">💰 <span>Vender</span></a><a href="/key">🔑 <span>Verificar clave</span></a><a href="/profile">👤 <span>Perfil</span></a><a href="/leaderboard">🏆 <span>Ranking</span></a><a href="/reviews">👥 <span>Comunidad</span></a></nav>
<div class="premium"><b>♕ Ocean Hub Premium</b><p>Desbloquea todo el potencial.</p><a href="/suscribirse">Ver planes →</a></div><div class="side-bottom">Grandes cosas nacen en el mar.<br><br>🌊 Ocean Hub © 2026</div></aside>
<main class="main"><div class="top"><form class="search" id="globalSearch"><span>⌕</span><input id="searchInput" placeholder="Buscar servidores, juegos, herramientas..." autocomplete="off"></form><div class="top-actions"><a href="/suscribirse">♕</a><a href="/profile">◉</a>${auth ? '<div class="user-chip"><div class="avatar">◉</div><div><b>${safeName}</b><small><span class="dot"></span> En línea</small></div></div>' : '<a href="/login">Iniciar sesión</a>'}</div></div>
<section class="hero"><div class="hero-content"><div class="eyebrow">🌊 OCEAN HUB</div><h1>Bienvenido de nuevo,<br>${safeName} 👑</h1><p>Explora, juega, crea y vive la mejor experiencia en un solo lugar. Todo lo que necesitas, en Ocean Hub.</p><div class="hero-buttons"><a class="primary" href="/air-flow">Explorar Air Flow →</a><a href="/dlc">🎮 Ver novedades</a></div></div></section>
<div class="stats-row"><section class="card section"><div class="section-head"><div><h2>Destacados</h2><span style="font-size:10px;color:#6f94b6">Todo lo importante de Ocean Hub</span></div><a href="/shop">Ver tienda →</a></div>
<div class="dest-grid"><a class="dest" href="/shop"><div class="ico">🛒</div><b>Tienda</b><p>Compra DLCs y productos.</p></a><a class="dest" href="/dlc"><div class="ico">🎮</div><b>Juegos / DLCs</b><p>Explora contenido disponible.</p></a><a class="dest" href="/air-flow"><div class="ico">✈️</div><b>Air Flow</b><p>Tu asistente de IA.</p></a><a class="dest" href="/key"><div class="ico">🔑</div><b>Verificar</b><p>Valida tus claves.</p></a><a class="dest" href="/sell"><div class="ico">💰</div><b>Vender</b><p>Gestiona tus claves.</p></a><a class="dest" href="/claim-key"><div class="ico">🎫</div><b>Canjear</b><p>Canjea tus códigos.</p></a><a class="dest" href="/profile"><div class="ico">👤</div><b>Perfil</b><p>Tu cuenta y datos.</p></a><a class="dest" href="/leaderboard"><div class="ico">🏆</div><b>Ranking</b><p>Top de usuarios.</p></a></div></section>
<section class="card section"><div class="section-head"><div><h2>Estadísticas</h2><span style="font-size:10px;color:#6f94b6">Datos reales del sistema</span></div></div><div class="stats"><div class="stat"><b>${totalClavesDisponibles}</b><small>Claves disponibles</small></div><div class="stat"><b>$${valorTotalUSD.toFixed(2)}</b><small>Valor total (USD)</small></div><div class="stat"><b>${valoresMoneda.EUR || '—'}</b><small>EUR</small></div><div class="stat"><b>${valoresMoneda.GBP || '—'}</b><small>GBP</small></div></div></section></div>
<div class="lower"><section class="card feature"><h3>Explora un mundo lleno de posibilidades</h3><p>Compra, verifica, canjea y gestiona tus recursos de Ocean Hub desde una interfaz más limpia y rápida.</p><a href="/shop">Ver más →</a></section><section class="card section"><div class="section-head"><div><h2>Herramientas y accesos</h2><span style="font-size:10px;color:#6f94b6">Todo sigue conectado</span></div></div><div class="quick-tools"><a class="tool" href="/pay"><b>💳 Pagar</b><small>Checkout</small></a><a class="tool" href="/suscribirse"><b>♕ Premium</b><small>Planes</small></a><a class="tool" href="/reviews"><b>⭐ Reseñas</b><small>Comunidad</small></a><a class="tool" href="/claim-key"><b>🎫 Canjear</b><small>Código</small></a></div></section></div>
<div class="footer"><span>© 2026 Ocean Hub</span><span><a href="/reviews">Comunidad</a><a href="/profile">Perfil</a><a href="/logout">Cerrar sesión</a></span></div></main>
<aside class="right"><section class="air"><div class="air-head"><div class="air-icon">✦</div><div><b>Air Flow <span style="color:#7ddfff">IA</span></b><small>Tu asistente de confianza</small></div></div><div class="bubble">¡Hola, ${safeName}! 👋<br><br>¿En qué puedo ayudarte hoy?<br><br>Estoy aquí para mejorar tu experiencia en Ocean Hub.</div><div class="air-actions"><a href="/air-flow">🔎 Buscar en Air Flow</a><a href="/air-flow">🧭 Abrir asistente completo</a><a href="/air-flow">💻 Ayuda con código</a><a href="/air-flow">📅 Planificar</a></div></section><section class="mini-feature"><div><h3>Ocean Hub<br>Siempre contigo</h3><span style="font-size:10px;color:#b2cae0">🌊</span></div></section></aside>
</div>
<script>
document.getElementById('globalSearch')?.addEventListener('submit',event=>{event.preventDefault();const raw=document.getElementById('searchInput')?.value?.trim().toLowerCase()||'';if(!raw)return;const routes=[['air flow','/air-flow'],['ai','/air-flow'],['asistente','/air-flow'],['tienda','/shop'],['shop','/shop'],['dlc','/dlc'],['juego','/dlc'],['pagar','/pay'],['pago','/pay'],['vender','/sell'],['clave','/key'],['verificar','/key'],['canjear','/claim-key'],['perfil','/profile'],['ranking','/leaderboard'],['comunidad','/reviews'],['suscripción','/suscribirse'],['premium','/suscribirse']];const hit=routes.find(([term])=>raw.includes(term));location.href=hit?hit[1]:'/air-flow';});
</script>
${getCookieBannerScript()}
${getLegalFooter()}
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
async function handlePayPalCapture(env, request) {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('token') || url.searchParams.get('orderId');
    if (!orderId) {
        return new Response('Falta el ID de la orden', { status: 400 });
    }

    try {
        const captureData = await capturePayPalOrder(env, orderId);
        if (captureData?.status !== 'COMPLETED') return new Response('Pago no completado', { status: 402 });
        const paymentKey = `paypal_processed_${orderId}`;
        if (await env.STATS.get(paymentKey)) return new Response('Pago ya procesado', { status: 200 });
        await env.STATS.put(paymentKey, '1', { expirationTtl: 31536000 });
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
            <p>${e.message}</p>
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
    if (!clientId) return new Response('Discord OAuth no configurado', { status: 400 });
    const redirectUri = `${getBaseUrl(env)}/auth/discord/callback`;
    const scope = 'identify email';
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
    return Response.redirect(authUrl, 302);
}

async function handleDiscordCallback(env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return new Response('Falta código', { status: 400 });

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

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        return new Response(`Error al obtener token de Discord:<br><pre>${JSON.stringify(tokenData, null, 2)}</pre>`, {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const email = userData.email;
    if (!email || userData.verified !== true) return new Response('El email de Discord debe estar verificado.', { status: 400 });

    let user = await getUserByEmail(env, email);
    if (!user) {
        const randomPass = generateRandomHex(12);
        try {
            user = await createUser(env, email, userData.username || email.split('@')[0], randomPass, null);
        } catch (e) {
            return new Response('Error al crear usuario: ' + e.message, { status: 500 });
        }
    }

    await logUserAction(env, email, 'login', { ip: getClientIP(request), method: 'discord' });
    const sessionToken = await createSession(env, user);
    const cookie = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Sesión iniciada con Discord</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
}

async function handleGoogleAuth(env) {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return new Response('Google OAuth no configurado', { status: 400 });
    const redirectUri = `${getBaseUrl(env)}/auth/google/callback`;
    const scope = 'email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=online`;
    return Response.redirect(authUrl, 302);
}

async function handleGoogleCallback(env, request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) return new Response('Falta código', { status: 400 });

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

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        return new Response(`Error al obtener token de Google:<br><pre>${JSON.stringify(tokenData, null, 2)}</pre>`, {
            status: 400, headers: { 'Content-Type': 'text/html' }
        });
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const email = userData.email;
    if (!email || userData.verified_email !== true) return new Response('El email de Google debe estar verificado.', { status: 400 });

    let user = await getUserByEmail(env, email);
    if (!user) {
        const randomPass = generateRandomHex(12);
        try {
            user = await createUser(env, email, userData.name || email.split('@')[0], randomPass, null);
        } catch (e) {
            return new Response('Error al crear usuario: ' + e.message, { status: 500 });
        }
    }

    await logUserAction(env, email, 'login', { ip: getClientIP(request), method: 'google' });
    const sessionToken = await createSession(env, user);
    const cookie = `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`;
    return new Response(`
    <html><body style="background:#0a1a2b;color:white;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:monospace;">
        <h2 style="color:#00cc88;">✅ Sesión iniciada con Google</h2>
        <p>Bienvenido, ${escapeHTML(user.name || user.email)}.</p>
        <a href="/profile" style="color:#00ccff;">Ir a mi perfil</a>
    </body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html', 'Set-Cookie': cookie } });
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
    const body = await request.json();
    const { url } = body;
    if (!url) return jsonResponse({ error: 'Falta URL' }, 400);
    await env.STATS.put(`webhook_${auth.user.email}`, JSON.stringify({ url, created: new Date().toISOString() }));
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
        const orderId = body.resource?.supplementary_data?.related_ids?.order_id || body.resource?.id;
        if (!orderId) return jsonResponse({error:'orderId ausente'},400);
        return await handlePayPalCapture(env,new Request(`${getBaseUrl(env)}/paypal/capture?orderId=${encodeURIComponent(orderId)}`));
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
    const url = new URL(request.url);
    const plan = url.searchParams.get('plan');
    const email = url.searchParams.get('email');
    if (!plan || !email) {
        return jsonResponse({ error: 'Faltan parámetros (plan y email)' }, 400);
    }
    try {
        const order = await createPayPalOrderSuscripcion(env, plan, email);
        return jsonResponse(order);
    } catch (e) {
        return jsonResponse({ error: 'No se pudo crear la orden de pago' }, 500);
    }
}

async function handleCronJobs(env) {
    await updateLeaderboard(env);
    await backupKV(env);
    return jsonResponse({ message: 'Cron jobs ejecutados' });
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
    ];
    if (publicPaths.includes(path)) return true;

    if (path.startsWith('/verify/')) return true;
    if (path.startsWith('/auth/')) return true;
    if (path.startsWith('/s/')) return true;
    return false;
}

// ==================================================
// [ MANEJADOR PRINCIPAL ]
// ==================================================

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
        if (path === '/air-flow') return await handleAirFlowPageV11(env, request);
        if (path === '/air-flow/chat') return await handleAirFlowChatV11(env, request);
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
            const tipo = url.searchParams.get('tipo') || 'dlc';
            const email = url.searchParams.get('email') || '';
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
            const auth = await requireAuth(env, request);
            if (!auth) return jsonResponse({ error: 'No autorizado' }, 403);
            await renovarSuscripcion(env, auth.user.email, 30);
            return jsonResponse({ message: 'Suscripción renovada +30 días' });
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
        if (path === '/cron-renew') return await handleCronRenew(env);
        if (path === '/admin/generar-prueba') return await handleGenerarPrueba(env, request);
        if (path.startsWith('/s/')) return await handleShortRedirect(env, url);

        // --- Admin usuarios, backup, upload ---
        if (path === '/admin/users') return await handleAdminUsers(env, url, request);
        if (path === '/admin/user-action') return await handleAdminUserAction(env, request);
        if (path === '/admin/backup') return await handleBackup(env, request);
        if (path === '/admin/upload-keys') return await handleUploadKeys(env, request);

        if (path === '/google53213708c5fda63c.html') return new Response('google-site-verification: google53213708c5fda63c.html', { headers: { 'Content-Type': 'text/html' } });

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
        if (path === '/cron-jobs') return await handleCronJobs(env);

        return new Response('🌊 404 - Ruta no encontrada', { status: 404 });
}

async function applySecurityHeaders(response) {
    const headers = new Headers(response.headers);
    const nonceBytes = new Uint8Array(18);
    crypto.getRandomValues(nonceBytes);
    const nonce = btoa(String.fromCharCode(...nonceBytes));
    const contentType = headers.get('Content-Type') || '';
    let body = response.body;
    if (contentType.includes('text/html')) {
        let html = await response.text();
        html = html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
        html = html.replace(/<style(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`);
        body = html;
    }
    headers.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.paypal.com https://www.paypalobjects.com; script-src-attr 'unsafe-inline'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api-m.paypal.com https://api.brevo.com https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com; frame-src 'self' https://www.paypal.com; upgrade-insecure-requests`);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
