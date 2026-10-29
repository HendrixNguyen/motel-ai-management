import { db } from "@/db";
import { contractTemplateCatalog, type ContractTemplateClause } from "@/modules/contract/contract.schema";

interface SeedCatalogTemplate { key: string; version: number; name: string; description: string; clauses: ContractTemplateClause[] }

const seededCatalogTemplates: SeedCatalogTemplate[] = [
  {
    key: "vn-residential-standard",
    version: 1,
    name: "Hợp đồng thuê phòng trọ tiêu chuẩn",
    description: "Mẫu tham khảo cho thuê chỗ ở theo tháng; cần điền thông tin và rà soát trước khi ký.",
    clauses: [
      { title: "Thông tin các bên", content: "Bên cho thuê: {{landlord_name}}, CCCD: {{landlord_id}}. Bên thuê: {{renter_name}}, CCCD: {{renter_id}}." },
      { title: "Tài sản thuê", content: "Bên cho thuê đồng ý cho thuê phòng {{room_name}} tại {{motel_address}} để sử dụng làm nơi ở." },
      { title: "Thời hạn thuê", content: "Thời hạn từ {{start_date}} đến {{end_date}}. Gia hạn hoặc chấm dứt theo thỏa thuận và pháp luật áp dụng." },
      { title: "Tiền thuê và thanh toán", content: "Tiền thuê là {{monthly_rent}} đồng/tháng, thanh toán vào ngày {{payment_due_day}} hàng tháng." },
      { title: "Tiền đặt cọc", content: "Tiền đặt cọc là {{deposit_amount}} đồng; việc khấu trừ và hoàn trả thực hiện theo thỏa thuận và quy định pháp luật." },
      { title: "Điện, nước và dịch vụ", content: "Điện, nước và dịch vụ được đối soát theo mức sử dụng thực tế, bảng giá đã thông báo và thỏa thuận của các bên." },
      { title: "Sử dụng và bảo quản", content: "Bên thuê sử dụng tài sản đúng mục đích, giữ gìn tài sản và tuân thủ nội quy, quy định an toàn áp dụng." },
      { title: "Bàn giao và tranh chấp", content: "Khi kết thúc thuê, các bên đối soát nghĩa vụ và bàn giao phòng; tranh chấp ưu tiên thương lượng, sau đó giải quyết theo pháp luật Việt Nam." },
    ],
  },
  {
    key: "vn-flexible-term",
    version: 1,
    name: "Hợp đồng thuê phòng linh hoạt",
    description: "Mẫu tham khảo với kỳ thuê linh hoạt và thỏa thuận thông báo trước.",
    clauses: [
      { title: "Các bên và phòng thuê", content: "Bên cho thuê {{landlord_name}}, bên thuê {{renter_name}} thống nhất thuê phòng {{room_name}} tại {{motel_address}}." },
      { title: "Thời hạn và gia hạn", content: "Thời hạn bắt đầu ngày {{start_date}}. Việc tiếp tục thuê được hai bên xác nhận trước kỳ tiếp theo." },
      { title: "Thông báo chấm dứt", content: "Bên có nhu cầu chấm dứt thuê thông báo trước {{notice_days}} ngày, trừ trường hợp có thỏa thuận khác phù hợp pháp luật." },
      { title: "Tiền thuê và đặt cọc", content: "Tiền thuê mỗi kỳ là {{monthly_rent}} đồng; tiền đặt cọc là {{deposit_amount}} đồng. Các bên đối soát khi kết thúc thuê." },
      { title: "Chi phí sử dụng", content: "Điện, nước và dịch vụ được tính theo mức sử dụng thực tế và bảng giá/thỏa thuận đã được cung cấp." },
      { title: "Bàn giao và tranh chấp", content: "Các bên lập đối soát khi bàn giao phòng; tranh chấp ưu tiên thương lượng, sau đó giải quyết theo pháp luật Việt Nam." },
    ],
  },
  {
    key: "vn-service-fees",
    version: 1,
    name: "Hợp đồng thuê và bảng kê dịch vụ",
    description: "Mẫu tham khảo tách tiền thuê khỏi các khoản dịch vụ có thể áp dụng.",
    clauses: [
      { title: "Thông tin các bên và phòng", content: "Bên cho thuê {{landlord_name}}, bên thuê {{renter_name}} thống nhất thuê phòng {{room_name}} tại {{motel_address}}." },
      { title: "Thời hạn thuê", content: "Thời hạn thuê từ {{start_date}} đến {{end_date}}; lịch bàn giao do hai bên xác nhận." },
      { title: "Tiền thuê", content: "Tiền thuê phòng là {{monthly_rent}} đồng mỗi tháng, hạn thanh toán ngày {{payment_due_day}}." },
      { title: "Bảng kê dịch vụ", content: "Điện: {{electricity_rate}} đồng/kWh theo chỉ số; nước: {{water_rate}} đồng/m³; dịch vụ khác: {{service_fee_details}} theo thỏa thuận." },
      { title: "Đặt cọc và đối soát", content: "Tiền đặt cọc là {{deposit_amount}} đồng. Khi kết thúc thuê, hai bên đối soát tiền thuê, dịch vụ và tài sản trước khi hoàn cọc." },
      { title: "Trách nhiệm và tranh chấp", content: "Các bên giữ gìn tài sản, tuân thủ nội quy và giải quyết bất đồng trước hết bằng thương lượng; tranh chấp còn lại xử lý theo pháp luật Việt Nam." },
    ],
  },
] as const;

export async function seedContractTemplateCatalog(executor: Pick<import("@/db").Db, "insert"> = db) {
  const insertedKeys: string[] = [];
  for (const template of seededCatalogTemplates) {
    const [inserted] = await executor.insert(contractTemplateCatalog).values(template).onConflictDoNothing({ target: [contractTemplateCatalog.key, contractTemplateCatalog.version] }).returning({ key: contractTemplateCatalog.key });
    if (inserted) insertedKeys.push(inserted.key);
  }
  return insertedKeys;
}
