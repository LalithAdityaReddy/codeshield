import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { getAllTests, createTest, createQuestion } from "../services/testService";
import toast from "react-hot-toast";

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tests");
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");

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
      setShowCreateQuestion(false);
      setQuestionForm({
        title: "",
        description: "",
        difficulty: "Medium",
        order_index: 1,
        constraints: "",
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

            {/* Create Test Form */}
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

            {/* Tests List */}
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
                    <div style={styles.listActions}>
                      <span style={styles.idText}>ID: {test.id.slice(0, 8)}...</span>
                    </div>
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
  placeholder="e.g. 1 <= n <= 1000&#10;0 <= arr[i] <= 100&#10;1 <= k <= n"
  style={{ ...styles.input, height: "80px", resize: "vertical" }}
/>
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
    This is shown to candidate as starter code
  </span>
</div>

<div style={styles.field}>
  <label style={styles.label}>Driver Code (Hidden from candidate)</label>
  <textarea
    value={questionForm.driver_code}
    onChange={(e) => setQuestionForm({ ...questionForm, driver_code: e.target.value })}
    placeholder={`result = sol.numSteps(__INPUT__)\nprint(result)`}
    style={{ ...styles.input, height: "80px", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
  />
  <span style={{ color: "#555", fontSize: "11px", marginTop: "4px" }}>
    Use __INPUT__ as placeholder for test case input
  </span>
</div>
                  </div>

                  {/* Test Cases */}
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
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#1a1a1a" },
  navbar: {
    height: "56px",
    background: "#242424",
    borderBottom: "1px solid #3a3a3a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
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
  listActions: { display: "flex", alignItems: "center", gap: "12px" },
  idText: { fontSize: "11px", color: "#555", fontFamily: "monospace" },
  testCaseRow: { display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" },
  hiddenLabel: { color: "#888", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" },
  addTcBtn: {
    background: "#2d2d2d", border: "1px solid #3a3a3a",
    borderRadius: "6px", padding: "6px 14px",
    color: "#888", fontSize: "12px", cursor: "pointer", marginTop: "4px",
  },
};