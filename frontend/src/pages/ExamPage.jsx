import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import toast from "react-hot-toast";
import { getTestById, startTestSession, getQuestions, completeTestSession } from "../services/testService";
import { submitCode, runSamples } from "../services/submissionService";
import { formatTime } from "../utils/formatTime";
import useAuthStore from "../store/authStore";
import Proctoring from "../components/Proctoring";
import { monitoringSocket } from "../sockets/monitoringSocket";
import { getStarterCode, CP_STARTER } from "../utils/codeHelpers";

const LANGUAGES = ["python3", "javascript", "java", "cpp"];


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
  const [code, setCode] = useState(CP_STARTER["python3"]);
  const [bottomTab, setBottomTab] = useState("samples");
  const [runResults, setRunResults] = useState(null);   // from run-samples  
  const [submitResults, setSubmitResults] = useState(null); // from submit
  const [submitting, setSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leftWidth, setLeftWidth] = useState(42);
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
    try { await completeTestSession(testId); } catch {}
    if (window._stopProctoring) window._stopProctoring();
    document.querySelectorAll("video").forEach((v) => {
      if (v.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null; }
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
        const token = localStorage.getItem("token");
        monitoringSocket.connect(session.session_id, token);
        monitoringSocket.setQuestion(questionsData[0].id);
        setCode(getStarterCode(questionsData[0], "python3"));
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
    const q = questions[currentQuestion];
    setCode(getStarterCode(q, lang));
    setRunResults(null);
  };

  const handleQuestionChange = (idx) => {
    setCurrentQuestion(idx);
    setRunResults(null);
    setSubmitResults(null);
    setBottomTab("samples");
    const q = questions[idx];
    monitoringSocket.setQuestion(q.id);
    setCode(getStarterCode(q, language));
  };

  // Run against visible test cases only — does NOT submit, just checks sample cases
  const handleRun = async () => {
    const question = questions[currentQuestion];
    if (!question) return;
    setIsRunning(true);
    setBottomTab("run");
    setRunResults(null);
    try {
      const result = await runSamples(code, language, question.id);
      setRunResults(result);
      if (result.passed === result.total) {
        toast.success(`✓ ${result.passed}/${result.total} sample cases passed!`);
      } else {
        toast.error(`${result.passed}/${result.total} sample cases passed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Run failed");
    } finally {
      setIsRunning(false);
    }
  };

  // Submit: run against ALL test cases (visible + hidden), stored in DB
  const handleSubmit = async () => {
    const question = questions[currentQuestion];
    if (!sessionId || !question) return;
    setSubmitting(true);
    setBottomTab("submit");
    setSubmitResults(null);
    try {
      const result = await submitCode(sessionId, question.id, code, language);
      setSubmitResults(result);
      if (result.status === "accepted") {
        toast.success("✅ Accepted! All test cases passed.");
      } else {
        const label = result.status?.replace(/_/g, " ");
        toast.error(`${result.test_cases_passed}/${result.test_cases_total} passed — ${label}`);
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
        <div style={styles.loadingSpinner} />
        <div style={styles.loadingText}>Loading exam...</div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div style={styles.container} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Navbar */}
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
              onClick={() => handleQuestionChange(i)}
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
          <button onClick={handleRun} disabled={isRunning || submitting} style={{ ...styles.runBtn, opacity: isRunning ? 0.6 : 1 }}>
            {isRunning ? "Running..." : "▶ Run"}
          </button>
          <button onClick={handleSubmit} disabled={submitting || isRunning} style={{ ...styles.submitBtn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button onClick={handleEndTest} style={styles.endBtn}>End Test</button>
        </div>
      </div>

      {/* Main split pane */}
      <div style={styles.main}>
        {/* Left — problem statement */}
        <div style={{ width: `${leftWidth}%`, ...styles.leftPanel }}>
          <div style={styles.panelTabs}>
            <span style={styles.activeTabLabel}>Description</span>
          </div>
          <div style={styles.problemContent}>
            {question ? (
              <>
                <h2 style={styles.problemTitle}>{currentQuestion + 1}. {question.title}</h2>
                <span style={{
                  ...styles.difficulty,
                  color: question.difficulty === "Easy" ? "#4ade80" : question.difficulty === "Hard" ? "#f87171" : "#fbbf24",
                  background: question.difficulty === "Easy" ? "#1a2e1a" : question.difficulty === "Hard" ? "#2e1a1a" : "#2e2a1a",
                }}>
                  {question.difficulty}
                </span>

                <p style={styles.description}>{question.description}</p>

                {question.constraints && (
                  <div style={styles.section}>
                    <p style={styles.sectionTitle}>Constraints</p>
                    <pre style={styles.constraintText}>{question.constraints}</pre>
                  </div>
                )}

                {question.examples && question.examples.length > 0 && (
                  <div style={styles.section}>
                    <p style={styles.sectionTitle}>Examples</p>
                    {question.examples.map((ex, i) => (
                      <div key={i} style={styles.example}>
                        <div style={styles.exRow}>
                          <span style={styles.exLabel}>Input</span>
                          <pre style={styles.exCode}>{ex.input}</pre>
                        </div>
                        <div style={styles.exRow}>
                          <span style={styles.exLabel}>Output</span>
                          <pre style={styles.exCode}>{ex.output}</pre>
                        </div>
                        {ex.explanation && (
                          <div style={styles.exRow}>
                            <span style={styles.exLabel}>Explanation</span>
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

        {/* Right — editor + bottom panel */}
        <div style={{ flex: 1, ...styles.rightPanel }}>
          <div style={styles.editorHeader}>
            <span style={styles.editorTabActive}>Code</span>
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} style={styles.langSelect}>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === "python3" ? "Python 3" : lang === "cpp" ? "C++" : lang === "java" ? "Java" : "JavaScript"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor
              height="100%"
              language={language === "python3" ? "python" : language}
              value={code}
              onMount={(editor, monaco) => {
                editor.onDidPaste((e) => {
                  const pastedText = editor.getModel().getValueInRange(e.range);
                  if (pastedText && pastedText.length > 10) {
                    monitoringSocket.logPaste(editor.getModel().getValueLength(), pastedText.length);
                  }
                });
              }}
              onChange={(val) => {
                const prev = code;
                const newCode = val || "";
                const diff = newCode.length - prev.length;
                
                // Still log keypresses
                if (diff === 1 || diff === -1) {
                  monitoringSocket.logKeypress("char", newCode.length);
                } else if (diff > 1 && diff <= 10) {
                  // small diffs (e.g. autocomplete snippets or fast typing)
                  monitoringSocket.logKeypress("snippet", newCode.length);
                }
                
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

          {/* Bottom panel */}
          <div style={styles.bottomPanel}>
            <div style={styles.bottomTabs}>
              <button
                onClick={() => setBottomTab("samples")}
                style={{ ...styles.bottomTab, borderBottom: bottomTab === "samples" ? "2px solid #4ade80" : "2px solid transparent", color: bottomTab === "samples" ? "#4ade80" : "#666" }}
              >
                Sample Test Cases
              </button>
              <button
                onClick={() => setBottomTab("run")}
                style={{ ...styles.bottomTab, borderBottom: bottomTab === "run" ? "2px solid #f89f1b" : "2px solid transparent", color: bottomTab === "run" ? "#f89f1b" : "#666" }}
              >
                Run Results {runResults ? `(${runResults.passed}/${runResults.total})` : ""}
              </button>
              <button
                onClick={() => setBottomTab("submit")}
                style={{ ...styles.bottomTab, borderBottom: bottomTab === "submit" ? "2px solid #60a5fa" : "2px solid transparent", color: bottomTab === "submit" ? "#60a5fa" : "#666" }}
              >
                Submission {submitResults ? `(${submitResults.status === "accepted" ? "✓" : "✗"})` : ""}
              </button>
            </div>

            <div style={styles.bottomContent}>
              {/* Sample Test Cases tab */}
              {bottomTab === "samples" && (
                <div>
                  {!question?.test_cases_visible?.length && runResults === null && (
                    <div style={styles.sampleInstructions}>
                      <p style={{ color: "#888", fontSize: "13px", margin: "0 0 12px" }}>
                        Click <strong style={{ color: "#4ade80" }}>▶ Run</strong> to test your code against the sample test cases.
                        The judge will compare your program's <strong>stdout</strong> to the expected output.
                      </p>
                      <div style={styles.howToBox}>
                        <span style={{ color: "#555", fontSize: "12px", fontWeight: "600", marginBottom: "4px", display: "block" }}>READ INPUT FROM STDIN · PRINT OUTPUT TO STDOUT</span>
                        {language === "python3" && <pre style={styles.tipCode}>{`n = int(input())\na = list(map(int, input().split()))\nprint(sum(a))`}</pre>}
                        {language === "cpp" && <pre style={styles.tipCode}>{`int n; cin >> n;\nvector<int> a(n);\nfor(auto &x : a) cin >> x;\ncout << accumulate(a.begin(),a.end(),0) << "\\n";`}</pre>}
                        {language === "java" && <pre style={styles.tipCode}>{`Scanner sc = new Scanner(System.in);\nint n = sc.nextInt();\n// read and process`}</pre>}
                        {language === "javascript" && <pre style={styles.tipCode}>{`const n = parseInt(input());\n// process and console.log(answer)`}</pre>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Run Results tab — sample test case results */}
              {bottomTab === "run" && (
                <div>
                  {!runResults ? (
                    <p style={styles.dimText}>Click ▶ Run to test against sample cases</p>
                  ) : runResults.total === 0 ? (
                    <p style={styles.dimText}>No sample (visible) test cases defined for this question.</p>
                  ) : (
                    <div>
                      <div style={styles.resultHeader}>
                        <span style={{
                          ...styles.statusBadge,
                          color: runResults.passed === runResults.total ? "#4ade80" : "#f87171",
                          background: runResults.passed === runResults.total ? "#1a2e1a" : "#2e1a1a",
                        }}>
                          {runResults.passed === runResults.total ? "All samples passed" : `${runResults.passed}/${runResults.total} passed`}
                        </span>
                      </div>
                      {runResults.results.map((r, i) => (
                        <div key={i} style={{ ...styles.tcCard, borderLeft: r.passed ? "3px solid #4ade80" : "3px solid #f87171" }}>
                          <div style={styles.tcCardHeader}>
                            <span style={{ color: r.passed ? "#4ade80" : "#f87171", fontSize: "12px", fontWeight: "700" }}>
                              {r.passed ? "✓" : "✗"} Test {i + 1}
                            </span>
                          </div>
                          <div style={styles.tcGrid}>
                            <div style={styles.tcGridItem}>
                              <span style={styles.tcLabel}>Input</span>
                              <pre style={styles.tcPre}>{r.input}</pre>
                            </div>
                            <div style={styles.tcGridItem}>
                              <span style={styles.tcLabel}>Expected</span>
                              <pre style={styles.tcPre}>{r.expected}</pre>
                            </div>
                            <div style={styles.tcGridItem}>
                              <span style={styles.tcLabel}>Your Output</span>
                              <pre style={{ ...styles.tcPre, color: r.passed ? "#4ade80" : "#f87171" }}>
                                {r.error ? r.error : (r.got || "(no output)")}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submission Results tab */}
              {bottomTab === "submit" && (
                <div>
                  {!submitResults ? (
                    <p style={styles.dimText}>Click Submit to run against all test cases (including hidden)</p>
                  ) : (
                    <div>
                      <div style={styles.resultHeader}>
                        <span style={{
                          ...styles.statusBadge,
                          color: submitResults.status === "accepted" ? "#4ade80" : "#f87171",
                          background: submitResults.status === "accepted" ? "#1a2e1a" : "#2e1a1a",
                          fontSize: "15px",
                        }}>
                          {submitResults.status === "accepted" ? "✅ Accepted" : "✗ " + submitResults.status?.replace(/_/g, " ")}
                        </span>
                        <span style={styles.resultMeta}>{submitResults.test_cases_passed}/{submitResults.test_cases_total} passed</span>
                        {submitResults.runtime_ms > 0 && <span style={styles.resultMeta}>{submitResults.runtime_ms}ms</span>}
                      </div>
                      <div style={styles.tcList}>
                        {submitResults.results?.map((r, i) => (
                          <div key={i} style={{ ...styles.tcCard, borderLeft: r.passed ? "3px solid #4ade80" : "3px solid #f87171" }}>
                            <div style={styles.tcCardHeader}>
                              <span style={{ color: r.passed ? "#4ade80" : "#f87171", fontSize: "12px", fontWeight: "700" }}>
                                {r.passed ? "✓" : "✗"} Test {i + 1} {r.is_hidden ? <span style={{ color: "#555" }}>(Hidden)</span> : ""}
                              </span>
                            </div>
                            {!r.is_hidden && (
                              <div style={styles.tcGrid}>
                                <div style={styles.tcGridItem}>
                                  <span style={styles.tcLabel}>Input</span>
                                  <pre style={styles.tcPre}>{r.input}</pre>
                                </div>
                                <div style={styles.tcGridItem}>
                                  <span style={styles.tcLabel}>Expected</span>
                                  <pre style={styles.tcPre}>{r.expected}</pre>
                                </div>
                                <div style={styles.tcGridItem}>
                                  <span style={styles.tcLabel}>Your Output</span>
                                  <pre style={{ ...styles.tcPre, color: r.passed ? "#4ade80" : "#f87171" }}>
                                    {r.error ? r.error : (r.got || "(no output)")}
                                  </pre>
                                </div>
                              </div>
                            )}
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
  loadingScreen: { width: "100vw", height: "100vh", background: "#1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" },
  loadingSpinner: { width: "32px", height: "32px", border: "3px solid #333", borderTop: "3px solid #f89f1b", borderRadius: "50%" },
  loadingText: { color: "#888", fontSize: "14px" },
  navbar: { height: "48px", background: "#242424", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  logo: { display: "flex", alignItems: "center", gap: "8px" },
  logoIcon: { width: "28px", height: "28px", background: "linear-gradient(135deg, #f89f1b, #ff6b35)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "900", color: "#fff" },
  logoText: { color: "#f89f1b", fontWeight: "700", fontSize: "15px" },
  divider: { width: "1px", height: "20px", background: "#444" },
  testTitle: { color: "#b0b0b0", fontSize: "13px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  navCenter: { display: "flex", alignItems: "center", gap: "6px" },
  qBtn: { padding: "4px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: "500", cursor: "pointer" },
  navRight: { display: "flex", alignItems: "center", gap: "10px" },
  timer: { fontFamily: "monospace", fontSize: "14px", background: "#2d2d2d", padding: "4px 12px", borderRadius: "6px", border: "1px solid #3a3a3a" },
  runBtn: { background: "#1e3a2e", border: "1px solid #2d6a4f", color: "#4ade80", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { background: "#1a2e4a", border: "1px solid #2d4f6a", color: "#60a5fa", padding: "6px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  endBtn: { background: "#3a2d2d", border: "1px solid #5a3a3a", color: "#f87171", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  main: { flex: 1, display: "flex", overflow: "hidden" },
  leftPanel: { display: "flex", flexDirection: "column", borderRight: "1px solid #3a3a3a", overflow: "hidden" },
  panelTabs: { height: "40px", background: "#222", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0 },
  activeTabLabel: { color: "#f89f1b", fontSize: "13px", fontWeight: "600", borderBottom: "2px solid #f89f1b", paddingBottom: "2px" },
  problemContent: { flex: 1, overflowY: "auto", padding: "20px" },
  problemTitle: { fontSize: "17px", fontWeight: "700", color: "#e0e0e0", marginBottom: "10px", lineHeight: 1.4 },
  difficulty: { display: "inline-block", padding: "2px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: "600", marginBottom: "16px" },
  description: { color: "#c0c0c0", fontSize: "14px", lineHeight: 1.8, marginBottom: "16px", whiteSpace: "pre-wrap" },
  section: { marginBottom: "20px" },
  sectionTitle: { color: "#666", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" },
  constraintText: { color: "#888", fontSize: "13px", fontFamily: "monospace", background: "#252525", padding: "10px 14px", borderRadius: "6px", margin: 0, whiteSpace: "pre-wrap" },
  example: { background: "#252525", border: "1px solid #333", borderRadius: "8px", padding: "12px", marginBottom: "10px" },
  exRow: { display: "flex", gap: "10px", marginBottom: "6px", alignItems: "flex-start" },
  exLabel: { color: "#666", fontSize: "12px", minWidth: "90px", fontWeight: "600", paddingTop: "3px" },
  exCode: { color: "#79c0ff", fontSize: "13px", fontFamily: "monospace", background: "#1e1e1e", padding: "4px 8px", borderRadius: "4px", margin: 0, whiteSpace: "pre" },
  exText: { color: "#b0b0b0", fontSize: "13px" },
  noQuestion: { color: "#555", fontSize: "14px" },
  dividerBar: { width: "4px", cursor: "col-resize", background: "#2d2d2d", flexShrink: 0, transition: "background 0.2s" },
  rightPanel: { display: "flex", flexDirection: "column", overflow: "hidden" },
  editorHeader: { height: "42px", background: "#222", borderBottom: "1px solid #3a3a3a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", flexShrink: 0 },
  editorTabActive: { color: "#e0e0e0", fontSize: "13px", fontWeight: "600" },
  langSelect: { background: "#2d2d2d", border: "1px solid #3a3a3a", color: "#e0e0e0", padding: "4px 10px", borderRadius: "5px", fontSize: "13px", cursor: "pointer" },
  bottomPanel: { height: "240px", borderTop: "1px solid #3a3a3a", display: "flex", flexDirection: "column", flexShrink: 0 },
  bottomTabs: { display: "flex", background: "#1e1e1e", borderBottom: "1px solid #3a3a3a", flexShrink: 0 },
  bottomTab: { background: "none", border: "none", padding: "8px 14px", fontSize: "12px", cursor: "pointer", fontWeight: "600" },
  bottomContent: { flex: 1, overflowY: "auto", padding: "12px 16px" },
  sampleInstructions: { marginTop: "4px" },
  howToBox: { background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 14px" },
  tipCode: { color: "#79c0ff", fontSize: "12px", fontFamily: "monospace", margin: "6px 0 0", whiteSpace: "pre" },
  dimText: { color: "#555", fontSize: "13px", textAlign: "center", paddingTop: "20px" },
  resultHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  statusBadge: { padding: "3px 12px", borderRadius: "4px", fontSize: "13px", fontWeight: "700" },
  resultMeta: { color: "#888", fontSize: "12px" },
  tcList: { display: "flex", flexDirection: "column", gap: "8px" },
  tcCard: { background: "#222", borderRadius: "6px", padding: "10px 12px", marginBottom: "6px" },
  tcCardHeader: { marginBottom: "8px" },
  tcGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" },
  tcGridItem: { display: "flex", flexDirection: "column", gap: "4px" },
  tcLabel: { color: "#555", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" },
  tcPre: { color: "#e0e0e0", fontSize: "12px", fontFamily: "monospace", margin: 0, background: "#1a1a1a", padding: "6px 8px", borderRadius: "4px", whiteSpace: "pre-wrap", overflowX: "auto" },
};