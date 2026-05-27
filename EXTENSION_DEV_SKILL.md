---
name: chrome-extension-mv3-dev
description: Security and engineering rules for developing Chrome Extensions in Manifest V3. Focuses on lifecycle management of ephemeral service workers, secure messaging architecture, DOM bridge isolation, safe DOM parsing, header modification rules via Declarative Net Request, and diagnostic logging constraints. Use when coding background scripts, content scripts, popup behaviors, messaging handlers, or DNR rules.
---

# Chrome Extension Manifest V3 Development Guidelines

Tài liệu này cung cấp các tiêu chuẩn kỹ thuật, kiến trúc bảo mật và quy trình phát triển Chrome Extension theo chuẩn Manifest V3 (MV3) mới nhất.

---

## 1. Vòng đời của Service Worker trong MV3

Manifest V3 không còn hỗ trợ các Background Pages chạy ngầm liên tục (persistent background pages). Thay vào đó, nó sử dụng **Service Workers** chạy bất đồng bộ và tự động tắt (idle termination) khi không hoạt động.

### 1.1 Khôi phục trạng thái (State Persistence)
* **Quy tắc**: Không bao giờ lưu trữ các biến trạng thái quan trọng vào bộ nhớ RAM của Service Worker (`background.js`) mà không có giải pháp khôi phục. Service Worker có thể bị tắt bất kỳ lúc nào khi người dùng không tương tác.
* **Giải pháp**: Luôn lưu trạng thái làm việc (như cấu hình hiện tại, danh sách đang tải, cờ bật/tắt...) vào `chrome.storage.local`. Khi Service Worker thức dậy (wakes up), hãy đọc lại dữ liệu này từ storage để khôi phục trạng thái cũ.

### 1.2 Đăng ký sự kiện (Event Listener Registration)
* Tất cả các Listener như `chrome.runtime.onMessage.addListener` hoặc `chrome.runtime.onInstalled.addListener` phải được đăng ký đồng bộ trực tiếp ở luồng chạy chính của Service Worker khi khởi chạy. Tránh đăng ký listener bên trong các hàm callback bất đồng bộ vì khi Service Worker thức dậy từ sự kiện mới, các callback đó chưa chắc đã được thực thi để đăng ký listener.

---

## 2. Giao tiếp và Bảo mật Tin nhắn (Message Security)

### 2.1 Xác thực nguồn gửi (Sender Verification)
* **Nguy cơ**: Trang web độc hại có thể gửi tin nhắn giả mạo đến Extension ID của bạn để kích hoạt các hành động tải file hoặc đánh cắp dữ liệu.
* **Giải pháp**: Luôn kiểm tra `sender.id` trong tất cả các Message Listener của background và popup:
  ```javascript
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Chỉ nhận tin nhắn từ nội bộ Extension
    if (sender.id !== chrome.runtime.id) {
      console.warn("Cảnh báo: Phát hiện tin nhắn từ nguồn không xác định!");
      return false; 
    }
    // Xử lý logic...
  });
  ```

### 2.2 An toàn DOM Bridge (Content Script & Web Page Isolation)
* **Nguy cơ**: Trang web đọc truyện chạy trong môi trường `MAIN` world (nơi các script của website và quảng cáo độc hại có quyền chạy). Content script chạy ở môi trường `ISOLATED` world. Nếu ta truyền dữ liệu thô hoặc chạy `eval` qua lại sẽ gây lỗi bảo mật.
* **Giải pháp**: 
  * Truyền dữ liệu thông qua một thẻ `<script type="application/json">` ẩn được chèn vào DOM (gọi là DOM Bridge).
  * Chỉ dùng cầu nối này để truyền mảng liên kết ảnh thô (không truyền mã JS).
  * Ở đầu nhận (`content.js`), chạy `JSON.parse` và kiểm tra kỹ: giới hạn số phần tử (ví dụ tối đa 500 ảnh), kiểm tra giao thức của từng link bắt buộc phải là `http:` hoặc `https:`.

---

## 3. Chỉnh sửa Header và DNR Rules (Declarative Net Request)

Manifest V3 thay thế API sửa đổi header cũ (`chrome.webRequest`) bằng API Declarative Net Request (`chrome.declarativeNetRequest`) an toàn và bảo mật hơn.

### 3.1 Dynamic Rules (Luật động)
* Khi cần tải ảnh vượt rào bảo vệ (hotlink protection) bằng cách giả mạo Header Referer:
  * Sử dụng `chrome.declarativeNetRequest.updateSessionRules` để tạo các luật tạm thời ở cấp độ Session.
  * Đảm bảo chỉ cấp quyền sửa đổi referer cho các domain được cấu hình cụ thể, tránh sửa đổi trên toàn bộ các trang web khác của người dùng.
  * Luôn dọn dẹp (xóa bỏ) rules sau khi tải xong bằng khối lệnh `finally {}`.
  * Gán ID luật động tự tăng thông qua bộ đếm (ví dụ: `ruleId++`) để tránh xung đột đè ID khi tải song song nhiều tab.

---

## 4. An toàn khi phân tích cú pháp DOM thô (DOM Scraping)

Khi tải dữ liệu HTML thô để tìm kiếm truyện hoặc thông tin:
* **Không dùng innerHTML**: Khi nạp HTML thô để parse (ví dụ dùng `DOMParser`), không bao giờ chèn chuỗi HTML này trực tiếp vào giao diện popup bằng `innerHTML` vì trang web đó có thể chứa mã script độc hại (XSS).
* **Sử dụng bộ trích xuất regex an toàn**: Trích xuất dữ liệu bằng regex (như tên truyện, ảnh bìa, liên kết) hoặc dùng `DOMParser` chỉ để đọc giá trị văn bản (`textContent`) hoặc giá trị thuộc tính (`getAttribute`).

---

## 5. Nhật ký chẩn đoán & Quyền riêng tư (Privacy & Diagnostics)

* **Giới hạn dung lượng**: Nhật ký chẩn đoán lỗi lưu cục bộ (Diagnostics) không được vượt quá 120 dòng hoặc 250KB để tránh làm đầy bộ nhớ Chrome Storage.
* **Tự động xóa**: Thiết lập thời gian tự động xóa nhật ký cũ (ví dụ: sau 14 ngày).
* **Ẩn danh dữ liệu (Anonymization)**: Trước khi ghi log lỗi, hãy lọc và xóa bỏ (redact) các dữ liệu nhạy cảm như token, cookies, email, mật khẩu hoặc các tham số truy vấn nhạy cảm trên URL.
