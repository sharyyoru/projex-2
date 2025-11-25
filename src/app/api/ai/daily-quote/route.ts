import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET - Fetch or generate daily quote
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check if quote already exists for today
    const { data: existingQuote } = await supabaseAdmin
      .from("daily_quotes")
      .select("quote_text")
      .eq("user_id", userId)
      .eq("quote_date", today)
      .single();

    if (existingQuote) {
      return NextResponse.json({ quote: existingQuote.quote_text });
    }

    // Generate new quote using AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional motivational coach. Generate a unique, inspiring, and professional quote to motivate an employee at the start of their workday. The quote should be:
- Original (not from famous quotes)
- Professional and workplace-appropriate
- Focused on productivity, growth, teamwork, or achievement
- Between 15-40 words
- Uplifting but not cheesy
Return ONLY the quote text, no attribution or quotation marks.`,
        },
        {
          role: "user",
          content: "Generate today's motivational quote for an employee dashboard.",
        },
      ],
      max_tokens: 100,
      temperature: 0.9,
    });

    const quoteText = completion.choices[0]?.message?.content?.trim() || 
      "Every day is a fresh opportunity to create meaningful impact. Start strong, stay focused, and finish proud.";

    // Store the quote for today
    await supabaseAdmin.from("daily_quotes").upsert({
      user_id: userId,
      quote_date: today,
      quote_text: quoteText,
    });

    return NextResponse.json({ quote: quoteText });
  } catch (err) {
    console.error("Error generating daily quote:", err);
    // Return a fallback quote if AI fails
    return NextResponse.json({
      quote: "Every accomplishment starts with the decision to try. Make today count!",
    });
  }
}
