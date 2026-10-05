"""Cleaning operation routes."""
from flask import Blueprint, request, jsonify
import numpy as np
from backend.services import session_manager as sm
from backend.cleaning import cleaning_engine as ce
from backend.analysis import run_full_analysis
from backend.analysis.missing_analyzer import compute_imputation_value
from backend.analysis.type_analyzer import preview_type_conversion
from backend.utils.df_utils import is_numeric_col, can_be_numeric, clean_numeric_series, get_missing_mask

bp = Blueprint("cleaning", __name__, url_prefix="/api/clean")


def _require(data, *keys):
    for k in keys:
        if k not in data:
            return jsonify({"error": f"Missing required field: {k}"}), 400
    return None


def _update_and_reanalyze(sid, dk, new_df, entry):
    sm.set_working_df(sid, dk, new_df)
    sm.add_history(sid, dk, entry)
    fresh_analysis = run_full_analysis(new_df)
    sm.set_analysis(sid, dk, fresh_analysis)
    return sm.get_analysis(sid, dk)


@bp.route("/edit-cell", methods=["POST"])
def edit_cell():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "row_index", "column", "new_value")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.edit_cell(df, int(data["row_index"]), data["column"], data["new_value"])
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/delete-rows", methods=["POST"])
def delete_rows():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "row_indices")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        indices = [int(i) for i in data["row_indices"]]
        new_df, entry = ce.delete_rows(df, indices)
        sm.adjust_resolved_indices(sid, dk, indices)
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "new_row_count": len(new_df), "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/delete-columns", methods=["POST"])
def delete_columns():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "columns")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.delete_columns(df, data["columns"])
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "remaining_columns": list(new_df.columns), "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/rename-column", methods=["POST"])
def rename_column():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "old_name", "new_name")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.rename_column(df, data["old_name"], data["new_name"])
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/preview-fill-missing", methods=["POST"])
def preview_fill_missing():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "column", "method")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    column, method = data["column"], data["method"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    if column not in df.columns: return jsonify({"error": f"Column '{column}' not found."}), 404

    mask = get_missing_mask(df[column])
    missing_indices = [int(i) for i in df[mask].index.tolist()]
    if not missing_indices:
        return jsonify({"error": f"No missing values found in column '{column}'."}), 400

    is_num = can_be_numeric(df[column])

    if method in ("mean", "median", "mean_excl_outliers", "median_excl_outliers"):
        if not is_num:
            return jsonify({"error": f"Method '{method}' is only applicable to numerical columns."}), 400
        num_series = clean_numeric_series(df[column])
        fill_val, desc = compute_imputation_value(num_series, method)
    elif method == "mode":
        if is_num:
            return jsonify({"error": f"Method 'mode' is only applicable to categorical/text columns. Column '{column}' is numeric."}), 400
        fill_val, desc = compute_imputation_value(df[column], "mode")
    elif method == "manual":
        manual_val = data.get("manual_value")
        if manual_val is None or str(manual_val).strip() == "":
            return jsonify({"error": "Manual value cannot be empty."}), 400
        if is_num:
            try:
                v_str = str(manual_val).strip().replace("$", "").replace(",", "")
                fill_val = float(v_str) if "." in v_str else int(v_str)
            except ValueError:
                return jsonify({"error": f"Invalid manual numeric value '{manual_val}'."}), 400
            desc = f"Manual numeric value: {fill_val}"
        else:
            fill_val = str(manual_val)
            desc = f"Manual text value: '{fill_val}'"
    elif method == "delete_row":
        fill_val = "DELETE ROW"
        desc = "Delete affected rows"
    elif method == "leave_unchanged":
        fill_val = "LEAVE UNCHANGED"
        desc = "No changes applied"
    else:
        return jsonify({"error": f"Unknown imputation method '{method}'."}), 400

    sample_affected = [
        {"row": r, "original": "Missing", "new": str(fill_val)}
        for r in missing_indices[:15]
    ]

    return jsonify({
        "column": column,
        "dtype": "Numerical (float64)" if is_num else str(df[column].dtype),
        "missing_count": len(missing_indices),
        "total_rows": len(df),
        "missing_pct": round(len(missing_indices) / len(df) * 100, 2),
        "method": method,
        "description": desc,
        "replacement_value": fill_val,
        "affected_rows_count": len(missing_indices),
        "sample_affected": sample_affected,
    })


@bp.route("/fill-missing", methods=["POST"])
def fill_missing():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "column", "method")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.fill_missing(df, data["column"], data["method"],
                                         manual_value=data.get("manual_value"))
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/remove-duplicates", methods=["POST"])
def remove_duplicates():
    data = request.json or {}
    err = _require(data, "session_id", "dataset")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.remove_duplicates(df, keep=data.get("keep", "first"))
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "new_row_count": len(new_df), "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/repair-type", methods=["POST"])
def repair_type():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "column", "target_type")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.repair_type(df, data["column"], data["target_type"])
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/preview-type-conversion", methods=["POST"])
def preview_type():
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "column", "target_type")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    result = preview_type_conversion(df, data["column"], data["target_type"])
    return jsonify(result)


