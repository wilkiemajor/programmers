import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface Blueprint {
  title: string;
  description: string;
  techStack: string[];
  erDiagram: string;
  features: string[];
  implementationPlan: string[];
}

export async function generateBlueprint(prompt: string): Promise<Blueprint> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Act as a Senior Full-Stack Architect. Generate a comprehensive project blueprint for the following request: "${prompt}". 
    Focus on technical precision, clean architecture, and developer utility.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          techStack: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          erDiagram: { type: Type.STRING, description: "Mermaid.js or text-based ER diagram" },
          features: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          implementationPlan: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "description", "techStack", "erDiagram", "features", "implementationPlan"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
