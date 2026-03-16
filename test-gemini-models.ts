import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No GEMINI_API_KEY found in .env");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(key);
        // SDK doesn't have a direct listModels, we use the standard fetch or check supported models
        console.log("Checking model connectivity for gemini-1.5-flash...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Hi");
            console.log("gemini-1.5-flash: SUCCESS");
        } catch (e: any) {
            console.log("gemini-1.5-flash: FAILED - " + e.message);
        }

        console.log("\nChecking model connectivity for gemini-1.5-flash-latest...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent("Hi");
            console.log("gemini-1.5-flash-latest: SUCCESS");
        } catch (e: any) {
            console.log("gemini-1.5-flash-latest: FAILED - " + e.message);
        }

        console.log("\nChecking model connectivity for gemini-2.0-flash-exp...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            const result = await model.generateContent("Hi");
            console.log("gemini-2.0-flash-exp: SUCCESS");
        } catch (e: any) {
            console.log("gemini-2.0-flash-exp: FAILED - " + e.message);
        }
        
        console.log("\nChecking model connectivity for gemini-1.5-pro...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent("Hi");
            console.log("gemini-1.5-pro: SUCCESS");
        } catch (e: any) {
            console.log("gemini-1.5-pro: FAILED - " + e.message);
        }

    } catch (error: any) {
        console.error("CRITICAL ERROR:", error.message);
    }
}

listModels();
