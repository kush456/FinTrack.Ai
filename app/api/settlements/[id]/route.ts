import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/settlements/[id] - mark as paid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const updated = await prisma.settlement.update({
      where: { id },
      data: { status: 'PAID' },
    });
    return NextResponse.json({ settlement: updated });
  } catch (error) {
    console.error('Error updating settlement:', error);
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
