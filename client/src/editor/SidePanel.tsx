import { useEditorStore } from "../state/editorStore";
import { Inspector } from "./Inspector";
import { BudgetPanel } from "./BudgetPanel";
import { IssuesPanel } from "./IssuesPanel";
import { useMemo } from "react";
import { allIssues } from "@shared/design/audit";
import type { HomeDesign } from "@shared/types/home";

type Tab = { id: "inspector" | "budget" | "issues" | "assistant"; label: string; badge?: number };
/** The right-hand column: one tab at a time over the same design. */
export function SidePanel({ design, extra = [] }: { design: HomeDesign; extra?: (Tab & { render: () => React.ReactNode })[] }) {
  const ui = useEditorStore(),
    issues = useMemo(() => allIssues(design), [design]),
    tabs: (Tab & { render: () => React.ReactNode })[] = [
      { id: "inspector", label: "Details", render: () => <Inspector design={design} /> },
      { id: "budget", label: "Budget", render: () => <BudgetPanel design={design} /> },
      {
        id: "issues",
        label: "Issues",
        badge: issues.filter((i) => i.level === "error").length,
        render: () => <IssuesPanel issues={issues} />,
      },
      ...extra,
    ],
    active = tabs.find((t) => t.id === ui.panel) ?? tabs[0]!;
  return (
    <div className="side-panel">
      <div className="side-tabs" role="tablist" aria-label="Panels">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active.id === t.id}
            className={active.id === t.id ? "active" : ""}
            onClick={() => ui.set({ panel: t.id })}
          >
            {t.label}
            {!!t.badge && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>
      {active.render()}
    </div>
  );
}
