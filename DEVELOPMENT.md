# Quy trình và Hướng dẫn Phát triển Manga Downloader

Tài liệu này cung cấp các nguyên tắc lập trình, quy tắc bảo mật và quy trình tích hợp khi thêm cấu hình các trang web đọc truyện mới hoặc cập nhật tính năng cho extension Manga Downloader.

---

## 1. Nguyên tắc Bảo mật (Security-First Rules)

Mọi dữ liệu lấy từ website bên ngoài, API từ xa, cấu hình của người dùng và các CSS Selector đều được coi là nguồn dữ liệu không đáng tin cậy. Khi phát triển, cần tuân thủ nghiêm ngặt các quy tắc sau:

### 1.1 An toàn khi thực thi mã nguồn
* **Không thực thi mã động**: Tuyệt đối không sử dụng `eval`, `new Function`, truyền chuỗi lệnh vào `setTimeout`/`setInterval` hoặc chèn script từ xa (remote script injection).
* **Phân quyền tối thiểu (Minimal Permissions)**: Không mở rộng các quyền không cần thiết trong `manifest.json`. Giữ phạm vi quyền hạn ở mức tối thiểu.
* **Không lưu trữ thông tin nhạy cảm**: Không lưu trữ token, cookies, thông tin đăng nhập hoặc credential của người dùng vào `chrome.storage.local`.
* **Xác thực URL**: Luôn kiểm tra tính hợp lệ của URL bằng `new URL(...)`. Chỉ cho phép các giao thức `http:` và `https:`. Từ chối các liên kết dạng `javascript:` hoặc base64/blob không rõ nguồn gốc.

### 1.2 Hiển thị giao diện an toàn (Safe UI Rendering)
* **Tránh dùng `innerHTML`**: Sử dụng `textContent`, `createElement` và `setAttribute` khi kết xuất các nội dung động (như tên truyện, tiêu đề chương, tác giả, và thông báo lỗi).
* **Vệ sinh dữ liệu (Sanitize)**: Chỉ sử dụng `innerHTML` đối với các template HTML tĩnh hoàn toàn không chứa biến truyền vào. Luôn chạy qua hàm `escapeHtml(...)` nếu có bất kỳ chuỗi động nào.
* **Không dùng thuộc tính sự kiện inline**: Không khai báo các thuộc tính như `onclick` hoặc `onerror` trực tiếp trong chuỗi HTML động. Đăng ký sự kiện thông qua phương thức `addEventListener`.

### 1.3 Cơ chế DOM Bridge cô lập
* **Chỉ truyền dữ liệu không nhạy cảm**: Cầu nối DOM (`#__manga_dl_bridge__`) chỉ được sử dụng để truyền các liên kết ảnh được trích xuất từ ngữ cảnh trang web (`MAIN` world) sang content script cô lập (`ISOLATED` world).
* **Cấu trúc dữ liệu**: Truyền tải dữ liệu dưới dạng chuỗi JSON đã được serialize nằm trong thẻ `<script type="application/json">`. Không thực thi bất kỳ đoạn mã JS nào qua cầu nối này.
* **Xác thực Schema**: Kiểm tra và validate dữ liệu ngay sau khi parse JSON (ví dụ: giới hạn số lượng ảnh tối đa 500 hình, kiểm tra giao thức của từng liên kết phải là `http:` hoặc `https:`).

### 1.4 Quy định về Network Headers & DNR Rules
* **Tránh trùng lặp ID**: Các rules của Declarative Net Request (DNR) động phải sử dụng bộ đếm ID tự động tăng (ví dụ: `getNextDnrRuleId()`) để tránh xung đột khi tải nhiều tab song song.
* **Phạm vi tác động**: Giới hạn rule sửa đổi Header Referer đúng tên miền đích, và luôn dọn dẹp (clean up) các rule này trong khối `finally` sau khi tải xong.

---

## 2. Quy trình Cấu hình Trang Web mới (Viewer Analysis)

Để thêm cấu hình (site profile) cho một trang đọc truyện mới vào cơ sở dữ liệu [default_sites.js](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/utils/default_sites.js), thực hiện theo các bước sau:

### Bước 1: Khảo sát cấu trúc trang
Mở trang đọc chương truyện trên trình duyệt và sử dụng DevTools để tìm các CSS Selector:
1. **Title Selector**: Bộ chọn chứa tên truyện chính (ví dụ: breadcrumb, thẻ h1).
2. **Chapter Selector**: Bộ chọn chứa tên hoặc số chương hiện tại.
3. **Image Selector**: Bộ chọn nhắm trực tiếp đến danh sách thẻ ảnh truyện (loại bỏ banner quảng cáo, avatar comment).
4. **Image URL Attribute**: Thuộc tính chứa link ảnh gốc. Nếu trang web sử dụng lazy-load, cần tìm thuộc tính lưu ảnh thực tế (ví dụ: `data-src`, `data-original`, `data-lazy-src`).

### Bước 2: Xử lý các trường hợp đặc biệt
* **Canvas Reader**: Nếu trang web vẽ ảnh lên thẻ `<canvas>` để chống tải, cấu hình `imageSelector` trỏ vào thẻ `canvas`. Bộ cài đặt sẽ tự động gọi phương thức `.toDataURL('image/jpeg', 0.85)` để trích xuất dữ liệu ảnh. Thuộc tính ảnh lúc này cấu hình là `"src"`.
* **Trang tải chậm / Lazy Load**: Content script có cơ chế tự động cuộn trang (`autoScrollPage`) để kích hoạt tải ảnh trước khi trích xuất. Hãy đảm bảo CSS Selector khớp đúng sau khi cuộn.

