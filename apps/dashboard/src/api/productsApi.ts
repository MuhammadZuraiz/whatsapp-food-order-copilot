export type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  availabilityJson: string | null;
  customOptionsJson: string | null;
  minimumNoticeHours: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  category?: string | null;
  price?: number | null;
  description?: string | null;
  availabilityJson?: string | null;
  customOptionsJson?: string | null;
  minimumNoticeHours?: number | null;
  isActive?: boolean;
  notes?: string | null;
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

export async function getProducts() {
  const response = await fetch(`${apiBaseUrl}/api/products`);

  return parseResponse<Product[]>(response);
}

export async function createProduct(input: ProductInput) {
  const response = await fetch(`${apiBaseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<Product>(response);
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const response = await fetch(`${apiBaseUrl}/api/products/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<Product>(response);
}

export async function deleteProduct(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/products/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | ApiErrorResponse
      | null;

    throw new Error(
      errorBody?.error?.message ?? `Request failed with ${response.status}`
    );
  }
}
