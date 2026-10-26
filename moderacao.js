(function () {
  var db = window.vaDb;
  if (!db) return;
  var BUCKET = "fotos-ofertas";
  var MOTIVOS = {
    oferta_falsa: "Oferta falsa",
    preco_errado: "Preço errado",
    foto_inadequada: "Foto inadequada",
    spam: "Spam",
    outro: "Outro"
  };

  var css = document.createElement("style");
  css.textContent =
    ".den-row{margin-top:10px}.den-row>.btn{font-size:13px;padding:8px 10px}" +
    ".den-box{display:flex;gap:8px;margin-top:8px}.den-box[hidden]{display:none}.den-box select{flex:1}" +
    ".area-txt{width:100%;min-height:96px;padding:11px 14px;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);resize:vertical}" +
    ".estrelas{color:#d9a021;letter-spacing:2px;font-size:18px}";
  document.head.appendChild(css);

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function moeda(n) { return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; }
  function dataHora(iso) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function urlFoto(p) { return db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl; }
  function aviso(t) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = t;
    el.style.display = "block";
    clearTimeout(aviso.t);
    aviso.t = setTimeout(function () { el.style.display = "none"; }, 5000);
  }

  // ---------- DENUNCIAR (para todo mundo) ----------
  var lista = document.getElementById("lista");
  var opcoes = Object.keys(MOTIVOS).map(function (k) {
    return '<option value="' + k + '">' + MOTIVOS[k] + "</option>";
  }).join("");

  function decora() {
    lista.querySelectorAll("article.card").forEach(function (a) {
      if (a.querySelector(".den-row")) return;
      var ref = a.querySelector("[data-id]");
      if (!ref) return;
      var id = esc(ref.dataset.id);
      var row = document.createElement("div");
      row.className = "den-row";
      row.innerHTML =
        '<button class="btn" data-den="abrir" data-id="' + id + '">🚩 Denunciar</button>' +
        '<div class="den-box" hidden><select aria-label="Motivo da denúncia">' + opcoes + "</select>" +
        '<button class="btn main" data-den="enviar" data-id="' + id + '">Enviar</button></div>';
      var det = a.querySelector("details");
      if (det) a.insertBefore(row, det); else a.appendChild(row);
    });
  }

  if (lista) {
    new MutationObserver(decora).observe(lista, { childList: true });
    decora();
    lista.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-den]");
      if (!b || b.disabled) return;
      var row = b.closest(".den-row");
      if (b.dataset.den === "abrir") {
        var box = row.querySelector(".den-box");
        box.hidden = !box.hidden;
        return;
      }
      if (!window.vaUser) { aviso("Entre na sua conta (aba Perfil) para denunciar."); return; }
      b.disabled = true;
      var r = await db.rpc("denunciar_oferta", {
        p_oferta: b.dataset.id,
        p_motivo: row.querySelector("select").value
      });
      b.disabled = false;
      if (r.error) { aviso(r.error.message); return; }
      row.querySelector(".den-box").hidden = true;
      aviso("Denúncia enviada. Obrigado por ajudar a manter o Vence Aí confiável.");
    });
  }

  // ---------- AVALIAR O APP (para quem esta logado) ----------
  function desenhaAvaliacao() {
    var perfil = document.getElementById("v-perfil");
    if (!perfil) return;
    var box = document.getElementById("aval-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "aval-box";
      perfil.appendChild(box);
    }
    if (!window.vaUser) { box.innerHTML = ""; return; }
    box.innerHTML =
      '<div class="card"><strong>Avalie o Vence Aí</strong>' +
      '<p class="small">Sua opinião chega só para os administradores.</p>' +
      '<label for="av-nota">Nota</label>' +
      '<select id="av-nota"><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Bom</option>' +
      '<option value="3">★★★ Regular</option><option value="2">★★ Ruim</option><option value="1">★ Muito ruim</option></select>' +
      '<label for="av-msg">Sua mensagem</label>' +
      '<textarea id="av-msg" class="area-txt" maxlength="1000" placeholder="O que está bom? O que podemos melhorar?"></textarea>' +
      '<p class="small" id="av-status" role="status"></p>' +
      '<div class="actions"><button class="btn main" id="av-enviar" type="button">Enviar avaliação</button></div></div>';
    document.getElementById("av-enviar").onclick = async function () {
      var st = document.getElementById("av-status");
      var txt = document.getElementById("av-msg").value.trim();
      if (txt.length < 3) { st.textContent = "Escreva pelo menos 3 letras."; return; }
      this.disabled = true;
      st.textContent = "Enviando...";
      var r = await db.rpc("enviar_avaliacao", {
        p_nota: Number(document.getElementById("av-nota").value),
        p_mensagem: txt
      });
      this.disabled = false;
      if (r.error) { st.textContent = r.error.message; return; }
      document.getElementById("av-msg").value = "";
      st.textContent = "Obrigado! Sua avaliação foi enviada.";
    };
  }

  // ---------- PAINEL DE MODERACAO (so administradores) ----------
  var painel = null;
  var modo = "denunciadas";

  document.querySelectorAll("nav button").forEach(function (b) {
    b.addEventListener("click", function () {
      var s = document.getElementById("v-moderacao");
      if (s && b.dataset.v !== "moderacao") s.hidden = true;
    });
  });

  function removePainel() {
    var b = document.querySelector('nav button[data-v="moderacao"]');
    var visivel = painel && !painel.hidden;
    if (b) b.remove();
    if (painel) { painel.remove(); painel = null; }
    if (visivel) {
      var o = document.querySelector('nav button[data-v="ofertas"]');
      if (o) o.click();
    }
  }

  function desenhaModos() {
    var modos = [["denunciadas", "Denunciadas"], ["recentes", "Recentes"], ["removidas", "Removidas"],
                 ["avaliacoes", "Avaliações"], ["lojas", "Lojas"]];
    document.getElementById("m-modos").innerHTML = modos.map(function (m) {
      return '<button class="btn' + (m[0] === modo ? " main" : "") + '" data-modo="' + m[0] + '">' + m[1] + "</button>";
    }).join("");
  }

  function cardAdmin(o) {
    var motivos = (o.motivos || []).map(function (m) { return MOTIVOS[m] || m; }).join(", ");
    var fotos = [o.foto_prateleira, o.foto_produto, o.foto_etiqueta, o.foto_validade].map(function (f) {
      return '<img alt="Foto da oferta" loading="lazy" src="' + esc(urlFoto(f)) + '">';
    }).join("");
    var botoes;
    if (o.status === "removida") {
      botoes = '<button class="btn main" data-adm="restaurar" data-id="' + esc(o.id) + '">Restaurar oferta</button>';
    } else {
      botoes = '<button class="btn main" data-adm="remover" data-id="' + esc(o.id) + '">Remover oferta</button>' +
        '<button class="btn" data-adm="restaurar" data-id="' + esc(o.id) + '">Manter</button>' +
        (o.autor_banido ? "" : '<button class="btn" data-adm="banir" data-autor="' + esc(o.autor_id) + '">Banir autor</button>');
    }
    return '<article class="card"><p class="name">' + esc(o.nome) + "</p>" +
      '<p class="meta">' + esc(o.categoria) + " · " + moeda(o.preco_promocional) + " · validade " + dataBR(o.validade) + "</p>" +
      '<p class="small">Autor: ' + esc(o.autor) + " (" + esc(o.autor_nivel) + ")" +
      (o.autor_banido ? " · <strong>BANIDO</strong>" : "") +
      "<br>Status: " + esc(o.status) + " · Denúncias abertas: " + o.denuncias +
      (motivos ? " (" + esc(motivos) + ")" : "") + "</p>" +
      '<div class="fotos">' + fotos + "</div>" +
      '<div class="actions">' + botoes + "</div></article>";
  }

  function cardAvaliacao(a) {
    var estrelas = "★★★★★".slice(0, a.nota) + "☆☆☆☆☆".slice(0, 5 - a.nota);
    var rotulo = a.status === "nova" ? "Nova" : a.status === "lida" ? "Lida" : "Resolvida";
    var botoes = "";
    if (a.status !== "lida") botoes += '<button class="btn" data-adm="aval" data-id="' + esc(a.id) + '" data-status="lida">Marcar como lida</button>';
    if (a.status !== "resolvida") botoes += '<button class="btn main" data-adm="aval" data-id="' + esc(a.id) + '" data-status="resolvida">Resolvida</button>';
    if (a.status !== "nova") botoes += '<button class="btn" data-adm="aval" data-id="' + esc(a.id) + '" data-status="nova">Reabrir</button>';
    return '<article class="card"><span class="estrelas">' + estrelas + "</span> " +
      '<span class="tag ' + (a.status === "nova" ? "t-warn" : a.status === "lida" ? "t-old" : "t-ok") + '">' + rotulo + "</span>" +
      '<p style="margin:10px 0 0;white-space:pre-wrap">' + esc(a.mensagem) + "</p>" +
      '<p class="small">' + esc(a.apelido) + " (" + esc(a.nivel) + ") · " + dataHora(a.criado_em) + "</p>" +
      '<div class="actions">' + botoes + "</div></article>";
  }

  function cardLoja(u) {
    return '<article class="card"><p class="name">' + esc(u.nome) + "</p>" +
      '<p class="meta">' + esc(u.rede) + " · " + esc(u.cidade || "cidade não informada") + "/" + esc(u.estado) + "</p>" +
      '<p class="small">' + esc(u.endereco || "sem endereço") + "<br>Raio do GPS: " + u.raio_metros + " m · " +
      (u.ativa ? "Ativa" : "<strong>Desativada</strong>") +
      (u.teste_sem_gps ? " · <strong>MODO TESTE LIGADO</strong>" : "") + "</p>" +
      '<div class="actions">' +
      '<button class="btn" data-adm="loja-ativa" data-id="' + esc(u.id) + '" data-ativa="' + (u.ativa ? "0" : "1") + '">' + (u.ativa ? "Desativar" : "Ativar") + "</button>" +
      '<button class="btn" data-adm="loja-raio" data-id="' + esc(u.id) + '" data-raio="' + u.raio_metros + '">Ajustar raio</button></div></article>';
  }

  function formLoja() {
    return '<div class="card"><strong>Adicionar loja</strong>' +
      '<label for="l-rede">Rede (ex.: Americanas)</label><input id="l-rede" maxlength="60" list="l-redes">' +
      '<datalist id="l-redes"></datalist>' +
      '<label for="l-nome">Nome da loja (ex.: Americanas Centro)</label><input id="l-nome" maxlength="80">' +
      '<label for="l-end">Endereço</label><input id="l-end" maxlength="150">' +
      '<label for="l-cid">Cidade</label><input id="l-cid" maxlength="80">' +
      '<label for="l-uf">Estado (2 letras)</label><input id="l-uf" maxlength="2" placeholder="RJ" style="text-transform:uppercase">' +
      '<label for="l-coord">Coordenadas (cole do Google Maps)</label><input id="l-coord" placeholder="-22.867287, -43.747851">' +
      '<label for="l-raio">Raio do GPS em metros (shopping: 150 ou mais)</label><input id="l-raio" type="number" inputmode="numeric" value="100" min="20" max="1000">' +
      '<p class="small" id="l-msg" role="status"></p>' +
      '<div class="actions"><button class="btn main" data-adm="loja-salvar" type="button">Salvar loja</button></div></div>';
  }

  async function carregaFila() {
    var el = document.getElementById("m-lista");
    if (!el) return;
    el.innerHTML = '<p class="empty">Carregando...</p>';
    var r;
    if (modo === "avaliacoes") {
      r = await db.rpc("admin_avaliacoes");
      if (r.error) { el.innerHTML = '<p class="empty">' + esc(r.error.message) + "</p>"; return; }
      var la = r.data || [];
      el.innerHTML = la.length ? la.map(cardAvaliacao).join("") : '<p class="empty">Nenhuma avaliação ainda.</p>';
      return;
    }
    if (modo === "lojas") {
      r = await db.rpc("admin_unidades");
      if (r.error) { el.innerHTML = '<p class="empty">' + esc(r.error.message) + "</p>"; return; }
      var lu = r.data || [];
      el.innerHTML = formLoja() + (lu.length ? lu.map(cardLoja).join("") : '<p class="empty">Nenhuma loja cadastrada.</p>');
      var dl = document.getElementById("l-redes");
      var vistas = {};
      lu.forEach(function (u) {
        if (!vistas[u.rede]) { vistas[u.rede] = 1; dl.innerHTML += '<option value="' + esc(u.rede) + '"></option>'; }
      });
      return;
    }
    r = await db.rpc("admin_ofertas", { p_modo: modo });
    if (r.error) { el.innerHTML = '<p class="empty">' + esc(r.error.message) + "</p>"; return; }
    var l = r.data || [];
    el.innerHTML = l.length ? l.map(cardAdmin).join("") : '<p class="empty">Nada por aqui.</p>';
  }

  function leCoordenadas(txt) {
    var m = String(txt || "").match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }

  async function acaoAdmin(e) {
    var m = e.target.closest("[data-modo]");
    if (m) { modo = m.dataset.modo; desenhaModos(); carregaFila(); return; }
    var b = e.target.closest("[data-adm]");
    if (!b || b.disabled) return;
    var acao = b.dataset.adm;
    var r;
    if (acao === "remover") {
      var motivo = window.prompt("Motivo da remoção (pode deixar em branco):", "");
      if (motivo === null) return;
      b.disabled = true;
      r = await db.rpc("admin_remover_oferta", { p_oferta: b.dataset.id, p_motivo: motivo });
    } else if (acao === "restaurar") {
      if (!window.confirm("Manter/restaurar esta oferta e encerrar as denúncias dela?")) return;
      b.disabled = true;
      r = await db.rpc("admin_restaurar_oferta", { p_oferta: b.dataset.id });
    } else if (acao === "banir") {
      if (!window.confirm("Banir este usuário e remover todas as ofertas ativas dele?")) return;
      var mot = window.prompt("Motivo do banimento (pode deixar em branco):", "");
      if (mot === null) return;
      b.disabled = true;
      r = await db.rpc("admin_banir_usuario", { p_usuario: b.dataset.autor, p_motivo: mot });
    } else if (acao === "aval") {
      b.disabled = true;
      r = await db.rpc("admin_marcar_avaliacao", { p_id: b.dataset.id, p_status: b.dataset.status });
    } else if (acao === "loja-ativa") {
      if (!window.confirm(b.dataset.ativa === "1" ? "Ativar esta loja?" : "Desativar esta loja? Ela some da lista do app.")) return;
      b.disabled = true;
      r = await db.rpc("admin_ajustar_unidade", { p_id: b.dataset.id, p_ativa: b.dataset.ativa === "1", p_raio: null });
    } else if (acao === "loja-raio") {
      var txt = window.prompt("Novo raio do GPS em metros (20 a 1000):", b.dataset.raio);
      if (txt === null) return;
      var raio = parseInt(txt, 10);
      if (!(raio >= 20 && raio <= 1000)) { aviso("Digite um número entre 20 e 1000."); return; }
      b.disabled = true;
      r = await db.rpc("admin_ajustar_unidade", { p_id: b.dataset.id, p_ativa: null, p_raio: raio });
    } else if (acao === "loja-salvar") {
      var msg = document.getElementById("l-msg");
      var c = leCoordenadas(document.getElementById("l-coord").value);
      if (!c) { msg.textContent = "Cole as coordenadas do Google Maps, como -22.867287, -43.747851."; return; }
      b.disabled = true;
      msg.textContent = "Salvando...";
      r = await db.rpc("admin_salvar_unidade", {
        p_rede: document.getElementById("l-rede").value,
        p_nome: document.getElementById("l-nome").value,
        p_endereco: document.getElementById("l-end").value,
        p_cidade: document.getElementById("l-cid").value,
        p_estado: document.getElementById("l-uf").value,
        p_lat: c.lat,
        p_lng: c.lng,
        p_raio: parseInt(document.getElementById("l-raio").value, 10)
      });
      b.disabled = false;
      if (r.error) { msg.textContent = r.error.message; return; }
      aviso("Loja salva! Recarregue o app para ela aparecer na lista de unidades.");
      carregaFila();
      return;
    } else {
      return;
    }
    b.disabled = false;
    if (r.error) { aviso(r.error.message); return; }
    aviso("Feito.");
    carregaFila();
  }

  function criaPainel() {
    if (painel) return;
    var nav = document.querySelector("nav");
    var btn = document.createElement("button");
    btn.dataset.v = "moderacao";
    btn.innerHTML = "<span>🛡️</span>Moderar";
    nav.appendChild(btn);

    painel = document.createElement("section");
    painel.id = "v-moderacao";
    painel.hidden = true;
    painel.innerHTML = '<h2>Moderação</h2><p class="sub">Só administradores veem esta aba.</p>' +
      '<div class="actions" id="m-modos"></div><div id="m-lista"></div>';
    var main = document.querySelector("main");
    main.insertBefore(painel, main.querySelector(".notice"));

    btn.addEventListener("click", function () {
      document.querySelectorAll("nav button").forEach(function (x) { x.removeAttribute("aria-current"); });
      btn.setAttribute("aria-current", "page");
      ["ofertas", "cadastrar", "perfil"].forEach(function (v) {
        document.getElementById("v-" + v).hidden = true;
      });
      painel.hidden = false;
      window.scrollTo(0, 0);
      carregaFila();
    });
    painel.addEventListener("click", acaoAdmin);
    desenhaModos();
  }

  async function verificaAdmin() {
    if (!window.vaUser) { removePainel(); return; }
    var r = await db.rpc("eh_admin");
    if (r.error || r.data !== true) { removePainel(); return; }
    criaPainel();
  }

  document.addEventListener("va-auth", function () { desenhaAvaliacao(); verificaAdmin(); });
  desenhaAvaliacao();
  verificaAdmin();
})();
