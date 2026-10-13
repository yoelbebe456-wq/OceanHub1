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

