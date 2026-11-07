import time
import requests
import os

SERVER_URL = "https://qureo-solver.onrender.com"
STUDENT_ID = "475051249"

def start_polling():
    print("[-] QUREO Termux Agent started and listening...")
    while True:
        try:
            response = requests.get(f"{SERVER_URL}/api/get-task?student_id={STUDENT_ID}", timeout=10)
            if response.status_code == 200:
                task = response.json()
                if task and "type" in task:
                    print(f"[!] تم استلام مهمة بنجاح! النوع: {task['type']}")
                    result = {"status": "success", "message": "Done"}
                    requests.post(f"{SERVER_URL}/api/task-result", json=result, timeout=10)
            time.sleep(3)
        except requests.exceptions.ConnectionError:
            print("[!] جاري إعادة محاولة الاتصال بالسيرفر...")
            time.sleep(5)
        except Exception as e:
            print(f"[!] خطأ: {e}")
            time.sleep(5)

if __name__ == "__main__":
    start_polling()
