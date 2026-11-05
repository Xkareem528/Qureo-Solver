import json
import shutil
from pathlib import Path

main_path = Path("data/qureo_answers.json")
review_path = Path("data/implicit_review.json")

main = json.loads(main_path.read_text(encoding="utf-8"))
review = json.loads(review_path.read_text(encoding="utf-8"))

resolved = {
    (x["level"], x["source_line"]): x
    for x in review
    if x.get("audit_category") == "resolved"
}

if len(resolved) != 5:
    raise SystemExit(f"توقف: المتوقع 5 حالات، الموجود {len(resolved)}")

backup = main_path.with_suffix(".json.bak")
shutil.copy2(main_path, backup)

updated = 0

for item in main:
    key = (item.get("level"), item.get("source_line"))
    if key not in resolved:
        continue

    source = resolved[key]
    item["proposed_answer"] = source["proposed_answer"]
    item["proposed_answer_type"] = source["proposed_answer_type"]
    item["classification_source"] = source["classification_source"]
    item["review_status"] = "classified_not_verified"
    updated += 1

if updated != 5:
    raise SystemExit(
        f"توقف: تم العثور على {updated} من 5 فقط. النسخة الأصلية محفوظة."
    )

main_path.write_text(
    json.dumps(main, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print("تم تحديث:", updated)
print("النسخة الاحتياطية:", backup)
print("الإجابات الأصلية لم يتم استبدالها.")
