import pandas as pd
from backend.cleaning import cleaning_engine as ce


def test_edit_cell():
    df = pd.DataFrame({"A": [1, 2, 3]})
    new_df, entry = ce.edit_cell(df, 0, "A", 99)
    assert new_df.at[0, "A"] == 99
    assert df.at[0, "A"] == 1  # Original immutable


def test_delete_rows():
    df = pd.DataFrame({"A": [10, 20, 30, 40]})
    new_df, entry = ce.delete_rows(df, [1, 3])
    assert len(new_df) == 2
    assert list(new_df["A"]) == [10, 30]


def test_delete_columns():
    df = pd.DataFrame({"A": [1], "B": [2], "C": [3]})
    new_df, entry = ce.delete_columns(df, ["B"])
    assert "B" not in new_df.columns
    assert list(new_df.columns) == ["A", "C"]


def test_rename_column():
    df = pd.DataFrame({"OldName": [1, 2]})
    new_df, entry = ce.rename_column(df, "OldName", "NewName")
    assert "NewName" in new_df.columns
    assert "OldName" not in new_df.columns


def test_fill_missing_mean():
    df = pd.DataFrame({"A": [10.0, 20.0, None]})
    new_df, entry = ce.fill_missing(df, "A", "mean")
    assert new_df.at[2, "A"] == 15.0


def test_fill_missing_mean_excl_outliers():
    # Mean of 10, 12, 14 is 12. 1000 is outlier.
    df = pd.DataFrame({"A": [10.0, 12.0, 14.0, 1000.0, None]})
    new_df, entry = ce.fill_missing(df, "A", "mean_excl_outliers")
    assert new_df.at[4, "A"] == 12.0


def test_remove_duplicates():
    df = pd.DataFrame({"A": [1, 1, 2], "B": ["x", "x", "y"]})
    new_df, entry = ce.remove_duplicates(df)
    assert len(new_df) == 2
