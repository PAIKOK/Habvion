import { useMemo } from "react";
import { estimateBudget } from "@shared/design/budget";
import { compactInr, inr } from "@shared/lib/units";
import type { HomeDesign } from "@shared/types/home";

export function BudgetPanel({ design }: { design: HomeDesign }) {
  const b = useMemo(() => estimateBudget(design), [design]);
  return (
    <div className="panel-body budget-panel" data-testid="budget-panel">
      <p className="eyebrow">INDICATIVE ESTIMATE</p>
      <p className="budget-total" data-budget-total={Math.round(b.total)}>
        {inr(b.total)}
      </p>
      <p className="small-note">
        {compactInr(b.total)}
        {b.builtUpArea > 0 && ` · ${inr(b.perSqFt)} per sq ft built-up (${Math.round(b.builtUpArea)} sq ft)`}
      </p>
      {b.groups.length === 0 && <p className="small-note">Add rooms to see an estimate.</p>}
      {b.groups.map((g) => (
        <details key={g.id} className="budget-group" open={g.id === "structure"}>
          <summary>
            <span>{g.label}</span>
            <strong>{inr(g.total)}</strong>
          </summary>
          <ul>
            {g.lines.map((l, i) => (
              <li key={i}>
                <span>
                  {l.label}
                  <small>{l.detail}</small>
                </span>
                <span>{inr(l.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {b.subtotal > 0 && (
        <div className="budget-foot">
          <span>Contingency (5%)</span>
          <span>{inr(b.contingency)}</span>
        </div>
      )}
      <p className="small-note">
        Rates are indicative 2026 figures for a mid-range build, before GST and approvals. Get local
        quotations before you commit.
      </p>
    </div>
  );
}
