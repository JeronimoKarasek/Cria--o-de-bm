export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { registrarAuditLog } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 });

    const body = await request.json();
    const { tipo, nome, cloudStoragePath, isPublic } = body ?? {};

    if (!tipo || !nome || !cloudStoragePath) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const doc = await prisma.documento.create({
      data: {
        tipo,
        nome,
        cloudStoragePath,
        isPublic: isPublic ?? false,
        empresaId: params?.id,
      },
    });

    await registrarAuditLog({
      acao: 'UPLOAD',
      descricao: `Documento ${nome} enviado`,
      entidade: 'Documento',
      entidadeId: doc?.id,
      userId: (session?.user as any)?.id,
      empresaId: params?.id,
    });

    return NextResponse.json({
      ...(doc ?? {}),
      createdAt: doc?.createdAt?.toISOString?.() ?? '',
      updatedAt: doc?.updatedAt?.toISOString?.() ?? '',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Upload doc error:', error);
    return NextResponse.json({ error: 'Erro ao salvar documento' }, { status: 500 });
  }
}
