import requests
import getpass
import json

BASE = "https://me-portal.qureo.education"

headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Referer": BASE + "/login",
    "Origin": BASE,
    "Content-Type": "application/json",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

session = requests.Session()
session.headers.update(headers)

print("=== QUREO Login Test ===")
student_id = input("Student ID: ").strip()
password = getpass.getpass("Password (hidden): ")

if not student_id or not password:
    print("ERROR: Missing login information.")
    raise SystemExit(1)

try:
    response = session.post(
        BASE + "/oauth2/password-login",
        json={"student_id": student_id, "password": password},
        allow_redirects=False,
        timeout=30,
    )

    print("\n--- Login Result ---")
    print("HTTP Status:", response.status_code)
    print("Redirect:", "Yes" if response.is_redirect else "No")
    print("Session Cookie:", "Present" if session.cookies else "Not present")

    if response.status_code in (200, 302, 303):
        print("\nChecking authenticated user...")
        user = session.get(
            BASE + "/oauth2/userinfo",
            allow_redirects=False,
            timeout=30,
        )

        print("UserInfo Status:", user.status_code)

        if user.status_code == 200:
            try:
                data = user.json()
                print("LOGIN SUCCESS")
                print("Name:", data.get("name", "Unavailable"))
                print("Available Courses:", len(data.get("available_courses", [])))
                print("Permissions:", data.get("permissions", []))
            except ValueError:
                print("Login response received, but user data was not valid JSON.")
        else:
            print("LOGIN NOT CONFIRMED")
            print("UserInfo did not return an authenticated user.")
    else:
        print("LOGIN NOT CONFIRMED")
        try:
            data = response.json()
            print("Error:", data.get("error", "No error code provided"))
        except ValueError:
            print("The server returned a non-JSON response.")

except requests.RequestException as error:
    print("NETWORK ERROR:", type(error).__name__)

finally:
    password = None
    student_id = None
