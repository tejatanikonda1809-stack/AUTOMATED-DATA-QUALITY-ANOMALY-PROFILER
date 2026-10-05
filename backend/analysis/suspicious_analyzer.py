"""Suspicious and invalid value detection."""
import pandas as pd
import numpy as np
from backend.utils.df_utils import is_numeric_col, is_identifier_col, clean_numeric_series


def analyze_suspicious(df: pd.DataFrame) -> dict:
    issues = []
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()
        if len(non_null) == 0:
            continue

        if is_numeric_col(series) and not is_identifier_col(series, col):
            issues.extend(_numeric_suspicious(series, col))
        else:
            issues.extend(_text_suspicious(series, col))

    return {
        "suspicious_issues": issues,
        "has_suspicious": len(issues) > 0,
        "total_suspicious_count": sum(i.get("count", 1) for i in issues),
    }


def _numeric_suspicious(series: pd.Series, col: str) -> list:
    issues = []
    num_series = clean_numeric_series(series)
    non_null = num_series.dropna()
    if len(non_null) < 3:
        return []

    # Extreme outliers (beyond 3×IQR)
    q1 = float(non_null.quantile(0.25))
    q3 = float(non_null.quantile(0.75))
    iqr = q3 - q1
    extreme_lower = q1 - 3 * iqr
    extreme_upper = q3 + 3 * iqr
    extreme_mask = (num_series < extreme_lower) | (num_series > extreme_upper)
    extreme_vals = num_series[extreme_mask & num_series.notna()]
    if len(extreme_vals) > 0:
        issues.append({
            "type": "EXTREME_OUTLIER",
            "column": col,
            "count": int(len(extreme_vals)),
            "indices": [int(i) for i in extreme_vals.index.tolist()],
            "values": [float(v) for v in extreme_vals.head(10).tolist()],
            "description": f"Column '{col}' has {len(extreme_vals)} value(s) beyond 3×IQR fence ({extreme_lower:.2f}, {extreme_upper:.2f}).",
            "severity": "high",
            "why": "Values beyond 3× the IQR fence are statistically unusual and may indicate data entry errors.",
            "recommendation": "Inspect each value and decide: keep, correct, or delete.",
        })

    # Negative values in columns that appear logically non-negative
    if non_null.min() >= 0 and len(non_null) > 10:
        pass  # Can't automatically determine domain without metadata

    # All same decimal pattern issues (e.g., round numbers might be suspicious if they all end in .0)
    return issues


def _text_suspicious(series: pd.Series, col: str) -> list:
    issues = []
    non_null = series.dropna().astype(str)
    if len(non_null) == 0:
        return []

    # Very long strings
    lengths = non_null.str.len()
    mean_len = lengths.mean()
    std_len = lengths.std()
    if std_len > 0 and mean_len > 5:
        threshold = mean_len + 3 * std_len
        long_mask = lengths > threshold
        long_vals = non_null[long_mask]
        if len(long_vals) > 0:
            issues.append({
                "type": "UNUSUALLY_LONG_TEXT",
                "column": col,
                "count": int(len(long_vals)),
                "indices": [int(i) for i in long_vals.index.tolist()],
                "values": [str(v) for v in long_vals.head(5).tolist()],
                "description": f"Column '{col}' has {len(long_vals)} value(s) with unusually long text (>{threshold:.0f} chars).",
                "severity": "low",
                "why": "Unusually long text may indicate data entry errors or concatenation issues.",
                "recommendation": "Inspect these values for possible errors.",
            })

    # Placeholder-like values
    placeholders = {"n/a", "na", "nil", "none", "unknown", "null", "?", "-", "--", "tbd", "tba", "xxx"}
    ph_mask = non_null.str.lower().str.strip().isin(placeholders)
    ph_count = int(ph_mask.sum())
    if ph_count > 0:
        ph_vals = non_null[ph_mask]
        ph_indices = [int(i) for i in ph_vals.index.tolist()]
        issues.append({
            "type": "PLACEHOLDER_VALUES",
            "column": col,
            "count": ph_count,
            "indices": ph_indices,
            "values": list(ph_vals.head(10).tolist()),
            "description": f"Column '{col}' has {ph_count} potential placeholder value(s) (e.g., 'N/A', 'Unknown').",
            "severity": "medium",
            "why": "Placeholder strings may mask missing values and affect analysis accuracy.",
            "recommendation": "Consider treating these as missing values or correcting them.",
        })

    # Inconsistent casing for categorical
    if len(non_null.unique()) < 50:
        lower_counts = non_null.str.lower().value_counts()
        for val_lower, count in lower_counts.items():
            variants = [v for v in non_null.unique() if str(v).lower() == val_lower]
            if len(variants) > 1:
                var_indices = [int(i) for i in non_null[non_null.str.lower() == val_lower].index.tolist()]
                issues.append({
                    "type": "CASING_INCONSISTENCY",
                    "column": col,
                    "count": int(count),
                    "variants": variants[:10],
                    "indices": var_indices,
                    "description": f"Column '{col}' has inconsistent casing for value '{val_lower}': {variants[:5]}.",
                    "severity": "low",
                    "why": "Inconsistent casing may cause grouping/counting errors in analysis.",
                    "recommendation": "Standardize casing for this column.",
                })
                break  # one issue per column is enough

    return issues

