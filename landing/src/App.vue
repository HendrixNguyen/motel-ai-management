<script setup lang="ts">
import { nextTick, ref } from "vue";
import { calculateBill, sample, validateReadings, type Bill, type Readings } from "./billing";
import { isValidFormspreeEndpoint, submitContact } from "./contact";

const step = ref<"readings" | "invoice" | "paid">("readings");
const electricity = ref(String(sample.electricity.current));
const water = ref(String(sample.water.current));
const error = ref("");
const stepHeading = ref<HTMLElement | null>(null);
const bill = ref<Bill>(
  calculateBill({
    electricity: sample.electricity.current,
    water: sample.water.current,
  }),
);
const formatMoney = (amount: number) => `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
const formspreeEndpoint = import.meta.env.VITE_FORMSPREE_ENDPOINT ?? "";
const formspreeReady = isValidFormspreeEndpoint(formspreeEndpoint);
const contactForm = ref<HTMLFormElement | null>(null);
const contactStatus = ref<"idle" | "sending" | "success" | "error">("idle");

async function submitContactForm() {
  if (!formspreeReady || !contactForm.value) return;

  contactStatus.value = "sending";
  try {
    await submitContact(formspreeEndpoint, new FormData(contactForm.value));
    contactForm.value.reset();
    contactStatus.value = "success";
  } catch {
    contactStatus.value = "error";
  }
}

async function moveTo(nextStep: "invoice" | "paid") {
  if (nextStep === "invoice") {
    try {
      const readings: Readings = validateReadings(electricity.value, water.value);
      bill.value = calculateBill(readings);
      error.value = "";
      step.value = "invoice";
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Kiểm tra lại chỉ số.";
      await nextTick();
      const electricityIsValid =
        electricity.value.trim() !== "" &&
        Number.isSafeInteger(Number(electricity.value)) &&
        Number(electricity.value) >= sample.electricity.previous;
      document
        .querySelector<HTMLInputElement>(electricityIsValid ? "#water" : "#electricity")
        ?.focus();
      return;
    }
  } else {
    step.value = "paid";
  }
  await nextTick();
  stepHeading.value?.focus();
}

function editReadings() {
  step.value = "readings";
  error.value = "";
}

function resetDemo() {
  electricity.value = String(sample.electricity.current);
  water.value = String(sample.water.current);
  error.value = "";
  step.value = "readings";
}
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Bỏ qua điều hướng</a>
    <header class="topbar wrap">
      <a class="brand" href="#top" aria-label="Nhà Số Gọn - về đầu trang">
        <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M5 30 32 6l27 24v29H5z" />
          <path class="mark-house" d="m32 19 15 13v20H17V32z" />
          <path class="mark-signal" d="M3 18h5v41H3zm9-8h5v49h-5zm9-7h5v56h-5z" />
        </svg>
        <span>Nhà Số <strong>Gọn</strong></span>
      </a>
      <nav class="nav-links" aria-label="Điều hướng chính">
        <a href="#tinh-nang">Tính năng</a>
        <a href="#cach-hoat-dong">Cách hoạt động</a>
        <a href="#cau-hoi">Câu hỏi</a>
        <a href="#lien-he">Liên hệ</a>
      </nav>
      <a class="button button-small" href="#demo">Xem demo <span aria-hidden="true">↗</span></a>
    </header>

    <main id="main">
      <section id="top" class="hero wrap">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-mark"></span> PHẦN MỀM QUẢN LÝ NHÀ TRỌ</p>
          <h1>Quản lý phòng trọ,<br /><span>rõ từng khoản thu.</span></h1>
          <p class="hero-lede">
            Theo dõi phòng, ghi điện nước và lập hóa đơn chi tiết trong một nơi. Khách thuê xem
            khoản cần trả qua liên kết riêng.
          </p>
          <div class="hero-actions">
            <a class="button" href="#demo">Xem demo <span aria-hidden="true">↗</span></a>
            <a class="text-link" href="#tinh-nang"
              >Khám phá tính năng <span aria-hidden="true">↓</span></a
            >
          </div>
          <div class="hero-note">
            <span class="mini-check" aria-hidden="true">✓</span> Không cần cài thêm ứng dụng cho
            khách thuê
          </div>
        </div>

        <div class="overview-card" aria-label="Bảng tổng quan mẫu của khu trọ An Nhiên">
          <div class="overview-head">
            <div class="overview-name">
              <span class="house-icon" aria-hidden="true"
                ><svg viewBox="0 0 24 24">
                  <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></svg
              ></span>
              <div><strong>Khu trọ An Nhiên</strong><small>Kỳ thu · Tháng 10, 2026</small></div>
            </div>
            <button class="dots-button" type="button" aria-label="Tùy chọn bảng tổng quan">
              •••
            </button>
          </div>
          <div class="overview-metrics">
            <div>
              <span>Phòng đang thuê</span><strong>18 <small>/ 20</small></strong
              ><i><b style="width: 90%"></b></i>
            </div>
            <div>
              <span>Đã ghi chỉ số</span><strong>14 <small>/ 18</small></strong
              ><i><b style="width: 78%"></b></i>
            </div>
          </div>
          <div class="room-list-head"><span>Phòng trong kỳ</span><span>Trạng thái</span></div>
          <div class="room-row">
            <span class="room-code">A101</span><span class="room-renter">Nguyễn Minh Anh</span
            ><span class="status status-ready"><i></i>Đã có hóa đơn</span>
          </div>
          <div class="room-row room-selected">
            <span class="room-code">A102</span><span class="room-renter">Trần Gia Hân</span
            ><span class="status status-reading"><i></i>Chờ ghi số</span>
          </div>
          <div class="room-row">
            <span class="room-code">A103</span><span class="room-renter">Phạm Hoàng Long</span
            ><span class="status status-paid"><i></i>Đã thanh toán</span>
          </div>
          <div class="overview-foot">
            <span class="sample-label"><i></i>Dữ liệu minh họa</span
            ><span>Xem kỳ thu <b aria-hidden="true">→</b></span>
          </div>
          <div class="floating-receipt" aria-hidden="true">
            <span class="receipt-check">✓</span
            ><span><strong>Hóa đơn đã sẵn sàng</strong><small>Phòng A101 · 3.125.000đ</small></span
            ><span class="receipt-arrow">↗</span>
          </div>
        </div>
        <div class="hero-orbit orbit-one"></div>
        <div class="hero-orbit orbit-two"></div>
      </section>

      <section class="trust-strip wrap" aria-label="Điểm nổi bật">
        <span>Ít thao tác lặp</span><i></i><span>Khoản thu rõ ràng</span><i></i
        ><span>Khách thuê dễ theo dõi</span>
      </section>

      <section id="tinh-nang" class="features-section">
        <div class="wrap">
          <div class="section-heading">
            <p class="eyebrow">MỌI VIỆC THU TIỀN, CÙNG MỘT NƠI</p>
            <h2>Tháng nào cũng rõ ràng,<br /><span>từ phòng đến hóa đơn.</span></h2>
            <p class="section-lede">
              Bớt dò sổ, bớt nhập lại. Nắm tình hình từng phòng và biết khoản nào cần xử lý tiếp.
            </p>
          </div>
          <div class="feature-grid">
            <article class="feature-card feature-room">
              <div class="feature-icon teal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16M3 10h18M9 3v18m6-18v18M1 21h22"
                  />
                </svg>
              </div>
              <h3>Biết phòng nào đang thế nào</h3>
              <p>Theo dõi phòng trống, đang thuê và thông tin khách trong một danh sách gọn.</p>
              <div class="mini-room-board" aria-hidden="true">
                <div><span>A101</span><b>Đang thuê</b></div>
                <div class="mini-room-active"><span>A102</span><b>Đến kỳ thu</b></div>
                <div><span>A103</span><b>Đã thanh toán</b></div>
              </div>
            </article>
            <article class="feature-card feature-bill">
              <div class="feature-icon gold-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Zm2 5h8m-8 4h8m-8 4h4"
                  />
                </svg>
              </div>
              <h3>Thấy rõ cách tính mỗi khoản</h3>
              <p>Chỉ số cũ, chỉ số mới và đơn giá hiện ngay trên hóa đơn để khách dễ đối chiếu.</p>
              <div class="mini-bill" aria-hidden="true">
                <span>Tiền phòng</span><b>2.500.000đ</b><span>Điện · 70 kWh</span><b>245.000đ</b
                ><span>Nước · 5 m³</span><b>75.000đ</b>
                <hr />
                <strong>Tổng cộng</strong><strong>2.820.000đ</strong>
              </div>
            </article>
            <article class="feature-card feature-qr">
              <div class="feature-icon blue-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zm4 0h2v6h-2zm-4 4h2v2h-2z"
                  />
                </svg>
              </div>
              <h3>Chuyển khoản, chủ nhà xác nhận</h3>
              <p>
                Khách quét VietQR theo thông tin tài khoản nhà trọ. Chủ nhà kiểm tra rồi cập nhật
                thanh toán.
              </p>
              <div class="transfer-row" aria-hidden="true">
                <span class="bank-mark">QR</span
                ><span
                  ><strong>Chuyển khoản ngân hàng</strong
                  ><small>Đang chờ chủ nhà xác nhận</small></span
                ><span class="transfer-state">Chờ xác nhận</span>
              </div>
            </article>
            <article class="feature-card feature-tenant">
              <div class="feature-icon dark-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0m-4-9 2 2 4-4" />
                </svg>
              </div>
              <h3>Khách xem hóa đơn bằng liên kết</h3>
              <p>
                Gửi liên kết riêng để khách thuê xem hóa đơn và khoản cần thanh toán trên điện
                thoại.
              </p>
              <div class="tenant-preview" aria-hidden="true">
                <span class="link-symbol">↗</span
                ><span
                  ><small>Liên kết riêng cho khách thuê</small
                  ><strong>Hóa đơn tháng 10</strong></span
                ><b>2.820.000đ</b>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="cach-hoat-dong" class="process-section wrap">
        <div class="process-intro">
          <p class="eyebrow">MỘT KỲ THU, BA BƯỚC RÕ RÀNG</p>
          <h2>Từ chỉ số<br />đến khoản thu.</h2>
          <p>Quy trình tháng vẫn quen thuộc. Những con số chỉ cần ghi một lần.</p>
          <a class="text-link" href="#demo">Thử với phòng mẫu <span aria-hidden="true">↓</span></a>
        </div>
        <div class="process-list">
          <article class="process-item">
            <div class="process-number">01</div>
            <div>
              <h3>Ghi chỉ số tại phòng</h3>
              <p>Nhập điện, nước theo từng phòng trong kỳ thu.</p>
            </div>
            <span class="process-icon" aria-hidden="true"
              ><svg viewBox="0 0 24 24"><path d="M4 20h16M6 16l9-9 3 3-9 9H6zm8-8 3 3" /></svg
            ></span>
          </article>
          <article class="process-item">
            <div class="process-number">02</div>
            <div>
              <h3>Hóa đơn hiện từng phép tính</h3>
              <p>Tiền phòng, điện nước và tổng tiền được tách rõ.</p>
            </div>
            <span class="process-icon" aria-hidden="true"
              ><svg viewBox="0 0 24 24">
                <path d="M6 3h12v18l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2zm2 5h8m-8 4h8m-8 4h5" /></svg
            ></span>
          </article>
          <article class="process-item">
            <div class="process-number">03</div>
            <div>
              <h3>Khách chuyển khoản, chủ nhà duyệt</h3>
              <p>Khách dùng VietQR; chủ nhà xác nhận sau khi kiểm tra.</p>
            </div>
            <span class="process-icon" aria-hidden="true"
              ><svg viewBox="0 0 24 24">
                <path
                  d="M3 7h18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 9 2 2 5-5"
                /></svg
            ></span>
          </article>
        </div>
      </section>

      <section class="tenant-section">
        <div class="wrap tenant-layout">
          <div class="tenant-copy">
            <p class="eyebrow">DÀNH CHO CẢ NGƯỜI THUÊ</p>
            <h2>Khách biết mình<br /><span>đang trả khoản nào.</span></h2>
            <p>
              Gửi liên kết riêng để khách xem hóa đơn, đối chiếu từng khoản và theo dõi hợp đồng
              ngay trên điện thoại.
            </p>
            <ul>
              <li><span>✓</span> Không cần cài ứng dụng</li>
              <li><span>✓</span> Không phải tạo mật khẩu</li>
              <li><span>✓</span> Thấy rõ chỉ số và cách tính</li>
            </ul>
          </div>
          <div class="phone-frame" aria-label="Minh họa cổng hóa đơn dành cho khách thuê">
            <div class="phone-notch"></div>
            <div class="phone-content">
              <div class="phone-brand">
                <svg class="brand-mark phone-brand-mark" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M5 30 32 6l27 24v29H5z" />
                  <path class="mark-house" d="m32 19 15 13v20H17V32z" />
                  <path class="mark-signal" d="M3 18h5v41H3zm9-8h5v49h-5zm9-7h5v56h-5z" /></svg
                ><span>Nhà Số Gọn</span><span class="phone-menu">•••</span>
              </div>
              <p class="phone-greeting">Xin chào, Gia Hân</p>
              <div class="phone-room">PHÒNG A102 <span>THÁNG 10</span></div>
              <div class="phone-amount">
                <small>Tổng tiền cần thanh toán</small><strong>2.820.000<span>đ</span></strong
                ><i>Chờ thanh toán</i>
              </div>
              <div class="phone-line"><span>Tiền phòng</span><b>2.500.000đ</b></div>
              <div class="phone-line">
                <span>Điện <small>70 kWh × 3.500đ</small></span
                ><b>245.000đ</b>
              </div>
              <div class="phone-line">
                <span>Nước <small>5 m³ × 15.000đ</small></span
                ><b>75.000đ</b>
              </div>
              <button type="button" class="phone-pay" disabled>Thanh toán qua VietQR</button
              ><small class="phone-demo">Màn hình minh họa</small>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" class="demo-section wrap">
        <div class="demo-heading">
          <p class="eyebrow">THỬ BẰNG SỐ LIỆU MẪU</p>
          <h2>Một lần ghi số,<br /><span>hóa đơn ra sao?</span></h2>
          <p>Sửa chỉ số phòng A102 để xem từng khoản được tính như thế nào.</p>
        </div>
        <div class="demo-card">
          <div class="demo-card-top">
            <div>
              <span class="demo-room-tag">PHÒNG A102</span>
              <h3>Kỳ thu tháng 10</h3>
            </div>
            <span class="sample-label"><i></i>Dữ liệu minh họa</span>
          </div>
          <div class="demo-steps" aria-label="Các bước demo">
            <span :class="{ active: step === 'readings' }"><b>1</b> Ghi chỉ số</span><i></i
            ><span :class="{ active: step === 'invoice' }"><b>2</b> Xem hóa đơn</span><i></i
            ><span :class="{ active: step === 'paid' }"><b>3</b> Xác nhận</span>
          </div>
          <section v-if="step === 'readings'" class="demo-panel" aria-labelledby="readings-heading">
            <h4 id="readings-heading" ref="stepHeading" tabindex="-1">Nhập chỉ số mới</h4>
            <p class="panel-help">Chỉ số cũ đã có sẵn để bạn đối chiếu.</p>
            <div class="reading-grid">
              <label for="electricity"
                ><span>Điện <small>kWh</small></span
                ><span class="reading-input"
                  ><input
                    id="electricity"
                    v-model="electricity"
                    type="number"
                    inputmode="numeric"
                    step="1"
                    min="1240"
                    :aria-describedby="error ? 'demo-error' : 'electricity-help'"
                    :aria-invalid="Boolean(error)"
                  /><span>kWh</span></span
                ><small id="electricity-help">Kỳ trước: 1.240</small></label
              ><label for="water"
                ><span>Nước <small>m³</small></span
                ><span class="reading-input"
                  ><input
                    id="water"
                    v-model="water"
                    type="number"
                    inputmode="numeric"
                    step="1"
                    min="80"
                    :aria-describedby="error ? 'demo-error' : 'water-help'"
                    :aria-invalid="Boolean(error)"
                  /><span>m³</span></span
                ><small id="water-help">Kỳ trước: 80</small></label
              >
            </div>
            <p v-if="error" id="demo-error" class="form-error" role="alert">{{ error }}</p>
            <p class="rate-note">Đơn giá minh họa: điện 3.500đ/kWh · nước 15.000đ/m³.</p>
            <button type="button" class="button demo-next" @click="moveTo('invoice')">
              Xem hóa đơn <span aria-hidden="true">→</span>
            </button>
          </section>
          <section
            v-else-if="step === 'invoice'"
            class="demo-panel"
            aria-labelledby="invoice-heading"
          >
            <div class="panel-title-row">
              <div>
                <h4 id="invoice-heading" ref="stepHeading" tabindex="-1">Hóa đơn phòng A102</h4>
                <p class="panel-help">Khoản thu và cách tính trong kỳ.</p>
              </div>
              <button type="button" class="quiet-button" @click="editReadings">Sửa chỉ số</button>
            </div>
            <div class="invoice-lines">
              <div class="invoice-line">
                <span>Tiền phòng</span><strong>{{ formatMoney(bill.rent) }}</strong>
              </div>
              <div class="invoice-line">
                <span
                  >Điện
                  <small
                    >{{ bill.electricity.used }} kWh ×
                    {{ formatMoney(bill.electricity.rate) }}</small
                  ></span
                ><strong>{{ formatMoney(bill.electricity.amount) }}</strong>
              </div>
              <div class="invoice-line">
                <span
                  >Nước
                  <small>{{ bill.water.used }} m³ × {{ formatMoney(bill.water.rate) }}</small></span
                ><strong>{{ formatMoney(bill.water.amount) }}</strong>
              </div>
              <div class="invoice-total">
                <span>Tổng cộng</span><strong>{{ formatMoney(bill.total) }}</strong>
              </div>
            </div>
            <p class="rate-note">
              VietQR là chuyển khoản ngân hàng; chủ nhà kiểm tra và xác nhận tiền đã về.
            </p>
            <button type="button" class="button demo-next" @click="moveTo('paid')">
              Xác nhận minh họa <span aria-hidden="true">→</span>
            </button>
          </section>
          <section v-else class="demo-panel paid-panel" aria-labelledby="paid-heading">
            <div class="paid-icon" aria-hidden="true">✓</div>
            <h4 id="paid-heading" ref="stepHeading" tabindex="-1">Đã thanh toán</h4>
            <p class="panel-help">
              Đây chỉ là trạng thái minh họa. Demo không chuyển tiền hay tạo giao dịch thật.
            </p>
            <div class="paid-receipt">
              <span>Phòng A102 · Tháng 10</span><strong>{{ formatMoney(bill.total) }}</strong>
            </div>
            <button type="button" class="quiet-button reset-button" @click="resetDemo">
              Làm lại demo
            </button>
          </section>
          <p class="demo-privacy">Demo không gửi hay lưu dữ liệu bạn nhập.</p>
        </div>
      </section>

      <section id="cau-hoi" class="faq-section wrap">
        <div class="faq-intro">
          <p class="eyebrow">CÂU HỎI THƯỜNG GẶP</p>
          <h2>Rõ ràng<br />trước khi bắt đầu.</h2>
        </div>
        <div class="faq-list">
          <details>
            <summary>Nhà Số Gọn phù hợp với ai?<span aria-hidden="true"></span></summary>
            <p>
              Dành cho chủ nhà trọ cần theo dõi phòng, khách thuê, ghi điện nước và thu tiền theo
              kỳ. Nhóm sử dụng mục tiêu thường quản lý khoảng 10–40 phòng.
            </p>
          </details>
          <details>
            <summary>
              Khách thuê có cần tạo tài khoản không?<span aria-hidden="true"></span>
            </summary>
            <p>Khách xem hóa đơn qua liên kết riêng; không cần cài ứng dụng hay tạo mật khẩu.</p>
          </details>
          <details>
            <summary>
              Chuyển khoản có tự động xác nhận không?<span aria-hidden="true"></span>
            </summary>
            <p>
              Không. Khách chuyển khoản qua VietQR; chủ nhà kiểm tra giao dịch rồi xác nhận trong hệ
              thống.
            </p>
          </details>
          <details>
            <summary>Demo có lưu chỉ số tôi nhập không?<span aria-hidden="true"></span></summary>
            <p>
              Không. Demo chỉ tính trên trình duyệt; dữ liệu không gửi đi và sẽ trở về mặc định khi
              tải lại trang.
            </p>
          </details>
        </div>
      </section>

      <section id="lien-he" class="contact-section wrap">
        <div class="contact-copy">
          <p class="eyebrow">LIÊN HỆ VỚI NHÀ SỐ GỌN</p>
          <h2>Bạn có góp ý<br /><span>hoặc câu hỏi?</span></h2>
          <p>
            Gửi câu hỏi về sản phẩm, chia sẻ trải nghiệm vận hành nhà trọ hoặc đề xuất tính năng.
            Mọi góp ý đều giúp sản phẩm sát nhu cầu thực tế hơn.
          </p>
        </div>
        <div class="contact-card">
          <form ref="contactForm" class="contact-form" @submit.prevent="submitContactForm">
            <label for="contact-name">Tên của bạn</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autocomplete="name"
              maxlength="100"
              required
            />
            <label for="contact-email">Email để phản hồi</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autocomplete="email"
              maxlength="254"
              required
            />
            <label for="contact-topic">Bạn muốn trao đổi về</label>
            <select id="contact-topic" name="topic" required>
              <option value="" disabled selected>Chọn chủ đề</option>
              <option value="Câu hỏi">Câu hỏi</option>
              <option value="Góp ý">Góp ý</option>
              <option value="Đề xuất tính năng">Đề xuất tính năng</option>
            </select>
            <label for="contact-message">Nội dung</label>
            <textarea
              id="contact-message"
              name="message"
              rows="4"
              maxlength="2000"
              required
            ></textarea>
            <input
              class="contact-honeypot"
              type="text"
              name="_gotcha"
              tabindex="-1"
              autocomplete="off"
              aria-hidden="true"
            />
            <button
              class="button contact-button"
              type="submit"
              :disabled="!formspreeReady || contactStatus === 'sending'"
            >
              {{ contactStatus === "sending" ? "Đang gửi…" : "Gửi liên hệ" }}
              <span aria-hidden="true">↗</span>
            </button>
            <p v-if="!formspreeReady" class="contact-notice" role="status">
              Form chưa được kết nối. Bạn vẫn có thể gửi email trực tiếp tới
              <a href="mailto:hn112000@gmail.com">hn112000@gmail.com</a>.
            </p>
            <p v-else-if="contactStatus === 'success'" class="contact-success" role="status">
              Đã gửi thành công. Cảm ơn bạn đã liên hệ.
            </p>
            <p v-else-if="contactStatus === 'error'" class="contact-error" role="alert">
              Chưa gửi được. Kiểm tra kết nối rồi thử lại, hoặc gửi email tới
              <a href="mailto:hn112000@gmail.com">hn112000@gmail.com</a>.
            </p>
            <p class="contact-privacy">
              Thông tin được gửi qua Formspree để chuyển tới email liên hệ.
            </p>
          </form>
        </div>
      </section>

      <section class="closing-section wrap">
        <div class="closing-card">
          <div class="closing-mark">
            <svg class="brand-mark closing-logo" viewBox="0 0 64 64" aria-hidden="true">
              <path d="M5 30 32 6l27 24v29H5z" />
              <path class="mark-house" d="m32 19 15 13v20H17V32z" />
              <path class="mark-signal" d="M3 18h5v41H3zm9-8h5v49h-5zm9-7h5v56h-5z" />
            </svg>
          </div>
          <div>
            <p class="eyebrow">NHÀ SỐ GỌN</p>
            <h2>Quản lý nhà trọ<br /><span>gọn hơn mỗi ngày.</span></h2>
          </div>
          <a class="button button-light" href="#demo">Xem demo <span aria-hidden="true">↗</span></a>
          <div class="closing-grid" aria-hidden="true"></div>
        </div>
      </section>
    </main>

    <footer class="footer wrap">
      <a class="brand footer-brand" href="#top"
        ><svg class="brand-mark footer-logo" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M5 30 32 6l27 24v29H5z" />
          <path class="mark-house" d="m32 19 15 13v20H17V32z" />
          <path class="mark-signal" d="M3 18h5v41H3zm9-8h5v49h-5zm9-7h5v56h-5z" /></svg
        ><span>Nhà Số <strong>Gọn</strong></span></a
      >
      <p>Quản lý nhà trọ gọn hơn mỗi ngày.</p>
      <a href="#top" class="back-top">Lên đầu trang ↑</a><small>© 2026 Nhà Số Gọn</small>
    </footer>
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ step === "paid" ? "Đã xác nhận trạng thái thanh toán minh họa." : "" }}
    </div>
  </div>
</template>
