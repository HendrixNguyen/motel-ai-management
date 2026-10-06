import { db } from "@/db";
import { parseAmount } from "@/shared/money";
import { normalisePhone } from "@/shared/phone";
import {
  managers,
  motels,
  rooms,
  renters,
  contractTemplates,
  contracts,
  billingPeriods,
  meterReadings,
  invoices,
  helpTickets,
  zaloNotifications,
} from "@/db/schemas";

// Hardcoded UUIDs for deterministic data
const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const MOTEL_ID = "22222222-2222-2222-2222-222222222222";
const ROOM_101_ID = "33333333-3333-3333-3333-333333333333";
const ROOM_102_ID = "44444444-4444-4444-4444-444444444444";
const ROOM_103_ID = "55555555-5555-5555-5555-555555555555";
const ROOM_104_ID = "66666666-6666-6666-6666-666666666666";
const RENTER_1_ID = "77777777-7777-7777-7777-777777777777";
const RENTER_2_ID = "88888888-8888-8888-8888-888888888888";
const RENTER_3_ID = "99999999-9999-9999-9999-999999999999";
const CONTRACT_TEMPLATE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CONTRACT_1_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CONTRACT_2_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CONTRACT_3_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const BILLING_PERIOD_SEP_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const BILLING_PERIOD_OCT_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const HELP_TICKET_1_ID = "10101010-1010-1010-1010-101010101010";
const HELP_TICKET_2_ID = "20202020-2020-2020-2020-202020202020";
const ZALO_NOTIF_1_ID = "30303030-3030-3030-3030-303030303030";
const ZALO_NOTIF_2_ID = "40404040-4040-4040-4040-404040404040";
const ZALO_NOTIF_3_ID = "50505050-5050-5050-5050-505050505050";

