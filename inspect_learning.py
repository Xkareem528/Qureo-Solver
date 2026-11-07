import requests
import re
from urllib.parse import urljoin

BASE = "https://learning.programming-sc.com/"

s = requests.Session()
s.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*"
})

r = s.get(BASE, timeout=25)
print("STATUS:", r.status_code)
print("FINAL URL:", r.url)
print("SIZE:", len(r.text))
print("\n=== HTML ===")
print(r.text[:15000])

print("\n=== ASSETS ===")
for item in re.findall(r'''(?:src|href)=["']([^"']+\.(?:js|json|wasm))[^"']*["']''', r.text, re.I):
    print(urljoin(BASE, item))
