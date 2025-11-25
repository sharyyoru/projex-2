import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context, tone, postCount, platforms, companyName } = body;

    if (!context || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Context and platforms are required" },
        { status: 400 }
      );
    }

    // Build the prompt for AI
    const prompt = `You are a social media content strategist. Generate ${postCount} unique social media post ideas based on the following:

Company/Brand: ${companyName || "Not specified"}
Context/Topic: ${context}
Tone: ${tone}
Target Platforms: ${platforms.join(", ")}

For each idea, provide:
1. The specific platform it's optimized for
2. A compelling hook (first line to grab attention)
3. The full caption/post text (appropriate length for the platform)
4. 3-5 relevant hashtags

Format your response as a JSON array with objects containing: platform, hook, caption, hashtags (array of strings without # symbol)

Platform-specific guidelines:
- Instagram: Visual storytelling, 150-200 words, engaging CTAs
- LinkedIn: Professional tone, thought leadership, 100-150 words
- TikTok: Trendy, casual, hook-focused, 50-100 words
- X/Twitter: Concise, punchy, under 280 characters
- Facebook: Conversational, community-focused, 100-150 words

Return ONLY the JSON array, no additional text.`;

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert social media strategist who creates engaging, platform-optimized content. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "Failed to generate ideas" },
        { status: 500 }
      );
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No content generated" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let ideas;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ideas = JSON.parse(jsonMatch[0]);
      } else {
        ideas = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "Failed to parse generated ideas" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ideas });
  } catch (error) {
    console.error("Error generating ideas:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
