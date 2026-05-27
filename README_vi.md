# 🪐 Manga Downloader

<p align="center">
  <img src="icons/icon128.png" alt="Manga Downloader Logo" width="100"/>
</p>

<p align="center">
  <a href="https://github.com/seaflower205/manga-downloader/blob/main/LICENSE"><img src="https://img.shields.io/github/license/seaflower205/manga-downloader?style=for-the-badge&color=blue" alt="Giấy phép"/></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Manifest-V3-orange?style=for-the-badge" alt="Manifest V3"/></a>
  <img src="https://img.shields.io/badge/Nền%20tảng-Chrome%20%7C%20Edge%20%7C%20Brave-success?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Tương thích trình duyệt"/>
</p>

---

**Manga Downloader** là một tiện ích mở rộng hiệu năng cao dành cho các trình duyệt Chromium (Chrome, Edge, Brave, Opera) được phát triển hoàn toàn trên nền tảng **Manifest V3**. Tiện ích hỗ trợ tự động phát hiện, trích xuất hình ảnh chương truyện từ bất kỳ trang web đọc truyện nào, giải quyết triệt để các cơ chế lazy-load phức tạp và đóng gói chúng thành tệp ZIP hoàn chỉnh cực nhanh.

Điểm đặc biệt là hệ thống có khả năng tùy biến không giới hạn — bạn có thể thêm cấu hình trang web mới bằng CSS Selector thủ công hoặc thông qua **công cụ phân tích DOM thông minh hỗ trợ bởi AI**.

---

## 🏗️ Kiến trúc Hệ thống

Sơ đồ dưới đây mô tả cách các thành phần trong extension (Service Worker ngầm, Content Script và giao diện Popup) kết hợp với nhau để tìm kiếm, trích xuất cấu trúc và tải xuống dữ liệu truyện tranh:

```mermaid
graph TD
    A[Trang Web Đọc Truyện] -->|Bộ quét Heuristic / AI DOM| B[Content Script detector.js]
    B -->|DOM đã chụp & Gán vai trò| C[Popup sites_manager.js]
    C -->|Sao chép Prompt AI| D[AI Chatbot bên ngoài]
    D -->|Sinh cấu hình JSON| C
    C -->|Nhập cấu hình| E[(chrome.storage.local)]
    F[Popup search_manager.js] -->|Truy vấn Tìm kiếm| G[Service Worker search_providers.js]
    G -->|Gọi trực tiếp / Dự phòng DDG| A
    H[Popup UI / Panel Content] -->|Yêu cầu Tải xuống| I[Content Script downloader.js]
    I -->|Tự cuộn trang & Lazy-Load| A
    I -->|Tải ảnh / Trích xuất Canvas| J[Yêu cầu mạng (Fetch)]
    J -->|Đóng gói JSZip| K[Tải xuống tệp ZIP]
    
    style E fill:#1e293b,stroke:#3b82f6,stroke-width:2px;
    style D fill:#1e1b4b,stroke:#818cf8,stroke-width:2px;
    style K fill:#064e3b,stroke:#10b981,stroke-width:2px;
```

---

## ⚠️ Tuyên bố Miễn trừ Trách nhiệm

> [!WARNING]
> Tiện ích này là **công cụ trích xuất hình ảnh đa năng** được phát triển cho mục đích cá nhân học tập và lưu trữ ngoại tuyến (offline). Người sử dụng chịu hoàn toàn trách nhiệm pháp lý đối với việc:
> - Tuân thủ Điều khoản Dịch vụ (ToS) của các website truy cập.
> - Đảm bảo quyền sở hữu hoặc quyền tải xuống hợp pháp đối với các hình ảnh.
> - Không phân phối, thương mại hóa lại nội dung có bản quyền.
> 
> **Tiện ích này TUYỆT ĐỐI không được dùng để:**
> - Vượt tường phí hoặc cơ chế xác thực trả phí của các nền tảng thương mại.
> - Phá vỡ các biện pháp quản lý quyền kỹ thuật số (DRM) bảo vệ bản quyền.
> - Chia sẻ trái phép tài liệu có bản quyền.

