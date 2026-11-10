# Kế hoạch xây dựng hệ thống quản lý lớp học

## 1. Mục tiêu và giả định

Xây dựng ứng dụng web dùng tốt trên máy tính và điện thoại, gồm website marketing công khai và khu vực quản lý có đăng nhập, dùng database chung để quản lý học viên, phụ huynh, giáo viên, giáo vụ, lớp học và khóa học.

### Quyết định đã thống nhất

- Mỗi học sinh một tài khoản, phụ huynh dùng chung với học sinh đó. Quản lý cấp tài khoản khi tuyển sinh; khách không tự đăng ký.
- Đăng nhập bằng tên riêng/mã học sinh; email phụ huynh để kích hoạt/khôi phục được phép trùng giữa các con.
- Guest xem khóa học và gửi form tư vấn cho quản lý tiếp nhận; gửi form không tự tạo tài khoản.
- Học phí là tổng tiền toàn khóa, chia thành nhiều đợt thanh toán, có thể trả từng phần.
- Offline/online và nhóm/kèm 1–1 là hai thuộc tính độc lập. Online dùng link Zoom/Google Meet bên ngoài, không tích hợp video.
- Làm và kiểm thử local trước; dự kiến chạy thật trên VPS với PostgreSQL tự quản lý.
- Khóa học chia hai nhóm: **Năng khiếu** (nhạc: piano…) và **Kỹ năng** (cờ vua…). Cách xếp cờ vua vào Kỹ năng đang là giả định, chờ xác nhận.
- Học sinh nộp bài bằng video; giáo viên xem, chấm, nhận xét, yêu cầu nộp lại. Video lưu trên ổ đĩa máy chủ, backup cùng database.
- Giáo viên điểm danh từng buổi, sửa trong 48 giờ; quá hạn thì giáo vụ/quản lý sửa kèm lý do. Điểm danh là căn cứ tính giờ dạy để trả lương, tách giờ thường / tối (từ 18:00) / cuối tuần. Đơn giá và phụ cấp do quản lý tự nhập (có ngày áp dụng, chung hoặc riêng từng giáo viên); con số cụ thể chốt sau.

Giả định để ước lượng:
- Ban đầu có một trung tâm, một chi nhánh, khoảng 100–1.000 học viên; chưa có yêu cầu tải lớn hoặc hoạt động liên tục 24/7.
- Một lập trình viên full-stack có kinh nghiệm làm khoảng 35–40 giờ/tuần; chủ trung tâm dành 2–4 giờ/tuần để xác nhận nghiệp vụ.
- Có người kiểm thử bán thời gian, nhất là giai đoạn nghiệm thu. Nếu lập trình viên tự làm toàn bộ kiểm thử, cần tăng thời gian.
- Giao diện tiếng Việt, múi giờ nghiệp vụ Asia/Ho_Chi_Minh; tiền học phí tính bằng VND.

Các file Markdown mô tả yêu cầu, không lưu dữ liệu học viên thật, mật khẩu hay học phí phát sinh. Dữ liệu vận hành nằm trong database; file đính kèm nằm trong kho lưu trữ riêng.

### Tiến độ hiện tại

Bản MVP đã chạy được ở local (xem [README](README.md)): website marketing, đăng nhập và phân quyền 4 vai trò, thêm/sửa/ngừng hoạt động khóa, lớp, lịch, giáo viên, học sinh, tài khoản; ghi danh; điểm danh và nhận xét; đơn xin nghỉ; tiến độ và nhận xét từng học sinh; thông báo trong ứng dụng; chặn trùng giáo viên/phòng; bài tập video; học phí chia đợt; tổng hợp giờ dạy và lương tạm tính theo đơn giá quản lý nhập (CSV); nhật ký. Có cấu hình demo công khai trên Render. Có unit/integration test trên PostgreSQL thật và e2e desktop + mobile.

Còn lại trước khi chạy thật: nhập đơn giá lương thật, gửi thông báo qua email/Zalo, khôi phục mật khẩu, MFA cho quản lý, triển khai VPS + backup (mục 8), nhập dữ liệu thật và nghiệm thu (mục 11).

