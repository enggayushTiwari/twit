import { getErrorMessage } from "./errors";

export function parseJsonResponse<T>(rawText: string, fallbackMessage: string): T {
  const cleanText = rawText.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(cleanText) as T;
  } catch (error) {
    throw new Error(`${fallbackMessage}: ${getErrorMessage(error, "invalid JSON")}`);
  }
}
