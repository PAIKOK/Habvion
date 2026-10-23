import { APP_NAME } from "@shared/version";

/**
 * Questions people ask, answered only with what the app actually does today.
 * Shown on the landing page and the contact page, and searchable from the header.
 * Keep each answer consistent with the Terms, Privacy and Refund pages.
 */
export const FAQ: { id: string; q: string; a: string }[] = [
  {
    id: "cost",
    q: `Does ${APP_NAME} cost anything?`,
    a: `This build has no checkout or subscription-billing flow. The rupee amounts in a design are indicative building costs, not a payment request. Any future paid offering must disclose its price and refund terms before purchase.`,
  },
  {
    id: "estimates",
    q: "How accurate are the cost estimates?",
    a: "They are indicative mid-range figures before GST, counted from what you draw. Real costs change by city and over time, so get local quotations before you spend money.",
  },
  {
    id: "construction",
    q: "Can I build straight from these plans?",
    a: "No. Plans and estimates are for planning, not construction drawings or structural advice. Have a licensed architect or engineer check them, and get the approvals your local authority requires.",
  },
  {
    id: "units",
    q: "Can I work in metres instead of feet?",
    a: "Yes. Choose feet or metres when you set up your plot. Measurements are shown in the unit you pick.",
  },
  {
    id: "demo",
    q: "Can I start from a demo home?",
    a: "Yes. Open any demo home and choose “Customize This House”. You get your own copy to change, and the original stays as it was.",
  },
  {
    id: "share",
    q: "Can I show my design to family or a builder?",
    a: "Yes. In the editor, choose Share to get a link. Anyone with the link can view the design but cannot change it, and you can stop sharing at any time.",
  },
  {
    id: "data",
    q: "How do I download or delete my data?",
    a: "Sign in and open your account page from your name in the header. You can export active account data or delete your account and designs. Backups, external copies and older unowned model files have separate limits explained in the Privacy Policy.",
  },
  {
    id: "contact",
    q: "How do I reach you?",
    a: "Use the contact form and pick a topic. You get a reference number to quote if you write again.",
  },
];
