import { TableSchema } from "../store/dbStore";

export function registerSchemaAutocomplete(monaco: any, tables: TableSchema[]) {
  // Unregister existing sql completion providers if any (to prevent duplicates)
  if (monaco.languages.registerCompletionItemProvider) {
    return monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [".", " ", "\n"],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const words = textUntilPosition.trim().split(/\s+/);
        const lastWord = words[words.length - 1]?.toUpperCase() || "";
        const prevWord = words[words.length - 2]?.toUpperCase() || "";

        const suggestions: any[] = [];

        // 1. Suggest tables after FROM, JOIN, UPDATE, INTO, TABLE
        const triggersTable = ["FROM", "JOIN", "UPDATE", "INTO", "TABLE", "DESCRIBE"];
        if (triggersTable.includes(lastWord) || triggersTable.includes(prevWord)) {
          tables.forEach((t) => {
            suggestions.push({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.Class,
              documentation: `Table with ${t.columns.length} columns`,
              insertText: t.name,
              range: undefined as any,
            });
          });
          return { suggestions };
        }

        // 2. Suggest columns if typing dot after table name (e.g. users.id)
        if (textUntilPosition.endsWith(".")) {
          const match = textUntilPosition.match(/([a-zA-Z0-9_]+)\.$/);
          if (match) {
            const tableName = match[1];
            const targetTable = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
            if (targetTable) {
              targetTable.columns.forEach((col) => {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  documentation: `${col.type} - PK: ${col.pk}, NOT NULL: ${col.notNull}`,
                  insertText: col.name,
                  range: undefined as any,
                });
              });
              return { suggestions };
            }
          }
        }

        // 3. Fallback: Suggest all keywords, tables and columns generally
        const keywords = [
          "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
          "ALTER", "TABLE", "INDEX", "FOREIGN", "KEY", "PRIMARY", "UNIQUE", "NOT",
          "NULL", "DEFAULT", "JOIN", "LEFT", "INNER", "RIGHT", "ON", "GROUP", "BY",
          "ORDER", "HAVING", "LIMIT", "OFFSET", "AND", "OR", "IN", "LIKE", "AS",
        ];

        keywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range: undefined as any,
          });
        });

        tables.forEach((t) => {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Class,
            documentation: `Table: ${t.name}`,
            insertText: t.name,
            range: undefined as any,
          });

          t.columns.forEach((col) => {
            suggestions.push({
              label: `${t.name}.${col.name}`,
              kind: monaco.languages.CompletionItemKind.Field,
              documentation: `Column: ${col.name} (${col.type})`,
              insertText: col.name,
              range: undefined as any,
            });
          });
        });

        return { suggestions };
      },
    });
  }
  return { dispose: () => {} };
}
