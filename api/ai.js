
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

const GAMES = ["Tigre", "Touro", "Midas", "Aviator"];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

async function authenticate(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Faça login para utilizar a IA.");
  }

  const { payload } = await jwtVerify(
    authorization.slice(7),
    GOOGLE_KEYS,
    {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID
    }
  );

  return payload.sub;
}

function extrairImagem(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("Envie uma imagem do histórico.");
  }

  const match = dataUrl.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) {
    throw new Error("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const base64 = match[2];
  const tamanho = Math.floor(base64.length * 3 / 4);

  if (tamanho <= 0 || tamanho > MAX_IMAGE_BYTES) {
    throw new Error("A imagem deve ter no máximo 3 MB após a compressão.");
  }

  return {
    mimeType: `image/${match[1]}`,
    dataUrl
  };
}

async function chamarOpenRouter(apiKey, messages, maxTokens = 300) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "JN 01 VIP"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.1,
        max_tokens: maxTokens
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro OpenRouter:", data);
    throw new Error("Erro ao consultar a inteligência artificial.");
  }

  const conteudo = data.choices?.[0]?.message?.content;

  if (typeof conteudo !== "string" || !conteudo.trim()) {
    throw new Error("A IA não retornou uma resposta.");
  }

  return conteudo.trim();
}

/* NORMALIZA OS MULTIPLICADORES */

function normalizarMultiplicadores(lista) {
  if (!Array.isArray(lista)) return [];

  const resultado = [];

  for (const item of lista) {
    const texto = String(item).trim().replace(",", ".");

    const match = texto.match(
      /^(\d{1,5}(?:\.\d{1,4})?)\s*x?$/i
    );

    if (!match) continue;

    const numero = Number(match[1]);

    if (!Number.isFinite(numero) || numero < 1) continue;

    resultado.push(`${numero.toFixed(2)}x`);
  }

  return resultado.slice(0, 80);
}

/* EXTRAI OS NÚMEROS DA RESPOSTA DA IA */

function interpretarRespostaImagem(conteudo) {
  const texto = conteudo
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Primeira tentativa: JSON completo
  try {
    const dados = JSON.parse(texto);

    if (Array.isArray(dados.multiplicadores)) {
      return normalizarMultiplicadores(dados.multiplicadores);
    }
  } catch {
    // Continua para tentar localizar um JSON dentro do texto.
  }

  // Segunda tentativa: JSON dentro de uma resposta maior
  const trecho = texto.match(/\{[\s\S]*"multiplicadores"[\s\S]*\}/i);

  if (trecho) {
    try {
      const dados = JSON.parse(trecho[0]);

      if (Array.isArray(dados.multiplicadores)) {
        return normalizarMultiplicadores(dados.multiplicadores);
      }
    } catch {
      // Continua para a última tentativa.
    }
  }

  // Terceira tentativa: números explicitamente identificados com x
  const encontrados = texto.match(
    /\b\d{1,5}(?:[.,]\d{1,4})?\s*x\b/gi
  ) || [];

  return normalizarMultiplicadores(encontrados);
}

/* LEITURA DO HISTÓRICO POR IMAGEM */

async function lerHistoricoImagem(apiKey, imagem) {
  const conteudo = await chamarOpenRouter(apiKey, [
    {
      role: "system",
      content: `
Você é um sistema especializado em leitura visual de históricos do Aviator.

Sua tarefa é identificar os multiplicadores das rodadas que aparecem na imagem.

REGRAS OBRIGATÓRIAS:

1. Observe cuidadosamente toda a imagem.
2. Leia os resultados da esquerda para a direita e de cima para baixo.
3. Identifique números acompanhados de x ou apresentados visualmente como multiplicadores.
4. Aceite vírgula ou ponto decimal.
5. Não confunda saldo, apostas, horários ou contadores com multiplicadores.
6. Não invente números.
7. Não complete números cortados ou ilegíveis.
8. Preserve a ordem em que os resultados aparecem.
9. Extraia todos os resultados que conseguir identificar com segurança, até 80.

IMPORTANTE:
Um multiplicador como 2,45 deve ser convertido para 2.45x.
Um multiplicador como 1.08x deve permanecer 1.08x.

Responda exclusivamente com JSON válido:

{
  "multiplicadores": ["2.45x", "1.08x", "3.20x"]
}

Se nenhum multiplicador puder ser identificado com segurança:

{
  "multiplicadores": []
}
`
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analise a imagem inteira e extraia os multiplicadores visíveis do histórico da ronda."
        },
        {
          type: "image_url",
          image_url: {
            url: imagem.dataUrl
          }
        }
      ]
    }
  ], 700);

  return interpretarRespostaImagem(conteudo);
}

