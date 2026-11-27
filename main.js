import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, limit
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

const $ = id => document.getElementById(id);
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

$("linkCadastro").addEventListener("click", event => {
  event.preventDefault();
  $("erroCadastro").textContent = "";
  showScreen("cadastro");
});
$("linkLogin").addEventListener("click", event => {
  event.preventDefault();
  $("erroLogin").textContent = "";
  showScreen("login");
});

$("formLogin").addEventListener("submit", async event => {
  event.preventDefault();
  $("erroLogin").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("emailLogin").value.trim(), $("senhaLogin").value);
  } catch (error) {
    $("erroLogin").textContent = traduzirErro(error);
  }
});

$("formCadastro").addEventListener("submit", async event => {
  event.preventDefault();
  $("erroCadastro").textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, $("emailCadastro").value.trim(), $("senhaCadastro").value);
  } catch (error) {
    $("erroCadastro").textContent = traduzirErro(error);
  }
});

$("btnSair").addEventListener("click", async () => {
  try { await signOut(auth); }
  catch (error) { alert("Não foi possível sair: " + traduzirErro(error)); }
});

onAuthStateChanged(auth, user => {
  usuarioAtual = user;
  processamentoAtual++;
  analiseAtual = null;
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
  return mensagens[error.code] || "Não foi possível concluir. Verifique a conexão.";
}

const jogos = ["Tigre", "Touro", "Midas", "Aviator"];

function abrirModulo(nome) {
  if (!jogos.includes(nome)) return;
  processamentoAtual++;
  analiseAtual = null;
  const aviator = nome === "Aviator";

  workspace.innerHTML = `
    <div class="module-head">
      <h3>${nome.toUpperCase()}</h3>
      <span class="module-badge">IA CONECTADA</span>
    </div>
    <div class="terminal-window" aria-live="polite">
      <div class="terminal-line current" id="terminal1">MÓDULO ${nome.toUpperCase()} INICIALIZADO</div>
      <div class="terminal-line" id="terminal2">AGUARDANDO SOLICITAÇÃO</div>
      <div class="terminal-line" id="terminal3">SISTEMA PRONTO</div>
    </div>

    <section class="generated-combination" id="generatedCombination" hidden>
      <div class="combination-heading">
        <div>
          <span class="combination-kicker">${aviator ? "ALVO RECREATIVO" : "INTELIGÊNCIA ARTIFICIAL"}</span>
          <h4>${aviator ? "Multiplicador gerado" : `Análise do ${nome}`}</h4>
        </div>
        <span class="combination-state">GERADO</span>
      </div>
      <div id="aiAnalysis" class="ai-analysis"></div>
      <div id="aviatorTarget" class="aviator-target" hidden>
        <span>MULTIPLICADOR SUGERIDO</span>
        <strong id="aviatorMultiplier">--.--x</strong>
        <small>Alvo recreativo, não é previsão de resultado.</small>
        <p class="aviator-attempt-note"><strong>Limite de tentativas</strong><br>Faça no máximo 3 tentativas com este alvo. Se não atingir, encerre e aguarde uma nova análise.</p>
      </div>
      <p class="combination-footnote" id="combinationFootnote"></p>
      <div class="feedback-area" id="feedbackArea" hidden>
        <p>Como foi o resultado dessa análise?</p>
        <div class="feedback-buttons">
          <button type="button" class="feedback-success" id="feedbackSuccess">✓ DEU CERTO</button>
          <button type="button" class="feedback-failure" id="feedbackFailure">✕ NÃO DEU CERTO</button>
        </div>
        <p class="feedback-status" id="feedbackStatus"></p>
      </div>
    </section>

    <section class="image-analysis-area">
      <p><strong>ANALISAR IMAGEM</strong></p>
      <p class="image-help">Selecione uma captura de tela do histórico/resultados deste jogo.</p>
      <input type="file" id="gameImage" accept="image/png,image/jpeg,image/webp">
      <button type="button" class="run-button" id="btnAnalisarImagem">ANALISAR IMAGEM</button>
      <p class="feedback-status" id="imageStatus" aria-live="polite"></p>
      <div class="ai-analysis" id="imageResult" hidden></div>
    </section>

    <div class="module-actions">
      <button class="run-button" id="btnProcessar" type="button">SOLICITAR ANÁLISE DA IA</button>
      <p class="module-status" id="moduleStatus">Módulo selecionado. Aguardando solicitação.</p>
    </div>
  `;

  $("btnProcessar").addEventListener("click", () => processarModulo(nome));
  $("feedbackSuccess").addEventListener("click", () => registrarFeedback(nome, "Deu certo"));
  $("feedbackFailure").addEventListener("click", () => registrarFeedback(nome, "Não deu certo"));
  $("btnAnalisarImagem").addEventListener("click", () => analisarImagem(nome));
}

async function carregarFeedback(nome) {
  if (!usuarioAtual) throw new Error("Faça login novamente.");
  const referencia = collection(db, "users", usuarioAtual.uid, "gameFeedback");
  const resultado = await getDocs(query(referencia, where("game", "==", nome), limit(50)));
  return resultado.docs
    .map(doc => doc.data())
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 20)
    .map(item => ({
      outcome: item.outcome,
      multiplier: item.multiplier || null,
      suggestion: item.suggestion || null
    }));
}

