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

