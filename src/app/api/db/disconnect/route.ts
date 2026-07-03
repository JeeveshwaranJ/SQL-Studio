import { NextResponse } from "next/server";
import { removePool } from "../manager";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter." }, { status: 400 });
    }

    const removed = removePool(sessionId);
    return NextResponse.json({ success: removed });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Disconnect failed: ${err.message || err}` },
      { status: 500 }
    );
  }
}
