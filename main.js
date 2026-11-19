
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* FIREBASE - CONFIGURAÇÃO ORIGINAL */

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
const db = getFirestore(app);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

/* ELEMENTOS */

const loginDiv = document.getElementById("login");
const cadastroDiv = document.getElementById("cadastro");
const painelDiv = document.getElementById("painel");

const btnGreen = document.getElementById("btnGreen");
const btnRed = document.getElementById("btnRed");

const resultadoAvaliacao =
  document.getElementById("resultadoAvaliacao");

const tipoEnviado =
  document.getElementById("tipoEnviado");

const contadorGlobal =
  document.getElementById("contadorGlobal");

const oportunidade =
  document.getElementById("oportunidade");

const loadingSinal =
  document.getElementById("loadingSinal");

const textoCarregamento =
  document.getElementById("textoCarregamento");

const tituloOportunidade =
  document.getElementById("tituloOportunidade");

const descricaoOportunidade =
  document.getElementById("descricaoOportunidade");

const tipoOportunidade =
  document.getElementById("tipoOportunidade");

const faixaOportunidade =
  document.getElementById("faixaOportunidade");

const indiceOportunidade =
  document.getElementById("indiceOportunidade");

const barraProb =
  document.getElementById("barraProb");

const statusOportunidade =
  document.getElementById("statusOportunidade");

const refGlobal = doc(db, "historico", "global");

/* ESTADO */

let bloqueado = false;
let tempoRestante = 0;
let intervalo = null;
let contagem = null;
let avaliacaoFeita = false;
let sinalAtual = null;

/* LOGIN E CADASTRO */

window.mostrarCadastro = function() {
  loginDiv.style.display = "none";
  cadastroDiv.style.display = "flex";
};

window.mostrarLogin = function() {
  cadastroDiv.style.display = "none";
  loginDiv.style.display = "flex";
};

window.cadastrar = async function() {
  const email = document.getElementById("emailCadastro").value.trim();
  const senha = document.getElementById("senhaCadastro").value;

  if (!email || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    alert("Cadastro realizado com sucesso!");
    mostrarLogin();
  } catch (erro) {
    alert("Erro no cadastro: " + erro.message);
  }
};

