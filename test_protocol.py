import requests
import json
import sys

def send_prompt(model, prompt, new_chat=False):
    url = "http://localhost:8765/send"
    payload = {
        "model": model,
        "prompt": prompt,
    }
    
    try:
        print(f"\n--- Sending prompt to {model} (New Chat: {new_chat}) ---")
        print(f"Prompt: {prompt}\n")
        
        with requests.post(url, json=payload, stream=True) as response:
            if response.status_code == 200:
                print("AI Response:", end=" ", flush=True)
                
                for line in response.iter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "type" not in data:
                                print(f"\nUnknown message format: {data}")
                                continue
                                
                            if data["type"] == "chunk":
                                print(data["text"], end="", flush=True)
                            elif data["type"] == "status":
                                print(f"\n[Status: {data['text']}]", end="\nAI Response: ", flush=True)
                            elif data["type"] == "done":
                                print("\n\n[Done]")
                                break
                            elif data["type"] == "error":
                                print(f"\nError: {data['text']}")
                        except json.JSONDecodeError:
                            print(f"\nFailed to decode JSON: {line}")
                        except Exception as e:
                            print(f"\nError processing line: {e}")
            else:
                print(f"Error {response.status_code}:", response.text)
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to Bridge Server. Is 'python bridge_server.py' running?")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Test Gemini with New Chat
    send_prompt("gemini", "okay hey so can you create me a hellowrld python code.", new_chat=True)

    # Uncomment any of the below to test other providers
    # send_prompt("chatgpt", "Write a short poem about AI.")
    # send_prompt("deepseek", "Summarize the plot of The Matrix in 2 sentences.")
    # send_prompt("qwen", "List 5 use-cases for LLMs in education.")
    # send_prompt("kimi", "Translate 'Good morning' to Japanese and explain the politeness level.")
    # send_prompt("venice", "Explain the concept of overfitting in ML like I'm 12.")
    # send_prompt("blackbox", "Write a JavaScript function to debounce another function.")
