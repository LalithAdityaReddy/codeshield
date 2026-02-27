import { WS_URL } from "../config/api";

class MonitoringSocket {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.questionId = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
    this.keystrokeBuffer = [];
    this.lastKeystrokeTime = null;
    this.typingSpeedBuffer = [];
  }

  connect(sessionId, token) {
    this.sessionId = sessionId;
    this.token = token;

    const wsUrl = `${WS_URL}/api/monitoring/ws/${sessionId}?token=${token}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("Monitoring WebSocket connected");
      this.reconnectAttempts = 0;
    };

    this.socket.onclose = () => {
      console.log("Monitoring WebSocket disconnected");
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
        this.connect(this.sessionId, this.token);
      }, 2000 * this.reconnectAttempts);
    }
  }

  setQuestion(questionId) {
    this.questionId = questionId;
  }

  sendEvent(type, payload = {}) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.questionId) {
      const event = {
        type,
        question_id: this.questionId,
        payload: {
          ...payload,
          timestamp: Date.now(),
        },
      };
      this.socket.send(JSON.stringify(event));
    }
  }

  logKeypress(key, codeLength) {
    const now = Date.now();

    if (this.lastKeystrokeTime) {
      const gap = now - this.lastKeystrokeTime;
      this.typingSpeedBuffer.push(gap);
      if (this.typingSpeedBuffer.length > 20) {
        this.typingSpeedBuffer.shift();
      }
    }

    this.lastKeystrokeTime = now;

    this.sendEvent("keypress", {
      key: key.length === 1 ? "char" : key,
      code_length: codeLength,
      typing_speed_ms: this.getAvgTypingSpeed(),
    });
  }

  logPaste(codeLength, pastedLength) {
    this.sendEvent("paste", {
      code_length: codeLength,
      pasted_length: pastedLength,
      is_large_paste: pastedLength > 50,
    });
  }

  logFocusOut() {
    this.sendEvent("focus_out", { page: document.title });
  }

  logFocusIn() {
    this.sendEvent("focus_in", {});
  }

  logTabSwitch() {
    this.sendEvent("tab_switch", { url: window.location.href });
  }

  logViolation(type, details = {}) {
    this.sendEvent(type, details);
  }

  getAvgTypingSpeed() {
    if (this.typingSpeedBuffer.length === 0) return 0;
    const avg = this.typingSpeedBuffer.reduce((a, b) => a + b, 0) / this.typingSpeedBuffer.length;
    return Math.round(avg);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const monitoringSocket = new MonitoringSocket();