window.login = async function() {
  const email = document.getElementById("emailLogin").value.trim();
  const senha = document.getElementById("senhaLogin").value;

  if (!email || !senha) {
    alert("Preencha email e senha!");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (erro) {
    alert("Erro no login: " + erro.message);
  }
};

/* CONTROLE DE LOGIN */

onAuthStateChanged(auth, function(user) {
  if (user) {
    painelDiv.style.display = "block";
    loginDiv.style.display = "none";
    cadastroDiv.style.display = "none";
  } else {
    painelDiv.style.display = "none";
    loginDiv.style.display = "flex";
    cadastroDiv.style.display = "none";
  }
});

/* FIREBASE GLOBAL */

async function garantirDocumento() {
  try {
    const snap = await getDoc(refGlobal);

    if (!snap.exists()) {
      await setDoc(refGlobal, {
        green: 0,
        red: 0
      });
    }
  } catch (erro) {
    console.error("Erro ao preparar dados:", erro);
  }
}

garantirDocumento();

onSnapshot(refGlobal, function(docSnap) {
  if (!docSnap.exists()) return;

  const dados = docSnap.data();
  const green = dados.green || 0;
  const red = dados.red || 0;

  if (contadorGlobal) {
    contadorGlobal.innerText =
      "Avaliações: " + green + " Green | " + red + " Red";
  }
});

/* AVALIAÇÃO */

async function marcar(tipo) {
  if (avaliacaoFeita || !sinalAtual) return;

  avaliacaoFeita = true;

  if (resultadoAvaliacao) {
    resultadoAvaliacao.innerText = "Avaliação enviada!";
  }

  if (tipoEnviado) {
    tipoEnviado.innerText =
      "Avaliação registrada como " + tipo;
  }

  if (btnGreen) btnGreen.disabled = true;
  if (btnRed) btnRed.disabled = true;

  try {
    if (tipo === "GREEN") {
      await updateDoc(refGlobal, {
        green: increment(1)
      });
    } else {
      await updateDoc(refGlobal, {
        red: increment(1)
      });
    }
  } catch (erro) {
    console.error("Erro ao registrar avaliação:", erro);
    if (resultadoAvaliacao) {
      resultadoAvaliacao.innerText =
        "Não foi possível registrar. Tente novamente.";
    }
  }
}

if (btnGreen) {
  btnGreen.addEventListener("click", function() {
    marcar("GREEN");
  });
}

if (btnRed) {
  btnRed.addEventListener("click", function() {
    marcar("RED");
  });
}

/* TIMER */

function iniciarTimer(minutos) {
  bloqueado = true;
  tempoRestante = minutos * 60;

  clearInterval(intervalo);

  const timerEl = document.getElementById("timer");

  function atualizarTimer() {
    const minutosRestantes =
      Math.floor(tempoRestante / 60);

    const segundosRestantes =
      tempoRestante % 60;

    if (timerEl) {
      timerEl.innerText =
        "Nova simulação em: " +
        minutosRestantes + ":" +
        String(segundosRestantes).padStart(2, "0");
    }

    if (tempoRestante <= 0) {
      clearInterval(intervalo);
      bloqueado = false;

      if (timerEl) timerEl.innerText = "";
    }
  }

  atualizarTimer();

  intervalo = setInterval(function() {
    tempoRestante--;
    atualizarTimer();

    if (tempoRestante <= 0) {
      clearInterval(intervalo);
    }
  }, 1000);
}

/* GERADOR DE SIMULAÇÃO */

function gerarSinalAleatorio(jogo) {
  const tipos = [
    "CENÁRIO DEMONSTRATIVO A",
    "CENÁRIO DEMONSTRATIVO B",
    "CENÁRIO DEMONSTRATIVO C"
  ];

  const tipo =
    tipos[Math.floor(Math.random() * tipos.length)];

  const indice =
    Math.floor(Math.random() * 31) + 60;

  const faixaMin = (Math.random() * 0.8 + 1).toFixed(2);
  const faixaMax = (Math.random() * 1.5 + 1.8).toFixed(2);

  return {
    jogo: jogo,
    tipo: tipo,
    min: faixaMin,
    max: faixaMax,
    indice: indice
  };
}

/* MOSTRAR RESULTADO */

function mostrarSinal(jogo, sinal) {
  sinalAtual = sinal;
  avaliacaoFeita = false;

  if (btnGreen) btnGreen.disabled = false;
  if (btnRed) btnRed.disabled = false;

  if (resultadoAvaliacao) {
    resultadoAvaliacao.innerText = "";
  }

  if (tipoEnviado) {
    tipoEnviado.innerText = "";
  }

  oportunidade.style.display = "block";
  oportunidade.style.opacity = "0";

  tituloOportunidade.innerText =
    "OPORTUNIDADE " + jogo.toUpperCase();

  descricaoOportunidade.innerText =
    "Cenário Criado!";

  tipoOportunidade.innerText = sinal.tipo;

  faixaOportunidade.innerText =
    sinal.min + "x até " + sinal.max + "x";

  indiceOportunidade.innerText =
    sinal.indice + "%";

  barraProb.style.width = "0%";

  statusOportunidade.innerText =
    "JN FINALIZOU COM SUCESSO";

  setTimeout(function() {
    oportunidade.style.opacity = "1";
    barraProb.style.width = sinal.indice + "%";
  }, 100);

  iniciarTimer(2);
}

/* BOTÃO GERAR */

window.gerar = function(jogo) {
  if (jogo !== "Tigre" && jogo !== "Touro") {
    alert("Jogo não reconhecido.");
    return;
  }

  if (bloqueado) {
    alert("Aguarde o temporizador terminar.");
    return;
  }

  clearInterval(contagem);

  oportunidade.style.display = "none";
  loadingSinal.style.display = "block";

  let contador = 3;

  textoCarregamento.innerText =
    "Preparando JN 01 VIP procurando oportunidades... " + contador;

  contagem = setInterval(function() {
    contador--;

    textoCarregamento.innerText =
      "Preparando demonstração... " + contador;

    if (contador <= 0) {
      clearInterval(contagem);

      loadingSinal.style.display = "none";

      const sinal = gerarSinalAleatorio(jogo);

      mostrarSinal(jogo, sinal);
    }
  }, 1000);
};

console.log("JN 01 VIP iniciado 🔥👑");
