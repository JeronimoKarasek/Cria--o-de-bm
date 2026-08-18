export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/migrate-e1
 * One-shot additive migration for hybrid E1 (Hostinger fields + provision_jobs).
 * ADMIN only. Idempotent. No DROP/TRUNCATE.
 *
 * Optional header x-migrate-secret must match MIGRATE_E1_SECRET if that env is set.
 */
const SQL = `
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS published_url TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS hostinger_domain TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS deploy_provider TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS last_publish_error TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS dominio_strategy TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS parent_domain TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS hostinger_ref TEXT;
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS sites_status_idx ON public.sites_verificacao(status);
CREATE TABLE IF NOT EXISTS public.provision_jobs (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  payload       TEXT NOT NULL,
  result        TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 5,
  last_error    TEXT,
  empresa_id    TEXT,
  site_id       TEXT,
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provision_jobs_status_idx ON public.provision_jobs(status);
CREATE INDEX IF NOT EXISTS provision_jobs_type_idx ON public.provision_jobs(type);
CREATE INDEX IF NOT EXISTS provision_jobs_empresa_idx ON public.provision_jobs(empresa_id);
CREATE INDEX IF NOT EXISTS provision_jobs_site_idx ON public.provision_jobs(site_id);
CREATE INDEX IF NOT EXISTS provision_jobs_created_idx ON public.provision_jobs(created_at);
`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const secret = process.env.MIGRATE_E1_SECRET?.trim();
    if (secret) {
      const hdr = req.headers.get('x-migrate-secret') || '';
      if (hdr !== secret) {
        return NextResponse.json({ error: 'Secret inválido' }, { status: 403 });
      }
    }

    // Execute statement-by-statement for broader PG compatibility
    const statements = SQL.split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    const results: string[] = [];
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
      results.push(stmt.split('\n')[0].slice(0, 80));
    }

    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sites_verificacao'
        AND (
          column_name LIKE 'published%'
          OR column_name LIKE 'hostinger%'
          OR column_name LIKE 'deploy%'
          OR column_name LIKE 'last_publish%'
          OR column_name IN ('dominio_strategy', 'parent_domain')
        )
      ORDER BY 1
    `;

    const table = await prisma.$queryRaw<Array<{ t: string | null }>>`
      SELECT to_regclass('public.provision_jobs')::text AS t
    `;

    return NextResponse.json({
      ok: true,
      applied: results.length,
      columns: cols.map((c) => c.column_name),
      provision_jobs: table[0]?.t ?? null,
    });
  } catch (error: any) {
    console.error('migrate-e1 error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro na migration' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sites_verificacao'
        AND (
          column_name LIKE 'published%'
          OR column_name LIKE 'hostinger%'
          OR column_name LIKE 'deploy%'
          OR column_name LIKE 'last_publish%'
          OR column_name IN ('dominio_strategy', 'parent_domain')
        )
      ORDER BY 1
    `);

    const table = await prisma.$queryRaw<Array<{ t: string | null }>>(Prisma.sql`
      SELECT to_regclass('public.provision_jobs')::text AS t
    `);

    return NextResponse.json({
      ok: true,
      columns: cols.map((c) => c.column_name),
      provision_jobs: table[0]?.t ?? null,
      ready: cols.length >= 8 && Boolean(table[0]?.t),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}
