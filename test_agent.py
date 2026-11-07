import json
import getpass
import subprocess
import sys

sid = input("Student ID: ").strip()
password = getpass.getpass("Password: ")

try:
    result = subprocess.run(
        [sys.executable, "agent.py"],
        input=json.dumps({
            "student_id": sid,
            "password": password
        }),
        capture_output=True,
        text=True,
        timeout=120
    )

    data = json.loads(result.stdout)

    if data.get("stage") in ("userinfo_structure", "course_structure"):
        print(json.dumps(data, ensure_ascii=False, indent=2))
        raise SystemExit

    print("\n===== AGENT TEST =====")
    print("Success:", data.get("ok"))
    print("Authenticated:", data.get("authenticated"))

    if not data.get("ok"):
        print("Error:", data.get("error"))
        print("Stage:", data.get("stage"))
        raise SystemExit

    user = data.get("user", {})
    print("User name:", user.get("name"))
    print("Available courses:", len(user.get("available_courses", [])))
    print("Loaded courses:", len(user.get("courses", [])))

    for course in user.get("courses", []):
        print("\nCourse:", course.get("name"))
        print("Total chapters:", course.get("total_chapters"))
        print("Completed:", course.get("completed_chapters"))
        print("Incomplete:", course.get("incomplete_chapters"))
        print("Missing:", course.get("missing_progress_records"))
        print("Chapter details:", len(course.get("chapters", [])))

    print("\nCourse errors:", len(user.get("course_errors", [])))
    for error in user.get("course_errors", []):
        print(error)

except subprocess.TimeoutExpired:
    print("Agent timed out")
except json.JSONDecodeError:
    print("Invalid JSON from agent")
    print("Exit code:", result.returncode)
    print("Stderr:", result.stderr[:500])
finally:
    password = None
    sid = None
