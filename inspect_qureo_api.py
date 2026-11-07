import re
import requests
from collections import defaultdict

BASE = "https://me-portal.qureo.education"

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/login",
    "Sec-Fetch-Dest": "script",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
}

session = requests.Session()
session.headers.update(headers)

assets = [
    "/assets/entry.client-CWfgEH-F.js",
    "/assets/login-NZcRHQMc.js",
    "/assets/course-permissions-C_L7yXOh.js"
]

try:
    page = session.get(BASE + "/login", timeout=25)
    print("Login page:", page.status_code)

    for path in re.findall(r'<script[^>]+src=["\']([^"\']+)', page.text):
        if path.startswith("/assets/") and path not in assets:
            assets.append(path)

    results = defaultdict(set)

    for path in assets:
        try:
            response = session.get(BASE + path, timeout=25)
            if response.status_code != 200:
                continue

            content = response.text
            print("\nASSET:", path, "| SIZE:", len(content))

            candidates = re.findall(
                r'''["'`]([^"'`]{1,180})["'`]''',
                content
            )

            for value in candidates:
                low = value.lower()
                if (
                    value.startswith("/")
                    or any(word in low for word in (
                        "chapter", "lesson", "question",
                        "course", "content", "level",
                        "progress", "activity"
                    ))
                ):
                    results[path].add(value)

        except requests.RequestException:
            print("Asset request failed:", path)

    print("\n========== DISCOVERED ROUTES / STRINGS ==========")

    for path, values in results.items():
        print("\n", path)
        for value in sorted(values):
            print(value)

except requests.RequestException as error:
    print("NETWORK ERROR:", type(error).__name__)
