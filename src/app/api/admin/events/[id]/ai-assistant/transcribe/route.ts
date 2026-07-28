import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireEventAccess("EVENT_VIEW", id);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    }

    const input = await req.formData();
    const audio = input.get("audio");
    const language = String(input.get("language") || "").slice(0, 2);

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio recording is missing" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio recording is too large" }, { status: 413 });
    }
    if (audio.type && !SUPPORTED_TYPES.has(audio.type.split(";")[0])) {
      return NextResponse.json({ error: "Unsupported audio format" }, { status: 415 });
    }

    const body = new FormData();
    body.append("file", audio, audio.name || "atlas-voice.webm");
    body.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    body.append("response_format", "json");
    if (["ru", "he", "en"].includes(language)) body.append("language", language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body,
    });
    const payload = await response.json() as { text?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || "Voice transcription failed");

    const text = payload.text?.trim();
    if (!text) throw new Error("No speech was recognized");
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice transcription failed" }, { status: 400 });
  }
}
