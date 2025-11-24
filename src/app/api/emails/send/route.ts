import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { to, subject, html, fromUserEmail, emailId } = (await request.json()) as {
      to?: string;
      subject?: string;
      html?: string;
      fromUserEmail?: string | null;
      emailId?: string | null;
    };

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const trimmedTo = to.trim();
    const trimmedSubject = subject.trim();
    const trimmedHtml = html.trim();

    if (!trimmedTo || !trimmedSubject || !trimmedHtml) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    // Email sending is intentionally disabled: no external provider is configured.
    return NextResponse.json(
      {
        error:
          "Email sending is disabled in this project (no email provider configured).",
      },
      { status: 503 },
    );
  } catch (error) {
    console.error("Error in /api/emails/send (email disabled)", error);
    return NextResponse.json(
      { error: "Failed to handle email send request" },
      { status: 500 },
    );
  }
}
