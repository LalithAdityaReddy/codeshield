import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    role: "candidate",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await registerUser(
        form.email,
        form.username,
        form.password,
        form.role
      );
      setAuth(data.access_token, {
        id: data.user_id,
        username: data.username,
        role: data.role,
      });
      toast.success("Account created!");
      if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>C</div>
          <span style={styles.logoText}>CodeShield</span>
        </div>

        <h2 style={styles.title}>Create account</h2>
        <p style={styles.subtitle}>Start your assessment journey</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="yourname"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>


          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1a1a1a",
    padding: "20px",
  },
  card: {
    background: "#242424",
    border: "1px solid #3a3a3a",
    borderRadius: "12px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "28px",
    justifyContent: "center",
  },
  logoIcon: {
    width: "36px",
    height: "36px",
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "900",
    color: "#fff",
  },
  logoText: {
    color: "#f89f1b",
    fontWeight: "700",
    fontSize: "20px",
    letterSpacing: "1px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: "6px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    textAlign: "center",
    marginBottom: "28px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    color: "#aaa",
    fontWeight: "500",
  },
  input: {
    background: "#2d2d2d",
    border: "1px solid #3a3a3a",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#e0e0e0",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    background: "linear-gradient(135deg, #f89f1b, #ff6b35)",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "8px",
  },
  footer: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "13px",
    color: "#888",
  },
  link: {
    color: "#f89f1b",
    fontWeight: "500",
  },
};