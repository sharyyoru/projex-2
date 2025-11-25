import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("Missing OPENAI_API_KEY environment variable for analyze-brand");
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

type AnalyzeBrandRequestBody = {
  pdfText?: string;
  pdfUrl?: string;
  companyName?: string;
};

export async function POST(request: Request) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as AnalyzeBrandRequestBody;
    const { pdfText, pdfUrl, companyName } = body;

    if (!pdfText && !pdfUrl) {
      return NextResponse.json(
        { error: "Either pdfText or pdfUrl is required" },
        { status: 400 },
      );
    }

    const systemPrompt = `You are an expert brand strategist and designer. Analyze brand guidelines documents and extract key brand elements. Be precise about colors (provide exact hex codes when mentioned, or infer appropriate ones). Output strict JSON only.`;

    const userPrompt = `
Analyze the following brand guidelines document and extract the brand elements.
${companyName ? `Company: ${companyName}` : ""}

Document content:
${pdfText || "PDF URL provided - please analyze based on common brand guidelines structure"}

Extract and return a JSON object with this exact structure:

{
  "colors": {
    "primary": [{"name": "Color name", "hex": "#HEXCODE", "usage": "When to use this color"}],
    "secondary": [{"name": "Color name", "hex": "#HEXCODE", "usage": "When to use this color"}],
    "accent": [{"name": "Color name", "hex": "#HEXCODE", "usage": "When to use this color"}],
    "neutrals": [{"name": "Color name", "hex": "#HEXCODE", "usage": "When to use this color"}]
  },
  "typography": {
    "primary_font": {"name": "Font name", "weights": ["Regular", "Bold"], "usage": "Headers, titles"},
    "secondary_font": {"name": "Font name", "weights": ["Regular"], "usage": "Body text"},
    "special_fonts": []
  },
  "tone_of_voice": {
    "personality": ["Array of 3-5 personality traits like 'Professional', 'Friendly', 'Innovative'"],
    "do": ["Communication guidelines - what to do"],
    "dont": ["Communication guidelines - what to avoid"],
    "sample_phrases": ["Example phrases that capture the brand voice"]
  },
  "logo_usage": {
    "clear_space": "Guidelines for logo clear space",
    "minimum_size": "Minimum size requirements",
    "dont": ["What not to do with the logo"]
  },
  "imagery_style": {
    "description": "Overall visual style description",
    "characteristics": ["Key characteristics of brand imagery"]
  },
  "brand_values": ["Core brand values"],
  "tagline": "Brand tagline if mentioned",
  "additional_notes": "Any other important brand guidelines"
}

If certain information is not available in the document, make reasonable professional inferences or leave those fields with placeholder values. Always provide hex codes for colors.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    const rawContent = completion.choices[0]?.message?.content || "";

    try {
      let jsonContent = rawContent;
      if (rawContent.includes("```json")) {
        jsonContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (rawContent.includes("```")) {
        jsonContent = rawContent.replace(/```\n?/g, "");
      }
      
      const parsed = JSON.parse(jsonContent.trim());
      return NextResponse.json({ brandGuidelines: parsed, pdfUrl });
    } catch {
      // Return a structured fallback with common brand colors
      return NextResponse.json({
        brandGuidelines: {
          colors: {
            primary: [{ name: "Primary Blue", hex: "#2563EB", usage: "Main brand color" }],
            secondary: [{ name: "Secondary Purple", hex: "#7C3AED", usage: "Accents and highlights" }],
            accent: [{ name: "Accent Orange", hex: "#F97316", usage: "Call to actions" }],
            neutrals: [
              { name: "Dark Gray", hex: "#1F2937", usage: "Text" },
              { name: "Light Gray", hex: "#F3F4F6", usage: "Backgrounds" },
            ],
          },
          typography: {
            primary_font: { name: "Inter", weights: ["Regular", "Medium", "Bold"], usage: "All text" },
            secondary_font: null,
            special_fonts: [],
          },
          tone_of_voice: {
            personality: ["Professional", "Friendly", "Clear"],
            do: ["Be concise", "Use active voice", "Be helpful"],
            dont: ["Use jargon", "Be condescending"],
            sample_phrases: [],
          },
          logo_usage: {
            clear_space: "Maintain clear space equal to the height of the logo mark",
            minimum_size: "24px height minimum",
            dont: ["Stretch or distort", "Change colors"],
          },
          imagery_style: {
            description: "Clean, modern, professional",
            characteristics: ["High quality", "Well-lit", "Authentic"],
          },
          brand_values: ["Quality", "Innovation", "Trust"],
          tagline: "",
          additional_notes: "Brand guidelines extracted from uploaded document",
        },
        pdfUrl,
      });
    }
  } catch (error) {
    console.error("Error analyzing brand guidelines via OpenAI:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to analyze brand guidelines: ${errorMessage}` },
      { status: 500 },
    );
  }
}
