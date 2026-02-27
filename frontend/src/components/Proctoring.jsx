import { useEffect, useRef, useState, useCallback } from "react";
import { monitoringSocket } from "../sockets/monitoringSocket";

const VIOLATION_LIMIT = 3;

export default function Proctoring({ sessionId, onDisqualified }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionInterval = useRef(null);
  const audioContext = useRef(null);
  const analyser = useRef(null);

  const [violations, setViolations] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState("Initializing...");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const triggerWarning = useCallback((message, type) => {
    setWarningMessage(message);
    setShowWarning(true);
    setWarningCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= VIOLATION_LIMIT) {
        onDisqualified && onDisqualified();
      }
      return newCount;
    });

    setViolations((prev) => [
      { type, message, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ]);

    monitoringSocket.logViolation(type, { message });

    setTimeout(() => setShowWarning(false), 4000);
  }, [onDisqualified]);

  // Initialize camera
  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;
window._proctoringStream = stream;

if (videoRef.current) {
  videoRef.current.srcObject = stream;
  await videoRef.current.play();
  setCameraReady(true);
}

      // Initialize audio analysis
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      source.connect(analyser.current);
      setMicReady(true);

    } catch (err) {
      triggerWarning("Camera/microphone access denied. Please allow access.", "camera_denied");
    }
  };

  // Face detection using canvas pixel analysis
  const detectFace = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Count skin-tone pixels as face detection heuristic
    let skinPixels = 0;
    let totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skin tone detection heuristic
      if (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 15
      ) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / totalPixels;

    if (skinRatio < 0.02) {
      setFaceStatus("No face detected");
      triggerWarning("No face detected. Please stay in front of camera.", "no_face");
    } else if (skinRatio > 0.35) {
      setFaceStatus("Multiple faces detected");
      triggerWarning("Multiple faces detected in frame.", "multiple_faces");
    } else {
      setFaceStatus("Face detected");
    }
  }, [triggerWarning]);

  // Noise detection
  const detectNoise = useCallback(() => {
    if (!analyser.current) return;

    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

    if (average > 40) {
      monitoringSocket.logViolation("noise_detected", { level: average });
    }
  }, []);

  // Fullscreen enforcement
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
    setIsFullscreen(true);
  };

  // Tab visibility change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning("Tab switch detected. Stay on the exam page.", "tab_switch");
        monitoringSocket.logTabSwitch();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        triggerWarning("Fullscreen exited. Please return to fullscreen.", "fullscreen_exit");
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerWarning("Right click is disabled during exam.", "right_click");
    };

    const handleKeyDown = (e) => {
      // Block common copy shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        triggerWarning("Copy shortcut detected.", "copy_attempt");
      }
      // Block alt+tab, cmd+tab
      if ((e.altKey && e.key === "Tab") || (e.metaKey && e.key === "Tab")) {
        e.preventDefault();
        triggerWarning("Tab switching detected.", "tab_switch");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [triggerWarning]);

  // Start proctoring
  useEffect(() => {
    initCamera();
    enterFullscreen();

    detectionInterval.current = setInterval(() => {
      detectFace();
      detectNoise();
    }, 3000);

    return () => {
        clearInterval(detectionInterval.current);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (audioContext.current) {
          audioContext.current.close();
          audioContext.current = null;
        }
        window._proctoringStream = null;
      };
  }, []);
    // Expose stop function globally so ExamPage can call it
