# Chính sách Quyền riêng tư / Privacy Policy

## Tiếng Việt

Manga Downloader **không thu thập, lưu trữ, hoặc gửi bất kỳ dữ liệu cá nhân nào** ra bên ngoài.

### Dữ liệu được lưu trữ cục bộ
- **Cấu hình trang web**: Các selector CSS và URL do người dùng tự cấu hình, lưu trong `chrome.storage.local`.
- **Nhật ký chẩn đoán**: Các sự kiện lỗi được lưu cục bộ (tối đa 120 sự kiện, tự động xóa sau 14 ngày) để hỗ trợ gỡ lỗi. Không gửi ra máy chủ bên ngoài.
- **Trạng thái tìm kiếm**: Kết quả tìm kiếm gần nhất được cache cục bộ để cải thiện trải nghiệm.

### Dữ liệu KHÔNG được thu thập
- Không theo dõi lịch sử duyệt web
- Không gửi dữ liệu đến bất kỳ máy chủ phân tích nào
- Không chia sẻ thông tin với bên thứ ba
- Không sử dụng cookie theo dõi

### Quyền của tiện ích
- `storage`: Lưu cấu hình và nhật ký cục bộ
- `downloads`: Tải file ZIP đã đóng gói
- `cookies`: Đọc cookie để xác thực khi tải ảnh từ trang web do người dùng cấu hình
- `declarativeNetRequest`: Thiết lập header Referer phù hợp khi tải ảnh
- `scripting`: Chạy script phát hiện cấu trúc trang trên tab đang hoạt động
- `offscreen`: Hỗ trợ tải nội dung trong nền

---

## English

Manga Downloader **does not collect, store, or transmit any personal data** externally.

### Locally Stored Data
- **Website configurations**: CSS selectors and URLs configured by the user, stored in `chrome.storage.local`.
- **Diagnostic logs**: Error events stored locally (max 120 events, auto-deleted after 14 days) for debugging. Never sent to external servers.
- **Search state**: Recent search results cached locally for better UX.

### Data NOT Collected
- No browsing history tracking
- No analytics or telemetry
- No third-party data sharing
- No tracking cookies

### Extension Permissions
- `storage`: Store configurations and logs locally
- `downloads`: Download packaged ZIP files
- `cookies`: Read cookies for authentication when downloading images from user-configured sites
- `declarativeNetRequest`: Set appropriate Referer headers for image downloads
- `scripting`: Run page structure detection scripts on the active tab
- `offscreen`: Support background content loading
