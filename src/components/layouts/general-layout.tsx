"use client";

import Link from "next/link";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import { ThemeToggle } from "../utils/theme-toggle";
import useTelegramInitData from "~/hooks/use-telegram-init-data";
import { PawPrint, Store } from "lucide-react";
import { CartDropdown } from "./cart-dropdown";
import { api } from "~/trpc/react";

const GeneralLayout = ({ children }: PropsWithChildren) => {
  const { data: user } = api.tg.getUser.useQuery();

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
      <div className="border-b">
        <div className="grid h-16 grid-cols-5 items-center bg-card px-4">
          <div className="col-span-2 flex items-center space-x-4">
            <Link href="/" className="col-span-2 lg:col-span-1">
              <Store className="h-6 w-6" />
            </Link>
            <Link href="/tap" className="col-span-2 lg:col-span-1">
              <PawPrint className="h-6 w-6" />
            </Link>
          </div>
          <div className="col-span-3 flex w-full px-0 lg:col-span-4 lg:px-4">
            <div className="ml-auto flex items-center space-x-4">
              <p className="text-sm font-medium capitalize text-muted-foreground">
                {telegramUser?.language_code}
              </p>
              <ThemeToggle />

              <CartDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <main className="w-full lg:border-l">
          <div className="h-full max-w-full px-4 py-4 md:max-w-screen-lg lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </>
  );
};

export default GeneralLayout;
