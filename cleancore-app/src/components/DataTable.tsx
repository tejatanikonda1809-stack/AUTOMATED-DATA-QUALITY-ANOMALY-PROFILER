import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { Feather } from "@expo/vector-icons";

interface DataTableProps {
  datasetKey?: "single" | "ref" | "cur";
  onCellEdited?: () => void;
  which?: "working" | "original" | "finalized";
  canEdit?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  datasetKey,
  onCellEdited,
  which = "working",
  canEdit = true,
}) => {
  const { colors } = useTheme();
  const { activeDataset } = useApp();
  const targetDataset = datasetKey || activeDataset;

  const [records, setRecords] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Edit cell modal state
  const [editCellInfo, setEditCellInfo] = useState<{
    rowIndex: number;
    column: string;
    value: string;
  } | null>(null);
  const [editInputVal, setEditInputVal] = useState("");
  const [isSavingCell, setIsSavingCell] = useState(false);

  const loadData = async (
    targetPage = page,
    targetSearch = search,
    targetSortCol = sortCol,
    targetSortAsc = sortAsc
  ) => {
    setIsLoading(true);
    try {
      const res = await api.getDatasetPreview(targetDataset, {
        page: targetPage,
        pageSize,
        search: targetSearch,
        sortCol: targetSortCol,
        sortAsc: targetSortAsc,
        which,
      });

      if (res && res.records) {
        setRecords(res.records);
        setColumns(res.columns || []);
        setTotalRows(res.total || 0);
      }
    } catch (err) {
      console.error("Failed to load dataset preview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    loadData(0, search, sortCol, sortAsc);
  }, [targetDataset, which]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(0);
    loadData(0, text, sortCol, sortAsc);
  };

  const handleSort = (col: string) => {
    const newAsc = sortCol === col ? !sortAsc : true;
    setSortCol(col);
    setSortAsc(newAsc);
    loadData(page, search, col, newAsc);
  };

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setPage(newPage);
      loadData(newPage, search, sortCol, sortAsc);
    }
  };

  const openEditModal = (rowId: number, col: string, val: any) => {
    if (!canEdit || which !== "working") return;
    setEditCellInfo({
      rowIndex: rowId,
      column: col,
      value: val === null || val === undefined ? "" : String(val),
    });
    setEditInputVal(val === null || val === undefined ? "" : String(val));
  };

  const saveCellEdit = async () => {
    if (!editCellInfo) return;
    setIsSavingCell(true);
    try {
      await api.editCell(targetDataset, editCellInfo.rowIndex, editCellInfo.column, editInputVal);
      setEditCellInfo(null);
      await loadData();
      if (onCellEdited) onCellEdited();
    } catch (err: any) {
      alert("Error saving cell: " + (err.message || String(err)));
    } finally {
      setIsSavingCell(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Search & Controls */}
      <View style={styles.controlsRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search all records..."
            placeholderTextColor={colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Feather name="x" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pageInfo}>
          <Text style={[styles.pageInfoText, { color: colors.textMuted }]}>
            Showing {records.length} of {totalRows} records
          </Text>
        </View>
      </View>

      {/* Responsive Table Scroll Container */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.scrollHorizontal}>
        <View>
          {/* Header Row */}
          <View style={[styles.headerRow, { backgroundColor: colors.tableHeaderBg, borderBottomColor: colors.border }]}>
            <View style={[styles.cell, styles.indexCell]}>
              <Text style={[styles.headerText, { color: colors.textSecondary }]}>#</Text>
            </View>
            {columns.map((col) => {
              const isSorted = sortCol === col;
              return (
                <TouchableOpacity
                  key={col}
                  style={[styles.cell, styles.dataCell]}
                  onPress={() => handleSort(col)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.headerText, { color: isSorted ? colors.primary : colors.textSecondary }]}>
                    {col}
                  </Text>
                  {isSorted && (
                    <Feather
                      name={sortAsc ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Body Rows */}
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading records...</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No records found matching query.</Text>
            </View>
          ) : (
            records.map((row, rowIdx) => {
              const rowId = row._row_id !== undefined ? row._row_id : rowIdx;
              const isAlt = rowIdx % 2 === 1;
              return (
                <View
                  key={rowId}
                  style={[
                    styles.row,
                    {
                      backgroundColor: isAlt ? colors.tableRowAlt : colors.bgCard,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.cell, styles.indexCell]}>
                    <Text style={[styles.indexText, { color: colors.textMuted }]}>{rowId}</Text>
                  </View>
                  {columns.map((col) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;
                    return (
                      <TouchableOpacity
                        key={col}
                        style={[
                          styles.cell,
                          styles.dataCell,
                          isNull && { backgroundColor: colors.dangerBg },
                        ]}
                        onPress={() => openEditModal(rowId, col, val)}
                        disabled={!canEdit || which !== "working"}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.cellText,
                            { color: isNull ? colors.danger : colors.text },
                            isNull && { fontStyle: "italic", fontWeight: "600" },
                          ]}
                          numberOfLines={1}
                        >
                          {isNull ? "null" : String(val)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Pagination Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.pageBtn,
            { borderColor: colors.border },
            page === 0 && { opacity: 0.4 },
          ]}
          onPress={() => handlePageChange(page - 1)}
          disabled={page === 0 || isLoading}
        >
          <Feather name="chevron-left" size={16} color={colors.text} />
          <Text style={[styles.pageBtnText, { color: colors.text }]}>Previous</Text>
        </TouchableOpacity>

        <Text style={[styles.pageIndicator, { color: colors.textSecondary }]}>
          Page {page + 1} of {totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.pageBtn,
            { borderColor: colors.border },
            page >= totalPages - 1 && { opacity: 0.4 },
          ]}
          onPress={() => handlePageChange(page + 1)}
          disabled={page >= totalPages - 1 || isLoading}
        >
          <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
          <Feather name="chevron-right" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* In-place Cell Edit Modal */}
      {editCellInfo && (
        <Modal transparent animationType="fade" visible={true} onRequestClose={() => setEditCellInfo(null)}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.modalBackdrop }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Edit Cell [Row {editCellInfo.rowIndex}, '{editCellInfo.column}']
                </Text>
                <TouchableOpacity onPress={() => setEditCellInfo(null)}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                Update the value for this cell. Type conversions are applied automatically if the column is numerical.
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editInputVal}
                onChangeText={setEditInputVal}
                autoFocus
                placeholder="Enter value (or leave empty for null)"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.btnCancel, { borderColor: colors.border }]}
                  onPress={() => setEditCellInfo(null)}
                >
                  <Text style={[styles.btnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnSave, { backgroundColor: colors.primary }]}
                  onPress={saveCellEdit}
                  disabled={isSavingCell}
                >
                  {isSavingCell ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnSaveText}>Save Value</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 12,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    gap: 12,
    flexWrap: "wrap",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 36,
    flex: 1,
    minWidth: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  pageInfo: {
    justifyContent: "center",
  },
  pageInfoText: {
    fontSize: 12,
  },
  scrollHorizontal: {
    minHeight: 200,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  indexCell: {
    width: 60,
    alignItems: "center",
  },
  dataCell: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  indexText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  cellText: {
    fontSize: 12,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  modalInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  btnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnCancelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  btnSave: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
    alignItems: "center",
  },
  btnSaveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});

