import json
import re
from pathlib import Path
from collections import Counter

data = json.loads(Path("data/qureo_answers.json").read_text(encoding="utf-8"))
missing = [x for x in data if not x.get("has_answer_marker")]

def classify(item):
    lines = [s.strip() for s in item.get("question", "").splitlines() if s.strip()]

    if not lines:
        return "review"

    if any(re.match(r"^(نضغط|اضغط|قم بتشغيل|تشغيل الكود|نضفط)", s)
           for s in lines[1:]):
        return "interactive"

    if any(re.match(r"^(اجابة|إجابة|الاجابه|الإجابة|الحل)", s)
           for s in lines[1:]):
        return "implicit_answer"

    if any("تشغيل الكود" in s for s in lines[:2]):
        return "interactive_check"

    return "review"

for item in missing:
    item["audit_category"] = classify(item)

counts = Counter(x["audit_category"] for x in missing)

Path("data/implicit_review.json").write_text(
    json.dumps(missing, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print("إجمالي الحالات:", len(missing))
for category, count in sorted(counts.items()):
    print(f"{category}: {count}")

print("\nتم حفظ التفاصيل في data/implicit_review.json")
