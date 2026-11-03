import { db } from "@/db";
import { contractTemplateCatalog } from "./contract-catalog.schema";
import type { ContractTemplateClause } from "./contract.schema";

export interface SeedCatalogItem {
  key: string;
  version: number;
  name: string;
  description: string;
  clauses: ContractTemplateClause[];
  active: boolean;
}

export const STARTER_TEMPLATES: SeedCatalogItem[] = [
  {
    key: "vn-residential-standard",
    version: 1,
    name: "Hợp đồng thuê nhà trọ tiêu chuẩn",
    description: "Mẫu hợp đồng thuê phòng trọ cơ bản theo tập quán và quy định dân sự Việt Nam.",
    active: false,
    clauses: [
      {
        title: "Điều 1: Tiền thuê và tiền đặt cọc",
        content:
          "Bên thuê thanh toán tiền thuê phòng đúng hạn hàng tháng. Tiền đặt cọc được hoàn trả khi kết thúc hợp đồng sau khi đã khấu trừ các chi phí hư hại hoặc nợ tồn đọng (nếu có).",
      },
      {
        title: "Điều 2: Thời hạn thuê phòng",
        content:
          "Thời hạn thuê được xác định cụ thể trong thỏa thuận thuê. Hết thời hạn, hai bên có thể thỏa thuận ký tiếp hoặc chấm dứt hợp đồng theo quy định.",
      },
      {
        title: "Điều 3: Bàn giao và bảo quản hiện trạng",
        content:
          "Bên cho thuê bàn giao phòng cùng trang thiết bị kèm theo trong tình trạng sử dụng tốt. Bên thuê có trách nhiệm bảo quản tài sản và hiện trạng phòng trong suốt thời gian thuê.",
      },
      {
        title: "Điều 4: Quyền và nghĩa vụ của các bên",
        content:
          "Bên cho thuê bảo đảm quyền sử dụng phòng ổn định cho Bên thuê. Bên thuê chấp hành nội quy nhà trọ, đăng ký tạm trú và thực hiện đầy đủ nghĩa vụ thanh toán.",
      },
      {
        title: "Điều 5: Chấm dứt hợp đồng và giải quyết tranh chấp",
        content:
          "Mọi vi phạm nghiêm trọng có thể dẫn đến chấm dứt hợp đồng trước hạn. Tranh chấp phát sinh trước hết được giải quyết qua thương lượng; nếu không thành sẽ đưa ra cơ quan có thẩm quyền.",
      },
    ],
  },
  {
    key: "vn-service-fees",
    version: 1,
    name: "Hợp đồng thuê kèm biểu phí dịch vụ",
    description:
      "Mẫu hợp đồng thuê phòng quy định chi tiết tiền phòng và biểu phí dịch vụ điện nước, rác, tiện ích.",
    active: false,
    clauses: [
      {
        title: "Điều 1: Tiền thuê, tiền cọc và biểu phí dịch vụ",
        content:
          "Tiền thuê cố định hàng tháng kèm các khoản phí dịch vụ gồm điện tiêu thụ theo công tơ, nước sinh hoạt, phí dịch vụ cố định và phí tiện ích phát sinh theo thông báo hàng kỳ.",
      },
      {
        title: "Điều 2: Thời hạn thuê và chu kỳ thanh toán",
        content:
          "Thời hạn thuê tính theo thỏa thuận. Tiền phòng và chi phí dịch vụ được đối soát, chốt chỉ số và thanh toán định kỳ vào đầu hoặc cuối mỗi chu kỳ tính tiền.",
      },
      {
        title: "Điều 3: Bàn giao tài sản và chỉ số ban đầu",
        content:
          "Hai bên xác nhận chỉ số đồng hồ điện, nước và danh mục trang thiết bị tại thời điểm nhận phòng làm căn cứ tính tiền và nghiệm thu khi bàn giao lại.",
      },
      {
        title: "Điều 4: Nghĩa vụ sử dụng dịch vụ và thanh toán",
        content:
          "Bên thuê sử dụng điện nước tiết kiệm, an toàn phòng cháy chữa cháy và thanh toán đúng hạn toàn bộ hóa đơn tiền phòng kèm phụ phí dịch vụ đã đối soát.",
      },
      {
        title: "Điều 5: Chấm dứt hợp đồng và quyết toán chi phí",
        content:
          "Khi chấm dứt hợp đồng, hai bên chốt chỉ số công tơ, đối soát toàn bộ tiền phòng và phụ phí dịch vụ chưa thanh toán trước khi hoàn trả tiền đặt cọc.",
      },
    ],
  },
  {
    key: "vn-flexible-term",
    version: 1,
    name: "Hợp đồng thuê linh hoạt thời hạn",
    description:
      "Mẫu hợp đồng thuê phòng linh hoạt thời hạn, quy định rõ cơ chế gia hạn và thời gian báo trước.",
    active: false,
    clauses: [
      {
        title: "Điều 1: Tiền thuê và thanh toán linh hoạt",
        content:
          "Bên thuê thanh toán tiền thuê theo chu kỳ ngắn hạn hoặc linh hoạt. Tiền đặt cọc bảo đảm nghĩa vụ hợp đồng và thông báo trả phòng đúng thời hạn thỏa thuận.",
      },
      {
        title: "Điều 2: Cơ chế gia hạn và thời hạn thuê",
        content:
          "Hợp đồng có hiệu lực theo thời gian đăng ký. Hết hạn, hợp đồng tự động gia hạn theo từng chu kỳ trừ khi một trong hai bên thông báo không tiếp tục thuê.",
      },
      {
        title: "Điều 3: Bàn giao hiện trạng và hoàn trả phòng",
        content:
          "Bên thuê nhận phòng theo biên bản hiện trạng và có nghĩa vụ hoàn trả phòng sạch sẽ, nguyên trạng các thiết bị đã bàn giao khi kết thúc hợp đồng.",
      },
      {
        title: "Điều 4: Nghĩa vụ thông báo trước khi chuyển đi",
        content:
          "Bên thuê có nhu cầu trả phòng trước hạn hoặc không gia hạn phải gửi thông báo trước tối thiểu số ngày quy định để làm thủ tục quyết toán cọc.",
      },
      {
        title: "Điều 5: Xử lý chấm dứt hợp đồng và bồi thường",
        content:
          "Trường hợp không báo trước hoặc vi phạm nội quy, bên vi phạm chịu trách nhiệm theo điều khoản phạt cọc đã thỏa thuận và giải quyết tranh chấp theo quy định.",
      },
    ],
  },
];

export async function seedContractTemplateCatalog(
  executor: Pick<typeof db, "insert"> = db,
): Promise<string[]> {
  const insertedKeys: string[] = [];
  for (const template of STARTER_TEMPLATES) {
    const [inserted] = await executor
      .insert(contractTemplateCatalog)
      .values({ ...template, active: true })
      .onConflictDoUpdate({
        target: [contractTemplateCatalog.key, contractTemplateCatalog.version],
        set: { active: true },
      })
      .returning({ key: contractTemplateCatalog.key });
    if (inserted) insertedKeys.push(inserted.key);
  }
  return insertedKeys;
}

export const seedContractCatalog = seedContractTemplateCatalog;

if (import.meta.main) {
  await seedContractCatalog();
  console.log("Contract catalog seeded successfully.");
  process.exit(0);
}
