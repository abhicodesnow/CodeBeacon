import { pgTable, uuid, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  aiReview: text("ai_review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});