## 2. Vai trò và tài liệu chức năng

| Nhóm | Chức năng chính | Đặc tả |
|---|---|---|
| Guest | Xem website marketing, khóa công khai và gửi yêu cầu tư vấn | [Guest](docs/roles/guest.md) |
| Học viên / phụ huynh | Dùng chung tài khoản của một học sinh để xem lịch, điểm danh, nhận xét, nộp video bài tập, xem học phí | [Học viên và phụ huynh](docs/roles/hoc-vien-phu-huynh.md) |
| Giáo viên | Xem lớp được phân công, điểm danh, nhận xét, giao và chấm bài tập video, xem giờ dạy | [Giáo viên](docs/roles/giao-vien.md) |
| Giáo vụ | Quản lý hồ sơ, tuyển sinh, xếp lớp, lịch học, ghi nhận thu học phí, tổng hợp giờ dạy tính lương | [Giáo vụ](docs/roles/giao-vu.md) |
| Quản lý | Quản trị tài khoản, phân quyền, phê duyệt và báo cáo | [Quản lý](docs/roles/quan-ly.md) |

Một nhân sự có thể có nhiều vai trò nhưng phải dùng tài khoản cá nhân riêng. Hồ sơ học sinh tiềm năng có thể chưa có tài khoản; quản lý cấp khi tuyển sinh và dùng lại tài khoản đó cho khóa sau. Hồ sơ học sinh và phụ huynh lưu riêng; một phụ huynh có hai con sẽ dùng hai tài khoản. Nhật ký không phân biệt phụ huynh hay học sinh là người thao tác trên tài khoản dùng chung; cũng không thể ẩn học phí khỏi một trong hai người.

## 3. Phạm vi MVP — phiên bản đầu có thể vận hành

### A. Tài khoản và phân quyền
- Đăng nhập bằng tên riêng/mã học sinh và mật khẩu, đặt lại mật khẩu, khóa tài khoản, đăng xuất và thu hồi phiên khi cần.
- Quản lý tạo tài khoản; không mở đăng ký tự do hoặc cho giáo vụ tự cấp tài khoản học sinh trong MVP.
- Email phụ huynh không là định danh duy nhất; khôi phục phải xác định đúng tài khoản và xác minh liên hệ, không tự gộp các con theo email.
- Phân quyền tại backend theo vai trò và phạm vi dữ liệu, không chỉ ẩn nút trên giao diện.
- Nhật ký thao tác quan trọng: đổi quyền, sửa hồ sơ, thay lịch, ghi nhận hoặc hủy thu tiền.

### B. Hồ sơ và tuyển sinh
- Thêm, xem, sửa, tìm kiếm và lưu trữ hồ sơ học viên, phụ huynh, giáo viên.
- Một học viên có thể có nhiều phụ huynh; một phụ huynh có thể quản lý nhiều con.
- Trạng thái học viên: tiềm năng, đang học, tạm nghỉ, ngừng học.
- Hồ sơ tối thiểu: họ tên, thông tin liên hệ cần thiết, ngày sinh nếu cần, ghi chú nghiệp vụ và người liên hệ.
- Một công cụ nhập danh sách học viên bằng mẫu CSV, kiểm tra dữ liệu, báo lỗi theo dòng và xác nhận trước khi ghi; xuất dữ liệu theo quyền.

