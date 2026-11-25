
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const GAMES = ["Tigre", "Touro", "Midas", "Aviator"];

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
    const { jogo, feedback } = req.body || {};

    if (!GAMES.includes(jogo)) {
      return res.status(400).json({ error: "Jogo inválido." });
    }

    const historico = Array.isArray(feedback)
      ? feedback.slice(0, 20).map(item => ({
          resultado: item.outcome,
          multiplicador: item.multiplier || null
        }))
      : [];

    let prompt;
    let maxTokens = 180;

    if (jogo === "Aviator") {
      prompt = `
Você gera um alvo recreativo para o jogo Aviator.

Escolha um número decimal entre 1.70 e 10.00.
O número deve ter duas casas decimais.

Considere o histórico abaixo apenas como contexto.
Ele não permite prever rodadas futuras.

HISTÓRICO:
${JSON.stringify(historico)}

IMPORTANTE:
- Não afirme que o número é uma previsão.
- Não afirme que o multiplicador será atingido.
- Não use números abaixo de 1.70 ou acima de 10.00.
- Não escreva explicações longas.

Responda SOMENTE com um número, por exemplo:
2.45
`;
      maxTokens = 20;
    } else {
      prompt = `
Você é a IA de análise do painel JN 01 VIP.

JOGO: ${jogo}

HISTÓRICO DE FEEDBACK:
${JSON.stringify(historico)}

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
            { role: "system", content: prompt },
            {
              role: "user",
              content: jogo === "Aviator"
                ? "Gere o alvo recreativo do Aviator."
                : `Faça a análise do módulo ${jogo}.`
            }
          ],
          temperature: 0.5,
          max_tokens: maxTokens
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

    const conteudo = data.choices?.[0]?.message?.content?.trim();

    if (!conteudo) {
      return res.status(502).json({
        error: "A IA não retornou uma resposta."
      });
    }

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

      const multiplicador = `${numero.toFixed(2)}x`;

      return res.status(200).json({
        sucesso: true,
        jogo,
        multiplicador,
        analise: "Alvo recreativo gerado pela IA. Não representa previsão de rodada."
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
      error: "Erro interno da inteligência artificial."
    });
  }
}
