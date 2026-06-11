from dotenv import load_dotenv
import os
from google import genai

load_dotenv("backend/.env")

api_key = os.getenv("GEMINI_API_KEY")

print("KEY =", api_key)

client = genai.Client(
    api_key=api_key
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello"
)

print(response.text)