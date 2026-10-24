(function () {
  var caixa = document.getElementById("auth-box");
  if (!caixa) return;
  if (!window.supabase || typeof SUPABASE_URL === "undefined") {
    caixa.innerHTML = '<p class="small">Não foi possível carregar o login. Confira config.js, auth.js e as linhas de script no index.html.</p>';
    return;
  }
  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE);
  window.vaDb = db;
  var atual = "inicio";
  var recuperando = false;

  function traduz(m) {
    m = (m || "").toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (m.includes("already registered")) return "Este e-mail já tem conta. Toque em Entrar.";
    if (m.includes("not authorized")) return "Ainda não é possível enviar e-mails para este endereço (fase de testes).";
    if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds")) return "Muitas tentativas. Espere alguns minutos.";
    if (m.includes("duplicate") || m.includes("unique")) return "Esse apelido já está em uso.";
    if (m.includes("check constraint") || m.includes("violates check")) return "O apelido precisa ter de 3 a 30 caracteres.";
    if (m.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
    if (m.includes("password")) return "Senha inválida. Use pelo menos 8 caracteres.";
    return "Algo deu errado. Tente de novo.";
  }

  function mostraEntrada() {
    caixa.innerHTML =
      '<div class="card"><strong>Entrar ou criar conta</strong>' +
      '<label for="a-email">E-mail</label><input id="a-email" type="email" autocomplete="email">' +
      '<label for="a-senha">Senha (mínimo 8 caracteres)</label><input id="a-senha" type="password" autocomplete="current-password">' +
      '<p class="small" id="a-msg" role="status"></p>' +
      '<div class="actions"><button class="btn main" id="a-entrar">Entrar</button>' +
      '<button class="btn" id="a-criar">Criar conta</button></div>' +
      '<div class="actions"><button class="btn" id="a-esqueci" type="button" style="border-color:transparent;padding-left:0">Esqueci minha senha</button></div></div>';
    var msg = document.getElementById("a-msg");
    function campos() {
      return {
        email: document.getElementById("a-email").value.trim(),
        senha: document.getElementById("a-senha").value
      };
    }
    document.getElementById("a-entrar").onclick = async function () {
      var c = campos();
      if (!c.email || !c.senha) { msg.textContent = "Preencha e-mail e senha."; return; }
      msg.textContent = "Entrando...";
      var r = await db.auth.signInWithPassword({ email: c.email, password: c.senha });
      if (r.error) msg.textContent = traduz(r.error.message);
    };
    document.getElementById("a-criar").onclick = async function () {
      var c = campos();
      if (!c.email) { msg.textContent = "Preencha o e-mail."; return; }
      if (c.senha.length < 8) { msg.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
      msg.textContent = "Criando conta...";
      var r = await db.auth.signUp({
        email: c.email,
        password: c.senha,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (r.error) { msg.textContent = traduz(r.error.message); return; }
      if (!r.data.session) msg.textContent = "Quase lá! Enviamos um e-mail para confirmar sua conta.";
    };
    document.getElementById("a-esqueci").onclick = async function () {
      var c = campos();
      if (!c.email) { msg.textContent = "Digite seu e-mail acima e toque em Esqueci minha senha."; return; }
      msg.textContent = "Enviando...";
      var r = await db.auth.resetPasswordForEmail(c.email, { redirectTo: location.origin + location.pathname });
      msg.textContent = r.error
        ? traduz(r.error.message)
        : "Se esse e-mail tiver conta, enviamos um link para criar uma nova senha. Confira também o spam.";
    };
  }

  function mostraNovaSenha() {
    caixa.innerHTML =
      '<div class="card"><strong>Criar nova senha</strong>' +
      '<label for="n-senha">Nova senha (mínimo 8 caracteres)</label><input id="n-senha" type="password" autocomplete="new-password">' +
      '<label for="n-senha2">Repita a nova senha</label><input id="n-senha2" type="password" autocomplete="new-password">' +
      '<p class="small" id="a-msg" role="status"></p>' +
      '<div class="actions"><button class="btn main" id="n-salvar">Salvar nova senha</button></div></div>';
    var msg = document.getElementById("a-msg");
    document.getElementById("n-salvar").onclick = async function () {
      var s1 = document.getElementById("n-senha").value;
      var s2 = document.getElementById("n-senha2").value;
      if (s1.length < 8) { msg.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
      if (s1 !== s2) { msg.textContent = "As senhas não são iguais."; return; }
      msg.textContent = "Salvando...";
      var r = await db.auth.updateUser({ password: s1 });
      if (r.error) { msg.textContent = traduz(r.error.message); return; }
      recuperando = false;
      var s = await db.auth.getSession();
      atual = "inicio";
      desenha(s.data.session);
    };
  }

  async function mostraPerfil(user) {
    var r = await db.from("perfis").select("apelido,nivel,pontos,reputacao").eq("id", user.id).single();
    if (r.error || !r.data) {
      caixa.innerHTML = '<div class="card"><p>Não conseguimos carregar seu perfil.</p><div class="actions"><button class="btn" id="a-sair">Sair</button></div></div>';
      document.getElementById("a-sair").onclick = function () { db.auth.signOut(); };
      return;
    }
    var p = r.data;
    caixa.innerHTML =
      '<div class="card"><p class="small" style="margin:0">Seu perfil (dados reais)</p>' +
      '<p class="bignum" id="p-nivel"></p><p class="small" id="p-info"></p>' +
      '<label for="p-apelido">Apelido público</label><input id="p-apelido" maxlength="30">' +
      '<p class="small" id="a-msg" role="status"></p>' +
      '<div class="actions"><button class="btn main" id="p-salvar">Salvar apelido</button>' +
      '<button class="btn" id="a-sair">Sair</button></div></div>';
    document.getElementById("p-nivel").textContent = p.nivel;
    document.getElementById("p-info").textContent = "Pontos: " + p.pontos + " · Reputação: " + p.reputacao + "/100";
    document.getElementById("p-apelido").value = p.apelido;
    var msg = document.getElementById("a-msg");
    document.getElementById("p-salvar").onclick = async function () {
      var novo = document.getElementById("p-apelido").value.trim();
      msg.textContent = "Salvando...";
      var u = await db.from("perfis").update({ apelido: novo }).eq("id", user.id);
      msg.textContent = u.error ? traduz(u.error.message) : "Apelido salvo!";
    };
    document.getElementById("a-sair").onclick = function () { db.auth.signOut(); };
  }

  function desenha(sessao) {
    var id = sessao && sessao.user ? sessao.user.id : null;
    if (id === atual) return;
    atual = id;
    window.vaUser = id ? sessao.user : null;
    document.dispatchEvent(new Event("va-auth"));
    if (recuperando && id) return;
    if (id) mostraPerfil(sessao.user); else mostraEntrada();
  }

  db.auth.getSession().then(function (r) { desenha(r.data.session); });
  db.auth.onAuthStateChange(function (evento, sessao) {
    if (evento === "PASSWORD_RECOVERY") {
      recuperando = true;
      setTimeout(function () {
        mostraNovaSenha();
        var aba = document.querySelector('nav button[data-v="perfil"]');
        if (aba) aba.click();
      }, 0);
      return;
    }
    if (evento === "SIGNED_OUT") recuperando = false;
    if (evento === "SIGNED_IN" || evento === "SIGNED_OUT") {
      setTimeout(function () { desenha(sessao); }, 0);
    }
  });
})();
