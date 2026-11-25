
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* CONFIGURAÇÃO FIREBASE ORIGINAL */
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
const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

const $ = (id) => document.getElementById(id);

const loginScreen = $("login");
const cadastroScreen = $("cadastro");
const painel = $("painel");
const workspace = $("workspace");

let usuarioAtual = null;
let processamentoAtual = 0;
let analiseAtual = null;

function showScreen(screen) {
  loginScreen.hidden = screen !== "login";
  cadastroScreen.hidden = screen !== "cadastro";
  painel.hidden = screen !== "painel";
}

/* LOGIN E CADASTRO */

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
  usuarioAtual = user;
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

  return mensagens[error.code] ||
    "Não foi possível concluir. Verifique a conexão e tente novamente.";
}

/* NOMES E FORMATOS DOS MÓDULOS */

const textosModulo = {
  Tigre: "ANÁLISE DO MÓDULO TIGRE",
  Touro: "ANÁLISE DO MÓDULO TOURO",
  Midas: "ANÁLISE DO MÓDULO MIDAS",
  Aviator: "ANÁLISE DO MÓDULO AVIATOR"
};

/* ABRIR MÓDULO */

function abrirModulo(nome) {
  processamentoAtual++;
  analiseAtual = null;

  if (!textosModulo[nome]) return;

  const aviator = nome === "Aviator";

  workspace.innerHTML = `
    <div class="module-head">
      <h3>${nome.toUpperCase()}</h3>
      <span class="module-badge">IA CONECTADA AO MÓDULO</span>
    </div>

    <div class="terminal-window" aria-live="polite">
      <div class="terminal-line current" id="terminal1">
        MÓDULO ${nome.toUpperCase()} INICIALIZADO
      </div>
      <div class="terminal-line" id="terminal2">
        AGUARDANDO SOLICITAÇÃO DE ANÁLISE
      </div>
      <div class="terminal-line" id="terminal3">
        SISTEMA PRONTO
      </div>
    </div>

    <section class="generated-combination" id="generatedCombination" hidden>
      <div class="combination-heading">
        <div>
          <span class="combination-kicker">INTELIGÊNCIA ARTIFICIAL</span>
          <h4>Análise do ${nome}</h4>
        </div>
        <span class="combination-state">ANÁLISE</span>
      </div>

      <div id="aiAnalysis" class="ai-analysis"></div>

      <p class="combination-footnote">
        ${aviator
          ? "Formato exclusivo Aviator: multiplicadores. Não utiliza o formato dos jogos PG."
          : "Análise no formato do módulo PG selecionado."}
      </p>

      <div class="feedback-area" id="feedbackArea" hidden>
        <p>Como foi o resultado dessa análise?</p>
        <div class="feedback-buttons">
          <button type="button" class="feedback-success" id="feedbackSuccess">
            ✓ DEU CERTO
          </button>
          <button type="button" class="feedback-failure" id="feedbackFailure">
            ✕ NÃO DEU CERTO
          </button>
        </div>
        <p class="feedback-status" id="feedbackStatus"></p>
      </div>
    </section>

    <div class="module-actions">
      <button class="run-button" id="btnProcessar" type="button">
        SOLICITAR ANÁLISE DA IA
      </button>

      <p class="module-status" id="moduleStatus">
        Módulo selecionado. Aguardando solicitação.
      </p>
    </div>
  `;

  $("btnProcessar").addEventListener("click", () => {
    processarModulo(nome);
  });

  $("feedbackSuccess").addEventListener("click", () => {
    registrarFeedback(nome, "Deu certo");
  });

  $("feedbackFailure").addEventListener("click", () => {
    registrarFeedback(nome, "Não deu certo");
  });
}

/* BUSCAR FEEDBACK ANTERIOR DO MESMO JOGO */

async function carregarFeedback(nome) {
  if (!usuarioAtual) {
    throw new Error("Faça login novamente para continuar.");
  }

  const referencia = collection(
    db,
    "users",
    usuarioAtual.uid,
    "gameFeedback"
  );

  const consulta = query(
    referencia,
    where("game", "==", nome),
    limit(20)
  );

  const resultado = await getDocs(consulta);

  const historico = resultado.docs.map((documento) => {
    const dados = documento.data();

    return {
      outcome: dados.outcome,
      createdAt: dados.createdAt || 0
    };
  });

  historico.sort((a, b) => b.createdAt - a.createdAt);

  return historico;
}

/* CHAMADA SEGURA À API DA OPENROUTER PELO SERVIDOR */

async function consultarIA(nome, feedback) {
  if (!usuarioAtual) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  const token = await usuarioAtual.getIdToken();

  const resposta = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      jogo: nome,
      feedback: feedback
    })
  });

  let dados;

  try {
    dados = await resposta.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!resposta.ok) {
    throw new Error(
      dados.error || "Não foi possível consultar a inteligência artificial."
    );
  }

  if (!dados.analise) {
    throw new Error("A IA não retornou uma análise.");
  }

  return dados.analise;
}

/* PROCESSAMENTO DA IA */

