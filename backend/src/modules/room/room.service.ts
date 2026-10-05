import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "./room.schema";

export type RoomRow = typeof rooms.$inferSelect;

export async function countRoomsForMotel(motelId: string): Promise<number> {
  return db.$count(rooms, eq(rooms.motelId, motelId));
}

export async function countOccupiedRoomsForMotel(motelId: string): Promise<number> {
  return db.$count(rooms, and(eq(rooms.motelId, motelId), eq(rooms.status, "occupied")));
}