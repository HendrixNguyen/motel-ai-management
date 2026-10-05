import { managers } from "./auth.schema";

export type ManagerRow = typeof managers.$inferSelect;

export interface RegisterManagerInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginManagerInput {
  email: string;
  password: string;
}

export interface ManagerJwtPayload {
  userId: string;
  email: string;
}