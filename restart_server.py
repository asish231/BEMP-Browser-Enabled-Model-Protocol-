import subprocess
import time
import sys
import os

def kill_old_servers():
    """Kill any running bridge_server.py processes"""
    print("Checking for running bridge_server.py processes...")
    try:
        # Windows command to find and kill Python processes running bridge_server.py
        result = subprocess.run(
            ['powershell', '-Command', 
             "Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -and (Get-WmiObject Win32_Process -Filter \"ProcessId = $($_.Id)\").CommandLine -like '*bridge_server.py*'} | Stop-Process -Force"],
            capture_output=True,
            text=True
        )
        print("✓ Killed any old server processes")
    except Exception as e:
        print(f"Note: {e}")

def start_server():
    """Start the bridge server"""
    print("\nStarting Bridge Server v2.0...")
    
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    server_path = os.path.join(script_dir, "bridge_server.py")
    
    # Start the server in a new window
    subprocess.Popen(
        ['python', server_path],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    
    print("✓ Server started in new window")
    print("\nWaiting 3 seconds for server to initialize...")
    time.sleep(3)
    
    # Verify server is running
    try:
        import requests
        response = requests.get("http://localhost:8765/docs", timeout=2)
        if response.status_code == 200:
            print("✓ Server is running and responding!")
            print("\n" + "="*50)
            print("Bridge Server is ready!")
            print("You can now run: python test_protocol.py")
            print("="*50)
        else:
            print("⚠ Server started but not responding correctly")
    except Exception as e:
        print(f"⚠ Could not verify server status: {e}")
        print("The server may still be starting up...")

if __name__ == "__main__":
    print("="*50)
    print("Bridge Server Restart Utility")
    print("="*50 + "\n")
    
    kill_old_servers()
    start_server()
