// Code helper utilities — extend as needed

/**
 * Retrieve the language label for display
 */
export function getLanguageLabel(lang) {
  const labels = {
    python3: "Python 3",
    javascript: "JavaScript",
    java: "Java",
    cpp: "C++",
  };
  return labels[lang] || lang;
}

/**
 * Returns the Monaco editor language identifier for a given language key
 */
export function getMonacoLanguage(lang) {
  const map = {
    python3: "python",
    javascript: "javascript",
    java: "java",
    cpp: "cpp",
  };
  return map[lang] || "plaintext";
}
