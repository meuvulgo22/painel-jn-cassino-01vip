
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
      error: error.message
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
      ? feedback.slice(0, 20).map(item => ({
          resultado: item.outcome
        }))
      : [];

    const formato = jogo === "Aviator"
      ? "Use exclusivamente o formato de multiplicadores do Aviator. Nunca misture números ou estruturas dos jogos PG."
      : `Use exclusivamente o formato próprio do jogo PG ${jogo}. Não utilize o formato de multiplicadores do Aviator.`;

    const prompt = `
Você é a inteligência artificial do JN 01 VIP.

JOGO: ${jogo}

REGRA DE FORMATO:
${formato}

Sua tarefa é produzir uma análise textual responsável.

Não utilize números aleatórios como se fossem resultados.
Não invente histórico real.
Não afirme conhecer o próximo resultado.
Não prometa ganhos ou acertos garantidos.

Considere os feedbacks anteriores deste jogo:
${JSON.stringify(historico)}

Use os feedbacks para contextualizar suas próximas análises,
mas não trate acertos anteriores como prova de previsibilidade.

Explique suas limitações e apresente uma sugestão recreativa,
sem garantir que ela funcionará.

Responda em português brasileiro.
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
              content: `Faça uma análise para ${jogo}.`
            }
          ],
          temperature: 0.5,
          max_tokens: 400
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(502).json({
        error: "Erro ao consultar a OpenRouter."
      });
    }

    const analise = data.choices?.[0]?.message?.content;

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
    console.error(error);

    return res.status(500).json({
      error: "Erro interno da inteligência artificial."
    });
  }
}
