import type { AiGenerateOptions, AiMessage, AiProviderName } from "./types.js";

export interface AiProvider {
  readonly name: AiProviderName;
  generate(
    messages: AiMessage[],
    options?: AiGenerateOptions
  ): Promise<string>;
}
