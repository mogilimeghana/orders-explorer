
export type RawOrder = {
  id?: string | number;
  schemaVersion?: string | number;
  customerName?: string | null;
  customer_name?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  status?: string | null;
  region?: string | null;
  priority?: string | number | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type Order = RawOrder & {
  id: string;
  customerName: string;
  amount: number;
  currency: string;
  createdAt: number;
  updatedAt: number | null;
  status: string;
  region: string;
  priority: string;
  notes: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Unix timestamps in seconds are around 10 digits;
    // timestamps in milliseconds are around 13 digits.
    const milliseconds =
      Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
    return Number.isFinite(new Date(milliseconds).getTime())
      ? milliseconds
      : null;
  }

  if (typeof value !== "string" || !value.trim()) return null;

  const text = value.trim();

  // DD/MM/YYYY must be parsed explicitly.
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );

    // Reject impossible dates such as 31/02/2025.
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) {
      return null;
    }

    return date.getTime();
  }

  // ISO date/time without a timezone is interpreted as UTC.
  const isoWithoutZone =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text);

  const normalized = isoWithoutZone ? `${text}Z` : text;
  const timestamp = Date.parse(normalized);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeAmount(value: unknown): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid order amount: ${String(value)}`);
  }

  return amount;
}

function normalizeOrder(raw: RawOrder): Order {
  const schemaVersion = String(raw.schemaVersion ?? "1").toLowerCase();
  const rawAmount = normalizeAmount(raw.amount);

  // Confirm schema-version mapping against data-notes.md before relying on it.
  const isV1 = schemaVersion === "1" || schemaVersion === "v1";
  const amount = isV1 ? rawAmount / 100 : rawAmount;

  const createdAt = parseDate(raw.createdAt);
  if (createdAt === null) {
    throw new Error(`Invalid createdAt for order ${String(raw.id)}`);
  }

  return {
    ...raw,
    id: String(raw.id ?? ""),
    customerName: cleanText(raw.customerName ?? raw.customer_name),
    amount,
    currency: cleanText(raw.currency),
    createdAt,
    updatedAt: raw.updatedAt == null ? null : parseDate(raw.updatedAt),
    status: cleanText(raw.status).toLowerCase(),
    region: cleanText(raw.region).toLowerCase(),
    priority:
  raw.priority == null ||
  (typeof raw.priority === "string" && !raw.priority.trim())
    ? "None"
    : String(raw.priority).trim(),
    // Keep the full note as plain text; truncate only when displaying it.
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function normalizeOrders(rawOrders: RawOrder[]): Order[] {
  const ordersById = new Map<string, { order: Order; index: number }>();

  rawOrders.forEach((raw, index) => {
    const order = normalizeOrder(raw);

    if (!order.id) {
      throw new Error(`Order at index ${index} has no ID`);
    }

    const existing = ordersById.get(order.id);

    if (!existing) {
      ordersById.set(order.id, { order, index });
      return;
    }

    const previousUpdated = existing.order.updatedAt;
    const currentUpdated = order.updatedAt;

    // Prefer the later updatedAt when both records have it.
    // If only one has updatedAt, keep that record.
    // If neither has it, keep the later record in the file.
    const replace =
      (currentUpdated !== null &&
        previousUpdated !== null &&
        currentUpdated > previousUpdated) ||
      (currentUpdated !== null && previousUpdated === null) ||
      (currentUpdated === null &&
        previousUpdated === null &&
        index > existing.index);

    if (replace) {
      ordersById.set(order.id, { order, index });
    }
  });

  return Array.from(ordersById.values(), ({ order }) => order);
}
