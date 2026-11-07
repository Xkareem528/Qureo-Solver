import requests
import getpass

PORTAL = "https://me-portal.qureo.education"
API = "https://me-tp.qureo.education/api/study"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
})

sid = input("Student ID: ").strip()
password = getpass.getpass("Password: ")

r = s.post(
    PORTAL + "/oauth2/password-login",
    json={"student_id": sid, "password": password},
    allow_redirects=False
)

print("Login:", r.status_code)

if r.status_code not in (200, 302):
    print("Login failed")
    raise SystemExit

for course_id in [
    "javascript_trial_ar",
    "javascript_trial",
    "javascript_ar",
]:
    try:
        r = s.get(f"{API}/courses/{course_id}", timeout=20)
        print(course_id, "->", r.status_code)
        if r.ok:
            data = r.json()
            print("  Course:", data.get("course", {}).get("name"))
            print("  Section:", data.get("basic_section", {}).get("id"))
    except Exception as e:
        print(course_id, "->", type(e).__name__)

password = None
sid = None
