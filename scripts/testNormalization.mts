
import { readFile } from "node:fs/promises";
import { normalizeOrders, type RawOrder } from "../src/normalizeOrders.ts";

const file = await readFile(
  new URL("../data/orders.json", import.meta.url),
  "utf8",
);

const rawOrders = JSON.parse(file) as RawOrder[];

console.log("Raw record count:", rawOrders.length);

console.log(
  "Schema versions:",
  rawOrders.reduce<Record<string, number>>((counts, order) => {
    const version = String(order.schemaVersion);
    counts[version] = (counts[version] ?? 0) + 1;
    return counts;
  }, {}),
);

try {
  // 1. Normalize all orders.
  const orders = normalizeOrders(rawOrders);

  // 2. Check duplicate IDs and inspect the first five duplicate groups.
  const grouped = new Map<string, RawOrder[]>();

  for (const order of rawOrders) {
    const id = String(order.id ?? "");
    const group = grouped.get(id) ?? [];
    group.push(order);
    grouped.set(id, group);
  }

  const duplicateGroups = [...grouped.entries()].filter(
    ([, group]) => group.length > 1,
  );

  console.log("Duplicate ID groups:", duplicateGroups.length);

  for (const [id, group] of duplicateGroups.slice(0, 5)) {
    console.log(
      "Duplicate:",
      id,
      group.map((order) => ({
        updatedAt: order.updatedAt ?? null,
        customerName: order.customerName ?? order.customer_name ?? "",
      })),
      "Kept:",
      orders.find((order) => order.id === id)?.updatedAt,
    );
  }

  // 3. Check basic normalization results.
  console.log("Normalized record count:", orders.length);
  console.log("Removed duplicate records:", rawOrders.length - orders.length);

  console.log(
    "Missing updatedAt:",
    orders.filter((order) => order.updatedAt === null).length,
  );

  console.log(
    "Missing priority:",
    orders.filter((order) => order.priority === "None").length,
  );

  console.log(
    "Missing customer names:",
    orders.filter((order) => !order.customerName).length,
  );

  console.log(
    "Currency values:",
    [...new Set(orders.map((order) => order.currency))],
  );

  console.log(
    "Status values:",
    [...new Set(orders.map((order) => order.status))],
  );

  console.log(
    "Region values:",
    [...new Set(orders.map((order) => order.region))],
  );

  console.log("First normalized order:", orders[0]);

  // 4. Check amount conversion for schema versions 1 and 2.
  const rawV1 = rawOrders.find(
    (order) => Number(order.schemaVersion) === 1,
  );

  const rawV2 = rawOrders.find(
    (order) => Number(order.schemaVersion) === 2,
  );

  if (rawV1 && rawV2) {
    const normalizedV1 = orders.find(
      (order) => order.id === String(rawV1.id),
    );

    const normalizedV2 = orders.find(
      (order) => order.id === String(rawV2.id),
    );

    console.log("Version 1 raw amount:", rawV1.amount);
    console.log("Version 1 normalized amount:", normalizedV1?.amount);

    console.log("Version 2 raw amount:", rawV2.amount);
    console.log("Version 2 normalized amount:", normalizedV2?.amount);
  }

  // 5. Check date validity.
  console.log(
    "Invalid createdAt values:",
    orders.filter((order) => !Number.isFinite(order.createdAt)).length,
  );

  console.log(
    "Invalid non-missing updatedAt values:",
    orders.filter(
      (order) =>
        order.updatedAt !== null &&
        !Number.isFinite(order.updatedAt),
    ).length,
  );

  // 6. Confirm that normalized IDs are unique.
  console.log(
    "Duplicate IDs remaining:",
    orders.length - new Set(orders.map((order) => order.id)).size,
  );

  // 7. Check that every amount is numeric and finite.
  console.log(
    "Invalid amounts:",
    orders.filter((order) => !Number.isFinite(order.amount)).length,
  );

  // 8. Check that long notes have been preserved.
  console.log(
    "Longest notes length:",
    Math.max(...orders.map((order) => order.notes.length)),
  );

  // 9. Count the original createdAt formats.
  const dateFormatCounts = {
    numericTimestamps: 0,
    isoWithTimezone: 0,
    isoWithoutTimezone: 0,
    dayMonthYear: 0,
    missingOrOther: 0,
  };

  for (const order of rawOrders) {
    const value = order.createdAt;

    if (typeof value === "number") {
      dateFormatCounts.numericTimestamps++;
    } else if (typeof value === "string") {
      const text = value.trim();

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
        dateFormatCounts.dayMonthYear++;
      } else if (
        /^\d{4}-\d{2}-\d{2}T/.test(text) &&
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
      ) {
        dateFormatCounts.isoWithTimezone++;
      } else if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        dateFormatCounts.isoWithoutTimezone++;
      } else {
        dateFormatCounts.missingOrOther++;
      }
    } else {
      dateFormatCounts.missingOrOther++;
    }
  }

  console.log("Raw createdAt format counts:", dateFormatCounts);

  console.log("Normalization test run completed.");
} catch (error) {
  console.error("Normalization tests failed:", error);
  process.exitCode = 1;
}
