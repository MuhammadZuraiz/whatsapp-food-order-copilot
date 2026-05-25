export type CustomerListItem = {
  id: string;
  displayName: string;
  phoneRaw: string | null;
  profileSummary: string | null;
  usualAddress: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    conversationCount: number;
    orderCount: number;
    noteCount: number;
  };
  lastConversationAt: string | null;
};

export type CustomerNote = {
  id: string;
  customerId: string;
  note: string;
  createdAt: string;
};

export type CustomerConversation = {
  id: string;
  source: string;
  whatsappChatName: string | null;
  lastMessageAt: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  counts: {
    messageCount: number;
    orderCount: number;
    suggestedReplyCount: number;
  };
};

export type CustomerOrder = {
  id: string;
  status: string;
  items: string[];
  deliveryDate: string | null;
  deliveryTime: string | null;
  address: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDetail = {
  id: string;
  displayName: string;
  phoneRaw: string | null;
  profileSummary: string | null;
  usualAddress: string | null;
  preferencesJson: string | null;
  preferences: string[];
  notes: string | null;
  parsedNotes: string[];
  createdAt: string;
  updatedAt: string;
  counts: CustomerListItem["counts"];
  customerNotes: CustomerNote[];
  recentConversations: CustomerConversation[];
  recentOrders: CustomerOrder[];
};

export type CustomerUpdateInput = {
  displayName?: string;
  phoneRaw?: string | null;
  profileSummary?: string | null;
  usualAddress?: string | null;
  preferences?: string[];
  notes?: string | null;
};

export type RefreshMemoryResponse = {
  customer: CustomerDetail & {
    phoneHash?: string | null;
  };
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

export async function getCustomers(search = "") {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();
  const response = await fetch(`${apiBaseUrl}/api/customers${query ? `?${query}` : ""}`);

  return parseResponse<CustomerListItem[]>(response);
}

export async function getCustomer(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/customers/${id}`);

  return parseResponse<CustomerDetail>(response);
}

export async function updateCustomer(id: string, input: CustomerUpdateInput) {
  const response = await fetch(`${apiBaseUrl}/api/customers/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<CustomerDetail>(response);
}

export async function addCustomerNote(id: string, note: string) {
  const response = await fetch(`${apiBaseUrl}/api/customers/${id}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ note })
  });

  return parseResponse<CustomerNote>(response);
}

export async function refreshCustomerMemory(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/customers/${id}/refresh-memory`, {
    method: "POST"
  });

  return parseResponse<RefreshMemoryResponse>(response);
}
