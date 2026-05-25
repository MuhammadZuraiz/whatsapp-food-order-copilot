import { useEffect, useState, type FormEvent } from "react";
import {
  addCustomerNote,
  getCustomer,
  getCustomers,
  refreshCustomerMemory,
  updateCustomer,
  type CustomerDetail,
  type CustomerListItem
} from "../api/customersApi";

type ProfileFormState = {
  displayName: string;
  phoneRaw: string;
  profileSummary: string;
  usualAddress: string;
  preferences: string;
  notes: string;
};

function toForm(customer: CustomerDetail): ProfileFormState {
  return {
    displayName: customer.displayName,
    phoneRaw: customer.phoneRaw ?? "",
    profileSummary: customer.profileSummary ?? "",
    usualAddress: customer.usualAddress ?? "",
    preferences: customer.preferences.join("\n"),
    notes: customer.notes ?? ""
  };
}

function toNullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function splitLines(value: string) {
  return value
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null) {
  if (!value) {
    return "None yet";
  }

  return new Date(value).toLocaleString();
}

function CustomerList({
  customers,
  selectedId,
  onSelect
}: {
  customers: CustomerListItem[];
  selectedId: string | null;
  onSelect: (customer: CustomerListItem) => void;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold">Customers</h2>
      <div className="mt-4 grid gap-3">
        {customers.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">
            No customers found.
          </p>
        ) : (
          customers.map((customer) => (
            <button
              className={`rounded-md border p-3 text-left transition ${
                selectedId === customer.id
                  ? "border-emerald-300 bg-emerald-300/10"
                  : "border-white/10 bg-neutral-950 hover:border-white/30"
              }`}
              key={customer.id}
              onClick={() => onSelect(customer)}
              type="button"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-100">
                    {customer.displayName}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Last chat: {formatDate(customer.lastConversationAt)}
                  </p>
                </div>
                <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-xs text-neutral-300">
                  {customer.counts.conversationCount} chats
                </span>
              </div>
              {customer.profileSummary ? (
                <p className="mt-2 line-clamp-2 text-sm text-neutral-400">
                  {customer.profileSummary}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-neutral-500">
                {customer.counts.orderCount} orders |{" "}
                {customer.counts.noteCount} notes
              </p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function CustomerDetailPanel({
  customer,
  form,
  isSaving,
  isRefreshing,
  memoryWarnings,
  note,
  onFormChange,
  onNoteChange,
  onRefresh,
  onSave,
  onSubmitNote
}: {
  customer: CustomerDetail;
  form: ProfileFormState;
  isSaving: boolean;
  isRefreshing: boolean;
  memoryWarnings: string[];
  note: string;
  onFormChange: (form: ProfileFormState) => void;
  onNoteChange: (note: string) => void;
  onRefresh: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitNote: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{customer.displayName}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {customer.counts.conversationCount} conversations |{" "}
              {customer.counts.orderCount} orders | {customer.counts.noteCount} notes
            </p>
          </div>
          <button
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-100 transition hover:border-white/30 disabled:cursor-not-allowed disabled:text-neutral-500"
            disabled={isRefreshing}
            onClick={onRefresh}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh Memory from Chats"}
          </button>
        </div>

        {memoryWarnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
            {memoryWarnings.map((warning) => (
              <p className="text-sm text-amber-200" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-neutral-500">Phone</dt>
            <dd className="mt-1 text-sm text-neutral-100">
              {customer.phoneRaw ?? "Not saved"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-neutral-500">
              Usual Address
            </dt>
            <dd className="mt-1 text-sm text-neutral-100">
              {customer.usualAddress ?? "Not saved"}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="text-xs uppercase text-neutral-500">Profile Summary</p>
          <p className="mt-1 text-sm leading-6 text-neutral-300">
            {customer.profileSummary ?? "No profile summary saved yet."}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase text-neutral-500">Preferences</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {customer.preferences.length > 0 ? (
              customer.preferences.map((preference) => (
                <span
                  className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-medium text-emerald-950"
                  key={preference}
                >
                  {preference}
                </span>
              ))
            ) : (
              <span className="text-sm text-neutral-400">None saved</span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-lg font-semibold">Edit Profile</h2>
        <form className="mt-4 grid gap-4" onSubmit={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-neutral-200">
                Display name
              </span>
              <input
                className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
                onChange={(event) =>
                  onFormChange({ ...form, displayName: event.target.value })
                }
                required
                value={form.displayName}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-neutral-200">
                Phone
              </span>
              <input
                className="rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
                onChange={(event) =>
                  onFormChange({ ...form, phoneRaw: event.target.value })
                }
                value={form.phoneRaw}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Profile summary
            </span>
            <textarea
              className="min-h-20 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onFormChange({ ...form, profileSummary: event.target.value })
              }
              value={form.profileSummary}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Usual address
            </span>
            <textarea
              className="min-h-20 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onFormChange({ ...form, usualAddress: event.target.value })
              }
              value={form.usualAddress}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">
              Preferences
            </span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onFormChange({ ...form, preferences: event.target.value })
              }
              value={form.preferences}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-neutral-200">Notes</span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm leading-6 text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) =>
                onFormChange({ ...form, notes: event.target.value })
              }
              value={form.notes}
            />
          </label>

          <button
            className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save Customer"}
          </button>
        </form>
      </section>

      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-lg font-semibold">Customer Notes</h2>
        <form className="mt-4 flex gap-2" onSubmit={onSubmitNote}>
          <input
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add a note"
            value={note}
          />
          <button
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-white/30"
            type="submit"
          >
            Add
          </button>
        </form>
        <div className="mt-4 grid gap-2">
          {customer.customerNotes.length > 0 ? (
            customer.customerNotes.map((customerNote) => (
              <article
                className="rounded-md border border-white/10 bg-neutral-950 p-3"
                key={customerNote.id}
              >
                <p className="text-sm text-neutral-200">{customerNote.note}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDate(customerNote.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-neutral-400">No notes yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-lg font-semibold">Recent Conversations</h2>
        <div className="mt-4 grid gap-2">
          {customer.recentConversations.length > 0 ? (
            customer.recentConversations.map((conversation) => (
              <article
                className="rounded-md border border-white/10 bg-neutral-950 p-3"
                key={conversation.id}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-100">
                    {conversation.whatsappChatName ?? "Untitled chat"}
                  </p>
                  <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-xs text-neutral-300">
                    {conversation.source}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDate(conversation.lastMessageAt)}
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  {conversation.summary ?? "No summary saved."}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-neutral-400">No conversations yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-lg font-semibold">Recent Orders</h2>
        <div className="mt-4 grid gap-2">
          {customer.recentOrders.length > 0 ? (
            customer.recentOrders.map((order) => (
              <article
                className="rounded-md border border-white/10 bg-neutral-950 p-3"
                key={order.id}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-100">
                    {order.items.length > 0
                      ? order.items.join(", ")
                      : order.summary ?? "Draft order"}
                  </p>
                  <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-xs text-neutral-300">
                    {order.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  {order.summary ?? "No summary saved."}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-neutral-400">No orders yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [memoryWarnings, setMemoryWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadCustomers(nextSearch = search) {
    setIsLoading(true);

    try {
      const loadedCustomers = await getCustomers(nextSearch);

      setCustomers(loadedCustomers);
      setError(null);

      if (!selectedCustomer && loadedCustomers[0]) {
        await selectCustomer(loadedCustomers[0]);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load customers."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function selectCustomer(customer: CustomerListItem) {
    const detail = await getCustomer(customer.id);

    setSelectedCustomer(detail);
    setForm(toForm(detail));
    setMemoryWarnings([]);
  }

  useEffect(() => {
    void loadCustomers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCustomers(search);
  }

  async function reloadSelectedCustomer() {
    if (!selectedCustomer) {
      return;
    }

    const detail = await getCustomer(selectedCustomer.id);

    setSelectedCustomer(detail);
    setForm(toForm(detail));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCustomer || !form) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateCustomer(selectedCustomer.id, {
        displayName: form.displayName.trim(),
        phoneRaw: toNullableText(form.phoneRaw),
        profileSummary: toNullableText(form.profileSummary),
        usualAddress: toNullableText(form.usualAddress),
        preferences: splitLines(form.preferences),
        notes: toNullableText(form.notes)
      });
      await reloadSelectedCustomer();
      await loadCustomers(search);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update customer."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCustomer || !note.trim()) {
      return;
    }

    try {
      await addCustomerNote(selectedCustomer.id, note.trim());
      setNote("");
      await reloadSelectedCustomer();
      await loadCustomers(search);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Could not add note."
      );
    }
  }

  async function handleRefreshMemory() {
    if (!selectedCustomer) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await refreshCustomerMemory(selectedCustomer.id);

      setMemoryWarnings(response.warnings);
      await reloadSelectedCustomer();
      await loadCustomers(search);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not refresh memory."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.55fr)]">
      <div className="grid gap-4 lg:h-fit">
        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="border-b border-white/10 pb-4">
            <p className="text-sm font-medium uppercase text-emerald-300">
              Repeat Customers
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">
              Customers
            </h1>
          </div>
          <form className="mt-4 flex gap-2" onSubmit={handleSearch}>
            <input
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-emerald-300"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers"
              value={search}
            />
            <button
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-white/30"
              type="submit"
            >
              Search
            </button>
          </form>
        </section>

        {isLoading ? (
          <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-neutral-400">Loading customers...</p>
          </section>
        ) : (
          <CustomerList
            customers={customers}
            onSelect={(customer) => {
              void selectCustomer(customer);
            }}
            selectedId={selectedCustomer?.id ?? null}
          />
        )}

        {error ? (
          <p className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      {selectedCustomer && form ? (
        <CustomerDetailPanel
          customer={selectedCustomer}
          form={form}
          isRefreshing={isRefreshing}
          isSaving={isSaving}
          memoryWarnings={memoryWarnings}
          note={note}
          onFormChange={setForm}
          onNoteChange={setNote}
          onRefresh={handleRefreshMemory}
          onSave={handleSave}
          onSubmitNote={handleAddNote}
        />
      ) : (
        <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-lg font-semibold">Select a Customer</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Imported and manually analyzed chats will appear here once they are
            linked to customers.
          </p>
        </section>
      )}
    </div>
  );
}
