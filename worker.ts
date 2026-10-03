import { audioParts, generateTransactionContent, textParts } from "./shared/gemini";
import { normalizeParsedResult } from "./shared/parsed";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  GEMINI_API_KEY?: string;
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function handleParseAudio(request: Request, env: Env): Promise<Response> {
  try {
    const { audioBase64, mimeType } = (await request.json().catch(() => ({}))) as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!audioBase64) {
      return jsonError("Missing audio", 400);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonError("GEMINI_API_KEY is missing. Set it in the Worker Variables and Secrets.", 500);
    }

    const result = normalizeParsedResult(
      await generateTransactionContent(env.GEMINI_API_KEY, audioParts(audioBase64, mimeType)),
    );
    return Response.json({ result });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Failed to process audio", 500);
  }
}

async function handleParseText(request: Request, env: Env): Promise<Response> {
  try {
    const { textInput } = (await request.json().catch(() => ({}))) as {
      textInput?: string;
    };

    if (!textInput) {
      return jsonError("Missing text input", 400);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonError("GEMINI_API_KEY is missing. Set it in the Worker Variables and Secrets.", 500);
    }

    const result = normalizeParsedResult(
      await generateTransactionContent(env.GEMINI_API_KEY, textParts(textInput)),
      textInput,
    );
    return Response.json({ result });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Failed to process text", 500);
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/parse-audio") {
      if (request.method !== "POST") {
        return jsonError("Method Not Allowed", 405);
      }
      return handleParseAudio(request, env);
    }

    if (url.pathname === "/api/parse-text") {
      if (request.method !== "POST") {
        return jsonError("Method Not Allowed", 405);
      }
      return handleParseText(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
