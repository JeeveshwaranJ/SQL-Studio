import { Client } from "@gradio/client";

// Global cache to prevent reconnecting to HF on every request
let clientInstance: any = null;
let currentSpaceId = "";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class HuggingFaceService {
  private static async getClient(spaceId: string): Promise<any> {
    if (clientInstance && currentSpaceId === spaceId) {
      return clientInstance;
    }

    try {
      const hfToken = process.env.HF_TOKEN || "";
      const connectOptions = hfToken ? { token: hfToken as `hf_${string}` } : {};
      
      // Establish long-lived connection to Hugging Face Space
      clientInstance = await Client.connect(spaceId, connectOptions);
      currentSpaceId = spaceId;
      return clientInstance;
    } catch (err: any) {
      console.error(`Failed to connect to Hugging Face Space ${spaceId}:`, err);
      throw new Error(`Hugging Face Connection Error: ${err.message || String(err)}`);
    }
  }

  /**
   * Sends a message to the Hugging Face Space model.
   * Supports custom system prompts, conversation history list, and knowledge contexts for RAG.
   */
  static async chat(options: {
    spaceId: string;
    message: string;
    history?: ChatMessage[];
    systemPrompt?: string;
    context?: string;
    timeoutMs?: number;
  }): Promise<string> {
    const {
      spaceId,
      message,
      history = [],
      systemPrompt = "You are a helpful database developer and coding assistant.",
      context = "",
      timeoutMs = 30000,
    } = options;

    // Build the query, appending website context / RAG documents if available
    let finalPrompt = message;
    if (context) {
      finalPrompt = `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: ${message}`;
    }

    // Connect to model
    const client = await this.getClient(spaceId);

    // Call prediction using the correct endpoint schema for /respond
    const predictionPromise = client.predict("/respond", [
      finalPrompt,       // message
      undefined,         // state
      systemPrompt,      // system_message
      512,               // max_tokens
      0.7,               // temperature
      0.95               // top_p
    ]);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Hugging Face API Request timed out")), timeoutMs);
    });

    try {
      const result = await Promise.race([predictionPromise, timeoutPromise]);
      // Parse Gradio return data format
      if (result && result.data && Array.isArray(result.data)) {
        return String(result.data[0]);
      }
      return String(result);
    } catch (err: any) {
      console.error("Hugging Face model execution failed:", err);
      throw err;
    }
  }
}
