import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter as FontSans } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/sonner";
import { TailwindIndicator } from "~/components/utils/tailwind-indicator";
import { ThemeProvider } from "~/components/utils/theme-provider";
import { HydrateClient } from "~/trpc/server";
import GeneralLayout from "~/components/layouts/general-layout";
import { CSPostHogProvider } from "./providers";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Fusion",
  description: "Fusion",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
      <CSPostHogProvider>
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
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
                <GeneralLayout>{children}</GeneralLayout>
              </HydrateClient>
            </TRPCReactProvider>
            <Toaster />
            <TailwindIndicator />
          </ThemeProvider>
        </body>
      </CSPostHogProvider>
    </html>
  );
}
