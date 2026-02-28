import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = 'AIzaSyA22ie9rldwxSDK42tXc1phSTbJ8PGKrG0';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface AnalysisResult {
    score: number;
    riskLevel: string;
    message: string;
    model: string;
    analyzedAt: string;
}

export async function analyzeWithGemini(content: string, retries = 2): Promise<AnalysisResult> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are De-Fake, an AI content authenticity analyzer for a decentralized truth platform. Evaluate whether this user post is authentic or potentially fabricated/misleading.

SCORING GUIDELINES:
- 85-100: Clearly factual, verifiable information (well-known facts, historical events, scientific consensus)
- 65-84: Mostly credible but contains opinions, predictions, or minor unverifiable claims  
- 35-64: Mixed credibility — contains some factual elements but also unverified or exaggerated claims
- 10-34: Likely misleading, contains false claims, exaggerations, or fabricated information
- 0-9: Obviously fake, satirical misinformation, or completely fabricated claims (e.g. "moon is made of cheese")

Content to analyze:
"""
${content}
"""

Respond ONLY in this exact JSON format, no other text:
{"score": <number 0-100>, "reasoning": "<1-2 sentence explanation>", "riskLevel": "<Low|Medium|High>"}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
                return {
                    score,
                    riskLevel: parsed.riskLevel || (score > 70 ? 'Low' : score > 40 ? 'Medium' : 'High'),
                    message: parsed.reasoning || 'Analysis complete.',
                    model: 'gemini-2.5-flash-lite',
                    analyzedAt: new Date().toISOString(),
                };
            }
            throw new Error('No JSON in response');
        } catch (err: any) {
            console.error(`Gemini attempt ${attempt + 1}/${retries + 1}:`, err?.message?.substring(0, 100));
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, (attempt + 1) * 15000));
            }
        }
    }

    // Fallback
    let sum = 0;
    for (let i = 0; i < content.length; i++) sum += content.charCodeAt(i);
    const fallbackScore = sum % 101;
    return {
        score: fallbackScore,
        riskLevel: fallbackScore > 70 ? 'Low' : fallbackScore > 40 ? 'Medium' : 'High',
        message: 'AI service temporarily unavailable. Deterministic fallback score applied.',
        model: 'fallback',
        analyzedAt: new Date().toISOString(),
    };
}
