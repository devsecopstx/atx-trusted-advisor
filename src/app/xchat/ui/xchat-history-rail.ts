import type { HistoryItem } from "@/app/xchat/ui/xchat-conversation-types";

export type HistoryRailRow =
  | { kind: "header"; sectionId: "today" | "week" | "earlier"; label: string }
  | { kind: "item"; item: HistoryItem };

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Groups Mongo-backed history (API returns newest-first) for the sidebar rail:
 * **Today** (local calendar day), **Past week** (prior 7 local days, excluding today), **Earlier** (still within the 30d client filter).
 * Within each section, items are **ascending** by `createdAt` (oldest at top).
 */
export function buildHistoryRailRows(itemsNewestFirst: HistoryItem[]): HistoryRailRow[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const today: HistoryItem[] = [];
  const pastWeek: HistoryItem[] = [];
  const earlier: HistoryItem[] = [];

  for (const item of itemsNewestFirst) {
    const t = new Date(item.createdAt).getTime();
    if (!Number.isFinite(t)) {
      continue;
    }
    const dt = new Date(t);
    if (dt >= todayStart) {
      today.push(item);
    } else if (dt >= weekStart) {
      pastWeek.push(item);
    } else {
      earlier.push(item);
    }
  }

  const byAsc = (a: HistoryItem, b: HistoryItem) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  today.sort(byAsc);
  pastWeek.sort(byAsc);
  earlier.sort(byAsc);

  const rows: HistoryRailRow[] = [];
  if (today.length > 0) {
    rows.push({ kind: "header", sectionId: "today", label: "Today" });
    for (const it of today) {
      rows.push({ kind: "item", item: it });
    }
  }
  if (pastWeek.length > 0) {
    rows.push({ kind: "header", sectionId: "week", label: "Past week" });
    for (const it of pastWeek) {
      rows.push({ kind: "item", item: it });
    }
  }
  if (earlier.length > 0) {
    rows.push({ kind: "header", sectionId: "earlier", label: "Earlier" });
    for (const it of earlier) {
      rows.push({ kind: "item", item: it });
    }
  }
  return rows;
}
