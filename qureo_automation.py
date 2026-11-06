import sys
import json
import requests

def summarize_course(course_data):
    """
    تلخيص حالة الكورس والفصول
    """
    total = course_data.get("total_chapters", 0)
    completed = course_data.get("completed_chapters", 0)
    incomplete = course_data.get("incomplete_chapters", 0)
    missing = course_data.get("missing_progress_records", 0)

    return {
        "total": total,
        "completed": completed,
        "incomplete": incomplete,
        "missing_or_locked": missing,
        "progress_percentage": round((completed / total * 100), 2) if total > 0 else 0
    }

def fetch_chapter_questions(session, api_base, chapter_id):
    """
    جلب الأسئلة الفعلية الخاصة بفصل معين
    """
    url = f"{api_base}/chapters/{chapter_id}"
    res = session.get(url, timeout=25)
    res.raise_for_status()
    data = res.json()
    
    if isinstance(data, dict):
        return data.get("questions") or data.get("chapter", {}).get("questions") or []
    return []

def submit_question_answer(session, api_base, chapter_id, question_id, answer_payload):
    """
    إرسال إجابة السؤال الفعلي إلى منصة QUREO
    """
    url = f"{api_base}/chapters/{chapter_id}/questions/{question_id}/answer"
    res = session.post(url, json={"answer": answer_payload}, timeout=25)
    return res

def solve_chapter_questions(session, api_base, chapter_id, db_answers_map=None):
    """
    استخراج أسئلة الفصل، مطابقتها مع الإجابات المعتمدة، وإرسال التقرير
    """
    if db_answers_map is None:
        db_answers_map = {}

    questions = fetch_chapter_questions(session, api_base, chapter_id)
    results = []

    for q in questions:
        q_id = q.get("id")
        q_text = str(q.get("text", "")).strip()

        # البحث عن الإجابة بواسطة ID السؤال أو النص المنظم
        correct_answer = db_answers_map.get(q_id) or db_answers_map.get(q_text)

        if not correct_answer:
            results.append({
                "question_id": q_id,
                "status": "skipped",
                "reason": "الإجابة غير متوفرة في قاعدة البيانات"
            })
            continue

        try:
            res = submit_question_answer(session, api_base, chapter_id, q_id, correct_answer)
            if res.status_code in (200, 201):
                results.append({
                    "question_id": q_id,
                    "status": "success",
                    "answer_sent": correct_answer
                })
            else:
                results.append({
                    "question_id": q_id,
                    "status": "failed",
                    "http_status": res.status_code
                })
        except Exception as err:
            results.append({
                "question_id": q_id,
                "status": "error",
                "message": str(err)[:150]
            })

    return {
        "chapter_id": chapter_id,
        "total_questions": len(questions),
        "processed": len(results),
        "details": results
    }
