# Hệ thống quản lý lớp học

Next.js + TypeScript, PostgreSQL tự quản lý, Prisma. Tham khảo [kế hoạch](PLAN.md) và [đặc tả vai trò](docs/roles/).

## Trạng thái

Bản MVP chạy được ở local và có thể dựng **bản demo công khai trên Render** với dữ liệu giả (xem [Demo trên Render](#demo-trên-render)). **Chưa triển khai production**: không nhập dữ liệu cá nhân thật cho tới khi hoàn tất các mục ở phần [Trước khi chạy thật](#trước-khi-chạy-thật).

| Khu vực | Đường dẫn | Chức năng |
|---|---|---|
| Khách | `/`, `/khoa-hoc` | Giới thiệu, danh sách khóa theo nhóm **Năng khiếu** (nhạc: piano…) và **Kỹ năng** (cờ vua…), form tư vấn |
| Quản lý / giáo vụ | `/quan-tri` | Thêm/sửa/xóa khóa, lớp, lịch buổi học, giáo viên, học sinh, ghi danh, tài khoản; xử lý tư vấn từ website; xem bài tập; theo dõi tiến độ và nhận xét từng học sinh; đơn xin nghỉ; chặn trùng giáo viên và trùng phòng; thu học phí theo đợt; tổng hợp giờ dạy và tiền lương tạm tính (xuất CSV); cài đặt đơn giá lương/phụ cấp (chỉ quản lý sửa); nhật ký thao tác (chỉ quản lý) |
| Giáo viên | `/giao-vien` | Lịch dạy, điểm danh và nhận xét từng buổi (sửa trong 48 giờ), giao bài tập, xem video học sinh nộp, chấm điểm/nhận xét/yêu cầu nộp lại, xem đơn xin nghỉ, theo dõi tiến độ và viết nhận xét định kỳ cho từng học sinh, xem giờ dạy của mình |
| Học sinh + phụ huynh | `/hoc-sinh` | Một tài khoản chung do trung tâm cấp: lịch học, gửi/rút đơn xin nghỉ, điểm danh và nhận xét, nộp video bài tập, xem kết quả chấm, học phí và các đợt đóng |

Phân quyền kiểm tra ở tầng service (không chỉ ẩn nút): giáo viên chỉ thấy lớp/buổi được phân công, học sinh chỉ thấy dữ liệu của mình, video chỉ người có quyền mới xem được.

Tính lương: mỗi buổi đã điểm danh được ghi nhận giờ dạy, tách giờ thường / buổi tối / cuối tuần (T7, CN). Quản lý nhập **đơn giá** ở `/quan-tri/luong`: lương/giờ, phụ cấp tối/giờ (và giờ bắt đầu buổi tối), phụ cấp cuối tuần/giờ, phụ cấp mỗi buổi; có đơn giá chung và đơn giá riêng từng giáo viên, mỗi đơn giá có ngày áp dụng nên đổi giá không làm thay đổi các tháng trước. Báo cáo giờ dạy và CSV hiện tiền tạm tính theo đơn giá này.

Thông báo trong ứng dụng (`/thong-bao`, số chưa đọc trên thanh menu): bài tập mới, bài nộp, kết quả chấm, đơn xin nghỉ, nhận xét, đổi/hủy buổi.

Chưa có: gửi email/Zalo, khôi phục mật khẩu qua email, thanh toán online, chốt/khóa bảng lương theo tháng, thưởng/khấu trừ, backup tự động và cấu hình production.

## Yêu cầu

- Node.js 24 LTS (tối thiểu 24.11), npm.
- Docker Desktop đang chạy.
- Cổng local 3000 cho web, 55432 cho PostgreSQL; kiểm thử trình duyệt dùng 3100.

## Chạy lần đầu

```bash
cp .env.example .env
docker compose up -d --wait db
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Seed tạo dữ liệu minh họa và các tài khoản demo (mật khẩu `demo12345`, **chỉ dùng local**):

| Tài khoản | Vai trò |
|---|---|
| `quanly` | Quản lý (ADMIN) |
| `giaovu` | Giáo vụ (STAFF) |
| `gv.lan`, `gv.minh` | Giáo viên |
| `hs0001`, `hs0002` | Học sinh/phụ huynh |

Đăng nhập tại <http://127.0.0.1:3000/dang-nhap>. Trên database thật không chạy seed; tạo quản lý đầu tiên bằng:

```bash
npm run user:create-admin -- <ten-dang-nhap> "<Tên hiển thị>"
```

Mật khẩu được nhập ẩn trong terminal; lệnh từ chối nếu đã có quản lý. Các tài khoản khác do quản lý/giáo vụ tạo trong giao diện, nhận mật khẩu tạm và bắt buộc đổi ở lần đăng nhập đầu.

Video bài tập lưu trong `STORAGE_DIR` (mặc định `./storage`), giới hạn `MAX_UPLOAD_MB` (mặc định 300 MB/file). **Thư mục này phải được backup cùng database.**

Mở <http://127.0.0.1:3000>. Dùng đúng địa chỉ này để gửi form vì kiểm tra Origin dựa trên `APP_URL`. Nếu đổi cổng hoặc dùng `localhost`, sửa `APP_URL` trong `.env` tương ứng và khởi động lại ứng dụng.

`.env` không được commit. Các giá trị mẫu chỉ dùng local, không phải thông tin xác thực production. Nếu đổi thông tin PostgreSQL sau khi volume đã được tạo, sửa `.env` không tự đổi người dùng/mật khẩu trong database có sẵn; cần đổi qua SQL có kiểm soát hoặc dùng database local mới.

Tên thương hiệu, nội dung, học phí và các khóa hiện tại đều là minh họa. Seed không xóa dữ liệu cũ hoặc ghi đè nội dung khóa đã tồn tại; không chạy trên database dùng thật.

Kiểm tra database:

```bash
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Dừng ứng dụng bằng Ctrl+C. Dừng PostgreSQL bằng `docker compose stop db`; dữ liệu vẫn nằm trong volume. Không dùng lệnh xóa volume nếu cần giữ dữ liệu.

## Kiểm thử

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

- `check`: lint → typecheck → unit/integration → production build.
- Integration test tạo schema ngẫu nhiên riêng, chạy migration thực tế rồi xóa đúng schema đó; không xóa dữ liệu ứng dụng. Tài khoản database kiểm thử cần quyền tạo schema. Không dùng database production cho bất kỳ bài test nào.
- E2E cần seed trước; tự build và chạy bản production tại cổng 3100, kiểm tra trên desktop và màn hình rộng 360 px. Bộ test tự tạo/xóa dữ liệu riêng và đi qua các luồng: cô lập vai trò, điểm danh → học sinh thấy nhận xét, nộp video → giáo viên chấm → học sinh nộp lại, tạo học sinh → cấp tài khoản → ghi danh → thu tiền.
- Integration test nghiệp vụ kiểm tra: ghi danh đồng thời không vượt sĩ số, thu tiền không trùng/không trả thừa, quyền và thời hạn điểm danh, trùng lịch giáo viên, quyền xem video, giới hạn đăng nhập sai.
- Kiểm tra dependency runtime: `npm audit --omit=dev`.
- TypeScript được pin 5.9.3 theo khả năng hỗ trợ của hệ công cụ Next.js/ESLint, không dùng bản TypeScript mới nhất nếu chưa được hệ công cụ hỗ trợ.
- ESLint giữ nhánh 9 do các plugin trong cấu hình Next.js hiện tại chưa khai báo hỗ trợ nhánh 10; npm có thể báo nhánh cũ ngừng hỗ trợ. Cần nâng đồng bộ khi bộ plugin tương thích, không ép bỏ qua peer dependency.
- Override hẹp `minimatch` từ nhánh 7–11.0.0 lên 11.0.5 cho dependency công cụ có cảnh báo GHSA-g3hv-75wg-m249; không thay nhánh 3.x của plugin cũ. Lint/typecheck/test/build cần tiếp tục qua khi cập nhật lockfile.

## Form tư vấn và dữ liệu

- Form chỉ nhận số di động Việt Nam, chuẩn hóa `+84` thành `0`; dữ liệu ghi chú hiển thị dưới dạng text, không phải HTML.
- Giới hạn trong cửa sổ 15 phút: 3 yêu cầu/số điện thoại, 5 yêu cầu/nguồn truy cập và 100 yêu cầu toàn hệ thống. Các giới hạn này là cấu hình bản thử nghiệm, cần chốt lại theo lưu lượng và bổ sung bảo vệ ở reverse proxy trước khi chạy thật.
- Local không tin các header IP do trình duyệt tự gửi; các lần gửi local dùng chung một nhóm giới hạn nguồn. Chờ hết cửa sổ nếu đạt giới hạn.
- Chỉ lưu HMAC định danh điện thoại/IP trong bảng giới hạn, không lưu IP thô. Secret HMAC không được dùng lại cho phiên hoặc mật khẩu.
- Trong production, API tư vấn từ chối hoạt động nếu chưa bật `TRUST_PROXY=true` và reverse proxy chưa đặt `X-Real-IP` hợp lệ. Proxy phải **ghi đè** header này và chặn đường truy cập trực tiếp tới ứng dụng; chỉ bật biến môi trường không đủ an toàn.
- API chỉ cho POST cùng Origin theo `APP_URL`, không cung cấp GET danh sách tư vấn công khai.
- Yêu cầu được lưu, chưa có email báo quản lý và chưa có nhân sự tiếp nhận. Chỉ báo thành công sau khi transaction hoàn tất.
- Nội dung quyền riêng tư hiện là thông báo thử nghiệm, phải được hoàn thiện và xác nhận trước dữ liệu thật.
- `robots.txt` chặn toàn bộ crawler trong giai đoạn thử nghiệm; chưa có sitemap production hoặc chiến dịch marketing thật.

## Demo trên Render

File [render.yaml](render.yaml) dựng sẵn 1 web service + 1 PostgreSQL miễn phí (vùng Singapore):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/khieuvm/music-management)

1. Đăng nhập [render.com](https://render.com) bằng GitHub, cho phép truy cập repo này.
2. **New → Blueprint**, chọn repo, bấm **Apply**. Render tự build (`npm ci && npm run build`), mỗi lần khởi động chạy migration + seed dữ liệu demo (`npm run start:demo`).
3. Mở link `https://<tên-service>.onrender.com`. Trang đăng nhập hiện danh sách tài khoản demo (mật khẩu `demo12345`).
4. Mỗi lần push lên nhánh chính, Render tự deploy lại.

`DEMO_MODE=true` bật các điều chỉnh cho demo công khai: hiện tài khoản demo, chặn đổi mật khẩu/khóa 6 tài khoản dùng chung, cho chạy seed ở production, form tư vấn dùng chung một giới hạn tần suất. Không bật biến này khi chạy thật.

Giới hạn gói miễn phí: web ngủ sau khoảng 15 phút không ai truy cập (lần mở đầu chờ khoảng 1 phút); video tải lên mất khi service khởi động lại (giới hạn 20 MB/video); database miễn phí hết hạn sau 30 ngày (tạo lại database rồi deploy lại là có dữ liệu demo mới).

## Trước khi chạy thật

- Thay toàn bộ secret trong `.env`, đổi mật khẩu PostgreSQL, không chạy seed, **không** bật `DEMO_MODE`.
- Reverse proxy (Caddy/Nginx) có HTTPS, ghi đè `X-Real-IP`, bật `TRUST_PROXY=true`, giới hạn body upload ≥ `MAX_UPLOAD_MB`, chặn truy cập trực tiếp cổng ứng dụng.
- Backup tự động database **và** `STORAGE_DIR`, diễn tập khôi phục.
- Hoàn thiện chính sách quyền riêng tư, bỏ chặn trong `robots.txt` khi sẵn sàng marketing.

## Lộ trình tiếp theo

1. Nhập đơn giá lương thật; nếu cần thêm thưởng/khấu trừ hoặc chốt bảng lương theo tháng thì bổ sung.
2. Nội dung thật cho trang giới thiệu (nhạc = Năng khiếu, cờ vua = Kỹ năng đã chốt).
3. Gửi thông báo qua email/Zalo, nhắc học phí, khôi phục mật khẩu.
4. Giáo viên dạy thay theo buổi, báo cáo tiến độ định kỳ cho phụ huynh.
5. Triển khai VPS, tên miền, backup, theo [kế hoạch](PLAN.md#8-tên-miền-và-backend-chạy-như-thế-nào).
