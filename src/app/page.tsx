"use client";

import useTelegramInitData from "~/hooks/use-telegram-init-data";

import * as React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import DefaultError from "~/components/layouts/error-page";
import ProductListItem from "~/components/shared/product-list-item";
import { Badge } from "~/components/ui/badge";

export default function Home() {
  const { data } = api.tg.getUser.useQuery();
  const { user } = useTelegramInitData();

  return (
    <>
      <h1 className="scroll-m-20 text-3xl font-extrabold">
        Welcome, {user?.first_name}
      </h1>

      {!!data?.activatedCodes?.length && (
        <div className="flex flex-col gap-2">
          <h2 className="scroll-m-20 text-sm font-light">
            You have active codes
          </h2>
          <div className="flex flex-wrap gap-2">
            {data?.activatedCodes?.map((code) => {
              return (
                <Badge variant="secondary" className="" key={code}>
                  {code}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <ProductList />
    </>
  );
}

const ProductList = () => {
  const { data: user } = api.tg.getUser.useQuery();
  const { data, isLoading } = api.shop.products.useQuery();

  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-4 pt-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );

  if (!data) return <DefaultError error={{ message: "No products" }} />;

  if (data.length === 0) return <div>No products</div>;
  return (
    <div className="grid grid-cols-2 gap-4">
      {data.map((product) => {
        return <ProductListItem key={product.id} product={product} />;
      })}

      {user?.telegramId && (
        <div>
          <h2>Your referral link</h2>
          <p
            onClick={() => {
              void navigator.clipboard.writeText(
                `t.me/ffmemeswebappstagingbot/sample?startapp=${user?.telegramId}`,
              );
            }}
            className="cursor-pointer text-sm text-muted-foreground active:scale-95"
          >
            {`t.me/ffmemeswebappstagingbot/sample?startapp=${user?.telegramId}`}
          </p>
        </div>
      )}
    </div>
  );
};
