import type { Usage } from "../types";

export interface AiRequest {
  prompt: string;
  system?: string;
  search?: boolean; // autoriser la recherche web
  json?: boolean; // réponse JSON attendue
  maxSearches?: number;
}

export interface AiResponse {
  text: string;
  usage: Usage;
}

export class AiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}
