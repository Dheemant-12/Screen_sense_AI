import tkinter as tk
import mss
from PIL import Image
import base64
import io
import threading
import time
import requests
import os


NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "").strip()

NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"

MODEL_NAME = "meta/llama-3.2-90b-vision-instruct"

HEADERS = {
    "Authorization": f"Bearer {NVIDIA_API_KEY}",
    "Content-Type": "application/json"
}


def grab_region(region):
    x1, y1, x2, y2 = region
    with mss.mss() as sct:
        monitor = {"top": y1, "left": x1, "width": x2 - x1, "height": y2 - y1}
        screenshot = sct.grab(monitor)
        img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    return img


def image_to_base64(img):
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


def ask_nvidia_vision(img, prompt, max_tokens=200):
    if not NVIDIA_API_KEY:
        return "Missing NVIDIA_API_KEY environment variable."

    img_b64 = image_to_base64(img)

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_b64}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.4
    }

    response = requests.post(NVIDIA_ENDPOINT, headers=HEADERS, json=payload)

    if response.status_code != 200:
        return f"API Error: {response.status_code}\n{response.text}"

    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


class AreaSelector:
    def __init__(self):
        self.region = None
        self.start_x = self.start_y = 0
        self.rect = None

        self.root = tk.Tk()
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-alpha", 0.25)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="black")

        tk.Label(
            self.root,
            text="Draw a box over the area you want  |  Esc to cancel",
            bg="black", fg="white", font=("Arial", 13)
        ).pack(pady=10)

        self.canvas = tk.Canvas(self.root, cursor="crosshair", bg="black")
        self.canvas.pack(fill="both", expand=True)

        self.canvas.bind("<ButtonPress-1>", self.start)
        self.canvas.bind("<B1-Motion>", self.drag)
        self.canvas.bind("<ButtonRelease-1>", self.done)
        self.root.bind("<Escape>", lambda e: self.root.destroy())

    def start(self, event):
        self.start_x, self.start_y = event.x, event.y
        if self.rect:
            self.canvas.delete(self.rect)

    def drag(self, event):
        if self.rect:
            self.canvas.delete(self.rect)
        self.rect = self.canvas.create_rectangle(
            self.start_x, self.start_y, event.x, event.y,
            outline="red", width=2, dash=(6, 4)
        )

    def done(self, event):
        x1, y1 = min(self.start_x, event.x), min(self.start_y, event.y)
        x2, y2 = max(self.start_x, event.x), max(self.start_y, event.y)

        if (x2 - x1) < 30 or (y2 - y1) < 30:
            print("Selected area too small.")
            return

        self.region = (x1, y1, x2, y2)
        self.root.destroy()

    def run(self):
        self.root.mainloop()
        return self.region


class ModeWindow:
    def __init__(self, region):
        self.mode = None
        self.region = region

        self.root = tk.Tk()
        self.root.title("Select Mode")
        self.root.geometry("360x170")
        self.root.configure(bg="#111")
        self.root.attributes("-topmost", True)

        tk.Label(self.root, text="Choose Mode",
                 bg="#111", fg="#aaa",
                 font=("Arial", 12)).pack(pady=20)

        row = tk.Frame(self.root, bg="#111")
        row.pack()

        tk.Button(row, text="Live Captions",
                  command=lambda: self.pick("captions"),
                  bg="#c0392b", fg="white",
                  font=("Arial", 11), width=13).grid(row=0, column=0, padx=8)

        tk.Button(row, text="Scene Explainer",
                  command=lambda: self.pick("explainer"),
                  bg="#1a5276", fg="white",
                  font=("Arial", 11), width=13).grid(row=0, column=1, padx=8)

        self.root.mainloop()

    def pick(self, mode):
        self.mode = mode
        self.root.destroy()


class ResultWindow:
    def __init__(self, mode, region):
        self.mode = mode
        self.region = region
        self.active = True

        self.root = tk.Tk()
        self.root.title("Live Captions" if mode == "captions" else "Scene Explainer")
        self.root.geometry("500x250")
        self.root.configure(bg="#111")
        self.root.attributes("-topmost", True)

        self.text_var = tk.StringVar(value="Processing...")

        tk.Label(self.root, textvariable=self.text_var,
                 bg="#1a1a1a", fg="#eee",
                 font=("Arial", 12),
                 wraplength=460,
                 justify="left",
                 padx=14, pady=14).pack(fill="both", expand=True, padx=10, pady=10)

        tk.Button(self.root, text="Stop",
                  command=self.stop,
                  bg="#333", fg="#ccc").pack(pady=8)

        threading.Thread(target=self.run_loop, daemon=True).start()
        self.root.mainloop()

    def run_loop(self):
        while self.active:
            try:
                img = grab_region(self.region)

                if self.mode == "captions":
                    result = ask_nvidia_vision(
                        img,
                        "Write one short caption (under 12 words).",
                        max_tokens=60
                    )
                else:
                    result = ask_nvidia_vision(
                        img,
                        "Describe what is happening in this image in 3-4 sentences.",
                        max_tokens=300
                    )

                self.text_var.set(result)

            except Exception as e:
                self.text_var.set(f"Error:\n{e}")

            time.sleep(5)

    def stop(self):
        self.active = False
        self.root.destroy()


if __name__ == "__main__":
    selector = AreaSelector()
    region = selector.run()

    if region:
        mode_window = ModeWindow(region)

        if mode_window.mode:
            ResultWindow(mode_window.mode, region)
        else:
            print("No mode selected.")
    else:
        print("No area selected.")
