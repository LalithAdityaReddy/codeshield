import api from "./api";

export const registerUser = async (email, username, password, role = "candidate") => {
  const response = await api.post("/api/auth/register", {
    email,
    username,
    password,
    role,
  });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await api.post("/api/auth/login", {
    email,
    password,
  });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/api/auth/me");
  return response.data;
};