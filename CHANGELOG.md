# Nhật ký Thay đổi (Changelog)

Tất cả các thay đổi quan trọng đối với dự án **Manga Downloader** sẽ được cập nhật tại đây. Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/).

---

## [1.2.1] - 2026-05-27

### Added
- **Theme Presets (Giao diện mẫu)**: Tích hợp 5 gói giao diện mẫu cực đẹp trực tiếp trong tab AI (Cyberpunk Neon, Sakura Blossom, Hacker Matrix, Ocean Breeze, Sunset Glow) biểu diễn bằng các nút tròn màu sắc có bóng mờ phát sáng.
- **Custom SVG Logo Icons**: Mỗi giao diện mẫu được thiết kế riêng một logo SVG nghệ thuật phù hợp (dưới dạng base64/UTF-8 Data URL), tự động thay thế logo chính trên header khi áp dụng giao diện.
- **Context-Aware AI Prompt Copying**: Nâng cấp chức năng "Lấy Prompt AI". Tiện ích sẽ tự động nhận diện giao diện mẫu đang chọn hoặc giao diện tùy chỉnh đang chạy để trích xuất mã màu HSL đính kèm thẳng vào nội dung prompt copy, giúp AI dễ dàng tạo/chỉnh sửa trực tiếp từ phong cách hiện có của bạn.

### Fixed
- **Status Alerts (Cảnh báo 18+)**: Di chuyển vùng cảnh báo (`#status-notification-area`) thành dạng popup nổi (absolute overlay) nằm giữa và căn đều ngay dưới header, loại bỏ việc chiếm diện tích block gây rung/giật khung giao diện khi xuất hiện hoặc biến mất.
- **Fade-out Transition**: Tích hợp thêm class `.fade-out` giúp hiệu ứng cảnh báo mờ dần và trượt lên mượt mà trong 250ms trước khi bị xóa hoàn toàn khỏi DOM.
- **Manga Downloader Reflow Optimization**: Khắc phục lỗi giật khung hình khi tải hộp thoại chi tiết download truyện tranh (`.manga-dl-panel`):
    * Giữ nguyên các hàng thông số ("Định dạng gốc", "Kích thước gốc") và khu vực xem thử (preview) trong DOM ngay từ đầu, thay vì ẩn/hiện đột ngột bằng `display: none` / `flex`.
    * Thêm hiệu ứng nhấp nháy skeleton loading mượt mà (`previewPulse`) trên khung ảnh xem thử trong lúc chờ tải và gộp ảnh gốc.
    * Thêm hiệu ứng chuyển động mờ dần (`loaded` transition) giúp ảnh xem thử xuất hiện êm dịu, không bị giật hoặc đơ cứng.
- **Format Select Alignment & Compact Size**: Căn giữa chữ hiển thị định dạng tải (ví dụ: `JPG`) bên trong nút chọn trigger của panel download thông qua `flex: 1` và `text-align: center`, đồng thời dọn sạch khoảng trắng dư thừa. Thu nhỏ kích thước nút chọn (`width: 90px`, `padding: 5px 20px`, `font-size: 12px`, `border-radius: 10px`, `right: 10px` cho mũi tên) để bố cục gọn gàng, cân đối hơn.
- **MangaBall Title Detail Bug**: Sửa lỗi nhận diện sai trang chi tiết truyện (title-detail) là trang chương truyện do URL chứa ID kết thúc bằng ký tự `c8` (mã hex). Cấu hình lại `infoPrefixes` và `chapterKeywordRegex` trong `downloader.js` để tránh khớp nhầm mã hash MongoDB mà vẫn phát hiện đúng chương thực tế.

## [1.2.0] - 2026-05-27

