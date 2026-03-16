const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No GEMINI_API_KEY found in .env");
        return;
    }

    try {
        console.log("Using Key: " + key.substring(0, 10) + "...");
        const genAI = new GoogleGenerativeAI(key);
        
        // Use the native fetch to call the listModels endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("AVAILABLE MODELS:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log("No models found or error:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("CRITICAL ERROR:", error.message);
    }
}

listModels();
