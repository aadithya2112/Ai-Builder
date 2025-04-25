import express, { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import cors from "cors";
import { TextBlock } from "@anthropic-ai/sdk/resources";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

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

async function validatePrompt(prompt: string): Promise<ValidatePromptResponse> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      system: `You are an expert web developer evaluating if a project request can be implemented using only client-side HTML, CSS, and JavaScript without any backend services or databases. 
      
      Respond with a JSON object containing:
      1. "valid": boolean - true if the request can be implemented with HTML/CSS/JS, false otherwise
      2. "reason": string - short explanation of your decision
      
      Valid projects include static websites, simple games, UI components, animations, calculators, or applications that only use browser storage.
      
      Invalid projects include those requiring databases, authentication systems, payment processing, or any server-side functionality.
      
      IMPORTANT: Return ONLY the raw JSON object without markdown formatting, code blocks, or backticks. Example: {"valid": true, "reason": "This is a static UI component."}`,
      messages: [
        {
          role: "user",
          content: `Can this web project be implemented using only HTML, CSS, and JavaScript (no backend required)? The project is: "${prompt}"`,
        },
      ],
    });

    try {
      const content = (response.content[0] as TextBlock).text;
      let jsonString = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
      } else {
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonString = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      const result = JSON.parse(jsonString);
      return {
        valid: result.valid,
        reason: result.reason,
      };
    } catch (parseError) {
      return {
        valid: false,
        reason: "Failed to validate prompt: Could not parse AI response.",
      };
    }
  } catch (error) {
    return {
      valid: false,
      reason: "Error validating prompt: " + (error as Error).message,
    };
  }
}

app.post("/api/validate-prompt", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({
      valid: false,
      reason:
        "Invalid prompt format. Please provide a non-empty text description of your website.",
    });
    return;
  }

  try {
    const validationResult = await validatePrompt(prompt);
    res.json(validationResult);
  } catch (error) {
    res.status(500).json({
      valid: false,
      reason: "Server error while validating prompt",
    });
  }
});

app.post("/api/generate-code", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res
      .status(400)
      .send(
        "Invalid prompt format. Please provide a non-empty text description of your website."
      );
    return;
  }

  try {
    const validationResult = await validatePrompt(prompt);
    if (!validationResult.valid) {
      res
        .status(400)
        .send(
          `Prompt validation failed: ${
            validationResult.reason ||
            "Request cannot be implemented with HTML/CSS/JS alone"
          }`
        );
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = await anthropic.messages.stream({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      system: `You are an expert web developer who creates complete, working websites using HTML, CSS, and JavaScript.

      The user will provide a description of a website they want to build. Your task is to generate:
      
      1. Clean, semantic HTML
      2. Modern CSS with responsive design principles
      3. Working JavaScript that implements the requested functionality
      
      IMPORTANT FORMATTING INSTRUCTIONS:
      - Return your response in JSON format with these exact fields:
        - "html": The complete HTML code as a single string.
        - "css": The complete CSS code as a single string.
        - "js": The complete JavaScript code as a single string.
      - Include ALL necessary code for a fully functioning website.
      - Make modern, responsive designs that work on mobile and desktop.
      - Add helpful comments in your code.
      - DO NOT include explanations outside the JSON structure.
      - Include proper event listeners and DOM manipulation in JavaScript.
      - Use ES6+ JavaScript features where appropriate.
      - Add basic error handling in JavaScript.
      - Include appropriate CSS resets/normalizations (like box-sizing).
      - Implement basic accessibility features (e.g., alt attributes, semantic HTML).
      - Ensure interactive elements have basic hover/focus states in CSS.
      
      Example response format (ensure JSON is valid):
      {
        "html": "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>My App</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><div id=\"app\"></div><script src=\"script.js\"></script></body></html>",
        "css": "*, *::before, *::after { box-sizing: border-box; } body { margin: 0; font-family: sans-serif; } #app { padding: 1rem; }",
        "js": "document.addEventListener('DOMContentLoaded', () => { const app = document.getElementById('app'); app.innerHTML = '<h1>Hello World!</h1>'; });"
      }

      IMPORTANT: Return ONLY the raw, valid JSON object. Do not wrap it in markdown code blocks (like \`\`\`json ... \`\`\`) or add any other text before or after the JSON. Ensure the strings within the JSON are properly escaped if necessary.
      `,
      messages: [
        {
          role: "user",
          content: `Create a complete, working website based on this description: "${prompt}"`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(event.delta.text);
      }
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send("Server error while generating code stream.");
    } else {
      res.end('\n{"error": "An error occurred during streaming."}');
    }
  }
});

app.post("/api/modify-code", async (req: Request, res: Response) => {
  const { prompt, currentHtml, currentCss, currentJs } =
    req.body as ModifyCodeRequest;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).send("Invalid modification prompt provided.");
    return;
  }
  if (
    currentHtml === undefined ||
    currentCss === undefined ||
    currentJs === undefined
  ) {
    res.status(400).send("Missing current code (HTML, CSS, or JS).");
    return;
  }

  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = await anthropic.messages.stream({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      system: `You are an expert web developer. You are tasked with modifying an existing set of HTML, CSS, and JavaScript code based on a user's request.

      RULES:
      - Analyze the user's request and the provided code carefully.
      - Apply the requested changes to the appropriate language(s) (HTML, CSS, JS).
      - Return the *complete, updated code* for ALL THREE languages, even if only one was modified.
      - Ensure the returned code is fully functional and integrates the changes.
      - Maintain clean, semantic, and well-commented code.

      IMPORTANT FORMATTING INSTRUCTIONS:
      - Return your response ONLY as a single, raw, valid JSON object.
      - The JSON object MUST have these exact fields: "html", "css", "js".
      - The value for each field MUST be a single string containing the complete code for that language.
      - Do NOT wrap the JSON in markdown code blocks (\`\`\`).
      - Do NOT include any explanations or conversational text outside the JSON structure.

      Example response format:
      {
        "html": "<!DOCTYPE html>...",
        "css": "body { ... } ...",
        "js": "document.addEventListener..."
      }`,
      messages: [
        {
          role: "user",
          content: `Modify the following website code based on this request: "${prompt}"

Current HTML:
\`\`\`html
${currentHtml}
\`\`\`

Current CSS:
\`\`\`css
${currentCss}
\`\`\`

Current JavaScript:
\`\`\`javascript
${currentJs}
\`\`\`

Please provide the complete updated code in the specified JSON format.`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(event.delta.text);
      }
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send("Server error while modifying code stream.");
    } else {
      res.end(
        '\n{"error": "An error occurred during modification streaming."}'
      );
    }
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
