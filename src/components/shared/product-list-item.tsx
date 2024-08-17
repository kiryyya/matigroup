import { CartItem, Product } from "~/server/db/schema";
import { Button, buttonVariants } from "../ui/button";
import Image from "next/image";
import { blurImage, cn, formatPrice } from "~/lib/utils";
import { BookDashed, Minus, Plus, Trash } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Link from "next/link";
import posthog from "posthog-js";

const ProductImage: React.FC<{
  product: Product;
  single?: boolean;
}> = ({ product, single }) => (
  <div
    className={`relative h-40 w-full overflow-hidden rounded-md ${single ? "h-96" : ""}`}
  >
    {product.images?.[0] ? (
      <Image
        className="rounded"
        src={product.images?.[0] ?? ""}
        alt={product.name ?? ""}
        blurDataURL={blurImage(product.images?.[0] ?? "", 150, 150)}
        placeholder="blur"
        fill
        sizes="100vw"
        style={{
          objectFit: "cover",
        }}
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded bg-slate-100">
        <p className="text-lg font-bold text-slate-400">
          <BookDashed className="h-16 w-16 rotate-12" />
        </p>
      </div>
    )}
  </div>
);

type ProductListItemProps = {
  product: Product;
  single?: boolean;
};

export const useProductActions = (product: Product) => {
  const utils = api.useUtils();

  const { data: cart } = api.shop.cart.useQuery();
  const cartItem = cart?.find((item) => item.productId === product.id);

  const addToCart = api.shop.addToCart.useMutation({
    onError(error) {
      toast.error(`Failed to add to cart: ${error.message}`);
    },
    onSuccess: () => {
      posthog.capture("add-to-cart", {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
      });
      void utils.shop.products.invalidate();
      void utils.shop.cart.invalidate();
    },
  });
  const removeFromCart = api.shop.removeFromCart.useMutation({
    onSuccess: () => {
      posthog.capture("remove-from-cart", {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
      });
    },
    onError(error) {
      toast.error(`Failed to remove from cart: ${error.message}`);
    },
    onSettled: () => {
      void utils.shop.products.invalidate();
      void utils.shop.cart.invalidate();
    },
  });
  const updateCartItem = api.shop.updateCartItem.useMutation({
    onSuccess: () => {
      posthog.capture("update-cart-item", {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        quantity: cartItem?.quantity,
      });
    },
    onError(error) {
      toast.error(`Failed to update cart item: ${error.message}`);
    },
    onSettled: () => {
      void utils.shop.products.invalidate();
      void utils.shop.cart.invalidate();
    },
  });

  return {
    cartItem,
    addToCart,
    removeFromCart,
    updateCartItem,
  };
};

const ProductItemActions: React.FC<{
  product: Product & { link?: string };
}> = ({ product }) => {
  const { cartItem, addToCart, removeFromCart, updateCartItem } =
    useProductActions(product);

  return (
    <div className="mt-2 flex items-center gap-2">
      {cartItem ? (
        <>
          {cartItem.quantity > 1 ? (
            <Button
              isLoading={updateCartItem.isPending}
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return updateCartItem.mutate({
                  id: product.id,
                  quantity: cartItem.quantity - 1,
                });
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              isLoading={removeFromCart.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return removeFromCart.mutate(product.id);
              }}
              variant="secondary"
              size="icon"
            >
              <Trash className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center justify-center">
            <p className="px-1 text-center text-lg font-medium text-muted-foreground">
              {cartItem.quantity}
            </p>
          </div>
          <Button
            isLoading={updateCartItem.isPending}
            size="icon"
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return updateCartItem.mutate({
                id: product.id,
                quantity: cartItem.quantity + 1,
              });
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-2">
          {product.link ? (
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return (window.location.href = product.link ?? "");
              }}
              // href={product.link ?? ""}
              className={cn(buttonVariants({ variant: "default" }), "w-full")}
            >
              Instant Buy
            </Button>
          ) : (
            <Button
              isLoading={addToCart.isPending}
              disabled={product.stock === 0}
              className="w-full px-4"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return addToCart.mutate({ productId: product.id, quantity: 1 });
              }}
            >
              Add to cart
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const ProductListItem = ({ product, single }: ProductListItemProps) => {
  const content = (
    <div className="flex flex-col">
      <ProductImage product={product} single={single} />
      <p className="mt-2 h-8 overflow-hidden text-sm font-medium leading-tight text-muted-foreground">
        {product.name}
      </p>

      <div
        className={cn(
          "flex",
          single ? "flex-row items-center justify-between" : "flex-col",
        )}
      >
        <div className="mt-2 flex items-center">
          <p className="text-lg font-medium text-muted-foreground">
            ⭐ {formatPrice(product.price - product.discount)}
          </p>
          {product.discount > 0 && (
            <p className="ml-2 rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-500 line-through">
              {formatPrice(product.price)}
            </p>
          )}
        </div>
        <ProductItemActions product={product} />
      </div>
    </div>
  );

  const containerClassNames = cn(
    "mt-4 w-full overflow-hidden rounded-md bg-card",
    single ? "p-0" : "p-2 border border-border shadow-sm",
  );

  return single ? (
    <div className={containerClassNames}>{content}</div>
  ) : (
    <Link
      href={`/product/${product.id}`}
      key={product.id}
      className={containerClassNames}
    >
      {content}
    </Link>
  );
};

export default ProductListItem;
