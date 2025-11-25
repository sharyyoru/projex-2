import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("Missing OPENAI_API_KEY environment variable for generate-brief");
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

type GenerateBriefRequestBody = {
  companyName?: string;
  projectName?: string;
  industry?: string;
  projectType?: string;
  targetAudience?: string;
  objectives?: string;
  existingInfo?: string;
};

export async function POST(request: Request) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GenerateBriefRequestBody;
    const { companyName, projectName, industry, projectType, targetAudience, objectives, existingInfo } = body;

    const systemPrompt = `You are an expert project strategist and creative director. Generate comprehensive, professional project briefs that are clear, actionable, and inspiring. Output strict JSON only.`;

    const userPrompt = `
Generate a detailed project brief based on the following information:

Company: ${companyName || "Not specified"}
Project Name: ${projectName || "Not specified"}
Industry: ${industry || "Not specified"}
Project Type: ${projectType || "Not specified"}
Target Audience: ${targetAudience || "Not specified"}
Key Objectives: ${objectives || "Not specified"}
Additional Context: ${existingInfo || "None provided"}

Generate a comprehensive project brief with the following structure. Output STRICT JSON only with this exact shape:

{
  "executive_summary": "A compelling 2-3 sentence overview of the project",
  "objectives": ["Array of 3-5 clear, measurable objectives"],
  "target_audience": {
    "primary": "Description of primary audience",
    "secondary": "Description of secondary audience (if applicable)",
    "demographics": "Key demographic details",
    "psychographics": "Key psychographic traits and behaviors"
  },
  "scope": {
    "deliverables": ["Array of specific deliverables"],
    "in_scope": ["What is included"],
    "out_of_scope": ["What is explicitly not included"]
  },
  "key_messages": ["Array of 3-5 core messages or value propositions"],
  "success_metrics": ["Array of measurable KPIs"],
  "timeline_considerations": "General timeline guidance",
  "budget_considerations": "Budget guidance or constraints",
  "stakeholders": ["Key stakeholders involved"],
  "constraints": ["Any constraints or limitations"],
  "inspiration": "Creative direction or inspiration notes"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const rawContent = completion.choices[0]?.message?.content || "";

    try {
      // Try to parse as JSON directly
      let jsonContent = rawContent;
      // Remove markdown code blocks if present
      if (rawContent.includes("```json")) {
        jsonContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (rawContent.includes("```")) {
        jsonContent = rawContent.replace(/```\n?/g, "");
      }
      
      const parsed = JSON.parse(jsonContent.trim());
      return NextResponse.json({ brief: parsed });
    } catch {
      // If parsing fails, return a structured fallback
      return NextResponse.json({
        brief: {
          executive_summary: rawContent.slice(0, 500),
          objectives: ["To be defined based on project requirements"],
          target_audience: {
            primary: targetAudience || "To be defined",
            secondary: "",
            demographics: "",
            psychographics: "",
          },
          scope: {
            deliverables: [],
            in_scope: [],
            out_of_scope: [],
          },
          key_messages: [],
          success_metrics: [],
          timeline_considerations: "",
          budget_considerations: "",
          stakeholders: [],
          constraints: [],
          inspiration: "",
        },
      });
    }
  } catch (error) {
    console.error("Error generating project brief via OpenAI:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate project brief: ${errorMessage}` },
      { status: 500 },
    );
  }
}