@bp.route("/reset", methods=["POST"])
def reset_working():
    data = request.json or {}
    err = _require(data, "session_id", "dataset")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    sm.reset_working(sid, dk)
    orig = sm.get_original_df(sid, dk)
    if orig is not None:
        fresh_analysis = run_full_analysis(orig)
        sm.set_analysis(sid, dk, fresh_analysis)
    return jsonify({"success": True, "message": "Working dataset reset to original."})


@bp.route("/finalize", methods=["POST"])
def finalize():
    data = request.json or {}
    err = _require(data, "session_id", "dataset")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    sm.finalize_dataset(sid, dk)
    fresh_analysis = run_full_analysis(df)
    sm.set_analysis(sid, dk, fresh_analysis)
    return jsonify({"success": True, "message": "Dataset finalized.", "rows": len(df), "cols": len(df.columns)})


@bp.route("/resolve-outlier", methods=["POST"])
def resolve_outlier():
    data = request.json or {}
    sid = data.get("session_id")
    dk = data.get("dataset", "single")
    col_name = data.get("column")
    resolution = data.get("resolution")

    if not sid or not col_name or not resolution:
        return jsonify({"error": "session_id, column, and resolution are required."}), 400

    row_indices = data.get("row_indices")
    if row_indices is None:
        raw_idx = data.get("row_index")
        if raw_idx is None:
            return jsonify({"error": "row_index or row_indices is required."}), 400
        row_indices = raw_idx if isinstance(raw_idx, list) else [raw_idx]

    try:
        row_indices = [int(i) for i in row_indices]
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid row index in list."}), 400

    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404

    try:
        new_df = df.copy()
        all_entries = []
        impute_method = data.get("impute_method")
        manual_value = data.get("manual_value")

        if resolution == "delete_row":
            deleted_rows = []
            for r in sorted(row_indices, reverse=True):
                if r in new_df.index:
                    orig_val = new_df.at[r, col_name]
                    all_entries.append({
                        "action": "DELETE_ROWS",
                        "method": "Outlier removal",
                        "description": f"Deleted row {r} due to outlier value '{orig_val}' in column '{col_name}'",
                        "column": col_name,
                        "row_index": [r],
                        "original_value": orig_val,
                    })
                    deleted_rows.append(r)
            if deleted_rows:
                new_df = new_df.drop(index=deleted_rows).reset_index(drop=True)
                sm.adjust_resolved_indices(sid, dk, sorted(deleted_rows))

        elif resolution in ("keep", "leave_unchanged"):
            for r in row_indices:
                if r in new_df.index:
                    orig_val = new_df.at[r, col_name]
                    all_entries.append({
                        "action": "LEAVE_UNCHANGED",
                        "method": "Outlier kept",
                        "description": f"Verified and kept outlier value '{orig_val}' unchanged in [{r}, '{col_name}']",
                        "column": col_name,
                        "row_index": r,
                        "original_value": orig_val,
                        "new_value": orig_val,
                    })
                    sm.add_resolved_outlier(sid, dk, col_name, r, orig_val)

        elif resolution == "correct":
            for r in row_indices:
                if r in new_df.index:
                    sub_df, entry = ce.edit_cell(new_df, r, col_name, manual_value)
                    new_df = sub_df
                    entry["description"] = f"Corrected outlier in [{r}, '{col_name}'] to '{manual_value}'"
                    all_entries.append(entry)
                    sm.add_resolved_outlier(sid, dk, col_name, r, entry.get("original_value"))

        elif resolution in ("replace", "impute"):
            from backend.utils.df_utils import clean_numeric_series, can_be_numeric
            from backend.analysis.missing_analyzer import compute_imputation_value
            method = impute_method or "median_excl_outliers"
            series = clean_numeric_series(new_df[col_name]).copy()
            for r in row_indices:
                if r in series.index:
                    series.at[r] = np.nan
            fill_val, desc = compute_imputation_value(series, method)
            if fill_val is None:
                raise ValueError(f"Could not compute imputation value: {desc}")
            new_df[col_name] = clean_numeric_series(new_df[col_name])

            for r in row_indices:
                if r in new_df.index:
                    orig_val = df.at[r, col_name] if r in df.index else None
                    new_df.at[r, col_name] = fill_val
                    all_entries.append({
                        "action": "FILL_MISSING",
                        "description": f"Replaced outlier in [{r}, '{col_name}'] with {fill_val} using {method}: {desc}",
                        "column": col_name,
                        "row_index": r,
                        "original_value": str(orig_val),
                        "new_value": str(fill_val),
                        "method": method,
                    })
                    sm.add_resolved_outlier(sid, dk, col_name, r, orig_val)
        else:
            return jsonify({"error": f"Unknown resolution '{resolution}'."}), 400

        if all_entries:
            sm.set_working_df(sid, dk, new_df)
            for entry in all_entries:
                sm.add_history(sid, dk, entry)
            fresh_analysis = run_full_analysis(new_df)
            sm.set_analysis(sid, dk, fresh_analysis)

        filtered_analysis = sm.get_analysis(sid, dk)
        return jsonify({"success": True, "entries": all_entries, "analysis": filtered_analysis})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 400

