import api from "./api";

export const submitCode = async (sessionId, questionId, code, language) => {
  const response = await api.post(`/api/submissions/${sessionId}/submit`, {
    question_id: questionId,
    code,
    language,
  });
  return response.data;
};