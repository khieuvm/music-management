# Vai trò: Giáo viên

Tham chiếu: [Kế hoạch tổng thể](../../PLAN.md).

## Mục tiêu

Biết lịch dạy, danh sách học viên cần phụ trách và cập nhật tình hình mỗi buổi.

## Quyền trong MVP

- Xem hồ sơ cá nhân, lịch dạy, lớp và buổi được phân công.
- Xem thông tin học viên tối thiểu cần thiết cho việc dạy trong phạm vi lớp được giao.
- Điểm danh theo buổi và ghi nhận xét tiến độ.
- Chọn nhận xét nội bộ hoặc nhận xét được chia sẻ theo chính sách trung tâm.
- Sửa điểm danh/nhận xét trong thời hạn cho phép; lịch sử chỉnh sửa được lưu.
- Xem thông báo thay đổi lịch và phân công.
- Lớp có hình thức offline/online độc lập với mô hình nhóm/1–1; xem link Zoom/Google Meet riêng tư của buổi được phân công, không có video tích hợp.

## Giới hạn

- Không tự tạo/xóa lớp, đổi lịch, phân công giáo viên hay ghi danh học viên.
- Không xem công nợ, thu tiền, xuất dữ liệu toàn trung tâm hoặc thay đổi quyền.
- Không xem dữ liệu lớp khác chỉ vì biết ID.
- Danh sách số điện thoại phụ huynh không được cung cấp mặc định; nhu cầu liên hệ phải được chốt và cấp quyền rõ ràng.
- Khi thôi được phân công, quyền mặc định bị thu hồi; yêu cầu xem lại lịch sử phải được quản lý xác nhận.
- Buổi đã hủy không được điểm danh; học viên phải thuộc ghi danh hợp lệ tại buổi tương ứng.

## Đã triển khai (`/giao-vien`)

1. **Lịch dạy**: buổi cần điểm danh, lịch 14 ngày tới và **đơn xin nghỉ** của học sinh (bấm *Đã biết*; lưu điểm danh cũng tự xác nhận, học sinh có đơn được chọn sẵn *vắng có phép*).
2. **Điểm danh + nhận xét** từng buổi: có mặt / vắng có phép / vắng / muộn, nhận xét chia sẻ cho học sinh hoặc ghi chú nội bộ. Chỉ điểm danh buổi đã bắt đầu; được sửa trong **48 giờ** sau buổi học, sau đó phải nhờ giáo vụ/quản lý (họ phải ghi lý do, có nhật ký).
3. **Lớp & học sinh**: danh sách học sinh kèm chuyên cần, số bài đã nộp/chờ chấm, ngày nhận xét gần nhất. *Xem & nhận xét* mở trang từng học sinh: lịch sử điểm danh, bài tập, đơn xin nghỉ và **nhận xét định kỳ** (mặc định phụ huynh xem được, có thể chọn ghi chú nội bộ).
4. **Bài tập**: giao bài tập cho lớp, xem video học sinh nộp, chấm điểm, nhận xét, chọn *Đạt* hoặc *Cần nộp lại*.
5. **Thông báo**: học sinh nộp bài, xin nghỉ/rút đơn, được đổi lịch hoặc phân công buổi.
6. **Giờ dạy**: tổng giờ đã dạy theo tháng, tách giờ thường / buổi tối / cuối tuần, kèm tiền tạm tính theo đơn giá trung tâm.

## Quyết định cần chốt

- Con số đơn giá giờ dạy và phụ cấp buổi tối, cuối tuần (quản lý nhập trong hệ thống).
- Nhận xét có cần giáo vụ duyệt trước khi phụ huynh xem không? (hiện: không cần)
- Giáo viên thay thế được cấp quyền cho từng buổi như thế nào? (hiện: đổi giáo viên của buổi trong lịch)

## Nghiệm thu riêng

- Giáo viên không được phân công bị từ chối cả thao tác xem và ghi qua API.
- Lưu lại một buổi không tạo nhiều bản ghi điểm danh cho cùng học viên.
- Hết thời hạn sửa thì thao tác bị từ chối rõ ràng, có hướng dẫn liên hệ giáo vụ.
- Đổi giáo viên một buổi cập nhật đúng quyền của giáo viên thay thế.
