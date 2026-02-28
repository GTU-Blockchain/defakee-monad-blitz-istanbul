import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyA22ie9rldwxSDK42tXc1phSTbJ8PGKrG0';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function callGemini(text, retries = 3) {
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
${text}
"""

Respond ONLY in this exact JSON format, no other text:
{"score": <number 0-100>, "reasoning": "<1-2 sentence explanation>", "riskLevel": "<Low|Medium|High>"}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No JSON in response');
        } catch (err) {
            console.error(`Gemini attempt ${attempt + 1}/${retries + 1} failed:`, err.message?.substring(0, 100));
            if (attempt < retries) {
                const waitMs = (attempt + 1) * 30000; // 30s, 60s, 90s
                console.log(`⏳ Rate limited. Retrying in ${waitMs / 1000}s...`);
                await new Promise(r => setTimeout(r, waitMs));
            } else {
                throw err;
            }
        }
    }
}

app.post('/analyze', async (req, res) => {
    const { hash, content, filename, size } = req.body;

    if (!content && !hash) {
        return res.status(400).json({ error: 'Content or hash is required' });
    }

    const textToAnalyze = content || `[File: ${filename}, Size: ${size} bytes, Hash: ${hash}]`;

    try {
        const parsed = await callGemini(textToAnalyze);
        const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

        console.log(`✅ Gemini analysis: "${textToAnalyze.substring(0, 50)}..." → Score: ${score}`);

        res.json({
            hash: hash || 'text_analysis',
            score,
            riskLevel: parsed.riskLevel || (score > 70 ? 'Low' : score > 40 ? 'Medium' : 'High'),
            message: parsed.reasoning || 'Analysis complete.',
            model: 'gemini-2.5-flash-lite',
            analyzedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Gemini failed after retries, using fallback');
        let sum = 0;
        for (let i = 0; i < textToAnalyze.length; i++) {
            sum += textToAnalyze.charCodeAt(i);
        }
        const fallbackScore = sum % 101;
        res.json({
            hash: hash || 'fallback',
            score: fallbackScore,
            riskLevel: fallbackScore > 70 ? 'Low' : fallbackScore > 40 ? 'Medium' : 'High',
            message: 'AI service temporarily unavailable. Deterministic fallback score applied.',
            model: 'fallback',
            analyzedAt: new Date().toISOString()
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 De-Fake AI Scorer (Gemini 2.0 Flash) on port ${PORT}`);
});
