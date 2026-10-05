"""Master analysis orchestrator — runs all sub-analyzers and assembles full analysis result."""
import pandas as pd
from backend.analysis.schema_analyzer import analyze_schema
from backend.analysis.missing_analyzer import analyze_missing
from backend.analysis.duplicate_analyzer import analyze_duplicates
from backend.analysis.outlier_analyzer import analyze_outliers
from backend.analysis.type_analyzer import analyze_types
from backend.analysis.suspicious_analyzer import analyze_suspicious
from backend.analysis.stats_analyzer import analyze_stats
from backend.analysis.quality_scorer import compute_quality_score
from backend.analysis.recommender import generate_recommendations


def run_full_analysis(df: pd.DataFrame) -> dict:
    """Run all analysis modules on a DataFrame and return complete results."""
    if df is None or len(df) == 0:
        return {"error": "Dataset is empty or could not be loaded."}

    schema = analyze_schema(df)
    missing = analyze_missing(df)
    duplicates = analyze_duplicates(df)
    outliers = analyze_outliers(df)
    types = analyze_types(df)
    suspicious = analyze_suspicious(df)
    stats = analyze_stats(df)

    analysis = {
        "schema": schema,
        "missing": missing,
        "duplicates": duplicates,
        "outliers": outliers,
        "types": types,
        "suspicious": suspicious,
        "stats": stats,
    }

    quality_score = compute_quality_score(df, analysis)
    analysis["quality_score"] = quality_score

    recommendations = generate_recommendations(df, analysis)
    analysis["recommendations"] = recommendations

    # Build issue center list
    analysis["issue_center"] = _build_issue_center(analysis)

    return analysis


def _build_issue_center(analysis: dict) -> list:
    """Assemble all issues into a unified, categorized list."""
    issues = []

    # Missing values
    for col in analysis["missing"].get("affected_columns", []):
        issues.append({
            "category": "Missing Values",
            "severity": col["severity"],
            "column": col["column"],
            "count": col["missing_count"],
            "pct": col["missing_pct"],
            "description": f"{col['missing_count']} missing values ({col['missing_pct']}%) in column '{col['column']}'",
            "affected_indices": col["affected_row_indices"],
            "action_hint": "fill_missing",
        })

    # Duplicates
    if analysis["duplicates"].get("has_duplicates"):
        issues.append({
            "category": "Duplicate Rows",
            "severity": "high" if analysis["duplicates"]["duplicate_pct"] > 20 else "medium",
            "column": None,
            "count": analysis["duplicates"]["total_duplicates"],
            "pct": analysis["duplicates"]["duplicate_pct"],
            "description": f"{analysis['duplicates']['total_duplicates']} exact duplicate rows detected",
            "affected_indices": [i for g in analysis["duplicates"]["duplicate_groups"] for i in g["indices"]],
            "action_hint": "remove_duplicates",
        })

    # Type issues
    for issue in analysis["types"].get("type_issues", []):
        issues.append({
            "category": "Data-Type Issues",
            "severity": issue.get("severity", "medium"),
            "column": issue.get("column", ""),
            "count": 1,
            "pct": None,
            "description": issue.get("description", ""),
            "affected_indices": [],
            "action_hint": "repair_type",
        })

    # Suspicious values
    for issue in analysis["suspicious"].get("suspicious_issues", []):
        issues.append({
            "category": "Suspicious Values",
            "severity": issue.get("severity", "medium"),
            "column": issue.get("column", ""),
            "count": issue.get("count", 1),
            "pct": None,
            "description": issue.get("description", ""),
            "affected_indices": issue.get("indices", []),
            "action_hint": "edit_cell",
        })

    # Outliers (informational)
    for col_info in analysis["outliers"].get("outlier_details", []):
        issues.append({
            "category": "Potential Outliers",
            "severity": "info",
            "column": col_info["column"],
            "count": col_info["combined_count"],
            "pct": col_info["affected_pct"],
            "description": f"{col_info['combined_count']} potential outlier(s) in column '{col_info['column']}'",
            "affected_indices": col_info["combined_indices"][:50],
            "action_hint": "inspect_outliers",
        })

    # Schema issues
    for issue in analysis["schema"].get("schema_issues", []):
        issues.append({
            "category": "Schema Problems",
            "severity": issue.get("severity", "medium"),
            "column": issue.get("column", ""),
            "count": 1,
            "pct": None,
            "description": issue.get("description", ""),
            "affected_indices": [],
            "action_hint": "schema_fix",
        })

    # Sort by severity
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    issues.sort(key=lambda x: sev_order.get(x["severity"], 5))
    return issues
