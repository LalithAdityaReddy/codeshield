from typing import List, Tuple, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from app.ml_engine.feature_extractor import (
    extract_features,
    get_tokens,
    normalize_code
)


def token_similarity(code1: str, code2: str) -> float:
    """
    Compare normalized token sequences.
    Variable names are replaced so only structure matters.
    """
    tokens1 = get_tokens(normalize_code(code1))
    tokens2 = get_tokens(normalize_code(code2))

    if not tokens1 or not tokens2:
        return 0.0

    # Use longest common subsequence ratio
    lcs_len = lcs_length(tokens1, tokens2)
    similarity = (2 * lcs_len) / (len(tokens1) + len(tokens2))
    return round(similarity, 4)


def lcs_length(seq1: List, seq2: List) -> int:
    """Compute longest common subsequence length."""
    m, n = len(seq1), len(seq2)

    # Use optimized approach for large sequences
    if m > 500 or n > 500:
        seq1 = seq1[:500]
        seq2 = seq2[:500]
        m, n = len(seq1), len(seq2)

    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if seq1[i-1] == seq2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]


def tfidf_similarity(code1: str, code2: str) -> float:
    """
    TF-IDF based similarity on normalized code.
    Catches cases where token order differs but vocabulary is same.
    """
    try:
        norm1 = normalize_code(code1)
        norm2 = normalize_code(code2)

        vectorizer = TfidfVectorizer(
            analyzer="word",
            token_pattern=r"[a-zA-Z_][a-zA-Z0-9_]*|\S"
        )
        matrix = vectorizer.fit_transform([norm1, norm2])
        sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        return round(float(sim), 4)
    except Exception:
        return 0.0


def ngram_similarity(code1: str, code2: str, n: int = 3) -> float:
    """
    N-gram similarity on token sequences.
    Detects copied blocks even with reordering.
    """
    tokens1 = get_tokens(normalize_code(code1))
    tokens2 = get_tokens(normalize_code(code2))

    if len(tokens1) < n or len(tokens2) < n:
        return 0.0

    ngrams1 = set(tuple(tokens1[i:i+n]) for i in range(len(tokens1)-n+1))
    ngrams2 = set(tuple(tokens2[i:i+n]) for i in range(len(tokens2)-n+1))

    if not ngrams1 or not ngrams2:
        return 0.0

    intersection = ngrams1 & ngrams2
    union = ngrams1 | ngrams2

    return round(len(intersection) / len(union), 4)


def ast_similarity(code1: str, code2: str) -> float:
    """
    Compare AST structures.
    Two sum with hashmap vs two sum with sorting will have
    very different AST structures = low score.
    Same structure with renamed variables = high score.
    """
    from app.ml_engine.feature_extractor import get_ast_structure
    struct1 = get_ast_structure(code1)
    struct2 = get_ast_structure(code2)

    if not struct1 or not struct2:
        return 0.0

    lcs_len = lcs_length(struct1, struct2)
    similarity = (2 * lcs_len) / (len(struct1) + len(struct2))
    return round(similarity, 4)


def fingerprint_match(code1: str, code2: str) -> float:
    """
    Compare algorithmic approach fingerprints.
    Different approaches (hashmap vs sorting) = 0.0
    Same approach = 1.0
    This is the KEY check that prevents false positives.
    """
    from app.ml_engine.feature_extractor import get_algorithmic_fingerprint
    fp1 = get_algorithmic_fingerprint(code1)
    fp2 = get_algorithmic_fingerprint(code2)

    if fp1 == fp2:
        return 1.0

    # Partial match
    parts1 = set(fp1.split("_"))
    parts2 = set(fp2.split("_"))
    if not parts1 or not parts2:
        return 0.0

    overlap = len(parts1 & parts2) / len(parts1 | parts2)
    return round(overlap, 4)


def calculate_plagiarism_score(
    code1: str,
    code2: str,
) -> Dict[str, float]:
    """
    Main plagiarism scoring function.

    Logic:
    - Same algorithm + different structure = NOT plagiarism
    - Same algorithm + same structure + renamed vars = PLAGIARISM
    - Different algorithm entirely = NOT plagiarism

    Scoring weights:
    - Token similarity: 30%
    - TF-IDF similarity: 20%
    - N-gram similarity: 25%
    - AST structure: 25%

    Penalty multipliers:
    - Different algorithmic fingerprint: reduce score by 40%
    - Very different code length: reduce score by 20%
    """

    token_sim = token_similarity(code1, code2)
    tfidf_sim = tfidf_similarity(code1, code2)
    ngram_sim = ngram_similarity(code1, code2)
    ast_sim = ast_similarity(code1, code2)
    fp_match = fingerprint_match(code1, code2)

    # Weighted base score
    base_score = (
        token_sim * 0.30 +
        tfidf_sim * 0.20 +
        ngram_sim * 0.25 +
        ast_sim * 0.25
    )

    # Apply fingerprint penalty
    # If algorithms are completely different, reduce score significantly
    if fp_match < 0.3:
        base_score *= 0.4
    elif fp_match < 0.6:
        base_score *= 0.7

    # Length difference penalty
    len1 = len(code1.strip())
    len2 = len(code2.strip())
    if len1 > 0 and len2 > 0:
        length_ratio = min(len1, len2) / max(len1, len2)
        if length_ratio < 0.5:
            base_score *= 0.8

    final_score = round(min(base_score, 1.0), 4)

    return {
        "token_similarity": token_sim,
        "tfidf_similarity": tfidf_sim,
        "ngram_similarity": ngram_sim,
        "ast_similarity": ast_sim,
        "fingerprint_match": fp_match,
        "final_score": final_score,
        "is_flagged": final_score > 0.75,
        "verdict": get_verdict(final_score, fp_match)
    }


def get_verdict(score: float, fp_match: float) -> str:
    if score < 0.30:
        return "clean"
    elif score < 0.60:
        return "similar_approach"
    elif score < 0.75:
        return "suspicious"
    else:
        return "plagiarism"


async def compare_against_all(
    submission_code: str,
    other_submissions: List[Tuple[str, str]],
) -> Dict:
    """
    Compare one submission against all other submissions
    for the same question.

    Returns the highest scoring match.
    """
    best_match = None
    best_score = 0.0
    best_result = None

    for submission_id, code in other_submissions:
        result = calculate_plagiarism_score(submission_code, code)
        if result["final_score"] > best_score:
            best_score = result["final_score"]
            best_match = submission_id
            best_result = result

    if best_result is None:
        return {
            "token_similarity": 0.0,
            "tfidf_similarity": 0.0,
            "ngram_similarity": 0.0,
            "ast_similarity": 0.0,
            "final_score": 0.0,
            "is_flagged": False,
            "matched_submission_id": None,
            "verdict": "clean"
        }

    return {
        **best_result,
        "matched_submission_id": best_match,
    }