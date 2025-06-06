import { useState } from "react";
import LandingPage from "./pages/LandingPage";
import CodeEditor from "./components/CodeEditor";
import { API_URL } from "../config";

function extractPartialValue(key: string, partialJson: string): string {
  const keyPattern = `"${key}":\\s*"`;
  const startIndex = partialJson.lastIndexOf(keyPattern);
  if (startIndex === -1) return "";
  const valueStartIndex = startIndex + keyPattern.length;
  let endIndex = -1;
  let i = valueStartIndex;
  let openBraces = 0;
  while (i < partialJson.length) {
    const char = partialJson[i];
    if (char === '"' && (i === 0 || partialJson[i - 1] !== "\\")) {
      const nextChars = partialJson.substring(i + 1, i + 4);
      if (nextChars.startsWith(",") || nextChars.startsWith("}")) {
        endIndex = i;
        break;
      }
    } else if (char === "{") {
      openBraces++;
    } else if (char === "}") {
      if (openBraces > 0) openBraces--;
    }
    if (i === partialJson.length - 1) {
      endIndex = partialJson.length;
      break;
    }
    i++;
  }
  if (endIndex !== -1) {
    const potentialValue = partialJson.substring(valueStartIndex, endIndex);
    try {
      if (potentialValue.length > 0 && !potentialValue.includes('",')) {
        const parsedAttempt = JSON.parse(
          `"${potentialValue
            .replace(/\\"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")}"`
        );
        return parsedAttempt;
      }
      return potentialValue;
    } catch (e) {
      return potentialValue;
    }
  } else {
    return partialJson.substring(valueStartIndex);
  }
}

function App() {
  const [showEditor, setShowEditor] = useState(false);
  const [html, setHtml] = useState("<!-- HTML code will appear here -->");
  const [css, setCss] = useState("/* CSS code will appear here */");
  const [js, setJs] = useState("// JavaScript code will appear here");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const handlePromptSubmit = async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setChatError(null);
    setHtml("<!-- Generating HTML... -->");
    setCss("/* Generating CSS... */");
    setJs("// Generating JavaScript...");
    setShowEditor(true);

    let success = false;

    try {
      const response = await fetch(`${API_URL}/api/generate-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          setError("Bad Request: Please check your input.");
        } else if (response.status === 500) {
          setError("Server Error: Please try again later.");
        } else {
          setError("Unexpected Error: Please try again.");
        }
        console.error("Response Error:", response.statusText);
        return;
      }
      if (!response.body) throw new Error("Response body is missing");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedJson = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedJson += chunk;
        const partialHtml = extractPartialValue("html", accumulatedJson);
        const partialCss = extractPartialValue("css", accumulatedJson);
        const partialJs = extractPartialValue("js", accumulatedJson);
        setHtml((prev) => (partialHtml !== prev ? partialHtml : prev));
        setCss((prev) => (partialCss !== prev ? partialCss : prev));
        setJs((prev) => (partialJs !== prev ? partialJs : prev));
      }

      console.log(
        "Final Accumulated JSON string (Generation):",
        accumulatedJson
      );
      try {
        const data = JSON.parse(accumulatedJson);
        if (data.error) {
          setError(`Generation Error: ${data.error}`);
        } else if (
          data.html !== undefined &&
          data.css !== undefined &&
          data.js !== undefined
        ) {
          setHtml(data.html || "");
          setCss(data.css || "");
          setJs(data.js || "");
          setError(null);
          success = true;
        } else {
          setError("Invalid data structure received.");
        }
      } catch (parseError) {
        setError("Failed to process generated code.");
        console.error("Parse Error:", parseError);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    setIsChatLoading(true);
    setChatError(null);
    setError(null);
    const modificationPrompt = chatInput;
    setChatInput("");

    let success = false;

    try {
      const response = await fetch(`${API_URL}/api/modify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentHtml: html,
          currentCss: css,
          currentJs: js,
          prompt: modificationPrompt,
        }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          setChatError("Bad Request: Please check your input.");
        } else if (response.status === 500) {
          setChatError("Server Error: Please try again later.");
        } else {
          setChatError("Unexpected Error: Please try again.");
        }
        console.error("Response Error (Modify):", response.statusText);
        return;
      }
      if (!response.body) throw new Error("Response body is missing");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedJson = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedJson += chunk;
        const partialHtml = extractPartialValue("html", accumulatedJson);
        const partialCss = extractPartialValue("css", accumulatedJson);
        const partialJs = extractPartialValue("js", accumulatedJson);
        setHtml((prev) => (partialHtml !== prev ? partialHtml : prev));
        setCss((prev) => (partialCss !== prev ? partialCss : prev));
        setJs((prev) => (partialJs !== prev ? partialJs : prev));
      }

      console.log(
        "Final Accumulated JSON string (Modification):",
        accumulatedJson
      );
      try {
        const data = JSON.parse(accumulatedJson);
        if (data.error) {
          setChatError(`Modification Error: ${data.error}`);
          console.error("Streamed Error (Modify):", data.error);
        } else if (
          data.html !== undefined &&
          data.css !== undefined &&
          data.js !== undefined
        ) {
          setHtml(data.html || "");
          setCss(data.css || "");
          setJs(data.js || "");
          setChatError(null);
          success = true;
        } else {
          setChatError(
            "Received incomplete or invalid data structure after modification."
          );
          console.error("Invalid final JSON structure (Modify):", data);
        }
      } catch (parseError) {
        setChatError("Failed to process the modified code (invalid format).");
        console.error("Failed to parse final JSON (Modify):", parseError);
      }
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred during modification."
      );
      console.error("Error fetching or processing modification stream:", err);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!showEditor) {
    return (
      <LandingPage
        onSubmit={handlePromptSubmit}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {isLoading && (
        <div className="flex-shrink-0 bg-blue-100 p-2 text-center text-blue-800">
          Generating initial code...
        </div>
      )}
      {error && !isLoading && (
        <div className="flex-shrink-0 bg-red-100 p-2 text-center text-red-800">
          Generation Error: {error}
        </div>
      )}
      {isChatLoading && (
        <div className="flex-shrink-0 bg-yellow-100 p-2 text-center text-yellow-800">
          Applying changes...
        </div>
      )}
      {chatError && !isChatLoading && (
        <div className="flex-shrink-0 bg-red-100 p-2 text-center text-red-800">
          Modification Error: {chatError}
        </div>
      )}
      <div className="flex-grow overflow-hidden">
        <CodeEditor
          html={html}
          css={css}
          js={js}
          setHtml={setHtml}
          setCss={setCss}
          setJs={setJs}
          isLoading={isLoading}
          isChatLoading={isChatLoading}
          error={error}
          chatError={chatError}
        />
      </div>
      <div className="flex-shrink-0 border-t border-[#333] bg-[#1e1e1e] p-4">
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Enter changes (e.g., 'Make the button background red')..."
            className="flex-grow rounded border border-[#444] bg-[#252525] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isChatLoading || isLoading}
          />
          <button
            type="submit"
            className={`rounded px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
              isChatLoading || isLoading
                ? "cursor-not-allowed bg-gray-500"
                : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
            }`}
            disabled={isChatLoading || isLoading}
          >
            {isChatLoading || isLoading ? "Processing..." : "Apply Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