export async function seedData() {
  // Safety check - never run in production
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed data cannot be run in production");
  }

  console.log("Seeding deterministic data...");

  // Delete in reverse dependency order to avoid foreign key constraints
  await db.delete(zaloNotifications);
  await db.delete(helpTickets);
  await db.delete(invoices);
  await db.delete(meterReadings);
  await db.delete(billingPeriods);
  await db.delete(contracts);
  await db.delete(contractTemplates);
  await db.delete(renters);
  await db.delete(rooms);
  await db.delete(motels);
  await db.delete(managers);

  // 1. Create manager
  await db
    .insert(managers)
    .values({
      id: MANAGER_ID,
      email: "manager@example.com",
      passwordHash: await Bun.password.hash("password", {
        algorithm: "bcrypt",
        cost: 10,
      }),
      name: "Quản lý Mặt Bằng",
      phone: "0901234567",
    });

  console.log("✓ Created manager");

  // 2. Create motel
  await db
    .insert(motels)
    .values({
      id: MOTEL_ID,
      managerId: MANAGER_ID,
      name: "KTX Nhà Trọ Việt",
      address: "123 Nguyễn Văn Cừ, Quận 5, TP.HCM",
      electricityPrice: parseAmount("3000"), // 3000 VND/kWh
      waterPrice: parseAmount("15000"), // 15000 VND/m³
      otherFees: JSON.parse(
        JSON.stringify([
          { name: "Internet", amount: parseAmount("100000") },
          { name: "Vệ sinh", amount: parseAmount("50000") },
        ])
      ),
      bankAccount: JSON.parse(
        JSON.stringify({
          bankCode: "004",
          accountNumber: "123456789",
          accountName: "Công ty TNHH Nhà Trọ Việt",
        })
      ),
    });

  console.log("✓ Created motel");

  // 3. Create rooms
  const roomsData = [
    {
      id: ROOM_101_ID,
      motelId: MOTEL_ID,
      name: "P.101",
      basePrice: parseAmount("2000000"), // 2,000,000 VND
      floor: 1,
      status: "occupied",
    },
    {
      id: ROOM_102_ID,
      motelId: MOTEL_ID,
      name: "P.102",
      basePrice: parseAmount("1800000"), // 1,800,000 VND
      floor: 1,
      status: "occupied",
    },
    {
      id: ROOM_103_ID,
      motelId: MOTEL_ID,
      name: "P.103",
      basePrice: parseAmount("1500000"), // 1,500,000 VND
      floor: 2,
      status: "available",
    },
    {
      id: ROOM_104_ID,
      motelId: MOTEL_ID,
      name: "P.104",
      basePrice: parseAmount("1200000"), // 1,200,000 VND
      floor: 2,
      status: "maintenance",
    },
  ] satisfies (typeof rooms.$inferInsert)[];

  const insertedRooms = await db
    .insert(rooms)
    .values(roomsData)
    .returning();

  console.log("✓ Created rooms");

  // 4. Create renters
  const rentersData = [
    {
      id: RENTER_1_ID,
      motelId: MOTEL_ID,
      name: "Nguyễn Văn An",
      phone: normalisePhone("0901234567"),
      idNumber: "001234567890",
      roomId: ROOM_101_ID,
      isOaFollower: true,
      status: "active",
    },
    {
      id: RENTER_2_ID,
      motelId: MOTEL_ID,
      name: "Trần Thị Bình",
      phone: normalisePhone("0909876543"),
      idNumber: "009876543210",
      roomId: ROOM_102_ID,
      isOaFollower: false,
      status: "active",
    },
    {
      id: RENTER_3_ID,
      motelId: MOTEL_ID,
      name: "Lê Văn Cường",
      phone: normalisePhone("0912345678"),
      idNumber: "001122334455",
      roomId: null, // Unassigned
      isOaFollower: true,
      status: "active",
    },
  ] satisfies (typeof renters.$inferInsert)[];

  const insertedRenters = await db
    .insert(renters)
    .values(rentersData)
    .returning();

  console.log("✓ Created renters");

  // 5. Create contract template
  await db
    .insert(contractTemplates)
    .values({
      id: CONTRACT_TEMPLATE_ID,
      motelId: MOTEL_ID,
      name: "Mẫu hợp đồng tiêu chuẩn",
      clauses: JSON.parse(
        JSON.stringify([
          {
            title: "Thời hạn hợp đồng",
            content: "Hợp đồng có thời hạn từ ngày ký đến ngày 31/12/2026.",
          },
          {
            title: "Tiền phòng",
            content: "Tiền phòng thanh toán hàng tháng trước ngày 5.",
          },
          {
            title: "Sử dụng nội thất",
            content: "Người thuê phải bảo quản và bảo tồn nội thất theo đúng mục đích.",
          },
        ])
      ),
      isDefault: true,
    });

  console.log("✓ Created contract template");

  // 6. Create contracts
  const contractsData = [
    {
      id: CONTRACT_1_ID,
      renterId: RENTER_1_ID,
      roomId: ROOM_101_ID,
      motelId: MOTEL_ID,
      templateId: CONTRACT_TEMPLATE_ID,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: parseAmount("2000000"),
      deposit: parseAmount("2000000"),
      clauses: JSON.parse(
        JSON.stringify([
          {
            title: "Thời hạn hợp đồng",
            content: "Hợp đồng có thời hạn từ ngày ký đến ngày 31/12/2026.",
          },
          {
            title: "Tiền phòng",
            content: "Tiền phòng thanh toán hàng tháng trước ngày 5.",
          },
          {
            title: "Sử dụng nội thất",
            content: "Người thuê phải bảo quản và bảo tồn nội thất theo đúng mục đích.",
          },
        ])
      ),
      status: "active",
    },
    {
      id: CONTRACT_2_ID,
      renterId: RENTER_2_ID,
      roomId: ROOM_102_ID,
      motelId: MOTEL_ID,
      templateId: CONTRACT_TEMPLATE_ID,
      startDate: "2026-03-01",
      endDate: "2026-11-30",
      monthlyRent: parseAmount("1800000"),
      deposit: parseAmount("1800000"),
      clauses: JSON.parse(
        JSON.stringify([
          {
            title: "Thời hạn hợp đồng",
            content: "Hợp đồng có thời hạn từ ngày ký đến ngày 30/11/2026.",
          },
          {
            title: "Tiền phòng",
            content: "Tiền phòng thanh toán hàng tháng trước ngày 5.",
          },
          {
            title: "Sử dụng nội thất",
            content: "Người thuê phải bảo quản và bảo tồn nội thất theo đúng mục đích.",
          },
        ])
      ),
      status: "active",
    },
    {
      id: CONTRACT_3_ID,
      renterId: RENTER_1_ID, // Same renter as contract 1 but different room/period
      roomId: ROOM_103_ID,
      motelId: MOTEL_ID,
      templateId: CONTRACT_TEMPLATE_ID,
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      monthlyRent: parseAmount("1500000"),
      deposit: parseAmount("1500000"),
      clauses: JSON.parse(
        JSON.stringify([
          {
            title: "Thời hạn hợp đồng",
            content: "Hợp đồng đã hết hạn.",
          },
          {
            title: "Tiền phòng",
            content: "Tiền phòng thanh toán hàng tháng trước ngày 5.",
          },
          {
            title: "Sử dụng nội thất",
            content: "Người thuê phải bảo quản và bảo tồn nội thất theo đúng mục đích.",
          },
        ])
      ),
      status: "expired",
    },
  ] satisfies (typeof contracts.$inferInsert)[];

  const insertedContracts = await db
    .insert(contracts)
    .values(contractsData)
    .returning();

  console.log("✓ Created contracts");

  // 7. Create billing periods
  const billingPeriodsData = [
    {
      id: BILLING_PERIOD_SEP_ID,
      motelId: MOTEL_ID,
      month: 9,
      year: 2026,
      status: "sent",
    },
    {
      id: BILLING_PERIOD_OCT_ID,
      motelId: MOTEL_ID,
      month: 10,
      year: 2026,
      status: "draft",
    },
  ] satisfies (typeof billingPeriods.$inferInsert)[];

  const insertedBillingPeriods = await db
    .insert(billingPeriods)
    .values(billingPeriodsData)
    .returning();

  console.log("✓ Created billing periods");

  // 8. Create meter readings for September 2026
  const septemberReadings = [
    // Room 101 - Electric
    {
      id: "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1",
      roomId: ROOM_101_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "electric",
      previousReading: parseAmount("100.00"),
      currentReading: parseAmount("150.50"),
      photoUrl: "https://example.com/meter1.jpg",
      readingDate: "2026-09-30",
    },
    // Room 101 - Water
    {
      id: "b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2",
      roomId: ROOM_101_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "water",
      previousReading: parseAmount("20.00"),
      currentReading: parseAmount("25.30"),
      photoUrl: "https://example.com/meter2.jpg",
      readingDate: "2026-09-30",
    },
    // Room 102 - Electric
    {
      id: "c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3",
      roomId: ROOM_102_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "electric",
      previousReading: parseAmount("80.00"),
      currentReading: parseAmount("120.75"),
      photoUrl: "https://example.com/meter3.jpg",
      readingDate: "2026-09-30",
    },
    // Room 102 - Water
    {
      id: "d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4",
      roomId: ROOM_102_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "water",
      previousReading: parseAmount("15.00"),
      currentReading: parseAmount("18.20"),
      photoUrl: "https://example.com/meter4.jpg",
      readingDate: "2026-09-30",
    },
    // Room 103 - Electric (unoccupied, so same reading)
    {
      id: "e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5",
      roomId: ROOM_103_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "electric",
      previousReading: parseAmount("50.00"),
      currentReading: parseAmount("50.00"),
      photoUrl: "https://example.com/meter5.jpg",
      readingDate: "2026-09-30",
    },
    // Room 103 - Water (unoccupied, so same reading)
    {
      id: "f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6",
      roomId: ROOM_103_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "water",
      previousReading: parseAmount("10.00"),
      currentReading: parseAmount("10.00"),
      photoUrl: "https://example.com/meter6.jpg",
      readingDate: "2026-09-30",
    },
    // Room 104 - Electric (maintenance)
    {
      id: "07070707-0707-0707-0707-070707070707",
      roomId: ROOM_104_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "electric",
      previousReading: parseAmount("30.00"),
      currentReading: parseAmount("30.00"),
      photoUrl: "https://example.com/meter7.jpg",
      readingDate: "2026-09-30",
    },
    // Room 104 - Water (maintenance)
    {
      id: "08080808-0808-0808-0808-080808080808",
      roomId: ROOM_104_ID,
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      type: "water",
      previousReading: parseAmount("5.00"),
      currentReading: parseAmount("5.00"),
      photoUrl: "https://example.com/meter8.jpg",
      readingDate: "2026-09-30",
    },
  ] satisfies (typeof meterReadings.$inferInsert)[];

  // 9. Create meter readings for October 2026
  const octoberReadings = [
    // Room 101 - Electric
    {
      id: "09090909-0909-0909-0909-090909090909",
      roomId: ROOM_101_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "electric",
      previousReading: parseAmount("150.50"), // Continues from September
      currentReading: parseAmount("200.25"),
      photoUrl: "https://example.com/meter9.jpg",
      readingDate: "2026-10-31",
    },
    // Room 101 - Water
    {
      id: "10101010-1010-1010-1010-101010101011",
      roomId: ROOM_101_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "water",
      previousReading: parseAmount("25.30"), // Continues from September
      currentReading: parseAmount("30.80"),
      photoUrl: "https://example.com/meter10.jpg",
      readingDate: "2026-10-31",
    },
    // Room 102 - Electric
    {
      id: "11111111-1111-1111-1111-111111111112",
      roomId: ROOM_102_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "electric",
      previousReading: parseAmount("120.75"), // Continues from September
      currentReading: parseAmount("160.00"),
      photoUrl: "https://example.com/meter11.jpg",
      readingDate: "2026-10-31",
    },
    // Room 102 - Water
    {
      id: "12121212-1212-1212-1212-121212121212",
      roomId: ROOM_102_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "water",
      previousReading: parseAmount("18.20"), // Continues from September
      currentReading: parseAmount("22.10"),
      photoUrl: "https://example.com/meter12.jpg",
      readingDate: "2026-10-31",
    },
    // Room 103 - Electric (still unoccupied)
    {
      id: "13131313-1313-1313-1313-131313131313",
      roomId: ROOM_103_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "electric",
      previousReading: parseAmount("50.00"),
      currentReading: parseAmount("50.00"),
      photoUrl: "https://example.com/meter13.jpg",
      readingDate: "2026-10-31",
    },
    // Room 103 - Water (still unoccupied)
    {
      id: "14141414-1414-1414-1414-141414141414",
      roomId: ROOM_103_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "water",
      previousReading: parseAmount("10.00"),
      currentReading: parseAmount("10.00"),
      photoUrl: "https://example.com/meter14.jpg",
      readingDate: "2026-10-31",
    },
    // Room 104 - Electric (maintenance)
    {
      id: "15151515-1515-1515-1515-151515151515",
      roomId: ROOM_104_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "electric",
      previousReading: parseAmount("30.00"),
      currentReading: parseAmount("30.00"),
      photoUrl: "https://example.com/meter15.jpg",
      readingDate: "2026-10-31",
    },
    // Room 104 - Water (maintenance)
    {
      id: "16161616-1616-1616-1616-161616161616",
      roomId: ROOM_104_ID,
      billingPeriodId: BILLING_PERIOD_OCT_ID,
      type: "water",
      previousReading: parseAmount("5.00"),
      currentReading: parseAmount("5.00"),
      photoUrl: "https://example.com/meter16.jpg",
      readingDate: "2026-10-31",
    },
  ] satisfies (typeof meterReadings.$inferInsert)[];

  const allMeterReadings = [...septemberReadings, ...octoberReadings];
  const insertedMeterReadings = await db
    .insert(meterReadings)
    .values(allMeterReadings)
    .returning();

  console.log("✓ Created meter readings");

  // 10. Create invoices for September 2026 (one paid, one unpaid)
  const invoicesData = [
    {
      id: "17171717-1717-1717-1717-171717171717",
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      roomId: ROOM_101_ID,
      renterId: RENTER_1_ID,
      motelId: MOTEL_ID,
      rentAmount: parseAmount("2000000"),
      electricityUsage: parseAmount("50.50"), // 150.50 - 100.00
      electricityCost: parseAmount("151500"), // 50.50 * 3000
      waterUsage: parseAmount("5.30"), // 25.30 - 20.00
      waterCost: parseAmount("79500"), // 5.30 * 15000
      otherFees: JSON.parse(
        JSON.stringify([
          { name: "Internet", amount: parseAmount("100000") },
          { name: "Vệ sinh", amount: parseAmount("50000") },
        ])
      ),
      totalAmount: parseAmount("2231000"), // 2000000 + 151500 + 79500 + 100000 + 50000
      qrCodeData:
        "https://img.vietqr.io/image/004-123456789-qr_only.png?amount=2231000&addInfo=THANH+TOAN+TIEN+PHONG+THANG+9",
      paymentStatus: "paid",
      paidAt: new Date("2026-10-05T10:30:00Z"),
    },
    {
      id: "18181818-1818-1818-1818-181818181818",
      billingPeriodId: BILLING_PERIOD_SEP_ID,
      roomId: ROOM_102_ID,
      renterId: RENTER_2_ID,
      motelId: MOTEL_ID,
      rentAmount: parseAmount("1800000"),
      electricityUsage: parseAmount("40.75"), // 120.75 - 80.00
      electricityCost: parseAmount("122250"), // 40.75 * 3000
      waterUsage: parseAmount("3.20"), // 18.20 - 15.00
      waterCost: parseAmount("48000"), // 3.20 * 15000
      otherFees: JSON.parse(
        JSON.stringify([
          { name: "Internet", amount: parseAmount("100000") },
          { name: "Vệ sinh", amount: parseAmount("50000") },
        ])
      ),
      totalAmount: parseAmount("1970250"), // 1800000 + 122250 + 48000 + 100000 + 50000
      qrCodeData:
        "https://img.vietqr.io/image/004-123456789-qr_only.png?amount=1970250&addInfo=THANH+TOAN+TIEN+PHONG+THANG+9",
      paymentStatus: "unpaid",
    },
  ] satisfies (typeof invoices.$inferInsert)[];

  const insertedInvoices = await db
    .insert(invoices)
    .values(invoicesData)
    .returning();

  console.log("✓ Created invoices");

  // 11. Create help tickets
  const helpTicketsData = [
    {
      id: HELP_TICKET_1_ID,
      renterId: RENTER_1_ID,
      roomId: ROOM_101_ID,
      motelId: MOTEL_ID,
      category: "electricity",
      description: "Đèn trong phòng nhấp nháy, có thể do dây điện lỏng.",
      photoUrls: JSON.parse('["https://example.com/light1.jpg", "https://example.com/light2.jpg"]'),
      status: "open",
      managerNote: null,
    },
    {
      id: HELP_TICKET_2_ID,
      renterId: RENTER_2_ID,
      roomId: ROOM_102_ID,
      motelId: MOTEL_ID,
      category: "water",
      description: "Vòi nước trong bếp bị rò, chão luôn ướt.",
      photoUrls: JSON.parse('["https://example.com/faucet1.jpg"]'),
      status: "resolved",
      managerNote: "Đã thay vòi mới và kiểm tra hệ thống.",
      resolvedAt: new Date("2026-10-04T14:20:00Z"),
    },
  ] satisfies (typeof helpTickets.$inferInsert)[];

  const insertedHelpTickets = await db
    .insert(helpTickets)
    .values(helpTicketsData)
    .returning();

  console.log("✓ Created help tickets");

  // 12. Create Zalo notifications
  const zaloNotificationsData = [
    {
      id: ZALO_NOTIF_1_ID,
      renterId: RENTER_1_ID,
      motelId: MOTEL_ID,
      channel: "oa_message",
      templateId: null,
      payload: JSON.parse(
        JSON.stringify({
          message: "Hóa đơn điện nước tháng 9/2026 đã được gửi. Vui lòng kiểm tra và thanh toán trước ngày 5/10/2026."
        })
      ),
      status: "sent",
      failureReason: null,
      sentAt: new Date("2026-09-25T09:00:00Z"),
    },
    {
      id: ZALO_NOTIF_2_ID,
      renterId: RENTER_2_ID,
      motelId: MOTEL_ID,
      channel: "zns",
      templateId: "BILL_READY",
      payload: JSON.parse(
        JSON.stringify({
          amount: "1970250",
          month: "9",
          year: "2026",
          room: "P.102"
        })
      ),
      status: "failed",
      failureReason: "ZNS template not approved",
      sentAt: null,
    },
    {
      id: ZALO_NOTIF_3_ID,
      renterId: RENTER_3_ID,
      motelId: MOTEL_ID,
      channel: "oa_message",
      templateId: null,
      payload: JSON.parse(
        JSON.stringify({
          message: "Chào mừng bạn đến với KTX Nhà Trọ Việt! Vui lòng hoàn thiện hồ sơ thuê trọ."
        })
      ),
      status: "pending",
      failureReason: null,
      sentAt: null,
    },
  ] satisfies (typeof zaloNotifications.$inferInsert)[];

  const insertedZaloNotifications = await db
    .insert(zaloNotifications)
    .values(zaloNotificationsData)
    .returning();

  console.log("✓ Created Zalo notifications");

  console.log("\n🌱 Seed data completed successfully!");
  console.log("Summary:");
  console.log(`- Managers: 1`);
  console.log(`- Motels: 1`);
  console.log(`- Rooms: ${insertedRooms.length}`);
  console.log(`- Renters: ${insertedRenters.length}`);
  console.log(`- Contract Templates: 1`);
  console.log(`- Contracts: ${insertedContracts.length}`);
  console.log(`- Billing Periods: ${insertedBillingPeriods.length}`);
  console.log(`- Meter Readings: ${insertedMeterReadings.length}`);
  console.log(`- Invoices: ${insertedInvoices.length}`);
  console.log(`- Help Tickets: ${insertedHelpTickets.length}`);
  console.log(`- Zalo Notifications: ${insertedZaloNotifications.length}`);
}

// Run the seed function if this file is executed directly
if (import.meta.main) {
  seedData()
    .then(() => {
      console.log("\n✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Seeding failed:", error);
      process.exit(1);
    });
}

export default seedData;
