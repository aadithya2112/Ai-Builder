import { useState, useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
// This import should now work after installing the package
import * as monaco from "monaco-editor";

interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  setHtml: (value: string) => void;
  setCss: (value: string) => void;
  setJs: (value: string) => void;
  isLoading: boolean;
  isChatLoading: boolean;
  error: string | null;
  chatError: string | null;
}

// Helper function to trigger file download (Unchanged)
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function CodeEditor({
  html,
  css,
  js,
  setHtml,
  setCss,
  setJs,
  isLoading,
  isChatLoading,
  error,
  chatError,
}: CodeEditorProps) {
  const [srcDoc, setSrcDoc] = useState("");

  // Use the correctly imported type for refs
  const htmlEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );
  const cssEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const jsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // --- Store editor instances on mount ---
  const handleHtmlEditorDidMount: OnMount = (editor /*, monacoInstance */) => {
    htmlEditorRef.current = editor;
  };
  const handleCssEditorDidMount: OnMount = (editor /*, monacoInstance */) => {
    cssEditorRef.current = editor;
  };
  const handleJsEditorDidMount: OnMount = (editor /*, monacoInstance */) => {
    jsEditorRef.current = editor;
  };

  // --- Function to trigger formatting on all editors ---
  const formatAllCode = () => {
    console.log("Attempting to format code...");
    // Use optional chaining safely
    htmlEditorRef.current?.getAction("editor.action.formatDocument")?.run();
    cssEditorRef.current?.getAction("editor.action.formatDocument")?.run();
    jsEditorRef.current?.getAction("editor.action.formatDocument")?.run();
  };

  // --- Effect to trigger formatting after successful loading ---
  const prevIsLoading = useRef(isLoading);
  const prevIsChatLoading = useRef(isChatLoading);

  useEffect(() => {
    if (prevIsLoading.current && !isLoading && !error) {
      console.log("Generation finished successfully, formatting...");
      formatAllCode();
    }
    if (prevIsChatLoading.current && !isChatLoading && !chatError) {
      console.log("Modification finished successfully, formatting...");
      formatAllCode();
    }
    prevIsLoading.current = isLoading;
    prevIsChatLoading.current = isChatLoading;
  }, [isLoading, isChatLoading, error, chatError]);

  // Update the preview iframe content (Unchanged)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSrcDoc(`
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title><style>${css}</style></head><body>${html}<script>${js}</script></body></html>
      `);
    }, 300);
    return () => clearTimeout(timeout);
  }, [html, css, js]);

  // Handle Download (Unchanged)
  const handleDownload = () => {
    downloadFile(html, "index.html", "text/html");
    downloadFile(css, "style.css", "text/css");
    downloadFile(js, "script.js", "text/javascript");
  };

  // Editor Options (Unchanged)
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: "on" as const,
    formatOnPaste: true,
    formatOnType: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
  };

  return (
    // --- JSX Structure (Unchanged) ---
    <div className="min-h-screen bg-[#1e1e1e] text-white">
      <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-[#333] p-4">
          <h1 className="text-xl font-bold">AI Code Generator</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              className="rounded bg-purple-600 px-4 py-2 text-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              title="Download HTML, CSS, and JS files"
            >
              {" "}
              Download All{" "}
            </button>
            {/* Other buttons */}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Editors Pane */}
          <div className="flex w-1/2 flex-col overflow-hidden border-r border-[#333]">
            {/* HTML Editor */}
            <div className="flex h-1/3 flex-col border-b border-[#333]">
              <div className="flex h-8 flex-shrink-0 items-center bg-[#252525] px-4 text-sm font-medium">
                {" "}
                HTML{" "}
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language="html"
                  value={html}
                  theme="vs-dark"
                  options={editorOptions}
                  onChange={(value) => setHtml(value || "")}
                  onMount={handleHtmlEditorDidMount}
                />
              </div>
            </div>
            {/* CSS Editor */}
            <div className="flex h-1/3 flex-col border-b border-[#333]">
              <div className="flex h-8 flex-shrink-0 items-center bg-[#252525] px-4 text-sm font-medium">
                {" "}
                CSS{" "}
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language="css"
                  value={css}
                  theme="vs-dark"
                  options={editorOptions}
                  onChange={(value) => setCss(value || "")}
                  onMount={handleCssEditorDidMount}
                />
              </div>
            </div>
            {/* JavaScript Editor */}
            <div className="flex h-1/3 flex-col">
              <div className="flex h-8 flex-shrink-0 items-center bg-[#252525] px-4 text-sm font-medium">
                {" "}
                JavaScript{" "}
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language="javascript"
                  value={js}
                  theme="vs-dark"
                  options={editorOptions}
                  onChange={(value) => setJs(value || "")}
                  onMount={handleJsEditorDidMount}
                />
              </div>
            </div>
          </div>
          {/* Preview Pane */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <div className="flex h-8 flex-shrink-0 items-center bg-[#252525] px-4 text-sm font-medium">
              {" "}
              Preview{" "}
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                title="preview"
                sandbox="allow-scripts"
                srcDoc={srcDoc}
                className="h-full w-full border-none bg-white"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
