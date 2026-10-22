import type { Metadata, Viewport } from "next";
import { bricolage, manrope } from "./fonts";
import { AppFrame } from "@/components/app-frame";
import { AccountActivity } from "@/components/account-activity";
import { LiveUpdates } from "@/components/live-updates";
import { CurrentProfileProvider } from "@/components/current-profile";
import { ActionNoticeProvider } from "@/components/form-feedback";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dinnerfolk", template: "%s · Dinnerfolk" },
  applicationName: "Dinnerfolk",
  description: "Food is worth sharing with people you know.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${bricolage.variable} ${manrope.variable}`}>
      <body>
        <AccountActivity />
        <LiveUpdates />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:bg-card focus:p-4">
          Skip to content
        </a>
        <CurrentProfileProvider><ActionNoticeProvider><AppFrame>{children}</AppFrame></ActionNoticeProvider></CurrentProfileProvider>
      </body>
    </html>
  );
}
