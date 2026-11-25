import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let processamentoAtual = 0;
let resultadoAtual = null;
let jogoAtual = null;

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
  try {
    await signInWithEmailAndPassword(auth, $("emailLogin").value.trim(), $("senhaLogin").value);
  } catch (error) {
    $("erroLogin").textContent = traduzirErro(error);
  }
});

$("formCadastro").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("erroCadastro").textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, $("emailCadastro").value.trim(), $("senhaCadastro").value);
    showScreen("painel");
  } catch (error) {
    $("erroCadastro").textContent = traduzirErro(error);
  }
});

$("btnSair").addEventListener("click", async () => {
  try { await signOut(auth); }
  catch (error) { alert("Não foi possível sair: " + traduzirErro(error)); }
});

onAuthStateChanged(auth, (user) => showScreen(user ? "painel" : "login"));

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

function escaparHTML(valor) {
  return String(valor).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

async function carregarFeedback(jogo) {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const ref = collection(db, "users", user.uid, "gameFeedback");
    const consulta = query(ref, where("game", "==", jogo), limit(20));
    const snapshot = await getDocs(consulta);
    return snapshot.docs.map((doc) => doc.data()).reverse();
  } catch (error) {
    console.error("Não foi possível carregar o histórico de feedback:", error);
    return [];
  }
}

async function consultarIA(jogo, feedback) {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login novamente para continuar.");
  const token = await user.getIdToken();
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ jogo, feedback })
  });
  const dados = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(dados.error || "Não foi possível consultar a IA.");
  return dados;
}

function abrirModulo(nome) {
  processamentoAtual++;
  jogoAtual = nome;
  resultadoAtual = null;
  workspace.innerHTML = `
    <div class="module-head">
      <h3>${escaparHTML(nome.toUpperCase())}</h3>
      <span class="module-badge">MÓDULO DISPONÍVEL</span>
    </div>
    <div class="terminal-window" aria-live="polite">
      <div class="terminal-line current" id="terminal1">INICIALIZANDO ${escaparHTML(nome.toUpperCase())}...</div>
      <div class="terminal-line" id="terminal2">AGUARDANDO COMANDO</div>
      <div class="terminal-line" id="terminal3">INTERFACE PRONTA</div>
    </div>
    <section class="generated-combination" id="generatedCombination" hidden aria-live="polite">
      <div class="combination-heading">
        <div><span class="combination-kicker">PAINEL DE RESULTADOS</span><h4>Combinação gerada</h4></div>
        <span class="combination-state">CONCLUÍDO</span>
      </div>
      <div class="combination-grid ${nome === "Midas" ? "midas-grid" : ""}" id="combinationGrid"></div>
      <p class="combination-footnote">Sugestão gerada pela IA.</p>
    </section>
    <section class="aviator-result" id="aviatorResult" hidden aria-live="polite">
      <span class="combination-kicker">ALVO GERADO</span>
      <div class="aviator-multiplier" id="aviatorMultiplier"></div>
      <p class="aviator-attempt-note"><strong>Limite de tentativas</strong><br>Você pode fazer até 3 tentativas com este alvo. Se não atingir, encerre e aguarde uma nova análise.</p>
    </section>
    <div class="feedback-area" id="feedbackArea" hidden>
      <p>Como foi esse resultado?</p>
      <div class="feedback-buttons">
        <button type="button" class="feedback-button success" data-feedback="Deu certo">DEU CERTO</button>
        <button type="button" class="feedback-button failure" data-feedback="Não deu certo">NÃO DEU CERTO</button>
      </div>
      <p class="feedback-status" id="feedbackStatus" aria-live="polite"></p>
    </div>
    <div class="module-actions">
      <button class="run-button" id="btnProcessar" type="button">GERAR COM IA</button>
      <p class="module-status" id="moduleStatus">Módulo selecionado. Aguardando ação.</p>
    </div>
  `;
  $("btnProcessar").addEventListener("click", () => processarModulo(nome));
  workspace.querySelectorAll("[data-feedback]").forEach((button) => {
    button.addEventListener("click", () => registrarFeedback(button.dataset.feedback));
  });
}

