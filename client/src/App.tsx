import { useEffect } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { PlotSetupPage } from "./pages/PlotSetupPage";
import { EditorRoute } from "./pages/EditorRoute";
import { DesignsPage } from "./pages/DesignsPage";
import { SharedPage } from "./pages/SharedPage";
import { DemoPage } from "./pages/DemoPage";
import { AuthPage } from "./pages/AuthPage";
import { ContactPage } from "./pages/ContactPage";
import { AccountPage } from "./pages/AccountPage";
import { CookiesPage, CreditsPage, PrivacyPage, RefundsPage, TermsPage } from "./pages/LegalPages";
import { CookieBanner } from "./ui/CookieBanner";
import { SiteChrome } from "./ui/SiteChrome";
import { RequireAuth } from "./ui/RequireAuth";
import { useAuthStore } from "./state/authStore";
export default function App() {
  const refresh = useAuthStore((s) => s.refresh);
  useEffect(() => void refresh(), [refresh]);
  return (
    <>
    <CookieBanner />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/start" element={<RequireAuth><PlotSetupPage /></RequireAuth>} />
      <Route path="/designs" element={<RequireAuth><DesignsPage /></RequireAuth>} />
      <Route path="/editor" element={<RequireAuth><EditorRoute /></RequireAuth>} />
      <Route path="/editor/:id" element={<RequireAuth><EditorRoute /></RequireAuth>} />
      <Route path="/shared/:token" element={<SharedPage />} />
      <Route path="/demos/:id" element={<DemoPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/refunds" element={<RefundsPage />} />
      <Route path="/credits" element={<CreditsPage />} />
      <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route
        path="*"
        element={
          <main id="main" tabIndex={-1} className="section-shell placeholder-page">
            <h1>Page not found.</h1>
            <Link to="/">Return home</Link>
          </main>
        }
      />
    </Routes>
    {/* After the page in reading order, so Tab reaches the skip link and page first. */}
    <SiteChrome />
    </>
  );
}
