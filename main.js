import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* Configuração Firebase original do projeto */
const firebaseConfig = {
  apiKey: "AIzaSyCuPyJWr0aDNQ7vUiQ2JxzqNpBxZXozoQg",
  authDomain: "painel-anac-gb.firebaseapp.com",
  projectId: "painel-anac-gb",
  storageBucket: "painel-anac-gb.appspot.com",
  messagingSenderId: "941890806312",
  appId: "1:941890806312:web:323f01daf1f9ddcf1a0b1d",
  measurementId: "G-HG4KDJBP3G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

const $ = (id) => document.getElementById(id);
const loginScreen = $("login");
const cadastroScreen = $("cadastro");
const painel = $("painel");
const workspace = $("workspace");

function showScreen(screen) {
  loginScreen.hidden = screen !== "login";
  cadastroScreen.hidden = screen !== "cadastro";
  painel.hidden = screen !== "painel";
}

$("linkCadastro").addEventListener("click", (event) => {
  event.preventDefault();
  $("erroCadastro").textContent = "";
  showScreen("cadastro");
});
$("linkLogin").addEventListener("click", (event) => {
  event.preventDefault();
  $("erroLogin").textContent = "";
  showScreen("login");
});

$("formLogin").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("erroLogin").textContent = "";
  const email = $("emailLogin").value.trim();
  const senha = $("senhaLogin").value;
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (error) {
    $("erroLogin").textContent = traduzirErro(error);
  }
});

$("formCadastro").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("erroCadastro").textContent = "";
  const email = $("emailCadastro").value.trim();
  const senha = $("senhaCadastro").value;
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    showScreen("painel");
  } catch (error) {
    $("erroCadastro").textContent = traduzirErro(error);
  }
});

$("btnSair").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    alert("Não foi possível sair: " + traduzirErro(error));
  }
});

onAuthStateChanged(auth, (user) => {
  showScreen(user ? "painel" : "login");
});

function traduzirErro(error) {
  const mensagens = {
    "auth/invalid-email": "O e-mail informado não é válido.",
    "auth/user-not-found": "Conta não encontrada.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já possui cadastro.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente."
  };
  return mensagens[error.code] || "Não foi possível concluir. Verifique a conexão e tente novamente.";
}

/*
 * Os módulos abaixo são apenas controles de interface.
 * Não consultam o jogo, não acessam contas externas e não produzem previsões.
 */
const textosModulo = {
  Tigre: [
    "MÓDULO TIGRE CARREGADO",
    "INTERFACE E COMPONENTES VERIFICADOS",
    "FONTE DE DADOS EXTERNA NÃO CONFIGURADA"
  ],
  Touro: [
    "MÓDULO TOURO CARREGADO",
    "INTERFACE E COMPONENTES VERIFICADOS",
    "FONTE DE DADOS EXTERNA NÃO CONFIGURADA"
  ]
};

function abrirModulo(nome) {
  const linhas = textosModulo[nome];
  if (!linhas) return;

  workspace.innerHTML = `
    <div class="module-head">
      <h3>${nome.toUpperCase()}</h3>
      <span class="module-badge">MÓDULO DISPONÍVEL</span>
    </div>
    <div class="terminal-window" aria-live="polite">
      <div class="terminal-line current" id="terminal1">INICIALIZANDO ${nome.toUpperCase()}...</div>
      <div class="terminal-line" id="terminal2">AGUARDANDO COMANDO</div>
      <div class="terminal-line" id="terminal3">INTERFACE PRONTA</div>
    </div>
    <div class="module-actions">
      <button class="run-button" id="btnProcessar" type="button">INICIAR PROCESSAMENTO</button>
      <p class="module-status" id="moduleStatus">Módulo selecionado. Aguardando ação.</p>
    </div>
  `;

  $("btnProcessar").addEventListener("click", () => processarModulo(nome));
}

function processarModulo(nome) {
  const button = $("btnProcessar");
  const status = $("moduleStatus");
  if (!button || button.disabled) return;

  button.disabled = true;
  button.textContent = "ANALISANDO...";
  status.textContent = "Executando verificação do módulo...";

  const ids = ["terminal1", "terminal2", "terminal3"];
  const passos = [
    `INICIALIZANDO MÓDULO ${nome.toUpperCase()}`,
    "VERIFICANDO E LOCALIZANDO COMPONENTES LOCAIS...",
    `ENCONTRADOS: MÓDULO ${nome.toUpperCase()} E INTERFACE PRONTOS`
  ];

  let etapa = 0;
  ids.forEach((id) => { if ($(id)) $(id).textContent = "AGUARDANDO..."; });

  const avancar = () => {
    if (etapa < passos.length) {
      const alvo = $(ids[etapa]);
      if (alvo) alvo.textContent = passos[etapa];
      status.textContent = etapa < 2
        ? "Análise em andamento..."
        : "Verificação concluída com sucesso.";
      etapa += 1;
      window.setTimeout(avancar, 650);
      return;
    }
    const detalhe = $("terminal3");
    if (detalhe) detalhe.textContent = "FONTE DE DADOS DO JOGO NÃO CONECTADA — SEM SINAL DISPONÍVEL";
    status.textContent = "Módulo localizado e verificado. Nenhum sinal externo foi recebido.";
    button.disabled = false;
    button.textContent = "GERAR NOVAMENTE";
  };
  avancar();
}

document.querySelectorAll("[data-game]").forEach((button) => {
  button.addEventListener("click", () => abrirModulo(button.dataset.game));
});

console.log("JN 01 VIP: interface carregada.");
