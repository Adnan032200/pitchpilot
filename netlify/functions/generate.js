exports.handler = async (event, context) => {
    // ═══ CORS Headers ═══
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { jobDesc, skills, name, tone } = body;

    if (!jobDesc || !skills || !name) {
        return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Missing required fields: jobDesc, skills, name' }) 
        };
    }

    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    // ═══════════════════════════════════════════════════════════════
    // STAGE 1: JOB ANALYZER (Extracting client's real needs)
    // ═══════════════════════════════════════════════════════════════
    
    const analyzerSystemPrompt = `You are an expert job analyzer. Analyze the job description and extract the core requirements.
Return strictly a JSON object with: 
"core_problem": "What is the client's actual pain point?",
"deliverables": ["item1", "item2"],
"client_priorities": "e.g., speed, budget, quality, specific tools",
"job_category": "e.g., Web Dev, Design, SEO, Writing"`;

    const analyzerUserPrompt = `Job Description: ${jobDesc}\nFreelancer Skills: ${skills}`;

    let analysis = {
        core_problem: "Client needs a professional solution.",
        deliverables: ["Project completion"],
        client_priorities: "Quality and reliability",
        job_category: "General"
    };

    try {
        // Using fast model for analysis
        const analyzeResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', 
                messages: [
                    { role: 'system', content: analyzerSystemPrompt },
                    { role: 'user', content: analyzerUserPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3 // Low temp for factual extraction
            })
        });

        const analyzeData = await analyzeResponse.json();
        if (analyzeResponse.ok && analyzeData.choices) {
            let text = analyzeData.choices[0].message.content;
            analysis = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        }
    } catch (err) {
        console.log("Analysis stage failed, proceeding with defaults:", err);
        // Agar analysis fail ho jaye, toh default use karenge taake main generation ruk na jaye
    }

    // ═══════════════════════════════════════════════════════════════
    // STAGE 2: PROPOSAL GENERATOR (Writing the highly specific pitch)
    // ═══════════════════════════════════════════════════════════════

    const systemPrompt = `You are an elite, world-class freelance proposal writer. 
You will receive the client's job description and an Analysis of their needs.

RULES (STRICTLY FOLLOW):
1. NO FAKE METRICS: Never invent statistics (like "increased sales by 20%").
2. NO FAKE PORTFOLIO: Never invent past clients or projects unless explicitly provided. If the user has no portfolio, write a strong proposal based purely on skills and the proposed plan.
3. TONE: ${tone || 'Professional, expert, and conversational'}. Do not use fluffy phrases like "I am excited to apply" or "Let's make your dreams come true".
4. HOOK: Address the specific pain point extracted in the analysis.
5. BODY: Provide concrete solutions. Name specific tools from the freelancer's skills (e.g., if skills include WordPress, mention how you will use it). Mention specific deliverables.
6. CTA (Call to Action): Do NOT ask for a call. Offer a low-friction next step (e.g., "Would you like to see a quick layout idea?" or "I can share a sample of my recent work").

Return strictly a JSON object with keys: "hook", "body", "cta".`;

    const userPrompt = `Client's Job Description: ${jobDesc}
Freelancer's Name: ${name}
Freelancer's Skills: ${skills}

--- ANALYSIS OF CLIENT'S NEEDS ---
Core Problem: ${analysis.core_problem}
Key Deliverables: ${analysis.deliverables.join(', ')}
Client Priorities: ${analysis.client_priorities}
Category: ${analysis.job_category}

Write the proposal now. Be specific, human, and honest. Max 150 words.`;

    // Fallback models list (Taake agar ek block ho toh doosra chal jaye)
    const modelsToTry = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
    let lastError = 'Unknown error';

    for (const model of modelsToTry) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 600
                })
            });

            const data = await response.json();

            if (response.ok && !data.error) {
                let text = data.choices[0].message.content;
                const result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

                if (result.hook && result.body && result.cta) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(result)
                    };
                }
            } else {
                lastError = data.error?.message || `API error: ${response.status}`;
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Generation failed. Last error: ${lastError}` })
    };
};
