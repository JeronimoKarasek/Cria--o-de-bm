/**
 * Seed inicial — cria SOMENTE o admin padrão se não existir.
 * Nunca deleta ou trunca tabelas. Idempotente.
 *
 * Uso: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@criacaodebm.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@2026';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administrador';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`[seed] Usuário admin já existe: ${adminEmail}`);
    return;
  }

  const hash = await bcrypt.hash(adminPass, 12);
  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hash,
      name: adminName,
      role: 'ADMIN',
    },
  });

  console.log(`[seed] Admin criado: ${user.email}`);
  console.log(`[seed] Senha temporária: ${adminPass}`);
  console.log('[seed] IMPORTANTE: troque a senha após o primeiro login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
