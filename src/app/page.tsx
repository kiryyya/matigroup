"use client";

import useTelegramInitData from "~/hooks/use-telegram-init-data";

import * as React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import DefaultError from "~/components/layouts/error-page";
// Products removed
import { Badge } from "~/components/ui/badge";

export default function Home() {
  const { data } = api.tg.getUser.useQuery();
  const { user } = useTelegramInitData();

  return (
    <>
      <h1 className="scroll-m-20 text-3xl font-extrabold">
        Welcome, {user?.first_name}
      </h1>


      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Добро пожаловать!
          </h2>
          <p className="mt-2 text-muted-foreground">
            Здесь будет новый функционал
          </p>
        </div>
      </div>
    </>
  );
}

// ProductList removed
