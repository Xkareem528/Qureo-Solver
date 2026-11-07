import requests
import getpass
from urllib.parse import urlparse
from html.parser import HTMLParser

PORTAL = "https://me-portal.qureo.education"
COURSE = "https://me-tp.qureo.education/"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
})

student_id = input("Student ID: ").strip()
password = getpass.getpass("Password: ")

try:
    login = s.post(
        PORTAL + "/oauth2/password-login",
        json={"student_id": student_id, "password": password},
        headers={"Referer": PORTAL + "/login"},
        allow_redirects=False,
        timeout=25
    )
    print("\nLOGIN STATUS:", login.status_code)
    print("LOGIN REDIRECT:", login.headers.get("Location", "none"))

    if login.status_code not in (200, 302, 303):
        print("Login did not return a successful status.")
        raise SystemExit

    info = s.get(PORTAL + "/oauth2/userinfo", timeout=25)
    print("USERINFO STATUS:", info.status_code)

    if info.status_code != 200:
        print("Could not confirm authenticated session.")
        raise SystemExit

    data = info.json()
    print("AVAILABLE COURSES:")
    for c in data.get("available_courses", []):
        print("-", c.get("content_id"), "|", c.get("course_code"))

    print("\nCOOKIE DOMAINS:")
    for c in s.cookies:
        print("-", c.domain, c.name)

    for content_id in ("javascript_ar", "javascript_trial_ar"):
        print("\n" + "=" * 45)
        print("TEST:", content_id)

        r = s.get(
            COURSE,
            params={"content_id": content_id},
            allow_redirects=True,
            timeout=30
        )
        print("STATUS:", r.status_code)
        print("FINAL URL:", r.url)
        print("CONTENT TYPE:", r.headers.get("content-type"))
        print("HTML SIZE:", len(r.content))
        print("PAGE TITLE:", (
            r.text.split("<title>", 1)[1].split("</title>", 1)[0]
            if "<title>" in r.text else "not found"
        ))

        import re
        scripts = re.findall(
            r'<script[^>]+src=["\']([^"\']+)',
            r.text,
            re.I
        )
        print("SCRIPT FILES:", scripts[:15])
        print("HTML PREVIEW:", r.text[:700].replace("\n", " "))

except requests.RequestException as e:
    print("NETWORK ERROR:", type(e).__name__, str(e))
finally:
    password = None
    student_id = None
