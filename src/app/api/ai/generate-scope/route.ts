import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { projectId, briefUrl } = await req.json();

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      // Fallback without AI
      return NextResponse.json({ 
        scope: "Unable to generate scope - AI not configured. Please enter the technical scope manually.",
        questions: []
      });
    }

    let briefContent = "";
    if (briefUrl) {
      // In a real implementation, you would fetch and parse the PDF/Word content
      // For now, we'll note that a brief file was provided
      briefContent = "A project brief document has been uploaded. Analyzing the requirements...";
    }

    const systemPrompt = `You are a senior technical project manager specializing in website development. Generate a comprehensive technical scope document as plain text (not JSON).

Include these sections:
1. PROJECT OVERVIEW
2. TECHNICAL REQUIREMENTS  
3. FEATURES & FUNCTIONALITY
4. TECHNOLOGY STACK RECOMMENDATIONS
5. INTEGRATION REQUIREMENTS
6. SECURITY CONSIDERATIONS
7. PERFORMANCE REQUIREMENTS
8. TIMELINE ESTIMATES
9. ASSUMPTIONS & DEPENDENCIES
10. OUT OF SCOPE ITEMS

If information seems incomplete, add a "CLARIFYING QUESTIONS" section at the end.

Output ONLY the scope document text, no JSON formatting.`;

    const userPrompt = briefContent 
      ? `Based on the following project brief, generate a technical scope:\n\n${briefContent}`
      : `No project brief was provided. Generate a template technical scope for a website project and include questions that should be answered to complete it.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI API failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Always return as plain text string
    return NextResponse.json({ scope: content });
  } catch (error) {
    console.error("AI scope generation error:", error);
    return NextResponse.json({ 
      scope: "Failed to generate scope. Please try again or enter manually.",
      questions: []
    }, { status: 500 });
  }
}
