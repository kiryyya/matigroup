import { InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  json,
  pgTableCreator,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `ffmemes_${name}`);

export const users = createTable("user", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
  telegramId: varchar("telegram_id", { length: 255 }).notNull(),
  chatId: varchar("chat_id", { length: 255 }),
  tapCount: integer("tap_count").notNull().default(0),
  referralCode: varchar("referral_code", { length: 255 }),
  referralCount: integer("referral_count").notNull().default(0),
  activatedCodes: json("activated_codes").$type<string[]>(),
  usedCodes: json("used_codes").$type<string[]>(),
  role: varchar("role", { length: 255 })
    .notNull()
    .default("user")
    .$type<"user" | "admin">(),
});

export const usersRelations = relations(users, ({ many }) => ({
  cartItems: many(cartItems),
}));

export const promocodes = createTable("promocodes", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 255 })
    .$type<"promocode" | "referral">()
    .notNull(),
  code: varchar("code", { length: 255 }).notNull(),
  // amount will remove N stars from the price or add N free taps
  amount: integer("amount").notNull().default(0),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const products = createTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  price: integer("price").notNull(),
  stock: integer("stock"),
  hidden: boolean("hidden").notNull().default(false),
  discount: integer("discount").notNull().default(0),
  instantBuy: boolean("instant_buy").notNull().default(false),
  description: text("description"),
  images: json("images").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const cartItems = createTable("cart_items", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
}));

export type Product = InferSelectModel<typeof products>;
export type CartItem = InferSelectModel<typeof cartItems>;
