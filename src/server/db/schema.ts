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
export const createTable = pgTableCreator((name) => name);

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
  role: varchar("role", { length: 255 })
    .notNull()
    .default("user")
    .$type<"user" | "admin">(),
});

export const usersRelations = relations(users, ({ many }) => ({}));



