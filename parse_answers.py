import re
import json
import hashlib
from pathlib import Path
from collections import Counter

SOURCE = Path.home() / "storage/shared/Download/Telegram/Qureo_prompts_levels_1_to_42-3.txt"
OUTPUT = Path(__file__).parent / "data" / "qureo_answers.json"
REPORT = Path(__file__).parent / "data" / "parse_report.json"

def classify(answer):
    text = answer.strip()

    if not text:
        return "missing"

    low = text.lower()

    if any(x in low for x in [
        "نضغط تشغيل", "اضغط تشغيل", "بدون تعديل",
        "انقر على تشغيل", "تشغيل الكود دون"
    ]):
        return "interactive"

    if re.search(r'console\.log|let |const |var |if\s*\(|while\s*\(|for\s*\(', text):
        return "code"

    if any(x in text for x in ["الفراغ", "النواقص", "اكتب", "نكتب"]):
        return "guidance"

    return "text"


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source not found: {SOURCE}")

    lines = SOURCE.read_text(encoding="utf-8-sig").splitlines()

    records = []
    level = None
    lesson = None
    current = None
    answer_mode = False

    def save_current():
        nonlocal current

        if current is None:
            return

        question = "\n".join(current["question_lines"]).strip()
        answer = "\n".join(current["answer_lines"]).strip()

        if not question and not answer:
            current = None
            return

        fingerprint = hashlib.sha256(
            f'{current["level"]}|{current["lesson"]}|{question}'.encode("utf-8")
        ).hexdigest()

        records.append({
            "level": current["level"],
            "lesson": current["lesson"],
            "question_label": current["label"],
            "question": question,
            "answer": answer,
            "answer_type": classify(answer),
            "has_answer_marker": current["has_answer_marker"],
            "source_line": current["source_line"],
            "fingerprint": fingerprint
        })

        current = None

    for line_number, raw in enumerate(lines, 1):
        line = raw.strip()

        level_match = re.fullmatch(r"المستوى\s+(\d+)", line)

        if level_match:
            save_current()
            level = int(level_match.group(1))
            lesson = None
            answer_mode = False
            continue

        if level is None:
            continue

        if re.match(r"^الدرس\s+", line):
            save_current()
            lesson = line
            answer_mode = False
            continue

        if re.match(r"^السؤال", line):
            save_current()

            current = {
                "level": level,
                "lesson": lesson,
                "label": line,
                "source_line": line_number,
                "question_lines": [],
                "answer_lines": [],
                "has_answer_marker": False
            }

            answer_mode = False
            continue

        if current is None:
            continue

        if line == "الإجابة:":
            current["has_answer_marker"] = True
            answer_mode = True
            continue

        if answer_mode:
            current["answer_lines"].append(raw)
        else:
            current["question_lines"].append(raw)

    save_current()

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    counts = Counter(x["answer_type"] for x in records)
    levels = Counter(x["level"] for x in records)

    report = {
        "source": str(SOURCE),
        "total_records": len(records),
        "answer_types": dict(counts),
        "records_per_level": dict(sorted(levels.items())),
        "without_answer_marker": sum(
            not x["has_answer_marker"] for x in records
        )
    }

    OUTPUT.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print("Parsing completed.")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nData: {OUTPUT}")
    print(f"Report: {REPORT}")


if __name__ == "__main__":
    main()
