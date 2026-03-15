import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch models: ${res.statusText}`);
        }

        const data = await res.json();
        console.log("Available models:");
        data.models.forEach((m: any) => {
            console.log(`- ${m.name} (methods: ${m.supportedGenerationMethods.join(', ')})`);
        });
    } catch (e: any) {
        console.error("Error fetching models:", e.message);
    }
}

run();
