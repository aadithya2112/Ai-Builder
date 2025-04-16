import express, { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import cors from "cors";
import { TextBlock } from "@anthropic-ai/sdk/resources";

dotenv.config();

// Initialize express app
const app = express();
app.use(express.json());
app.use(cors());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Types for our application
interface GenerateCodeRequest {
  prompt: string;
}

interface GenerateCodeResponse {
  success: boolean;
  html: string;
  css: string;
  js: string;
  message?: string;
}

interface ValidatePromptResponse {
  valid: boolean;
  reason?: string;
}

// Utility to validate if a prompt can be implemented with HTML/CSS/JS
async function validatePrompt(prompt: string): Promise<ValidatePromptResponse> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      system: `You are an expert web developer evaluating if a project request can be implemented using only client-side HTML, CSS, and JavaScript without any backend services or databases. 
      
      Respond with a JSON object containing:
      1. "valid": boolean - true if the request can be implemented with HTML/CSS/JS, false otherwise
      2. "reason": string - short explanation of your decision
      
      Valid projects include static websites, simple games, UI components, animations, calculators, or applications that only use browser storage.
      
      Invalid projects include those requiring databases, authentication systems, payment processing, or any server-side functionality.
      
      IMPORTANT: Return ONLY the raw JSON object without markdown formatting, code blocks, or backticks.`,
      messages: [
        {
          role: "user",
          content: `Can this web project be implemented using only HTML, CSS, and JavaScript (no backend required)? The project is: "${prompt}"`,
        },
      ],
    });

    try {
      // Extract the JSON from the response
      const content = (response.content[0] as TextBlock).text;

      // Extract JSON content from markdown code block if present
      let jsonString = content;

      // Check if content is wrapped in code block and extract the JSON part
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
      }

      console.log("Extracted JSON string:", jsonString);

      const result = JSON.parse(jsonString);
      return {
        valid: result.valid,
        reason: result.reason,
      };
    } catch (parseError) {
      console.error("Failed to parse validation response:", parseError);
      // Add more detailed logging to help with debugging
      console.error("Parse error details:", (parseError as Error).message);
      return {
        valid: false,
        reason: "Failed to validate prompt: " + (parseError as Error).message,
      };
    }
  } catch (error) {
    console.error("Error validating prompt:", error);
    return {
      valid: false,
      reason: "Error validating prompt: " + (error as Error).message,
    };
  }
}

// Generate HTML, CSS, JS code based on the prompt
async function generateCode(prompt: string): Promise<GenerateCodeResponse> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 16384, // Increasing token limit for code generation
      system: `You are an expert web developer who creates complete, working websites using HTML, CSS, and JavaScript.

      The user will provide a description of a website they want to build. Your task is to generate:
      
      1. Clean, semantic HTML
      2. Modern CSS with responsive design principles
      3. Working JavaScript that implements the requested functionality
      
      IMPORTANT FORMATTING INSTRUCTIONS:
      - Return your response in JSON format with these exact fields:
        - "html": The complete HTML code
        - "css": The complete CSS code
        - "js": The complete JavaScript code
      - Include ALL necessary code for a fully functioning website
      - Make modern, responsive designs that work on mobile and desktop
      - Add helpful comments in your code
      - DO NOT include explanations outside the JSON structure
      - Include proper event listeners and DOM manipulation in JavaScript
      - Use ES6+ JavaScript features where appropriate
      - Add error handling in JavaScript
      - Include appropriate CSS resets/normalizations
      - Implement proper accessibility features (ARIA attributes where needed)
      - Ensure all interactive elements have hover/focus states
      
      Example response format:
      {
        "html": "<!DOCTYPE html><html lang="en">...</html>",
        "css": "* { box-sizing: border-box; }...",
        "js": "document.addEventListener('DOMContentLoaded', () => {...});"
      }
      Please make sure not to give new line character in the reponse format for html, css and js.
      IMPORTANT: Return ONLY the raw JSON object without markdown formatting, code blocks, or backticks.
      `,
      messages: [
        {
          role: "user",
          content: `Create a complete, working website based on this description: "${prompt}"`,
        },
      ],
    });

    try {
      // Extract the JSON from the response
      const content = (response.content[0] as TextBlock).text;
      // Find JSON content (it might be wrapped in ```json blocks)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/```\n([\s\S]*?)\n```/) || [null, content];

      const jsonString = jsonMatch[1] || content;
      const result = JSON.parse(jsonString);

      return {
        success: true,
        html: result.html || "",
        css: result.css || "",
        js: result.js || "",
      };
    } catch (parseError) {
      console.error("Failed to parse code generation response:", parseError);
      return {
        success: false,
        html: "",
        css: "",
        js: "",
        message: "Failed to parse generated code",
      };
    }
  } catch (error) {
    console.error("Error generating code:", error);
    return {
      success: false,
      html: "",
      css: "",
      js: "",
      message: "Error generating code",
    };
  }
}

// API Routes
app.post("/api/validate-prompt", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;
  console.log(prompt);
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({
      valid: false,
      reason:
        "Invalid prompt format. Please provide a text description of your website.",
    });
    return;
  }

  try {
    const validationResult = await validatePrompt(prompt);
    res.json(validationResult);
  } catch (error) {
    console.error("Error in validate-prompt endpoint:", error);
    res.status(500).json({
      valid: false,
      reason: "Server error while validating prompt",
    });
  }
});

app.post("/api/generate-code", async (req: Request, res: Response) => {
  const { prompt } = req.body as GenerateCodeRequest;

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({
      // Added return here
      success: false,
      html: "",
      css: "",
      js: "",
      message:
        "Invalid prompt format. Please provide a text description of your website.",
    });
  }

  try {
    // First validate if the prompt is feasible
    const validationResult = await validatePrompt(prompt);

    if (!validationResult.valid) {
      res.json({
        // Added return here
        success: false,
        html: "",
        css: "",
        js: "",
        message:
          validationResult.reason ||
          "Your request cannot be implemented with HTML/CSS/JS alone",
      });
    }

    // If valid, generate the code
    const codeResult = await generateCode(prompt);
    res.json(codeResult);
  } catch (error) {
    console.error("Error in generate-code endpoint:", error);
    res.status(500).json({
      success: false,
      html: "",
      css: "",
      js: "",
      message: "Server error while generating code",
    });
  }
});

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
