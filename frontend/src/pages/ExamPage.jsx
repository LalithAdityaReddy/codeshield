import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import toast from "react-hot-toast";
import { getTestById, startTestSession, getQuestions, completeTestSession } from "../services/testService";
import { submitCode } from "../services/submissionService";
import { formatTime } from "../utils/formatTime";
import useAuthStore from "../store/authStore";
import Proctoring from "../components/Proctoring";
import { monitoringSocket } from "../sockets/monitoringSocket";

const LANGUAGES = ["python3", "javascript", "java", "cpp"];

const getStarterCode = (question, lang) => {
  if (question?.function_signature && lang === "python3") {
    return `class Solution:\n    ${question.function_signature}\n        # Write your solution here\n        pass\n`;
  }
  const defaults = {
    python3: "class Solution:\n    def solve(self):\n        # Write your solution here\n        pass\n",
    javascript: "// Write your solution here\n\nfunction solution() {\n    \n}\n",
    java: "class Solution {\n    public void solution() {\n        \n    }\n}\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solution() {\n        \n    }\n};\n",
  };
  return defaults[lang] || "";
};

export default function ExamPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [language, setLanguage] = useState("python3");
  const [code, setCode] = useState("class Solution:\n    def solve(self):\n        # Write your solution here\n        pass\n");
  const [bottomTab, setBottomTab] = useState("testcase");
  const [testInput, setTestInput] = useState("");
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leftWidth, setLeftWidth] = useState(40);
  const isDragging = useRef(false);

  useEffect(() => {
    initExam();
  }, [testId]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      toast.error("Time is up!");
      stopCameraAndNavigate("/dashboard");
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const stopCameraAndNavigate = async (path) => {
    monitoringSocket.disconnect();
    try {
      await completeTestSession(testId);
    } catch (err) {
      console.log("Session complete error:", err);
    }
    if (window._stopProctoring) {
      window._stopProctoring();
    }
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => stream.getTracks().forEach(track => track.stop()))
        .catch(() => {});
    }
    document.querySelectorAll("video").forEach(video => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    });
    window.location.href = path;
  };

  const initExam = async () => {
    try {
      const testData = await getTestById(testId);
      const session = await startTestSession(testId);
      const questionsData = await getQuestions(testId);

      setTest(testData);
      setSessionId(session.session_id);

      const remaining = session.time_remaining;
      setTimeLeft(remaining > 0 ? remaining : testData.duration_mins * 60);

      setQuestions(questionsData);
      if (questionsData.length > 0) {
        setTestInput("");
        setCode(getStarterCode(questionsData[0], "python3"));
        const token = localStorage.getItem("token");
        monitoringSocket.connect(session.session_id, token);
        monitoringSocket.setQuestion(questionsData[0].id);
      }
    } catch (err) {
      const msg = err.response?.data?.detail;
      if (msg && msg.includes("attempt this test again in")) {
        toast.error(msg, { duration: 8000 });
      } else {
        toast.error("Failed to load exam");
      }
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCode(getStarterCode(questions[currentQuestion], lang));
  };

  const handleRun = async () => {
    if (!sessionId || !questions[currentQuestion]) return;
    setIsRunning(true);
    setBottomTab("results");
    try {
      const result = await submitCode(sessionId, questions[currentQuestion].id, code, language);
      setResults(result);
      if (result.status === "accepted") {
        toast.success("All test cases passed.");
      } else {
        toast.error(`${result.test_cases_passed}/${result.test_cases_total} test cases passed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Run failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId || !questions[currentQuestion]) return;
    setSubmitting(true);
    setBottomTab("results");
    try {
      const result = await submitCode(sessionId, questions[currentQuestion].id, code, language);
      setResults(result);
      if (result.status === "accepted") {
        toast.success("Accepted! All test cases passed.");
      } else {
        toast.error(`${result.test_cases_passed}/${result.test_cases_total} test cases passed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndTest = () => stopCameraAndNavigate("/dashboard");
  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const pct = (e.clientX / window.innerWidth) * 100;
    setLeftWidth(Math.max(25, Math.min(65, pct)));
  };
  const handleMouseUp = () => { isDragging.current = false; };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingText}>Loading exam...</div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div style={styles.container} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div style={styles.navbar}>
        <div style={styles.navLeft}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>C</div>
            <span style={styles.logoText}>CodeShield</span>
          </div>
          <div style={styles.divider} />
          <span style={styles.testTitle}>{test?.title}</span>
        </div>
        <div style={styles.navCenter}>
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => {
                setCurrentQuestion(i);
                setCode(getStarterCode(questions[i], language));
                monitoringSocket.setQuestion(questions[i].id);
              }}
              style={{
                ...styles.qBtn,
                background: i === currentQuestion ? "#f89f1b22" : "none",
                color: i === currentQuestion ? "#f89f1b" : "#888",
                border: i === currentQuestion ? "1px solid #f89f1b44" : "1px solid transparent",
              }}
            >
              Q{i + 1}
            </button>
          ))}
        </div>
        <div style={styles.navRight}>
          <div style={{ ...styles.timer, color: timeLeft !== null && timeLeft < 300 ? "#f87171" : "#e0e0e0" }}>
            {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
          </div>
          <button onClick={handleRun} disabled={isRunning || submitting} style={{ ...styles.runBtn, opacity: isRunning ? 0.7 : 1 }}>
            {isRunning ? "Running..." : "Run"}
          </button>
          <button onClick={handleSubmit} disabled={submitting || isRunning} style={{ ...styles.submitBtn, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button onClick={handleEndTest} style={styles.endBtn}>End Test</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={{ width: `${leftWidth}%`, ...styles.leftPanel }}>
          <div style={styles.panelTabs}>
            <span style={styles.activeTabLabel}>Description</span>
          </div>
          <div style={styles.problemContent}>
            {question ? (
              <>
                <h2 style={styles.problemTitle}>{currentQuestion + 1}. {question.title}</h2>
                <div style={styles.difficultyRow}>
                  <span style={{
                    ...styles.difficulty,
                    color: question.difficulty === "Easy" ? "#4ade80" : question.difficulty === "Hard" ? "#f87171" : "#fbbf24",
                    background: question.difficulty === "Easy" ? "#1a2e1a" : question.difficulty === "Hard" ? "#2e1a1a" : "#2e2a1a",
                  }}>
                    {question.difficulty}
                  </span>
                </div>
                <p style={styles.description}>{question.description}</p>
                {question.constraints && (
                  <div style={styles.section}>
                    <p style={styles.sectionTitle}>Constraints:</p>
                    <p style={styles.constraintText}>{question.constraints}</p>
                  </div>
                )}
                {question.examples && question.examples.length > 0 && (
                  <div style={styles.section}>
                    <p style={styles.sectionTitle}>Examples:</p>
                    {question.examples.map((ex, i) => (
                      <div key={i} style={styles.example}>
                        <div style={styles.exampleRow}>
                          <span style={styles.exLabel}>Input:</span>
                          <code style={styles.exCode}>{ex.input}</code>
                        </div>
                        <div style={styles.exampleRow}>
                          <span style={styles.exLabel}>Output:</span>
                          <code style={styles.exCode}>{ex.output}</code>
                        </div>
                        {ex.explanation && (
                          <div style={styles.exampleRow}>
                            <span style={styles.exLabel}>Explanation:</span>
                            <span style={styles.exText}>{ex.explanation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={styles.noQuestion}>No questions available</p>
            )}
          </div>
        </div>

        <div onMouseDown={handleMouseDown} style={styles.dividerBar} />

        <div style={{ flex: 1, ...styles.rightPanel }}>
          <div style={styles.editorHeader}>
            <div style={styles.editorTabs}>
              <span style={styles.editorTabActive}>Code</span>
            </div>
            <div style={styles.editorControls}>
              <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} style={styles.langSelect}>
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor
              height="100%"
              language={language === "python3" ? "python" : language}
              value={code}
              onChange={(val) => {
                const prev = code;
                const newCode = val || "";
                const diff = newCode.length - prev.length;
                if (diff > 10) monitoringSocket.logPaste(newCode.length, diff);
                else if (diff > 0) monitoringSocket.logKeypress("char", newCode.length);
                setCode(newCode);
              }}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
                lineNumbers: "on",
                renderLineHighlight: "all",
                cursorBlinking: "smooth",
              }}
            />
          </div>

          <div style={styles.bottomPanel}>
            <div style={styles.bottomTabs}>
              <button
                onClick={() => setBottomTab("testcase")}
                style={{
                  ...styles.bottomTab,
                  borderBottom: bottomTab === "testcase" ? "2px solid #f89f1b" : "2px solid transparent",
                  color: bottomTab === "testcase" ? "#f89f1b" : "#888",
                }}
              >
                Testcase
              </button>
              <button
                onClick={() => setBottomTab("results")}
                style={{
                  ...styles.bottomTab,
                  borderBottom: bottomTab === "results" ? "2px solid #f89f1b" : "2px solid transparent",
                  color: bottomTab === "results" ? "#f89f1b" : "#888",
                }}
              >
                Results
              </button>
            </div>
            <div style={styles.bottomContent}>
              {bottomTab === "testcase" && (
                <div>
                  <p style={styles.inputLabel}>Custom Input:</p>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Enter custom test input here..."
                    style={styles.testInput}
                  />
                </div>
              )}
              {bottomTab === "results" && (
                <div>
                  {!results ? (
                    <p style={styles.noResults}>Submit your code to see results</p>
                  ) : (
                    <div>
                      <div style={styles.resultHeader}>
                        <span style={{
                          ...styles.statusBadge,
                          color: results.status === "accepted" ? "#4ade80" : "#f87171",
                          background: results.status === "accepted" ? "#1a2e1a" : "#2e1a1a",
                        }}>
                          {results.status === "accepted" ? "Accepted" : results.status?.replace("_", " ")}
                        </span>
                        <span style={styles.resultMeta}>{results.test_cases_passed}/{results.test_cases_total} passed</span>
                        {results.runtime_ms && <span style={styles.resultMeta}>Runtime: {results.runtime_ms}ms</span>}
                      </div>
                      <div style={styles.testCaseList}>
                        {results.results?.filter(r => !r.is_hidden).map((r, i) => (
                          <div key={i} style={{
                            ...styles.testCaseItem,
                            borderLeft: r.passed ? "3px solid #4ade80" : "3px solid #f87171",
                          }}>
                            <div style={styles.tcRow}>
                              <span style={styles.tcLabel}>Input:</span>
                              <code style={styles.tcCode}>{r.input}</code>
                            </div>
                            <div style={styles.tcRow}>
                              <span style={styles.tcLabel}>Expected:</span>
                              <code style={styles.tcCode}>{r.expected}</code>
                            </div>
                            <div style={styles.tcRow}>
                              <span style={styles.tcLabel}>Got:</span>
                              <code style={{ ...styles.tcCode, color: r.passed ? "#4ade80" : "#f87171" }}>
                                {r.got || r.error}
                              </code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {sessionId && (
        <Proctoring
          sessionId={sessionId}
          onDisqualified={() => {
            toast.error("Disqualified due to multiple violations.");
            stopCameraAndNavigate("/dashboard");
          }}
        />
      )}
    </div>
  );
}

const styles = {
  container: { width: "100vw", height: "100vh", background: "#1a1a1a", display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none" },
  loadingScreen: { width: "100vw", height: "100vh", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#888", fontSize: "16px" },
  navbar: { height: "48px", background: "#242424", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0, zIndex: 10 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { display: "flex", alignItems: "center", gap: "8px" },
  logoIcon: { width: "28px", height: "28px", background: "linear-gradient(135deg, #f89f1b, #ff6b35)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "900", color: "#fff" },
  logoText: { color: "#f89f1b", fontWeight: "700", fontSize: "15px" },
  divider: { width: "1px", height: "20px", background: "#444" },
  testTitle: { color: "#b0b0b0", fontSize: "13px" },
  navCenter: { display: "flex", alignItems: "center", gap: "6px" },
  qBtn: { padding: "4px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  navRight: { display: "flex", alignItems: "center", gap: "10px" },
  timer: { fontFamily: "monospace", fontSize: "14px", background: "#2d2d2d", padding: "4px 12px", borderRadius: "6px", border: "1px solid #3a3a3a" },
  runBtn: { background: "#2d3748", border: "1px solid #4a5568", color: "#e2e8f0", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { background: "#1a472a", border: "1px solid #2d6a4f", color: "#4ade80", padding: "6px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  endBtn: { background: "#3a2d2d", border: "1px solid #5a3a3a", color: "#f87171", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  main: { flex: 1, display: "flex", overflow: "hidden" },
  leftPanel: { display: "flex", flexDirection: "column", borderRight: "1px solid #3a3a3a", overflow: "hidden" },
  panelTabs: { height: "40px", background: "#222", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0 },
  activeTabLabel: { color: "#f89f1b", fontSize: "13px", fontWeight: "600", borderBottom: "2px solid #f89f1b", paddingBottom: "2px" },
  problemContent: { flex: 1, overflowY: "auto", padding: "20px" },
  problemTitle: { fontSize: "17px", fontWeight: "700", color: "#e0e0e0", marginBottom: "12px", lineHeight: 1.4 },
  difficultyRow: { marginBottom: "16px" },
  difficulty: { padding: "2px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" },
  description: { color: "#c0c0c0", fontSize: "14px", lineHeight: 1.7, marginBottom: "16px" },
  section: { marginBottom: "16px" },
  sectionTitle: { color: "#e0e0e0", fontSize: "14px", fontWeight: "600", marginBottom: "8px" },
  constraintText: { color: "#888", fontSize: "13px", fontFamily: "monospace", background: "#252525", padding: "8px 12px", borderRadius: "6px" },
  example: { background: "#252525", border: "1px solid #333", borderRadius: "8px", padding: "12px", marginBottom: "10px" },
  exampleRow: { display: "flex", gap: "8px", marginBottom: "4px", alignItems: "flex-start" },
  exLabel: { color: "#888", fontSize: "13px", minWidth: "90px", fontWeight: "500" },
  exCode: { color: "#79c0ff", fontSize: "13px", fontFamily: "monospace", background: "#1e1e1e", padding: "1px 6px", borderRadius: "3px" },
  exText: { color: "#b0b0b0", fontSize: "13px" },
  noQuestion: { color: "#555", fontSize: "14px" },
  dividerBar: { width: "4px", cursor: "col-resize", background: "#2d2d2d", flexShrink: 0 },
  rightPanel: { display: "flex", flexDirection: "column", overflow: "hidden" },
  editorHeader: { height: "42px", background: "#222", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", flexShrink: 0 },
  editorTabs: { display: "flex", alignItems: "center" },
  editorTabActive: { color: "#e0e0e0", fontSize: "13px", fontWeight: "600" },
  editorControls: { display: "flex", alignItems: "center", gap: "8px" },
  langSelect: { background: "#2d2d2d", border: "1px solid #3a3a3a", color: "#e0e0e0", padding: "4px 10px", borderRadius: "5px", fontSize: "13px", cursor: "pointer" },
  bottomPanel: { height: "220px", borderTop: "1px solid #3a3a3a", display: "flex", flexDirection: "column", flexShrink: 0 },
  bottomTabs: { display: "flex", background: "#222", borderBottom: "1px solid #3a3a3a", flexShrink: 0 },
  bottomTab: { background: "none", border: "none", padding: "8px 16px", fontSize: "12px", cursor: "pointer", fontWeight: "500" },
  bottomContent: { flex: 1, overflowY: "auto", padding: "12px 16px" },
  inputLabel: { color: "#888", fontSize: "12px", marginBottom: "6px" },
  testInput: { width: "100%", background: "#252525", border: "1px solid #3a3a3a", borderRadius: "6px", color: "#e0e0e0", padding: "8px", fontFamily: "monospace", fontSize: "13px", resize: "none", height: "80px", boxSizing: "border-box" },
  noResults: { color: "#555", fontSize: "13px", textAlign: "center", paddingTop: "20px" },
  resultHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  statusBadge: { padding: "3px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: "700" },
  resultMeta: { color: "#888", fontSize: "12px" },
  testCaseList: { display: "flex", flexDirection: "column", gap: "8px" },
  testCaseItem: { background: "#252525", borderRadius: "6px", padding: "10px 12px" },
  tcRow: { display: "flex", gap: "8px", marginBottom: "3px", alignItems: "center" },
  tcLabel: { color: "#666", fontSize: "12px", minWidth: "70px" },
  tcCode: { color: "#e0e0e0", fontSize: "12px", fontFamily: "monospace" },
};