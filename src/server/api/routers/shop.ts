import { db } from "~/server/db";
import { createTRPCRouter, procedure } from "../trpc";
import { z } from "zod";
import { cartItems, products } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";
import { bot } from "~/server/telegram";
import { TRPCError } from "@trpc/server";

export const shopRouter = createTRPCRouter({
  cart: procedure.query(async ({ ctx }) => {
    const cart = await db.query.cartItems.findMany({
      where: eq(cartItems.userId, ctx.user.id),
      with: { product: true },
    });

    return cart;
  }),
  products: procedure.query(async ({ ctx }) => {
    const products = await db.query.products.findMany();

    const itemsWithLinks = await Promise.all(
      products.map(async (i) => {
        if (i.instantBuy) {
          const link = await bot.telegram.createInvoiceLink({
            description: i.description ?? "",
            prices: [{ amount: i.price - i.discount, label: i.name ?? "" }],
            title: i.name ?? "",
            currency: "XTR",
            payload: `${i.id}-${ctx.user.id}`,
            provider_token: "",
          });

          console.log(link);

          return {
            ...i,
            link,
          };
        }

        return i;
      }),
    );

    console.log(itemsWithLinks);

    return itemsWithLinks;
  }),
  productItem: procedure.input(z.coerce.string()).query(async ({ input }) => {
    return db.query.products.findFirst({
      where: eq(products.id, +input),
    });
  }),
  addToCart: procedure
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { productId, quantity } = input;
      const existingCartItem = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.productId, productId),
          eq(cartItems.userId, ctx.user.id),
        ),
      });

      if (existingCartItem) {
        return db
          .update(cartItems)
          .set({
            quantity: existingCartItem.quantity + quantity,
          })
          .where(eq(cartItems.id, existingCartItem.id));
      }

      return db.insert(cartItems).values({
        productId: input.productId,
        quantity: input.quantity,
        userId: ctx.user.id,
      });
    }),
  removeFromCart: procedure
    .input(z.number())
    .mutation(async ({ input, ctx }) => {
      console.log("Remove", input);
      return db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.productId, input),
            eq(cartItems.userId, ctx.user.id),
          ),
        );
    }),
  updateCartItem: procedure
    .input(z.object({ id: z.number(), quantity: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return db
        .update(cartItems)
        .set({ quantity: input.quantity })
        .where(
          and(
            eq(cartItems.productId, input.id),
            eq(cartItems.userId, ctx.user.id),
          ),
        );
    }),

  getCartPaymentLink: procedure
    .input(z.object({ id: z.number() }).optional())
    .mutation(async ({ ctx }) => {
      const cart = await db.query.cartItems.findMany({
        where: eq(cartItems.userId, ctx.user.id),
        with: { product: true, user: true },
      });

      if (cart.length === 0) {
        return null;
      }

      console.log(cart);
      const user = cart[0]?.user;

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const invoiceLink = await bot.telegram.createInvoiceLink({
        currency: "XTR",
        payload: `${user.telegramId}-1`,
        provider_token: "",
        prices: [
          {
            label: `Purchase `,
            amount: cart.reduce(
              (acc, i) =>
                acc + (i.product.price - i.product.discount) * i.quantity,
              0,
            ),
          },
        ],
        title: `Purchase ${cart.length} item(s) in ffmemes shop`,
        description: `Purchase ${cart.map((i) => i.product.name).join(", ")}`,
      });

      return invoiceLink;
    }),
});
