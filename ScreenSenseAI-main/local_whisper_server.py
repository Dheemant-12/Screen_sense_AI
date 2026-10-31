from flask import Flask, jsonify, request
import os
import shutil
import subprocess
import tempfile
import threading
import traceback

import numpy as np
from faster_whisper import WhisperModel

try:
    import imageio_ffmpeg
except Exception:
    imageio_ffmpeg = None


def load_env_file(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if key and key not in os.environ:
                            os.environ[key] = value
        except Exception as e:
            print(f"Error loading {filepath}: {e}", flush=True)


# Load environment variables from local env files
load_env_file(".env")
load_env_file(".env.local")



app = Flask(__name__)
model = None
model_error = None
model_lock = threading.Lock()
model_name = os.environ.get("WHISPER_MODEL", "tiny")
model_device = os.environ.get("WHISPER_DEVICE", "auto")
model_compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
model_beam_size = int(os.environ.get("WHISPER_BEAM_SIZE", "3"))
min_audio_seconds = float(os.environ.get("WHISPER_MIN_AUDIO_SECONDS", "0.9"))
min_audio_rms = float(os.environ.get("WHISPER_MIN_AUDIO_RMS", "0.003"))
sample_rate = 16000
ffmpeg_path = shutil.which("ffmpeg")
if not ffmpeg_path and imageio_ffmpeg is not None:
    try:
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg_path = None
ffmpeg_available = bool(ffmpeg_path)


def load_audio_with_local_ffmpeg(file, sr=sample_rate):
    cmd = [
        ffmpeg_path or "ffmpeg",
        "-nostdin",
        "-threads",
        "0",
        "-i",
        file,
        "-f",
        "s16le",
        "-ac",
        "1",
        "-acodec",
        "pcm_s16le",
        "-ar",
        str(sr),
        "-",
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, check=True).stdout
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Failed to load audio: {exc.stderr.decode(errors='replace')}") from exc

    return np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0


def get_model():
    global model, model_error
    if model is not None:
        return model

    with model_lock:
        if model is not None:
            return model
        try:
            model_error = None
            model = WhisperModel(model_name, device=model_device, compute_type=model_compute_type)
            return model
        except Exception as exc:
            model_error = str(exc)
            raise


def preload_model():
    try:
        get_model()
    except Exception as exc:
        print(f"Failed to load Whisper model: {exc}", flush=True)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe():
    if request.method == "OPTIONS":
        return ("", 204)

    if not ffmpeg_available:
        return jsonify({"error": "ffmpeg was not found. Run: pip install -r requirements-local-whisper.txt"}), 500

    audio = request.files.get("audio")
    if audio is None:
        return jsonify({"error": "Missing audio upload."}), 400

    language = (request.form.get("language") or "").strip() or None
    prompt = (request.form.get("prompt") or "").strip() or None
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            audio.save(temp_file.name)
            temp_path = temp_file.name

        audio_array = load_audio_with_local_ffmpeg(temp_path)
        duration_seconds = len(audio_array) / sample_rate
        rms = float(np.sqrt(np.mean(np.square(audio_array)))) if len(audio_array) else 0.0
        if duration_seconds < min_audio_seconds or rms < min_audio_rms:
            return jsonify(
                {
                    "text": "",
                    "language": language,
                    "segments": [],
                    "skipped": True,
                    "reason": "too-short-or-silent",
                    "duration": duration_seconds,
                    "rms": rms,
                }
            )

        segments_iter, info = get_model().transcribe(
            audio_array,
            language=language,
            beam_size=model_beam_size,
            temperature=0,
            initial_prompt=prompt,
            condition_on_previous_text=False,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.6,
            no_speech_threshold=0.8,
            vad_filter=True,
        )

        transcript_segments = list(segments_iter)
        segments = []
        for segment in transcript_segments:
            text = segment.text.strip()
            if not text:
                continue
            no_speech_prob = float(getattr(segment, "no_speech_prob", 0.0) or 0.0)
            avg_logprob = getattr(segment, "avg_logprob", None)
            if no_speech_prob > 0.7:
                continue
            if avg_logprob is not None and avg_logprob < -1.6:
                continue
            segments.append(
                {
                    "text": text,
                    "start": segment.start,
                    "end": segment.end,
                    "language": info.language or "",
                    "no_speech_prob": no_speech_prob,
                    "avg_logprob": avg_logprob,
                }
            )
        text = " ".join(segment["text"] for segment in segments).strip()

        return jsonify(
            {
                "text": text,
                "language": info.language or "",
                "segments": segments,
            }
        )
    except RuntimeError as exc:
        message = str(exc)
        if "Failed to load audio" in message or "cannot reshape tensor of 0 elements" in message:
            return jsonify({"text": "", "language": "", "segments": [], "skipped": True, "reason": "audio-decode"}), 200
        print(traceback.format_exc(), flush=True)
        return jsonify({"error": message}), 500
    except Exception as exc:
        print(traceback.format_exc(), flush=True)
        return jsonify({"error": str(exc)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "ok": True,
            "ffmpeg": ffmpeg_available,
            "ffmpeg_path": ffmpeg_path,
            "model": model_name,
            "device": model_device,
            "compute_type": model_compute_type,
            "beam_size": model_beam_size,
            "model_loaded": model is not None,
            "model_error": model_error,
            "min_audio_seconds": min_audio_seconds,
            "min_audio_rms": min_audio_rms,
        }
    )


if __name__ == "__main__":
    threading.Thread(target=preload_model, daemon=True).start()
    app.run(host="127.0.0.1", port=5001)
