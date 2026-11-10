---
document_id: PIG-GLO-001
domain: pig_farming
category: PIG-GLOSSARY
doc_kind: general_guidance
subcategory: Thuật ngữ song ngữ
title: Glossary song ngữ Việt – Anh ngành chăn nuôi lợn
source: Nội bộ – bản thảo demo
source_url: null
language: vi
translated_language: en
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
animal_stage: null
software_module: null
source_bias: null
tags: [glossary, song ngữ, thuật ngữ]
---

> ⚠️ **BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT.** Nội dung do nhóm xây dựng
> hệ thống tự soạn để kiểm thử pipeline. Không dùng làm căn cứ kỹ thuật hay thú y
> cho đến khi chuyên gia chăn nuôi / bác sĩ thú y có thẩm quyền rà soát và chuyển
> `verification_status` sang `approved` (Ch.9, Ch.13).

## Bảng thuật ngữ

Bảng này phục vụ hai việc. Thứ nhất, nó được nạp vào index như một tài liệu bình thường, nên
câu hỏi kiểu "FCR là gì?" trả lời được **kèm trích dẫn** thay vì dựa vào kiến thức chung của
mô hình. Thứ hai, `npm run ingest` sinh từ bảng này ra `data/glossary.json`; khi câu hỏi của
người dùng chứa một thuật ngữ có trong bảng, tối đa 10 cặp Việt – Anh tương ứng được chèn vào
system prompt để giữ thuật ngữ nhất quán giữa hai ngôn ngữ (Ch.3 "song ngữ có kiểm soát",
Ch.14 rủi ro "dịch thuật sai thuật ngữ"). Vì vậy đừng đổi số cột hay thứ tự cột của bảng.

| Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm |
|---|---|---|---|---|---|
| tăng trọng bình quân ngày | average daily gain | ADG | g/con/ngày | Mức tăng trọng trung bình của một con trong một ngày nuôi. | KPI |
| hệ số chuyển hoá thức ăn | feed conversion ratio | FCR | kg/kg | Lượng thức ăn cần để tạo ra một kg tăng trọng; càng thấp càng hiệu quả. | KPI |
| tỷ lệ chết | mortality rate | | % | Phần trăm số con chết trong kỳ so với số con đầu kỳ. | KPI |
| tỷ lệ loại thải | culling rate | | % | Phần trăm số con bị chủ động đưa ra khỏi đàn vì không đạt yêu cầu. | KPI |
| tỷ lệ đẻ | farrowing rate | | % | Phần trăm nái được phối mà đẻ đúng kỳ. | Sinh sản |
| số con cai sữa | weaned piglets | | con/lứa | Số lợn con còn sống tới thời điểm cai sữa trong một lứa. | Sinh sản |
| số con cai sữa trên nái trên năm | pigs weaned per sow per year | PSY | con/nái/năm | Số lợn con cai sữa mà một nái tạo ra trong một năm. | KPI |
| số con sơ sinh sống | born alive | | con/lứa | Số con còn sống khi kết thúc quá trình đẻ. | Sinh sản |
| trọng lượng cai sữa | weaning weight | | kg/con | Trọng lượng lợn con tại thời điểm cai sữa. | KPI |
| năng suất nái | sow productivity | | | Nhóm chỉ số đo số con và số lứa mà đàn nái tạo ra. | KPI |
| nái hậu bị | gilt | | | Nái chưa đẻ lứa nào, đang trong giai đoạn phát triển để vào đàn sinh sản. | Giai đoạn |
| nái mang thai | gestating sow | | | Nái trong thời gian mang thai. | Giai đoạn |
| nái nuôi con | lactating sow | | | Nái đang cho con bú trước khi cai sữa. | Giai đoạn |
| lợn sau cai sữa | nursery | | | Lợn giai đoạn ngay sau cai sữa, ăn thức ăn khô hoàn toàn. | Giai đoạn |
| lợn choai | grower | | | Lợn giai đoạn giữa của chu kỳ thịt, tốc độ tích luỹ nạc cao. | Giai đoạn |
| lợn vỗ béo | finisher | | | Lợn giai đoạn cuối, hướng tới trọng lượng xuất bán. | Giai đoạn |
| lợn con theo mẹ | suckling piglet | | | Lợn con còn bú mẹ, chưa cai sữa. | Giai đoạn |
| sữa đầu | colostrum | | | Sữa tiết ra ngay sau khi đẻ, nguồn kháng thể thụ động của lợn con. | Sinh sản |
| cai sữa | weaning | | | Tách lợn con khỏi nái, chuyển sang thức ăn khô hoàn toàn. | Sinh sản |
| động dục | oestrus | | | Giai đoạn nái chấp nhận phối trong chu kỳ sinh sản. | Sinh sản |
| phối giống | insemination | | | Đưa tinh vào đường sinh dục nái, bằng phối trực tiếp hoặc thụ tinh nhân tạo. | Sinh sản |
| lứa | parity | | lứa | Số lần nái đã đẻ; dùng để phân nhóm đàn nái. | Sinh sản |
| an toàn sinh học | biosecurity | | | Tập hợp biện pháp ngăn mầm bệnh vào và lan trong trại. | An toàn sinh học |
| sát trùng | disinfection | | | Bước xử lý bề mặt bằng hoá chất sau khi đã dọn, rửa và để khô. | An toàn sinh học |
| cách ly | quarantine | | | Giữ đàn mới hoặc đàn nghi ngờ tách khỏi đàn chính trong một khoảng thời gian. | An toàn sinh học |
| tiêu huỷ | disposal | | | Xử lý xác và chất thải nguy cơ cao theo quy định, không để lại nguồn lây. | An toàn sinh học |
| phác đồ | treatment protocol | | | Trình tự điều trị do người có thẩm quyền ban hành; chatbot không tự đưa ra. | Thú y |
| khẩu phần | diet | | | Thành phần và lượng thức ăn cấp cho một nhóm con vật. | Dinh dưỡng |
| thức ăn hỗn hợp | complete feed | | | Thức ăn đã phối trộn đủ dinh dưỡng, dùng trực tiếp không cần bổ sung. | Dinh dưỡng |
| thông gió | ventilation | | | Trao đổi khí trong chuồng để kiểm soát nhiệt độ, độ ẩm và khí độc. | Chuồng nuôi |
| mật độ nuôi | stocking density | | con/m² | Số con trên một đơn vị diện tích chuồng. | Chuồng nuôi |

## Cách dùng và cách mở rộng

Khi thêm mục mới, giữ đúng sáu cột và viết thuật ngữ ở dạng thường dùng nhất trong trại, vì
đó là dạng mà người dùng sẽ gõ vào ô câu hỏi. Cột viết tắt chỉ điền khi viết tắt đó thực sự
được dùng trong hệ thống; một viết tắt quá ngắn hoặc quá chung sẽ khớp bừa vào nhiều câu hỏi
và làm phình prompt bằng rác. Sau khi sửa bảng, chạy lại `npm run ingest` để `data/glossary.json`
được sinh lại; file đó là bản mà hệ thống đọc lúc chạy, không phải file Markdown này.
