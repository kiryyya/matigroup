"use client";

import { api } from "~/trpc/react";
import { Button, buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { CreditCard, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

export function CartDropdown() {
  const [open, setOpen] = useState(false);
  const { data: cart } = api.shop.cart.useQuery();
  const { mutateAsync: getCartPaymentLink } =
    api.shop.getCartPaymentLink.useMutation();
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null);

  useEffect(() => {
    if (open && cart?.length) {
      void getCartPaymentLink().then((invoiceLink) => {
        setInvoiceLink(invoiceLink);
      });
    }
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="relative" size="icon">
          <ShoppingCart className="h-4 w-4" />
          <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 p-2 text-xs text-white">
            {cart?.map((item) => item.quantity).reduce((a, b) => a + b, 0)}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          {cart?.length ? (
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                Cart total: ⭐{" "}
                {cart
                  ?.map(
                    (item) =>
                      (item.product.price - item.product.discount) *
                      item.quantity,
                  )
                  .reduce((a, b) => a + b, 0)}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {cart?.map((item) => item.quantity).reduce((a, b) => a + b, 0)}{" "}
                items
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium leading-none">Your cart</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col space-y-4 px-2 py-2">
          {cart?.map((item) => (
            <Link
              key={item.id}
              href={`/product/${item.product.id}`}
              className="flex items-center justify-between text-xs text-muted-foreground"
            >
              <div>
                <p className="text-sm font-medium leading-none">
                  {item.product.name}
                </p>
                <p className="mt-1 text-xs leading-none text-muted-foreground">
                  {item.quantity}x
                </p>
              </div>
              <p className="whitespace-nowrap text-sm font-medium leading-none">
                ⭐{" "}
                {(item.product.price - item.product.discount) * item.quantity}
              </p>
            </Link>
          ))}

          {!cart?.length && (
            <p className="mx-auto w-2/3 py-4 text-center text-sm font-medium leading-none text-muted-foreground">
              Nothing here yet
            </p>
          )}
        </div>
        {!!cart?.length ? (
          <>
            <DropdownMenuSeparator />
            <Link
              href={invoiceLink ?? ""}
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  isLoading: invoiceLink === null,
                }),
                "flex justify-center",
              )}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Buy now
            </Link>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
