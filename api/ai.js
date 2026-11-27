import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
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

  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    throw new Error("Formato de imagem inválido. Use JPG, PNG ou WEBP.");
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
        temperature: 0.2,
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

async function lerHistoricoImagem(apiKey, imagem) {
  const conteudo = await chamarOpenRouter(apiKey, [
    {
      role: "system",
      content: `
Você é um leitor de imagens. Extraia somente os multiplicadores que estiverem claramente visíveis no painel de histórico do jogo Aviator.
Regras:
- Leia da esquerda para a direita e de cima para baixo, na ordem visual apresentada.
- Preserve cada valor exatamente com duas casas decimais quando estiver visível.
- Não invente, complete, estime ou deduza números cortados ou ilegíveis.
- Ignore saldo, valores de aposta, contadores e quaisquer números que não sejam multiplicadores de rodada.
- Retorne somente JSON válido, sem markdown, neste formato:
{"multiplicadores":["2.84x","1.14x"]}
- Se não conseguir identificar nenhum com segurança, retorne:
{"multiplicadores":[]}
`
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Leia os multiplicadores reais visíveis nesta captura do histórico da ronda."
        },
        {
          type: "image_url",
          image_url: { url: imagem.dataUrl }
        }
      ]
    }
  ], 500);

  let parsed;
  try {
    const json = conteudo.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(json);
  } catch {
    throw new Error("A IA não conseguiu organizar a leitura da imagem. Tente outro print.");
  }

  if (!parsed || !Array.isArray(parsed.multiplicadores)) {
    throw new Error("A resposta da leitura da imagem veio em formato inválido.");
  }

  const validos = parsed.multiplicadores
    .filter(valor => typeof valor === "string")
    .map(valor => valor.trim())
    .filter(valor => /^(?:\d{1,2})(?:\.\d{1,2})x$/i.test(valor))
    .slice(0, 80);

  return validos;
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
    return res.status(500).json({
      error: "Chave OpenRouter não configurada."
    });
  }

  try {
    const { action, jogo, feedback, historicoReal } = req.body || {};

    if (action === "ler_historico") {
      if (jogo !== "Aviator") {
        return res.status(400).json({ error: "Leitura de imagem disponível apenas para Aviator." });
      }

      let imagem;
      try {
        imagem = extrairImagem(req.body.imagem);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const multiplicadores = await lerHistoricoImagem(apiKey, imagem);

      return res.status(200).json({
        sucesso: true,
        jogo: "Aviator",
        multiplicadores,
        quantidade: multiplicadores.length
      });
    }

    if (!GAMES.includes(jogo)) {
      return res.status(400).json({ error: "Jogo inválido." });
    }

    const historicoFeedback = Array.isArray(feedback)
      ? feedback.slice(0, 20).map(item => ({
          resultado: item.outcome,
          multiplicador: item.multiplier || null
        }))
      : [];

    let prompt;
    let maxTokens = 180;

    if (jogo === "Aviator") {
      const rodadasReais = Array.isArray(historicoReal)
        ? historicoReal
            .filter(valor => typeof valor === "string" && /^(?:\d{1,2})(?:\.\d{1,2})x$/i.test(valor))
            .slice(0, 80)
        : [];

      prompt = `
Você gera um alvo recreativo para o jogo Aviator.

Escolha um número decimal entre 1.70 e 10.00, com duas casas decimais.
Considere os dados abaixo apenas como contexto descritivo. Resultados passados não permitem prever rodadas futuras.

HISTÓRICO REAL EXTRAÍDO DE PRINT ENVIADO PELO USUÁRIO (pode conter erros de leitura):
${JSON.stringify(rodadasReais)}

HISTÓRICO DE FEEDBACK DO PAINEL:
${JSON.stringify(historicoFeedback)}

Não afirme que o número é uma previsão nem que será atingido.
Não invente padrões ou prometa ganhos.
Responda SOMENTE com um número, por exemplo: 2.45
`;
      maxTokens = 20;
    } else {
      prompt = `
Você é a IA de análise do painel JN 01 VIP.

JOGO: ${jogo}

HISTÓRICO DE FEEDBACK:
${JSON.stringify(historicoFeedback)}

Responda em português brasileiro, com no máximo 80 palavras.
Não invente resultados, números ou padrões.
Não afirme conhecer resultados futuros.
Não prometa ganhos ou acertos garantidos.
Considere o histórico apenas como contexto.

Use este formato:

ANÁLISE:
Uma explicação curta.

HISTÓRICO:
Uma frase sobre os feedbacks anteriores.

ORIENTAÇÃO:
Uma orientação recreativa e responsável.

Não utilize multiplicadores do Aviator nos jogos PG.
`;
    }

    const conteudo = await chamarOpenRouter(apiKey, [
      { role: "system", content: prompt },
      {
        role: "user",
        content: jogo === "Aviator"
          ? "Gere o alvo recreativo do Aviator."
          : `Faça a análise do módulo ${jogo}.`
      }
    ], maxTokens);

    if (jogo === "Aviator") {
      const correspondencia = conteudo.match(/\b\d{1,2}(?:[.,]\d{1,2})?\b/);
      const numero = correspondencia
        ? Number(correspondencia[0].replace(",", "."))
        : NaN;

      if (!Number.isFinite(numero) || numero < 1.70 || numero > 10.00) {
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
