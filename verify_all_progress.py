import requests
import getpass
from collections import Counter

PORTAL = "https://me-portal.qureo.education"
API = "https://me-tp.qureo.education/api/study"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Referer": "https://me-tp.qureo.education/"
})

sid = input("Student ID: ").strip()
password = getpass.getpass("Password: ")

r = s.post(
    PORTAL + "/oauth2/password-login",
    json={"student_id": sid, "password": password},
    headers={"Referer": PORTAL + "/login"},
    allow_redirects=False,
    timeout=30
)
password = sid = None

if r.status_code not in (200, 302):
    raise SystemExit("Login failed")

course = s.get(API + "/courses/javascript_ar", timeout=30)
course.raise_for_status()
section_id = course.json()["basic_section"]["id"]

section = s.get(f"{API}/sections/{section_id}", timeout=30)
section.raise_for_status()
chapters = section.json()["chapters"]

progress = s.get(
    f"{API}/students/sections/{section_id}/chapters",
    timeout=30
)
progress.raise_for_status()
records = progress.json()

by_id = {x["chapter_id"]: x for x in records}
complete = []
incomplete = []
missing = []

for ch in chapters:
    p = by_id.get(ch["id"])

    if p is None:
        missing.append(ch)
    elif p.get("completed_at"):
        complete.append((ch, p))
    else:
        incomplete.append((ch, p))

print("\n===== REAL COURSE PROGRESS =====")
print("Total chapters:", len(chapters))
print("Completed:", len(complete))
print("Incomplete:", len(incomplete))
print("Missing progress records:", len(missing))
print("Diamond distribution:", dict(Counter(
    str(p.get("diamond")) for _, p in complete
)))

if incomplete:
    print("\nINCOMPLETE:")
    for ch, p in incomplete:
        print(ch["seq"], ch["name"], "| started:", bool(p.get("started_at")))

if missing:
    print("\nMISSING RECORDS:")
    for ch in missing:
        print(ch["seq"], ch["name"])

print("\nAll chapters accounted for:",
      len(complete) + len(incomplete) + len(missing) == len(chapters))
