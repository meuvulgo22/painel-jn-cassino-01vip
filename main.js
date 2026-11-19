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
    <section class="generated-combination" id="generatedCombination" hidden aria-live="polite">
      <div class="combination-heading">
        <div>
          <span class="combination-kicker">PAINEL DE RESULTADOS</span>
          <h4>Combinação gerada</h4>
        </div>
        <span class="combination-state">CONCLUÍDO</span>
      </div>
      <div class="combination-grid" id="combinationGrid"></div>
      <p class="combination-footnote">Combinação aleatória de interface; não utiliza dados nem prevê resultados do jogo.</p>
    </section>
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
  button.textContent = "PROCESSANDO...";
  status.textContent = `Verificando o módulo ${nome}...`;

  const ids = ["terminal1", "terminal2", "terminal3"];
  const passos = [
    `INICIALIZANDO MÓDULO ${nome.toUpperCase()}`,
    "VERIFICANDO COMPONENTES E CONTROLES LOCAIS...",
    `COMPONENTES ENCONTRADOS: MÓDULO ${nome.toUpperCase()}, INTERFACE E CONTROLES`,
  ];

  const resultado = $("generatedCombination");
  const grade = $("combinationGrid");
  if (resultado) resultado.hidden = true;
  if (grade) grade.replaceChildren();

  let etapa = 0;
  ids.forEach((id) => { if ($(id)) $(id).textContent = "AGUARDANDO..."; });

  const gerarQuantidade = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const exibirCombinacao = () => {
    if (!grade || !resultado) return;

    // Valores aleatórios para compor a interface; não são calculados a partir do jogo.
    const turbo = gerarQuantidade(2, 5);
    const normal = gerarQuantidade(5, 12);
    const segundoTurbo = gerarQuantidade(2, 4);

    const itens = [
      { valor: `${turbo}×`, rotulo: "TURBO", detalhe: "PARÂMETRO 01", classe: "turbo" },
      { valor: `${normal} vezes`, rotulo: "NORMAL", detalhe: "PARÂMETRO 02", classe: "normal" },
      { valor: `${segundoTurbo}×`, rotulo: "TURBO", detalhe: "PARÂMETRO 03", classe: "turbo" }
    ];

    grade.innerHTML = itens.map((item, indice) => `
      <article class="combination-item ${item.classe}">
        <span class="combination-index">0${indice + 1}</span>
        <div class="combination-value">${item.valor}</div>
        <div class="combination-label">${item.rotulo}</div>
        <div class="combination-detail">${item.detalhe}</div>
      </article>
    `).join("");
    resultado.hidden = false;
  };

  const avancar = () => {
    if (etapa < passos.length) {
      const alvo = $(ids[etapa]);
      if (alvo) alvo.textContent = passos[etapa];
      etapa += 1;
      window.setTimeout(avancar, 650);
      return;
    }
    exibirCombinacao();
    status.textContent = `Módulo ${nome} verificado. Combinação de interface gerada.`;
    button.disabled = false;
    button.textContent = "GERAR NOVAMENTE";
  };
  avancar();
}

document.querySelectorAll("[data-game]").forEach((button) => {
  button.addEventListener("click", () => abrirModulo(button.dataset.game));
});


/* Estilos isolados do cartão de combinação gerada */
if (!document.getElementById("jnCombinationStyles")) {
  const style = document.createElement("style");
  style.id = "jnCombinationStyles";
  style.textContent = `
    .generated-combination{margin-top:18px;padding:17px;border:1px solid rgba(214,179,75,.24);border-radius:12px;background:linear-gradient(145deg,rgba(18,28,20,.98),rgba(7,12,9,.98));animation:jnReveal .35s ease both}
    .generated-combination[hidden]{display:none!important}
    .combination-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
    .combination-kicker{color:#8d9990;font-size:9px;letter-spacing:1.8px}
    .combination-heading h4{margin-top:5px;color:#f0f2ed;font-size:16px;font-weight:700;letter-spacing:.3px}
    .combination-state{padding:6px 9px;border:1px solid rgba(53,217,130,.3);border-radius:30px;color:#35d982;font-size:8px;font-weight:700;letter-spacing:1px;white-space:nowrap}
    .combination-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .combination-item{position:relative;min-width:0;padding:14px 8px 12px;border:1px solid #29372c;border-radius:10px;background:linear-gradient(160deg,#121c15,#090e0a);text-align:center;overflow:hidden}
    .combination-item.turbo{border-color:rgba(214,179,75,.32)}
    .combination-index{display:block;color:#78867b;font-size:8px;letter-spacing:1.3px}
    .combination-value{margin:10px 0 3px;color:#e5c65f;font-size:clamp(18px,4vw,25px);font-weight:800;line-height:1.15;white-space:nowrap}
    .combination-item.normal .combination-value{color:#65d99a;font-size:clamp(15px,3.5vw,21px)}
    .combination-label{color:#e7ece7;font-size:10px;font-weight:800;letter-spacing:1.3px}
    .combination-detail{margin-top:7px;color:#7f8d82;font-size:7px;letter-spacing:1px}
    .combination-footnote{margin-top:12px;color:#77847a;font-size:9px;line-height:1.5}
    @keyframes jnReveal{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:360px){.combination-grid{gap:6px}.combination-item{padding:12px 5px}.combination-label{font-size:9px}}
  `;
  document.head.appendChild(style);
}

console.log("JN 01 VIP: interface carregada.");