### C. Khóa học, lớp và lịch
- Khóa học là chương trình: tên, cấp độ, số buổi dự kiến, mức học phí tham khảo.
- Lớp là một nhóm học cụ thể thuộc khóa học: giáo viên, sức chứa, thời gian bắt đầu/kết thúc, phòng học và trạng thái.
- Lớp có hình thức offline/online và mô hình nhóm/1–1 độc lập; lớp 1–1 tối đa một học viên đang ghi danh. Online không bắt buộc phòng nhưng vẫn kiểm tra trùng giáo viên/học viên.
- Link Zoom/Google Meet chỉ hiển thị cho người có quyền, không xuất hiện trong nội dung marketing hoặc log.
- Ghi danh liên kết học viên với lớp: ngày tham gia, trạng thái, học phí áp dụng.
- Lịch lặp theo tuần sinh ra các buổi học cụ thể để có thể đổi hoặc hủy từng buổi.
- Kiểm tra trùng lịch giáo viên, phòng và học viên; không cho vượt sĩ số khi ghi danh.
- Xem lịch theo tuần; thông báo thay đổi trong ứng dụng.
- MVP hỗ trợ rút khỏi lớp và ghi danh lớp khác có lưu lịch sử; bảo lưu, chuyển phí và học bù tự động để giai đoạn sau.

### D. Điểm danh và tiến độ
- Điểm danh theo buổi: có mặt, vắng có phép, vắng không phép, đi muộn.
- Phân biệt “chưa điểm danh” với “vắng”; tránh tính nhầm các buổi chưa có dữ liệu.
- Nhận xét ngắn cho từng học viên; xác định rõ ghi chú nội bộ và nội dung được chia sẻ cho phụ huynh.
- Giáo viên sửa trong thời hạn được chốt trước khi phát triển; quá hạn cần giáo vụ hoặc quản lý xử lý và có nhật ký.

### E. Học phí cơ bản
- Chốt tổng học phí toàn khóa trên từng ghi danh và chia thành nhiều đợt có hạn thanh toán; không thu theo tháng hoặc tự tính phí riêng từng giai đoạn.
- Tổng các đợt bằng tổng phí toàn khóa; tổng khóa không được cộng thêm lần nữa vào khoản phải thu.
- Ghi nhận thanh toán tiền mặt/chuyển khoản thủ công; phân bổ vào một hoặc nhiều đợt, không nhận vượt dư nợ trong MVP.
- Hỗ trợ trả nhiều lần; theo dõi đã thu và còn nợ.
- Lưu số tiền theo đơn vị đồng, không dùng số thực; cập nhật giao dịch bằng transaction để tránh ghi nhận hai lần.
- Phiếu thu nội bộ không thay thế hóa đơn điện tử hợp pháp.
- Không sửa/xóa giao dịch tiền đã xác nhận: hủy hoặc điều chỉnh có lý do và phân quyền; tiền hoàn chỉ ghi nhận sau phê duyệt.
- Chưa có kết nối ngân hàng, cổng thanh toán, kế toán hoặc hóa đơn điện tử trong MVP.

### F. Báo cáo và cổng phụ huynh
- Dashboard: học viên đang học, lớp đang mở, tỷ lệ chuyên cần, số tiền đã thu và công nợ.
- Báo cáo cơ bản theo khoảng ngày, lớp và khóa; thống nhất cách tính trước khi làm.
- Phụ huynh/học viên dùng cùng tài khoản xem lịch, điểm danh, nhận xét được chia sẻ và học phí của đúng một học sinh.
- Thông báo trong ứng dụng; email giao dịch dùng để mời tài khoản và đặt lại mật khẩu.

### G. Website marketing và tư vấn
- Trang chủ, giới thiệu, liên hệ, danh sách và chi tiết khóa đã xuất bản; quản lý chỉnh nội dung có cấu trúc, không có CMS kéo-thả.
- Form gồm tên người liên hệ, điện thoại, khóa quan tâm và ghi chú tùy chọn; có thông báo mục đích sử dụng dữ liệu.
- Kiểm tra đầu vào tại server, giới hạn tần suất và chống bot; chỉ báo gửi thành công sau khi lưu được vào database.
- Quản lý xử lý yêu cầu mới/đang liên hệ/đã tuyển sinh/đóng; chuyển thành hồ sơ cần xác nhận và kiểm tra trùng.
- Tách mức phí marketing khỏi học phí chốt riêng của ghi danh. Không công khai danh sách học viên, công nợ, dữ liệu tư vấn hoặc link học online.

