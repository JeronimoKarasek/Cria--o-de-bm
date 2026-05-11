/**
 * Aplica as migrations SQL em supabase/migrations/ no banco Supabase.
 *
 * Estratégia segura:
 *  - Lê os .sql em ordem alfabética
 *  - Executa cada um em uma transação SEPARADA
 *  - Usa apenas CREATE ... IF NOT EXISTS / DO blocks já idempotentes
 *  - NUNCA chama DROP / TRUNCATE
 *
 * Uso:
 *   DIRECT_URL=postgresql://... node scripts/apply-supabase-migrations.js
 */
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { Client } = require('pg');

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Defina DIRECT_URL (ou DATABASE_URL) no ambiente.');
    process.exit(1);
  }

  const dir = path.resolve(process.cwd(), 'supabase/migrations');
  if (!fs.existsSync(dir)) {
    console.error('Diretório supabase/migrations não existe.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('Nenhuma migration encontrada.');
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf-8');
    const destructive = /\b(DROP\s+TABLE|TRUNCATE|DROP\s+SCHEMA)\b/i.test(sql);
    if (destructive) {
      console.error(`[skip] ${file} contém comandos destrutivos. Pulando por segurança.`);
      continue;
    }
    console.log(`[apply] ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[ok]    ${file}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[fail]  ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  await client.end();
})();
