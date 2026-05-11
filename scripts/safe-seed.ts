/**
 * Seed seguro — somente cria usuário admin inicial se não existir.
 * NUNCA executa delete/deleteMany. Verificação automática antes de rodar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const seedFile = path.resolve(process.cwd(), 'scripts/seed.ts');

if (fs.existsSync(seedFile)) {
  const content = fs.readFileSync(seedFile, 'utf-8');
  const forbidden = [
    /prisma\.\w+\.delete\(/,
    /prisma\.\w+\.deleteMany\(/,
    /DROP\s+TABLE/i,
    /TRUNCATE/i,
  ];
  const violations = forbidden.filter((rx) => rx.test(content));
  if (violations.length > 0) {
    console.error('[safe-seed] Seed abortado: scripts/seed.ts contém operações destrutivas.');
    console.error('[safe-seed] Remova delete/deleteMany/DROP/TRUNCATE antes de rodar.');
    process.exit(1);
  }
  execSync('tsx --require dotenv/config scripts/seed.ts', { stdio: 'inherit' });
} else {
  console.log('[safe-seed] scripts/seed.ts não encontrado — pulando.');
}