### Quy tắc thêm, sửa, xóa
- Tạo mới và chỉnh sửa dữ liệu theo quyền của từng vai trò.
- Chỉ xóa hẳn bản ghi tạo nhầm chưa có quan hệ phụ thuộc, theo quyền quản lý.
- Hồ sơ đã có lịch sử dùng ngừng hoạt động/lưu trữ; lớp dùng kết thúc/hủy, không xóa dây chuyền lịch sử.
- Hồ sơ phụ huynh/học viên không được tự đổi liên kết gia đình.
- Yêu cầu xóa dữ liệu cá nhân được xử lý riêng theo chính sách lưu giữ và nghĩa vụ áp dụng, không giữ mọi thứ vô thời hạn.

## 4. Để sau MVP

- Tự đăng ký tài khoản/ghi danh trực tuyến, tài khoản gia đình nhiều con, CRM và chăm sóc khách hàng tự động. Form tư vấn công khai đã thuộc MVP.
- Zalo OA, SMS, thông báo đẩy, thanh toán trực tuyến, đối soát ngân hàng.
- Học bù, bảo lưu, chuyển phí, gói học linh hoạt và nhiều mô hình học phí.
- Tính lương giáo viên, hoa hồng, chi phí và lợi nhuận kế toán.
- Nhiều chi nhánh, quản lý thiết bị, học liệu/video, ứng dụng di động riêng.

Mỗi tính năng bổ sung cần ước lượng lại; không mặc định nằm trong timeline bên dưới.

## 5. Kiến trúc đề xuất

### Chọn một ứng dụng nguyên khối có phân module

Với quy mô ban đầu, đề xuất:
- Frontend và backend: Next.js + TypeScript. Backend chạy trên Node.js, cung cấp các endpoint và kiểm tra quyền phía máy chủ.
- Database: PostgreSQL; Prisma quản lý truy vấn có kiểu dữ liệu và migration.
- Giao diện: bộ component có sẵn, ưu tiên form, bảng và lịch dễ dùng trên điện thoại.
- Triển khai: Docker Compose trên một VPS Linux; reverse proxy Caddy hoặc Nginx cung cấp HTTPS.
- Email: dịch vụ email giao dịch; file đính kèm nếu phát sinh dùng object storage tương thích S3.
- Kiểm thử theo công cụ phù hợp phiên bản đã chọn: unit/integration và kiểm thử trình duyệt cho luồng quan trọng.

Đây là đề xuất công nghệ, chưa cài đặt hay cố định phiên bản. Chốt phiên bản ổn định còn được hỗ trợ khi bắt đầu xây dựng.

```text
Máy tính / điện thoại
        |
        | HTTPS: app.ten-trung-tam.vn
        v
Reverse proxy trên VPS
        |
        v
Ứng dụng Next.js / Node.js
   |         |             |
   v         v             v
PostgreSQL  Email      Object storage
   |
   v
Backup mã hóa sang nơi lưu trữ độc lập
```

Không cần tách riêng NestJS hoặc microservices ngay từ đầu. Backend vẫn tồn tại trong ứng dụng Next.js và chạy liên tục trên VPS, không phụ thuộc việc máy cá nhân của chủ trung tâm đang bật.

PostgreSQL có thể cùng VPS để tiết kiệm; khi đó VPS hỏng sẽ ảnh hưởng cả ứng dụng và database. Nếu ngân sách cho phép, dùng PostgreSQL được quản lý để giảm việc tự vận hành. Chỉ tách thêm dịch vụ khi có nhu cầu đo được.

Database tự quản lý nghĩa là cài PostgreSQL trên máy chủ mình thuê và tự chịu trách nhiệm cập nhật, bảo mật, backup, giám sát, khôi phục; không phải lưu dữ liệu trong file Markdown hay chỉ trên máy cá nhân. Giai đoạn phát triển dùng PostgreSQL local qua Docker. Chưa cần mua VPS/tên miền để bắt đầu.

## 6. Database chung: cấu trúc khởi đầu

