import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Inter as FontSans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/components/utils/theme-provider";
import { HydrateClient } from "~/trpc/server";
import GeneralLayout from "~/components/layouts/general-layout";
import { ModalProvider } from "~/contexts/modal-context";
// PostHog removed
import TelegramWebAppInit from "~/components/telegram-webapp-init";
import TelegramStartParamHandler from "~/components/telegram-start-param-handler";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "matigroup bot",
  description: "matigroup bot",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body
        className={cn(
          "h-screen bg-background font-sans antialiased overflow-hidden mt-24",
          fontSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <HydrateClient>
              <ModalProvider>
                <TelegramWebAppInit />
                <TelegramStartParamHandler>
                  <GeneralLayout>{children}</GeneralLayout>
                </TelegramStartParamHandler>
              </ModalProvider>
            </HydrateClient>
          </TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
