import { managers } from "./auth.schema";

export type ManagerRow = typeof managers.$inferSelect;

export interface LoginManagerInput {
  email: string;
  password: string;
}