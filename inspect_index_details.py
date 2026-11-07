import requests
import re

url = "https://me-portal.qureo.education/assets/_index-DBiEFjV8.js"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://me-portal.qureo.education/",
    "Sec-Fetch-Dest": "script",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
})

r = s.get(url, timeout=25)
print("STATUS:", r.status_code, "SIZE:", len(r.text))

src = r.text
terms = [
    "available_courses", "course_code", "content_id",
    "chapter", "lesson", "navigate(", "useNavigate",
    "href:", "to:", "fetch(", "axios", "window.location",
    "course-permissions"
]

for term in terms:
    positions = [m.start() for m in re.finditer(re.escape(term), src, re.I)]
    if positions:
        print(f"\n===== {term} ({len(positions)}) =====")
        for pos in positions[:5]:
            print(src[max(0, pos-700):min(len(src), pos+1300)])
            print("\n---")
