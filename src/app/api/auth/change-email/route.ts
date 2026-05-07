import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, newEmail } = await request.json();

    if (!userId || !newEmail) {
      return NextResponse.json(
        { error: "Missing userId or newEmail" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    const apiKey = process.env.INSFORGE_API_KEY;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const sanitizedEmail = newEmail.toLowerCase().trim();

    // Check if email is already taken
    const checkRes = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "SELECT id FROM auth.users WHERE email = $1 AND id != $2",
        params: [sanitizedEmail, userId],
      }),
    });

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.rows && checkData.rows.length > 0) {
        return NextResponse.json(
          { error: "This email is already in use" },
          { status: 409 }
        );
      }
    }

    // Update email in auth.users
    const updateRes = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2",
        params: [sanitizedEmail, userId],
      }),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json().catch(() => ({}));
      console.error("Email update failed:", updateRes.status, errorData);
      return NextResponse.json(
        { error: "Failed to update email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change email error:", error);
    return NextResponse.json(
      { error: "Failed to change email" },
      { status: 500 }
    );
  }
}
