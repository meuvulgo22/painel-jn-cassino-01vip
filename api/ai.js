import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);
const GAMES = ["Tigre", "Touro", "Midas", "Aviator"];
const MODEL = "openai/gpt-4o-mini";

async function authenticate(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Faça login para utilizar a IA.");
  }
  const { payload } = await jwtVerify(authorization.slice(7), GOOGLE_KEYS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID
  });
  return payload.sub;
}

function validImageDataUrl(value) {
  return typeof value === "string" &&
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value) &&
    value.length <= 8_000_000;
}

async function askOpenRouter(apiKey, messages, maxTokens = 500) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "JN 01 VIP"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens
    })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Erro OpenRouter:", data);
    throw new Error("Erro ao consultar a inteligência artificial.");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("A IA não retornou uma resposta.");
  }
  return content.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Utilize POST." });
  }

  try {
    await authenticate(req);
  } catch {
    return res.status(401).json({
      error: "Autenticação inválida. Faça login novamente."
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Chave OpenRouter não configurada." });
  }

  try {
    const { jogo, feedback, analisesAnteriores, acao, imagem } = req.body || {};
    if (!GAMES.includes(jogo)) {
      return res.status(400).json({ error: "Jogo inválido." });
    }

    if (acao === "analisar-imagem") {
      if (!validImageDataUrl(imagem)) {
        return res.status(400).json({
          error: "Imagem inválida. Envie PNG, JPG ou WEBP de até aproximadamente 6 MB."
        });
      }

      const promptImagem = `
Você é o módulo de leitura de imagens do painel JN 01 VIP.
Jogo selecionado: ${jogo}.
Examine somente o que estiver VISÍVEL na imagem.
Extraia os multiplicadores/resultados que conseguir ler, mantendo a ordem visual.
Não invente valores. Se algo estiver ilegível, marque como "ilegível".
Não tente prever rodadas futuras nem prometa acertos ou ganhos.
Responda em português brasileiro, neste formato:

RESULTADOS IDENTIFICADOS:
- liste os valores visíveis, ou "Nenhum valor legível".

LEITURA DA IMAGEM:
- descreva brevemente o que foi possível identificar.

CONFIANÇA DA LEITURA:
- alta, média ou baixa, explicando brevemente.

Se a imagem não mostrar histórico/resultados do jogo, diga isso claramente.
`;
      const content = await askOpenRouter(apiKey, [{
        role: "user",
        content: [
          { type: "text", text: promptImagem },
          { type: "image_url", image_url: { url: imagem } }
        ]
      }], 700);

      return res.status(200).json({
        sucesso: true,
        jogo,
        analise: content
      });
    }

    const historicoFeedback = Array.isArray(feedback)
      ? feedback.slice(0, 20).map(item => ({
          resultado: String(item.outcome || ""),
          multiplicador: item.multiplier || null,
          sugestao: item.suggestion || null
        }))
      : [];

    const historicoAnalises = Array.isArray(analisesAnteriores)
      ? analisesAnteriores.slice(0, 10).map(item => ({
          analise: String(item.analysis || "").slice(0, 1200),
          resultados: item.extractedResults || []
        }))
      : [];

    if (jogo === "Aviator") {
      const prompt = `
Você gera um alvo recreativo para o jogo Aviator.
Escolha um número decimal entre 1.70 e 10.00, com duas casas decimais.
O histórico abaixo é apenas contexto e não permite prever rodadas futuras.
Não afirme que o número será atingido, nem prometa ganhos.
Responda SOMENTE com um número, por exemplo: 2.45

FEEDBACKS:
${JSON.stringify(historicoFeedback)}
LEITURAS ANTERIORES DE IMAGENS:
${JSON.stringify(historicoAnalises)}
`;
      const content = await askOpenRouter(apiKey, [
        { role: "system", content: prompt },
        { role: "user", content: "Gere um alvo recreativo para o Aviator." }
      ], 30);

      const match = content.match(/\b\d{1,2}(?:[.,]\d{1,2})?\b/);
      const number = match ? Number(match[0].replace(",", ".")) : NaN;
      if (!Number.isFinite(number) || number < 1.70 || number > 10) {
        return res.status(502).json({
          error: "A IA não gerou um multiplicador válido. Tente novamente."
        });
      }
      return res.status(200).json({
        sucesso: true,
        jogo,
        multiplicador: `${number.toFixed(2)}x`,
        analise: "Alvo recreativo gerado com contexto do histórico registrado."
      });
    }

    const prompt = `
Você é a IA de análise do painel JN 01 VIP.
JOGO: ${jogo}
FEEDBACKS ANTERIORES:
${JSON.stringify(historicoFeedback)}
ANÁLISES DE IMAGENS ANTERIORES:
${JSON.stringify(historicoAnalises)}
Responda em português brasileiro, com no máximo 100 palavras.
Não invente resultados ou padrões e não afirme conhecer resultados futuros.
Use o histórico somente como contexto.
Formato:
ANÁLISE:
HISTÓRICO:
ORIENTAÇÃO:
Não utilize multiplicadores do Aviator nos jogos PG.
`;
    const content = await askOpenRouter(apiKey, [
      { role: "system", content: prompt },
      { role: "user", content: `Faça a análise do módulo ${jogo}.` }
    ], 250);

    return res.status(200).json({ sucesso: true, jogo, analise: content });
  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({
      error: error.message || "Erro interno da inteligência artificial."
    });
  }
}
