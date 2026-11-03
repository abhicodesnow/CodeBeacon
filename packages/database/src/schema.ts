import { pgTable, uuid, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface FunctionHotspotRow {
  name: string;
  cyclomatic_complexity: number;
  nloc: number;
  tokens: number;
  params: number;
  start_line: number;
  end_line: number;
}

export interface DiagnosticRow {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface RiskBreakdownRow {
  cyclomatic_complexity: number;
  nesting_depth: number;
  static_hazards: number;
  code_volume: number;
}

export const snippets = pgTable("snippets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  code: text("code").notNull(),
  language: text("language").notNull(),
  bugProbability: integer("bug_probability").notNull(),
  maintainabilityIndex: real("maintainability_index"),
  cyclomaticComplexity: integer("cyclomatic_complexity"),
  timeComplexity: text("time_complexity"),
  spaceComplexity: text("space_complexity"),
  warnings: jsonb("warnings").$type<string[]>(),
  functions: jsonb("functions").$type<FunctionHotspotRow[]>(),
  diagnostics: jsonb("diagnostics").$type<DiagnosticRow[]>(),
  riskBreakdown: jsonb("risk_breakdown").$type<RiskBreakdownRow>(),
  aiReview: text("ai_review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});