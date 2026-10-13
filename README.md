# 🌊 Ocean Hub — Estructura Modular

Wrangler empaqueta todos los archivos de `src/` en un solo Worker al hacer deploy.
El código está separado por responsabilidad para facilitar mantenimiento.

## Estructura

```
oceanhud/
├── src/
│   ├── shared.js    — Config, utils, auth, KV, email, seguridad (todo compartido)
│   ├── airflow.js   — ✈️ Air Flow IA (Gemini, OpenRouter, modos, agente)
│   ├── web.js       — Páginas web: Home, Shop, Sell, Pay, DLC, Key, PayPal
│   ├── admin.js     — Panel admin, usuarios, backup, OAuth, Social, Notificaciones
│   └── index.js     — Router principal (workerFetch) + export default
├── wrangler.jsonc
└── package.json
```

## Módulos

| Archivo     | Líneas | Qué contiene |
|-------------|--------|--------------|
| shared.js   | ~3570  | Configuración, helpers, TOTP, auth, KV, email, rate limiting, etc. |
| airflow.js  | ~1190  | Todo Air Flow: chat, visión, memoria, agente, modos, imágenes |
| web.js      | ~870   | Home, Shop, Sell, Pay, DLC, Key, Resellers, PayPal capture |
| admin.js    | ~2700  | Dashboard, admin panel, usuarios, backup, OAuth, Social, DMs, Notifs |
| index.js    | ~343   | Router único + applySecurityHeaders + export default |

## Deploy

```bash
npm install
npx wrangler deploy
```

## ¿Cuál archivo tocar para cada cosa?

- **Agregar/cambiar modelo de Air Flow** → `src/airflow.js`
- **Cambiar algo del shop o PayPal** → `src/web.js`
- **Panel de admin** → `src/admin.js`
- **Login, sesiones, email** → `src/shared.js`
- **Agregar una ruta nueva** → `src/index.js` (en workerFetch)
