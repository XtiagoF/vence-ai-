// EDITE SOMENTE AS DUAS LINHAS ABAIXO (mantenha as aspas)
const LEGAL_NOME = "Tiago Ferreira de Assunção";
const LEGAL_EMAIL = "tiagofassuncao14@gmail.com";

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-legal="nome"]').forEach(function (e) { e.textContent = LEGAL_NOME; });
  document.querySelectorAll('[data-legal="email"]').forEach(function (e) {
    e.textContent = LEGAL_EMAIL;
    e.href = "mailto:" + LEGAL_EMAIL;
  });
});
