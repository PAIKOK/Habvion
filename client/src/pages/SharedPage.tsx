import { useEffect, useState } from "react";
import { PageSkeleton } from "../ui/Skeleton";
import { Link, useParams } from "react-router-dom";
import type { HomeDesign } from "@shared/types/home";
import { validateDesign } from "@shared/design/validation";
import { api } from "../api/client";
import { Header } from "../ui/Header";
import { DesignViewer } from "../ui/DesignViewer";
import { APP_NAME } from "@shared/version";

/** `/shared/:token`: anyone with the link may look; nobody may edit. */
export function SharedPage() {
  const { token = "" } = useParams(),
    [design, setDesign] = useState<HomeDesign | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ design: HomeDesign }>(`/shared/${encodeURIComponent(token)}`).then(
      (r) => (validateDesign(r.design).ok ? setDesign(r.design) : setError("This shared design could not be read.")),
      (e: Error) => setError(e.message),
    );
  }, [token]);
  return (
    <div className="viewer-page">
      <Header />
      {design ? (
        <DesignViewer design={design} badge="SHARED DESIGN · READ-ONLY" />
      ) : (
        <main id="main" tabIndex={-1} className="section-shell placeholder-page">
          {error ? (
            <>
              <h1>Link not available.</h1>
              <p>{error}</p>
              <Link to="/">Go to {APP_NAME}</Link>
            </>
          ) : (
            <PageSkeleton label="Loading the shared design" />
          )}
        </main>
      )}
    </div>
  );
}
