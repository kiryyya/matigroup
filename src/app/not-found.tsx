"use client";

// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import Error from "next/error";
import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { Inter as FontSans } from "next/font/google";
const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

/**
 * ### NotFound Page Component
 *
 * Purpose:
 * - This component renders the built-in Next.js 404 page.
 *
 * Behavior:
 * - Triggered when a user navigates to a route that doesn't
 *   have a corresponding locale set by the middleware.
 *
 * Output:
 * - Renders a page with a 404 error message.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body
        className={cn(
          "flex min-h-screen flex-col items-center justify-center bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          404 - Not Found
        </h1>
        <p className="mt-2 leading-7 text-muted-foreground [&:not(:first-child)]:mt-6">
          The page you are looking for does not exist.
        </p>
        <Link className={cn(buttonVariants({ variant: "link" }))} href="/">
          Go back to the homepage
        </Link>
      </body>
    </html>
  );
}
