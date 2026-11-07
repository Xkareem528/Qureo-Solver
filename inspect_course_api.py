import requests
import re

BASE = "https://me-tp.qureo.education"
URL = BASE + "/assets/js/app.06d8c04590d3065d5365.1792723767.js"

H = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/"
}

r = requests.get(URL, headers=H, timeout=30)
print("STATUS:", r.status_code, "SIZE:", len(r.content))

code = r.text
terms = [
    "/api/study/students/me",
    "/contents/chapter/9901",
    "getChapter",
    "getStudent",
    "fetchedStudentChapters",
    "fetchedBasicChapters",
    "fetchedCourseWithSections",
    "axios.create",
    "baseURL",
    "credentials"
]

for term in terms:
    print("\n" + "=" * 65)
    print("TERM:", term)
    positions = [m.start() for m in re.finditer(re.escape(term), code, re.I)]
    print("COUNT:", len(positions))

    for pos in positions[:5]:
        print("\n--- OFFSET:", pos, "---")
        print(code[max(0, pos-700):min(len(code), pos+1300)])
