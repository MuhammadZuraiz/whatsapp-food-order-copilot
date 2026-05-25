import type { BrandStyleProfile } from "./brandStyleApi";

export type ChatImportRequest = {
  chatName: string;
  customerKey?: string;
  customerPhone?: string;
  businessSenderNames: string[];
  rawText: string;
  runBrandStyleAnalysis: boolean;
  runCustomerMemoryUpdate: boolean;
};

export type ChatImportResponse = {
  conversation: {
    id: string;
    chatName: string;
    source: "imported_txt";
  };
  customer: {
    id: string;
    displayName: string;
  };
  import: {
    messageCount: number;
    businessMessageCount: number;
    customerMessageCount: number;
    warnings: string[];
  };
  brandStyle: {
    updated: boolean;
    profile: BrandStyleProfile | null;
  };
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export async function importChat(input: ChatImportRequest) {
  const response = await fetch(`${apiBaseUrl}/api/chats/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | ApiErrorResponse
      | null;

    throw new Error(
      errorBody?.error?.message ?? `Request failed with ${response.status}`
    );
  }

  return response.json() as Promise<ChatImportResponse>;
}
