"""Analysis routes."""
from flask import Blueprint, request, jsonify
from backend.services import session_manager as sm
from backend.analysis import run_full_analysis
from backend.utils.df_utils import df_to_records

bp = Blueprint("analysis", __name__, url_prefix="/api")


def _require_working_df(sid, dataset_key):
    df = sm.get_working_df(sid, dataset_key)
    if df is None:
        return None, jsonify({"error": "No dataset loaded. Please upload a dataset first."}), 404
    return df, None, None


@bp.route("/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    sid = data.get("session_id")
    dataset_key = data.get("dataset", "single")
    if not sid:
        return jsonify({"error": "session_id required."}), 400

    df = sm.get_working_df(sid, dataset_key)
    if df is None:
        return jsonify({"error": "No dataset found. Please upload first."}), 404

    try:
        result = run_full_analysis(df)
        sm.set_analysis(sid, dataset_key, result)
        if sm.get_original_analysis(sid, dataset_key) is None:
            sm.set_original_analysis(sid, dataset_key, result)
        filtered = sm.get_analysis(sid, dataset_key)
        return jsonify({"analysis": filtered if filtered is not None else result})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@bp.route("/analysis/result", methods=["GET"])
def get_analysis():
    sid = request.args.get("session_id")
    dataset_key = request.args.get("dataset", "single")
    if not sid:
        return jsonify({"error": "session_id required."}), 400
    try:
        result = sm.get_analysis(sid, dataset_key)
        if result is None:
            df = sm.get_working_df(sid, dataset_key)
            if df is not None:
                raw_analysis = run_full_analysis(df)
                sm.set_analysis(sid, dataset_key, raw_analysis)
                result = sm.get_analysis(sid, dataset_key)
            else:
                return jsonify({"error": "No dataset loaded. Please upload a dataset first."}), 404
        return jsonify({"analysis": result})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Failed to compute analysis: {str(e)}"}), 500


@bp.route("/dataset/preview", methods=["GET"])
def dataset_preview():
    sid = request.args.get("session_id")
    dataset_key = request.args.get("dataset", "single")
    page = int(request.args.get("page", 0))
    page_size = int(request.args.get("page_size", 50))
    search = request.args.get("search", "").strip()
    sort_col = request.args.get("sort_col", "")
    sort_asc = request.args.get("sort_asc", "true").lower() == "true"
    which = request.args.get("which", "working")  # working | original | finalized

    if not sid:
        return jsonify({"error": "session_id required."}), 400

    try:
        if which == "original":
            df = sm.get_original_df(sid, dataset_key)
        elif which == "finalized":
            df = sm.get_finalized_df(sid, dataset_key)
        else:
            df = sm.get_working_df(sid, dataset_key)

        if df is None:
            return jsonify({"error": "Dataset not found."}), 404

        # Filter
        if search:
            mask = df.apply(lambda col: col.astype(str).str.contains(search, case=False, na=False)).any(axis=1)
            df = df[mask]

        # Sort
        if sort_col and sort_col in df.columns:
            df = df.sort_values(sort_col, ascending=sort_asc)

        return jsonify(df_to_records(df, max_rows=page_size, page=page))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": f"Failed to fetch dataset preview: {str(e)}"}), 500


@bp.route("/dataset/affected-rows", methods=["POST"])
def affected_rows():
    data = request.json or {}
    sid = data.get("session_id")
    dataset_key = data.get("dataset", "single")
    indices = data.get("indices", [])

    if not sid:
        return jsonify({"error": "session_id required."}), 400
    df = sm.get_working_df(sid, dataset_key)
    if df is None:
        df = sm.get_finalized_df(sid, dataset_key)
    if df is None:
        df = sm.get_original_df(sid, dataset_key)
    if df is None:
        return jsonify({"error": "Dataset not found."}), 404

    try:
        int_indices = []
        for i in indices:
            try:
                int_indices.append(int(i))
            except (ValueError, TypeError):
                pass

        # Try exact label match first
        existing = [i for i in indices if i in df.index]
        if not existing and int_indices:
            existing = [i for i in int_indices if i in df.index]

        if existing:
            subset = df.loc[existing]
        elif int_indices:
            # Fallback to positional indices
            valid_pos = [i for i in int_indices if 0 <= i < len(df)]
            subset = df.iloc[valid_pos] if valid_pos else df.iloc[0:0]
        else:
            subset = df.iloc[0:0]

        return jsonify(df_to_records(subset, max_rows=max(len(subset) + 1, 10)))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/dataset/state", methods=["GET"])
def dataset_state():
    sid = request.args.get("session_id")
    dataset_key = request.args.get("dataset", "single")
    if not sid:
        return jsonify({"error": "session_id required."}), 400
    sess = sm.get_session(sid)
    if not sess:
        return jsonify({"error": "Session not found."}), 404
    ds = sess.get(dataset_key, {})
    
    # Calculate current info from working_df if available
    current_info = {}
    if ds.get("working_df") is not None:
        df = ds["working_df"]
        source_info = ds.get("source_info", {})
        current_info = {
            "rows": len(df),
            "cols": len(df.columns),
            "filename": source_info.get("filename", "Dataset"),
            "type": source_info.get("type", "csv"),
            "sheet": source_info.get("sheet")
        }
        
    return jsonify({
        "state": ds.get("state", "empty"),
        "source_info": ds.get("source_info", {}),
        "current_info": current_info,
        "has_analysis": ds.get("analysis") is not None,
        "change_count": len(ds.get("change_history", [])),
        "mode": sess.get("mode"),
    })
