# Scoring helpers — extend when custom ML scoring functions are needed


def normalize_score(score: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamp a score to [min_val, max_val]."""
    return max(min_val, min(score, max_val))


def weighted_average(scores: dict, weights: dict) -> float:
    """Compute weighted average given a dict of scores and weights."""
    total_weight = sum(weights.values())
    if total_weight == 0:
        return 0.0
    return sum(scores.get(k, 0) * w for k, w in weights.items()) / total_weight
