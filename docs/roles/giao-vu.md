# Vai trò: Giáo vụ

Tham chiếu: [Kế hoạch tổng thể](../../PLAN.md).

## Mục tiêu

Vận hành hồ sơ, tuyển sinh, lớp học, lịch học và học phí thường ngày.

## Quyền trong MVP

- Tạo, sửa, tìm kiếm, lưu trữ hồ sơ học viên/phụ huynh/giáo viên; không tự cấp quyền hệ thống.
- Xác minh và liên kết phụ huynh với học viên, có nhật ký.
- Tạo/sửa khóa, lớp, phòng, lịch; phân công giáo viên theo quyền được cấp.
- Nhập danh sách học viên từ CSV với kiểm tra dữ liệu; không ghi một phần âm thầm khi có lỗi.
- Ghi danh, rút khỏi lớp, ghi danh lớp mới; giữ lịch sử lớp cũ.
- Kiểm tra trùng lịch, sĩ số và cập nhật lịch hủy/đổi buổi; gửi thông báo đúng đối tượng.
- Theo dõi điểm danh và sửa quá hạn khi được cấp quyền, phải nêu lý do.
- Tạo khoản phải thu và ghi nhận thu tiền nếu được quản lý cấp quyền tài chính.
- Xem báo cáo vận hành/công nợ và xuất dữ liệu đúng phạm vi.
- Chuẩn bị hồ sơ tuyển sinh. **Bản hiện tại** cho giáo vụ cấp tài khoản học sinh/giáo viên (mật khẩu tạm); chỉ quản lý cấp tài khoản giáo vụ/quản lý. Nếu muốn chỉ quản lý cấp tài khoản học sinh, cần chốt lại và chỉnh quyền.

## Giới hạn

- Không tự nâng quyền, không cấp quyền quản lý, không thay đổi cấu hình bảo mật.
- Không xóa hẳn dữ liệu đã có lịch sử, không xóa/sửa trực tiếp khoản thu đã xác nhận.
- Yêu cầu hủy thu, hoàn tiền hoặc điều chỉnh khoản thu đã xác nhận phải chuyển quản lý phê duyệt.
- Không tự đổi chính sách học phí đã chốt; mức phí riêng cần trong phạm vi được ủy quyền.
- Học phí là tổng toàn khóa chia nhiều đợt; không cộng tổng khóa vào các đợt lần nữa. Tiền nhận không vượt dư nợ trong MVP.
- Danh sách tư vấn marketing mặc định do quản lý xử lý, không tự mở cho giáo vụ.
- Xuất dữ liệu có kiểm soát và nhật ký, không mặc định được tải toàn bộ dữ liệu cá nhân.

## Đã triển khai (`/quan-tri`, dùng chung với quản lý)

1. Tổng quan: lịch hôm nay, đơn xin nghỉ 7 ngày tới, số học sinh/lớp, buổi chưa điểm danh, yêu cầu tư vấn mới (xử lý tại mục Tư vấn).
2. Học sinh (kèm phụ huynh), giáo viên, tài khoản: thêm, sửa, ngừng hoạt động.
3. Khóa học (nhóm Năng khiếu/Kỹ năng, xuất bản lên website), lớp, ghi danh/rút, sĩ số.
4. Lịch: tạo buổi lặp theo tuần, đổi/hủy buổi; chặn trùng lịch giáo viên và trùng phòng (lớp offline cùng địa điểm). Đổi/hủy buổi tự thông báo cho học sinh và giáo viên. Sửa điểm danh quá hạn có lý do.
5. Bài tập và video học sinh nộp của mọi lớp; trang tiến độ & nhận xét từng học sinh; hồ sơ học sinh hiện mọi nhận xét (nội bộ và chia sẻ).
6. Học phí: tổng khóa chia đợt, ghi nhận thu từng phần (không trùng khi bấm lặp, không thu vượt nợ).
7. **Giờ dạy & lương tạm tính**: tổng hợp theo giáo viên và tháng, tách thường/tối/cuối tuần, tính tiền theo đơn giá quản lý đã nhập (giáo vụ xem được, không sửa đơn giá), xuất CSV chi tiết từng buổi.

Chưa có: nhập CSV học sinh, gửi thông báo qua email/Zalo.

## Nghiệm thu riêng

- Không thể ghi danh học viên thứ 11 vào lớp có sức chứa 10, kể cả thao tác đồng thời.
- Trùng lịch bị chặn và chỉ rõ giáo viên, học viên hoặc phòng đang xung đột.
- Tệp nhập sai có danh sách lỗi theo dòng và không âm thầm bỏ qua.
- Ghi nhận khoản thanh toán thành công chỉ một lần khi người dùng bấm gửi lặp.
- Tài khoản không có quyền tài chính không đọc/ghi được endpoint tài chính.
