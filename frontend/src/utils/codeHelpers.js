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
    c: "C",
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
    c: "c",
  };
  return map[lang] || "plaintext";
}

/**
 * CP-style full-program starter templates (shown when a question has no function signature)
 */
export const CP_STARTER = {
  python3: `import sys
input = sys.stdin.readline

# Write your solution here
`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
let idx = 0;
const input = () => lines[idx++];

// Write your solution here
`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Write your solution here
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution here
    
    return 0;
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // Write your solution here
    
    return 0;
}
`,
};

/**
 * Resolve the starter code to show in the editor for a given question + language.
 *
 * Priority:
 *  1. JSON dict function_signature: { python3: "def f(): ...", ... }  → use per-language
 *  2. Plain text function_signature (legacy):                          → show as-is
 *  3. No function_signature:                                           → CP template
 */
export function getStarterCode(question, lang) {
  if (!question) return CP_STARTER[lang] || "";

  const raw = question.function_signature;
  if (!raw) return CP_STARTER[lang] || "";

  // Try JSON dict format
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed[lang] || CP_STARTER[lang] || "";
    }
  } catch {
    // Not JSON — it's a plain-text legacy signature
  }

  // Plain text (legacy): return as-is regardless of language
  return raw;
}
