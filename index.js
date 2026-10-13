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
