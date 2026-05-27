# Manga Downloader - Nhật ký Phát triển & Sửa lỗi (Development & Debug Journal)

Tài liệu này lưu trữ toàn bộ lịch sử phát triển, các bước ý tưởng, phát hiện lỗi (bug diagnosis), phương án giải quyết và lịch sử sửa lỗi. Đây là nguồn dữ liệu quan trọng giúp chuyển tiếp ngữ cảnh mượt mà giữa các phiên làm việc (sessions) hoặc khi thay đổi mô hình AI (model context swaps).

---

## 1. Nhật ký phiên làm việc (Session Logs & Active Updates)

### [2026-05-27] - Khắc phục nhận diện nhầm chi tiết truyện & Tinh chỉnh nút chọn định dạng

#### Lỗi 1: Nhận diện nhầm trang thông tin chi tiết truyện (Title Detail) làm trang đọc chương truyện (Chapter Page)
* **Trang phát hiện**: `https://mangaball.net/title-detail/one-piece-68515540702284f8341784c8/`
* **Triệu chứng**: Khi người dùng ở trang thông tin chi tiết truyện, bảng điều khiển hiển thị cảnh báo lỗi cấu trúc trang web `"Cấu trúc trang web đã thay đổi! Không tìm thấy hình ảnh..."` thay vì `"Chưa mở trang đọc truyện..."`.
* **Nguyên nhân (Diagnosis)**:
  1. Trong hàm `isChapterPage()` (tại [downloader.js](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/content/downloader.js)), regex loại trừ tiền tố chi tiết `infoPrefixes` không khớp với cụm `title-detail`.
  2. Mã ID MongoDB (`68515540702284f8341784c8`) kết thúc bằng ký tự `c8`. Heuristic nhận diện chương dùng biểu thức `/(?:chap|chapter|chuong|ep|episode|tập|tap|vol|v|c)[_-]?\d+/i` đã vô tình khớp với `c8` trong chuỗi hex này, khiến `hasChapterKeyword` trả về `true`.
* **Giải pháp (Fix)**:
  1. Mở rộng `infoPrefixes` để khớp các dạng tiền tố chi tiết truyện nâng cao: `manga-detail`, `title-detail`, `series-detail`, v.v.
     ```javascript
     const infoPrefixes = /^(?:manga|truyen|title|series|comic|book|info|show|detail|details)(?:-details?|s)?$/i;
     ```
  2. Tối ưu hóa `chapterKeywordRegex` để tránh khớp các chuỗi số ngẫu nhiên cuối mã hash: giới hạn tiền tố `v` hoặc `c` bằng ký tự ranh giới không phải chữ-số `(?:^|[^a-zA-Z0-9])` (thay vì chỉ dùng ranh giới từ `\b` để hỗ trợ cả ký tự phân cách như dấu gạch dưới `_`), độ dài số tối đa là 5 chữ số và không đi sau bởi số khác `(?!\d)`:
     ```javascript
     const chapterKeywordRegex = /(?:chap|chapter|chuong|ep|episode|tập|tap|vol)[_-]?\d+|(?:^|[^a-zA-Z0-9])(?:v|c)[_-]?\d{1,5}(?!\d)/i;
     ```

#### Lỗi 2: Căn giữa chữ hiển thị định dạng và thu gọn nút chọn định dạng tải truyện
* **Triệu chứng**: Chữ định dạng (ví dụ: `JPG`) bên trong nút trigger (`.manga-dl-select-trigger`) bị lệch, không căn giữa và nút bấm quá to so với bố cục chung.
* **Ý tưởng & Thiết kế**:
  1. Căn giữa văn bản thông qua `justify-content: center` và dọn dẹp khoảng trắng thừa.
  2. Thu nhỏ kích thước của chính nút bấm trigger `.manga-dl-select-trigger` để tạo cảm giác tinh tế, hài hòa, nhưng **giữ nguyên** chiều rộng và kích cỡ font chữ của hộp thoại tùy chọn xổ xuống (`.manga-dl-select-options`) để đảm bảo các dòng mô tả định dạng không bị co lại gây khó đọc.
