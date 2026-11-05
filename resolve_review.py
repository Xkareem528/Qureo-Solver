import json
from pathlib import Path

path = Path("data/implicit_review.json")
data = json.loads(path.read_text(encoding="utf-8"))

rules = {
    (10, 1534): ("text", "Protractor", "manual_classification"),
    (15, 2437): ("text", "سلسلة نصية", "manual_classification"),
    (15, 2441): ("text", "القيمة العددية", "manual_classification"),
    (15, 2445): ("text", "سلسلة نصية", "manual_classification"),
    (18, 3289): ("text", "لقد كانت ممتعة!", "manual_classification"),
}

resolved = 0

for item in data:
    key = (item.get("level"), item.get("source_line"))

    if key in rules:
        answer_type, answer, source = rules[key]
        item["audit_category"] = "resolved"
        item["proposed_answer_type"] = answer_type
        item["proposed_answer"] = answer
        item["classification_source"] = source
        resolved += 1

path.write_text(
    json.dumps(data, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print("تم تصنيف:", resolved)
print("المتبقي للمراجعة اليدوية:",
      sum(x["audit_category"] == "review" for x in data))
