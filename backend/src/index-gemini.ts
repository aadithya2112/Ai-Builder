import express, { Request, Response } from "express";
import {
  GoogleGenerativeAI,
  GenerationConfig,
  SafetySetting,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// --- Gemini Client Setup ---
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}
const genAI = new GoogleGenerativeAI(geminiApiKey);

// --- Model Configuration ---
// Using gemini-1.5-flash as it's generally fast and capable. Check Google AI Studio for latest free models.
const validationModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest", // Or another suitable model
  // Optional: Configure safety settings if needed
  safetySettings: [
    // Using slightly relaxed settings for flexibility, adjust if needed
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
  generationConfig: {
    // Ensure JSON output mode if available and appropriate - check SDK docs
    // responseMimeType: "application/json", // Uncomment if SDK/model supports explicit JSON output mode
  },
});
const generationModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest", // Or another suitable model like gemini-pro
  // Optional: Add generation config
  generationConfig: {
    maxOutputTokens: 8192, // Increased token limit for potentially larger code outputs
    temperature: 0.5, // Slightly lower temperature for more predictable code
    // responseMimeType: "application/json", // Uncomment if SDK/model supports explicit JSON output mode
  },
  // Optional: Safety settings - adjust as necessary for code generation
  safetySettings: [
    // Be cautious with lowering safety for code generation
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
});

// --- Interfaces (remain the same) ---
interface GenerateCodeRequest {
  prompt: string;
}

interface ValidatePromptResponse {
  valid: boolean;
  reason?: string;
}

interface ModifyCodeRequest {
  prompt: string;
  currentHtml: string;
  currentCss: string;
  currentJs: string;
}

// --- Helper Functions ---

// Robust JSON parsing function (attempts to clean up common AI response issues)
function parseJsonResponse(aiResponseText: string): any {
  let jsonString = aiResponseText.trim();

  // Attempt to remove markdown code block fences if present
  const codeBlockMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonString = codeBlockMatch[1].trim();
  } else {
    // Fallback: find the first '{' and last '}' as AI might forget fences
    const jsonStart = jsonString.indexOf("{");
    const jsonEnd = jsonString.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
    }
  }

  // Final check for common prefixes/suffixes AI might add (like "json\n{...}")
  if (jsonString.startsWith("json")) {
    jsonString = jsonString.substring(jsonString.indexOf("{")); // Find first '{' after "json"
  }

  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    console.error("Failed to parse JSON after cleaning:", jsonString); // Log the problematic string
    throw new Error(
      `Failed to parse AI response as JSON. Content: ${aiResponseText.substring(
        0,
        200
      )}...`
    ); // Show start of content
  }
}

async function validatePrompt(prompt: string): Promise<ValidatePromptResponse> {
  // **Strengthened Prompt for Validation**
  const validationPrompt = `You are an expert web developer evaluating if a project request can be implemented using only client-side HTML, CSS, and JavaScript without any backend services or databases.

  Analyze the following project request: "${prompt}"

  Respond ONLY with a valid JSON object containing:
  1. "valid": boolean - true if the request can be implemented with HTML/CSS/JS, false otherwise
  2. "reason": string - short explanation of your decision (max 1-2 sentences).

  Valid projects: static websites, simple games, UI components, animations, calculators, applications using only browser storage (localStorage/sessionStorage), fetching data from PUBLIC APIs (CORS permitted).

  Invalid projects: require server-side processing, databases, user authentication systems (beyond simple client-side checks), payment processing, real-time multi-user features needing a server, accessing private APIs or server file systems.

  CRITICAL: Your entire response MUST be ONLY the raw JSON object. Do NOT include markdown formatting (\`\`\`), code blocks, introductory text, or any characters before the opening '{' or after the closing '}'.

  Example of EXACT valid output:
  {"valid": true, "reason": "This is a static UI component implementable with HTML/CSS/JS."}

  Example of EXACT invalid output:
  {"valid": false, "reason": "Requires a database, which needs a backend."}

  Evaluate the request now and provide ONLY the JSON object.`;

  try {
    // Use generateContent for a single, non-streaming response
    const result = await validationModel.generateContent(validationPrompt);
    const response = result.response;

    // Check for blocking right away
    if (!response.candidates || response.candidates.length === 0) {
      const blockReason = response.promptFeedback?.blockReason;
      const safetyRatings = response.promptFeedback?.safetyRatings;
      console.error("Validation response blocked.", {
        blockReason,
        safetyRatings,
      });
      return {
        valid: false,
        reason: `Validation request blocked by safety filters: ${
          blockReason ?? "Unknown reason"
        }. Please revise your prompt.`,
      };
    }

    const text = response.text();
    console.log("Raw Validation Response Text:", text); // Log raw response

    const parsedJson = parseJsonResponse(text); // Use helper to clean and parse

    if (
      typeof parsedJson.valid !== "boolean" ||
      typeof parsedJson.reason !== "string"
    ) {
      console.error(
        "Invalid JSON structure received from validation AI:",
        parsedJson
      );
      throw new Error("Invalid JSON structure received from validation AI.");
    }

    return {
      valid: parsedJson.valid,
      reason: parsedJson.reason,
    };
  } catch (error) {
    console.error("Error during Gemini validation call:", error);
    let reason = "Error validating prompt with Gemini: ";
    if (error instanceof Error) {
      reason += error.message;
    } else {
      reason += "Unknown error";
    }
    // Check specifically for response errors if the call itself failed differently
    if (
      (error as any).message?.includes("response") &&
      (error as any).response?.promptFeedback?.blockReason
    ) {
      reason += ` (Blocked: ${
        (error as any).response.promptFeedback.blockReason
      })`;
    }
    return {
      valid: false,
      reason: reason,
    };
  }
}

