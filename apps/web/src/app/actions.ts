'use server';

import { db } from '@codeBeacon/database';
import {
  snippets,
  type FunctionHotspotRow,
  type DiagnosticRow,
  type RiskBreakdownRow,
} from '@codeBeacon/database/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { createClient } from '../../utils/supabase/server';

let schemaSynced = false;

async function ensureForensicsColumns() {
  if (schemaSynced) return;
  try {
    await db.execute(sql`
      ALTER TABLE snippets
      ADD COLUMN IF NOT EXISTS maintainability_index real,
      ADD COLUMN IF NOT EXISTS cyclomatic_complexity integer,
      ADD COLUMN IF NOT EXISTS time_complexity text,
      ADD COLUMN IF NOT EXISTS space_complexity text,
      ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS functions jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS diagnostics jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS risk_breakdown jsonb,
      ADD COLUMN IF NOT EXISTS ai_review text;
    `);
    schemaSynced = true;
  } catch (err) {
    console.warn('[CodeBeacon DB] Auto-migration warning:', err);
  }
}

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
  functions?: FunctionHotspotRow[];
  diagnostics?: DiagnosticRow[];
  riskBreakdown?: RiskBreakdownRow;
  aiReview?: string;
}) {
  try {
    await ensureForensicsColumns();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: 'Unauthorized', id: null };

    const [inserted] = await db
      .insert(snippets)
      .values({
        userId: user.id,
        title: data.title,
        code: data.code,
        language: data.language,
        bugProbability: Math.round(Number(data.bugProbability) || 0),
        maintainabilityIndex: data.maintainabilityIndex ?? null,
        cyclomaticComplexity: data.cyclomaticComplexity ?? null,
        timeComplexity: data.timeComplexity ?? null,
        spaceComplexity: data.spaceComplexity ?? null,
        warnings: data.warnings ?? [],
        functions: data.functions ?? [],
        diagnostics: data.diagnostics ?? [],
        riskBreakdown: data.riskBreakdown ?? null,
        aiReview: data.aiReview ?? null,
      })
      .returning({ id: snippets.id });

    return { ok: true, id: inserted?.id ?? null };
  } catch (err) {
    console.error('[CodeBeacon DB] saveSnippetAnalysis error:', err);
    return { ok: false, id: null };
  }
}

export async function getSnippetHistory() {
  try {
    await ensureForensicsColumns();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const userSnippets = await db
      .select()
      .from(snippets)
      .where(eq(snippets.userId, user.id))
      .orderBy(desc(snippets.createdAt));

    return userSnippets;
  } catch (err) {
    console.error('[CodeBeacon DB] getSnippetHistory error:', err);
    return [];
  }
}

export async function getSnippetById(snippetId: string) {
  try {
    await ensureForensicsColumns();
    const rows = await db
      .select()
      .from(snippets)
      .where(eq(snippets.id, snippetId))
      .limit(1);

    return rows[0] ?? null;
  } catch (err) {
    console.error('[CodeBeacon DB] getSnippetById error:', err);
    return null;
  }
}

export async function deleteSnippet(snippetId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { ok: false };

    await db.delete(snippets).where(
      and(
        eq(snippets.id, snippetId),
        eq(snippets.userId, user.id)
      )
    );
    return { ok: true };
  } catch (err) {
    console.error('[CodeBeacon DB] deleteSnippet error:', err);
    return { ok: false };
  }
}