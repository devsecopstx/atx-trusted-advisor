"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

const DEFAULT_ROW_HEIGHT_PX = 72;
const DEFAULT_MIN_ROWS = 40;
const DEFAULT_MAX_HEIGHT = "min(70vh, 36rem)";

export type VirtualizedCrudTableProps<T> = {
  rows: readonly T[];
  renderRow: (row: T, index: number) => ReactNode;
  header: ReactNode;
  columnCount: number;
  virtualizeMinRows?: number;
  estimateRowHeightPx?: number;
  maxHeight?: string;
  tableClassName?: string;
  wrapClassName?: string;
};

export function VirtualizedCrudTable<T>({
  rows,
  header,
  renderRow,
  columnCount,
  virtualizeMinRows = DEFAULT_MIN_ROWS,
  estimateRowHeightPx = DEFAULT_ROW_HEIGHT_PX,
  maxHeight = DEFAULT_MAX_HEIGHT,
  tableClassName = "crud-table",
  wrapClassName = "crud-table-wrap"
}: VirtualizedCrudTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = rows.length >= virtualizeMinRows;

  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual */
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeightPx,
    overscan: 8
  });

  const body = shouldVirtualize ? (
    <tbody>
      {(() => {
        const vItems = rowVirtualizer.getVirtualItems();
        const padTop = vItems.length > 0 ? vItems[0].start : 0;
        const padBottom =
          vItems.length > 0 ? rowVirtualizer.getTotalSize() - vItems[vItems.length - 1]!.end : 0;
        return (
          <>
            {padTop > 0 ? (
              <tr aria-hidden style={{ height: padTop }}>
                <td colSpan={columnCount} style={{ padding: 0, border: "none" }} />
              </tr>
            ) : null}
            {vItems.map((vr) => {
              const row = rows[vr.index]!;
              return renderRow(row, vr.index);
            })}
            {padBottom > 0 ? (
              <tr aria-hidden style={{ height: padBottom }}>
                <td colSpan={columnCount} style={{ padding: 0, border: "none" }} />
              </tr>
            ) : null}
          </>
        );
      })()}
    </tbody>
  ) : (
    <tbody>{rows.map((row, index) => renderRow(row, index))}</tbody>
  );

  return (
    <VirtualizedCrudTableScrollWrap
      className={wrapClassName}
      maxHeight={shouldVirtualize ? maxHeight : undefined}
      scrollRef={scrollRef}
    >
      <table className={tableClassName}>
        {header}
        {body}
      </table>
    </VirtualizedCrudTableScrollWrap>
  );
}

function VirtualizedCrudTableScrollWrap({
  children,
  className,
  maxHeight,
  scrollRef
}: {
  children: ReactNode;
  className: string;
  maxHeight?: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={scrollRef}
      className={className}
      style={
        maxHeight
          ? { maxHeight, overflow: "auto", position: "relative" as const }
          : undefined
      }
    >
      {children}
    </div>
  );
}