// --- API Endpoints ---

app.post("/api/validate-prompt", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({
      // Ensure JSON response for errors too
      valid: false,
      reason:
        "Invalid prompt format. Please provide a non-empty text description of your website.",
    });
  }

  try {
    const validationResult = await validatePrompt(prompt);
    res.json(validationResult); // Return JSON
  } catch (error) {
    console.error("Server error during prompt validation:", error);
    res.status(500).json({
      // Ensure JSON response for errors too
      valid: false,
      reason: "Server error while validating prompt",
    });
  }
});

app.post("/api/generate-code", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    // Send error as plain text because client might expect stream
    res
      .status(400)
      .type("text/plain")
      .send(
        "Invalid prompt format. Please provide a non-empty text description of your website."
      );
  }

  try {
    // 1. Validate Prompt first
    const validationResult = await validatePrompt(prompt);
    if (!validationResult.valid) {
      // Send error as plain text because client might expect stream
      res
        .status(400)
        .type("text/plain")
        .send(
          `Prompt validation failed: ${
            validationResult.reason ||
            "Request cannot be implemented with HTML/CSS/JS alone"
          }`
        );
    }

    // 2. Prepare for Streaming Generation
    res.setHeader("Content-Type", "text/plain; charset=utf-8"); // Client expects text stream to accumulate
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // **Strengthened Prompt for Generation**
    const generationPrompt = `You are an expert web developer who creates complete, working websites using HTML, CSS, and JavaScript based on user descriptions.

    User Request: Create a complete, working website based on this description: "${prompt}"

    Your Task: Generate the necessary HTML, CSS, and JavaScript code.

    CRITICAL FORMATTING INSTRUCTIONS:
    - Your entire response MUST be ONLY a single, raw, valid JSON object.
    - The JSON object MUST have these exact top-level keys: "html", "css", "js".
    - The value for each key MUST be a single string containing the complete code for that language.
    - Do NOT include markdown formatting (\`\`\`json or \`\`\`).
    - Do NOT include any explanations, comments, conversational text, or any characters outside the single JSON object structure.
    - Ensure the strings within the JSON (especially HTML and JS) are properly escaped for JSON validity (e.g., use \\" for quotes inside strings, \\n for newlines).
    - The response MUST start directly with '{' and end directly with '}'.

    Code Requirements:
    - Generate clean, semantic HTML5.
    - Use modern CSS3 with responsive design (flexbox/grid, media queries).
    - Write functional, modern JavaScript (ES6+) for interactivity.
    - Include ALL necessary code for a standalone, runnable website.
    - Add helpful comments WITHIN the code strings (HTML, CSS, JS).
    - Implement basic accessibility (alt tags, semantic elements, aria attributes if needed).
    - Include basic CSS reset/normalization.
    - Ensure interactive elements have basic CSS :hover/:focus states.

    Example of the EXACT output format required:
    {"html":"<!DOCTYPE html>\\n<html lang=\\"en\\">...</html>","css":"/* CSS Reset */\\nbody { ... }","js":"document.addEventListener('DOMContentLoaded', () => {\\n console.log('Hello');\\n});"}

    Generate the code now. Output ONLY the raw JSON object.`;

    // Use generateContentStream for streaming
    const streamResult = await generationModel.generateContentStream(
      generationPrompt
    );

    // Stream the response chunk by chunk
    for await (const chunk of streamResult.stream) {
      // Check for safety blocks or empty candidates within the stream
      const blockReason = chunk.promptFeedback?.blockReason;
      if (blockReason) {
        console.warn(
          `Generation stream blocked during processing: ${blockReason}`,
          chunk.promptFeedback?.safetyRatings
        );
        // Try to send an error message within the stream format client expects
        res.write(
          JSON.stringify({
            stream_error: `Content generation blocked due to: ${blockReason}. Please revise prompt.`,
          })
        );
        break; // Stop streaming if blocked
      }
      if (!chunk.candidates || chunk.candidates.length === 0) {
        console.warn("Stream chunk received with no candidates.");
        // Potentially indicates an issue or the end of valid content before finishReason
        continue; // Skip empty chunks if they occur
      }

      const chunkText = chunk.text();
      res.write(chunkText); // Write each text chunk directly
    }

    res.end(); // End the response when the stream finishes
  } catch (error) {
    console.error(
      "Error during Gemini code generation stream setup or initial call:",
      error
    );
    // Handle potential errors like API connection issues or safety blocks before streaming starts
    const blockReason = (error as any)?.response?.promptFeedback?.blockReason;
    const errorMessage = blockReason
      ? `Content generation blocked by safety filter: ${blockReason}. Please revise your prompt.`
      : error instanceof Error
      ? error.message
      : "Unknown server error";

    if (!res.headersSent) {
      // Send error as plain text if stream hasn't started
      res
        .status(500)
        .type("text/plain")
        .send(`Server error generating code: ${errorMessage}`);
    } else {
      // If headers are sent, try to append an error message (client needs to handle this)
      try {
        // Send error as JSON within the stream format
        res.write(
          `\n{"stream_error": "An error occurred during streaming: ${errorMessage.replace(
            /"/g,
            '\\"'
          )}"}`
        ); // Escape quotes in error message
        res.end();
      } catch (writeError) {
        console.error("Error writing error message to stream:", writeError);
        res.end(); // Force end if writing fails
      }
    }
  }
});