---

## ✨ Tính năng Nổi bật

### 🚀 Bộ cơ chế Tải & Đóng gói
- **Trích xuất ảnh vạn năng**: Hỗ trợ quét hình ảnh từ các thẻ ảnh (`<img>`) truyền thống hoặc trực tiếp từ các khung hiển thị Canvas (`<canvas>`) chống tải bằng phương thức render ngầm.
- **Đóng gói ZIP siêu tốc**: Sử dụng thư viện `JSZip` trực tiếp tại tầng content script ở chế độ lưu trữ (`STORE`), cho phép nén chương truyện dài hàng trăm trang thành file ZIP chỉ dưới 0.5 giây mà không gây đứng trình duyệt.
- **Vượt rào Lazy-Load**: Tự động phát hiện và trích xuất link ảnh từ các thuộc tính ẩn linh hoạt (như `data-src`, `data-original`, `data-lazy-src`).
- **Tự động cuộn trang (Auto-Scroll)**: Tự động giả lập hành động cuộn trang mượt mà trước khi tải nhằm kích hoạt đầy đủ thư viện lazy-load và kết xuất dữ liệu Canvas của trang.
- **Trích xuất Metadata thông minh**: Tự nhận diện tên truyện, tên tập/chương để tạo thư mục lưu trữ khoa học.

### 🧠 Cấu hình thông minh qua AI
- **Prompt AI một chạm**: Tự động phân tích và tạo khuôn mẫu prompt gửi cho AI kèm theo cấu trúc DOM đã lọc gọn. Chỉ cần dán vào ChatGPT, Gemini, hay Claude để nhận về tệp cấu hình JSON hoàn chỉnh.
- **Gán nhãn ứng viên DOM**: Tự động chèn các thẻ nhận diện vai trò (như `manga-title-candidate`, `manga-image-candidate`) vào HTML trước khi chụp giúp AI định vị chính xác selector.
- **Thu gọn cây DOM thừa**: Thu nhỏ dữ liệu HTML từ hàng Megabyte xuống chỉ còn 15-30KB bằng cách gộp các nhóm thẻ lặp lại, tránh lỗi đầy bộ nhớ (token overflow) của các mô hình ngôn ngữ lớn.

### 🔍 Hệ thống Tìm kiếm Đa nguồn
- **Tìm kiếm đồng thời**: Quét tìm từ khóa trên tất cả các trang web truyện đã cấu hình cùng một lúc.
- **Cổng dự phòng DuckDuckGo**: Tự động chuyển hướng tìm kiếm qua Yahoo/DuckDuckGo HTML tĩnh khi trang web gốc bật chặn Cloudflare/WAF chặt chẽ.
- **Phân tách Tab NSFW**: Hỗ trợ chế độ Hentai (NSFW) với tab tìm kiếm độc lập và cơ chế chuyển đổi giao diện, bộ lọc màu tự động.
- **Bật/Tắt nguồn linh hoạt**: Lựa chọn tắt hoặc bật nhanh từng trang web trong danh sách tìm kiếm thông qua các badge bộ lọc trực quan.

### 🎨 Giao diện UI/UX Hiện đại
- **Giao diện Glassmorphism**: Thiết kế hiệu ứng kính mờ, đổ bóng HSL phát sáng thời thượng với hiệu ứng chuyển động vi mô (micro-animations) mượt mà.
- **5 Bộ giao diện mẫu cao cấp**: Chọn nhanh các chủ đề presets tuyệt đẹp (Cyberpunk Neon, Sakura Blossom, Hacker Matrix, Ocean Breeze, Sunset Glow) đi kèm logo nghệ thuật SVG riêng biệt tự động cập nhật.
- **Chống giật bố cục (Jitter Prevention)**: Khóa sẵn chiều cao các khung thông tin và sử dụng skeleton loading nhấp nháy (`previewPulse`) trong khi phân tích trước ảnh, mang lại trải nghiệm tải cực êm dịu.
- **Cảnh báo thông minh**: Hệ thống thông báo nổi (floating banner) căn giữa tuyệt đối, trượt và mờ dần (`fade-out` transition) êm ái khi tắt.

