import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thông tin sử dụng dữ liệu", robots: { index: false, follow: true } };

export default function PrivacyPage() {
  return (
    <main id="main" className="container section">
      <p className="eyebrow">BẢN THỬ NGHIỆM LOCAL</p>
      <h1 className="page-title">Thông tin sử dụng dữ liệu</h1>
      <div className="intro">
        <p>Chỉ sử dụng tên, số điện thoại và ghi chú giả để kiểm thử. Ứng dụng chưa được duyệt tiếp nhận dữ liệu thật.</p>
        <p>Form tư vấn lưu tên người liên hệ, số di động, khóa quan tâm, ghi chú, thời điểm đồng ý và phiên bản thông báo vào PostgreSQL local. Chưa gửi dữ liệu cho dịch vụ email, Zalo hay bên tư vấn bên ngoài.</p>
        <p>Thông tin dùng để thử quy trình tư vấn/tuyển sinh, không tự tạo tài khoản hoặc đăng ký khóa. Dữ liệu không được hiển thị công khai.</p>
        <p>Cơ chế giới hạn tần suất lưu mã HMAC của điện thoại/địa chỉ truy cập, không lưu IP thô trong bảng giới hạn. Các bộ đếm hết hạn được dọn khi có yêu cầu hợp lệ tiếp theo.</p>
        <p>Trước khi chạy thật, trung tâm phải bổ sung tên đơn vị chịu trách nhiệm, kênh liên hệ, thời hạn lưu giữ, cách yêu cầu sửa/xóa dữ liệu và thông tin nhà cung cấp. Bản này không thay thế chính sách đã được kiểm tra theo quy định áp dụng.</p>
      </div>
    </main>
  );
}
