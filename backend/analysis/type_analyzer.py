"""Data type analysis and inconsistency detection."""
import pandas as pd
import numpy as np
from backend.utils.df_utils import is_numeric_col, is_categorical_col, is_datetime_col


def analyze_types(df: pd.DataFrame) -> dict:
    issues = []
    columns = []

    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)
        non_null = series.dropna()
        if len(non_null) == 0:
            columns.append({"column": col, "dtype": dtype, "issues": []})
            continue

        col_issues = []

        # Numeric stored as object / text
        if not pd.api.types.is_numeric_dtype(series):
            num_coerced = pd.to_numeric(non_null, errors="coerce")
            num_success = num_coerced.notna().mean()
            if num_success > 0.7:
                col_issues.append({
                    "type": "NUMERIC_AS_TEXT",
                    "column": col,
                    "description": f"Column '{col}' appears to contain numeric values but is stored as text ({num_success*100:.0f}% parseable).",
                    "convertible_count": int(num_coerced.notna().sum()),
                    "non_convertible_count": int(num_coerced.isna().sum()),
                    "proposed_type": "float64" if "." in str(non_null.iloc[0]) else "int64",
                    "severity": "high" if num_success > 0.95 else "medium",
                })

        # Date stored as object / text
        if not pd.api.types.is_datetime64_any_dtype(series) and not pd.api.types.is_numeric_dtype(series):
            try:
                dt_coerced = pd.to_datetime(non_null, errors="coerce")
                dt_success = dt_coerced.notna().mean()
                if dt_success > 0.8 and not col_issues:
                    col_issues.append({
                        "type": "DATETIME_AS_TEXT",
                        "column": col,
                        "description": f"Column '{col}' appears to contain dates/times but is stored as text ({dt_success*100:.0f}% parseable).",
                        "convertible_count": int(dt_coerced.notna().sum()),
                        "non_convertible_count": int(dt_coerced.isna().sum()),
                        "proposed_type": "datetime64",
                        "severity": "medium",
                    })
            except Exception:
                pass

        # Mixed numeric and non-numeric in object columns
        if is_categorical_col(series) and not col_issues:
            num_mask = pd.to_numeric(non_null, errors="coerce").notna()
            if 0 < num_mask.mean() < 1:
                col_issues.append({
                    "type": "MIXED_TYPES",
                    "column": col,
                    "description": f"Column '{col}' contains a mix of numeric ({num_mask.sum()} values) and non-numeric ({(~num_mask).sum()} values).",
                    "numeric_count": int(num_mask.sum()),
                    "non_numeric_count": int((~num_mask).sum()),
                    "severity": "medium",
                })

        # Boolean inconsistency
        if is_categorical_col(series):
            unique_lower = set(str(v).strip().lower() for v in non_null.unique())
            bool_vals = {"true", "false", "yes", "no", "1", "0", "y", "n", "t", "f"}
            if unique_lower.issubset(bool_vals) and len(unique_lower) >= 2:
                col_issues.append({
                    "type": "BOOLEAN_AS_TEXT",
                    "column": col,
                    "description": f"Column '{col}' appears to contain boolean-like values stored as text.",
                    "unique_values": list(unique_lower),
                    "proposed_type": "boolean",
                    "severity": "low",
                })

        columns.append({
            "column": col,
            "dtype": dtype,
            "issues": col_issues,
        })
        issues.extend(col_issues)

    return {
        "type_issues": issues,
        "has_type_issues": len(issues) > 0,
        "columns_with_issues": sum(1 for c in columns if c["issues"]),
        "column_details": columns,
    }


def preview_type_conversion(df: pd.DataFrame, col: str, target_type: str) -> dict:
    """Preview what a type conversion would look like."""
    if col not in df.columns:
        return {"error": f"Column '{col}' not found."}
    series = df[col]
    try:
        if target_type in ("float64", "int64", "numeric"):
            converted = pd.to_numeric(series, errors="coerce")
            failed = series[converted.isna() & series.notna()]
        elif target_type == "datetime64":
            converted = pd.to_datetime(series, errors="coerce")
            failed = series[converted.isna() & series.notna()]
        else:
            converted = series.astype(target_type, errors="ignore")
            failed = pd.Series([], dtype=object)
        return {
            "column": col,
            "current_type": str(series.dtype),
            "target_type": target_type,
            "total_values": len(series),
            "convertible_count": int(converted.notna().sum()),
            "non_convertible_count": int(len(failed)),
            "non_convertible_examples": [str(v) for v in failed.head(5).tolist()],
            "sample_output": [str(v) for v in converted.dropna().head(5).tolist()],
        }
    except Exception as e:
        return {"error": str(e)}
