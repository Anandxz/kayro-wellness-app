import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./client.css";
import "./practice.css";
import "./reminders.css";
import { BookingProvider } from "@/components/client/booking-provider";
export const metadata: Metadata = {
  title: { default: "Kayro · Care at your own pace", template: "%s · Kayro" },
  description:
    "Thoughtful nutrition consultations and a calmer approach to everyday wellbeing.",
  applicationName: "Kayro",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kayro" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: "#365644",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <BookingProvider>{children}</BookingProvider>
      </body>
    </html>
  );
}
