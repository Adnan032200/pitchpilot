// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
});

// Generator functions (only run on generator page)
if (document.getElementById('generateBtn')) {
    // Use the Netlify Function endpoint instead of direct Groq API
    // This keeps your API key secure on the server
    const API_URL = '/.netlify/functions/generate';

    window.generateProposal = async function() {
        const jobDesc = document.getElementById('jobDesc').value;
        const skills = document.getElementById('skills').value;
        const name = document.getElementById('name').value;
        const tone = document.getElementById('tone').value;

        if (!jobDesc || !skills || !name) {
            alert("Please fill all required fields.");
            return;
        }

        document.getElementById('formSection').classList.add('hidden');
        document.getElementById('loading').classList.remove('hidden');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobDesc, skills, name, tone })
            });

            const data = await response.json();
            
            if (!response.ok || data.error) {
                const serverMessage =
                    (typeof data.error === 'string' && data.error) ||
                    data.error?.message ||
                    data.message ||
                    `Server error: ${response.status}`;
                throw new Error(serverMessage);
            }

            if (typeof data.hook !== 'string' ||
                typeof data.body !== 'string' ||
                typeof data.cta !== 'string') {
                throw new Error('The server returned an unexpected proposal format. Please try again.');
            }

            document.getElementById('outHook').innerText = data.hook;
            document.getElementById('outBody').innerText = data.body;
            document.getElementById('outCta').innerText = data.cta;

            document.getElementById('loading').classList.add('hidden');
            document.getElementById('resultSection').classList.remove('hidden');

        } catch (error) {
            alert("Error: " + error.message + "\n\nPlease try again in a minute.");
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('formSection').classList.remove('hidden');
        }
    };

    window.copyText = function(id) {
        const text = document.getElementById(id).innerText;
        navigator.clipboard.writeText(text);
        alert("Copied!");
    };

    window.copyFull = function() {
        const hook = document.getElementById('outHook').innerText;
        const body = document.getElementById('outBody').innerText;
        const cta = document.getElementById('outCta').innerText;
        navigator.clipboard.writeText(`${hook}\n\n${body}\n\n${cta}`);
        alert("Full proposal copied!");
    };

    window.resetForm = function() {
        document.getElementById('resultSection').classList.add('hidden');
        document.getElementById('formSection').classList.remove('hidden');
    };
}