async function carregarAnalisesImagem(nome) {
  if (!usuarioAtual) throw new Error("Faça login novamente.");
  const referencia = collection(db, "users", usuarioAtual.uid, "gameImageAnalyses");
  const resultado = await getDocs(query(referencia, where("game", "==", nome), limit(30)));
  return resultado.docs
    .map(doc => doc.data())
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 10)
    .map(item => ({
      analysis: item.analysis || "",
      extractedResults: item.extractedResults || []
    }));
}

async function chamarApi(payload) {
  if (!usuarioAtual) throw new Error("Sua sessão expirou. Entre novamente.");
  const token = await usuarioAtual.getIdToken();
  const resposta = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  let dados;
  try { dados = await resposta.json(); }
  catch { throw new Error("Resposta inválida do servidor."); }
  if (!resposta.ok) throw new Error(dados.error || "Não foi possível consultar a IA.");
  return dados;
}

async function consultarIA(nome, feedback, analisesAnteriores) {
  const dados = await chamarApi({ jogo: nome, feedback, analisesAnteriores });
  if (nome === "Aviator") {
    const valor = Number(String(dados.multiplicador || "").replace(/x/gi, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor < 1.70 || valor > 10) {
      throw new Error("A IA retornou um multiplicador inválido.");
    }
    return { multiplicador: `${valor.toFixed(2)}x`, analise: dados.analise || "Alvo recreativo gerado." };
  }
  if (!dados.analise) throw new Error("A IA não retornou uma análise.");
  return { analise: dados.analise };
}

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
  $("aviatorTarget").hidden = true;
  status.textContent = "Preparando análise...";
  const passos = [
    `INICIALIZANDO ${nome.toUpperCase()}...`,
    "CONSULTANDO HISTÓRICO SALVO...",
    "SOLICITANDO RESPOSTA À INTELIGÊNCIA ARTIFICIAL..."
  ];
  const ids = ["terminal1", "terminal2", "terminal3"];

  try {
    for (let i = 0; i < passos.length; i++) {
      if (meuProcessamento !== processamentoAtual) return;
      $(ids[i]).textContent = passos[i];
      status.textContent = passos[i];
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    const [feedback, analises] = await Promise.all([
      carregarFeedback(nome),
      carregarAnalisesImagem(nome)
    ]);
    if (meuProcessamento !== processamentoAtual) return;
    const resultado = await consultarIA(nome, feedback, analises);
    if (meuProcessamento !== processamentoAtual) return;

    analiseAtual = {
      jogo: nome,
      multiplicador: resultado.multiplicador || null,
      analise: resultado.analise
    };

    if (nome === "Aviator") {
      $("aviatorMultiplier").textContent = resultado.multiplicador;
      $("aviatorTarget").hidden = false;
      $("aiAnalysis").textContent = resultado.analise;
      $("combinationFootnote").textContent = "Formato exclusivo Aviator: multiplicador entre 1.70x e 10.00x.";
    } else {
      $("aiAnalysis").textContent = resultado.analise;
      $("combinationFootnote").textContent = `Análise textual do módulo ${nome}.`;
    }

    $("generatedCombination").hidden = false;
    $("feedbackArea").hidden = false;
    $("terminal3").textContent = "RESPOSTA RECEBIDA DO SERVIDOR";
    status.textContent = `Análise de ${nome} recebida. Você pode avaliar o resultado.`;
    button.textContent = "GERAR NOVA ANÁLISE";
  } catch (error) {
    if (meuProcessamento !== processamentoAtual) return;
    console.error("Erro na análise:", error);
    status.textContent = error.message || "Não foi possível concluir a análise.";
    $("terminal3").textContent = "ERRO NA CONSULTA DA IA";
    button.textContent = "TENTAR NOVAMENTE";
  } finally {
    if (meuProcessamento === processamentoAtual && button.isConnected) button.disabled = false;
  }
}

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
  status.textContent = "Salvando feedback...";
  try {
    const referencia = collection(db, "users", usuarioAtual.uid, "gameFeedback");
    const registro = {
      game: nome,
      outcome: resultado,
      suggestion: analiseAtual.multiplicador || analiseAtual.analise.slice(0, 120),
      createdAt: Date.now()
    };
    if (nome === "Aviator") registro.multiplier = analiseAtual.multiplicador;
    await addDoc(referencia, registro);
    status.textContent = `Feedback salvo: ${resultado}.`;
  } catch (error) {
    console.error("Erro ao salvar feedback:", error);
    status.textContent = "Erro ao salvar. Verifique as regras do Firestore.";
    sucesso.disabled = false;
    falha.disabled = false;
  }
}

