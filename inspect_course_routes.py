import requests
import re

BASE = "https://me-portal.qureo.education"
URL = BASE + "/assets/_index-DBiEFjV8.js"

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/",
    "Sec-Fetch-Dest": "script",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
}

r = requests.get(URL, headers=headers, timeout=25)
print("STATUS:", r.status_code, "SIZE:", len(r.text))

patterns = [
    "javascript_ar",
    "javascript_trial_ar",
    "content_id",
    "course_code",
    "availableCourses",
    "baseUrl",
    "programming-sc.com",
    "chapter",
    "lesson"
]

seen = set()
for term in patterns:
    print(f"\n{'='*15} {term} {'='*15}")
    for m in re.finditer(re.escape(term), r.text, re.I):
        start = max(0, m.start() - 500)
        end = min(len(r.text), m.end() + 900)
        snippet = r.text[start:end]
        if snippet not in seen:
            seen.add(snippet)
            print(snippet, "\n---")
