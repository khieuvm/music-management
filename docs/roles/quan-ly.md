# Vai trò: Quản lý

Tham chiếu: [Kế hoạch tổng thể](../../PLAN.md).

## Mục tiêu

Kiểm soát vận hành, quyền truy cập, công nợ và chất lượng dữ liệu của trung tâm.

## Quyền trong MVP

- Xem báo cáo tổng hợp học viên, lớp, chuyên cần, đã thu và công nợ.
- Thực hiện chức năng vận hành của giáo vụ.
- Tạo/mời/khóa tài khoản, cấp và thu hồi vai trò.
- Khi tuyển sinh, cấp một tài khoản tên riêng/mã học sinh cho mỗi học sinh để phụ huynh dùng chung; dùng lại tài khoản khi ghi danh khóa tiếp theo.
- Xác minh email liên hệ phụ huynh để kích hoạt/khôi phục; không gửi mật khẩu dùng lâu dài dạng rõ. Email có thể trùng giữa các con, không tự gộp tài khoản.
- Biên tập/xuất bản nội dung khóa học công khai; tiếp nhận và cập nhật trạng thái tư vấn. Chuyển yêu cầu tư vấn thành học viên cần xác nhận và kiểm tra trùng.
- Cấu hình danh mục, giới hạn quyền tài chính và chính sách vận hành đã nằm trong phạm vi MVP.
- Phê duyệt hủy/điều chỉnh thu tiền, ghi nhận hoàn tiền có lý do và lịch sử.
- Xem nhật ký thao tác, kiểm tra thay đổi điểm danh, lịch và học phí.
- Lưu trữ dữ liệu ngừng hoạt động; chỉ xóa hẳn dữ liệu tạo nhầm chưa có phụ thuộc.
- Phê duyệt việc xuất dữ liệu lớn và xử lý yêu cầu liên quan dữ liệu cá nhân.

## Giới hạn và kiểm soát

- Không có nút xóa toàn bộ lịch sử tài chính; quyền quản lý không bỏ qua quy tắc toàn vẹn dữ liệu.
- Quản lý không đọc được mật khẩu gốc hoặc token của người dùng.
- Ngăn khóa hoặc thu hồi vai trò của tài khoản quản lý hoạt động cuối cùng.
- Tài khoản quản lý ứng dụng không mặc nhiên có quyền SSH, database hoặc backup.
- Không gọi số tiền đã thu là lợi nhuận; MVP chưa có kế toán chi phí và lương.
- MFA được yêu cầu cho tài khoản quản lý; thao tác nhạy cảm có bước xác nhận.
- Nếu cần nguyên tắc hai người phê duyệt độc lập, phải bổ sung tài khoản/người duyệt và chốt phạm vi trước khi triển khai.

## Trách nhiệm ngoài phần mềm

- Chốt chính sách học phí, học bù, hoàn phí và thời hạn sửa điểm danh.
- MVP chốt tổng tiền toàn khóa và các đợt thanh toán; không thu theo tháng hoặc tính mỗi giai đoạn thành giá riêng.
- Chỉ định người xác minh liên kết phụ huynh và người đối soát thu tiền.
- Đứng tên và giữ tài khoản tên miền, máy chủ, email và kho mã nguồn.
- Xác nhận dữ liệu nhập ban đầu, kiểm tra báo cáo và duyệt go-live.
- Phân công vận hành, theo dõi backup, diễn tập khôi phục và xử lý sự cố.

## Đã triển khai (`/quan-tri`)

Toàn bộ chức năng của giáo vụ, cộng thêm:

1. Tạo tài khoản giáo vụ/quản lý; khóa/mở tài khoản (không khóa được quản lý cuối cùng). Quản lý đầu tiên tạo bằng `npm run user:create-admin`.
2. Hủy phiếu thu (giữ bản gốc, có lý do).
3. Nhật ký thao tác: ai, lúc nào, làm gì, lý do.

**Đơn giá lương** (`/quan-tri/luong`, chỉ quản lý sửa): lương/giờ, phụ cấp buổi tối/giờ và giờ bắt đầu buổi tối, phụ cấp cuối tuần/giờ, phụ cấp mỗi buổi; đơn giá chung hoặc riêng từng giáo viên, có ngày áp dụng. Báo cáo giờ dạy tự tính tiền tạm tính.

Chưa có: MFA, báo cáo tổng hợp chi tiết, chốt bảng lương theo tháng, thưởng/khấu trừ.

## Nghiệm thu riêng

- Thu hồi quyền có hiệu lực với yêu cầu tiếp theo của phiên đang đăng nhập.
- Hủy một thanh toán cập nhật đúng công nợ và báo cáo, giữ nguyên dấu vết bản gốc.
- Các thay đổi quyền và phê duyệt đều ghi rõ người thao tác, thời gian và lý do khi áp dụng.
- Có thể truy nguyên số tổng hợp đã thu về các giao dịch nguồn theo cùng bộ lọc thời gian.
