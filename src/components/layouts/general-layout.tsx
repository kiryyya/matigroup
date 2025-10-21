"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import useTelegramInitData from "~/hooks/use-telegram-init-data";
import { FolderHeart, Store, Settings } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const GeneralLayout = ({ children }: PropsWithChildren) => {
  const { data: user } = api.tg.getUser.useQuery();
  const pathname = usePathname();

  const [shouldShowAlert, setShouldShowAlert] = useState<string | null>(null);
  const { start_param, user: telegramUser } = useTelegramInitData();

  useEffect(() => {
    if (!user?.telegramId || !start_param) {
      console.log("no user or start_param");
      return;
    }

    if (user?.usedCodes?.includes(`${start_param}`)) {
      setShouldShowAlert(`Code ${start_param} is already used`);
      return;
    }

    if (user.activatedCodes?.includes(`${start_param}`)) {
      setShouldShowAlert(`Code ${start_param} is already activated`);
      return;
    }

    setShouldShowAlert(`You've activated the code: ${start_param}`);
    return;
  }, [start_param, user?.telegramId]);

  useEffect(() => {
    if (shouldShowAlert) {
      alert(shouldShowAlert);
      setShouldShowAlert(null);
    }
  }, [shouldShowAlert]);

  return (
    <>
      <div className="h-screen overflow-y-auto overflow-x-hidden pb-20 scrollbar-hide">
        <main className="w-full">
          <div className="h-full max-w-full px-4 py-4 md:max-w-screen-lg lg:px-8">
            {children}
          </div>
        </main>
      </div>
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center justify-center space-x-2 bg-gray-600/20 px-2 py-2 rounded-3xl backdrop-blur-sm">
            <Link 
              href="/" 
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-full transition-colors",
                pathname === "/" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Store className="h-5 w-5" />
            </Link>
            <Link 
              href="/tap" 
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-full transition-colors",
                pathname === "/tap" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FolderHeart className="h-5 w-5" />
            </Link>
            {user?.role === "admin" && (
              <Link 
                href="/settings" 
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-full transition-colors",
                  pathname === "/settings" 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
    </>
  );
};

export default GeneralLayout;
