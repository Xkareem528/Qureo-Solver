import os
import sys
import json
import time
import subprocess
import requests

BASE_URL = os.environ.get(
    "QUREO_RENDER_URL",
    "https://qureo-solver.onrender.com"
).rstrip("/")

SECRET = os.environ.get("AGENT_SECRET", "")
AGENT_FILE = os.path.join(os.path.dirname(__file__), "agent.py")

def main():
    print("QUREO Termux Agent starting (Verbose Polling Mode)...")
    headers = {"Authorization": f"Bearer {SECRET}"}

    if not SECRET:
        print("[!] تحذير: AGENT_SECRET غير معرف!")

    while True:
        try:
            response = requests.get(f"{BASE_URL}/agent/poll", headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                job = data.get("job")
                
                if job:
                    job_id = job.get("id")
                    job_type = job.get("type")
                    print(f"\n[!] تم استلام مهمة جديدة ({job_type})... جاري التنفيذ الآن...")

                    payload = {
                        "action": "solve_chapter" if job_type == "solve" else "login",
                        "chapter_id": job.get("chapter_id"),
                        "student_id": job.get("student_id", ""),
                        "password": job.get("password", "")
                    }

                    # تشغيل الأージェنت مع طباعة مخرجاته مباشرة على شاشة Termux لنرى أين يقف
                    process = subprocess.Popen(
                        [sys.executable, AGENT_FILE],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True
                    )

                    # إرسال البيانات وتشغيل السكربت
                    try:
                        stdout_data, _ = process.communicate(input=json.dumps(payload), timeout=300)
                        print(stdout_data)
                        
                        # استخراج النتيجة الأخيره
                        lines = [line.strip() for line in stdout_data.split('\n') if line.strip()]
                        result = {"ok": False, "error": "لم يتم العثور على نتيجة صحيحة"}
                        for line in reversed(lines):
                            if line.startswith("{") and line.endswith("}"):
                                try:
                                    result = json.loads(line)
                                    break
                                except:
                                    pass
                    except subprocess.TimeoutExpired:
                        process.kill()
                        print("[!] انتهت مهلة التنفيذ (Timeout) بعد 5 دقائق.")
                        result = {"ok": False, "error": "انتهت مدة حل الفصل في Termux"}

                    # إرسال النتيجة للسيرفر
                    try:
                        res = requests.post(
                            f"{BASE_URL}/agent/result",
                            headers=headers,
                            json={"id": job_id, "result": result},
                            timeout=30
                        )
                        print(f"[+] تم إرسال النتيجة للسيرفر، حالة الاستجابة: {res.status_code}")
                    except Exception as post_err:
                        print(f"[!] خطأ أثناء إرسال النتيجة للسيرفر: {post_err}")
            
            time.sleep(3)

        except KeyboardInterrupt:
            print("\nAgent stopped.")
            break
        except Exception as e:
            time.sleep(3)

if __name__ == "__main__":
    main()
