import { useEffect, useState, type FormEvent } from "react";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  type Product,
  type ProductInput
} from "../api/productsApi";

type ProductFormState = {
  name: string;
  category: string;
  price: string;
  description: string;
  availabilityJson: string;
  customOptionsJson: string;
  minimumNoticeHours: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: ProductFormState = {
  name: "",
  category: "",
  price: "",
  description: "",
  availabilityJson: "",
  customOptionsJson: "",
  minimumNoticeHours: "",
  notes: "",
  isActive: true
};

const sampleProducts: ProductInput[] = [
  {
    name: "Chicken Biryani Tray",
    category: "Main",
    price: 45,
    description: "Future delivery biryani tray",
    availabilityJson: "Available for pre-order",
    customOptionsJson: "less spicy, extra raita",
    minimumNoticeHours: 24,
    isActive: true
  },
  {
    name: "Pasta Box",
    category: "Main",
    price: 35,
    description: "Pasta box for scheduled delivery",
    availabilityJson: "Available for pre-order",
    customOptionsJson: "extra cheese, no chili",
    minimumNoticeHours: 12,
    isActive: true
  },
  {
    name: "Dessert Platter",
    category: "Dessert",
    description: "Assorted dessert platter",
    availabilityJson: "Confirm availability manually",
    customOptionsJson: "custom message, nut-free request",
    minimumNoticeHours: 24,
    isActive: true
  }
];

function toNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();

  return trimmed ? Number(trimmed) : null;
}

function formToInput(form: ProductFormState): ProductInput {
  return {
    name: form.name.trim(),
    category: toNullableText(form.category),
    price: toNullableNumber(form.price),
    description: toNullableText(form.description),
    availabilityJson: toNullableText(form.availabilityJson),
    customOptionsJson: toNullableText(form.customOptionsJson),
    minimumNoticeHours: toNullableNumber(form.minimumNoticeHours),
    notes: toNullableText(form.notes),
    isActive: form.isActive
  };
}

function productToForm(product: Product): ProductFormState {
  return {
    name: product.name,
    category: product.category ?? "",
    price: product.price === null ? "" : String(product.price),
    description: product.description ?? "",
    availabilityJson: product.availabilityJson ?? "",
    customOptionsJson: product.customOptionsJson ?? "",
    minimumNoticeHours:
      product.minimumNoticeHours === null
        ? ""
        : String(product.minimumNoticeHours),
    notes: product.notes ?? "",
    isActive: product.isActive
  };
}

