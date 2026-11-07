import requests
import re

BASE = "https://me-portal.qureo.education"
FILES = [
    "assets/course-permissions-C_L7yXOh.js",
    "assets/assets-BBZSSe2r.js",
    "assets/manifest-0bb8c7e5.js",
]

H = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/"
}

for file in FILES:
    r = requests.get(BASE + "/" + file, headers=H, timeout=25)
    print(f"\n{'='*60}\nFILE: {file}")
    print("STATUS:", r.status_code, "SIZE:", len(r.content))

    if r.status_code != 200:
        continue

    for pattern in [
        r'https?://[^"\'\s`]+',
        r'content_id',
        r'baseUrl',
        r'javascript',
        r'course',
        r'chapter',
        r'lesson',
        r'export\s*\{'
    ]:
        matches = list(re.finditer(pattern, r.text, re.I))
        if matches:
            print(f"\n-- {pattern} ({len(matches)} matches) --")
            for m in matches[:8]:
                print(r.text[max(0,m.start()-250):min(len(r.text),m.end()+500)])
                print("---")
