const MODEL = "gemini-3.6-flash";

const SYSTEM_INSTRUCTION = `
Eres BioVolt Assistant, el asistente virtual de BioVolt, un proyecto académico colombiano de gestión sostenible que aprovecha residuos orgánicos y agrícolas para producir energía.

Responde siempre en español claro, amable y directo.
Ayuda con biomasa, plantas, inventario, producción, clientes, proveedores, impacto ambiental y soporte.

No tienes conexión a la base de datos MySQL ni acceso en tiempo real a los registros internos.
No inventes cifras, estados, nombres ni resultados operativos.
Aclara que los indicadores de la página son datos de demostración.
Nunca afirmes haber ejecutado acciones ni modificado registros.
`;

export const config = { path: "/api/chat" };

export default async (request) => {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  const respond = (status, data) =>
    new Response(JSON.stringify(data), { status, headers });

  if (request.method !== "POST") {
    return respond(405, { error: "Método no permitido." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return respond(500, { error: "No se encuentra GEMINI_API_KEY en Netlify." });
  }

  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) return respond(400, { error: "Escribe una pregunta." });
    if (message.length > 4000) {
      return respond(400, { error: "La pregunta es demasiado larga." });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

    const contents = history
      .filter(
        (item) =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.trim()
      )
      .map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content.slice(0, 4000) }],
      }));

    const last = contents[contents.length - 1];
    if (!last || last.role !== "user" || last.parts[0].text.trim() !== message) {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    while (contents.length && contents[0].role !== "user") contents.shift();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        result?.error?.message || `Error de Gemini: ${response.status}`;
      console.error("Error de Gemini:", response.status, detail);
      return respond(502, { error: detail, geminiStatus: response.status });
    }

    const reply = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Respuesta vacía de Gemini:", JSON.stringify(result));
      return respond(502, { error: "Gemini no devolvió una respuesta." });
    }

    return respond(200, { reply });
  } catch (error) {
    console.error("Error en BioVolt Assistant:", error);
    return respond(500, { error: error.message || "Error interno del asistente." });
  }
};