app.post("/api/modify-code", async (req: Request, res: Response) => {
  const { prompt, currentHtml, currentCss, currentJs } =
    req.body as ModifyCodeRequest;

  // Validate inputs
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res
      .status(400)
      .type("text/plain")
      .send("Invalid modification prompt provided.");
  }
  if (
    currentHtml === undefined ||
    typeof currentHtml !== "string" ||
    currentCss === undefined ||
    typeof currentCss !== "string" ||
    currentJs === undefined ||
    typeof currentJs !== "string"
  ) {
    res
      .status(400)
      .type("text/plain")
      .send("Missing or invalid current code (HTML, CSS, or JS).");
  }

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // **Strengthened Prompt for Modification**
    const modificationPrompt = `You are an expert web developer modifying existing HTML, CSS, and JavaScript code based on a user request.

    User Request: "${prompt}"

    Current Code:
    HTML:
    \`\`\`html
    ${currentHtml}
    \`\`\`

    CSS:
    \`\`\`css
    ${currentCss}
    \`\`\`

    JavaScript:
    \`\`\`javascript
    ${currentJs}
    \`\`\`

    Your Task:
    - Analyze the request and current code.
    - Apply the requested changes ONLY to the necessary language(s).
    - Return the *complete, updated code* for ALL THREE languages (html, css, js) in the specified JSON format, even if a language wasn't changed.

    CRITICAL FORMATTING INSTRUCTIONS:
    - Your entire response MUST be ONLY a single, raw, valid JSON object.
    - The JSON object MUST have these exact top-level keys: "html", "css", "js".
    - The value for each key MUST be a single string containing the complete, updated code for that language.
    - Do NOT include markdown formatting (\`\`\`json or \`\`\`).
    - Do NOT include any explanations, comments, conversational text, or any characters outside the single JSON object structure.
    - Ensure the strings within the JSON are properly escaped (use \\" for quotes, \\n for newlines).
    - The response MUST start directly with '{' and end directly with '}'.

    Example of the EXACT output format required:
    {"html":"<!DOCTYPE html>... updated html ...</html>","css":"/* Updated CSS */ ...","js":"// Updated JS ...\\ndocument.addEventListener(...);"}

    Generate the modified code now. Output ONLY the raw JSON object.`;

    // Use generateContentStream for streaming modifications
    const streamResult = await generationModel.generateContentStream(
      modificationPrompt
    );

    // Stream the response chunk by chunk
    for await (const chunk of streamResult.stream) {
      const blockReason = chunk.promptFeedback?.blockReason;
      if (blockReason) {
        console.warn(
          `Modification stream blocked during processing: ${blockReason}`,
          chunk.promptFeedback?.safetyRatings
        );
        res.write(
          JSON.stringify({
            stream_error: `Content modification blocked due to: ${blockReason}. Please revise prompt.`,
          })
        );
        break;
      }
      if (!chunk.candidates || chunk.candidates.length === 0) {
        console.warn("Modification stream chunk received with no candidates.");
        continue;
      }
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();
  } catch (error) {
    console.error(
      "Error during Gemini code modification stream setup or initial call:",
      error
    );
    const blockReason = (error as any)?.response?.promptFeedback?.blockReason;
    const errorMessage = blockReason
      ? `Content modification blocked by safety filter: ${blockReason}. Please revise your prompt.`
      : error instanceof Error
      ? error.message
      : "Unknown server error";

    if (!res.headersSent) {
      res
        .status(500)
        .type("text/plain")
        .send(`Server error modifying code: ${errorMessage}`);
    } else {
      try {
        res.write(
          `\n{"stream_error": "An error occurred during modification streaming: ${errorMessage.replace(
            /"/g,
            '\\"'
          )}"}`
        );
        res.end();
      } catch (writeError) {
        console.error("Error writing error message to stream:", writeError);
        res.end(); // Force end if writing fails
      }
    }
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using Gemini model: ${generationModel.model}`);
  console.log(`Validation model: ${validationModel.model}`);
});

// Export app for potential testing frameworks or serverless deployments
export default app;