### Bước 3: Cập nhật `utils/default_sites.js`
Thêm cấu hình mới theo định dạng mẫu vào danh sách `DEFAULT_SITES` và mã hóa base64 cấu hình đó cập nhật vào `utils/rules.dat` để đồng bộ GitHub:
```json
  "site_key": {
    "name": "Tên Website",
    "domainPattern": "regex_ten_mien",
    "chapterUrlPattern": "pattern_de_khop_trang_doc",
    "imageSelector": ".reader-images-selector img",
    "imageUrlAttribute": "data-src|src",
    "titleSelector": ".manga-title",
    "chapterSelector": ".current-chapter",
    "referer": "https://www.ten-mien-goc.com/",
    "isNsfw": false,
    "searchSupported": true
  }
```

> [!IMPORTANT]
> **Quy định bắt buộc về Tìm kiếm:**
> Khi thêm mới hoặc cập nhật cấu hình một trang web, bạn **PHẢI** phân tích và thiết lập tính năng tìm kiếm tích hợp cho trang đó trong file [background.js](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/background/background.js) để đảm bảo tất cả các trang đều hỗ trợ tìm kiếm đồng bộ.

---

## 3. Hướng dẫn Tích hợp Tìm kiếm (Search Integration)

Tùy thuộc vào cơ chế bảo mật (như Cloudflare) hoặc kiến trúc của từng trang web, chọn một trong ba chiến lược tìm kiếm sau:

### 3.1 Các chiến lược tìm kiếm
1. **Truy vấn trực tiếp qua API/AJAX (Ưu tiên số 1)**: Nếu trang web hỗ trợ endpoint tìm kiếm nhanh hoặc API nội bộ (như `/wp-json/...` hoặc các endpoint admin-ajax), hãy gọi trực tiếp endpoint này để nhận về dữ liệu JSON. Cơ chế này nhanh và ổn định nhất.
2. **Tìm kiếm qua DuckDuckGo Fallback (Dự phòng tự động)**: Khi các yêu cầu backend trực tiếp bị Cloudflare chặn (mã lỗi 403 hoặc 503), hệ thống sẽ tự động chuyển hướng tìm kiếm thông qua trang DuckDuckGo tĩnh: `https://html.duckduckgo.com/html/?q=site:targetdomain.com+search_query` rồi bóc tách liên kết chuyển hướng của kết quả.
3. **Quét DOM trên tab ẩn (Active Tab Scraping)**: Giải pháp cuối cùng đối với các trang chặn gắt gao. Mở một tab mới ở chế độ nền để trình duyệt vượt qua Cloudflare tự động, thực thi script cào dữ liệu từ DOM của trang kết quả tìm kiếm đó rồi tự động đóng tab.

### 3.2 Định dạng chuẩn kết quả tìm kiếm
Tất cả kết quả tìm kiếm gửi về popup cần được chuẩn hóa thành định dạng:
```javascript
results.push({
  title: cleanTitle,          // Tên truyện đã được làm sạch
  author: cleanAuthor,        // Tên tác giả (mặc định 'Nhiều tác giả' nếu trống)
  thumbnail: validatedUrl,    // URL ảnh bìa hợp lệ
  url: validatedUrl,          // URL trang chi tiết truyện hợp lệ
  source: siteReadableName,   // Tên nguồn hiển thị (ví dụ: 'MangaKatana')
  sourceKey: siteKey          // Khóa cấu hình tương ứng (ví dụ: 'mangakatana')
});
```

---

## 4. Hệ thống Tự động dò Selector (Heuristic Probing) & Tự huấn luyện (Training)

Extension sở hữu cơ chế tự động dò tìm cấu trúc trang (Heuristic Probing) và tự học các bộ chọn (Selector) thành công:
* **Heuristic Scan**: Khi trang web không có cấu hình sẵn, hệ thống sẽ tự động quét phân tích DOM để tìm thẻ chứa ảnh đọc nhiều nhất, phân tích breadcrumb để đoán tên truyện/chương.
* **Cơ chế Tự Huấn luyện (MangaTrainer)**: 
  * Khi người dùng lưu cấu hình thủ công thành công, Selector đó được cộng điểm tin cậy (`+3`).
  * Khi người dùng tải truyện và đóng gói file ZIP thành công, cấu hình tương ứng được cộng điểm tin cậy (`+1`).
  * Hệ thống sẽ ưu tiên các bộ chọn có điểm tin cậy cao hơn để tự vá lỗi cấu hình khi cấu trúc trang web thay đổi.

---

## 5. Quy định Đóng gói và Phát hành (Git & Release Hygiene)

* **Các file được phép đưa lên Git**: Chỉ stage các file mã nguồn cần thiết để chạy tiện ích: `manifest.json`, `background/`, `content/`, `popup/`, `icons/`, `utils/`, và các file tài liệu hướng dẫn (`README.md`, `DEVELOPMENT.md`, `CHANGELOG.md`, `PRIVACY.md`).
* **Các file bắt buộc BỎ QUA**: Các tệp phục vụ kiểm thử cục bộ, log lỗi thô, ảnh chụp DOM, cache trình duyệt debug (`chrome-profile-debug/`) tuyệt đối không được đưa lên Git. Hãy khai báo chúng trong `.gitignore`.
