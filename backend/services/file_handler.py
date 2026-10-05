"""Safe file reading for CSV and Excel uploads."""
import io
import pandas as pd
import numpy as np
import chardet
from backend.utils.df_utils import get_missing_mask, clean_numeric_series


def read_csv(file_bytes: bytes) -> pd.DataFrame:
    """Read CSV bytes, auto-detecting encoding."""
    detected = chardet.detect(file_bytes)
    encoding = detected.get("encoding") or "utf-8"

    errors = []
    for enc in [encoding, "utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, dtype=str, keep_default_na=False)
            df = _post_process(df)
            return df
        except Exception as e:
            errors.append(f"{enc}: {e}")

    raise ValueError(f"Could not parse CSV file. Tried encodings: {'; '.join(errors)}")


def read_excel_sheets(file_bytes: bytes) -> list[str]:
    """Return list of sheet names in an Excel file."""
    try:
        xf = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
        return xf.sheet_names
    except Exception as e:
        raise ValueError(f"Could not read Excel file: {e}")


def read_excel_sheet(file_bytes: bytes, sheet_name: str) -> pd.DataFrame:
    """Read a specific sheet from an Excel file."""
    try:
        df = pd.read_excel(
            io.BytesIO(file_bytes),
            sheet_name=sheet_name,
            dtype=str,
            keep_default_na=False,
            engine="openpyxl",
        )
        df = _post_process(df)
        return df
    except Exception as e:
        raise ValueError(f"Could not read Excel sheet '{sheet_name}': {e}")


def _post_process(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize raw read DataFrame: fix duplicate column names and convert missing cells to pd.NA."""
    cols = list(df.columns)
    seen = {}
    new_cols = []
    for c in cols:
        c_str = str(c).strip()
        if c_str in seen:
            seen[c_str] += 1
            new_cols.append(f"{c_str}_{seen[c_str]}")
        else:
            seen[c_str] = 0
            new_cols.append(c_str)
    df.columns = new_cols

    # Convert all missing representations to pd.NA
    for col in df.columns:
        mask = get_missing_mask(df[col])
        if df[col].dtype == object:
            df[col] = df[col].str.strip()
        df.loc[mask, col] = pd.NA

    df = _infer_types(df)
    return df


def _infer_types(df: pd.DataFrame) -> pd.DataFrame:
    """Best-effort type inference on string-typed DataFrame, including currency stripping."""
    for col in df.columns:
        if df[col].dtype != object:
            continue
        mask = get_missing_mask(df[col])
        non_null = df[col][~mask]
        if len(non_null) == 0:
            continue
        # Try numeric (including stripping currency $ and commas)
        num = clean_numeric_series(non_null)
        if float(num.notna().mean()) > 0.8:
            df[col] = clean_numeric_series(df[col])
            continue
        # Try datetime
        try:
            parsed = pd.to_datetime(non_null, infer_datetime_format=True, errors="coerce")
            if float(parsed.notna().mean()) > 0.8:
                df[col] = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
                continue
        except Exception:
            pass
    return df
