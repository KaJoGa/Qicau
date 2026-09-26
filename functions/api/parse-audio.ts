import { audioParts, generateTransactionContent } from "../../shared/gemini";

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { audioBase64, mimeType } = (await request.json().catch(() => ({}))) as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      return Response.json({ error: "Missing audio" }, { status: 400 });
    }
    if (!env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY is missing. Please set it in Cloudflare Pages > Settings > Variables and Secrets." }, { status: 500 });
    }

    const result = await generateTransactionContent(env.GEMINI_API_KEY, audioParts(audioBase64, mimeType));
    return Response.json({ result });
  } catch (e: any) {
    console.error(e);
    return Response.json({ error: e.message || "Failed to process audio" }, { status: 500 });
  }
};
