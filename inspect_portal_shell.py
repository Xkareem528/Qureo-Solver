import requests
import re

BASE = "https://me-portal.qureo.education"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/login"
})

page = s.get(BASE + "/", timeout=25)
print("STATUS:", page.status_code)
print("\n=== HTML ===")
print(page.text)

print("\n=== MANIFEST / CONFIG REFERENCES ===")
for match in re.findall(r'''["']([^"']*(?:manifest|entry|routes|assets)[^"']*)["']''', page.text, re.I):
    print(match)

print("\n=== SCRIPT REFERENCES ===")
for match in re.findall(r'<script[^>]+src=["\']([^"\']+)', page.text):
    print(match)
