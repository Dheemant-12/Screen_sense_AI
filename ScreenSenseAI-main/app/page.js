'use client';
import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState('idle');
  const [captions, setCaptions] = useState([]);
  const [scene, setScene] = useState('');
  const [summary, setSummary] = useState('');
  const [mode, setMode] = useState('captions');
  const [userKey, setUserKey] = useState('');
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [timer, setTimer] = useState(0);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptRef = useRef([]);
  const scenesRef = useRef([]);

  useEffect(() => {
    return () => stopSession();
  }, []);

  async function startSession() {
    try {
      setStatus('starting');
      setCaptions([]);
      setScene('');
      setSummary('');
      setQuotaExhausted(false);
      transcriptRef.current = [];
      scenesRef.current = [];

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: true,
      });
      streamRef.current = stream;
      setStatus('running');
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);

      if (mode === 'captions' || mode === 'summariser') {
        startAudioCapture(stream);
      }
      if (mode === 'scene' || mode === 'summariser') {
        startSceneCapture(stream);
      }

      stream.getVideoTracks()[0].addEventListener('ended', stopSession);
    } catch (err) {
      setStatus('idle');
      alert('Could not start screen capture: ' + err.message);
    }
  }

  function startAudioCapture(stream) {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;
    const audioStream = new MediaStream(audioTracks);
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(audioStream, { mimeType });
    recorderRef.current = recorder;

    recorder.addEventListener('dataavailable', async (e) => {
      if (!e.data || e.data.size === 0) return;
      const formData = new FormData();
      formData.append('audio', e.data, 'chunk.webm');
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.text && data.text.trim()) {
          const entry = { text: data.text.trim(), time: formatTime(timer) };
          transcriptRef.current.push(entry);
          setCaptions(prev => [...prev, entry]);
        }
      } catch {}
    });

    recorder.addEventListener('stop', () => {
      if (streamRef.current) {
        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 4000);
      }
    });

    recorder.start();
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 4000);
  }

  function startSceneCapture(stream) {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    const interval = setInterval(async () => {
      if (!streamRef.current) { clearInterval(interval); return; }
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvas.getContext('2d').drawImage(video, 0, 0, 1280, 720);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      const transcript = transcriptRef.current.slice(-3).map(e => e.text).join(' ');

      try {
        const res = await fetch('/api/scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, transcript, userKey }),
        });
        const data = await res.json();
        if (data.quotaExhausted) { setQuotaExhausted(true); return; }
        if (data.explanation) {
          const entry = { text: data.explanation, time: formatTime(timer) };
          scenesRef.current.push(entry);
          setScene(data.explanation);
        }
      } catch {}
    }, 10000);
  }

  async function stopSession() {
    clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStatus('idle');

    if (mode === 'summariser' && transcriptRef.current.length > 0) {
      setStatus('summarising');
      const transcript = transcriptRef.current.map(e => `[${e.time}] ${e.text}`).join('\n');
      const scenes = scenesRef.current.map(e => `[${e.time}] ${e.text}`).join('\n');
      try {
        const res = await fetch('/api/summarise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, scenes, userKey }),
        });
        const data = await res.json();
        if (data.quotaExhausted) { setQuotaExhausted(true); }
        else if (data.summary) { setSummary(data.summary); }
      } catch {}
      setStatus('idle');
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>ScreenSense AI</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>AI-powered screen captions and analysis</p>

      {/* Download desktop app banner */}
      <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe',
        borderRadius: 8, padding: 16, marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontWeight: 600, margin: 0, marginBottom: 4 }}>
            Want the full desktop experience?
          </p>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
            Download the Electron app for system audio capture, always-on-top overlay, and offline mode.
          </p>
        </div>
        <a href="https://github.com/chanikya07/ScreenSenseAI/releases"
          target="_blank" rel="noopener noreferrer"
          style={{ padding: '9px 20px', background: '#24292f', color: '#fff',
            borderRadius: 8, textDecoration: 'none', fontWeight: 600,
            fontSize: 13, whiteSpace: 'nowrap' }}>
          ⬇ Download Desktop App
        </a>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['captions', 'scene', 'summariser'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd',
              background: mode === m ? '#7c6cfc' : '#fff',
              color: mode === m ? '#fff' : '#333', cursor: 'pointer', fontWeight: 500 }}>
            {m === 'captions' ? '💬 Live Captions' : m === 'scene' ? '👁 Scene Explainer' : '✨ Summariser'}
          </button>
        ))}
      </div>

      {/* Start / Stop button */}
      <button onClick={status === 'running' ? stopSession : startSession}
        disabled={status === 'starting' || status === 'summarising'}
        style={{ padding: '10px 24px', borderRadius: 8, border: 'none',
          background: status === 'running' ? '#ff4757' : '#7c6cfc',
          color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 16 }}>
        {status === 'idle' ? '▶ Start' : status === 'running' ? '■ Stop' :
         status === 'starting' ? 'Starting...' : 'Generating summary...'}
      </button>

      {status === 'running' && (
        <span style={{ marginLeft: 12, color: '#666', fontSize: 13 }}>
          ⏱ {formatTime(timer)}
        </span>
      )}

      {/* BYOK prompt */}
      {quotaExhausted && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffc107',
          borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Free quota used up for today</p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Enter your own Groq or OpenAI API key to continue, or come back tomorrow.
          </p>
          <input placeholder="gsk_... or sk-..."
            value={userKey} onChange={e => setUserKey(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid #ddd', fontSize: 13, marginBottom: 8 }} />
          <button onClick={() => setQuotaExhausted(false)}
            style={{ padding: '7px 16px', background: '#7c6cfc', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Save and continue
          </button>
        </div>
      )}

      {/* Captions output */}
      {(mode === 'captions' || mode === 'summariser') && captions.length > 0 && (
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Live Captions</p>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {captions.map((c, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#999', marginRight: 8 }}>{c.time}</span>{c.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scene output */}
      {(mode === 'scene' || mode === 'summariser') && scene && (
        <div style={{ background: '#fff8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Scene Explainer</p>
          <p style={{ fontSize: 13 }}>{scene}</p>
        </div>
      )}

      {/* Summary output */}
      {summary && (
        <div style={{ background: '#f0f8ff', borderRadius: 8, padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Summary</p>
          <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
            {summary}
          </pre>
        </div>
      )}
    </main>
  );
}
