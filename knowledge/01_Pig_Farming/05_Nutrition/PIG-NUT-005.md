---
document_id: PIG-NUT-005
domain: pig_farming
category: PIG-05
doc_kind: general_guidance
subcategory: Nhu cầu dinh dưỡng
title: Nhu cầu dinh dưỡng giai đoạn nursery — bản tham chiếu thứ hai (fixture kiểm thử)
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
animal_stage: [nursery]
software_module: null
source_bias: null
tags: [dinh dưỡng, nursery, fixture kiểm thử]
---

> ⚠️ **BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT.** Nội dung do nhóm xây dựng
> hệ thống tự soạn để kiểm thử pipeline. Không dùng làm căn cứ kỹ thuật hay thú y
> cho đến khi chuyên gia chăn nuôi / bác sĩ thú y có thẩm quyền rà soát và chuyển
> `verification_status` sang `approved` (Ch.9, Ch.13).

> 🧪 **ĐÂY LÀ HẠ TẦNG KIỂM THỬ, KHÔNG PHẢI TÀI LIỆU KIẾN THỨC.** File này tồn tại để
> kiểm thử cơ chế phát hiện mâu thuẫn của hệ thống: nó cố tình nêu **một con số khác**
> `PIG-NUT-001` cho **cùng một giai đoạn**, dưới **cùng một chuỗi heading**. Khi có hai
> tài liệu còn hiệu lực nói khác nhau, chatbot phải **nêu rõ mâu thuẫn** thay vì chọn bừa
> một bên (Ch.11, ca test khó `conflicting_docs`). Đừng đọc file này như kiến thức chăn
> nuôi, và đừng "sửa cho khớp" với `PIG-NUT-001` — làm vậy là xoá mất ca kiểm thử.

## Nhu cầu dinh dưỡng

Phần này giữ đúng chuỗi heading của `PIG-NUT-001` để hai tài liệu rơi vào cùng một vị trí
trích dẫn. Lý do: cơ chế phát hiện mâu thuẫn của hệ thống so các chunk **cùng nhóm tài liệu
và cùng chuỗi heading**; nếu hai tài liệu nói khác nhau nhưng nằm ở hai chuỗi heading khác
nhau thì hệ thống không có cơ sở nào để kết luận rằng chúng đang nói về cùng một thứ. Đặt
chúng cùng chỗ là cách duy nhất làm ca kiểm thử trở thành ca kiểm thử thật, chứ không phải
một kỳ vọng được viết ra rồi không bao giờ chạy.

### Giai đoạn nursery

Bản tham chiếu thứ hai này nêu **protein thô khoảng 17%** trong vật chất khô cho giai đoạn
nursery, trong khi `PIG-NUT-001` nêu khoảng 20% cho cùng giai đoạn. Hai con số không thể cùng
đúng với cùng một đàn, và cả hai tài liệu đều còn hiệu lực, đều ở trạng thái chờ chuyên gia
duyệt. Đây chính là tình huống mà Ch.11 yêu cầu kiểm: câu trả lời đúng là nêu rõ rằng kho
đang có hai nguồn nội bộ nói khác nhau và cần người có thẩm quyền chốt lại, chứ không phải
đưa ra một con số rồi trích dẫn một trong hai tài liệu như thể không có tranh chấp nào.
