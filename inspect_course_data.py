import requests
import getpass
import json

PORTAL = "https://me-portal.qureo.education"
API = "https://me-tp.qureo.education/api/study"

H = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Referer": "https://me-tp.qureo.education/"
}

s = requests.Session()
s.headers.update(H)

student_id = input("Student ID: ").strip()
password = getpass.getpass("Password: ")

print("\n[1] Logging in...")
login = s.post(
    PORTAL + "/oauth2/password-login",
    json={"student_id": student_id, "password": password},
    headers={"Referer": PORTAL + "/login"},
    allow_redirects=False,
    timeout=30
)
password = None
student_id = None

print("Login status:", login.status_code)

if login.status_code not in (200, 302):
    print("Login failed.")
    raise SystemExit

me = s.get(API + "/students/me", timeout=30)
print("\n[2] Student API status:", me.status_code)

if me.status_code != 200:
    print(me.text[:500])
    raise SystemExit

print("Student endpoint: OK")

for course_id in ("javascript_ar", "javascript_trial_ar", "javascript", "javascript_trial"):
    print(f"\n[3] Checking course: {course_id}")
    r = s.get(f"{API}/courses/{course_id}", timeout=30)
    print("Course status:", r.status_code)

    if r.status_code != 200:
        continue

    try:
        data = r.json()
    except ValueError:
        print("Response is not JSON")
        continue

    course = data.get("course", {})
    section = data.get("basic_section", {})
    section_id = section.get("id")

    print("Course name:", course.get("name"))
    print("Section ID:", section_id)

    if not section_id:
        print("No section ID returned.")
        continue

    sec = s.get(f"{API}/sections/{section_id}", timeout=30)
    print("Sections status:", sec.status_code)

    if sec.status_code != 200:
        print(sec.text[:500])
        continue

    section_data = sec.json()
    chapters = section_data.get("chapters", [])
    print("Chapters returned:", len(chapters))

    for ch in chapters[:5]:
        print({
            "id": ch.get("id"),
            "seq": ch.get("seq"),
            "name": ch.get("name"),
            "question_count": ch.get("question_count"),
            "test_type": ch.get("test_type")
        })

    progress = s.get(
        f"{API}/students/sections/{section_id}/chapters",
        timeout=30
    )
    print("Progress status:", progress.status_code)

    if progress.status_code == 200:
        records = progress.json()
        print("Progress records:", len(records))
        for item in records[:5]:
            print({
                "chapter_id": item.get("chapter_id"),
                "started_at": item.get("started_at"),
                "completed_at": item.get("completed_at"),
                "best_correct_count": item.get("best_correct_count"),
                "diamond": item.get("diamond")
            })

    break
else:
    print("\nNo matching course ID worked.")