function renderizarPG(jogo, dados) {
  const esperado = jogo === "Midas" ? 2 : 3;
  if (!Array.isArray(dados.itens) || dados.itens.length !== esperado) {
    throw new Error("A IA retornou uma combinação em formato inválido. Tente novamente.");
  }
  const itens = dados.itens;
  const tiposEsperados = jogo === "Midas" ? ["TURBO", "NORMAL"] : ["TURBO", "NORMAL", "TURBO"];
  itens.forEach((item, i) => {
    if (item.tipo !== tiposEsperados[i] || !Number.isInteger(item.valor)) {
      throw new Error("A IA retornou valores inválidos. Tente gerar novamente.");
    }
    const min = item.tipo === "TURBO" ? 2 : 5;
    const max = item.tipo === "TURBO" ? 5 : 12;
    if (item.valor < min || item.valor > max) throw new Error("Valor fora do formato permitido. Tente novamente.");
  });
  $("combinationGrid").innerHTML = itens.map((item, index) => `
    <article class="combination-item ${item.tipo.toLowerCase()}">
      <span class="combination-index">0${index + 1}</span>
      <div class="combination-value">${item.tipo === "NORMAL" ? `${item.valor} vezes` : `${item.valor}×`}</div>
      <div class="combination-label">${item.tipo}</div>
      <div class="combination-detail">PARÂMETRO 0${index + 1}</div>
    </article>
  `).join("");
  $("generatedCombination").hidden = false;
  resultadoAtual = itens.map((item) => `${item.tipo}: ${item.valor}`).join(" | ");
}

async function processarModulo(nome) {
  const button = $("btnProcessar");
  const status = $("moduleStatus");
  if (!button || button.disabled) return;
  const meuProcessamento = ++processamentoAtual;
  button.disabled = true;
  button.textContent = "PROCESSANDO...";
  status.textContent = `Consultando a IA para ${nome}...`;
  ["terminal1", "terminal2", "terminal3"].forEach((id) => { if ($(id)) $(id).textContent = "PROCESSANDO..."; });
  $("generatedCombination").hidden = true;
  $("aviatorResult").hidden = true;
  $("feedbackArea").hidden = true;
  resultadoAtual = null;

  try {
    const feedback = await carregarFeedback(nome);
    const dados = await consultarIA(nome, feedback);
    if (meuProcessamento !== processamentoAtual) return;

    if (nome === "Aviator") {
      const numero = Number(String(dados.multiplicador || "").replace("x", "").replace(",", "."));
      if (!Number.isFinite(numero) || numero < 1.7 || numero > 10) throw new Error("A IA retornou um multiplicador inválido. Tente novamente.");
      const formatado = `${numero.toFixed(2)}x`;
      $("aviatorMultiplier").textContent = formatado;
      $("aviatorResult").hidden = false;
      resultadoAtual = formatado;
    } else {
      renderizarPG(nome, dados);
    }

    ["terminal1", "terminal2", "terminal3"].forEach((id, index) => {
      const linhas = ["SOLICITAÇÃO ENVIADA À IA", "RESPOSTA RECEBIDA", "RESULTADO EXIBIDO"];
      if ($(id)) $(id).textContent = linhas[index];
    });
    $("feedbackArea").hidden = false;
    status.textContent = "Geração concluída.";
    button.textContent = "GERAR NOVAMENTE";
  } catch (error) {
    if (meuProcessamento !== processamentoAtual) return;
    status.textContent = error.message || "Ocorreu um erro ao gerar.";
    $("terminal3").textContent = "NÃO FOI POSSÍVEL CONCLUIR";
    button.textContent = "TENTAR NOVAMENTE";
  } finally {
    if (meuProcessamento === processamentoAtual && button.isConnected) button.disabled = false;
  }
}