async function analisarImagem(nome) {
  const input = $("gameImage");
  const button = $("btnAnalisarImagem");
  const status = $("imageStatus");
  const output = $("imageResult");
  const file = input.files?.[0];

  if (!file) {
    status.textContent = "Escolha uma imagem primeiro.";
    return;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    status.textContent = "Formato não suportado. Use PNG, JPG ou WEBP.";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    status.textContent = "A imagem precisa ter até 5 MB.";
    return;
  }

  button.disabled = true;
  button.textContent = "ANALISANDO...";
  status.textContent = "Enviando imagem para análise...";
  output.hidden = true;

  try {
    const imagem = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.readAsDataURL(file);
    });

    const dados = await chamarApi({
      acao: "analisar-imagem",
      jogo: nome,
      imagem
    });

    const texto = String(dados.analise || "");
    const valores = [...texto.matchAll(/\b\d{1,3}(?:[.,]\d{1,2})?\s*x\b/gi)]
      .map(match => match[0])
      .slice(0, 50);

    const referencia = collection(db, "users", usuarioAtual.uid, "gameImageAnalyses");
    await addDoc(referencia, {
      game: nome,
      analysis: texto.slice(0, 5000),
      extractedResults: valores,
      fileName: String(file.name || "imagem").slice(0, 120),
      createdAt: Date.now()
    });

    output.textContent = texto;
    output.hidden = false;
    status.textContent = "Análise concluída e salva no histórico.";
  } catch (error) {
    console.error("Erro na análise da imagem:", error);
    status.textContent = error.message || "Não foi possível analisar a imagem.";
  } finally {
    button.disabled = false;
    button.textContent = "ANALISAR IMAGEM";
  }
}

document.querySelectorAll("[data-game]").forEach(button => {
  button.addEventListener("click", () => abrirModulo(button.dataset.game));
});

if (!document.getElementById("jnCombinationStyles")) {
  const style = document.createElement("style");
  style.id = "jnCombinationStyles";
  style.textContent = `
    .generated-combination,.image-analysis-area{margin-top:18px;padding:17px;border:1px solid rgba(214,179,75,.24);border-radius:12px;background:linear-gradient(145deg,rgba(18,28,20,.98),rgba(7,12,9,.98))}
    .generated-combination[hidden],.aviator-target[hidden],.image-analysis-area [hidden]{display:none!important}
    .combination-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
    .combination-kicker{color:#8d9990;font-size:9px;letter-spacing:1.8px}
    .combination-heading h4{margin-top:5px;color:#f0f2ed;font-size:16px}
    .combination-state{padding:6px 9px;border:1px solid rgba(53,217,130,.3);border-radius:30px;color:#35d982;font-size:8px;font-weight:700}
    .ai-analysis{margin-top:12px;padding:14px;border:1px solid rgba(214,179,75,.2);border-radius:9px;background:rgba(0,0,0,.2);color:#e5eae5;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
    .aviator-target{margin-top:12px;padding:20px 12px;border:1px solid rgba(214,179,75,.35);border-radius:12px;background:linear-gradient(145deg,#17251a,#090e0a);text-align:center}
    .aviator-target span,.aviator-target small{display:block;color:#aab5aa;font-size:10px;letter-spacing:1px}
    .aviator-target strong{display:block;margin:12px 0;color:#e5c65f;font-size:clamp(42px,12vw,62px);font-weight:900;line-height:1}
    .aviator-attempt-note{margin-top:18px;color:#b8c4b9;font-size:12px;line-height:1.6}
    .aviator-attempt-note strong{color:#e5c65f}
    .combination-footnote{margin-top:12px;color:#9aa49b;font-size:10px;line-height:1.6}
    .feedback-area{margin-top:17px;padding-top:14px;border-top:1px solid rgba(214,179,75,.17)}
    .feedback-area>p:first-child,.image-analysis-area>p:first-child{margin-bottom:10px;color:#e5eae5;font-size:12px;font-weight:700}
    .feedback-buttons{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .feedback-buttons button{min-height:42px;padding:9px 7px;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer}
    .feedback-success{border:1px solid rgba(53,217,130,.4);background:rgba(53,217,130,.1);color:#55e49a}
    .feedback-failure{border:1px solid rgba(255,100,100,.35);background:rgba(255,100,100,.08);color:#ff9292}
    .feedback-buttons button:disabled{opacity:.45;cursor:not-allowed}
    .feedback-status,.image-help{margin-top:10px;color:#aab5aa;font-size:10px;line-height:1.5}
    .image-analysis-area input{display:block;width:100%;margin:12px 0;color:#cbd5cc;font-size:12px}
    .image-analysis-area .run-button{margin-top:4px}
    @media(max-width:360px){.feedback-buttons{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

console.log("JN 01 VIP: módulos, feedback e análise de imagens carregados.");