| Nhóm bảng | Mục đích / quan hệ |
|---|---|
| users, roles, user_roles, sessions, password_reset_tokens | Tài khoản, vai trò, phiên đăng nhập và token một lần có hạn dùng |
| students, parents, student_parents | Hồ sơ và quan hệ nhiều–nhiều phụ huynh/học viên |
| course_offerings, consultation_requests | Lựa chọn khóa công khai theo hình thức/mô hình và yêu cầu tư vấn riêng tư |
| teachers | Hồ sơ giáo viên, liên kết tài khoản nếu có |
| courses, classes, rooms, class_teachers | Chương trình, lớp, phòng và phân công giáo viên |
| enrollments | Học viên ghi danh lớp, lưu mức phí áp dụng và lịch sử trạng thái |
| class_schedules, lessons | Lịch lặp và từng buổi cụ thể; lessons có giáo viên/phòng thực tế và trạng thái |
| attendance, progress_notes | Điểm danh và nhận xét theo học viên/buổi |
| installment_charges, payments, payment_allocations, payment_adjustments | Đợt phải thu thuộc tổng học phí ghi danh, tiền nhận, phân bổ và điều chỉnh/hủy có dấu vết |
| notifications, notification_recipients | Nội dung thông báo và trạng thái đọc của từng người nhận |
| audit_logs | Ai thao tác, lúc nào, đối tượng nào, thay đổi gì; không ghi mật khẩu/token |

Các ràng buộc quan trọng:
- Dùng khóa ngoại; không cho xóa bản ghi cha khi còn lịch sử phụ thuộc.
- Mỗi học viên chỉ có một ghi danh cho cùng lớp trong MVP; tái tham gia cập nhật trạng thái và ghi lịch sử.
- Điểm danh duy nhất theo buổi học và học viên.
- Tên đăng nhập duy nhất; tài khoản học sinh gắn tối đa một học sinh và mỗi học sinh tối đa một tài khoản. Email liên hệ phụ huynh không duy nhất.
- Ngăn trùng lịch/vượt sĩ số cả khi hai nhân viên thao tác đồng thời, không chỉ kiểm tra trên giao diện.
- Phân bổ thanh toán không vượt số tiền nhận hoặc khoản phải thu; ngăn gửi lặp khi người dùng bấm hai lần.
- Lưu thời gian nhất quán, hiển thị theo múi giờ trung tâm; lịch lặp phải gắn múi giờ.
- Thay đổi mức phí khóa học không tự làm thay đổi học phí các ghi danh đã xác nhận.

Sơ đồ ERD và trường dữ liệu chi tiết là đầu ra của giai đoạn thiết kế, sau khi chốt nghiệp vụ.

## 7. Timeline tham khảo ban đầu

Bảng dưới là ước lượng nhân sự ở phiên bản kế hoạch đầu, chưa phải cam kết bàn giao. Phạm vi mới có marketing/form tư vấn, tài khoản chung và phí toàn khóa nhiều đợt; cần đánh giá lại sau khi thiết kế chi tiết. Triển khai thực tế theo các mốc có demo: nền tảng local → xác thực → marketing/tuyển sinh → lịch/điểm danh → học phí/cổng học sinh → nghiệm thu → production.

Đơn vị là tuần làm việc tính từ lúc bắt đầu và có đủ thông tin nghiệp vụ, không phải cam kết ngày bàn giao. Các mốc có thể điều chỉnh sau tuần 1.

