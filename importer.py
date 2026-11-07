import json
import re
import getpass
import sys
from pathlib import Path

import requests

SERVER = "https://qureo-solver.onrender.com"
DATA_FILE = Path("data/qureo_answers.json")
BATCH_SIZE = 50
ALLOWED_STATUSES = {
    "pending",
    "classified_not_verified",
    "verified",
    "rejected"
}

def main():
    if not DATA_FILE.exists():
        sys.exit("ملف البيانات غير موجود.")

    records = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    if not isinstance(records, list) or not records:
        sys.exit("ملف البيانات فارغ أو غير صالح.")

    for i, r in enumerate(records, 1):
        valid = (
            isinstance(r, dict)
            and isinstance(r.get("level"), int)
            and not isinstance(r.get("level"), bool)
            and 1 <= r["level"] <= 42
            and isinstance(r.get("fingerprint"), str)
            and re.fullmatch(r"[a-f0-9]{64}", r["fingerprint"], re.I)
            and isinstance(r.get("question"), str)
            and bool(r["question"].strip())
            and isinstance(r.get("answer"), str)
            and isinstance(r.get("answer_type"), str)
            and bool(r["answer_type"].strip())
            and isinstance(r.get("has_answer_marker"), bool)
            and isinstance(r.get("source_line"), int)
            and not isinstance(r.get("source_line"), bool)
            and r["source_line"] >= 1
            and (r.get("review_status") is None or
                 r["review_status"] in ALLOWED_STATUSES)
        )

        if not valid:
            sys.exit(f"سجل غير صالح رقم {i}.")

    batches = [
        records[i:i + BATCH_SIZE]
        for i in range(0, len(records), BATCH_SIZE)
    ]

    print("إجمالي السجلات:", len(records))
    print("عدد الدفعات:", len(batches))
    print("حجم الدفعة:", BATCH_SIZE)

    print("\nحالات المراجعة:")
    for status in sorted({
        r.get("review_status", "pending") or "pending"
        for r in records
    }):
        count = sum(
            1 for r in records
            if (r.get("review_status") or "pending") == status
        )
        print(f"  {status}: {count}")

    confirm = input("\nاكتب IMPORT للبدء: ").strip()
    if confirm != "IMPORT":
        print("تم الإلغاء دون إرسال أي بيانات.")
        return

    token = getpass.getpass("IMPORT_TOKEN: ").strip()
    if not token:
        sys.exit("لم يتم إدخال الرمز.")

    session = requests.Session()
    session.headers.update({
        "x-import-token": token,
        "Content-Type": "application/json"
    })

    total_inserted = 0
    total_updated = 0

    for index, batch in enumerate(batches, 1):
        print(f"\nإرسال الدفعة {index}/{len(batches)}...")

        try:
            response = session.post(
                f"{SERVER}/api/source-questions/import",
                json={"records": batch},
                timeout=(15, 90)
            )

            if response.status_code != 200:
                print("فشل HTTP:", response.status_code)
                print("الرد:", response.text[:500])
                print("توقف الاستيراد. يمكنك إعادة تشغيل السكربت بأمان.")
                sys.exit(1)

            result = response.json()

            if (
                result.get("success") is not True
                or result.get("received") != len(batch)
            ):
                print("استجابة غير متوقعة:", result)
                sys.exit(1)

            inserted = result["inserted"]
            updated = result["updated"]

            total_inserted += inserted
            total_updated += updated

            print(f"أُضيف: {inserted} | حُدّث: {updated}")

        except requests.RequestException as error:
            print("خطأ اتصال:", error)
            print("توقف الاستيراد. أعد تشغيل السكربت لاحقًا.")
            sys.exit(1)

    print("\nاكتملت جميع الدفعات.")
    print("إجمالي المضاف:", total_inserted)
    print("إجمالي المحدّث:", total_updated)
    print("إجمالي المعالج:", total_inserted + total_updated)

    session.close()

if __name__ == "__main__":
    main()