@bp.route("/history", methods=["GET"])
def get_history():
    sid = request.args.get("session_id")
    dk = request.args.get("dataset", "single")
    if not sid: return jsonify({"error": "session_id required."}), 400
    history = sm.get_history(sid, dk)
    return jsonify({"history": history, "count": len(history)})


@bp.route("/delete-missing-rows", methods=["POST"])
def delete_missing_rows():
    """Delete all rows that contain at least one missing value."""
    data = request.json or {}
    err = _require(data, "session_id", "dataset")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        from backend.utils.df_utils import get_missing_mask
        # Find any row with at least one missing value
        any_missing = get_missing_mask(df).any(axis=1)
        missing_indices = [int(i) for i in df[any_missing].index.tolist()]
        if not missing_indices:
            return jsonify({"error": "No rows with missing values found."}), 400
        new_df, entry = ce.delete_rows(df, missing_indices)
        sm.adjust_resolved_indices(sid, dk, missing_indices)
        entry["action"] = "DELETE_MISSING_ROWS"
        entry["description"] = f"Deleted {len(missing_indices)} row(s) that had at least one missing value."
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "deleted_count": len(missing_indices), "new_row_count": len(new_df), "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/delete-column-missing-rows", methods=["POST"])
def delete_column_missing_rows():
    """Delete every row where the specified column has a missing value."""
    data = request.json or {}
    err = _require(data, "session_id", "dataset", "column")
    if err: return err
    sid, dk = data["session_id"], data["dataset"]
    column = data["column"]
    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404
    try:
        new_df, entry = ce.delete_column_missing_rows(df, column)
        sm.adjust_resolved_indices(sid, dk, entry.get("affected_rows", []))
        analysis = _update_and_reanalyze(sid, dk, new_df, entry)
        return jsonify({"success": True, "entry": entry, "deleted_count": entry.get("count", 0), "new_row_count": len(new_df), "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/resolve-suspicious", methods=["POST"])
def resolve_suspicious():
    data = request.json or {}
    sid = data.get("session_id")
    dk = data.get("dataset", "single")
    col_name = data.get("column")
    resolution = data.get("resolution")

    if not sid or not col_name or not resolution:
        return jsonify({"error": "session_id, column, and resolution are required."}), 400

    row_indices = data.get("row_indices")
    if row_indices is None:
        raw_idx = data.get("row_index")
        if raw_idx is None:
            return jsonify({"error": "row_index or row_indices is required."}), 400
        row_indices = raw_idx if isinstance(raw_idx, list) else [raw_idx]

    try:
        row_indices = [int(i) for i in row_indices]
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid row index in list."}), 400

    df = sm.get_working_df(sid, dk)
    if df is None: return jsonify({"error": "Dataset not found."}), 404

    try:
        new_df = df.copy()
        all_entries = []
        impute_method = data.get("impute_method")
        manual_value = data.get("manual_value")

        if resolution == "delete_row":
            deleted_rows = []
            for r in sorted(row_indices, reverse=True):
                if r in new_df.index:
                    orig_val = new_df.at[r, col_name]
                    all_entries.append({
                        "action": "DELETE_ROWS",
                        "method": "Suspicious value removal",
                        "description": f"Deleted row {r} due to suspicious value '{orig_val}' in column '{col_name}'",
                        "column": col_name,
                        "row_index": [r],
                        "original_value": orig_val,
                    })
                    deleted_rows.append(r)
            if deleted_rows:
                new_df = new_df.drop(index=deleted_rows).reset_index(drop=True)
                sm.adjust_resolved_indices(sid, dk, sorted(deleted_rows))
            for r in row_indices:
                sm.add_resolved_suspicious(sid, dk, col_name, r, None)

        elif resolution in ("keep", "leave_unchanged"):
            for r in row_indices:
                if r in new_df.index:
                    orig_val = new_df.at[r, col_name]
                    all_entries.append({
                        "action": "LEAVE_UNCHANGED",
                        "method": "User decision: Keep",
                        "description": f"Verified and kept suspicious value '{orig_val}' in [{r}, '{col_name}']",
                        "column": col_name,
                        "row_index": r,
                        "original_value": orig_val,
                        "new_value": orig_val,
                    })
                    sm.add_resolved_suspicious(sid, dk, col_name, r, orig_val)

        elif resolution in ("correct", "manual"):
            for r in row_indices:
                if r in new_df.index:
                    sub_df, entry = ce.edit_cell(new_df, r, col_name, manual_value)
                    new_df = sub_df
                    entry["action"] = "CORRECT_VALUE"
                    entry["description"] = f"Corrected suspicious value in [{r}, '{col_name}']: '{entry.get('original_value')}' → '{manual_value}'"
                    all_entries.append(entry)
                    sm.add_resolved_suspicious(sid, dk, col_name, r, entry.get("original_value"))

        elif resolution in ("replace", "impute"):
            from backend.utils.df_utils import clean_numeric_series, can_be_numeric
            from backend.analysis.missing_analyzer import compute_imputation_value
            is_num = can_be_numeric(new_df[col_name])
            method = impute_method or ("median_excl_outliers" if is_num else "mode")
            if is_num:
                series = clean_numeric_series(new_df[col_name]).copy()
                for r in row_indices:
                    if r in series.index:
                        series.at[r] = np.nan
                fill_val, desc = compute_imputation_value(series, method)
                if fill_val is None:
                    raise ValueError(f"Could not compute imputation value: {desc}")
                new_df[col_name] = clean_numeric_series(new_df[col_name])
            else:
                series = new_df[col_name].copy()
                for r in row_indices:
                    if r in series.index:
                        series.at[r] = np.nan
                fill_val, desc = compute_imputation_value(series, "mode")
                if fill_val is None:
                    raise ValueError(f"Could not compute mode: {desc}")

            for r in row_indices:
                if r in new_df.index:
                    orig_val = df.at[r, col_name] if r in df.index else None
                    new_df.at[r, col_name] = fill_val
                    all_entries.append({
                        "action": "REPLACE_SUSPICIOUS",
                        "description": f"Replaced suspicious value '{orig_val}' in [{r}, '{col_name}'] using {method}: {fill_val}",
                        "column": col_name,
                        "row_index": r,
                        "original_value": orig_val,
                        "new_value": str(fill_val),
                        "method": method,
                    })
                    sm.add_resolved_suspicious(sid, dk, col_name, r, orig_val)
        else:
            return jsonify({"error": f"Unknown suspicious resolution '{resolution}'."}), 400

        if all_entries:
            sm.set_working_df(sid, dk, new_df)
            for entry in all_entries:
                sm.add_history(sid, dk, entry)
            fresh_analysis = run_full_analysis(new_df)
            sm.set_analysis(sid, dk, fresh_analysis)

        filtered_analysis = sm.get_analysis(sid, dk)
        return jsonify({"success": True, "entries": all_entries, "analysis": filtered_analysis})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 400

