import { useMemo, useRef, useState, useEffect } from "react";
import orders from "./orders";
import "./App.css";

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

function App() {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [columnWidths, setColumnWidths] = useState<number[]>(INITIAL_WIDTHS);
  const [pinnedId, setPinnedId] = useState(true);

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

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
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
  }, [sortKey, sortDirection]);

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
        <span className="toolbar-hint">
          Drag a column edge to resize
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

              {visibleOrders.map((order) => (
                <tr key={order.id} className="virtual-row">
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
              ))}

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

      <p className="grid-note">
        Showing rows {startIndex + 1}–{endIndex} of{" "}
        {sortedOrders.length.toLocaleString("en-IN")} orders
      </p>
    </main>
  );
}

export default App;