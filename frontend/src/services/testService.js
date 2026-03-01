import api from "./api";

export const getAllTests = async () => {
  const response = await api.get("/api/tests/");
  return response.data;
};

export const getTestById = async (testId) => {
  const response = await api.get(`/api/tests/${testId}`);
  return response.data;
};

export const createTest = async (data) => {
  const response = await api.post("/api/tests/", data);
  return response.data;
};

export const startTestSession = async (testId) => {
  const response = await api.post(`/api/tests/${testId}/start`);
  return response.data;
};

export const createQuestion = async (testId, data) => {
  const response = await api.post(`/api/questions/${testId}/questions`, data);
  return response.data;
};

export const getQuestions = async (testId) => {
  const response = await api.get(`/api/questions/${testId}/questions`);
  return response.data;
};

export const completeTestSession = async (testId) => {
  const response = await api.post(`/api/tests/${testId}/complete`);
  return response.data;
};