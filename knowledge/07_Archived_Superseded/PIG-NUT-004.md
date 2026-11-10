---
document_id: PIG-NUT-004
domain: pig_farming
category: PIG-05
doc_kind: general_guidance
subcategory: Nhu cầu dinh dưỡng
title: Nhu cầu dinh dưỡng theo giai đoạn — bản cũ đã hết hiệu lực (fixture kiểm thử)
source: Nội bộ – bản thảo demo
source_url: null
language: vi
translated_language: null
translation_of: null
publication_date: 2026-11-01
version: "0.9"
last_reviewed: 2026-11-01
valid_from: 2026-11-01
valid_to: 2026-11-03
superseded_by: PIG-NUT-001
license_status: internal_draft
verification_status: in_review
reviewer: null
quality_score: null
quality_breakdown: null
exclusion_flags: []
animal_stage: [nursery, grower, finisher]
software_module: null
source_bias: null
tags: [dinh dưỡng, hết hiệu lực, fixture kiểm thử]
---

> ⚠️ **BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT.** Nội dung do nhóm xây dựng
> hệ thống tự soạn để kiểm thử pipeline. Không dùng làm căn cứ kỹ thuật hay thú y
> cho đến khi chuyên gia chăn nuôi / bác sĩ thú y có thẩm quyền rà soát và chuyển
> `verification_status` sang `approved` (Ch.9, Ch.13).

> 🧪 **ĐÂY LÀ HẠ TẦNG KIỂM THỬ, KHÔNG PHẢI TÀI LIỆU KIẾN THỨC.** File này tồn tại để
> kiểm thử nhánh "tài liệu đã hết hiệu lực" của hệ thống: `valid_to` đã qua và
> `superseded_by` trỏ sang `PIG-NUT-001`. Chunk của nó **không bao giờ được vào ngữ cảnh
> trả lời**; nó chỉ được phép xuất hiện trong danh sách tài liệu hết hiệu lực đã bị loại,
> và chỉ khi nó thực sự liên quan tới câu hỏi (Ch.11, ca test khó `outdated_doc`).
> Đừng gia hạn `valid_to` và đừng xoá `superseded_by` — làm vậy là xoá mất ca kiểm thử.

## Nhu cầu dinh dưỡng

Bản này là phiên bản cũ của khung tham chiếu dinh dưỡng nội bộ, đã được thay thế bởi
`PIG-NUT-001`. Nội dung được giữ lại trong thư mục lưu trữ để còn truy được lịch sử thay đổi,
chứ không để dùng. Trong hệ thống, một tài liệu nằm ở thư mục lưu trữ phải thoả ràng buộc bù:
`valid_to` đã qua hoặc có `superseded_by`, nếu không thì thư mục lưu trữ sẽ trở thành chỗ để
tài liệu lách mọi kiểm tra taxonomy. File này thoả cả hai điều kiện cùng lúc.

### Giai đoạn nursery

Bản cũ này nêu các mốc protein thô thấp hơn bản hiện hành cho cả ba giai đoạn thịt, theo cách
tính đã không còn dùng. Không đối chiếu con số trong file này với `PIG-NUT-001` để tìm mâu
thuẫn: hai tài liệu không cùng hiệu lực nên đây không phải tình huống mâu thuẫn mà là tình
huống "có bản mới hơn". Ca kiểm thử mâu thuẫn dùng cặp `PIG-NUT-001` và `PIG-NUT-005`, cả hai
đều còn hiệu lực. Khi người dùng hỏi về dinh dưỡng giai đoạn nursery, hệ thống phải trả lời
bằng bản hiện hành và nói rõ rằng có một tài liệu đã hết hiệu lực được tìm thấy nhưng đã bị
loại khỏi căn cứ.
