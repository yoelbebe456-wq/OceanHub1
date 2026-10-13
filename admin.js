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