---

## 📦 Hướng dẫn Cài đặt

1. **Tải mã nguồn từ GitHub**:
   ```bash
   git clone https://github.com/seaflower205/manga-downloader.git
   ```
   *Hoặc tải file ZIP trực tiếp từ GitHub và giải nén trên máy tính.*

2. **Cài đặt vào Trình duyệt**:
   - Truy cập vào trang quản lý tiện ích: `chrome://extensions/` (Chrome) hoặc `edge://extensions/` (Edge).
   - Kích hoạt **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải màn hình.
   - Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
   - Chọn thư mục chính chứa dự án (thư mục có chứa tệp `manifest.json`).

3. **Ghim Tiện ích**:
   - Bấm vào biểu tượng mảnh ghép trên thanh công cụ và ghim **Manga Downloader** để truy cập nhanh.

---

## 📖 Hướng dẫn nhanh

### Cách 1: Cấu hình trang web mới bằng AI (Khuyến nghị)

1. Mở trang đọc một chương truyện bất kỳ trên trình duyệt.
2. Bấm vào biểu tượng Manga Downloader → chuyển sang tab **Cấu Hình**.
3. Nhập tên Website và URL chương mẫu.
4. Bấm nút **Lấy Prompt AI** để sao chép prompt cùng cấu trúc trang đã chụp vào bộ nhớ tạm.
5. Dán prompt này vào chatbot AI (ChatGPT, Gemini, Claude...).
6. Sao chép khối mã JSON cấu hình do AI trả về.
7. Dán vào ô **Nhập cấu hình** dưới dạng JSON và bấm **Nhập**.
8. Hoàn tất! Trang web đã sẵn sàng để tải xuống và tìm kiếm tích hợp.

### Cách 2: Cấu hình thủ công bằng CSS Selector

1. Mở trang đọc truyện, bấm F12 (DevTools) để xác định:
   - **Selector ảnh**: Ví dụ `.chapter-content img` hoặc thẻ `canvas`
   - **Selector tên truyện**: Ví dụ `h1.title`
   - **Selector chương**: Ví dụ `.chapter-number`
2. Mở popup tiện ích → tab **Cấu Hình** → Điền các selector tương ứng → bấm **Lưu**.

---

## 🗃️ Quy chuẩn JSON Cấu hình (Schema)

Mỗi trang web được cấu hình và lưu trữ nội bộ bằng định dạng sau:

```json
{
  "name": "Tên Website",
  "domainPattern": "example\\.com",
  "chapterUrlPattern": "chapter|read",
  "imageSelector": ".reader-content img",
  "imageUrlAttribute": "src|data-src|data-original",
  "titleSelector": "h1.manga-title",
  "chapterSelector": ".chapter-info",
  "referer": "https://example.com/",
  "isNsfw": false,
  "searchSupported": true,
  "searchUrl": "https://example.com/search?q={query}",
  "searchResultSelector": ".search-result-item",
  "searchTitleSelector": ".result-title",
  "searchCoverSelector": ".result-cover img",
  "searchAuthorSelector": ".result-author"
}
```

---

## 📂 Danh mục Cấu trúc thư mục

