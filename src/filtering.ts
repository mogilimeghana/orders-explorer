
import type { Order } from "./normalizeOrders";

export type FilterField =
  | "id"
  | "customerName"
  | "status"
  | "amount"
  | "createdAt"
  | "region"
  | "priority";

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "greaterThan"
  | "lessThan"
  | "isEmpty"
  | "isNotEmpty";

export type FilterCondition = {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
};

export type FilterGroup = {
  id: string;
  conditions: FilterCondition[];
};

export type FilterState = FilterGroup[];

function matchesCondition(
  order: Order,
  condition: FilterCondition,
): boolean {
  const rawValue = order[condition.field];
  const actual = rawValue == null ? "" : String(rawValue);
  const expected = condition.value.trim();

  if (condition.operator === "isEmpty") {
    return actual.trim() === "";
  }

  if (condition.operator === "isNotEmpty") {
    return actual.trim() !== "";
  }

  if (condition.field === "amount") {
    const actualNumber = Number(rawValue);
    const expectedNumber = Number(expected);

    if (expected === "" || !Number.isFinite(expectedNumber)) {
      return false;
    }

    if (condition.operator === "greaterThan") {
      return actualNumber > expectedNumber;
    }

    if (condition.operator === "lessThan") {
      return actualNumber < expectedNumber;
    }

    if (condition.operator === "equals") {
      return actualNumber === expectedNumber;
    }

    if (condition.operator === "notEquals") {
      return actualNumber !== expectedNumber;
    }

    return false;
  }

  const first = actual.toLowerCase();
  const second = expected.toLowerCase();

  switch (condition.operator) {
    case "equals":
      return first === second;
    case "notEquals":
      return first !== second;
    case "contains":
      return first.includes(second);
    case "greaterThan":
      return first > second;
    case "lessThan":
      return first < second;
    default:
      return false;
  }
}

export function applyOrderFilters(
  orders: Order[],
  groups: FilterState,
): Order[] {
  if (groups.length === 0) {
    return orders;
  }

  return orders.filter((order) =>
    groups.every((group) => {
      if (group.conditions.length === 0) {
        return true;
      }

      return group.conditions.some((condition) =>
        matchesCondition(order, condition),
      );
    }),
  );
}
