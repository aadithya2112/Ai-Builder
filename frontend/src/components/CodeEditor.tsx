import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  setHtml: (value: string) => void;
  setCss: (value: string) => void;
  setJs: (value: string) => void;
}

export default function CodeEditor({
  html,
  css,
  js,
  setHtml,
  setCss,
  setJs,
}: CodeEditorProps) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    // Add a delay to prevent too many rerenders during typing
    const timeout = setTimeout(() => {
      const formattedHtml = html.trim();
      const formattedCss = css.trim();
      const formattedJs = js.trim();

      setSrcDoc(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${formattedCss}</style>
        </head>
        <body>
          ${formattedHtml}
          <script>${formattedJs}</script>
        </body>
        </html>
      `);
    }, 300);

    return () => clearTimeout(timeout);
  }, [html, css, js]);

  // Format the initial code inputs for better display in the editor
  useEffect(() => {
    // Only format if the content seems to be all on one line
    if (html && !html.includes("\n")) {
      try {
        // Basic HTML formatting - find closing tags and add newlines
        const formattedHtml = html
          .replace(/></g, ">\n<")
          .replace(/(<\/[^>]+>)(?![\s\n])/g, "$1\n");
        setHtml(formattedHtml);
      } catch (err) {
        console.error("Error formatting HTML:", err);
      }
    }

    if (css && !css.includes("\n")) {
      try {
        // Basic CSS formatting - add newlines after closing braces and semicolons
        const formattedCss = css
          .replace(/}(?![\s\n])/g, "}\n")
          .replace(/;(?![\s\n])/g, ";\n")
          .replace(/{(?![\s\n])/g, "{\n  ");
        setCss(formattedCss);
      } catch (err) {
        console.error("Error formatting CSS:", err);
      }
    }

    if (js && !js.includes("\n")) {
      try {
        // Basic JS formatting - add newlines after semicolons and curly braces
        const formattedJs = js
          .replace(/;(?![\s\n])/g, ";\n")
          .replace(/{(?![\s\n])/g, "{\n  ")
          .replace(/}(?![\s\n])/g, "}\n");
        setJs(formattedJs);
      } catch (err) {
        console.error("Error formatting JS:", err);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white">
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-[#333] p-4">
          <h1 className="text-xl font-bold">AI Code Generator</h1>
          <div className="flex items-center gap-4">
            <button className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-700">
              Save
            </button>
            <button className="rounded bg-green-600 px-4 py-2 hover:bg-green-700">
              Export
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 overflow-hidden">
                <div className="h-1/3">
                  <div className="flex h-8 items-center bg-[#252525] px-4">
                    HTML
                  </div>
                  <Editor
                    height="calc(100% - 32px)"
                    defaultLanguage="html"
                    value={html}
                    onChange={(value) => setHtml(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>
                <div className="h-1/3">
                  <div className="flex h-8 items-center bg-[#252525] px-4">
                    CSS
                  </div>
                  <Editor
                    height="calc(100% - 32px)"
                    defaultLanguage="css"
                    value={css}
                    onChange={(value) => setCss(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>
                <div className="h-1/3">
                  <div className="flex h-8 items-center bg-[#252525] px-4">
                    JavaScript
                  </div>
                  <Editor
                    height="calc(100% - 32px)"
                    defaultLanguage="javascript"
                    value={js}
                    onChange={(value) => setJs(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>
              </div>

              <div className="w-1/2">
                <div className="flex h-8 items-center bg-[#252525] px-4">
                  Preview
                </div>
                <iframe
                  title="preview"
                  sandbox="allow-scripts"
                  srcDoc={srcDoc}
                  className="h-[calc(100%-32px)] w-full bg-white"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
