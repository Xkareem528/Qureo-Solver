import requests
import re

BASE = "https://me-portal.qureo.education"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/",
    "Sec-Fetch-Dest": "script",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
})

files = [
    "/assets/_index-DBiEFjV8.js",
    "/assets/home-CoWmeASa.js",
]

patterns = [
    r'["\']([^"\']*(?:/api/|/oauth2/)[^"\']*)["\']',
    r'fetch\([^)]{1,500}\)',
    r'axios\.[a-z]+\([^)]{1,500}\)',
    r'["\'][^"\']*(?:chapter|lesson|course|level|question)[^"\']*["\']',
]

for path in files:
    print("\n" + "=" * 20, path, "=" * 20)
    try:
        r = s.get(BASE + path, timeout=25)
        print("STATUS:", r.status_code, "| SIZE:", len(r.text))
        if r.status_code != 200:
            continue

        found = set()
        for pattern in patterns:
            for item in re.findall(pattern, r.text, re.I):
                found.add(item)

        if found:
            for item in sorted(found):
                print(item[:1000])
        else:
            print("No matching API/course strings found.")
            print(r.text[:5000])

    except requests.RequestException as e:
        print("ERROR:", e)
