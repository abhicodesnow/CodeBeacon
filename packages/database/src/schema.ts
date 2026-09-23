import { pgTable, text, timestamp, uuid, real } from 'drizzle-orm/pg-core';

export const snippets = pgTable('snippets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(), // This maps to Supabase's auth.users.id
  title: text('title').notNull(),
  code: text('code').notNull(),
  language: text('language').notNull(),
  bugProbability: real('bug_probability').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});