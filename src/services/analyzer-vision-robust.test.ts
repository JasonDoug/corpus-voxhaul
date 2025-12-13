
import { analyzeContentVisionFirst } from './analyzer-vision';

// Mock everything needed to test just the private parsing logic? 
// Actually, since I can't easily export private functions, I'll essentially copy the parsing logic here to test it, 
// OR I can export a helper function from the main file. 
// For now, I will write the parsing function I INTEND to use here, test it, and then move it to the main file.

function cleanAndParseJson(text: string): any {
    let cleaned = text.trim();

    // 1. Extract JSON block if marked with markdown
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1];
    }

    // 2. Find the first '{' and last '}' to strip surrounding text
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    // 3. Try parsing
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // 4. Simple repair attempts (optional, but risky without a library)
        // For now, just throwing is fine, the extraction above solves 90% of LLM chatter issues
        throw e;
    }
}

describe('Robust JSON Parsing', () => {
    test('should parse valid clean JSON', () => {
        const input = '{"segments": []}';
        expect(cleanAndParseJson(input)).toEqual({ segments: [] });
    });

    test('should parse JSON wrapped in markdown', () => {
        const input = '```json\n{"segments": []}\n```';
        expect(cleanAndParseJson(input)).toEqual({ segments: [] });
    });

    test('should parse JSON wrapped in generic markdown', () => {
        const input = '```\n{"segments": []}\n```';
        expect(cleanAndParseJson(input)).toEqual({ segments: [] });
    });

    test('should extract JSON from surrounding text', () => {
        const input = 'Here is the JSON:\n\n{"segments": []}\n\nHope this helps!';
        expect(cleanAndParseJson(input)).toEqual({ segments: [] });
    });

    test('should handle markdown AND surrounding text', () => {
        const input = 'Sure!\n```json\n{"segments": []}\n```\nDone.';
        expect(cleanAndParseJson(input)).toEqual({ segments: [] });
    });

    // The error seen in logs: "Expected ',' or '}' after property value"
    // This often implies unescaped quotes in strings. 
    // e.g. "description": "This is "quoted" text"

    // Without a heavy library, fixing unescaped quotes is hard.
    // But let's verify if extraction helps.
});
