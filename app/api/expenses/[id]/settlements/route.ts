import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/expenses/[id]/settlements
export async function GET(request: Request, {params}: {params: Promise<{ id: string }>}) {
  const expenseId = (await params).id;
  try {
    // For one-off expenses, settlements are linked by expense participants and not groupId
    // We'll assume you have a way to relate settlements to an expense (e.g., via groupId=null and participants)
    // If you store settlements with an expenseId, adjust the query accordingly
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: true },
    });
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    let settlements;
    if (expense.groupId) {
      // If this expense is part of a group, fetch group settlements
      settlements = await prisma.settlement.findMany({
        where: { groupId: expense.groupId },
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
          toUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // For one-off, fetch settlements where groupId is null
      settlements = await prisma.settlement.findMany({
        where: { groupId: null },
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
          toUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    return NextResponse.json({ settlements });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}
