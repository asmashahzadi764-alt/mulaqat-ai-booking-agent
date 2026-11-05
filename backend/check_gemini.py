"""Run once from the backend folder (venv active):  python check_gemini.py
Tries several models and tells you which ones work right now."""
import os
import sys

from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GEMINI_API_KEY")
if not key:
    sys.exit("GEMINI_API_KEY nahi mili. backend/.env check karein.")
print(f"Key loaded: {len(key)} characters, starts with {key[:3]}")

from google import genai  # noqa: E402

client = genai.Client(api_key=key)
candidates = [os.getenv("GEMINI_MODEL", "gemini-flash-latest"), "gemini-3.1-flash-lite",
              "gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-3.5-flash"]
seen, working = set(), []
for model in candidates:
    if model in seen:
        continue
    seen.add(model)
    try:
        r = client.models.generate_content(model=model, contents="Roman Urdu mein ek lafz mein salaam kaho")
        print(f"OK      {model}: {(r.text or '').strip()[:40]}")
        working.append(model)
    except Exception as e:
        msg = str(e).replace("\n", " ")[:110]
        print(f"FAILED  {model}: {type(e).__name__} {msg}")
print("\nChalne wale models:", ", ".join(working) or "koi nahi (thori der baad dobara try karein)")
if working:
    print(f"Tajweez: .env mein GEMINI_MODEL={working[0]}")