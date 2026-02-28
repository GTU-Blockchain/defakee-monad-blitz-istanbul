import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// Mock AI analysis endpoint
app.post('/analyze', (req, res) => {
    const { hash, filename, size } = req.body;

    if (!hash) {
        return res.status(400).json({ error: 'Hash is required for analysis' });
    }

    // Deterministic mock scoring based on the hash string itself
    // In a real scenario, an ML model would process the actual file bytes.
    let sum = 0;
    for (let i = 0; i < hash.length; i++) {
        sum += hash.charCodeAt(i);
    }

    // Add some variance based on filename length or size if provided
    const variance = (filename ? filename.length : 0) + (size ? size % 10 : 0);

    // Map to 0-100 scale
    let score = (sum + variance) % 101;

    // Determine risk level based on the simulated score
    let riskLevel = 'Low';
    let message = 'Content appears to be authentic.';

    if (score < 40) {
        riskLevel = 'High';
        message = 'High risk of manipulation or AI generation detected.';
    } else if (score < 70) {
        riskLevel = 'Medium';
        message = 'Some anomalies detected, authenticity cannot be fully verified.';
    }

    // Optional: Simulate processing delay to make it feel like real AI analysis
    setTimeout(() => {
        res.json({
            hash,
            score,
            riskLevel,
            message,
            analyzedAt: new Date().toISOString()
        });
    }, 1500);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 De-Fake AI Scorer API running on port ${PORT}`);
});
