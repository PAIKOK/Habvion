import type { Issue } from "@shared/design/actions";
import { floorLabel } from "@shared/lib/units";
import { useEditorStore } from "../state/editorStore";

export function IssuesPanel({ issues }: { issues: Issue[] }) {
  const ui = useEditorStore(),
    errors = issues.filter((i) => i.level === "error").length;
  return (
    <div className="panel-body issues-panel" data-testid="issues-panel">
      <p className="eyebrow">DESIGN AUDIT</p>
      <h2 className="issues-summary">
        {issues.length === 0
          ? "All clear."
          : `${errors} to fix · ${issues.length - errors} to consider`}
      </h2>
      <p className="small-note">
        Circulation, stairs, daylight and ventilation, services, access and sizes, checked on
        every change.
      </p>
      <ul className="issue-list">
        {issues.map((i, n) => (
          <li key={n}>
            <button
              data-issue-code={i.code}
              className={i.level}
              onClick={() => {
                const id = i.entityIds?.[0];
                ui.set({
                  ...(i.floor !== undefined ? { floor: i.floor } : {}),
                  ...(id ? { selected: id } : {}),
                  tool: "select",
                });
              }}
            >
              <span className="issue-dot" aria-hidden="true" />
              <span>
                {i.message}
                <small>
                  {i.level === "error" ? "Must fix" : "Suggestion"}
                  {i.floor !== undefined ? ` · ${floorLabel(i.floor)}` : ""}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