```
├── manifest.json           # Tệp cấu hình của Extension MV3
├── background/
│   ├── background.js       # Điểm khởi chạy Service Worker chính
│   ├── network.js          # Quản lý sự kiện mạng (referer, cookie)
│   ├── search_providers.js # Thực thi cào và gọi API tìm kiếm
│   ├── search_fallback.js  # Bộ cào dự phòng tìm kiếm Yahoo/DDG/Google
│   ├── utils.js            # Các hàm bổ trợ trong service worker
│   ├── offscreen.js        # Script chạy ngầm xử lý ảnh canvas và parse DOM
│   └── offscreen.html      # Giao diện chạy ngầm offscreen
├── content/
│   ├── content.js          # Bộ điều khiển chính chạy trong trang web đọc truyện
│   ├── detector.js         # Bộ quét và nhận diện cấu trúc DOM thông minh
│   ├── downloader.js       # Quản lý tải ảnh và đóng gói ZIP
│   ├── ui.js               # Tạo giao diện thanh bên bên trong trang đọc
│   ├── grabber.js          # Nhúng mã lấy link ảnh trong môi trường MAIN
│   └── iframe_bridge.js    # Cầu nối gửi tin nhắn cross-frame
├── popup/
│   ├── popup.html          # HTML giao diện cửa sổ tiện ích
│   ├── popup.js            # Điều khiển hoạt động trên popup
│   ├── popup.css           # CSS định dạng giao diện glassmorphic
│   ├── search_manager.js   # Quản lý giao diện tìm kiếm đa nguồn
│   └── sites_manager.js    # Nhập/xuất cấu hình, tạo prompt AI
├── icons/                  # Bộ hình ảnh tài nguyên logo tiện ích
└── utils/
    ├── security.js         # Làm sạch dữ liệu, kiểm tra URL an toàn, chẩn đoán
    ├── default_sites.js    # Cơ sở dữ liệu cấu hình các trang mặc định
    ├── rules.dat           # Cấu hình mã hóa base64 để đồng bộ từ xa
    └── jszip.min.js        # Thư viện JSZip (Giấy phép MIT)
```

---

## 🔒 Bảo mật & Quyền riêng tư

- **Không thực thi mã động**: Không sử dụng `eval()`, `new Function()`, và không gán trực tiếp dữ liệu động vào `innerHTML`. Đảm bảo an toàn tuyệt đối theo tiêu chuẩn Manifest V3.
- **Lọc DOM an toàn**: Các trang chụp DOM gửi cho AI đều được tự động loại bỏ thẻ script, CSS inline, iframe, các thẻ input nhập dữ liệu và thông tin cá nhân nhạy cảm trước khi sao chép.
- **Bảo mật dữ liệu**: Tiện ích không thu thập bất kỳ dữ liệu cá nhân nào, không chứa mã theo dõi (analytics/trackers). Mọi log lỗi, lịch sử tìm kiếm và cấu hình đều chỉ lưu trữ trên máy cục bộ của bạn (`chrome.storage.local`).
- **Quy tắc DNR**: Sửa đổi Referer Header được kích hoạt cục bộ theo tab và tự động hủy bỏ ngay lập tức khi tác vụ tải ảnh kết thúc.

---

## 💻 Trình duyệt Tương thích

| Trình duyệt | Phiên bản tối thiểu | Yêu cầu Manifest |
|-------------|---------------------|------------------|
| **Google Chrome** | 90+ | Hỗ trợ Manifest V3 |
| **Microsoft Edge** | 90+ | Hỗ trợ Manifest V3 |
| **Brave** | 1.0+ | Hỗ trợ Manifest V3 |
| **Opera** | 76+ | Hỗ trợ Manifest V3 |

---

## 🤝 Đóng góp ý kiến

1. Fork dự án này.
2. Tạo nhánh tính năng mới (`git checkout -b feature/your-feature`).
3. Commit thay đổi (`git commit -m 'Add your feature'`).
4. Đẩy nhánh lên GitHub (`git push origin feature/your-feature`).
5. Tạo một Pull Request mới để kiểm tra tích hợp.

---

## 📄 Giấy phép

Mã nguồn dự án được cấp phép theo **GNU General Public License v3.0** — xem chi tiết tại tệp [LICENSE](LICENSE).

### Giấy phép Thư viện bên thứ ba
- **JSZip** v3.10.1 (Giấy phép MIT) — xem [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

Được phát triển với ❤️ bởi [seaflower205](https://github.com/seaflower205).
