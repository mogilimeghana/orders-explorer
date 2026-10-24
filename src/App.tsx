import { useMemo, useRef, useState, useEffect } from "react";
import orders from "./orders";
import "./App.css";
import {applyOrderFilters,type FilterCondition,type FilterField,type FilterOperator,type FilterState,} from "./filtering";

type SortKey =
  | "id"
  | "customerName"
  | "status"
  | "amount"
  | "createdAt"
  | "region"
  | "priority";

const ROW_HEIGHT = 42;
const OVERSCAN = 8;
const INITIAL_WIDTHS = [180, 200, 150, 150, 210, 140, 120];

const VALID_SORT_KEYS: SortKey[] = [
  "id",
  "customerName",
  "status",
  "amount",
  "createdAt",
  "region",
  "priority",
];

const VALID_STATUSES = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];


function readUrlState() {
  const params = new URLSearchParams(window.location.search);

  let filters: FilterState = [];
  let selectedIds: string[] = [];

  try {
    const parsed = JSON.parse(params.get("filters") ?? "[]");

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (group) =>
          group &&
          typeof group.id === "string" &&
          Array.isArray(group.conditions) &&
          group.conditions.every(
            (condition: FilterCondition) =>
              condition &&
              typeof condition.id === "string" &&
              ["id", "customerName", "status", "amount", "createdAt", "region", "priority"].includes(condition.field) &&
              ["equals", "notEquals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"].includes(condition.operator) &&
              typeof condition.value === "string",
          ),
      )
    ) {
      filters = parsed;
    }
  } catch {
    // Invalid filter JSON: use no custom filters.
  }

  try {
    const parsedSelected = JSON.parse(params.get("selected") ?? "[]");

    if (
      Array.isArray(parsedSelected) &&
      parsedSelected.every((id) => typeof id === "string") &&
      parsedSelected.length <= 50000
    ) {
      selectedIds = parsedSelected;
    }
  } catch {
    // Invalid selection JSON: use no selected rows.
  }

  const requestedSort = params.get("sort");
  const requestedDirection = params.get("direction");
  const requestedStatus = params.get("status");

  return {
    sortKey: VALID_SORT_KEYS.includes(requestedSort as SortKey)
      ? (requestedSort as SortKey)
      : ("id" as SortKey),
    sortDirection: requestedDirection === "desc" ? "desc" as const : "asc" as const,
    pinnedId: params.get("pinned") !== "false",
    selectedStatus: VALID_STATUSES.includes(requestedStatus ?? "")
      ? requestedStatus!
      : "all",
    filterGroups: filters,
    selectedIds,
  };
}



function App() {

const [initialUrlState] = useState(readUrlState);

const [sortKey, setSortKey] = useState<SortKey>(initialUrlState.sortKey);
const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialUrlState.sortDirection);
const [scrollTop, setScrollTop] = useState(0);
const [viewportHeight, setViewportHeight] = useState(400);
const [columnWidths, setColumnWidths] = useState<number[]>(INITIAL_WIDTHS);
const [pinnedId, setPinnedId] = useState(initialUrlState.pinnedId);
const [selectedStatus, setSelectedStatus] = useState(initialUrlState.selectedStatus);
const [filterGroups, setFilterGroups] = useState<FilterState>(initialUrlState.filterGroups);
const [selectedIds, setSelectedIds] = useState<Set<string>>(
  () => new Set(initialUrlState.selectedIds),
);

const lastSelectedId = useRef<string | null>(null);
const [focusedId, setFocusedId] = useState<string | null>(null);
const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);

