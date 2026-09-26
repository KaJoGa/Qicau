import { generateTransactionContent, textParts } from "../../shared/gemini";

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { textInput } = (await request.json().catch(() => ({}))) as { textInput?: string };
    if (!textInput) {
      return Response.json({ error: "Missing text input" }, { status: 400 });
    }
    if (!env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY is missing. Please set it in Cloudflare Pages > Settings > Variables and Secrets." }, { status: 500 });
    }

    const result = await generateTransactionContent(env.GEMINI_API_KEY, textParts(textInput));
    return Response.json({ result });
  } catch (e: any) {
    console.error(e);
    return Response.json({ error: e.message || "Failed to process text" }, { status: 500 });
  }
};
