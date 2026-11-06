import sys
import json
import requests
from qureo_automation import summarize_course, solve_chapter_questions

PORTAL = "https://me-portal.qureo.education"
API = "https://me-tp.qureo.education/api/study"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Referer": "https://me-tp.qureo.education/",
}

def output(data):
    print(json.dumps(data, ensure_ascii=False))

def fetch_course(session, available_course):
    content_id = available_course.get("content_id")
    if not content_id:
        return None

    course_response = session.get(f"{API}/courses/{content_id}", timeout=25)
    course_response.raise_for_status()
    course_data = course_response.json()
    course = course_data.get("course") or {}
    basic_section = course_data.get("basic_section") or {}
    section_id = basic_section.get("id")
    if not section_id:
        return None

    section_response = session.get(f"{API}/sections/{section_id}", timeout=25)
    section_response.raise_for_status()
    chapters = section_response.json().get("chapters") or []

    progress_response = session.get(f"{API}/students/sections/{section_id}/chapters", timeout=25)
    progress_response.raise_for_status()
    progress_by_id = {item.get("chapter_id"): item for item in progress_response.json()}

    chapter_results = []
    completed = 0
    incomplete = 0
    missing = 0

    for chapter in chapters:
        chapter_id = chapter.get("id")
        progress = progress_by_id.get(chapter_id)
        if progress is None:
            status = "missing"
            missing += 1
        elif progress.get("completed_at"):
            status = "completed"
            completed += 1
        else:
            status = "incomplete"
            incomplete += 1

        chapter_results.append({
            "id": chapter_id,
            "seq": chapter.get("seq"),
            "name": chapter.get("name"),
            "question_count": chapter.get("question_count"),
            "test_type": chapter.get("test_type"),
            "status": status,
            "started_at": progress.get("started_at") if progress else None,
            "completed_at": progress.get("completed_at") if progress else None,
            "best_correct_count": progress.get("best_correct_count") if progress else None,
            "diamond": progress.get("diamond") if progress else None
        })

    return {
        "content_id": content_id,
        "name": course.get("name"),
        "course_id": course.get("id"),
        "section_id": section_id,
        "chapter_limit": available_course.get("chapter_limit"),
        "total_chapters": len(chapters),
        "completed_chapters": completed,
        "incomplete_chapters": incomplete,
        "missing_progress_records": missing,
        "chapters": chapter_results
    }

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            output({"ok": False, "error": "مدخلات فارغة"})
            return

        credentials = json.loads(raw_input)
        action = credentials.get("action", "login")

        student_id = str(credentials.get("student_id", "")).strip()
        password = str(credentials.get("password", ""))

        if not student_id or not password:
            output({
                "ok": False,
                "error": "رقم الطالب وكلمة المرور مطلوبان"
            })
            return

        session = requests.Session()
        session.headers.update(HEADERS)

        # تسجيل الدخول الأساسي لتفعيل الـ Session في جميع الحالات
        login = session.post(
            PORTAL + "/oauth2/password-login",
            json={
                "student_id": student_id,
                "password": password
            },
            headers={"Referer": PORTAL + "/login"},
            allow_redirects=False,
            timeout=25
        )

        if login.status_code not in (200, 302, 303):
            output({
                "ok": False,
                "stage": "login",
                "status": login.status_code,
                "error": "تعذر تسجيل الدخول"
            })
            return

        user_response = session.get(
            PORTAL + "/oauth2/userinfo",
            allow_redirects=False,
            timeout=25
        )

        if user_response.status_code != 200:
            output({
                "ok": False,
                "stage": "userinfo",
                "status": user_response.status_code,
                "error": "لم يتم تأكيد الجلسة"
            })
            return

        # التعامل مع طلب حل الفصل بعد نجاح تسجيل الدخول
        if action == "solve_chapter":
            chapter_id = credentials.get("chapter_id")
            db_answers_map = credentials.get("db_answers_map", {})

            solve_result = solve_chapter_questions(session, API, chapter_id, db_answers_map)

            output({
                "ok": True,
                "action": "solve_chapter",
                "result": solve_result
            })
            return

        user = user_response.json()

        student_response = session.get(
            API + "/students/me",
            timeout=25
        )
        student_response.raise_for_status()

        courses = []
        course_errors = []

        for available_course in user.get("available_courses", []):
            try:
                result = fetch_course(session, available_course)
                if result:
                    courses.append(result)
            except Exception as error:
                course_errors.append({
                    "content_id": available_course.get("content_id"),
                    "error": str(error)[:250]
                })

        output({
            "ok": True,
            "authenticated": True,
            "user": {
                "id": user.get("id"),
                "name": user.get("name"),
                "permissions": user.get("permissions", []),
                "available_courses": user.get("available_courses", []),
                "lang_code": user.get("lang_code"),
                "courses": [
                    {
                        **course,
                        "automation_summary": summarize_course(course)
                    }
                    for course in courses
                ],
                "course_errors": course_errors
            }
        })

    except requests.Timeout:
        output({
            "ok": False,
            "error": "انتهت مهلة الاتصال بمنصة QUREO"
        })

    except requests.RequestException:
        output({
            "ok": False,
            "error": "تعذر الاتصال بمنصة QUREO"
        })

    except Exception as e:
        output({
            "ok": False,
            "error": f"حدث خطأ أثناء معالجة الطلب: {str(e)}"
        })

if __name__ == "__main__":
    main()