### Added
- **DOM Suggestion Engine**: Tự động gắn nhãn gợi ý `data-ai-role` (như `manga-title-candidate`, `manga-image-candidate`...) vào cấu trúc DOM trước khi sao chép, hỗ trợ AI trích xuất cấu hình chính xác hơn.
- **Repetitive Sibling Collapse**: Tự động thu gọn các phần tử con lặp lại (như danh sách ảnh truyện hoặc card danh sách tìm kiếm) để giảm dung lượng HTML trích xuất xuống còn 15-30KB, tránh lỗi truncate.
- **Cross-Page Search DOM Extraction**: Hỗ trợ tự động tải bất đồng bộ trang chủ và trích xuất riêng phần form tìm kiếm (`<form>`, `<input>`) để đính kèm vào prompt AI.
- **Search Diagnostics**: Tích hợp tính năng chạy kiểm tra thử nghiệm tìm kiếm (mặc định với từ khóa "One Piece") vào công cụ Smart Diagnostics để kiểm tra độ tin cậy của bộ chọn tìm kiếm.
- **Upgraded AI Prompt**: Bổ sung chỉ dẫn chi tiết cho AI trong `sites_manager.js` để tìm kiếm và gán bộ chọn tác giả (`searchAuthorSelector`) từ trang chi tiết và trang kết quả tìm kiếm.
- **Tùy biến Giao diện Nâng cao (Custom Themes & Logo Branding)**:
    *   Tích hợp bộ điều khiển tùy biến giao diện trong tab "AI" cho phép nạp trực tiếp file `.json` hoặc file ảnh logo (`.png`, `.jpg`, `.webp`).
    *   Phát triển mô-đun [theme_manager.js](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/popup/theme_manager.js) hỗ trợ phân tích và tự động trích xuất màu sắc chủ đạo của logo bằng thẻ canvas 1x1, sinh tự động màu nền (`--bg-main`), màu nhấn (`--color-primary`, `--color-secondary`) đồng bộ với logo mới.
    *   **Nhập giao diện từ Diễn đàn**: Bổ sung ô nhập mã cấu hình (JSON text area) giúp người dùng dễ dàng copy-paste các gói giao diện được chia sẻ trên các diễn đàn/cộng đồng mạng mà không cần tải file cấu hình.
    *   **Tạo giao diện bằng AI**: Thêm nút sao chép nhanh Prompt AI ("Lấy Prompt AI") giúp người dùng dễ dàng sao chép khuôn mẫu chỉ dẫn gửi cho ChatGPT, Gemini, Claude,... để sinh ra tệp cấu hình JSON theo bất kỳ phong cách màu sắc nào họ muốn.
    *   **Phân chia giao diện Manga/Hentai**: Cho phép lưu trữ và áp dụng giao diện tùy biến riêng biệt cho chế độ Manga thường và chế độ Hentai (NSFW). Khi áp dụng giao diện (bằng file hay mã copy-paste), người dùng có nút bấm tùy chọn áp dụng riêng cho Manga, Hentai hoặc cả hai. Giao diện sẽ tự động chuyển màu mượt mà khi người dùng đổi chế độ tìm kiếm.
    *   Hỗ trợ xuất (export) gói cấu hình giao diện tùy biến hiện tại thành file JSON và Đặt lại (reset) giao diện mặc định.
- **Tài liệu Kỹ năng Lập trình (Developer Skill Guides)**: Bổ sung 2 file hướng dẫn kỹ thuật chuyên sâu làm tài liệu mã nguồn mở cho lập trình viên trên GitHub:
    *   [UX_ANIMATION_SKILL.md](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/UX_ANIMATION_SKILL.md): Bộ quy chuẩn thiết kế UI/UX hiện đại, phối màu HSL, phân cấp chữ Outfit/Inter và viết CSS Animations/Transitions hiệu năng cao.
    *   [EXTENSION_DEV_SKILL.md](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/EXTENSION_DEV_SKILL.md): Hướng dẫn kỹ thuật lập trình Chrome Extension MV3, quản lý vòng đời Service Worker, bảo mật DOM Bridge và thay đổi Header qua DNR Rules.

### Fixed
- **MangaKatana Search**: Thiết lập cơ chế parse tìm kiếm trực tiếp cho MangaKatana để sửa lỗi bộ quét regex mặc định cào sai các liên kết chuyên mục và chapter. Hỗ trợ tự động phát hiện chuyển hướng trực tiếp đến trang chi tiết khi chỉ có 1 kết quả khớp.
- **Tác giả trong Kết quả đơn**: Khắc phục lỗi gán cứng tác giả là "Nhiều tác giả" khi tìm kiếm redirect thẳng đến trang chi tiết. Giờ đây `tryExtractSingleMangaResult` sẽ tự động quét lấy tác giả thật từ HTML bằng bộ chọn hoặc regex heuristic.
- **Hỗ trợ Selector con ở Custom Search**: Nâng cấp hàm `parseCustomSearchHtml` bằng hàm trích xuất phụ `extractTextFromChunk` để phân tích các bộ chọn con có class lồng nhau (như `.author a`, `.cover img`) thay vì chỉ hỗ trợ một class đơn như trước.

