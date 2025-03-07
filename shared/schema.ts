import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  preferences: jsonb("preferences").notNull(),
});

export const userPreferences = z.object({
  temperatureUnit: z.enum(["celsius", "fahrenheit"]),
  healthConditions: z.array(z.string()),
  dietaryRestrictions: z.array(z.string()),
});

export const insertUserSchema = createInsertSchema(users);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserPreferences = z.infer<typeof userPreferences>;
