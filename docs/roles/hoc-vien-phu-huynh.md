# Vai trò: Học viên và phụ huynh

Tham chiếu: [Kế hoạch tổng thể](../../PLAN.md).

## Mục tiêu

Theo dõi việc học và học phí mà không phải hỏi giáo vụ cho từng thông tin cơ bản.

## Mô hình tài khoản đã chốt

- Mỗi học sinh một tài khoản do quản lý tạo khi tuyển sinh; phụ huynh và học sinh dùng chung.
- Đăng nhập bằng tên riêng/mã học sinh và mật khẩu. Email phụ huynh để kích hoạt/khôi phục có thể dùng cho nhiều con.
- Hai con tương ứng hai tài khoản; không có tài khoản gia đình chọn nhiều con trong MVP.
- Hồ sơ học sinh và phụ huynh vẫn tách riêng. Tài khoản dùng lại khi học thêm khóa, không tạo lại theo từng ghi danh.
- Nhật ký chỉ nhận diện tài khoản, không biết người dùng là phụ huynh hay học sinh. Cả hai xem cùng dữ liệu, bao gồm học phí.

## Quyền chung trong MVP

| Chức năng | Phạm vi |
|---|---|
| Xem hồ sơ, lớp, lịch, điểm danh | Đúng học sinh gắn với tài khoản |
| Xem nhận xét | Chỉ nội dung được chia sẻ |
| Xem học phí và phiếu thu | Tổng phí toàn khóa, các đợt đến hạn, đã đóng và dư nợ |
| Xem link học online | Lớp/buổi được phép tham gia |
| Nhận thông báo | Liên quan học sinh đó |
| Đổi mật khẩu | Tài khoản đang sử dụng |

## Giới hạn

- Không được xem danh sách, liên hệ hoặc học phí của học viên khác.
- Không tự điểm danh, sửa kết quả học, ghi nhận thanh toán hoặc sửa liên kết gia đình.
- Thay đổi thông tin định danh/liên hệ qua giáo vụ trong MVP, có xác minh và nhật ký.
- Xem học phí không đồng nghĩa đã có chức năng thanh toán trực tuyến.
- Hồ sơ tiềm năng có thể chưa có tài khoản; không bắt trẻ có email riêng.
- Thay đổi người liên hệ khôi phục phải được xác minh; khóa tài khoản/thu hồi quyền có hiệu lực ở yêu cầu tiếp theo.

## Đã triển khai (`/hoc-sinh`)

1. **Tổng quan**: buổi học sắp tới, bài tập cần nộp, học phí còn nợ, nhận xét định kỳ của giáo viên.
2. **Lịch học**: buổi sắp tới và buổi đã học kèm điểm danh, nhận xét giáo viên chia sẻ. **Xin nghỉ** từng buổi (ghi lý do) và rút đơn được trước giờ học.
3. **Bài tập**: xem đề, **quay/chọn video và nộp** (MP4/MOV/WebM, tối đa `MAX_UPLOAD_MB`), xem điểm và nhận xét; khi giáo viên yêu cầu thì *Nộp lại*.
4. **Học phí**: tổng phí từng khóa, các đợt, đã đóng, còn nợ, quá hạn.
5. **Thông báo**: bài tập mới, kết quả chấm, nhận xét mới, buổi học bị đổi giờ hoặc hủy.
6. **Đổi mật khẩu** (bắt buộc ở lần đăng nhập đầu với mật khẩu tạm).

Chưa có: email/Zalo, khôi phục mật khẩu qua email, thanh toán online.

## Nghiệm thu riêng

- Hai tài khoản học sinh cùng email phụ huynh không lẫn lịch/công nợ hoặc token khôi phục.
- Thay ID học viên trên URL/API không thể truy cập người không được liên kết.
- Nhận xét nội bộ của giáo viên/giáo vụ không xuất hiện trong cổng người học.
- Quản lý xác minh liên kết trước khi cấp tài khoản; giáo vụ không tự cấp tài khoản học sinh.
