import api from "./api";

export const submitCode = async (sessionId, questionId, code, language) => {
  const response = await api.post(`/api/submissions/${sessionId}/submit`, {
    question_id: questionId,
    code,
    language,
  });
  return response.data;
};

export const runCode = async (code, language, input = "") => {
  const response = await api.post(`/api/submissions/run`, {
    code,
    language,
    input,
  });
  return response.data;
};

export const runSamples = async (code, language, questionId) => {
  const response = await api.post(`/api/submissions/run-samples`, {
    code,
    language,
    question_id: questionId,
  });
  return response.data;
};