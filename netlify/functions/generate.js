exports.handler = async (event, context) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only allow POST
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

    // Validate inputs
    if (!jobDesc || !skills || !name) {
        return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Missing required fields: jobDesc, skills, name' }) 
        };
    }

    // API Key from Netlify Environment Variables
    const API_KEY = process.env.GROQ_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' })
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

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
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

        if (!response.ok || data.error) {
            const errMsg = data.error?.message || `API error: ${response.status}`;
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: errMsg })
            };
        }

        let text = data.choices[0].message.content;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(text);

        if (!result.hook || !result.body || !result.cta) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AI response missing required fields' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Unknown error' })
        };
    }
};