async function registrarFeedback(outcome) {
  const user = auth.currentUser;
  const status = $("feedbackStatus");
  if (!user || !jogoAtual || !resultadoAtual || !status) return;
  const buttons = workspace.querySelectorAll("[data-feedback]");
  buttons.forEach((button) => { button.disabled = true; });
  status.textContent = "Salvando feedback...";
  try {
    await addDoc(collection(db, "users", user.uid, "gameFeedback"), {
      game: jogoAtual,
      outcome,
      suggestion: resultadoAtual,
      createdAt: serverTimestamp()
    });
    status.textContent = "Feedback salvo. Ele será considerado nas próximas análises deste jogo.";
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível salvar. Verifique as regras do Firestore.";
    buttons.forEach((button) => { button.disabled = false; });
  }
}

document.querySelectorAll("[data-game]").forEach((button) => {
  button.addEventListener("click", () => abrirModulo(button.dataset.game));
});

if (!document.getElementById("jnCombinationStyles")) {
  const style = document.createElement("style");
  style.id = "jnCombinationStyles";
  style.textContent = `
    .generated-combination,.aviator-result{margin-top:18px;padding:17px;border:1px solid rgba(214,179,75,.24);border-radius:12px;background:linear-gradient(145deg,rgba(18,28,20,.98),rgba(7,12,9,.98));animation:jnReveal .35s ease both}
    .generated-combination[hidden],.aviator-result[hidden],.feedback-area[hidden]{display:none!important}
    .combination-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
    .combination-kicker{color:#8d9990;font-size:9px;letter-spacing:1.8px}
    .combination-heading h4{margin-top:5px;color:#f0f2ed;font-size:16px}
    .combination-state{padding:6px 9px;border:1px solid rgba(53,217,130,.3);border-radius:30px;color:#35d982;font-size:8px;font-weight:700;letter-spacing:1px}
    .combination-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .combination-grid.midas-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-width:460px;margin-inline:auto}
    .combination-item{position:relative;min-width:0;padding:14px 8px 12px;border:1px solid #29372c;border-radius:10px;background:linear-gradient(160deg,#121c15,#090e0a);text-align:center;overflow:hidden}
    .combination-item.turbo{border-color:rgba(214,179,75,.32)}
    .combination-index{display:block;color:#78867b;font-size:8px;letter-spacing:1.3px}
    .combination-value{margin:10px 0 3px;color:#e5c65f;font-size:clamp(18px,4vw,25px);font-weight:800;white-space:nowrap}
    .combination-item.normal .combination-value{color:#65d99a;font-size:clamp(15px,3.5vw,21px)}
    .combination-label{color:#e7ece7;font-size:10px;font-weight:800;letter-spacing:1.3px}
    .combination-detail{margin-top:7px;color:#7f8d82;font-size:7px;letter-spacing:1px}
    .combination-footnote{margin-top:12px;color:#77847a;font-size:9px;line-height:1.5}
    .aviator-multiplier{margin:12px 0;color:#e5c65f;font-size:clamp(42px,10vw,64px);font-weight:900;text-align:center}
    .aviator-attempt-note{margin-top:10px;color:#b8c4b9;font-size:12px;line-height:1.6;text-align:center}
    .aviator-attempt-note strong{color:#e5c65f}
    .feedback-area{margin-top:17px;padding:14px;border:1px solid #29372c;border-radius:10px;background:#0a100b}
    .feedback-area>p:first-child{color:#dce4dd;font-size:12px;margin-bottom:10px}
    .feedback-buttons{display:flex;gap:9px;flex-wrap:wrap}
    .feedback-button{padding:10px 13px;border-radius:8px;font-size:10px;font-weight:800;letter-spacing:.5px;border:1px solid #405044;background:#111a13;color:#e8eee9}
    .feedback-button.success{border-color:#28764b;color:#67dc99}
    .feedback-button.failure{border-color:#74413e;color:#f08e83}
    .feedback-button:disabled{opacity:.5}
    .feedback-status{margin-top:9px;color:#91a096;font-size:10px;line-height:1.5}
    @keyframes jnReveal{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:360px){.combination-grid{gap:6px}.combination-item{padding:12px 5px}.combination-label{font-size:9px}}
  `;
  document.head.appendChild(style);
}

console.log("JN 01 VIP: interface carregada.");
