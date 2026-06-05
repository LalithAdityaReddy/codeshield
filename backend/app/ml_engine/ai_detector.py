import re
import ast
from typing import List, Dict, Any


def calculate_ai_score(code: str, keystroke_events: List[Dict]) -> Dict[str, float]:
    """
    Detect if code was AI-generated or copy-pasted based on:
    1. Code structure metrics (comment density, line uniformity, etc.)
    2. Typing behavior from WebSocket keystroke events
    """

    comment_density     = _check_comment_density(code)
    line_length_score   = _check_line_length_uniformity(code)
    indent_uniformity   = _check_indent_uniformity(code)
    var_naming_entropy  = _check_var_naming_entropy(code)
    paste_burst_score   = _check_paste_bursts(keystroke_events)
    typing_anomaly      = _check_typing_anomaly(code, keystroke_events)
    template_match      = _check_template_patterns(code)

    # Weighted final score — emphasize styling & naming as AI indicators
    final_score = (
        comment_density    * 0.10 +
        line_length_score  * 0.05 +
        indent_uniformity  * 0.20 +   # Increased: perfect spacing suggests AI
        var_naming_entropy * 0.25 +   # Increased: good semantic naming suggests AI
        paste_burst_score  * 0.20 +
        typing_anomaly     * 0.15 +
        template_match     * 0.05
    )

    final_score = round(min(final_score, 1.0), 4)

    return {
        "comment_density":    round(comment_density, 4),
        "line_length_score":  round(line_length_score, 4),
        "indent_uniformity":  round(indent_uniformity, 4),
        "var_naming_entropy": round(var_naming_entropy, 4),
        "paste_burst_score":  round(paste_burst_score, 4),
        "typing_anomaly":     round(typing_anomaly, 4),
        "template_match":     round(template_match, 4),
        "final_score":        final_score,
        "is_flagged":         final_score > 0.55,   # lowered threshold
        "verdict":            _get_verdict(final_score)
    }


def _check_comment_density(code: str) -> float:
    lines = code.strip().split("\n")
    if not lines:
        return 0.0
    comment_lines = sum(1 for l in lines if l.strip().startswith("#")
                        or l.strip().startswith("//")
                        or l.strip().startswith("*"))
    ratio = comment_lines / len(lines)
    return min(ratio / 0.3, 1.0) if ratio > 0.3 else 0.0


def _check_line_length_uniformity(code: str) -> float:
    lines = [l for l in code.strip().split("\n") if l.strip()]
    if len(lines) < 3:
        return 0.0
    lengths = [len(l) for l in lines]
    avg = sum(lengths) / len(lengths)
    variance = sum((l - avg) ** 2 for l in lengths) / len(lengths)
    if variance < 50:
        return 0.8
    elif variance < 150:
        return 0.4
    return 0.0


def _check_indent_uniformity(code: str) -> float:
    lines = [l for l in code.split("\n") if l.strip()]
    if not lines:
        return 0.0
    indents = []
    for line in lines:
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if indent > 0:
            indents.append(indent)
    if not indents:
        return 0.0
    gcd_val = indents[0]
    for i in indents[1:]:
        gcd_val = _gcd(gcd_val, i)
    if gcd_val > 0:
        all_uniform = all(i % gcd_val == 0 for i in indents)
        return 0.9 if all_uniform else 0.1
    return 0.0


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def _check_var_naming_entropy(code: str) -> float:
    try:
        tree = ast.parse(code)
        var_names = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                var_names.append(node.id)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                var_names.append(node.name)
        if not var_names:
            return 0.0
        ai_names = {"result", "temp", "current", "node", "left", "right",
                    "output", "answer", "res", "val", "item", "element",
                    "solution", "helper", "dp", "memo"}
        ai_count = sum(1 for v in var_names if v.lower() in ai_names)
        ratio = ai_count / len(var_names)
        return min(ratio * 3.5, 1.0)
    except Exception:
        return 0.0


def _check_paste_bursts(events: List[Dict]) -> float:
    """
    Check for large paste events from the WebSocket event log.
    Also detects code volume vs keystrokes mismatch.
    """
    if not events:
        # No events at all — definitely didn't type it
        return 0.85

    paste_events = [e for e in events if e.get("type") == "paste"]
    keypress_events = [e for e in events if e.get("type") == "keypress"]

    if not paste_events and not keypress_events:
        return 0.85

    # Any large paste is a strong signal
    large_pastes = [
        e for e in paste_events
        if e.get("payload", {}).get("is_large_paste", False)
        or e.get("payload", {}).get("pasted_length", 0) > 50
    ]

    if large_pastes:
        return 0.95  # Very high confidence — large paste detected

    if paste_events:
        return min(0.3 + len(paste_events) * 0.2, 0.9)

    return 0.0


def _check_typing_anomaly(code: str, events: List[Dict]) -> float:
    """
    Detect suspicious typing patterns:
    - Code exists but very few/no keystrokes → copy-pasted
    - Extremely fast average typing speed → suspicious
    - Very few keypress events relative to code length
    """
    keypress_events = [e for e in events if e.get("type") == "keypress"]
    code_len = len(code.strip())

    # Code exists but no keystrokes logged → 100% suspicious
    if code_len > 30 and len(keypress_events) == 0:
        return 1.0

    # Code much longer than number of keystrokes → paste suspected
    if code_len > 50 and len(keypress_events) < code_len * 0.3:
        ratio = len(keypress_events) / code_len
        return min(1.0 - ratio, 0.95)

    # Check typing speed distribution
    speeds = [
        e.get("payload", {}).get("typing_speed_ms", 0)
        for e in keypress_events
        if e.get("payload", {}).get("typing_speed_ms", 0) > 0
    ]

    if not speeds:
        if keypress_events:
            return 0.3  # Some keystrokes but no timing data
        return 0.0

    avg_speed = sum(speeds) / len(speeds)
    # Very fast typing (avg < 80ms between keystrokes) = suspicious
    if avg_speed < 80:
        return 0.9
    elif avg_speed < 150:
        return 0.6
    elif avg_speed < 250:
        return 0.2
    return 0.0


def _check_template_patterns(code: str) -> float:
    ai_patterns = [
        r"# Initialize",
        r"# Iterate",
        r"# Check if",
        r"# Return",
        r"# Helper function",
        r"# Main function",
        r"# Edge case",
        r"# Time complexity",
        r"# Space complexity",
        r"// Initialize",
        r"// Helper",
    ]
    matches = sum(1 for p in ai_patterns if re.search(p, code, re.IGNORECASE))
    return min(matches * 0.25, 1.0)


def _get_verdict(score: float) -> str:
    if score < 0.30:
        return "human_written"
    elif score < 0.50:
        return "possibly_human"
    elif score < 0.65:
        return "uncertain"
    else:
        return "likely_ai_or_copied"