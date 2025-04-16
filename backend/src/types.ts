export interface GenerateCodeRequest {
  prompt: string;
}

export interface GenerateCodeResponse {
  success: boolean;
  html: string;
  css: string;
  js: string;
  message?: string;
}

export interface ValidatePromptResponse {
  valid: boolean;
  reason?: string;
}
