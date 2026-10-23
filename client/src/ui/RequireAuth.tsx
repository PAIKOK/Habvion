import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { PageSkeleton } from "./Skeleton";

/** Protected pages: wait for the session check, then send strangers to log in and back. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuthStore(),
    loc = useLocation();
  if (status === "loading")
    return (
      <main id="main" tabIndex={-1} className="section-shell skeleton-page">
        <PageSkeleton label="Checking your sign-in" />
      </main>
    );
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}
