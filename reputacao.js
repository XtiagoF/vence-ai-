(function () {
  var db = window.vaDb;
  var auth = document.getElementById("auth-box");
  if (!db || !auth) return;

  // remove o cartao antigo "entram nas proximas fases"
  var velho = document.querySelector("#v-perfil > .card");
  if (velho) velho.remove();

  var caixa = document.createElement("div");
  caixa.id = "rep-box";
  auth.parentNode.insertBefore(caixa, auth.nextSibling);

  function barra(valor, max) {
    var pct = Math.max(0, Math.min(100, Math.round((valor / max) * 100)));
    return '<div style="height:10px;border-radius:6px;background:var(--line);overflow:hidden;margin-top:8px">' +
      '<div style="height:100%;width:' + pct + '%;background:var(--primary)"></div></div>';
  }

  function proximo(d) {
    if (d.nivel === "Colaborador confiável") return "Você está no nível mais alto. Continue ajudando a comunidade!";
    var iniciante = d.nivel === "Iniciante";
    var metaP = iniciante ? 20 : 100;
    var metaR = iniciante ? 20 : 60;
    var alvo = iniciante ? "Colaborador" : "Colaborador confiável";
    var faltaP = Math.max(0, metaP - d.pontos);
    var faltaR = Math.max(0, metaR - d.reputacao);
    if (!faltaP && !faltaR) return "Seu próximo nível (" + alvo + ") será liberado na próxima ação.";
    return "Para virar " + alvo + ": " +
      (faltaP ? "faltam " + faltaP + " pontos" : "pontos ok") + " e " +
      (faltaR ? "faltam " + faltaR + " de reputação" : "reputação ok") + ".";
  }

  function distintivo(emoji, nome, ativo) {
    return '<span style="display:inline-block;background:var(--soft);padding:8px 12px;border-radius:12px;margin:6px 6px 0 0;font-size:15px;' +
      (ativo ? "" : "opacity:.45") + '">' + emoji + " " + nome + "</span>";
  }

  function render(d) {
    caixa.innerHTML =
      '<div class="card"><strong>Reputação</strong>' +
      '<p class="bignum">' + d.reputacao + ' <span class="small">/ 100</span></p>' +
      barra(d.reputacao, 100) +
      '<p class="small">' + proximo(d) + '</p></div>' +
      '<div class="card"><strong>Distintivos</strong><br>' +
      distintivo("🌱", "Primeira oferta", d.ofertas >= 1) +
      distintivo("✅", "Oferta confirmada", d.ofertas_confirmadas >= 1) +
      distintivo("🤝", "Ajudante (5 ações)", d.acoes >= 5) +
      distintivo("⭐", "Reputação 60+", d.reputacao >= 60) + '</div>' +
      '<div class="card"><p class="small" style="margin:0">Como funciona: sua reputação sobe quando outras pessoas (com conta de mais de 3 dias) confirmam suas ofertas, quando você participa e com o tempo de conta. Ofertas removidas pela moderação reduzem a reputação.</p></div>';
  }

  async function carrega() {
    if (!window.vaUser) { caixa.innerHTML = ""; return; }
    var r = await db.rpc("meu_resumo");
    if (r.error || !r.data) {
      caixa.innerHTML = '<p class="small">Não foi possível carregar sua reputação agora.</p>';
      return;
    }
    render(r.data);
  }

  document.addEventListener("va-auth", carrega);
  var abaPerfil = document.querySelector('nav button[data-v="perfil"]');
  if (abaPerfil) abaPerfil.addEventListener("click", carrega);
  carrega();
})();
