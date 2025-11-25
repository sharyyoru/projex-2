import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { context, projectName, type } = await req.json();

    if (!context) {
      return NextResponse.json({ error: "Context is required" }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      // Fallback: generate a simple description without AI
      const description = `${type === "quote" ? "Quote" : "Invoice"} for ${projectName}: ${context}`;
      return NextResponse.json({ description });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional invoice/quote writer. Generate a clear, professional line item description for a ${type}. Keep it concise but detailed enough to explain the service/product. Output only the description text, no quotes or extra formatting.`,
          },
          {
            role: "user",
            content: `Project: ${projectName}\nContext: ${context}\n\nGenerate a professional line item description.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI API failed");
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim() || context;

    return NextResponse.json({ description });
  } catch (error) {
    console.error("AI generation error:", error);
    // Fallback
    return NextResponse.json({ description: "" }, { status: 500 });
  }
}
