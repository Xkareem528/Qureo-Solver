import requests

SERVER = "https://qureo-solver.onrender.com"

def check_server():
    try:
        response = requests.get(





            f"{SERVER}/api/health",
            timeout=30
        )
        print("Server status:", response.status_code)
        print("Response:", response.text)

    except requests.RequestException as error:
        print("Connection error:", error)

if __name__ == "__main__":
    check_server()
