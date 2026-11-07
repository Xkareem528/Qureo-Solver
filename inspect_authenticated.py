import requests
import getpass
import re
from urllib.parse import urljoin

BASE = "https://me-portal.qureo.education"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/login",
    "Origin": BASE
})

student_id = input("Student ID: ").strip()
password = getpass.getpass("Password (hidden): ")

try:
    login = s.post(
        BASE + "/oauth2/password-login",
        json={"student_id": student_id, "password": password},
        allow_redirects=False,
        timeout=25
    )

    print("Login status:", login.status_code)

    if login.status_code not in (200, 302, 303):
        print("Login failed.")
        raise SystemExit(1)

    user = s.get(BASE + "/oauth2/userinfo", timeout=25)
    print("UserInfo status:", user.status_code)

    if user.status_code != 200:
        print("Authentication not confirmed.")
        raise SystemExit(1)

    page = s.get(BASE + "/", timeout=30)
    print("Portal status:", page.status_code)
    print("Final URL:", page.url)

    scripts = set(
        re.findall(
            r'<script[^>]+src=["\']([^"\']+)',
            page.text
        )
    )

    print("\n=== PAGE SCRIPTS ===")
    for src in sorted(scripts):
        print(src)

    print("\n=== RELEVANT ROUTES IN HTML ===")
    for value in sorted(set(re.findall(
        r'''["']([^"'']{1,180})["']''',
        page.text
    ))):
        if any(word in value.lower() for word in (
            "course", "chapter", "lesson", "level", "content"
        )):
            print(value)

    print("\n=== AUTHENTICATED PAGE SUMMARY ===")
    print("HTML length:", len(page.text))
    print("Title:", re.search(
        r"<title[^>]*>(.*?)</title>",
        page.text,
        re.I | re.S
    ).group(1).strip() if re.search(
        r"<title[^>]*>(.*?)</title>",
        page.text,
        re.I | re.S
    ) else "Not found")

except requests.RequestException as e:
    print("Network error:", type(e).__name__)

finally:
    password = None
    student_id = None
