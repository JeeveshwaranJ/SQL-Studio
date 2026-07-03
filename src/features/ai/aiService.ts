export class AiService {
  private static async callHF(
    prompt: string,
    systemPrompt: string
  ): Promise<string> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        systemPrompt,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error || `Hugging Face API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response || "";
  }

  static async generateSql(prompt: string, schemaSummary: string): Promise<string> {
    const systemPrompt = `You are a professional database developer. Generate ONLY valid SQL queries based on the database schema provided.
Do not wrap the SQL query in markdown blocks (e.g. \`\`\`sql) - return raw SQL code directly.
Schema:
${schemaSummary}`;

    const userPrompt = `Generate a SQL query for: "${prompt}"`;

    const rawResponse = await this.callHF(userPrompt, systemPrompt);
      
    // Try to extract content inside markdown code blocks
    const codeBlockMatch = rawResponse.match(/```sql([\s\S]*?)```/i) || rawResponse.match(/```([\s\S]*?)```/i);
    let sql = codeBlockMatch ? codeBlockMatch[1] : rawResponse;

    return sql.replace(/```/g, "").trim();
  }

  static async explainSql(
    sql: string,
    schemaSummary: string
  ): Promise<{ explanation: string; tables: string[]; performance: string }> {
    const systemPrompt = `You are a database engine compiler. Explain the provided SQL query step by step.
You must output a valid JSON block containing:
- "explanation": a concise description of what the query accomplishes.
- "tables": a JSON array of database tables referenced.
- "performance": analysis of index usage and query planning.

Return ONLY raw JSON. Do not include markdown codeblocks.`;

    const userPrompt = `Query:
${sql}
 
Active Schema:
${schemaSummary}`;

    const rawResponse = await this.callHF(userPrompt, systemPrompt);

    try {
      const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch {
      return {
        explanation: rawResponse,
        tables: [],
        performance: "Could not generate structured performance metrics.",
      };
    }
  }

  static async optimizeSql(
    sql: string,
    schemaSummary: string
  ): Promise<{ sql: string; suggestions: string[]; indexes: string[] }> {
    const systemPrompt = `You are a senior database administrator. Optimize the given SQL query.
You must output a valid JSON block containing:
- "sql": the optimized query.
- "suggestions": array of text hints detailing what changes were made.
- "indexes": array of CREATE INDEX statements to run for faster execution.

Return ONLY raw JSON. Do not include markdown codeblocks.`;

    const userPrompt = `Query:
${sql}

Schema:
${schemaSummary}`;

    const rawResponse = await this.callHF(userPrompt, systemPrompt);

    try {
      const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch {
      return {
        sql,
        suggestions: [rawResponse],
        indexes: [],
      };
    }
  }
}