async function processarModulo(nome) {
  const button = $("btnProcessar");
  const status = $("moduleStatus");

  if (!button || button.disabled) return;

  const meuProcessamento = ++processamentoAtual;

  button.disabled = true;
  button.textContent = "CONSULTANDO IA...";

  $("generatedCombination").hidden = true;
  $("feedbackArea").hidden = true;
  $("aiAnalysis").textContent = "";

  $("feedbackStatus").textContent = "";

  const passos = [
    `INICIALIZANDO MÓDULO ${nome.toUpperCase()}...`,
    "CARREGANDO HISTÓRICO DE FEEDBACK...",
    "SOLICITANDO ANÁLISE À INTELIGÊNCIA ARTIFICIAL..."
  ];

  const ids = ["terminal1", "terminal2", "terminal3"];

  status.textContent = "Preparando análise...";

  ids.forEach((id) => {
    $(id).textContent = "AGUARDANDO...";
  });

  try {
    for (let i = 0; i < passos.length; i++) {
      if (meuProcessamento !== processamentoAtual) return;

      $(ids[i]).textContent = passos[i];

      status.textContent = passos[i];

      await new Promise((resolve) => window.setTimeout(resolve, 450));
    }

    const feedback = await carregarFeedback(nome);

    if (meuProcessamento !== processamentoAtual) return;

    const analise = await consultarIA(nome, feedback);

    if (meuProcessamento !== processamentoAtual) return;

    analiseAtual = {
      jogo: nome,
      analise
    };

    $("aiAnalysis").textContent = analise;
    $("generatedCombination").hidden = false;
    $("feedbackArea").hidden = false;

    $("terminal3").textContent = "ANÁLISE RECEBIDA DO SERVIDOR";

    status.textContent =
      `Análise do ${nome} recebida. Você pode avaliar o resultado.`;

    button.textContent = "GERAR NOVA ANÁLISE";

  } catch (error) {
    if (meuProcessamento !== processamentoAtual) return;

    console.error("Erro na análise:", error);

    status.textContent = error.message ||
      "Não foi possível concluir a análise.";

    $("terminal3").textContent = "ERRO NA CONSULTA DA IA";

    button.textContent = "TENTAR NOVAMENTE";

  } finally {
    if (meuProcessamento === processamentoAtual && button.isConnected) {
      button.disabled = false;
    }
  }
}

/* SALVAR FEEDBACK DO USUÁRIO NO FIRESTORE */

async function registrarFeedback(nome, resultado) {
  const sucesso = $("feedbackSuccess");
  const falha = $("feedbackFailure");
  const status = $("feedbackStatus");

  if (!usuarioAtual || !analiseAtual || analiseAtual.jogo !== nome) {
    status.textContent = "Solicite uma análise antes de avaliar.";
    return;
  }

  sucesso.disabled = true;
  falha.disabled = true;

  status.textContent = "Salvando seu feedback...";

  try {
    const referencia = collection(
      db,
      "users",
      usuarioAtual.uid,
      "gameFeedback"
    );

    await addDoc(referencia, {
      game: nome,
      outcome: resultado,
      createdAt: Date.now()
    });

    status.textContent =
      `Feedback "${resultado}" salvo para o módulo ${nome}.`;

  } catch (error) {
    console.error("Erro ao salvar feedback:", error);

    status.textContent =
      "Não foi possível salvar. Verifique as regras do Firestore e tente novamente.";

    sucesso.disabled = false;
    falha.disabled = false;
  }
}

/* EVENTOS DOS QUATRO MÓDULOS */

document.querySelectorAll("[data-game]").forEach((button) => {
  button.addEventListener("click", () => {
    abrirModulo(button.dataset.game);
  });
});

/* ESTILOS DOS RESULTADOS E DO FEEDBACK */

if (!document.getElementById("jnCombinationStyles")) {
  const style = document.createElement("style");

  style.id = "jnCombinationStyles";

  style.textContent = `
    .generated-combination {
      margin-top: 18px;
      padding: 17px;
      border: 1px solid rgba(214,179,75,.24);
      border-radius: 12px;
      background: linear-gradient(145deg,rgba(18,28,20,.98),rgba(7,12,9,.98));
      animation: jnReveal .35s ease both;
    }

    .generated-combination[hidden] {
      display: none !important;
    }

    .combination-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }

    .combination-kicker {
      color: #8d9990;
      font-size: 9px;
      letter-spacing: 1.8px;
    }

    .combination-heading h4 {
      margin-top: 5px;
      color: #f0f2ed;
      font-size: 16px;
      font-weight: 700;
    }

    .combination-state {
      padding: 6px 9px;
      border: 1px solid rgba(53,217,130,.3);
      border-radius: 30px;
      color: #35d982;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
      white-space: nowrap;
    }

    .ai-analysis {
      padding: 14px;
      border: 1px solid rgba(214,179,75,.2);
      border-radius: 9px;
      background: rgba(0,0,0,.2);
      color: #e5eae5;
      font-size: 13px;
      line-height: 1.7;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .combination-footnote {
      margin-top: 12px;
      color: #9aa49b;
      font-size: 10px;
      line-height: 1.6;
    }

    .feedback-area {
      margin-top: 17px;
      padding-top: 14px;
      border-top: 1px solid rgba(214,179,75,.17);
    }

    .feedback-area > p:first-child {
      margin-bottom: 10px;
      color: #e5eae5;
      font-size: 12px;
      font-weight: 700;
    }

    .feedback-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }

    .feedback-buttons button {
      min-height: 42px;
      padding: 9px 7px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
    }

    .feedback-success {
      border: 1px solid rgba(53,217,130,.4);
      background: rgba(53,217,130,.1);
      color: #55e49a;
    }

    .feedback-failure {
      border: 1px solid rgba(255,100,100,.35);
      background: rgba(255,100,100,.08);
      color: #ff9292;
    }

    .feedback-buttons button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .feedback-status {
      margin-top: 10px;
      color: #aab5aa;
      font-size: 10px;
      line-height: 1.5;
    }

    @keyframes jnReveal {
      from {
        opacity: 0;
        transform: translateY(7px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media(max-width:360px) {
      .feedback-buttons {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

console.log("JN 01 VIP: sistema e módulos carregados.");
