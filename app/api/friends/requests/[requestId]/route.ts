import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/configs/auth/authOptions";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const { action } = await req.json(); // "ACCEPT" or "REJECT"

    if (!["ACCEPT", "REJECT"].includes(action)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const request = await prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== session.user.id) {
      return NextResponse.json({ error: "Friend request not found or you are not the receiver" }, { status: 404 });
    }

    if (action === "ACCEPT") {
      const updatedRequest = await prisma.friendship.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });
      return NextResponse.json({ message: "Friend request accepted", friendship: updatedRequest });
    } else { // REJECT
      await prisma.friendship.delete({
        where: { id: requestId },
      });
      return NextResponse.json({ message: "Friend request rejected" });
    }
  } catch (error) {
    console.error("Error responding to friend request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
