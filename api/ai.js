
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

const GAMES = ["Tigre", "Touro", "Midas", "Aviator"];

async function authenticate(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw new Error("Faça login para utilizar a IA.");
  }

  const token = authorization.slice(7);

  const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID
  });

  return payload.sub;
}

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
    const { jogo, feedback } = req.body || {};

    if (!GAMES.includes(jogo)) {
      return res.status(400).json({
        error: "Jogo inválido."
      });
    }

    const historico = Array.isArray(feedback)
      ? feedback
          .filter(item =>
            item &&
            ["Deu certo", "Não deu certo"].includes(item.outcome)
          )
          .slice(0, 20)
          .map(item => item.outcome)
      : [];

    const quantidadeAcertos = historico.filter(
      item => item === "Deu certo"
    ).length;

    const quantidadeFalhas = historico.filter(
      item => item === "Não deu certo"
    ).length;

    const formato = jogo === "Aviator"
      ? `
FORMATO AVIATOR:
- Trate exclusivamente de multiplicadores (exemplo: 1.50x).
- Nunca use números, turbo ou normal dos jogos PG.
- Não invente um multiplicador futuro.
`
      : `
FORMATO PG:
- Analise exclusivamente o módulo ${jogo}.
- Não utilize multiplicadores com x.
- Não misture informações do Aviator.
- Não invente números ou resultados futuros.
`;

    const prompt = `
Você é a IA de análise do painel JN 01 VIP.

JOGO: ${jogo}

${formato}

HISTÓRICO DE FEEDBACK:
Total de avaliações: ${historico.length}
Avaliações positivas: ${quantidadeAcertos}
Avaliações negativas: ${quantidadeFalhas}

REGRAS:
1. Responda em português brasileiro.
2. Seja extremamente objetiva.
3. Não escreva introduções longas.
4. Não explique as regras do jogo.
5. Não invente resultados, padrões ou dados.
6. Não diga que consegue prever rodadas aleatórias.
7. Considere o feedback anterior apenas como contexto.
8. Não prometa ganhos ou acertos.

FORMATO OBRIGATÓRIO DA RESPOSTA:

ANÁLISE:
Uma explicação curta, com no máximo duas frases.

HISTÓRICO:
Uma frase curta sobre os feedbacks disponíveis.

ORIENTAÇÃO:
Uma orientação recreativa e responsável, sem apresentar
resultados inventados como previsões.

Tamanho máximo: 100 palavras.
`;

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
          messages: [
            {
              role: "system",
              content: prompt
            },
            {
              role: "user",
              content: `Gere a análise objetiva do módulo ${jogo}.`
            }
          ],
          temperature: 0.2,
          max_tokens: 180
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro OpenRouter:", data);

      return res.status(502).json({
        error: "Erro ao consultar a inteligência artificial."
      });
    }

    const analise = data.choices?.[0]?.message?.content?.trim();

    if (!analise) {
      return res.status(502).json({
        error: "A IA não retornou uma análise."
      });
    }

    return res.status(200).json({
      sucesso: true,
      jogo,
      analise
    });

  } catch (error) {
    console.error("Erro interno:", error);

    return res.status(500).json({
      error: "Erro interno da inteligência artificial."
    });
  }
}