| Thời gian | Công việc | Đầu ra / điều kiện hoàn thành |
|---|---|---|
| Tuần 1 | Khảo sát quy trình, chính sách phí, phân quyền, dữ liệu hiện có; chốt MVP | Luồng nghiệp vụ và tiêu chí nghiệm thu được người phụ trách xác nhận |
| Tuần 2 | Thiết kế giao diện, ERD, kiến trúc; dựng môi trường local/staging, migration và CI | Duyệt màn hình chính; ứng dụng mẫu chạy HTTPS trên staging |
| Tuần 3–4 | Đăng nhập, phân quyền, tài khoản, học viên/phụ huynh/giáo viên, khóa/lớp, nhập CSV | CRUD và lưu trữ có kiểm tra dữ liệu; kiểm thử quyền truy cập chéo |
| Tuần 5–6 | Ghi danh, lịch, phòng, kiểm tra xung đột, điểm danh và nhận xét | Chạy trọn luồng tạo lớp → xếp lịch → ghi danh → điểm danh |
| Tuần 7–8 | Học phí cơ bản, phiếu thu, báo cáo, cổng phụ huynh và thông báo | Số tiền báo cáo khớp dữ liệu mẫu; phụ huynh chỉ xem đúng phạm vi |
| Tuần 9 | Kiểm thử tích hợp, trình duyệt, tải, backup/restore; chỉnh lỗi | Hoàn thành bộ kiểm thử và diễn tập khôi phục |
| Tuần 10 | Người dùng nghiệm thu, nhập thử dữ liệu, đào tạo, chạy thử 1–2 lớp | Người phụ trách ký duyệt; có quy trình vận hành và rollback |
| Tuần 11–12 | Dự phòng lỗi, làm sạch dữ liệu, triển khai thật và theo dõi | Chuyển vận hành sau khi đối soát; bàn giao mã nguồn, tài khoản, hướng dẫn |

Không đợi cuối dự án mới kiểm thử: mỗi đợt chức năng phải có test và demo. Nếu chỉ làm bán thời gian khoảng 15–20 giờ/tuần, dự trù khoảng 5–7 tháng. Nếu phải khảo sát lại nghiệp vụ hoặc chuyển nhiều dữ liệu bẩn, cần ước lượng thêm.

## 8. Tên miền và backend chạy như thế nào?

### Các thứ cần mua / tạo
1. Tên miền do trung tâm đứng tên và giữ tài khoản, ví dụ tên thương hiệu với đuôi `.vn`, `.com.vn` hoặc `.com`; kiểm tra khả dụng và phí gia hạn.
2. VPS Linux: khởi điểm tham khảo 2–4 vCPU, RAM 4–8 GB, SSD 60–100 GB; cần đo tải để chọn thực tế. Không build image nặng ngay trên máy production nhỏ.
3. Nơi nhận backup độc lập với VPS; object storage nếu cần lưu tài liệu.
4. Dịch vụ email giao dịch; cấu hình SPF, DKIM, DMARC theo nhà cung cấp.
5. Kho mã nguồn riêng, CI/CD và nơi theo dõi lỗi/uptime.

### Luồng triển khai
1. Tạo VPS, khóa SSH, cập nhật bảo mật, firewall; chỉ mở cổng web và giới hạn đường quản trị.
2. Trỏ DNS `app` về VPS; thêm tên miền staging riêng. Có thể dùng nhà quản lý DNS miễn phí.
3. Reverse proxy cấp/gia hạn chứng chỉ TLS tự động; mọi truy cập đăng nhập dùng HTTPS.
4. CI chạy kiểm thử, build image; người có quyền phê duyệt triển khai production.
5. Cấu hình secrets ngoài Git; database không mở cổng công khai ra Internet.
6. Sao lưu trước thay đổi dữ liệu, chạy migration tương thích, triển khai ứng dụng và kiểm tra health check.
7. Kiểm tra đăng nhập, quyền, lịch và học phí; chỉ chuyển người dùng thật sau khi nghiệm thu.

Web giới thiệu trung tâm có thể dùng tên miền gốc; ứng dụng quản lý dùng tên miền con `app`. Một ứng dụng web đã đủ cho giai đoạn đầu, chưa cần mua tài khoản App Store/Google Play.