useEffect(() => {
    window._stopProctoring = () => {
      clearInterval(detectionInterval.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (audioContext.current) {
        audioContext.current.close();
        audioContext.current = null;
      }
      window._proctoringStream = null;
    };
  
    return () => {
      if (window._stopProctoring) {
        window._stopProctoring();
      }
    };
  }, []);
  return (
    <>
      {/* Warning Overlay */}
      {showWarning && (
        <div style={styles.warningOverlay}>
          <div style={styles.warningBox}>
            <div style={styles.warningIcon}>!</div>
            <div>
              <div style={styles.warningTitle}>
                Warning {warningCount}/{VIOLATION_LIMIT}
              </div>
              <div style={styles.warningMsg}>{warningMessage}</div>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Panel */}
      <div style={styles.panel}>
        {/* Camera Feed */}
        <div style={{ display: "none" }}>
  <video
    ref={videoRef}
    muted
    playsInline
  />
</div>
<canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Status Row */}
        <div style={styles.statusRow}>
          <div style={styles.statusItem}>
            <div style={{
              ...styles.dot,
              background: cameraReady ? "#4ade80" : "#f87171",
            }} />
            <span>Camera</span>
          </div>
          <div style={styles.statusItem}>
            <div style={{
              ...styles.dot,
              background: micReady ? "#4ade80" : "#f87171",
            }} />
            <span>Mic</span>
          </div>
          <div style={styles.statusItem}>
            <div style={{
              ...styles.dot,
              background: isFullscreen ? "#4ade80" : "#fbbf24",
            }} />
            <span>Fullscreen</span>
          </div>
        </div>

        {/* Warning Count */}
        <div style={styles.warningCount}>
          <span style={{
            color: warningCount === 0 ? "#4ade80" :
                   warningCount === 1 ? "#fbbf24" : "#f87171",
            fontWeight: "700",
            fontSize: "13px",
          }}>
            Violations: {warningCount}/{VIOLATION_LIMIT}
          </span>
        </div>

        {/* Recent Violations */}
        {violations.length > 0 && (
          <div style={styles.violationsList}>
            {violations.slice(0, 3).map((v, i) => (
              <div key={i} style={styles.violationItem}>
                <span style={styles.violationType}>{v.type}</span>
                <span style={styles.violationTime}>{v.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fullscreen button */}
        {!isFullscreen && (
          <button onClick={enterFullscreen} style={styles.fullscreenBtn}>
            Enter Fullscreen
          </button>
        )}
      </div>
    </>
  );
}

const styles = {
  warningOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    padding: "16px",
    pointerEvents: "none",
  },
  warningBox: {
    background: "#3a1a1a",
    border: "2px solid #f87171",
    borderRadius: "10px",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    maxWidth: "500px",
    boxShadow: "0 4px 24px rgba(248, 113, 113, 0.3)",
  },
  warningIcon: {
    width: "32px", height: "32px",
    background: "#f87171",
    borderRadius: "50%",
    display: "flex", alignItems: "center",
    justifyContent: "center",
    fontSize: "18px", fontWeight: "900",
    color: "#fff", flexShrink: 0,
  },
  warningTitle: {
    color: "#f87171", fontWeight: "700",
    fontSize: "14px", marginBottom: "2px",
  },
  warningMsg: { color: "#e0e0e0", fontSize: "13px" },
  panel: {
    position: "fixed",
    top: "60px", right: "16px",
    width: "160px",
    background: "#1e1e1e",
    border: "1px solid #3a3a3a",
    borderRadius: "10px",
    padding: "8px",
    zIndex: 1000,
  },
  cameraContainer: {
    position: "relative",
    borderRadius: "6px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  video: {
    width: "100%",
    borderRadius: "6px",
    display: "block",
    transform: "scaleX(-1)",
  },
  cameraStatus: {
    position: "absolute",
    bottom: "4px", left: "4px",
    display: "flex", alignItems: "center",
    gap: "4px",
    background: "rgba(0,0,0,0.7)",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  statusDot: {
    width: "6px", height: "6px",
    borderRadius: "50%",
  },
  statusText: { color: "#fff", fontSize: "9px" },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  statusItem: {
    display: "flex", alignItems: "center",
    gap: "4px", color: "#888", fontSize: "10px",
  },
  dot: { width: "6px", height: "6px", borderRadius: "50%" },
  warningCount: {
    textAlign: "center",
    padding: "4px 0",
    borderTop: "1px solid #2d2d2d",
    borderBottom: "1px solid #2d2d2d",
    marginBottom: "6px",
  },
  violationsList: { display: "flex", flexDirection: "column", gap: "3px" },
  violationItem: {
    display: "flex", justifyContent: "space-between",
    background: "#2a1a1a", borderRadius: "4px",
    padding: "3px 6px",
  },
  violationType: { color: "#f87171", fontSize: "9px" },
  violationTime: { color: "#555", fontSize: "9px" },
  fullscreenBtn: {
    width: "100%", marginTop: "6px",
    background: "#f89f1b22",
    border: "1px solid #f89f1b44",
    color: "#f89f1b", borderRadius: "4px",
    padding: "4px", fontSize: "10px",
    cursor: "pointer",
  },
};