useEffect(() => {
  const params = new URLSearchParams();

  params.set("sort", sortKey);
  params.set("direction", sortDirection);
  params.set("pinned", String(pinnedId));
  params.set("status", selectedStatus);
  params.set("filters", JSON.stringify(filterGroups));
  params.set("selected", JSON.stringify([...selectedIds]));

  const queryString = params.toString();
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}${window.location.hash}`
    : window.location.pathname;

  window.history.replaceState(null, "", newUrl);
}, [sortKey, sortDirection, pinnedId, selectedStatus, filterGroups, selectedIds]);

const filterFields: { label: string; value: FilterField }[] = [
  { label: "Order ID", value: "id" },
  { label: "Customer", value: "customerName" },
  { label: "Status", value: "status" },
  { label: "Amount", value: "amount" },
  { label: "Created At", value: "createdAt" },
  { label: "Region", value: "region" },
  { label: "Priority", value: "priority" },
];

const filterOperators: { label: string; value: FilterOperator }[] = [
  { label: "Equals", value: "equals" },
  { label: "Does not equal", value: "notEquals" },
  { label: "Contains", value: "contains" },
  { label: "Greater than", value: "greaterThan" },
  { label: "Less than", value: "lessThan" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

function addFilterGroup() {
  const newCondition: FilterCondition = {
    id: crypto.randomUUID(),
    field: "status",
    operator: "equals",
    value: "pending",
  };

  setFilterGroups((groups) => [
    ...groups,
    {
      id: crypto.randomUUID(),
      conditions: [newCondition],
    },
  ]);
}

function updateFilterCondition(
  groupId: string,
  conditionId: string,
  changes: Partial<FilterCondition>,
) {
  setFilterGroups((groups) =>
    groups.map((group) =>
      group.id !== groupId
        ? group
        : {
            ...group,
            conditions: group.conditions.map((condition) =>
              condition.id === conditionId
                ? { ...condition, ...changes }
                : condition,
            ),
          },
    ),
  );
}

function addCondition(groupId: string) {
  setFilterGroups((groups) =>
    groups.map((group) =>
      group.id !== groupId
        ? group
        : {
            ...group,
            conditions: [
              ...group.conditions,
              {
                id: crypto.randomUUID(),
                field: "status",
                operator: "equals",
                value: "pending",
              },
            ],
          },
    ),
  );
}

function removeCondition(groupId: string, conditionId: string) {
  setFilterGroups((groups) =>
    groups
      .map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              conditions: group.conditions.filter(
                (condition) => condition.id !== conditionId,
              ),
            },
      )
      .filter((group) => group.conditions.length > 0),
  );
}

function removeFilterGroup(groupId: string) {
  setFilterGroups((groups) =>
    groups.filter((group) => group.id !== groupId),
  );
}

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateHeight = () => setViewportHeight(element.clientHeight);

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) =>
        direction === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }

    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  function handleResize(
    index: number,
    startX: number,
    startWidth: number,
  ) {
    function onPointerMove(event: PointerEvent) {
      const newWidth = Math.max(
        90,
        startWidth + event.clientX - startX,
      );

      setColumnWidths((widths) =>
        widths.map((width, i) => (i === index ? newWidth : width)),
      );
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  
 
  const filteredOrders = useMemo(() => {
    const groups: FilterState = [...filterGroups];

    if (selectedStatus !== "all") {
      groups.unshift({
        id: "status-group",
        conditions: [
          {
            id: "status-condition",
            field: "status",
            operator: "equals",
            value: selectedStatus,
          },
        ],
      });
    }

    return applyOrderFilters(orders, groups);
  }, [selectedStatus, filterGroups]);


  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const first = a[sortKey];
      const second = b[sortKey];

      let comparison = 0;

      if (typeof first === "number" && typeof second === "number") {
        comparison = first - second;
      } else {
        comparison = String(first ?? "").localeCompare(
          String(second ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredOrders, sortKey, sortDirection]);


  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN,
  );

  const visibleCount =
    Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;

  const endIndex = Math.min(
    sortedOrders.length,
    startIndex + visibleCount,
  );

  const visibleOrders = sortedOrders.slice(startIndex, endIndex);

useEffect(() => {
  if (!focusedId) return;

  const row = scrollRef.current?.querySelector(
    `tr[data-order-id="${CSS.escape(focusedId)}"]`,
  ) as HTMLTableRowElement | null;

  row?.focus();
}, [focusedId, startIndex, endIndex]);

  
function handleRowClick(orderId: string, event: React.MouseEvent<HTMLTableRowElement>) {
  const clickedIndex = sortedOrders.findIndex(
    (order) => order.id === orderId,
  );

  setSelectedIds((previous) => {
    const next = new Set(previous);

    if (event.shiftKey && lastSelectedId.current !== null) {
      const lastIndex = sortedOrders.findIndex(
        (order) => order.id === lastSelectedId.current,
      );

      if (lastIndex !== -1 && clickedIndex !== -1) {
        const start = Math.min(lastIndex, clickedIndex);
        const end = Math.max(lastIndex, clickedIndex);

        for (let i = start; i <= end; i++) {
          next.add(String(sortedOrders[i].id));
        }
      } else {
        next.add(String(orderId));
      }
    } else {
      const id = String(orderId);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }

    return next;
  });

  lastSelectedId.current = String(orderId);
}



function handleRowKeyDown(
  orderId: string,
  event: React.KeyboardEvent<HTMLTableRowElement>,
) {
  const currentIndex = sortedOrders.findIndex(
    (order) => String(order.id) === orderId,
  );

  if (currentIndex === -1) return;

  // Arrow keys: move focus between rows.
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();

    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, sortedOrders.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (nextIndex === currentIndex) return;

    const nextId = String(sortedOrders[nextIndex].id);
    const nextRowTop = nextIndex * ROW_HEIGHT;
    const nextRowBottom = nextRowTop + ROW_HEIGHT;

    setFocusedId(nextId);

    if (scrollRef.current) {
      const container = scrollRef.current;
      const visibleTop = container.scrollTop;
      const visibleBottom = visibleTop + container.clientHeight;

      if (nextRowTop < visibleTop) {
        container.scrollTop = nextRowTop;
      } else if (nextRowBottom > visibleBottom) {
        container.scrollTop =
          nextRowBottom - container.clientHeight;
      }

      setScrollTop(container.scrollTop);
    }

    return;
  }

  // Space: select or deselect the focused row.
  if (event.key === " ") {
    event.preventDefault();

    setFocusedId(orderId);

    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }

      return next;
    });

    lastSelectedId.current = orderId;
    return;
  }

  // Enter: open the order details.
  if (event.key === "Enter") {
    event.preventDefault();
    setFocusedId(orderId);
    setDetailsOrderId(orderId);
    return;
  }

  // Escape: close the order details.
  if (event.key === "Escape") {
    setDetailsOrderId(null);
  }
}



  function sortLabel(label: string, key: SortKey) {
    const arrow =
      sortKey !== key ? "↕" : sortDirection === "asc" ? "↑" : "↓";

    return (
      <button
        type="button"
        className="sort-button"
        onClick={() => handleSort(key)}
        aria-label={`Sort by ${label}`}
      >
        {label} <span aria-hidden="true">{arrow}</span>
      </button>
    );
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }

  
function exportSelectedOrders() {
  const selectedOrders = orders.filter((order) =>
  selectedIds.has(String(order.id)),
);

  if (selectedOrders.length === 0) {
    alert("Please select at least one order to export.");
    return;
  }

  const headers = [
    "Order ID",
    "Customer",
    "Status",
    "Amount",
    "Currency",
    "Created At",
    "Region",
    "Priority",
  ];

  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = selectedOrders.map((order) => [
    order.id,
    order.customerName,
    order.status,
    order.amount,
    order.currency,
    formatDate(order.createdAt),
    order.region,
    order.priority,
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "selected-orders.csv";
  link.click();

  URL.revokeObjectURL(url);
}


  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(amount);
  }

  const columnNames = [
    "Order ID",
    "Customer",
    "Status",
    "Amount",
    "Created At",
    "Region",
    "Priority",
  ];

  return (
    <main className="orders-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Orders Explorer</h1>
          <p className="subtitle">Browse and inspect customer orders</p>
        </div>

        <div className="order-count">
          <strong>{orders.length.toLocaleString("en-IN")}</strong>
          <span>Total orders</span>
        </div>
      </header>

      <div className="grid-toolbar">
        <button
          type="button"
          className="pin-button"
          onClick={() => setPinnedId((pinned) => !pinned)}
          aria-pressed={pinnedId}
        >
          {pinnedId ? "Unpin Order ID" : "Pin Order ID"}
        </button>
          <button
             type="button"
              className="pin-button"
              onClick={exportSelectedOrders}
             >
              Export selected ({selectedIds.size})
          </button>
          
        <span className="toolbar-hint">
          Drag a column edge to resize
        </span>
        
  <label className="status-filter">
    Filter by status{" "}
    <select
      value={selectedStatus}
      onChange={(event) => {
        setSelectedStatus(event.target.value);
        setScrollTop(0);

        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      }}
    >
      <option value="all">All statuses</option>
      <option value="pending">Pending</option>
      <option value="processing">Processing</option>
      <option value="shipped">Shipped</option>
      <option value="delivered">Delivered</option>
      <option value="cancelled">Cancelled</option>
    </select>
  </label>

      </div>

      <section className="filter-builder" aria-label="Custom filters">
        <div className="filter-builder-header">
          <div>
            <h2>Custom filters</h2>
            <p>OR within a group, AND between groups</p>
          </div>
          <button type="button" onClick={addFilterGroup}>
            + Add filter group
          </button>
          <button
            type="button"
            onClick={() => setFilterGroups([])}
            disabled={filterGroups.length === 0}
          >
            Clear filters
          </button>
        </div>

        {filterGroups.map((group, groupIndex) => (
          <div className="filter-group" key={group.id}>
            <div className="filter-group-header">
              <strong>Group {groupIndex + 1}</strong>
              {groupIndex > 0 && <span>AND</span>}
              <button
                type="button"
                onClick={() => removeFilterGroup(group.id)}
              >
                Remove group
              </button>
            </div>

            {group.conditions.map((condition, conditionIndex) => (
              <div className="filter-condition" key={condition.id}>
                {conditionIndex > 0 && (
                  <span className="filter-or">OR</span>
                )}

                <select
                  aria-label="Filter field"
                  value={condition.field}
                  onChange={(event) =>
                    updateFilterCondition(group.id, condition.id, {
                      field: event.target.value as FilterField,
                    })
                  }
                >
                  {filterFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter operator"
                  value={condition.operator}
                  onChange={(event) =>
                    updateFilterCondition(group.id, condition.id, {
                      operator: event.target.value as FilterOperator,
                    })
                  }
                >
                  {filterOperators.map((operator) => (
                    <option key={operator.value} value={operator.value}>
                      {operator.label}
                    </option>
                  ))}
                </select>

                {!["isEmpty", "isNotEmpty"].includes(condition.operator) && (
                  <input
                    aria-label="Filter value"
                    value={condition.value}
                    placeholder="Enter value"
                    onChange={(event) =>
                      updateFilterCondition(group.id, condition.id, {
                        value: event.target.value,
                      })
                    }
                  />
                )}

                <button
                  type="button"
                  onClick={() =>
                    removeCondition(group.id, condition.id)
                  }
                >
                  Remove condition
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addCondition(group.id)}
            >
              + Add OR condition
            </button>
          </div>
        ))}
      </section>
      
      {(selectedStatus !== "all" || filterGroups.length > 0) && (
        <section className="active-filters" aria-label="Active filters">
          <div className="active-filters-heading">
            <strong>Active filters</strong>
            <button
              type="button"
              className="clear-all-filters"
              onClick={() => {
                setFilterGroups([]);
                setSelectedStatus("all");
                setScrollTop(0);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
            >
              Clear all
            </button>
          </div>

          <div className="filter-chips">
            {selectedStatus !== "all" && (
              <span className="filter-chip" key="status-dropdown">
                <span>Status equals {selectedStatus}</span>
                <button
                  type="button"
                  aria-label="Remove status filter"
                  onClick={() => {
                    setSelectedStatus("all");
                    setScrollTop(0);
                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                  }}
                >
                  ×
                </button>
              </span>
            )}

            {filterGroups.flatMap((group) =>
               group.conditions.map((condition) => {
                const fieldLabel =
                  filterFields.find((field) => field.value === condition.field)
                    ?.label ?? condition.field;

                const operatorLabel =
                  filterOperators.find(
                    (operator) => operator.value === condition.operator,
                  )?.label ?? condition.operator;

                const chipText = [
                  fieldLabel,
                  operatorLabel,
                  ...(condition.operator === "isEmpty" ||
                  condition.operator === "isNotEmpty"
                    ? []
                    : [condition.value || "(empty value)"]),
                ].join(" ");

                return (
                  <span className="filter-chip" key={condition.id}>
                    <span>{chipText}</span>
                    <button
                      type="button"
                      aria-label={`Remove filter ${chipText}`}
                      onClick={() => {
                        removeCondition(group.id, condition.id);
                        setScrollTop(0);
                        if (scrollRef.current) {
                          scrollRef.current.scrollTop = 0;
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              }),
            )}
          </div>
        </section>
      )}

      <div className="results-toolbar" aria-live="polite">
        <strong>
          {sortedOrders.length.toLocaleString("en-IN")} orders found
        </strong>
        <span>
          {filterGroups.length > 0 || selectedStatus !== "all"
            ? "Results update automatically as filters change."
            : "Showing all orders."}
        </span>
      </div>

      <section className="grid-container" aria-label="Orders table">
        <div
          className="virtual-scroll"
          ref={scrollRef}
          onScroll={(event) =>
            setScrollTop(event.currentTarget.scrollTop)
          }
        >
          <table className="orders-table">
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={columnNames[index]} style={{ width }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                {(
                  [
                    ["Order ID", "id"],
                    ["Customer", "customerName"],
                    ["Status", "status"],
                    ["Amount", "amount"],
                    ["Created At", "createdAt"],
                    ["Region", "region"],
                    ["Priority", "priority"],
                  ] as [string, SortKey][]
                ).map(([label, key], index) => (
                  <th
                    key={key}
                    className={[
                      key === "amount" ? "numeric" : "",
                      index === 0 && pinnedId ? "pinned-column" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {sortLabel(label, key)}

                    {index === 0 && (
                      <button
                        type="button"
                        className="pin-icon-button"
                        title={pinnedId ? "Unpin Order ID" : "Pin Order ID"}
                        aria-label={
                          pinnedId ? "Unpin Order ID column" : "Pin Order ID column"
                        }
                        onClick={() =>
                          setPinnedId((pinned) => !pinned)
                        }
                      >
                        {pinnedId ? "📌" : "📍"}
                      </button>
                    )}

                    <div
                      className="resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${label} column`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleResize(
                          index,
                          event.clientX,
                          columnWidths[index],
                        );
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr aria-hidden="true" className="virtual-spacer">
                <td
                  colSpan={7}
                  style={{
                    height: startIndex * ROW_HEIGHT,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>

              
{visibleOrders.map((order) => {
  const isSelected = selectedIds.has(String(order.id));

  return (
   
<tr
  key={order.id}
  className={`virtual-row${isSelected ? " selected-row" : ""}${focusedId === String(order.id) ? " focused-row" : ""}`}
  onClick={(event) => {
    handleRowClick(String(order.id), event);
    setFocusedId(String(order.id));
  }}
  onKeyDown={(event) => handleRowKeyDown(String(order.id), event)}
  tabIndex={0}
  aria-selected={isSelected}
  data-order-id={String(order.id)}
>

      <td className={pinnedId ? "pinned-column" : ""}>
        {order.id}
      </td>
      <td>{order.customerName || "—"}</td>
      <td>
        <span className={`status status-${order.status}`}>
          {order.status}
        </span>
      </td>
      <td className="numeric">
        {formatAmount(order.amount, order.currency)}
      </td>
      <td>{formatDate(order.createdAt)}</td>
      <td>{order.region || "—"}</td>
      <td>{order.priority}</td>
    </tr>
  );
})}


              <tr aria-hidden="true" className="virtual-spacer">
                <td
                  colSpan={7}
                  style={{
                    height: Math.max(
                      0,
                      (sortedOrders.length - endIndex) * ROW_HEIGHT,
                    ),
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

   
      {detailsOrderId !== null && (() => {
        const order = orders.find(
          (item) => String(item.id) === detailsOrderId,
        );

        if (!order) return null;

        return (
          <section
            className="order-details"
            aria-label="Order details"
          >
            <div className="order-details-header">
              <h2>Order Details — {order.id}</h2>
              <button
                type="button"
                onClick={() => {
                  setDetailsOrderId(null);
                  setFocusedId(detailsOrderId);
                }}
              >
                Close
              </button>
            </div>

            <dl>
              <dt>Customer</dt>
              <dd>{order.customerName || "—"}</dd>

              <dt>Customer email</dt>
              <dd>{String(order.customerEmail ?? "—")}</dd>

              <dt>Status</dt>
              <dd>{order.status}</dd>

              <dt>Amount</dt>
              <dd>{formatAmount(order.amount, order.currency)}</dd>

              <dt>Created at</dt>
              <dd>{formatDate(order.createdAt)}</dd>

              <dt>Updated at</dt>
              <dd>
                {order.updatedAt == null
                  ? "—"
                  : formatDate(order.updatedAt)}
              </dd>

              <dt>Region</dt>
              <dd>{order.region || "—"}</dd>

              <dt>Channel</dt>
              <dd>{String(order.channel ?? "—")}</dd>

              <dt>Priority</dt>
              <dd>{order.priority || "None"}</dd>

              <dt>Payment method</dt>
              <dd>{String(order.paymentMethod ?? "—")}</dd>

              <dt>Item count</dt>
              <dd>{String(order.itemCount ?? "—")}</dd>

              <dt>Notes</dt>
              <dd className="order-detail-notes">
                {order.notes || "No notes"}
              </dd>
            </dl>
          </section>
        );
      })()}


      <p className="grid-note">
        {sortedOrders.length === 0
          ? "No orders match your filters."
          : `Showing rows ${Math.min(startIndex + 1, sortedOrders.length)}–${endIndex} of ${sortedOrders.length.toLocaleString("en-IN")} orders`}
      </p>

    </main>
  );
}

export default App;