### Vận hành bắt buộc
- Tách local, staging, production; không sao chép dữ liệu trẻ em thật vào môi trường thử nghiệm nếu chưa có biện pháp phù hợp.
- Tự khởi động lại ứng dụng khi lỗi, health check, theo dõi CPU/RAM/disk và cảnh báo website ngừng hoạt động.
- Backup database hằng ngày sang nơi khác, mã hóa và giới hạn quyền; chính sách khởi điểm giữ 7 bản ngày và 4 bản tuần.
- Nếu có file đính kèm, sao lưu/versioning cả file và metadata tương ứng.
- Kiểm tra backup thành công và diễn tập restore hằng tháng; có backup nhưng chưa thử restore chưa được coi là an toàn.
- Mục tiêu ban đầu: có thể mất tối đa 24 giờ dữ liệu (RPO), khôi phục trong 4–8 giờ (RTO), cần kiểm chứng bằng diễn tập. Nếu không chấp nhận mất dữ liệu thu tiền trong ngày, cần backup liên tục/PITR và dự toán lại.
- Cập nhật thư viện, bản vá hệ điều hành định kỳ; chỉ định người trực xử lý sự cố và người thay thế.
- Rollback code không đồng nghĩa rollback database; migration cần kế hoạch tương thích và khôi phục riêng.
- Tên miền, VPS, database, kho mã nguồn và email đều thuộc tài khoản trung tâm; bật MFA cho tài khoản quản trị hạ tầng.

## 9. Dự trù chi phí

Khoảng ngân sách tham khảo bằng VND để lập kế hoạch tại thời điểm tháng 11/2026, chưa kiểm tra bảng giá trực tiếp. Giá thật phụ thuộc nhà cung cấp, VAT, tỷ giá, vùng máy chủ, khuyến mãi và phí gia hạn.

### Chi phí vận hành

| Hạng mục | Dự trù |
|---|---:|
| Tên miền | 300.000–1.200.000/năm |
| VPS cho ứng dụng và PostgreSQL tự quản lý | 400.000–1.200.000/tháng |
| Backup / object storage | 50.000–300.000/tháng |
| Email giao dịch | 0–300.000/tháng ở lượng gửi thấp |
| Theo dõi lỗi, uptime, CI/CD | 0–300.000/tháng ở quy mô nhỏ |
| PostgreSQL managed, nếu thay database tự quản lý | Cộng khoảng 400.000–1.500.000/tháng; cần báo giá cụ thể |
| HTTPS | Có thể miễn phí, không bắt buộc mua chứng chỉ |

Phương án gọn tự quản lý database: khoảng **500.000–2.200.000/tháng**, cộng tên miền theo năm; mức cộng dồn cao nhất của các mục có thể lớn hơn khoảng này. Nếu dùng database managed, dự trù khoảng **1–4 triệu/tháng** tùy cấu hình. Chưa tính staging chạy thường trực, công vận hành, SMS/Zalo, phí thanh toán hoặc lưu video. Gói miễn phí chỉ dùng nếu điều khoản phù hợp, không coi là cam kết lâu dài.

### Chi phí xây dựng và bảo trì
- Ví dụ lập ngân sách thuê: 400–480 giờ phát triển × 200.000–400.000/giờ = khoảng **80–192 triệu** tiền phát triển; không phải báo giá thị trường đã xác minh.
- Nếu chưa nằm trong đơn giá: kiểm thử bán thời gian, thiết kế và nhập/làm sạch dữ liệu có thể cần thêm khoảng 10–30 triệu.
- Có thể dành khoảng 100–220 triệu cho dự án MVP theo giả định trên; lấy báo giá theo đầu ra và phạm vi đã chốt, làm rõ VAT và phần dự phòng.
- Nếu tự xây, vẫn phải tính công phát triển, vận hành và hỗ trợ người dùng; chi phí hạ tầng không phải tổng chi phí hệ thống.
- Bảo trì sau bàn giao cần thỏa thuận riêng về số giờ/tháng, thời gian phản hồi, sửa lỗi, cập nhật và tính năng mới; không mặc định nằm trong tiền VPS.

## 10. An toàn và bảo vệ dữ liệu

