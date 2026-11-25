import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "painel-anac-gb";
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const GAMES = ["Tigre", "Touro", "Midas", "Aviator"];

async function authenticate(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Faça login para utilizar a IA.");
  const token = authorization.slice(7);
  const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID
  });
  return payload.sub;
}

function validarPG(jogo, objeto) {
  const esperado = jogo === "Midas" ? ["TURBO", "NORMAL"] : ["TURBO", "NORMAL", "TURBO"];
  if (!objeto || !Array.isArray(objeto.itens) || objeto.itens.length !== esperado.length) return false;
  return objeto.itens.every((item, index) => {
    if (item.tipo !== esperado[index] || !Number.isInteger(item.valor)) return false;
    const minimo = item.tipo === "TURBO" ? 2 : 5;
    const maximo = item.tipo === "TURBO" ? 5 : 12;
    return item.valor >= minimo && item.valor <= maximo;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Utilize POST." });
  try { await authenticate(req); }
  catch (error) { return res.status(401).json({ error: error.message || "Autenticação inválida." }); }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Chave OpenRouter não configurada." });

  try {
    const { jogo, feedback } = req.body || {};
    if (!GAMES.includes(jogo)) return res.status(400).json({ error: "Jogo inválido." });

    const historico = Array.isArray(feedback) ? feedback.slice(0, 20).map((item) => ({
      feedback: item.outcome,
      sugestaoAnterior: typeof item.suggestion === "string" ? item.suggestion.slice(0, 100) : ""
    })) : [];

    let instrucao;
    if (jogo === "Aviator") {
      instrucao = `Retorne SOMENTE JSON válido no formato {"multiplicador": 2.45}. Escolha um número decimal com duas casas entre 1.70 e 10.00. Não inclua x no valor. Não use formato de jogos PG.`;
    } else {
      const formato = jogo === "Midas"
        ? '[{"tipo":"TURBO","valor":3},{"tipo":"NORMAL","valor":8}]'
        : '[{"tipo":"TURBO","valor":3},{"tipo":"NORMAL","valor":8},{"tipo":"TURBO","valor":4}]';
      instrucao = `Retorne SOMENTE JSON válido no formato {"itens":${formato}}. Para ${jogo}, a ordem deve ser ${jogo === "Midas" ? "TURBO, NORMAL" : "TURBO, NORMAL, TURBO"}. TURBO deve ser inteiro de 2 a 5. NORMAL deve ser inteiro de 5 a 12. Não retorne texto, explicações ou formato Aviator.`;
    }

    const prompt = `Você gera sugestões recreativas para uma interface. Os resultados de jogos são aleatórios e você não consegue prever rodadas nem garantir acertos. Use o histórico apenas como contexto para variar suas sugestões, nunca como prova de previsibilidade. Jogo: ${jogo}. Feedback anterior deste mesmo jogo: ${JSON.stringify(historico)}. ${instrucao}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          { role: "user", content: `Gere uma sugestão estruturada para ${jogo}.` }
        ],
        temperature: 0.7,
        max_tokens: 180,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(502).json({ error: "Erro ao consultar a OpenRouter." });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: "A IA não retornou uma sugestão." });

    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return res.status(502).json({ error: "A IA retornou um formato inválido. Tente novamente." }); }

    if (jogo === "Aviator") {
      const numero = Number(parsed.multiplicador);
      if (!Number.isFinite(numero) || numero < 1.7 || numero > 10) {
        return res.status(502).json({ error: "A IA retornou um multiplicador fora do intervalo." });
      }
      return res.status(200).json({ sucesso: true, jogo, multiplicador: numero.toFixed(2) });
    }

    if (!validarPG(jogo, parsed)) return res.status(502).json({ error: "A IA retornou uma combinação fora do formato esperado. Tente novamente." });
    return res.status(200).json({ sucesso: true, jogo, itens: parsed.itens });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno da inteligência artificial." });
  }
}
