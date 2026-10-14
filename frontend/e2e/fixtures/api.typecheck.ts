import { MOTEL, RENTER, ROOM } from "../../src/lib/api/__tests__/fixtures";
import type { ApiFixtures } from "./api";

const roomPath = `PATCH /api/manager/motels/${MOTEL.id}/rooms/${ROOM.id}` as const;
const renterPath = `PATCH /api/manager/motels/${MOTEL.id}/renters/${RENTER.id}` as const;

({ [roomPath]: ROOM }) satisfies ApiFixtures<typeof roomPath>;
({ [renterPath]: RENTER }) satisfies ApiFixtures<typeof renterPath>;

// @ts-expect-error A motel DTO is not a valid room PATCH response fixture.
({ [roomPath]: MOTEL }) satisfies ApiFixtures<typeof roomPath>;
// @ts-expect-error A room DTO is not a valid renter PATCH response fixture.
({ [renterPath]: ROOM }) satisfies ApiFixtures<typeof renterPath>;