/* ROTA PRINCIPAL */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Utilize POST."
    });
  }

  try {
    await authenticate(req);
  } catch (error) {
    return res.status(401).json({
      error: "Autenticação inválida. Faça login novamente."
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Chave OpenRouter não configurada."
    });
  }

  try {
    const {
      action,
      jogo,
      feedback,
      historicoReal
    } = req.body || {};

    /* AÇÃO DE LEITURA DA IMAGEM */

    if (action === "ler_historico") {
      if (jogo !== "Aviator") {
        return res.status(400).json({
          error: "Leitura de imagem disponível apenas para Aviator."
        });
      }

      let imagem;

      try {
        imagem = extrairImagem(req.body.imagem);
      } catch (error) {
        return res.status(400).json({
          error: error.message
        });
      }

      const multiplicadores = await lerHistoricoImagem(
        apiKey,
        imagem
      );

      return res.status(200).json({
        sucesso: true,
        jogo: "Aviator",
        multiplicadores,
        quantidade: multiplicadores.length
      });
    }

    /* VALIDAÇÃO DOS JOGOS */

    if (!GAMES.includes(jogo)) {
      return res.status(400).json({
        error: "Jogo inválido."
      });
    }

    /* HISTÓRICO DE FEEDBACK */

    const historicoFeedback = Array.isArray(feedback)
      ? feedback.slice(0, 20).map(item => ({
          resultado: item.outcome,
          multiplicador: item.multiplier || null
        }))
      : [];

    let prompt;
    let maxTokens = 300;

    /* AVIATOR */

    if (jogo === "Aviator") {
      const rodadasReais = normalizarMultiplicadores(
        Array.isArray(historicoReal) ? historicoReal : []
      );

      prompt = `
Você gera uma análise recreativa para o jogo Aviator.

Considere os dados enviados pelo usuário como histórico descritivo.

HISTÓRICO EXTRAÍDO DA IMAGEM:
${JSON.stringify(rodadasReais)}

FEEDBACKS ANTERIORES:
${JSON.stringify(historicoFeedback)}

Não afirme que é possível prever a próxima rodada.
Não invente resultados.
Não prometa ganhos ou acertos.
Não confunda os números do Aviator com os jogos PG.

Escolha um alvo recreativo entre 1.70 e 10.00, com duas casas decimais.

Responda SOMENTE com o número.
Exemplo: 2.45
`;

      maxTokens = 30;
    } else {
      /* JOGOS PG */

      prompt = `
Você é a inteligência artificial do painel JN 01 VIP.

JOGO: ${jogo}

FEEDBACKS ANTERIORES:
${JSON.stringify(historicoFeedback)}

Considere os feedbacks para contextualizar novas análises.

Não invente resultados ou números.
Não afirme conhecer resultados futuros.
Não prometa ganhos ou acertos garantidos.
Não utilize multiplicadores do Aviator nos jogos PG.

Responda em português brasileiro, com até 100 palavras.

Use este formato:

ANÁLISE:
Explique brevemente sua análise.

HISTÓRICO:
Considere os feedbacks anteriores.

ORIENTAÇÃO:
Apresente uma orientação recreativa e responsável.
`;
    }

    const conteudo = await chamarOpenRouter(
      apiKey,
      [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: jogo === "Aviator"
            ? "Gere o alvo recreativo do Aviator."
            : `Faça a análise do módulo ${jogo}.`
        }
      ],
      maxTokens
    );

    /* RESPOSTA DO AVIATOR */

    if (jogo === "Aviator") {
      const correspondencia = conteudo.match(
        /\b\d{1,2}(?:[.,]\d{1,2})?\b/
      );

      const numero = correspondencia
        ? Number(correspondencia[0].replace(",", "."))
        : NaN;

      if (
        !Number.isFinite(numero) ||
        numero < 1.70 ||
        numero > 10.00
      ) {
        return res.status(502).json({
          error: "A IA não gerou um multiplicador válido. Tente novamente."
        });
      }

      return res.status(200).json({
        sucesso: true,
        jogo,
        multiplicador: `${numero.toFixed(2)}x`,
        analise: "Alvo recreativo gerado pela IA com o histórico enviado como contexto."
      });
    }

    /* RESPOSTA DOS JOGOS PG */

    return res.status(200).json({
      sucesso: true,
      jogo,
      analise: conteudo
    });

  } catch (error) {
    console.error("Erro interno:", error);

    return res.status(500).json({
      error: error.message || "Erro interno da inteligência artificial."
    });
  }
}
