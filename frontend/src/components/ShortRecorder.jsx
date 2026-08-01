import { useEffect, useRef, useState } from 'react';

const MAX_DURATION_SECONDS = 60;

export default function ShortRecorder({ onSend, onClose }) {
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        alert('Could not access camera: ' + err.message);
        onClose();
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);

    // Hard cap at MAX_DURATION_SECONDS - this is the only enforcement of
    // the length limit; see README for why there's no server-side check.
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev + 1 >= MAX_DURATION_SECONDS) {
          stopRecording();
          return MAX_DURATION_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setSeconds(0);
  };

  const handleSend = () => {
    if (!recordedBlob) return;
    // Package the recorded blob as a File so it flows through the exact
    // same upload endpoint (/api/messages/upload) as any other attachment -
    // no separate "shorts" backend route needed.
    const file = new File([recordedBlob], `short-${Date.now()}.webm`, { type: 'video/webm' });
    onSend(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="short-recorder-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Record a Short</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="short-recorder-preview">
          {recordedUrl ? (
            <video src={recordedUrl} controls autoPlay loop />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline />
          )}
          {recording && <div className="recording-timer">🔴 {seconds}s / {MAX_DURATION_SECONDS}s</div>}
        </div>

        <div className="short-recorder-controls">
          {!recordedBlob && !recording && (
            <button className="record-btn" onClick={startRecording}>● Start Recording</button>
          )}
          {recording && (
            <button className="stop-btn" onClick={stopRecording}>■ Stop</button>
          )}
          {recordedBlob && (
            <>
              <button className="retake-btn" onClick={handleRetake}>Retake</button>
              <button className="send-short-btn" onClick={handleSend}>Send</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
