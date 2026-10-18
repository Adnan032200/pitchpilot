exports.handler = async (event, context) => {
    // ═══ CORS Headers ═══
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Only allow POST
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
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured. Please set GROQ_API_KEY in Netlify environment variables.' })
        };
    }

    const systemPrompt = `You are an expert freelance proposal writer. 
Return the response strictly as a JSON object with keys: "hook", "body", "cta". Do not include any other text outside the JSON.`;

    const userPrompt = `Client's job description: ${jobDesc}
Freelancer's skills: ${skills}
Freelancer's name: ${name}
Write a SHORT proposal (max 150 words) with 3 clearly separated parts:
1. HOOK: 2 lines that show I read the job and understand the client's real problem. Do NOT say 'I am excited to apply'.
2. BODY: How my specific skills solve their problem. Use one concrete example.
3. CALL TO ACTION: One simple next-step question.
Tone: ${tone || 'Professional'}`;

    // Models to try one by one if the first one fails
    const modelsToTry = [
        'llama-3.3-70b-versatile', // 1st Choice: Best Quality
        'openai/gpt-oss-20b',      // 2nd Choice: Fast & Reliable
        'openai/gpt-oss-120b'      // 3rd Choice: Backup
    ];

    let lastError = 'Unknown error occurred';

    for (const model of modelsToTry) {
        try {
            console.log(`Attempting generation with model: ${model}`);
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            const data = await response.json();

            if (response.ok && !data.error) {
                // Success! Parse and return result
                let text = data.choices[0].message.content;
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const result = JSON.parse(text);

                if (result.hook && result.body && result.cta) {
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(result)
                    };
                }
            } else {
                // If this model fails, save the error and try the next one
                lastError = data.error?.message || `API error: ${response.status}`;
                console.error(`Model ${model} failed: ${lastError}`);
            }
        } catch (error) {
            lastError = error.message;
            console.error(`Model ${model} threw exception: ${lastError}`);
        }
    }

    // Agar saare models fail ho jayein
    return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `All models failed. Last error: ${lastError}` })
    };
};
