import os
import sys
import json
import time
import subprocess
import websocket

BASE_URL = os.environ.get(
    "QUREO_RENDER_URL",
    "https://qureo-solver.onrender.com"
).rstrip("/")

SECRET = os.environ.get("AGENT_SECRET", "")
AGENT_FILE = os.path.join(os.path.dirname(__file__), "agent.py")

def connect():
    if not SECRET:
        raise RuntimeError("AGENT_SECRET is not configured")

    url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/agent"

    return websocket.create_connection(
        url,
        header=["Authorization: Bearer " + SECRET],
        timeout=60
    )

def handle_login(ws, message):
    job_id = message.get("id")
    if not isinstance(job_id, str):
        return

    credentials = {
        "student_id": message.get("student_id", ""),
        "password": message.get("password", "")
    }

    try:
        process = subprocess.run(
            [sys.executable, AGENT_FILE],
            input=json.dumps(credentials),
            capture_output=True,
            text=True,
            timeout=36
        )
        result = json.loads(process.stdout.strip())
    except subprocess.TimeoutExpired:
        result = {
            "ok": False,
            "error": "انتهت مهلة تشغيل Agent"
        }
    except Exception:
        result = {
            "ok": False,
            "error": "فشل تشغيل أو قراءة نتيجة Agent"
        }

    ws.send(json.dumps({
        "type": "result",
        "id": job_id,
        "result": result
    }, ensure_ascii=False))

def handle_solve(ws, message):
    job_id = message.get("id")
    if not isinstance(job_id, str):
        return

    payload = {
        "action": "solve_chapter",
        "chapter_id": message.get("chapter_id"),
        "student_id": message.get("student_id", ""),
        "password": message.get("password", "")
    }

    try:
        process = subprocess.run(
            [sys.executable, AGENT_FILE],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=60
        )
        result = json.loads(process.stdout.strip())
    except Exception:
        result = {
            "ok": False,
            "error": "فشل تنفيذ عملية الحل التلقائي"
        }

    ws.send(json.dumps({
        "type": "result",
        "id": job_id,
        "result": result
    }, ensure_ascii=False))

def main():
    print("QUREO Termux Agent starting...")

    while True:
        ws = None
        try:
            print("Connecting to Render...")
            ws = connect()
            print("Connected. Waiting for requests...")

            while True:
                raw = ws.recv()
                if not raw:
                    break

                message = json.loads(raw)
                msg_type = message.get("type")

                if msg_type == "login":
                    handle_login(ws, message)
                elif msg_type == "solve":
                    handle_solve(ws, message)

        except KeyboardInterrupt:
            print("\nAgent stopped.")
            break
        except Exception as error:
            print("Connection error:", str(error))
            time.sleep(5)
        finally:
            if ws:
                try:
                    ws.close()
                except Exception:
                    pass

if __name__ == "__main__":
    main()

