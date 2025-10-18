import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// DELETE /api/groups/[id]/expenses/[expenseId] - Delete a specific group expense
export async function DELETE(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is a member of this group
    const groupMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } }
    });

    if (!groupMember) {
      return NextResponse.json({ error: 'Access denied - not a group member' }, { status: 403 });
    }

    // Get the expense to verify it belongs to this group
    const expense = await prisma.expense.findFirst({
      where: { 
        id: expenseId,
        groupId: id 
      },
      include: { participants: true }
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found in this group' }, { status: 404 });
    }

    // Reverse the balance changes for all participants
    await Promise.all(expense.participants.map(async (participant) => {
      const balanceChange = Number(participant.paid) - Number(participant.share);
      await prisma.groupBalance.upsert({
        where: { groupId_userId: { groupId: id, userId: participant.userId } },
        update: { balance: { decrement: balanceChange } },
        create: { groupId: id, userId: participant.userId, balance: -balanceChange },
      });
    }));

    // Delete the expense (this will cascade delete participants)
    await prisma.expense.delete({
      where: { id: expenseId }
    });

    // Recalculate settlements after deletion
    const balances = await prisma.groupBalance.findMany({
      where: { groupId: id },
      select: { userId: true, balance: true },
    });

    // Remove previous settlements for this group
    await prisma.settlement.deleteMany({ where: { groupId: id } });

    // Prepare creditors and debtors
    const creditors = [];
    const debtors = [];
    for (const b of balances) {
      const bal = Number(b.balance);
      if (bal > 0.01) creditors.push({ ...b, balance: bal });
      else if (bal < -0.01) debtors.push({ ...b, balance: bal });
    }

    // Greedy debt minimization
    let i = 0, j = 0;
    const settlements = [];
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const debtorOwes = Math.abs(debtor.balance);
      const creditorOwed = creditor.balance;
      const amount = Math.min(debtorOwes, creditorOwed);
      
      if (amount > 0.01) {
        settlements.push({ 
          fromUserId: debtor.userId, 
          toUserId: creditor.userId, 
          groupId: id,
          amount: amount
        });
        debtor.balance += amount;
        creditor.balance -= amount;
      }
      
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    // Create new settlements
    if (settlements.length > 0) {
      await prisma.settlement.createMany({ data: settlements });
    }

    return NextResponse.json({ message: 'Group expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting group expense:', error);
    return NextResponse.json({ error: 'Failed to delete group expense', details: error }, { status: 500 });
  }
}