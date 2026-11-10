---
document_id: PIG-KPI-002
domain: pig_farming
category: PIG-11
doc_kind: general_guidance
subcategory: KPI đàn nái
title: Bộ KPI đàn nái cốt lõi
source: Nội bộ – bản thảo demo
source_url: null
language: vi
translated_language: null
translation_of: null
publication_date: 2026-11-01
version: "1.0"
last_reviewed: 2026-11-01
valid_from: null
valid_to: null
superseded_by: null
license_status: internal_draft
verification_status: in_review
reviewer: null
quality_score: null
quality_breakdown: null
exclusion_flags: []
animal_stage: [nai_hau_bi, nai_mang_thai, nai_nuoi_con]
software_module: null
source_bias: null
tags: [KPI, đàn nái, PSY]
---

> ⚠️ **BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT.** Nội dung do nhóm xây dựng
> hệ thống tự soạn để kiểm thử pipeline. Không dùng làm căn cứ kỹ thuật hay thú y
> cho đến khi chuyên gia chăn nuôi / bác sĩ thú y có thẩm quyền rà soát và chuyển
> `verification_status` sang `approved` (Ch.9, Ch.13).

## Bộ chỉ số cốt lõi của đàn nái

Đàn nái cần một bộ chỉ số nhỏ nhưng đọc được hằng tuần, thay vì một bảng dài không ai xem.
Bộ nội bộ gồm năm chỉ số: số con cai sữa trên nái trên năm, số con sơ sinh sống trên lứa, tỷ
lệ đẻ, số ngày không sản xuất và tỷ lệ loại thải nái. Năm chỉ số này phủ được cả hai mặt của
năng suất đàn nái là **số con ra chuồng** và **thời gian nái ở trạng thái sinh sản**. Thêm
chỉ số thì tốt, nhưng thêm trước khi năm chỉ số này được ghi đúng và đủ thì chỉ làm báo cáo
dài hơn mà không rõ hơn.

### Số con cai sữa trên nái trên năm

Chỉ số này thường gọi là PSY, là số lợn con cai sữa mà một nái tạo ra trong một năm. Nó là
tích của số lứa trên nái trên năm và số con cai sữa trung bình mỗi lứa, nên nó tóm cả khả
năng sinh sản lẫn khả năng giữ con sống tới cai sữa vào một con số. Vì là tích của hai thành
phần, PSY xấu đi không cho biết nguyên nhân: phải tách ra xem mất ở số lứa hay ở số con cai
sữa mỗi lứa. Báo cáo chỉ nêu PSY mà không nêu hai thành phần là báo cáo không hành động được.

### Số con sơ sinh sống trên lứa

Đếm số con còn sống khi kết thúc quá trình đẻ, tách riêng với số con sinh ra chết và số con
còi không đủ sức sống. Ba nhóm này có nguyên nhân khác nhau, nên gộp lại thành một con số là
mất đường điều tra. Ghi chép tại ô đẻ phải thống nhất cách phân loại giữa các ca trực, nếu
không thì khác biệt giữa các tuần chỉ phản ánh người nào trực. Cùng với số con sơ sinh sống,
ghi trọng lượng của lứa nếu điều kiện cho phép: lứa nhiều con nhưng trọng lượng thấp đặt ra
vấn đề chăm sóc khác hẳn so với lứa ít con.

### Tỷ lệ đẻ và số ngày không sản xuất

Tỷ lệ đẻ là phần trăm nái được phối mà đẻ đúng kỳ, phản ánh chất lượng của khâu phát hiện
động dục và phối giống. Số ngày không sản xuất là tổng số ngày mà một nái không mang thai và
không nuôi con — tức số ngày nái tiêu tốn chi phí mà không tạo ra con. Hai chỉ số này giải
thích phần lớn chênh lệch về số lứa trên nái trên năm giữa các trại có cùng giống và cùng
khẩu phần. Theo dõi chúng theo nhóm nái cùng kỳ phối giúp phát hiện vấn đề của một giai đoạn
cụ thể thay vì chỉ thấy mức trung bình trôi đi.

## Cách báo cáo để con số dùng được

Mỗi chỉ số cần ba thứ đi kèm: kỳ tính, số nái trong mẫu và cách xử lý những con vào hoặc ra
đàn giữa kỳ. Thiếu một trong ba thì hai kỳ liền nhau không so được với nhau. Trong hệ thống
nội bộ, định nghĩa của từng chỉ số phải được viết ra một lần và dùng lại, vì phần lớn tranh
luận về năng suất đàn nái hoá ra là tranh luận về định nghĩa chứ không phải về thực tế đàn.
