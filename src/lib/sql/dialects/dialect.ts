import { SchemaModel } from "../../schema/parser";
import { SchemaDiff } from "../../diff/schemaDiff";

export interface ValidationProblem {
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

export interface SqlDialect {
  id: string;
  name: string;
  parse: (sql: string) => Promise<SchemaModel>;
  generateDDL: (diff: SchemaDiff) => string[];
}
