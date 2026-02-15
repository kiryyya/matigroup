"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import useTelegramInitData from "~/hooks/use-telegram-init-data";
import { Heart, Home, Settings } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useModal } from "~/contexts/modal-context";
import TelegramBackButton from "~/components/telegram-back-button";

const GeneralLayout = ({ children }: PropsWithChildren) => {
  const { data: user } = api.tg.getUser.useQuery();
  const pathname = usePathname();
  const { isModalOpen } = useModal();

  const [shouldShowAlert, setShouldShowAlert] = useState<string | null>(null);
  const { start_param } = useTelegramInitData();

  useEffect(() => {
    if (!user?.telegramId || !start_param) {
      console.log("no user or start_param");
      return;
    }

    // Referral logic removed
  }, [start_param, user?.telegramId]);

  useEffect(() => {
    if (shouldShowAlert) {
      alert(shouldShowAlert);
      setShouldShowAlert(null);
    }
  }, [shouldShowAlert]);

  return (
    <>
      {/* Управление системной кнопкой "Назад" Telegram Web App */}
      <TelegramBackButton />
      
      <div className="h-screen overflow-y-auto overflow-x-hidden scrollbar-hide">
        <main className="w-full">
          <div className="h-full max-w-full px-4 py-4 md:max-w-screen-lg lg:px-8">
            {children}
          </div>
        </main>
      </div>
      {!isModalOpen && (
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
              <Home className="h-5 w-5" />
            </Link>
            <Link 
              href="/favorites" 
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-full transition-colors",
                pathname === "/favorites" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Heart className="h-5 w-5" />
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
      )}
    </>
  );
};

export default GeneralLayout;
