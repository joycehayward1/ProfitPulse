import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const client = getInsForgeAdmin();

    const { error } = await client.auth.sendResetPasswordEmail({
      email,
    });

    if (error) {
      console.error("Send reset password email error:", error);
      // Don't reveal if email exists or not
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 }
    );
  }
}
