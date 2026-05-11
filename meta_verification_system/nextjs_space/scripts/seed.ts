import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create only authentication users - no fictitious data
  const adminPassword = await bcrypt.hash('johndoe123', 12);

  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Admin Sistema',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@metaverify.com' },
    update: {},
    create: {
      email: 'admin@metaverify.com',
      name: 'Administrador',
      password: await bcrypt.hash('Admin@123', 12),
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'maria@metaverify.com' },
    update: {},
    create: {
      email: 'maria@metaverify.com',
      name: 'Maria Silva',
      password: await bcrypt.hash('Func@123', 12),
      role: 'FUNCIONARIO',
    },
  });

  console.log('Seed concluído - Apenas usuários de autenticação criados.');
  console.log('Para importar dados reais, use Integração Meta > Importar Dados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
