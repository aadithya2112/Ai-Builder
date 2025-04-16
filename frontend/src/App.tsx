import { useState } from "react";
import LandingPage from "./pages/LandingPage";
import CodeEditor from "./components/CodeEditor";

function App() {
  const [showEditor, setShowEditor] = useState(false);
  const [html, setHtml] = useState(
    "<h1>Hello World</h1>\n<p>Start editing to see magic happen!</p>"
  );
  const [css, setCss] = useState(
    "h1 {\n  color: #2563eb;\n}\n\np {\n  color: #64748b;\n}"
  );
  const [js, setJs] = useState(
    '// Your JavaScript code here\nconsole.log("Hello from JS!");'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePromptSubmit = async (prompt: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("http://localhost:3000/api/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (data.success) {
        setHtml(data.html);
        setCss(data.css);
        setJs(data.js);
        setShowEditor(true);
      } else {
        setError(data.message || "Failed to generate code");
      }
    } catch (err) {
      console.error("Error generating code:", err);
      setError("Error connecting to the API. Please try again.");
    } finally {
      setIsLoading(false);
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
    <CodeEditor
      html={html}
      css={css}
      js={js}
      setHtml={setHtml}
      setCss={setCss}
      setJs={setJs}
    />
  );
}

export default App;