- Thu thập tối thiểu dữ liệu cần dùng, đặc biệt dữ liệu trẻ em; chốt căn cứ xử lý, sự đồng ý khi cần và chính sách lưu giữ với người phụ trách phù hợp.
- Kiểm tra quy định bảo vệ dữ liệu cá nhân áp dụng tại thời điểm triển khai, cả việc dùng nhà cung cấp lưu dữ liệu ngoài Việt Nam; đây không phải tư vấn pháp lý.
- Mật khẩu băm bằng thuật toán chuẩn qua thư viện được duy trì; cookie phiên bảo mật, chống CSRF phù hợp cơ chế xác thực và giới hạn thử đăng nhập.
- MFA cho quản lý/giáo vụ có quyền tài chính; có quy trình khôi phục tài khoản được kiểm soát.
- Kiểm tra quyền đối tượng tại mọi endpoint, cả URL xem chi tiết, xuất báo cáo và tải file.
- Không đưa thông tin cá nhân nhạy cảm, mật khẩu hoặc token vào log; giới hạn quyền đọc audit log và bản sao lưu.
- Có quy trình cấp/thu hồi tài khoản khi nhân sự nghỉ việc, sửa liên kết phụ huynh và xử lý sự cố dữ liệu.

## 11. Điều kiện nghiệm thu

1. Hoàn thành luồng tạo khóa → mở lớp → thêm học viên/phụ huynh → ghi danh → xếp lịch → điểm danh → thu phí → xem báo cáo.
2. Phụ huynh A không đọc/sửa được dữ liệu học viên của phụ huynh B qua giao diện, API, xuất file hoặc đổi ID trên URL.
3. Giáo viên chỉ thao tác đúng lớp được phân công; giáo vụ không tự nâng quyền hoặc xóa lịch sử thu tiền.
4. Hai thao tác đồng thời không gây vượt sĩ số, trùng lịch hoặc ghi nhận thu tiền hai lần.
5. Kiểm thử khoản thu 1.000.000 đồng, thanh toán 400.000 rồi 600.000: dư nợ lần lượt là 600.000 và 0; hủy khoản thanh toán 600.000 theo quyền thì dư nợ trở lại 600.000, có nhật ký.
6. Ngừng hoạt động hồ sơ không mất điểm danh/học phí cũ; dữ liệu mẫu nhập và số tiền được đối soát trước go-live.
7. Tác vụ chính hoạt động trên màn hình điện thoại rộng khoảng 360 px và trình duyệt desktop thông dụng.
8. Mục tiêu tải khởi điểm: với dữ liệu giả lập 1.000 học viên, 100 lớp và 20 người dùng đồng thời, p95 API đọc thông thường dưới 1 giây trong bài thử 10 phút trên hạ tầng mục tiêu; không tính xuất báo cáo lớn/dịch vụ ngoài. Chốt lại theo tải thực tế, không coi là kết quả đã đo.
9. Khôi phục được bản sao lưu trên môi trường sạch trong mục tiêu đã chốt, có ghi nhận thời gian và đối chiếu dữ liệu.
10. Không còn lỗi nghiêm trọng chặn nghiệp vụ hoặc truy cập sai quyền; người phụ trách xác nhận vận hành và phương án quay lại khi triển khai lỗi.

## 12. Những quyết định cần chốt ở tuần đầu

- Số học viên, giáo viên, chi nhánh và lượng người dùng đồng thời dự kiến?
- Học nhóm, cá nhân hay cả hai; có phòng học, giáo viên thay thế, học thử không?
- Thu theo tháng, khóa hay số buổi; quy tắc nghỉ, học bù, giảm phí và hoàn tiền?
- Tài khoản học sinh dùng chung với phụ huynh đã chốt; còn cần quy trình hỗ trợ gia đình không có email đã xác minh.
- Giáo vụ có được thu tiền không; ai duyệt hủy thu/hoàn tiền và sửa điểm danh quá hạn?
- Hiện có Excel hoặc hệ thống cũ không; ai chịu trách nhiệm làm sạch và xác nhận dữ liệu?
- Có cần hóa đơn điện tử, Zalo, ngân hàng ngay khi ra mắt không?
- Ngân sách xây dựng, ngân sách vận hành, người bảo trì và ngày mong muốn chạy thật?

**Bước tiếp theo:** chốt các quyết định này, duyệt phạm vi MVP và bản mẫu màn hình trước khi phát triển. Chưa cần mua VPS production ngay; có thể giữ tên miền sớm sau khi chốt thương hiệu.
