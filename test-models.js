const fs = require('fs');
require('dotenv').config();

async function run() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const names = data.models?.map(m => m.name) || [];
        fs.writeFileSync('models.json', JSON.stringify(names, null, 2));
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

run();
