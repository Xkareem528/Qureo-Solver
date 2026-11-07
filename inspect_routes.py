import requests

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
    "/assets/manifest-0bb8c7e5.js",
    "/assets/root-5nJjXjCB.js"
]

for path in files:
    print("\n" + "=" * 25, path, "=" * 25)
    try:
        r = s.get(BASE + path, timeout=25)
        print("STATUS:", r.status_code, "| TYPE:", r.headers.get("Content-Type"))
        print("SIZE:", len(r.text))
        print(r.text[:30000])
    except requests.RequestException as e:
        print("ERROR:", str(e))
