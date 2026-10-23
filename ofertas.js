(function () {
  var $ = function (s) { return document.querySelector(s); };
  var db = window.vaDb;
  if (!db) {
    $("#lista").innerHTML = '<p class="empty">Não foi possível carregar as ofertas. Confira config.js e auth.js.</p>';
    return;
  }
  var BUCKET = "fotos-ofertas";
  var filtro = "recentes";
  var ofertas = [];

  // estilos extras e aviso na tela
  var css = document.createElement("style");
  css.textContent =
    "#toast{position:fixed;left:16px;right:16px;bottom:90px;background:var(--ink);color:var(--bg);padding:14px;border-radius:14px;display:none;z-index:5}" +
    ".preco-box{display:flex;gap:8px;margin-top:10px}.preco-box[hidden]{display:none}.preco-box input{flex:1}";
  document.head.appendChild(css);
  var toast = document.createElement("div");
  toast.id = "toast";
  toast.setAttribute("role", "status");
  document.body.appendChild(toast);
  function aviso(t) {
    toast.textContent = t;
    toast.style.display = "block";
    clearTimeout(aviso.t);
    aviso.t = setTimeout(function () { toast.style.display = "none"; }, 4500);
  }

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function moeda(n) { return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function hojeISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function diasAte(iso) {
    var p = iso.split("-");
    var v = new Date(+p[0], +p[1] - 1, +p[2]);
    var h = new Date();
    h = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    return Math.round((v - h) / 86400000);
  }
  function dataBR(iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; }
  function horasDesde(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)); }
  function quando(h) { return h < 1 ? "agora há pouco" : h < 48 ? "há " + h + " h" : "há " + Math.floor(h / 24) + " dias"; }
  function estado(h) {
    if (h >= 48) return ["Desatualizada", "t-old"];
    if (h >= 24) return ["Pode estar desatualizada", "t-old"];
    return ["Confirmada recentemente", "t-ok"];
  }
  function urlFoto(caminho) { return db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl; }

  function card(o) {
    var d = diasAte(o.validade);
    var h = horasDesde(o.confirmado_em);
    var e = estado(h);
    var t = d <= 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : "Vence em " + d + " dias (" + dataBR(o.validade) + ")";
    var autor = o.perfis ? esc(o.perfis.apelido) + " (" + esc(o.perfis.nivel) + ")" : "alguém da comunidade";
    var minha = window.vaUser && window.vaUser.id === o.autor_id;
    var id = esc(o.id);
    var fotos = [o.foto_prateleira, o.foto_produto, o.foto_etiqueta, o.foto_validade].map(function (f) {
      return '<img alt="Foto da oferta" loading="lazy" src="' + esc(urlFoto(f)) + '">';
    }).join("");
    var botoes = minha
      ? '<button class="btn" data-a="acabou" data-id="' + id + '">Acabou</button>'
      : '<button class="btn main" data-a="confirmar" data-id="' + id + '">Confirmar</button>' +
        '<button class="btn" data-a="atualizar" data-id="' + id + '">Atualizar preço</button>' +
        '<button class="btn" data-a="acabou" data-id="' + id + '">Acabou</button>';
    var caixaPreco = minha ? "" :
      '<div class="preco-box" hidden><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="Novo preço" aria-label="Novo preço">' +
      '<button class="btn main" data-a="salvar-preco" data-id="' + id + '">Salvar</button></div>';
    var n = o.confirmacoes || 0;
    return '<article class="card"><div class="top">' +
      '<img class="photo" alt="Foto do produto" loading="lazy" src="' + esc(urlFoto(o.foto_produto)) + '">' +
      '<div><p class="name">' + esc(o.nome) + '</p><p class="meta">' + esc(o.marca || "Marca não informada") + " · " + esc(o.categoria) + '</p></div></div>' +
      '<div class="price"><span class="por">' + moeda(o.preco_promocional) + '</span>' +
      (o.preco_original ? '<span class="de">' + moeda(o.preco_original) + '</span>' : '<span class="de" style="text-decoration:none">preço original não informado</span>') + '</div>' +
      '<span class="tag ' + (d <= 3 ? "t-warn" : "t-ok") + '">📅 ' + t + '</span>' +
      '<span class="tag ' + e[1] + '">' + e[0] + '</span>' +
      (minha ? '<span class="tag t-ok">Sua oferta</span>' : '') +
      (o.avisos_acabou > 0 ? '<span class="tag t-bad">' + o.avisos_acabou + ' pessoa avisou que acabou</span>' : '') +
      '<p class="small">Última confirmação: ' + quando(h) + " · " + n + (n === 1 ? " confirmação" : " confirmações") +
      (o.preco_anterior ? '<br>Preço atualizado pela comunidade (antes: ' + moeda(o.preco_anterior) + ')' : '') +
      '<br>Publicado por ' + autor + '</p>' +
      '<div class="actions">' + botoes + '</div>' + caixaPreco +
      '<details><summary>Ver as 4 fotos</summary><div class="fotos">' + fotos + '</div></details></article>';
  }

  function mostra() {
    var q = $("#busca").value.trim().toLowerCase();
    var l = ofertas.filter(function (o) {
      return (o.nome + " " + (o.marca || "") + " " + o.categoria).toLowerCase().indexOf(q) !== -1;
    });
    if (filtro === "vencem") {
      l = l.filter(function (o) { return diasAte(o.validade) <= 7; })
           .sort(function (a, b) { return a.validade < b.validade ? -1 : 1; });
    }
    if (filtro === "preco") {
      l = l.slice().sort(function (a, b) { return a.preco_promocional - b.preco_promocional; });
    }
    $("#lista").innerHTML = l.length ? l.map(card).join("") : '<p class="empty">Nenhuma oferta encontrada.</p>';
  }

  async function carregaUnidades() {
    var r = await db.from("unidades").select("id,nome,cidade").order("nome");
    var lista = r.data || [];
    var opts = lista.length
      ? lista.map(function (u) {
          return '<option value="' + esc(u.id) + '">' + esc(u.nome) + (u.cidade ? " - " + esc(u.cidade) : "") + "</option>";
        }).join("")
      : '<option value="">Nenhuma unidade cadastrada</option>';
    $("#unidade").innerHTML = opts;
    $("#f-unidade").innerHTML = opts;
  }

  async function carregaOfertas(silencioso) {
    var uid = $("#unidade").value;
    if (!uid) { $("#lista").innerHTML = '<p class="empty">Nenhuma unidade cadastrada ainda.</p>'; return; }
    if (!silencioso) $("#lista").innerHTML = '<p class="empty">Carregando...</p>';
    var r = await db.from("ofertas")
      .select("id,autor_id,nome,marca,categoria,preco_original,preco_promocional,preco_anterior,validade,foto_prateleira,foto_produto,foto_etiqueta,foto_validade,confirmado_em,confirmacoes,avisos_acabou,perfis(apelido,nivel)")
      .eq("unidade_id", uid)
      .eq("status", "ativa")
      .gte("validade", hojeISO())
      .order("criado_em", { ascending: false })
      .limit(100);
    if (r.error) {
      $("#lista").innerHTML = '<p class="empty">Não foi possível carregar as ofertas (' + esc(r.error.message) + ').</p>';
      return;
    }
    ofertas = r.data || [];
    mostra();
  }

  async function atualizaPerfilNaTela() {
    var u = window.vaUser;
    if (!u) return null;
    var r = await db.from("perfis").select("nivel,pontos,reputacao").eq("id", u.id).single();
    if (r.error || !r.data) return null;
    if ($("#p-nivel")) $("#p-nivel").textContent = r.data.nivel;
    if ($("#p-info")) $("#p-info").textContent = "Pontos: " + r.data.pontos + " · Reputação: " + r.data.reputacao + "/100";
    return r.data;
  }

  // botoes Confirmar / Atualizar preco / Acabou
  $("#lista").addEventListener("click", async function (e) {
    var b = e.target.closest("[data-a]");
    if (!b) return;
    var acao = b.dataset.a;
    var id = b.dataset.id;
    if (acao === "atualizar") {
      var caixa = b.closest("article").querySelector(".preco-box");
      if (caixa) caixa.hidden = !caixa.hidden;
      return;
    }
    if (!window.vaUser) { aviso("Entre na sua conta (aba Perfil) para participar."); return; }
    var r;
    if (acao === "confirmar") {
      b.disabled = true;
      r = await db.rpc("confirmar_oferta", { p_oferta: id });
    } else if (acao === "acabou") {
      if (!window.confirm("Avisar que este produto acabou?")) return;
      b.disabled = true;
      r = await db.rpc("reportar_acabou", { p_oferta: id });
    } else if (acao === "salvar-preco") {
      var v = Number(b.closest(".preco-box").querySelector("input").value);
      if (!(v > 0)) { aviso("Digite o novo preço."); return; }
      b.disabled = true;
      r = await db.rpc("atualizar_preco", { p_oferta: id, p_preco: v });
    } else {
      return;
    }
    b.disabled = false;
    if (r.error) { aviso(r.error.message); return; }
    var p = await atualizaPerfilNaTela();
    aviso("Obrigado! Sua ação foi registrada." + (p ? " Você tem " + p.pontos + " pontos (" + p.nivel + ")." : ""));
    await carregaOfertas(true);
  });

  function comprime(arquivo) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      var url = URL.createObjectURL(arquivo);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var tentativas = [[1280, 0.7], [1024, 0.6], [800, 0.5]];
        (function tenta(i) {
          var maior = Math.max(img.width, img.height);
          var fator = Math.min(1, tentativas[i][0] / maior);
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * fator);
          c.height = Math.round(img.height * fator);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) {
            if (!b) { erro(new Error("Não foi possível processar a foto.")); return; }
            if (b.size <= 1000000 || i === tentativas.length - 1) ok(b); else tenta(i + 1);
          }, "image/jpeg", tentativas[i][1]);
        })(0);
      };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error("Não foi possível abrir a foto.")); };
      img.src = url;
    });
  }

  function atualizaAviso() {
    $("#f-aviso").textContent = window.vaUser ? "" : "Para cadastrar uma oferta, entre na sua conta na aba Perfil.";
  }

  $("#form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("#f-msg");
    var botao = $("#f-enviar");
    var user = window.vaUser;
    if (!user) { msg.textContent = "Entre na sua conta (aba Perfil) para cadastrar."; return; }
    var uid = $("#f-unidade").value;
    var nome = $("#f-nome").value.trim();
    var marca = $("#f-marca").value.trim();
    var por = Number($("#f-por").value);
    var de = $("#f-de").value === "" ? null : Number($("#f-de").value);
    var val = $("#f-val").value;
    var ids = ["f-p1", "f-p2", "f-p3", "f-p4"];
    var tipos = ["prateleira", "produto", "etiqueta", "validade"];
    var arqs = ids.map(function (i) { return $("#" + i).files[0]; });

    if (!uid) { msg.textContent = "Escolha a unidade."; return; }
    if (nome.length < 2 || nome.length > 80) { msg.textContent = "O nome do produto precisa ter de 2 a 80 letras."; return; }
    if (!(por > 0)) { msg.textContent = "Informe o preço promocional."; return; }
    if (de !== null && !(de >= por)) { msg.textContent = "O preço original não pode ser menor que o promocional."; return; }
    if (!val || val < hojeISO()) { msg.textContent = "A validade precisa ser hoje ou uma data futura."; return; }
    if (arqs.some(function (a) { return !a; })) { msg.textContent = "Tire ou escolha as 4 fotos."; return; }

    botao.disabled = true;
    try {
      var stamp = Date.now();
      var caminhos = [];
      for (var i = 0; i < 4; i++) {
        msg.textContent = "Enviando foto " + (i + 1) + " de 4...";
        var blob = await comprime(arqs[i]);
        var caminho = user.id + "/" + stamp + "-" + tipos[i] + ".jpg";
        var up = await db.storage.from(BUCKET).upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw up.error;
        caminhos.push(caminho);
      }
      msg.textContent = "Salvando oferta...";
      var ins = await db.from("ofertas").insert({
        unidade_id: uid,
        nome: nome,
        marca: marca || null,
        categoria: $("#f-cat").value,
        preco_original: de,
        preco_promocional: por,
        validade: val,
        foto_prateleira: caminhos[0],
        foto_produto: caminhos[1],
        foto_etiqueta: caminhos[2],
        foto_validade: caminhos[3]
      });
      if (ins.error) throw ins.error;
      $("#form").reset();
      $("#f-unidade").value = uid;
      msg.textContent = "Oferta cadastrada! Obrigado por ajudar a comunidade.";
      $("#unidade").value = uid;
      await carregaOfertas();
      document.querySelector('nav button[data-v="ofertas"]').click();
    } catch (err) {
      msg.textContent = "Não foi possível enviar (" + (err && err.message ? err.message : "erro desconhecido") + ").";
    } finally {
      botao.disabled = false;
    }
  });

  var filtros = [["recentes", "Mais recentes"], ["vencem", "Vencem em breve"], ["preco", "Menor preço"]];
  $("#chips").innerHTML = filtros.map(function (f) {
    return '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (f[0] === filtro) + '">' + f[1] + "</button>";
  }).join("");
  $("#chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]");
    if (!b) return;
    filtro = b.dataset.f;
    document.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b); });
    mostra();
  });
  $("#busca").addEventListener("input", mostra);
  $("#unidade").addEventListener("change", function () { carregaOfertas(); });
  document.addEventListener("va-auth", function () { atualizaAviso(); mostra(); });
  atualizaAviso();

  (async function () {
    await carregaUnidades();
    await carregaOfertas();
  })();
})();
