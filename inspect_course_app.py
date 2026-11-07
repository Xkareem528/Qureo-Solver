import requests
import re
from html.parser import HTMLParser
from urllib.parse import urljoin

BASE = "https://me-tp.qureo.education/"
H = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE
}

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.srcs = []
    def handle_starttag(self, tag, attrs):
        if tag == "script":
            src = dict(attrs).get("src")
            if src:
                self.srcs.append(src)

s = requests.Session()
s.headers.update(H)

page = s.get(BASE, timeout=30)
print("PAGE:", page.status_code, "SIZE:", len(page.content))

parser = Scripts()
parser.feed(page.text)

for src in parser.srcs:
    url = urljoin(BASE, src)
    r = s.get(url, timeout=30)
    print("\n" + "=" * 55)
    print("SCRIPT:", src)
    print("STATUS:", r.status_code, "SIZE:", len(r.content))

    if r.status_code != 200:
        continue

    code = r.text
    endpoints = set(re.findall(
        r'''["']((?:https?://[^"' ]+|/[^"' ]*(?:api|graphql|chapter|lesson|progress)[^"' ]*))["']''',
        code, re.I
    ))

    print("ENDPOINT-LIKE STRINGS:")
    for item in sorted(endpoints)[:35]:
        print(" ", item[:250])

    for term in ["chapter", "lesson", "progress", "content_id",
                 "fetch(", "axios", "graphql"]:
        matches = list(re.finditer(re.escape(term), code, re.I))
        if matches:
            print(f"\n{term}: {len(matches)} occurrences")
            for m in matches[:3]:
                print(code[max(0,m.start()-180):m.end()+350])
                print("---")