function ProductForm({
  editingProduct,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit
}: {
  editingProduct: Product | null;
  form: ProductFormState;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (form: ProductFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="border-b border-white/10 pb-4">
        <p className="text-sm font-medium uppercase text-emerald-300">
          Menu Knowledge
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {editingProduct ? "Edit Product" : "Add Product"}
        </h1>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-200">Name</span>
          <input
            className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Category
            </span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onChange({ ...form, category: event.target.value })
              }
              value={form.category}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">Price</span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              min="0"
              onChange={(event) =>
                onChange({ ...form, price: event.target.value })
              }
              step="0.01"
              type="number"
              value={form.price}
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-200">
            Description
          </span>
          <textarea
            className="min-h-20 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            value={form.description}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Availability
            </span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onChange({ ...form, availabilityJson: event.target.value })
              }
              value={form.availabilityJson}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Custom Options
            </span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onChange({ ...form, customOptionsJson: event.target.value })
              }
              value={form.customOptionsJson}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Minimum Notice Hours
            </span>
            <input
              className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              min="0"
              onChange={(event) =>
                onChange({ ...form, minimumNoticeHours: event.target.value })
              }
              step="1"
              type="number"
              value={form.minimumNoticeHours}
            />
          </label>

          <label className="flex items-center gap-3 rounded-md border border-white/10 bg-neutral-950 px-3 py-2 sm:self-end">
            <input
              checked={form.isActive}
              className="h-4 w-4 accent-emerald-300"
              onChange={(event) =>
                onChange({ ...form, isActive: event.target.checked })
              }
              type="checkbox"
            />
            <span className="text-sm font-medium text-neutral-200">Active</span>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-neutral-200">Notes</span>
          <textarea
            className="min-h-20 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            value={form.notes}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingProduct
                ? "Save Product"
                : "Add Product"}
          </button>
          {editingProduct ? (
            <button
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-white/30"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ProductList({
  onDelete,
  onEdit,
  onToggleActive,
  products
}: {
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  products: Product[];
}) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {products.filter((product) => product.isActive).length} active of{" "}
            {products.length} total
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {products.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">
            No products added yet.
          </p>
        ) : (
          products.map((product) => (
            <article
              className="rounded-md border border-white/10 bg-neutral-950 p-3"
              key={product.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-neutral-100">
                      {product.name}
                    </h3>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                        product.isActive
                          ? "bg-emerald-300 text-emerald-950"
                          : "bg-neutral-700 text-neutral-100"
                      }`}
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {[product.category, product.price === null ? null : `AED ${product.price}`]
                      .filter(Boolean)
                      .join(" | ") || "No category or price"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-100 transition hover:border-white/30"
                    onClick={() => onEdit(product)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-100 transition hover:border-white/30"
                    onClick={() => onToggleActive(product)}
                    type="button"
                  >
                    {product.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-300"
                    onClick={() => onDelete(product)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {product.description ? (
                <p className="mt-3 text-sm leading-6 text-neutral-300">
                  {product.description}
                </p>
              ) : null}

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-neutral-500">
                    Availability
                  </dt>
                  <dd className="mt-1 text-neutral-300">
                    {product.availabilityJson ?? "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">
                    Custom Options
                  </dt>
                  <dd className="mt-1 text-neutral-300">
                    {product.customOptionsJson ?? "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">
                    Minimum Notice
                  </dt>
                  <dd className="mt-1 text-neutral-300">
                    {product.minimumNoticeHours === null
                      ? "Not set"
                      : `${product.minimumNoticeHours} hours`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-neutral-500">Notes</dt>
                  <dd className="mt-1 text-neutral-300">
                    {product.notes ?? "None"}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadProducts() {
    setIsLoading(true);

    try {
      setProducts(await getProducts());
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load products."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const input = formToInput(form);

      if (editingProduct) {
        await updateProduct(editingProduct.id, input);
      } else {
        await createProduct(input);
      }

      setForm(emptyForm);
      setEditingProduct(null);
      await loadProducts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save product."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddSamples() {
    setError(null);
    setIsSaving(true);

    try {
      await Promise.all(sampleProducts.map((product) => createProduct(product)));
      await loadProducts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not add sample products."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    setError(null);

    try {
      await deleteProduct(product.id);
      await loadProducts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete product."
      );
    }
  }

  async function handleToggleActive(product: Product) {
    setError(null);

    try {
      await updateProduct(product.id, {
        isActive: !product.isActive
      });
      await loadProducts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update product."
      );
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
      <div className="grid gap-4 lg:h-fit">
        <ProductForm
          editingProduct={editingProduct}
          form={form}
          isSaving={isSaving}
          onCancel={() => {
            setEditingProduct(null);
            setForm(emptyForm);
          }}
          onChange={setForm}
          onSubmit={handleSubmit}
        />

        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-lg font-semibold">Samples</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Add a few starter products for analyzer testing.
          </p>
          <button
            className="mt-3 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-white/30 disabled:cursor-not-allowed disabled:text-neutral-500"
            disabled={isSaving}
            onClick={handleAddSamples}
            type="button"
          >
            Add Sample Products
          </button>
        </section>

        {error ? (
          <p className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-neutral-400">Loading products...</p>
        </section>
      ) : (
        <ProductList
          onDelete={handleDelete}
          onEdit={(product) => {
            setEditingProduct(product);
            setForm(productToForm(product));
          }}
          onToggleActive={handleToggleActive}
          products={products}
        />
      )}
    </div>
  );
}
