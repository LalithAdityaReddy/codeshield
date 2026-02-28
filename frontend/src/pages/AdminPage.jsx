import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { getAllTests, createTest, createQuestion } from "../services/testService";
import api from "../services/api";
import toast from "react-hot-toast";

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tests");
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedTestForAnalytics, setSelectedTestForAnalytics] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateReport, setCandidateReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [testForm, setTestForm] = useState({
    title: "",
    description: "",
    duration_mins: 60,
  });

  const [questionForm, setQuestionForm] = useState({
    title: "",
    description: "",
    difficulty: "Medium",
    order_index: 1,
    constraints: "",
    function_signature: "",
    driver_code: "",
    test_cases: [{ input: "", expected_output: "", is_hidden: false }],
  });

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const data = await getAllTests();
      setTests(data);
    } catch (err) {
      toast.error("Failed to load tests");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (testId) => {
    setLoadingAnalytics(true);
    setAnalyticsData(null);
    try {
      const response = await api.get(`/api/rankings/${testId}/analytics`);
      setAnalyticsData(response.data);
    } catch (err) {
      toast.error("Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };
  const fetchCandidateReport = async (userId, testId) => {
    setLoadingReport(true);
    setShowModal(true);
    setCandidateReport(null);
    try {
      const response = await api.get(`/api/rankings/${testId}/candidate/${userId}/detailed`);
      setCandidateReport(response.data);
    } catch (err) {
      toast.error("Failed to load candidate report");
      setShowModal(false);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      await createTest(testForm);
      toast.success("Test created successfully");
      setShowCreateTest(false);
      setTestForm({ title: "", description: "", duration_mins: 60 });
      fetchTests();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create test");
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await createQuestion(selectedTestId, questionForm);
      toast.success("Question added successfully");
      setQuestionForm({
        title: "",
        description: "",
        difficulty: "Medium",
        order_index: 1,
        constraints: "",
        function_signature: "",
        driver_code: "",
        test_cases: [{ input: "", expected_output: "", is_hidden: false }],
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create question");
    }
  };

  const addTestCase = () => {
    setQuestionForm({
      ...questionForm,
      test_cases: [
        ...questionForm.test_cases,
        { input: "", expected_output: "", is_hidden: false },
      ],
    });
  };

  const updateTestCase = (index, field, value) => {
    const updated = [...questionForm.test_cases];
    updated[index][field] = value;
    setQuestionForm({ ...questionForm, test_cases: updated });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>C</div>
          <span style={styles.logoText}>CodeShield</span>
        </div>
        <div style={styles.navCenter}>
          <span style={styles.adminBadge}>Admin Panel</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.username}>{user?.username}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab("tests")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "tests" ? "2px solid #f89f1b" : "2px solid transparent",
              color: activeTab === "tests" ? "#f89f1b" : "#888",
            }}
          >
            Tests
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "questions" ? "2px solid #f89f1b" : "2px solid transparent",
              color: activeTab === "questions" ? "#f89f1b" : "#888",
            }}
          >
            Add Questions
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            style={{
              ...styles.tab,
              borderBottom: activeTab === "analytics" ? "2px solid #f89f1b" : "2px solid transparent",
              color: activeTab === "analytics" ? "#f89f1b" : "#888",
            }}
          >
            Analytics
          </button>
        </div>

        {/* Tests Tab */}
        {activeTab === "tests" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>All Tests</h2>
              <button
                onClick={() => setShowCreateTest(!showCreateTest)}
                style={styles.createBtn}
              >
                + Create Test
              </button>
            </div>

            {showCreateTest && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Create New Test</h3>
                <form onSubmit={handleCreateTest} style={styles.form}>
                  <div style={styles.field}>
                    <label style={styles.label}>Title</label>
                    <input
                      type="text"
                      value={testForm.title}
                      onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                      placeholder="Test title"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Description</label>
                    <textarea
                      value={testForm.description}
                      onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
                      placeholder="Test description"
                      style={{ ...styles.input, height: "80px", resize: "vertical" }}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Duration (minutes)</label>
                    <input
                      type="number"
                      value={testForm.duration_mins}
                      onChange={(e) => setTestForm({ ...testForm, duration_mins: parseInt(e.target.value) })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formActions}>
                    <button type="submit" style={styles.submitBtn}>Create Test</button>
                    <button
                      type="button"
                      onClick={() => setShowCreateTest(false)}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div style={styles.loading}>Loading...</div>
            ) : (
              <div style={styles.list}>
                {tests.map((test) => (
                  <div key={test.id} style={styles.listItem}>
                    <div>
                      <h3 style={styles.listTitle}>{test.title}</h3>
                      <p style={styles.listMeta}>
                        {test.duration_mins} mins — {test.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <span style={styles.idText}>ID: {test.id.slice(0, 8)}...</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === "questions" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Add Question To Test</h2>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Select Test</label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                style={styles.input}
              >
                <option value="">-- Select a test --</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {selectedTestId && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>New Question</h3>
                <form onSubmit={handleCreateQuestion} style={styles.form}>
                  <div style={styles.field}>
                    <label style={styles.label}>Title</label>
                    <input
                      type="text"
                      value={questionForm.title}
                      onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                      placeholder="Question title"
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Description</label>
                    <textarea
                      value={questionForm.description}
                      onChange={(e) => setQuestionForm({ ...questionForm, description: e.target.value })}
                      placeholder="Full question description"
                      required
                      style={{ ...styles.input, height: "120px", resize: "vertical" }}
                    />
                  </div>
                  <div style={styles.row}>
                    <div style={{ ...styles.field, flex: 1 }}>
                      <label style={styles.label}>Difficulty</label>
                      <select
                        value={questionForm.difficulty}
                        onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                        style={styles.input}
                      >
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </div>
                    <div style={{ ...styles.field, flex: 1 }}>
                      <label style={styles.label}>Order Index</label>
                      <input
                        type="number"
                        value={questionForm.order_index}
                        onChange={(e) => setQuestionForm({ ...questionForm, order_index: parseInt(e.target.value) })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Constraints</label>
                    <textarea
                      value={questionForm.constraints}
                      onChange={(e) => setQuestionForm({ ...questionForm, constraints: e.target.value })}
                      placeholder="e.g. 1 <= n <= 1000"
                      style={{ ...styles.input, height: "80px", resize: "vertical" }}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Function Signature</label>
                    <input
                      type="text"
                      value={questionForm.function_signature}
                      onChange={(e) => setQuestionForm({ ...questionForm, function_signature: e.target.value })}
                      placeholder="def numSteps(self, s: str) -> int:"
                      style={styles.input}
                    />
                    <span style={{ color: "#555", fontSize: "11px", marginTop: "4px" }}>
                      Shown to candidate as starter code
                    </span>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Driver Code (Hidden)</label>
                    <textarea
                      value={questionForm.driver_code}
                      onChange={(e) => setQuestionForm({ ...questionForm, driver_code: e.target.value })}
                      placeholder="result = sol.numSteps(__INPUT__)\nprint(result)"
                      style={{ ...styles.input, height: "80px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
                    />
                    <span style={{ color: "#555", fontSize: "11px", marginTop: "4px" }}>
                      Use __INPUT__ as placeholder for test case input
                    </span>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Test Cases</label>
                    {questionForm.test_cases.map((tc, index) => (
                      <div key={index} style={styles.testCaseRow}>
                        <input
                          type="text"
                          placeholder="Input"
                          value={tc.input}
                          onChange={(e) => updateTestCase(index, "input", e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                        />
                        <input
                          type="text"
                          placeholder="Expected output"
                          value={tc.expected_output}
                          onChange={(e) => updateTestCase(index, "expected_output", e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                        />
                        <label style={styles.hiddenLabel}>
                          <input
                            type="checkbox"
                            checked={tc.is_hidden}
                            onChange={(e) => updateTestCase(index, "is_hidden", e.target.checked)}
                          />
                          Hidden
                        </label>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addTestCase}
                      style={styles.addTcBtn}
                    >
                      + Add Test Case
                    </button>
                  </div>

                  <div style={styles.formActions}>
                    <button type="submit" style={styles.submitBtn}>
                      Add Question
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Test Analytics</h2>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Select Test</label>
              <select
                value={selectedTestForAnalytics}
                onChange={(e) => {
                  setSelectedTestForAnalytics(e.target.value);
                  if (e.target.value) fetchAnalytics(e.target.value);
                }}
                style={styles.input}
              >
                <option value="">-- Select a test --</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {loadingAnalytics && (
              <div style={styles.loading}>Loading analytics...</div>
            )}

            {analyticsData && !loadingAnalytics && (
              <div>
                <div style={styles.summaryRow}>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNum}>{analyticsData.total_candidates}</div>
                    <div style={styles.summaryLabel}>Candidates</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNum}>
                      {analyticsData.submissions.filter(s => s.detection?.is_plag_flagged).length}
                    </div>
                    <div style={styles.summaryLabel}>Plagiarism Flags</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNum}>
                      {analyticsData.submissions.filter(s => s.detection?.is_ai_flagged).length}
                    </div>
                    <div style={styles.summaryLabel}>AI Flags</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNum}>
                      {Object.values(analyticsData.violation_counts).reduce((a, b) => a + b, 0)}
                    </div>
                    <div style={styles.summaryLabel}>Total Violations</div>
                  </div>
                </div>

                <h3 style={styles.subTitle}>Leaderboard</h3>
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {["Rank", "Username", "Score", "Solved", "Runtime", "Violations"].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.leaderboard.map((row) => (
                        <tr key={row.user_id} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.rankBadge,
                              background: row.rank === 1 ? "#854d0e" :
                                          row.rank === 2 ? "#374151" :
                                          row.rank === 3 ? "#431407" : "#1a1a1a",
                            }}>
                              #{row.rank}
                            </span>
                          </td>
                          <td style={styles.td}>
  <button
    onClick={() => fetchCandidateReport(row.user_id, selectedTestForAnalytics)}
    style={styles.candidateBtn}
  >
    {row.username}
  </button>
</td>
                          <td style={styles.td}>{row.final_score}</td>
                          <td style={styles.td}>{row.questions_solved}</td>
                          <td style={styles.td}>{row.total_runtime_ms}ms</td>
                          <td style={styles.td}>
                            <span style={{
                              color: (analyticsData.violation_counts[row.user_id] || 0) > 0
                                ? "#f87171" : "#4ade80",
                              fontSize: "12px",
                            }}>
                              {analyticsData.violation_counts[row.user_id] || 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 style={{ ...styles.subTitle, marginTop: "24px" }}>
                  Flagged Submissions
                </h3>
                <div style={styles.list}>
                  {analyticsData.submissions
                    .filter(s => s.detection?.is_plag_flagged || s.detection?.is_ai_flagged)
                    .map((s) => (
                      <div key={s.submission_id} style={styles.flagCard}>
                        <div style={styles.flagLeft}>
                          <span style={styles.flagUser}>{s.username}</span>
                          <span style={styles.flagStatus}>{s.status}</span>
                        </div>
                        <div style={styles.flagRight}>
                          {s.detection?.is_plag_flagged && (
                            <span style={styles.plagBadge}>
                              Plagiarism {Math.round((s.detection.plag_score || 0) * 100)}%
                            </span>
                          )}
                          {s.detection?.is_ai_flagged && (
                            <span style={styles.aiBadge}>
                              AI {Math.round((s.detection.ai_score || 0) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  {analyticsData.submissions.filter(
                    s => s.detection?.is_plag_flagged || s.detection?.is_ai_flagged
                  ).length === 0 && (
                    <p style={{ color: "#555", fontSize: "13px" }}>No flagged submissions</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    {/* Candidate Detail Modal */}
{showModal && (
  <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div style={styles.modalHeader}>
        <h2 style={styles.modalTitle}>
          {loadingReport ? "Loading..." : candidateReport?.candidate?.username + " — Full Report"}
        </h2>
        <button onClick={() => setShowModal(false)} style={styles.closeBtn}>X</button>
      </div>

      {loadingReport && (
        <div style={styles.loading}>Loading report...</div>
      )}

      {candidateReport && !loadingReport && (
        <div style={styles.modalBody}>

          {/* Verdict Banner */}
          <div style={{
            ...styles.verdictBanner,
            background:
              candidateReport.verdict === "high_risk" ? "#2e1a1a" :
              candidateReport.verdict === "medium_risk" ? "#2e2a1a" : "#1a2e1a",
            borderColor:
              candidateReport.verdict === "high_risk" ? "#f87171" :
              candidateReport.verdict === "medium_risk" ? "#fbbf24" : "#4ade80",
          }}>
            <span style={{
              color:
                candidateReport.verdict === "high_risk" ? "#f87171" :
                candidateReport.verdict === "medium_risk" ? "#fbbf24" : "#4ade80",
              fontSize: "16px", fontWeight: "700",
            }}>
              {candidateReport.verdict === "high_risk" ? "HIGH RISK" :
               candidateReport.verdict === "medium_risk" ? "MEDIUM RISK" : "LOW RISK"}
            </span>
            <span style={{ color: "#888", fontSize: "13px" }}>
              Integrity Score: {candidateReport.scam_scores.overall_integrity_score}/100
            </span>
          </div>

          {/* Scam Score Grid */}
          <h3 style={styles.modalSectionTitle}>Scam Detection Scores</h3>
          <div style={styles.scamGrid}>
            {[
              { label: "Plagiarism", key: "plagiarism_pct", color: "#f87171" },
              { label: "AI Generated", key: "ai_generated_pct", color: "#818cf8" },
              { label: "Tab Switching", key: "tab_switching_pct", color: "#fbbf24" },
              { label: "Camera Violation", key: "camera_violation_pct", color: "#fb923c" },
              { label: "Paste Events", key: "paste_score_pct", color: "#f87171" },
              { label: "Copy Attempts", key: "copy_attempt_pct", color: "#fbbf24" },
            ].map((item) => (
              <div key={item.key} style={styles.scamCard}>
                <div style={styles.scamLabel}>{item.label}</div>
                <div style={styles.scamBarContainer}>
                  <div style={{
                    ...styles.scamBar,
                    width: `${candidateReport.scam_scores[item.key]}%`,
                    background: item.color,
                  }} />
                </div>
                <div style={{ ...styles.scamPct, color: item.color }}>
                  {candidateReport.scam_scores[item.key]}%
                </div>
              </div>
            ))}
          </div>

          {/* Behavior Stats */}
          <h3 style={styles.modalSectionTitle}>Behavior During Exam</h3>
          <div style={styles.behaviorGrid}>
            {[
              { label: "Keystrokes", value: candidateReport.behavior.total_keystrokes },
              { label: "Paste Events", value: candidateReport.behavior.total_pastes },
              { label: "Tab Switches", value: candidateReport.behavior.tab_switches },
              { label: "No Face", value: candidateReport.behavior.no_face_events },
              { label: "Multi Face", value: candidateReport.behavior.multiple_face_events },
              { label: "Copy Attempts", value: candidateReport.behavior.copy_attempts },
              { label: "Avg Typing (ms)", value: candidateReport.behavior.avg_typing_speed_ms },
              { label: "Screen Exits", value: candidateReport.behavior.fullscreen_exits },
            ].map((item) => (
              <div key={item.label} style={styles.behaviorCard}>
                <div style={styles.behaviorVal}>{item.value}</div>
                <div style={styles.behaviorLabel}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Explanations */}
          {candidateReport.explanations.length > 0 && (
            <>
              <h3 style={styles.modalSectionTitle}>Explainable AI Analysis</h3>
              {candidateReport.explanations.map((exp, i) => (
                <div key={i} style={{
                  ...styles.explanationCard,
                  borderLeft: `3px solid ${
                    exp.severity === "high" ? "#f87171" : "#fbbf24"
                  }`,
                }}>
                  <div style={styles.expHeader}>
                    <span style={{
                      ...styles.expType,
                      color: exp.severity === "high" ? "#f87171" : "#fbbf24",
                    }}>
                      {exp.type.replace("_", " ").toUpperCase()} — {exp.percentage}%
                    </span>
                    <span style={{
                      ...styles.expSeverity,
                      background: exp.severity === "high" ? "#2e1a1a" : "#2e2a1a",
                      color: exp.severity === "high" ? "#f87171" : "#fbbf24",
                    }}>
                      {exp.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={styles.expReason}>{exp.reason}</p>
                  <p style={styles.expEvidence}>{exp.evidence}</p>
                </div>
              ))}
            </>
          )}

          {/* Per Submission Breakdown */}
          <h3 style={styles.modalSectionTitle}>Per Question Breakdown</h3>
          {candidateReport.submissions.map((sub, i) => (
            <div key={i} style={styles.subCard}>
              <div style={styles.subHeader}>
                <span style={styles.subTitle2}>{sub.question_title}</span>
                <span style={{
                  ...styles.subStatus,
                  color: sub.status === "accepted" ? "#4ade80" : "#f87171",
                  background: sub.status === "accepted" ? "#1a2e1a" : "#2e1a1a",
                }}>
                  {sub.status}
                </span>
              </div>
              <div style={styles.subMeta}>
                {sub.test_cases_passed}/{sub.test_cases_total} passed —
                {sub.runtime_ms}ms — {sub.language}
              </div>
              <div style={styles.subScores}>
                <span style={{ color: "#f87171", fontSize: "12px" }}>
                  Plag: {sub.plag_score}%
                </span>
                <span style={{ color: "#818cf8", fontSize: "12px" }}>
                  AI: {sub.ai_score}%
                </span>
              </div>
              {sub.plag_breakdown && (
                <div style={styles.breakdownGrid}>
                  {Object.entries(sub.plag_breakdown).map(([k, v]) => (
                    <div key={k} style={styles.breakdownItem}>
                      <span style={styles.breakdownLabel}>
                        {k.replace("_", " ")}
                      </span>
                      <span style={{ color: "#f87171", fontSize: "11px" }}>{v}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#1a1a1a" },
  navbar: {
    height: "56px", background: "#242424",
    borderBottom: "1px solid #3a3a3a",
    display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "0 24px",
  },
  logo: { display: "flex", alignItems: "center", gap: "10px" },
  logoIcon: {
    width: "32px", height: "32px",
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    borderRadius: "6px", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: "16px", fontWeight: "900", color: "#fff",
  },
  logoText: { color: "#f89f1b", fontWeight: "700", fontSize: "18px" },
  navCenter: { display: "flex", alignItems: "center" },
  adminBadge: {
    background: "#2d2d4a", color: "#818cf8",
    padding: "4px 12px", borderRadius: "4px",
    fontSize: "12px", fontWeight: "600",
  },
  navRight: { display: "flex", alignItems: "center", gap: "16px" },
  username: { color: "#e0e0e0", fontSize: "14px" },
  logoutBtn: {
    background: "#3a2d2d", border: "1px solid #5a3a3a",
    color: "#f87171", padding: "6px 14px",
    borderRadius: "6px", fontSize: "13px", cursor: "pointer",
  },
  main: { maxWidth: "900px", margin: "0 auto", padding: "32px 24px" },
  tabs: {
    display: "flex", gap: "4px",
    borderBottom: "1px solid #3a3a3a", marginBottom: "28px",
  },
  tab: {
    background: "none", border: "none",
    padding: "10px 20px", fontSize: "14px",
    cursor: "pointer", fontWeight: "500",
  },
  sectionHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "20px",
  },
  sectionTitle: { fontSize: "20px", fontWeight: "700", color: "#e0e0e0" },
  createBtn: {
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    border: "none", borderRadius: "6px",
    padding: "8px 16px", color: "#fff",
    fontSize: "13px", fontWeight: "600", cursor: "pointer",
  },
  formCard: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "12px", padding: "24px", marginBottom: "24px",
  },
  formTitle: { fontSize: "16px", fontWeight: "600", color: "#e0e0e0", marginBottom: "16px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  row: { display: "flex", gap: "16px" },
  label: { fontSize: "13px", color: "#aaa", fontWeight: "500" },
  input: {
    background: "#2d2d2d", border: "1px solid #3a3a3a",
    borderRadius: "8px", padding: "10px 14px",
    color: "#e0e0e0", fontSize: "14px", outline: "none",
  },
  formActions: { display: "flex", gap: "12px" },
  submitBtn: {
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    border: "none", borderRadius: "8px",
    padding: "10px 24px", color: "#fff",
    fontSize: "14px", fontWeight: "600", cursor: "pointer",
  },
  cancelBtn: {
    background: "#2d2d2d", border: "1px solid #3a3a3a",
    borderRadius: "8px", padding: "10px 24px",
    color: "#888", fontSize: "14px", cursor: "pointer",
  },
  loading: { color: "#888", padding: "40px", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  listItem: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "10px", padding: "16px 20px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  listTitle: { fontSize: "15px", fontWeight: "600", color: "#e0e0e0", marginBottom: "4px" },
  listMeta: { fontSize: "12px", color: "#888" },
  idText: { fontSize: "11px", color: "#555", fontFamily: "monospace" },
  testCaseRow: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" },
  hiddenLabel: {
    color: "#888", fontSize: "12px",
    display: "flex", alignItems: "center",
    gap: "4px", whiteSpace: "nowrap",
  },
  addTcBtn: {
    background: "#2d2d2d", border: "1px solid #3a3a3a",
    borderRadius: "6px", padding: "6px 14px",
    color: "#888", fontSize: "12px", cursor: "pointer", marginTop: "4px",
  },
  summaryRow: {
    display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap",
  },
  summaryCard: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "10px", padding: "16px 24px",
    textAlign: "center", flex: 1, minWidth: "120px",
  },
  summaryNum: {
    fontSize: "28px", fontWeight: "700", color: "#f89f1b", marginBottom: "4px",
  },
  summaryLabel: { fontSize: "12px", color: "#888" },
  subTitle: {
    fontSize: "16px", fontWeight: "600",
    color: "#e0e0e0", marginBottom: "12px",
  },
  tableContainer: {
    overflowX: "auto", borderRadius: "10px",
    border: "1px solid #3a3a3a", marginBottom: "16px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    background: "#2d2d2d", color: "#888",
    fontSize: "12px", fontWeight: "600",
    padding: "10px 16px", textAlign: "left",
  },
  tr: { borderBottom: "1px solid #2d2d2d" },
  td: { padding: "10px 16px", color: "#e0e0e0", fontSize: "13px" },
  rankBadge: {
    padding: "2px 8px", borderRadius: "4px",
    fontSize: "12px", fontWeight: "700", color: "#e0e0e0",
  },
  flagCard: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "8px", padding: "12px 16px",
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "8px",
  },
  flagLeft: { display: "flex", alignItems: "center", gap: "12px" },
  flagRight: { display: "flex", gap: "8px" },
  flagUser: { color: "#e0e0e0", fontSize: "14px", fontWeight: "600" },
  flagStatus: { color: "#888", fontSize: "12px" },
  plagBadge: {
    background: "#2e1a1a", color: "#f87171",
    padding: "3px 10px", borderRadius: "4px",
    fontSize: "11px", fontWeight: "600",
  },
  aiBadge: {
    background: "#1a1a2e", color: "#818cf8",
    padding: "3px 10px", borderRadius: "4px",
    fontSize: "11px", fontWeight: "600",
  },
  candidateBtn: {
    background: "none", border: "none",
    color: "#f89f1b", fontSize: "13px",
    cursor: "pointer", textDecoration: "underline", padding: 0,
  },
  modalOverlay: {
    position: "fixed", top: 0, left: 0,
    right: 0, bottom: 0,
    background: "rgba(0,0,0,0.8)",
    zIndex: 9999, display: "flex",
    alignItems: "center", justifyContent: "center",
    padding: "20px",
  },
  modal: {
    background: "#1e1e1e", border: "1px solid #3a3a3a",
    borderRadius: "16px", width: "100%",
    maxWidth: "760px", maxHeight: "90vh",
    overflow: "hidden", display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "20px 24px",
    borderBottom: "1px solid #3a3a3a",
  },
  modalTitle: { fontSize: "18px", fontWeight: "700", color: "#e0e0e0" },
  closeBtn: {
    background: "#2d2d2d", border: "1px solid #3a3a3a",
    color: "#888", width: "30px", height: "30px",
    borderRadius: "6px", cursor: "pointer", fontSize: "12px",
  },
  modalBody: { overflowY: "auto", padding: "24px", flex: 1 },
  verdictBanner: {
    border: "1px solid", borderRadius: "10px",
    padding: "16px 20px", marginBottom: "24px",
    display: "flex", justifyContent: "space-between",
    alignItems: "center",
  },
  modalSectionTitle: {
    fontSize: "14px", fontWeight: "600",
    color: "#888", marginBottom: "12px",
    marginTop: "20px", textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  scamGrid: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "8px" },
  scamCard: {
    display: "flex", alignItems: "center",
    gap: "12px",
  },
  scamLabel: { color: "#e0e0e0", fontSize: "13px", minWidth: "130px" },
  scamBarContainer: {
    flex: 1, height: "8px",
    background: "#2d2d2d", borderRadius: "4px", overflow: "hidden",
  },
  scamBar: { height: "100%", borderRadius: "4px", transition: "width 0.3s" },
  scamPct: { fontSize: "13px", fontWeight: "600", minWidth: "40px", textAlign: "right" },
  behaviorGrid: {
    display: "flex", flexWrap: "wrap",
    gap: "10px", marginBottom: "8px",
  },
  behaviorCard: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "8px", padding: "12px 16px",
    textAlign: "center", minWidth: "90px", flex: 1,
  },
  behaviorVal: { fontSize: "20px", fontWeight: "700", color: "#f89f1b", marginBottom: "4px" },
  behaviorLabel: { fontSize: "11px", color: "#888" },
  explanationCard: {
    background: "#242424", borderRadius: "8px",
    padding: "14px 16px", marginBottom: "10px",
  },
  expHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "8px",
  },
  expType: { fontSize: "13px", fontWeight: "700" },
  expSeverity: {
    padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600",
  },
  expReason: { color: "#c0c0c0", fontSize: "13px", marginBottom: "6px", lineHeight: 1.6 },
  expEvidence: { color: "#666", fontSize: "12px", fontStyle: "italic" },
  subCard: {
    background: "#242424", border: "1px solid #3a3a3a",
    borderRadius: "8px", padding: "14px 16px", marginBottom: "10px",
  },
  subHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "6px",
  },
  subTitle2: { color: "#e0e0e0", fontSize: "14px", fontWeight: "600" },
  subStatus: { padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" },
  subMeta: { color: "#888", fontSize: "12px", marginBottom: "6px" },
  subScores: { display: "flex", gap: "16px", marginBottom: "8px" },
  breakdownGrid: {
    display: "flex", flexWrap: "wrap", gap: "8px",
    background: "#1a1a1a", borderRadius: "6px", padding: "8px",
  },
  breakdownItem: {
    display: "flex", gap: "6px",
    alignItems: "center", minWidth: "140px",
  },
  breakdownLabel: { color: "#666", fontSize: "11px" },
};