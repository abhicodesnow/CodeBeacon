'use server';

import { db } from '@codeBeacon/database';
import { snippets } from '@codeBeacon/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { createClient } from '../../utils/supabase/server';

export async function saveSnippetAnalysis(data: {
  title: string;
  code: string;
  language: string;
  bugProbability: number;
  maintainabilityIndex?: number;
  cyclomaticComplexity?: number;
  timeComplexity?: string;
  spaceComplexity?: string;
  warnings?: string[];
  aiReview?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized: You must be logged in.");

  await db.insert(snippets).values({
    userId: user.id,
    title: data.title,
    code: data.code,
    language: data.language,
    bugProbability: Math.round(data.bugProbability),
    maintainabilityIndex: data.maintainabilityIndex ?? null,
    cyclomaticComplexity: data.cyclomaticComplexity ?? null,
    timeComplexity: data.timeComplexity ?? null,
    spaceComplexity: data.spaceComplexity ?? null,
    warnings: data.warnings ?? [],
    aiReview: data.aiReview ?? null,
  });
}

export async function getSnippetHistory() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const userSnippets = await db.select()
    .from(snippets)
    .where(eq(snippets.userId, user.id))
    .orderBy(desc(snippets.createdAt));

  return userSnippets;
}

export async function deleteSnippet(snippetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized: You must be logged in.");

  await db.delete(snippets).where(
    and(
      eq(snippets.id, snippetId),
      eq(snippets.userId, user.id)
    )
  );
}