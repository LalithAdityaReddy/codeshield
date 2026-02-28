import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import api from "../services/api";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await api.get("/api/tests/");
      setTests(response.data);
    } catch (err) {
      toast.error("Failed to load tests");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleStartTest = async (testId) => {
    try {
      await startTestSession(testId);
      navigate(`/exam/${testId}`);
    } catch (err) {
      const msg = err.response?.data?.detail;
      if (msg && msg.includes("attempt this test again in")) {
        toast.error(msg);
      } else {
        navigate(`/exam/${testId}`);
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>C</div>
          <span style={styles.logoText}>CodeShield</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.username}>{user?.username}</span>
          <span style={styles.role}>{user?.role}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Available Assessments</h1>
          <p style={styles.subtitle}>
            Select a test to begin your coding assessment
          </p>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading tests...</div>
        ) : tests.length === 0 ? (
          <div style={styles.empty}>
            <p>No tests available at the moment.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {tests.map((test) => (
              <div key={test.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{test.title}</h3>
                  <span style={styles.duration}>⏱ {test.duration_mins} mins</span>
                </div>
                <p style={styles.cardDesc}>
                  {test.description || "No description provided"}
                </p>
                <div style={styles.cardFooter}>
                  <div style={styles.cardMeta}>
                    <span style={styles.activeTag}>
                      {test.is_active ? "Active" : "○ Inactive"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleStartTest(test.id)}
                    style={styles.startBtn}
                  >
                    Start Test →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#1a1a1a",
  },
  navbar: {
    height: "56px",
    background: "#242424",
    borderBottom: "1px solid #3a3a3a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoIcon: {
    width: "32px",
    height: "32px",
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "900",
    color: "#fff",
  },
  logoText: {
    color: "#f89f1b",
    fontWeight: "700",
    fontSize: "18px",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  username: {
    color: "#e0e0e0",
    fontSize: "14px",
  },
  role: {
    background: "#2d3a2d",
    color: "#4ade80",
    padding: "2px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  logoutBtn: {
    background: "#3a2d2d",
    border: "1px solid #5a3a3a",
    color: "#f87171",
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  main: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#e0e0e0",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
  },
  loading: {
    color: "#888",
    textAlign: "center",
    padding: "60px",
    fontSize: "15px",
  },
  empty: {
    color: "#888",
    textAlign: "center",
    padding: "60px",
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#242424",
    border: "1px solid #3a3a3a",
    borderRadius: "12px",
    padding: "24px",
    transition: "border-color 0.2s",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#e0e0e0",
    flex: 1,
    marginRight: "12px",
  },
  duration: {
    color: "#f89f1b",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  cardDesc: {
    fontSize: "13px",
    color: "#888",
    lineHeight: "1.6",
    marginBottom: "20px",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMeta: {
    display: "flex",
    gap: "8px",
  },
  activeTag: {
    color: "#4ade80",
    fontSize: "12px",
  },
  startBtn: {
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
};