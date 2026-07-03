import { NextResponse } from "next/server";
import { HuggingFaceService } from "../../../lib/ai/huggingFaceService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history = [], systemPrompt = "", context = "" } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Missing required parameter: message" },
        { status: 400 }
      );
    }

    // Load configurations from environment variables
    const spaceId = process.env.HF_SPACE_ID || "jeeves111/my-ai-chatbot";
    const defaultSystemPrompt = process.env.HF_SYSTEM_PROMPT || systemPrompt || "You are a helpful AI assistant.";
    const timeoutMs = Number(process.env.HF_TIMEOUT) || 30000;

    // Connect and execute model prediction
    const reply = await HuggingFaceService.chat({
      spaceId,
      message,
      history,
      systemPrompt: defaultSystemPrompt,
      context,
      timeoutMs,
    });

    return NextResponse.json({ response: reply });
  } catch (err: any) {
    console.error("[Chat API Route Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process chat with Hugging Face Space model" },
      { status: 500 }
    );
  }
}
