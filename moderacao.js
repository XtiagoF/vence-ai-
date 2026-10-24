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
    ".den-box{display:flex;gap:8px;margin-top:8px}.den-box[hidden]{display:none}.den-box select{flex:1}";
  document.head.appendChild(css);

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function moeda(n) { return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; }
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

  // ---------- PAINEL DE MODERACAO (so administradores) ----------
  var painel = null;
  var modo = "denunciadas";

  // ao tocar nas outras abas, esconde o painel
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
    var modos = [["denunciadas", "Denunciadas"], ["recentes", "Recentes"], ["removidas", "Removidas"]];
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

  async function carregaFila() {
    var el = document.getElementById("m-lista");
    if (!el) return;
    el.innerHTML = '<p class="empty">Carregando...</p>';
    var r = await db.rpc("admin_ofertas", { p_modo: modo });
    if (r.error) { el.innerHTML = '<p class="empty">' + esc(r.error.message) + "</p>"; return; }
    var l = r.data || [];
    el.innerHTML = l.length ? l.map(cardAdmin).join("") : '<p class="empty">Nada por aqui.</p>';
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

  document.addEventListener("va-auth", verificaAdmin);
  verificaAdmin();
})();
