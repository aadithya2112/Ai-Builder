import { Wand2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function LandingPage({
  onSubmit,
  isLoading,
  error,
}: {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Wand2 className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            AI Website Builder
          </h1>
          <p className="text-gray-400 text-lg">
            Describe what you want to create and let AI generate the code for
            you
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a responsive navigation bar with a logo, links, and a dark theme toggle"
              className="w-full h-32 px-4 py-3 bg-[#111111] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none border border-[#2a2a2a] placeholder-gray-500"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className={`w-full flex items-center justify-center bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] ${
              isLoading || !prompt.trim() ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Code"
            )}
          </button>

          {isLoading && (
            <p className="text-center text-gray-400 text-sm">
              This may take a few seconds depending on the complexity of your
              request
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
