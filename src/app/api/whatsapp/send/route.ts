import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: Request) {
  try {
    return NextResponse.json(
      {
        error:
          "WhatsApp sending is disabled in this project (Twilio integration removed).",
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("Error in /api/whatsapp/send (integration disabled)", error);
    return NextResponse.json(
      { error: "Failed to handle WhatsApp send request" },
      { status: 500 },
    );
  }
}