---

## [1.1.0] - 2026-05-26

### Added
- **Multi-Source Toggle**: Hỗ trợ bật/tắt từng nguồn tìm kiếm nhanh trực tiếp bằng cách bấm vào các badge ở phần "Tìm trên", trạng thái tắt được đồng bộ qua `chrome.storage.local`.
- **NSFW Search Tabs**: Tách biệt hoàn toàn khung hiển thị tìm kiếm thường và tìm kiếm 18+ (NSFW) thành hai tab độc lập, tab NSFW chỉ xuất hiện khi chế độ Hentai Mode được kích hoạt.
- **DuckDuckGo Search Fallback**: Tự động sử dụng DuckDuckGo HTML tĩnh làm cổng tìm kiếm dự phòng khi truy cập trực tiếp các nguồn bị Cloudflare chặn (như MangaBall, MangaKatana, TheBlank).
- **Cookie Sharing**: Thêm cấu hình `credentials: 'include'` trên toàn bộ các truy vấn `fetch` ngầm của service worker để đính kèm cookie hiện tại của trình duyệt, tăng tỉ lệ vượt rào bảo vệ thành công.

### Fixed
- **Nettruyen Config Persistence**: Sửa lỗi tự động xóa cấu hình tùy chỉnh của NetTruyen khi khởi động lại tiện ích.
- **Search Badges Bug**: Sửa lỗi logic chọn nhầm phần tử trong DOM khiến badge tìm kiếm đầu tiên bị nhân bản lặp lại trên giao diện.
- **Custom Site Search Support**: Cho phép lưu cấu hình tìm kiếm tùy chỉnh mà không cần bắt buộc phải điền đầy đủ cả 4 selector phụ, đồng thời bổ sung bộ fallback thông minh cho link và ảnh bìa.
- **Import Self-Healing**: Thêm cơ chế đồng bộ tự sửa lỗi (`INITIALIZE_SITES` message) sau khi import cấu hình từ file/text, giúp tự động điền các trường cấu hình tìm kiếm mặc định còn thiếu.

---

## [1.0.0] - 2026-05-25

### Added
- **Smart Diagnostics Panel**: Thêm công cụ báo cáo chẩn đoán lỗi chi tiết có kèm nút sao chép nhanh mã Markdown/JSON để hỗ trợ debug cấu hình selector.
- **Training Engine (`utils/trainer.js`)**: Phát triển hệ thống tích lũy điểm kinh nghiệm tin cậy cho cấu hình selector dựa trên hoạt động thực tế (Manual save +3, Download thành công +1).
- **High-Performance ZIP Engine**: Tích hợp thư viện `JSZip` trực tiếp tại content script với chế độ lưu trữ không nén (`STORE`), rút ngắn thời gian đóng gói file ZIP dung lượng lớn xuống dưới 0.5 giây.
- **Auto-Scrolling**: Thêm cơ chế tự động cuộn trang xuống cuối rồi cuộn ngược lại cùng thanh tiến trình trực quan nhằm kích hoạt lazy-load ảnh trước khi quét DOM.
- **Self-Healing Config Migration**: Cơ chế tự nâng cấp và đồng bộ cấu hình lưu trữ cũ khi tiện ích cập nhật mã nguồn mới.

### Fixed
- **DNR Rule Collision**: Khắc phục lỗi xung đột ID quy tắc Declarative Net Request khi tải nhiều ảnh song song làm mất Referer header.
- **DOM Bridge Hardening**: Bảo mật hóa luồng truyền dữ liệu qua DOM Bridge, kiểm tra tính hợp lệ của mảng JSON và chặn các giao thức thực thi mã như `javascript:`.
