"use client";

import React, { useEffect } from "react";
import { api } from "~/trpc/react";
import { useDebounce } from "@uidotdev/usehooks";
import { Button, buttonVariants } from "~/components/ui/button";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { PlusCircle } from "lucide-react";

const TapPage = () => {
  const utils = api.useUtils();
  const { data: user } = api.tg.getUser.useQuery();
  const { data: topupLink } = api.tap.getTopupLink.useQuery();

  const { mutate: tap } = api.tap.add.useMutation({
    onMutate: async (variables) => {
      await utils.tg.getUser.cancel();
      const previousUser = utils.tg.getUser.getData();
      if (previousUser) {
        utils.tg.getUser.setData(undefined, {
          ...previousUser,
          tapCount: previousUser.tapCount + 1,
        });
      }
      return { previousUser };
    },
    onError: (error, variables, context) => {
      if (context?.previousUser) {
        utils.tg.getUser.setData(undefined, context.previousUser);
      }
    },
  });

  const debouncedCount = useDebounce(user?.tapCount, 500);

  useEffect(() => {
    if (debouncedCount) {
      void utils.tap.getLeaderboard.invalidate();
      void utils.tg.getUser.invalidate();
    }
  }, [debouncedCount, utils]);

  return (
    <div>
      <h1 className="text-center text-2xl font-bold">Pawster Wombat</h1>

      <Link
        href={topupLink ?? ""}
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "mt-2 w-full",
        )}
      >
        <PlusCircle className="mr-2 h-4 w-4" /> Buy Taps
      </Link>

      <div className="relative mt-8 flex h-[50vh] items-center justify-center">
        <div
          onClick={() => tap()}
          className="flex aspect-square h-full cursor-pointer select-none items-center justify-center rounded-full bg-gradient-to-b from-blue-500 to-blue-700 shadow-xl transition-all active:scale-90"
        >
          <div className="select-none text-2xl font-bold text-white">
            {user?.tapCount ?? "N/A"}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-2xl font-bold">Leaderboard</div>
      <Leaderboard />
    </div>
  );
};

export default TapPage;

const Leaderboard = () => {
  const { data } = api.tg.getUser.useQuery();
  const { data: leaderboard } = api.tap.getLeaderboard.useQuery(undefined, {
    refetchInterval: 1000,
  });

  return (
    <div className="mt-4 flex flex-col gap-2">
      {leaderboard?.map((user) => {
        const isCurrentUser = user.id === data?.id;
        return (
          <div key={user.id} className="flex items-center justify-between">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-lg font-medium">
              {isCurrentUser ? data?.tapCount : user.tapCount}
            </p>
          </div>
        );
      })}
    </div>
  );
};
