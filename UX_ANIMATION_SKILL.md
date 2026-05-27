---
name: ux-animation-design-pro
description: Guidelines on premium UI/UX design, modern CSS styling, glassmorphism, responsive grids, Outfit/Noto fonts, dynamic HSL color palettes, performance-optimized animations, and fluid transitions. Use when coding layouts, popup cards, button hovers, scroll progress overlays, active/inactive states, or when styling Chrome Extension pages to look state-of-the-art.
---

# UI/UX & Motion Design Guidelines

Tài liệu này cung cấp bộ quy chuẩn về thiết kế giao diện (UI), trải nghiệm người dùng (UX), cách phối màu (Color Theory), phân cấp chữ (Typography) và hoạt ảnh động (CSS Animations) dành cho các sản phẩm web và Chrome Extension cao cấp.

---

## 1. Hệ màu sắc hiện đại (HSL Color System)

Tránh sử dụng các mã màu mặc định hoặc màu cơ bản (như đỏ, xanh, vàng thuần túy). Nên sử dụng hệ màu HSL (Hue, Saturation, Lightness) để dễ dàng tạo ra các sắc độ chuyển màu hài hòa và lập trình tự động (như hover state, active state).

### 1.1 Bảng màu Premium Dark Mode (Mặc định)
* **Background chính (Body/Surface)**: `hsl(230, 20%, 8%)` (Xám đen ánh xanh dịu mắt, độ tương phản cao với chữ trắng nhưng không bị mỏi mắt).
* **Card/Container (Glassmorphism)**: `hsla(230, 20%, 15%, 0.6)` kết hợp với viền `border: 1px solid hsla(0, 0%, 100%, 0.08)`.
* **Màu chính (Primary Accent)**: `hsl(255, 85%, 65%)` (Màu tím neon huyền ảo) hoặc `hsl(210, 100%, 55%)` (Màu xanh dương sâu thẳm).
* **Màu phụ (Secondary Accent)**: `hsl(280, 80%, 60%)` (Màu hồng tím cá tính).
* **Màu thành công (Success State)**: `hsl(145, 80%, 45%)` (Màu xanh lá emerald sáng).
* **Màu cảnh báo (Warning State)**: `hsl(35, 90%, 55%)` (Màu cam ấm).
* **Màu lỗi (Error/Danger State)**: `hsl(0, 85%, 60%)` (Màu đỏ san hô).

### 1.2 Contrast & Accessibility (Độ tương phản)
* Luôn đảm bảo độ tương phản giữa chữ và nền đạt chuẩn **WCAG 2.1 AA** (tối thiểu là 4.5:1 đối với văn bản thông thường và 3:1 đối với chữ lớn).
* Chữ hiển thị trên nền tối: Nên dùng màu `hsl(230, 10%, 90%)` thay vì màu trắng tinh `#fff` để giảm hiện tượng nhòe chữ (halo effect).

---

## 2. Phân cấp chữ & Phông chữ (Typography)

* **Phông chữ khuyên dùng**: `Outfit` hoặc `Inter` cho giao diện hiện đại và các nút bấm; kết hợp với `Noto Sans JP`/`Noto Serif JP` cho nội dung truyện tranh.
* **Hierarchy (Cấp bậc)**:
  * **H1 (Tiêu đề lớn/Heading)**: `font-size: 1.5rem` (24px), `font-weight: 700`, `line-height: 1.2`, `letter-spacing: -0.02em`.
  * **H2 (Phân mục)**: `font-size: 1.2rem` (19.2px), `font-weight: 600`.
  * **Body text (Nội dung)**: `font-size: 0.9rem` (14.4px) hoặc `1rem` (16px), `font-weight: 400`, `line-height: 1.5`.
  * **Small text (Ghi chú/Thời gian)**: `font-size: 0.75rem` (12px), `color: hsla(0, 0%, 100%, 0.6)`.

---

## 3. Hoạt ảnh động hiệu năng cao (CSS Motion & Transitions)

Các chuyển động hoạt ảnh phải mượt mà, tự nhiên và có mục đích định hướng cho người dùng. Tránh các hiệu ứng lòe loẹt làm chậm hệ thống.

### 3.1 Quy tắc Tối ưu hiệu năng
* **Chỉ chuyển đổi `transform` và `opacity`**: Tránh việc dùng transition cho các thuộc tính kích thước như `width`, `height`, `margin`, `top`, `left` vì chúng bắt trình duyệt phải tính toán lại bố cục toàn trang (layout thrash), gây giật lag.
* **Sử dụng `will-change` hợp lý**: Đối với các phần tử chuyển động liên tục, thêm thuộc tính `will-change: transform, opacity;` để ép trình duyệt tối ưu phần cứng (GPU acceleration).

### 3.2 Đường cong chuyển động (Easing Functions)
* **Smooth Enter (Xuất hiện)**: Sử dụng đường cong cubic-bezier dốc ở đầu và thoai thoải ở cuối: `transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);`.
* **Smooth Exit (Biến mất)**: Thường nhanh hơn và dốc dần về cuối: `transition: all 150ms cubic-bezier(0.7, 0, 0.84, 0);`.
* **Hover transition (Di chuột)**: Chuyển động nhẹ nhàng cho các nút bấm: `transition: background 200ms ease, transform 150ms ease-out;`.

### 3.3 Ví dụ hiệu ứng micro-animations thường dùng:
* **Nút bấm co giãn khi di chuột**:
  ```css
  .btn-premium {
    transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease;
  }
  .btn-premium:hover {
    transform: translateY(-1px) scale(1.02);
  }
  .btn-premium:active {
    transform: translateY(0) scale(0.98);
  }
  ```
* **Màn hình Glassmorphic Loading Progress (Thanh tiến trình)**:
  ```css
  .progress-bar-fill {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, hsl(255, 85%, 65%), hsl(280, 80%, 60%));
    border-radius: 4px;
    box-shadow: 0 0 10px hsla(255, 85%, 65%, 0.5);
    transition: width 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  ```

---

## 4. Bố cục thích ứng (Responsive & Glassmorphic Layouts)

* **CSS Grid / Flexbox**: Sử dụng flexbox cho các hàng điều hướng và grid cho danh sách kết quả để tránh vỡ khung.
* **Glassmorphic Glass Container**:
  ```css
  .glass-panel {
    background: rgba(23, 25, 35, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  ```
* **Scrollbar Premium**: Thiết kế thanh cuộn mảnh để đồng bộ với giao diện chung:
  ```css
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: hsla(0, 0%, 100%, 0.15);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: hsla(0, 0%, 100%, 0.3);
  }
  ```
