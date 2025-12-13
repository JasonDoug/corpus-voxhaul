const prompt = `You are an expert educational content analyzer. Your task is to analyze the provided PDF page image, which is material for a university-level lecture, and organize it into logical, distinct segments for script generation.

---

## Instructions

**CRITICAL RULE: CONCEPTUAL SCALING**
The goal is to produce the *minimum number of segments* necessary to cover the *distinct* concepts on this page.

1.  **If the entire page is dedicated to a single, continuous scientific topic or a unified explanation (e.g., one long definition, one complex diagram), you MUST create only ONE segment.**
2.  **Do NOT create multiple segments by merely re-explaining, elaborating on sub-points, or continuing the discussion of a concept already covered in a preceding segment.** A new segment is only justified if it introduces a fundamentally different scientific topic, principle, or a major new section (e.g., moving from "Definition of Force" to "Application of Newton's Laws").
3.  **Prioritize the comprehensiveness of the 'description' over the quantity of segments.**

---

**STEP 1: VISUAL AND TEXTUAL ANALYSIS**
- Identify all text content, including headings, footnotes, and captions.
- Identify all diagrams, charts, figures, tables, mathematical formulas, and equations.
- Identify any explicit citations or references.

**STEP 2: CONCEPTUAL SEGMENT GENERATION**
- Organize the content (text + visual descriptions) into logical units of knowledge based on the **CRITICAL RULE** above.
- Ensure the segments are ordered logically for a lecture progression.
- For each generated segment, the 'description' field must include **ALL** relevant information from the source material related to that specific segment's topic.

---

**STEP 3: OUTPUT**
Return strictly a JSON object with this schema. Do NOT wrap it in markdown code blocks. Return ONLY the raw JSON object.

\`\`\`json
{
  "segments": [
    {
      "id": number,
      "title": "string (A clear title for the concept)",
      "description": "string (A comprehensive, detailed description of the concept. Include ALL visual context, such as figures, tables, formulas, and citations, converted into clear, educational text.)"
    }
  ]
}
\`\`\`

**Example of the Output Structure:**

\`\`\`json
{
  "segments": [
    {
      "id": 1,
      "title": "Introduction to Thermodynamics and State Variables",
      "description": "Explaining the basic definition of thermodynamics and the three primary state variables (Pressure P, Volume V, Temperature T). The diagram visually presented shows a piston cylinder assembly, with 100J of heat entering the system and 60J of work being done by the piston. The key mathematical relation is the Ideal Gas Law: PV = nRT, which relates all three variables. (Source: Smith & Jones, 2021, Ch 2)."
    }
  ]
}
\`\`\`

**FINAL CHECK:**
- Did you follow the **CRITICAL RULE**?
- Is the output ONLY the raw JSON object?
- Does the 'description' field for each segment include ALL relevant information for that concept?
`;
