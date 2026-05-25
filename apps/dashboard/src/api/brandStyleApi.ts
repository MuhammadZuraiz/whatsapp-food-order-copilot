export type BrandStyleProfile = {
  id: string;
  toneSummary: string | null;
  commonPhrases: string[];
  doRules: string[];
  dontRules: string[];
  exampleReplies: string[];
  createdAt: string;
  updatedAt: string;
};

export type BrandStyleAnalyzeRequest = {
  conversationIds?: string[];
  businessSenderNames: string[];
  limit?: number;
};

export type BrandStyleAnalyzeResponse = {
  updated: boolean;
  profile: BrandStyleProfile | null;
  warnings: string[];
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | ApiErrorResponse
      | null;

    throw new Error(
      errorBody?.error?.message ?? `Request failed with ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getBrandStyle() {
  const response = await fetch(`${apiBaseUrl}/api/brand-style`);

  return parseResponse<BrandStyleProfile | null>(response);
}

export async function analyzeBrandStyle(input: BrandStyleAnalyzeRequest) {
  const response = await fetch(`${apiBaseUrl}/api/brand-style/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<BrandStyleAnalyzeResponse>(response);
}
