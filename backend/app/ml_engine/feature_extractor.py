import ast
import re
import tokenize
import io
from typing import List, Dict, Any


def normalize_code(code: str) -> str:
    """
    Normalize code by replacing variable names with generic placeholders.
    This ensures sum(arr) and loop-based sum get same structure score.
    """
    try:
        tree = ast.parse(code)
        transformer = VariableNormalizer()
        normalized_tree = transformer.visit(tree)
        return ast.unparse(normalized_tree)
    except Exception:
        return code


class VariableNormalizer(ast.NodeTransformer):
    def __init__(self):
        self.var_map = {}
        self.counter = 0
        # Keep builtin names unchanged
        self.builtins = {
            "print", "input", "range", "len", "int", "str", "float",
            "list", "dict", "set", "tuple", "sum", "min", "max",
            "sorted", "enumerate", "zip", "map", "filter", "append",
            "True", "False", "None", "return", "self"
        }

    def get_var_name(self, name: str) -> str:
        if name in self.builtins:
            return name
        if name not in self.var_map:
            self.var_map[name] = f"var{self.counter}"
            self.counter += 1
        return self.var_map[name]

    def visit_Name(self, node):
        node.id = self.get_var_name(node.id)
        return node

    def visit_FunctionDef(self, node):
        if node.name not in self.builtins and node.name != "Solution":
            node.name = self.get_var_name(node.name)
        self.generic_visit(node)
        return node

    def visit_arg(self, node):
        node.arg = self.get_var_name(node.arg)
        return node


def get_tokens(code: str) -> List[str]:
    """Extract tokens from code ignoring variable names."""
    tokens = []
    try:
        token_gen = tokenize.generate_tokens(io.StringIO(code).readline)
        for tok_type, tok_string, _, _, _ in token_gen:
            if tok_type in (tokenize.COMMENT, tokenize.NEWLINE,
                           tokenize.NL, tokenize.ENCODING):
                continue
            if tok_type == tokenize.NAME:
                tokens.append("NAME")
            elif tok_type == tokenize.NUMBER:
                tokens.append("NUM")
            elif tok_type == tokenize.STRING:
                tokens.append("STR")
            else:
                tokens.append(tok_string)
    except Exception:
        tokens = code.split()
    return tokens


def get_ast_structure(code: str) -> List[str]:
    """
    Extract AST node types as structural fingerprint.
    Two different implementations of same algorithm will have
    different AST structures — this is the key insight.
    """
    structure = []
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            node_type = type(node).__name__
            # Only keep meaningful structural nodes
            if node_type in (
                "FunctionDef", "ClassDef", "For", "While", "If",
                "Return", "Assign", "AugAssign", "Call", "BinOp",
                "Compare", "BoolOp", "ListComp", "DictComp",
                "Try", "With", "Lambda", "Yield"
            ):
                structure.append(node_type)
    except Exception:
        pass
    return structure


def get_control_flow(code: str) -> Dict[str, int]:
    """Count control flow structures."""
    flow = {
        "for_loops": 0,
        "while_loops": 0,
        "if_statements": 0,
        "try_except": 0,
        "list_comp": 0,
        "recursion": 0,
        "nested_depth": 0,
    }
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.For):
                flow["for_loops"] += 1
            elif isinstance(node, ast.While):
                flow["while_loops"] += 1
            elif isinstance(node, ast.If):
                flow["if_statements"] += 1
            elif isinstance(node, ast.Try):
                flow["try_except"] += 1
            elif isinstance(node, ast.ListComp):
                flow["list_comp"] += 1
    except Exception:
        pass
    return flow


def get_algorithmic_fingerprint(code: str) -> str:
    """
    Classify the algorithmic approach.
    This prevents flagging two solutions that use completely
    different approaches to the same problem.
    """
    code_lower = code.lower()
    normalized = normalize_code(code)

    fingerprints = []

    # Hash map / dictionary approach
    if "dict" in code_lower or "{}" in code or "hashmap" in code_lower:
        fingerprints.append("hashmap")

    # Sorting based
    if "sort" in code_lower:
        fingerprints.append("sorting")

    # Two pointer
    if re.search(r"left.*right|right.*left|start.*end|i.*j", code_lower):
        fingerprints.append("two_pointer")

    # Dynamic programming
    if "dp" in code_lower or "memo" in code_lower or "cache" in code_lower:
        fingerprints.append("dp")

    # Recursion
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_name = node.name
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        if isinstance(child.func, ast.Name):
                            if child.func.id == func_name:
                                fingerprints.append("recursion")
                                break
    except Exception:
        pass

    # Stack/queue
    if "stack" in code_lower or "queue" in code_lower or "deque" in code_lower:
        fingerprints.append("stack_queue")

    # Binary search
    if "mid" in code_lower or "binary" in code_lower:
        fingerprints.append("binary_search")

    # Simple iteration
    if not fingerprints:
        fingerprints.append("iteration")

    return "_".join(sorted(fingerprints))


def extract_features(code: str) -> Dict[str, Any]:
    """Extract all features from code for comparison."""
    return {
        "tokens": get_tokens(code),
        "normalized_tokens": get_tokens(normalize_code(code)),
        "ast_structure": get_ast_structure(code),
        "control_flow": get_control_flow(code),
        "fingerprint": get_algorithmic_fingerprint(code),
        "normalized_code": normalize_code(code),
        "line_count": len(code.strip().split("\n")),
        "char_count": len(code),
    }