* **Giải pháp (Fix)**:
  1. Giảm chiều rộng của `.manga-dl-custom-select` từ `130px` xuống `90px`.
  2. Giảm padding của nút bấm từ `7px 24px` xuống `5px 20px`, bo góc từ `12px` xuống `10px`, và giảm cỡ chữ từ `13px` xuống `12px`.
  3. Căn chỉnh lại icon mũi tên chỉ xuống `right: 14px` thành `right: 10px` để cân xứng với nút bấm nhỏ hơn.
  4. Đưa các thuộc tính kích thước của hộp tùy chọn xổ xuống `.manga-dl-select-options` (width `260px`, padding tùy chọn `10px 14px`, cỡ chữ `12.5px`/`10px`, cỡ icon `28px`) về lại trạng thái mặc định như ban đầu.

---

## 2. Lịch sử Thay đổi giao diện & Trải nghiệm (UI/UX Presets & Custom Themes)

### [2026-05-27] - Cải tiến Layout Jitter & Tích hợp Theme Presets nghệ thuật

#### Tính năng 1: Thêm Giao diện mẫu và Nút áp dụng đa chế độ
* **Mô tả**: Tích hợp 5 preset giao diện mẫu cực đẹp trong tab AI (Cyberpunk, Sakura, Hacker, Ocean, Sunset) dưới dạng nút chọn swatch hình tròn có hiệu ứng hover spring-scale (`scale(1.22)`) và bóng mờ HSL.
* **Nút áp dụng mục tiêu**: Khi chọn theme preset hoặc nạp custom theme, xuất hiện lựa chọn áp dụng cho "Manga", "Hentai (NSFW)" hoặc "Cả hai". Màu sắc giao diện lưu riêng biệt trong `chrome.storage.local` và tự động chuyển đổi mượt mà khi người dùng đổi tab tìm kiếm.
* **AI Custom Theme Prompt**: Cải tiến nút "Lấy Prompt AI" để tự động chèn các thông số màu sắc chủ đạo HSL hiện hành, làm tham chiếu để các chatbot AI ngoài có thể dựa trên phong cách đó viết tiếp giao diện tùy chỉnh mới.

#### Tính năng 2: Chống giật khung hình (Layout Jitter) & Cải tiến hoạt ảnh
* **Hiện tượng**: Khi ấn tải truyện, các hàng thông số ("Số trang", "Định dạng gốc") hiển thị bất thình lình làm lệch bố cục; cảnh báo chế độ 18+ xuất hiện/biến mất bị giật khung hình và không căn giữa.
* **Giải pháp**:
  1. Render sẵn các hàng thông số với giá trị `"Đang tính..."` để giữ ổn định chiều cao panel ngay từ đầu.
  2. Áp dụng hiệu ứng nhấp nháy skeleton loading (`previewPulse`) trên khung xem thử trong lúc xử lý gộp ảnh.
  3. Chuyển đổi vùng cảnh báo `#status-notification-area` thành dạng nổi tuyệt đối (floating overlay) căn giữa phía dưới header. Thêm class `.fade-out` để mờ dần và trượt lên mượt mà trong `250ms` trước khi biến mất.

---

## 3. Ý tưởng phát triển tương lai (Future Ideas & Enhancements)
* **Kiểm soát Tải xuống**: Tự động khôi phục tải xuống khi kết nối mạng bị gián đoạn giữa chừng.
* **Nâng cao Heuristic**: Tiếp tục mở rộng bộ phát hiện chương truyện để hỗ trợ các đường dẫn dạng Single Page Application (SPA) phức tạp hơn.
* **Chia sẻ Giao diện**: Xây dựng kho lưu trữ giao diện mẫu (Theme Presets) trực tuyến để người dùng import qua một mã hash ngắn.
