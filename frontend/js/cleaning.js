/* cleaning.js — Cleaning Studio and Change History */
import * as api from "./api.js";
import { navigate, showAlert, showModal, closeModal, escHtml, renderNoDatasetState, updateTopbar } from "./app.js";

let currentPage = 0;
let currentSearch = "";
let currentSortCol = "";
let currentSortAsc = true;
let selectedRows = new Set();
let selectedCols = new Set();

function resetCleaningState() {
  currentPage = 0;
  currentSearch = "";
  currentSortCol = "";
  currentSortAsc = true;
  selectedRows = new Set();
  selectedCols = new Set();
}

export async function renderCleaning(container, dataset, opts = {}) {
  resetCleaningState();

  // Single Source of Truth check
  let st;
  try {
    st = await api.getDatasetState(dataset);
    if (!st || st.state === "empty") {
      renderNoDatasetState(container, "Cleaning Studio", dataset);
      return;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state" style="padding:3rem 1.5rem">
          <div style="font-size:2.5rem; margin-bottom:0.75rem">⚠️</div>
          <div class="empty-title" style="color:var(--danger)">Failed to initialize Cleaning Studio</div>
          <div class="empty-sub" style="margin-bottom:1.25rem; color:var(--ink-faint)">${escHtml(err.message)}</div>
          <button class="btn btn-primary" id="btn-retry-cleaning-init">🔄 Retry</button>
        </div>
      </div>
    `;
    const btn = container.querySelector("#btn-retry-cleaning-init");
    if (btn) btn.onclick = () => renderCleaning(container, dataset, opts);
    return;
  }

  container.innerHTML = `
    <div id="clean-alerts"></div>

    <div class="card">
      <div class="card-title" style="justify-content:space-between">
        <span>🧹 Cleaning Studio — ${escHtml(dataset.toUpperCase())} Dataset</span>
        <button class="btn btn-ghost btn-sm" id="act-goto-history">📋 View Change History →</button>
      </div>
      <p style="color:var(--ink-faint); font-size:0.8125rem; margin-bottom:1.25rem">
        Perform interactive, user-controlled cleaning actions. All actions operate on a working copy; the original dataset remains immutable.
      </p>

      <!-- Missing Values Overview Panel (Issue 10) -->
      <div id="missing-overview-container"></div>

      <!-- Action Toolbar (Issue 10: Grouped Layout) -->
      <div class="toolbar-grouped">
        <!-- Row / Column Actions -->
        <div class="toolbar-group">
          <div class="toolbar-group-label">Row / Column</div>
          <div class="toolbar-group-items">
            <button class="btn btn-secondary btn-sm" id="act-edit-cell">✏️ Edit Cell</button>
            <button class="btn btn-danger btn-sm" id="act-del-rows">🗑️ Delete Selected Row(s)</button>
            <button class="btn btn-danger btn-sm" id="act-del-cols">🗑️ Delete Selected Column(s)</button>
            <button class="btn btn-secondary btn-sm" id="act-rename-col">🏷️ Rename Column</button>
          </div>
        </div>

        <!-- Missing & Duplicate Data -->
        <div class="toolbar-group">
          <div class="toolbar-group-label">Missing &amp; Dups</div>
          <div class="toolbar-group-items">
            <button class="btn btn-primary btn-sm" id="act-fill-missing">💉 Fill Missing Values</button>
            <button class="btn btn-danger btn-sm" id="act-del-col-missing-rows">🗑️ Delete Rows by Column</button>
            <button class="btn btn-danger btn-sm" id="act-del-missing-rows">🗑️ Delete All Rows with Missing</button>
            <button class="btn btn-secondary btn-sm" id="act-rem-dups">👯 Remove Exact Duplicates</button>
          </div>
        </div>

        <!-- Type & Reset -->
        <div class="toolbar-group">
          <div class="toolbar-group-label">Types &amp; Reset</div>
          <div class="toolbar-group-items">
            <button class="btn btn-secondary btn-sm" id="act-repair-type">🔧 Repair Data Type</button>
            <button class="btn btn-secondary btn-sm" id="act-resolve-outlier">🎯 Resolve Outlier</button>
            <button class="btn btn-secondary btn-sm" id="act-resolve-suspicious">⚠️ Resolve Suspicious Values</button>
            <button class="btn btn-ghost btn-sm btn-ghost-danger" id="act-reset" style="margin-left:auto">🔄 Reset to Original</button>
          </div>
        </div>
      </div>

      <!-- Data Table Search/Toolbar -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem">
        <div style="display:flex; align-items:center; gap:0.5rem">
          <input type="text" class="form-input" id="clean-search" placeholder="Search rows..." value="${escHtml(currentSearch)}" style="width:220px; padding:0.4rem 0.75rem">
          <button class="btn btn-secondary btn-sm" id="btn-search">Search</button>
          ${currentSearch ? `<button class="btn btn-ghost btn-sm" id="btn-clear-search">Clear</button>` : ''}
        </div>
        <span style="font-size:0.75rem; font-weight:600; color:var(--ink-faint)" id="selection-count">0 row(s), 0 col(s) selected</span>
      </div>

      <!-- Table Container -->
      <div id="cleaning-table-container" style="position:relative; min-height:200px">
        <div class="loading-overlay" style="min-height:180px">
          <div class="spinner spinner-lg"></div>
          <div class="loading-text">Loading dataset rows...</div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" id="cleaning-pagination"></div>
    </div>
  `;

  const btnGotoHistory = container.querySelector("#act-goto-history");
  if (btnGotoHistory) {
    btnGotoHistory.onclick = () => navigate("history", { dataset });
  }

  wireCleaningActions(container, dataset);

  try {
    await Promise.all([
      loadMissingOverview(container, dataset),
      loadCleaningTable(container, dataset),
    ]);
  } catch (err) {
    console.error("Error loading Cleaning Studio data:", err);
  }

  // Open target modal if navigated with hint/column
  if (opts && opts.hint) {
    if (opts.hint === "resolve_suspicious" || opts.hint === "suspicious") {
      showSuspiciousModal(dataset, container, opts.column);
    } else if (opts.hint === "resolve_outlier" || opts.hint === "outliers" || opts.hint === "inspect_outliers") {
      showOutlierModal(dataset, container, opts.column);
    } else if (opts.hint === "fill_missing" || opts.hint === "missing" || (opts.column && opts.hint !== "duplicates")) {
      showFillMissingModal(dataset, opts.column, container);
    } else if (opts.hint === "delete_column_missing") {
      showDeleteColumnMissingModal(dataset, container, opts.column);
    } else if (opts.hint === "duplicates") {
      const btnDups = container.querySelector("#act-rem-dups");
      if (btnDups) btnDups.click();
    }
  } else if (opts && opts.column) {
    showFillMissingModal(dataset, opts.column, container);
  }
}

async function loadMissingOverview(container, dataset) {
  const panel = container.querySelector("#missing-overview-container");
  if (!panel) return;

  panel.innerHTML = `
    <div style="padding:0.75rem 1rem; background:var(--surface-2); border:1px solid var(--line); border-radius:10px; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.75rem">
      <div class="spinner" style="width:16px; height:16px; border-width:2px"></div>
      <span style="font-size:0.8125rem; color:var(--ink-faint)">Loading missing values overview...</span>
    </div>
  `;

  try {
    const res = await api.getAnalysis(dataset);
    const missing = (res && res.analysis && res.analysis.missing) || {};
    const affectedCols = missing.affected_columns || [];

    if (!affectedCols.length) {
      panel.innerHTML = `
        <div style="padding:0.75rem 1rem; background:var(--success-bg); border:1px solid var(--success-border); border-radius:10px; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between">
          <span style="color:var(--success); font-size:0.8125rem; font-weight:600">✓ No missing values detected in working dataset.</span>
          <span class="badge badge-success">0 Missing</span>
        </div>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="missing-overview-panel">
        <div class="missing-overview-header">
          <div class="missing-overview-title">
            <span>⚠️ Missing Values Overview</span>
            <span style="font-size:0.75rem; font-weight:600; color:var(--warning)">(${missing.total_missing ?? 0} cells, ${missing.missing_pct_overall ?? 0}% overall)</span>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-quick-del-missing-rows">
            Delete All Missing Rows
          </button>
        </div>
        <div class="missing-pill-list">
          ${affectedCols.map(col => `
            <div class="missing-pill" data-col="${escHtml(col.column)}">
              <strong>${escHtml(col.column)}</strong>
              <span class="badge badge-warning" style="font-size:0.65rem">${col.missing_count ?? col.count} missing (${col.missing_pct ?? col.pct}%)</span>
              <span style="color:var(--accent); font-size:0.7rem">Fill →</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    panel.querySelectorAll(".missing-pill").forEach(p => {
      p.onclick = () => showFillMissingModal(dataset, p.dataset.col, container);
    });

    const btnQuickDel = panel.querySelector("#btn-quick-del-missing-rows");
    if (btnQuickDel) {
      btnQuickDel.onclick = () => triggerDeleteMissingRows(dataset, container);
    }
  } catch (e) {
    panel.innerHTML = `
      <div style="padding:0.75rem 1rem; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:10px; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem">
        <span style="color:var(--danger); font-size:0.8125rem">⚠️ Failed to load missing values summary: ${escHtml(e.message)}</span>
        <button class="btn btn-secondary btn-sm" id="btn-retry-missing">🔄 Retry</button>
      </div>
    `;
    const btnRetry = panel.querySelector("#btn-retry-missing");
    if (btnRetry) {
      btnRetry.onclick = () => loadMissingOverview(container, dataset);
    }
  }
}

async function loadCleaningTable(container, dataset) {
  const tableWrap = container.querySelector("#cleaning-table-container");
  if (!tableWrap) return;

  // Show loading spinner within container
  tableWrap.innerHTML = `
    <div class="loading-overlay" style="min-height:180px">
      <div class="spinner spinner-lg"></div>
      <div class="loading-text">Loading dataset rows...</div>
    </div>
  `;

  try {
    const data = await api.getDatasetPreview(dataset, {
      page: currentPage,
      pageSize: 25,
      search: currentSearch,
      sortCol: currentSortCol,
      sortAsc: currentSortAsc,
    });
    renderTable(tableWrap, data, dataset, container);
    renderPagination(container.querySelector("#cleaning-pagination"), data, dataset, container);
  } catch (e) {
    tableWrap.innerHTML = `
      <div class="empty-state" style="padding:2.5rem 1rem">
        <div style="font-size:2rem; margin-bottom:0.5rem">⚠️</div>
        <div class="empty-title" style="color:var(--danger)">Failed to load dataset rows</div>
        <div class="empty-sub" style="margin-bottom:1rem; color:var(--ink-faint)">${escHtml(e.message)}</div>
        <button class="btn btn-secondary btn-sm" id="btn-retry-table">🔄 Retry Loading Data</button>
      </div>
    `;
    const pg = container.querySelector("#cleaning-pagination");
    if (pg) pg.innerHTML = "";
    const btnRetry = tableWrap.querySelector("#btn-retry-table");
    if (btnRetry) {
      btnRetry.onclick = () => loadCleaningTable(container, dataset);
    }
  }
}

function renderTable(wrap, data, dataset, container) {
  if (!data || !data.records || !data.records.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-title">No data rows found</div></div>`;
    return;
  }

  const cols = data.columns || [];
  const pageStart = (data.page || 0) * (data.page_size || 25);

  let html = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px"><input type="checkbox" id="chk-all-rows"></th>
            <th style="width:50px">#</th>
            ${cols.map(c => `
              <th data-col="${escHtml(c)}">
                <input type="checkbox" class="chk-col" data-col="${escHtml(c)}" ${selectedCols.has(c) ? 'checked' : ''}>
                <span class="col-name" style="cursor:pointer">${escHtml(c)}</span>
                <span class="th-sort">${currentSortCol === c ? (currentSortAsc ? '▲' : '▼') : '↕'}</span>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
  `;

  data.records.forEach((row, idx) => {
    const rowIdx = pageStart + idx;
    const isRowSelected = selectedRows.has(rowIdx);
    html += `
      <tr data-row="${rowIdx}" class="${isRowSelected ? 'selected' : ''}">
        <td><input type="checkbox" class="chk-row" data-row="${rowIdx}" ${isRowSelected ? 'checked' : ''}></td>
        <td style="color:#94a3b8; font-size:0.75rem">${rowIdx}</td>
        ${cols.map(c => {
          const val = row[c];
          const isNull = val === null || val === undefined;
          return `<td data-row="${rowIdx}" data-col="${escHtml(c)}" class="editable-cell ${isNull ? 'null-cell' : ''}" title="Double click to edit cell">${isNull ? 'null' : escHtml(val)}</td>`;
        }).join("")}
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  wrap.innerHTML = html;

  // Wire checkbox events
  wrap.querySelectorAll(".chk-row").forEach(chk => {
    chk.onchange = (e) => {
      const r = parseInt(chk.dataset.row);
      if (e.target.checked) selectedRows.add(r); else selectedRows.delete(r);
      chk.closest("tr").classList.toggle("selected", e.target.checked);
      updateSelectionCount(container);
    };
  });

  const chkAll = wrap.querySelector("#chk-all-rows");
  if (chkAll) {
    chkAll.onchange = (e) => {
      wrap.querySelectorAll(".chk-row").forEach(chk => {
        chk.checked = e.target.checked;
        const r = parseInt(chk.dataset.row);
        if (e.target.checked) selectedRows.add(r); else selectedRows.delete(r);
        chk.closest("tr").classList.toggle("selected", e.target.checked);
      });
      updateSelectionCount(container);
    };
  }

  wrap.querySelectorAll(".chk-col").forEach(chk => {
    chk.onchange = (e) => {
      const c = chk.dataset.col;
      if (e.target.checked) selectedCols.add(c); else selectedCols.delete(c);
      updateSelectionCount(container);
    };
  });

  // Double-click cell to edit
  wrap.querySelectorAll(".editable-cell").forEach(td => {
    td.ondblclick = () => {
      const rowIdx = parseInt(td.dataset.row);
      const col = td.dataset.col;
      const currentVal = td.classList.contains("null-cell") ? "" : td.textContent;
      showCellEditModal(dataset, rowIdx, col, currentVal, container);
    };
  });

  // Sort click
  wrap.querySelectorAll(".col-name").forEach(span => {
    span.onclick = async () => {
      const col = span.parentElement.dataset.col;
      if (currentSortCol === col) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortCol = col;
        currentSortAsc = true;
      }
      await loadCleaningTable(container, dataset);
    };
  });
}

function renderPagination(wrap, data, dataset, container) {
  if (!wrap || !data) return;
  const totalPages = data.total_pages || 1;
  wrap.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="pg-prev" ${currentPage === 0 ? 'disabled' : ''}>← Prev</button>
    <span class="page-info">Page <strong>${currentPage + 1}</strong> of ${totalPages} (${data.total || 0} rows)</span>
    <button class="btn btn-secondary btn-sm" id="pg-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
  `;
  wrap.querySelector("#pg-prev").onclick = async () => {
    if (currentPage > 0) { currentPage--; await loadCleaningTable(container, dataset); }
  };
  wrap.querySelector("#pg-next").onclick = async () => {
    if (currentPage < totalPages - 1) { currentPage++; await loadCleaningTable(container, dataset); }
  };
}

function updateSelectionCount(container) {
  const el = container.querySelector("#selection-count");
  if (el) el.textContent = `${selectedRows.size} row(s), ${selectedCols.size} col(s) selected`;
}

// ===== CLEANING ACTIONS WIRING =====
function wireCleaningActions(container, dataset) {
  const searchInput = container.querySelector("#clean-search");
  const searchBtn = container.querySelector("#btn-search");
  const clearBtn = container.querySelector("#btn-clear-search");

  const triggerSearch = async () => {
    currentSearch = searchInput.value.trim();
    currentPage = 0;
    await loadCleaningTable(container, dataset);
  };
  if (searchBtn) searchBtn.onclick = triggerSearch;
  if (searchInput) searchInput.onkeypress = (e) => { if (e.key === "Enter") triggerSearch(); };
  if (clearBtn) clearBtn.onclick = async () => {
    searchInput.value = "";
    currentSearch = "";
    currentPage = 0;
    await loadCleaningTable(container, dataset);
  };

  // Edit cell
  container.querySelector("#act-edit-cell").onclick = () => {
    showModal({
      title: "Edit Cell Value",
      body: `
        <div class="form-group"><label class="form-label">Row Index</label><input class="form-input" id="m-row" type="number" placeholder="0"></div>
        <div class="form-group"><label class="form-label">Column Name</label><input class="form-input" id="m-col" placeholder="Column name"></div>
        <div class="form-group"><label class="form-label">New Value</label><input class="form-input" id="m-val" placeholder="New value"></div>
      `,
      confirmText: "Save Edit",
      onConfirm: async () => {
        const r = parseInt(document.getElementById("m-row").value);
        const c = document.getElementById("m-col").value.trim();
        const v = document.getElementById("m-val").value;
        try {
          const res = await api.editCell(dataset, r, c, v);
          await updateTopbar(dataset);
          showAlert(`✓ Edited cell [${r}, '${c}']: '${res.entry?.original_value ?? '—'}' → '${v}'`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Delete selected rows
  container.querySelector("#act-del-rows").onclick = () => {
    const indices = Array.from(selectedRows);
    if (!indices.length) { showAlert("Please select at least one row using the checkboxes.", "warning"); return; }
    showModal({
      title: `Delete ${indices.length} Row(s)?`,
      body: `<p>Are you sure you want to delete row index(es): <strong>${indices.slice(0, 10).join(", ")}${indices.length > 10 ? '...' : ''}</strong>?</p><p style="color:#ef4444; font-size:0.75rem; margin-top:0.5rem">This operation affects the working copy only.</p>`,
      confirmText: "Delete Rows",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        try {
          await api.deleteRows(dataset, indices);
          selectedRows.clear();
          updateSelectionCount(container);
          await updateTopbar(dataset);
          showAlert(`✓ Deleted ${indices.length} row(s).`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Delete columns
  container.querySelector("#act-del-cols").onclick = () => {
    const cols = Array.from(selectedCols);
    if (!cols.length) { showAlert("Please select at least one column header checkbox.", "warning"); return; }
    showModal({
      title: `Delete Column(s)?`,
      body: `<p>Delete column(s): <strong>${cols.join(", ")}</strong>?</p>`,
      confirmText: "Delete Columns",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        try {
          await api.deleteColumns(dataset, cols);
          selectedCols.clear();
          updateSelectionCount(container);
          await updateTopbar(dataset);
          showAlert(`✓ Deleted column(s).`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Rename column
  container.querySelector("#act-rename-col").onclick = () => {
    showModal({
      title: "Rename Column",
      body: `
        <div class="form-group"><label class="form-label">Current Column Name</label><input class="form-input" id="m-old-col" placeholder="Old name"></div>
        <div class="form-group"><label class="form-label">New Column Name</label><input class="form-input" id="m-new-col" placeholder="New name"></div>
      `,
      confirmText: "Rename",
      onConfirm: async () => {
        const oldName = document.getElementById("m-old-col").value.trim();
        const newName = document.getElementById("m-new-col").value.trim();
        try {
          await api.renameColumn(dataset, oldName, newName);
          await updateTopbar(dataset);
          showAlert(`✓ Renamed '${oldName}' to '${newName}'`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Fill missing values button
  container.querySelector("#act-fill-missing").onclick = () => {
    showFillMissingModal(dataset, null, container);
  };

  // Delete rows by column (Issue 20)
  const btnDelColMissing = container.querySelector("#act-del-col-missing-rows");
  if (btnDelColMissing) {
    btnDelColMissing.onclick = () => showDeleteColumnMissingModal(dataset, container);
  }

  // Delete all rows with missing values
  container.querySelector("#act-del-missing-rows").onclick = () => {
    triggerDeleteMissingRows(dataset, container);
  };

  // Remove exact duplicates
  container.querySelector("#act-rem-dups").onclick = () => {
    showModal({
      title: "Remove Exact Duplicates",
      body: `<p>Identify and remove exact complete-row duplicate records. Only rows where <em>every</em> cell is identical will be removed.</p>`,
      confirmText: "Remove Duplicates",
      confirmClass: "btn-warning",
      onConfirm: async () => {
        try {
          const res = await api.removeDuplicates(dataset);
          await updateTopbar(dataset);
          showAlert(`✓ ${res.entry.description}`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Repair type
  container.querySelector("#act-repair-type").onclick = () => {
    showModal({
      title: "Repair Data Type",
      body: `
        <div class="form-group"><label class="form-label">Column Name</label><input class="form-input" id="m-type-col" placeholder="Column name"></div>
        <div class="form-group">
          <label class="form-label">Target Data Type</label>
          <select class="form-select" id="m-type-target">
            <option value="float64">Float (Decimal Number)</option>
            <option value="int64">Integer (Whole Number)</option>
            <option value="datetime64">Datetime / Date</option>
            <option value="str">String / Text</option>
          </select>
        </div>
      `,
      confirmText: "Convert Data Type",
      onConfirm: async () => {
        const col = document.getElementById("m-type-col").value.trim();
        const target = document.getElementById("m-type-target").value;
        try {
          await api.repairType(dataset, col, target);
          await updateTopbar(dataset);
          showAlert(`✓ Converted column '${col}' to ${target}`, "success");
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };

  // Resolve Outlier (Issue 19)
  container.querySelector("#act-resolve-outlier").onclick = () => {
    showOutlierModal(dataset, container);
  };

  // Resolve Suspicious Values (Issue 18)
  const btnResolveSuspicious = container.querySelector("#act-resolve-suspicious");
  if (btnResolveSuspicious) {
    btnResolveSuspicious.onclick = () => showSuspiciousModal(dataset, container);
  }

  // Reset
  container.querySelector("#act-reset").onclick = () => {
    showModal({
      title: "Reset Working Dataset to Original?",
      body: `<p style="color:var(--danger)">Warning: All un-finalized cleaning operations will be discarded and the working dataset will be restored to its original state.</p>`,
      confirmText: "Reset to Original",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        try {
          await api.resetWorking(dataset);
          selectedRows.clear();
          selectedCols.clear();
          await updateTopbar(dataset);
          showAlert("✓ Working dataset reset to original state.", "info");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) { showAlert(e.message, "error"); }
      }
    });
  };
}

// Bulk delete missing rows helper
function triggerDeleteMissingRows(dataset, container) {
  showModal({
    title: "Delete All Rows Containing Missing Values?",
    body: `
      <p>This will delete every row that contains at least one null/missing value in any column.</p>
      <div style="margin-top:0.75rem; padding:0.6rem; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:6px; font-size:0.75rem; color:var(--danger)">
        ⚠️ This action cannot be undone for the current working copy without resetting.
      </div>
    `,
    confirmText: "Delete Missing Rows",
    confirmClass: "btn-danger",
    onConfirm: async () => {
      try {
        const res = await api.deleteMissingRows(dataset);
        await updateTopbar(dataset);
        showAlert(`✓ ${res.entry.description} (New row count: ${res.new_row_count})`, "success");
        await loadMissingOverview(container, dataset);
        await loadCleaningTable(container, dataset);
      } catch (e) { showAlert(e.message, "error"); }
    }
  });
}

// Issue 20: Per-column bulk delete for missing values
async function showDeleteColumnMissingModal(dataset, container, defaultCol = null) {
  try {
    const analysisRes = await api.getAnalysis(dataset);
    const analysis = analysisRes.analysis || {};
    const affectedCols = (analysis.missing && analysis.missing.affected_columns) || [];
    const schemaCols = (analysis.schema && analysis.schema.columns) || [];

    // Columns that actually have missing values
    let missingCols = affectedCols.map(c => ({
      column: c.column,
      missing_count: c.missing_count ?? c.count ?? 0,
      missing_pct: c.missing_pct ?? c.pct ?? 0,
    }));

    if (!missingCols.length) {
      missingCols = schemaCols
        .filter(c => (c.missing_count ?? 0) > 0)
        .map(c => ({
          column: c.name,
          missing_count: c.missing_count,
          missing_pct: c.missing_pct ?? 0,
        }));
    }

    if (!missingCols.length) {
      showAlert("🎉 No columns currently contain missing values!", "info");
      return;
    }

    const selectedCol = defaultCol && missingCols.some(c => c.column === defaultCol)
      ? defaultCol
      : missingCols[0].column;

    showModal({
      title: "Delete Rows by Column (Scoped Missing Removal)",
      body: `
        <div class="form-group">
          <label class="form-label">Select Column</label>
          <select class="form-select" id="m-del-col-missing-select">
            ${missingCols.map(c => `
              <option value="${escHtml(c.column)}" ${c.column === selectedCol ? 'selected' : ''}>
                ${escHtml(c.column)} — ${c.missing_count} missing rows (${c.missing_pct}%)
              </option>
            `).join("")}
          </select>
          <div class="form-hint">
            Only rows where <strong>this specific column</strong> is missing will be deleted. Rows with missing values in other columns will remain untouched.
          </div>
        </div>
        <div style="margin-top:0.75rem; padding:0.6rem; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:6px; font-size:0.75rem; color:var(--danger)">
          ⚠️ Deleting rows reduces the total dataset record count. This action affects the working copy.
        </div>
      `,
      confirmText: "Delete Rows Missing in Selected Column",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        const col = document.getElementById("m-del-col-missing-select").value;
        try {
          const res = await api.deleteColumnMissingRows(dataset, col);
          await updateTopbar(dataset);
          showAlert(`✓ ${res.entry.description} (New row count: ${res.new_row_count})`, "success");
          await loadMissingOverview(container, dataset);
          await loadCleaningTable(container, dataset);
        } catch (e) {
          showAlert(e.message, "error");
        }
      }
    });
  } catch (e) {
    showAlert(e.message, "error");
  }
}

// Issue 19 & Item 6/7: Dynamic Outlier Resolution Modal with Multi-Row Selection & Real-Time Dropdown State Flow
async function showOutlierModal(dataset, container, defaultCol = null) {
  try {
    const [analysisRes, prevRes] = await Promise.all([
      api.getAnalysis(dataset),
      api.getDatasetPreview(dataset, { page: 0, pageSize: 1 })
    ]);
    let currentAnalysis = analysisRes.analysis || {};
    const schemaCols = (currentAnalysis.schema && currentAnalysis.schema.columns) || [];
    const dtypes = prevRes.dtypes || {};

    const getUnresolvedOutlierCols = (an) => {
      const details = (an.outliers && an.outliers.outlier_details) || [];
      return details.filter(c => (c.combined_count > 0 || (c.combined_indices && c.combined_indices.length > 0)));
    };

    let outlierCols = getUnresolvedOutlierCols(currentAnalysis);

    if (!outlierCols.length) {
      showAlert("🎉 No columns currently contain detected statistical outliers!", "info");
      return;
    }

    let selectedCol = defaultCol && outlierCols.some(c => c.column === defaultCol)
      ? defaultCol
      : outlierCols[0].column;

    showModal({
      title: "Resolve Outliers & Anomalies",
      autoClose: false,
      body: `
        <div id="m-out-body-wrap">
          <div class="form-group">
            <label class="form-label">Column with Outliers</label>
            <select class="form-select" id="m-out-col">
              ${outlierCols.map(c => `
                <option value="${escHtml(c.column)}" ${c.column === selectedCol ? 'selected' : ''}>
                  ${escHtml(c.column)} (${c.combined_count} outlier${c.combined_count > 1 ? 's' : ''})
                </option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem">
              <label class="form-label" style="margin-bottom:0">Select Affected Rows</label>
              <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:600; cursor:pointer; color:var(--primary); user-select:none">
                <input type="checkbox" id="m-out-select-all" style="cursor:pointer; accent-color:var(--primary)"> Select All (<span id="m-out-total-count">0</span>)
              </label>
            </div>
            <div id="m-out-rows-container" style="max-height:165px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:0.4rem; background:var(--surface-2); display:flex; flex-direction:column; gap:0.3rem"></div>
            <div class="form-hint" style="display:flex; justify-content:space-between; margin-top:0.35rem">
              <span>Select one or more rows to apply resolution in bulk.</span>
              <span id="m-out-selected-count" style="font-weight:600; color:var(--primary)">0 selected</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Resolution Action</label>
            <select class="form-select" id="m-out-res">
              <option value="replace" selected>Replace with Statistical Imputation</option>
              <option value="correct">Correct (Enter Verified Manual Value)</option>
              <option value="delete_row">Delete Entire Row(s) (Remove Record)</option>
              <option value="keep">Keep (Verified Valid Domain Value — Log Decision)</option>
            </select>
          </div>

          <div class="form-group hidden" id="m-out-manual-wrap">
            <label class="form-label">Verified Value</label>
            <input class="form-input" id="m-out-val" placeholder="Enter verified replacement value">
            <div class="form-hint">This value will be written to all selected rows.</div>
          </div>

          <div class="form-group" id="m-out-impute-wrap">
            <label class="form-label">Imputation Method</label>
            <select class="form-select" id="m-out-impute-method"></select>
            <div class="form-hint" id="m-out-method-hint">Replacement values exclude remaining outliers to prevent circular skew.</div>
          </div>
        </div>
      `,
      confirmText: "Apply Resolution",
      onConfirm: async () => {
        const colSel = document.getElementById("m-out-col");
        const resSel = document.getElementById("m-out-res");
        if (!colSel) return;

        const col = colSel.value;
        const res = resSel.value;
        const manualVal = document.getElementById("m-out-val") ? document.getElementById("m-out-val").value : null;
        const imputeMethod = document.getElementById("m-out-impute-method") ? document.getElementById("m-out-impute-method").value : null;

        const checkedBoxes = Array.from(document.querySelectorAll(".m-out-row-cb:checked"));
        const rowIndices = checkedBoxes.map(cb => parseInt(cb.value)).filter(n => !isNaN(n));

        if (!rowIndices.length) {
          showAlert("Please select at least one row to resolve.", "warning");
          return;
        }

        const confirmBtn = document.getElementById("modal-confirm");
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = "Applying...";
        }

        try {
          const r = await api.resolveOutlier(dataset, rowIndices, col, res, imputeMethod, manualVal);
          await updateTopbar(dataset);
          const desc = (r.entries && r.entries.length)
            ? `${r.entries.length} row(s) resolved for '${col}'`
            : "Outlier resolved.";
          showAlert(`✓ ${desc}`, "success");
          loadMissingOverview(container, dataset);
          loadCleaningTable(container, dataset);

          // Always re-fetch fresh state from server so dropdown filtering is 100% synchronized
          const freshRes = await api.getAnalysis(dataset);
          currentAnalysis = freshRes.analysis || r.analysis || {};
          outlierCols = getUnresolvedOutlierCols(currentAnalysis);

          if (!outlierCols.length) {
            // All outliers in the entire dataset have been resolved!
            const wrap = document.getElementById("m-out-body-wrap");
            if (wrap) {
              wrap.innerHTML = `
                <div style="text-align:center; padding:2rem 1rem">
                  <div style="font-size:3rem; margin-bottom:0.75rem">🎉</div>
                  <div style="font-weight:800; font-size:1.15rem; color:var(--ink); margin-bottom:0.5rem">All Outliers Resolved!</div>
                  <p style="color:var(--ink-faint); font-size:0.875rem; margin-bottom:1.5rem">No remaining unresolved outliers exist in this dataset.</p>
                </div>
              `;
            }
            const cancelBtn = document.getElementById("modal-cancel");
            if (cancelBtn) cancelBtn.style.display = "none";
            if (confirmBtn) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = "Done";
              confirmBtn.className = "btn btn-success";
              confirmBtn.onclick = () => closeModal();
            }
            return;
          }

          // If the currently selected column is now resolved, automatically switch to the next unresolved column
          if (!outlierCols.some(c => c.column === selectedCol)) {
            selectedCol = outlierCols[0].column;
          }

          // Rebuild column dropdown options from CURRENT unresolved state (removes resolved columns)
          colSel.innerHTML = outlierCols.map(c => `
            <option value="${escHtml(c.column)}" ${c.column === selectedCol ? 'selected' : ''}>
              ${escHtml(c.column)} (${c.combined_count} outlier${c.combined_count > 1 ? 's' : ''})
            </option>
          `).join("");

          updateRowsAndMethods();
          updateVisibility();
        } catch (e) {
          showAlert(e.message, "error");
        } finally {
          if (confirmBtn && outlierCols.length > 0) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Apply Resolution";
          }
        }
      }
    });

    const updateRowsAndMethods = () => {
      const colSel = document.getElementById("m-out-col");
      const rowsContainer = document.getElementById("m-out-rows-container");
      const selectAllCb = document.getElementById("m-out-select-all");
      const totalCountEl = document.getElementById("m-out-total-count");
      const selectedCountEl = document.getElementById("m-out-selected-count");
      const imputeMethodSel = document.getElementById("m-out-impute-method");
      if (!colSel || !rowsContainer) return;

      selectedCol = colSel.value;
      const colDetail = outlierCols.find(c => c.column === selectedCol) || {};
      const indices = colDetail.combined_indices || [];
      const outlierValues = colDetail.outlier_values || [];

      if (totalCountEl) totalCountEl.textContent = indices.length;

      if (!indices.length) {
        rowsContainer.innerHTML = `<div style="color:var(--ink-faint); font-size:0.8rem; padding:0.6rem; text-align:center">No unresolved outliers in this column</div>`;
        if (selectAllCb) { selectAllCb.checked = false; selectAllCb.disabled = true; }
        if (selectedCountEl) selectedCountEl.textContent = "0 selected";
      } else {
        if (selectAllCb) { selectAllCb.checked = false; selectAllCb.disabled = false; }
        rowsContainer.innerHTML = indices.map((idx, i) => {
          const ov = outlierValues.find(v => (v.row === idx || v.index === idx));
          const valStr = ov && ov.value !== undefined ? `Value: ${ov.value}` : "";
          return `
            <label style="display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.6rem; border-radius:4px; cursor:pointer; background:var(--surface); border:1px solid var(--border-soft); font-size:0.8rem; user-select:none; transition:background 0.15s">
              <span style="display:flex; align-items:center; gap:0.5rem">
                <input type="checkbox" class="m-out-row-cb" value="${idx}" ${i === 0 ? 'checked' : ''} style="cursor:pointer; accent-color:var(--primary)">
                <strong>Row ${idx}</strong>
              </span>
              <span style="color:var(--ink-faint); font-family:monospace; font-size:0.75rem">${escHtml(valStr)}</span>
            </label>
          `;
        }).join("");

        const updateSelectedCount = () => {
          const cbs = Array.from(rowsContainer.querySelectorAll(".m-out-row-cb"));
          const checked = cbs.filter(cb => cb.checked);
          if (selectedCountEl) selectedCountEl.textContent = `${checked.length} of ${cbs.length} selected`;
          if (selectAllCb) {
            selectAllCb.checked = checked.length === cbs.length && cbs.length > 0;
            selectAllCb.indeterminate = checked.length > 0 && checked.length < cbs.length;
          }
        };

        rowsContainer.querySelectorAll(".m-out-row-cb").forEach(cb => {
          cb.addEventListener("change", updateSelectedCount);
        });

        if (selectAllCb) {
          selectAllCb.onchange = () => {
            rowsContainer.querySelectorAll(".m-out-row-cb").forEach(cb => {
              cb.checked = selectAllCb.checked;
            });
            updateSelectedCount();
          };
        }

        updateSelectedCount();
      }

      const colSchema = schemaCols.find(c => c.name === selectedCol) || {};
      const dtype = dtypes[selectedCol] || colSchema.dtype || "";
      const isNum = Boolean(colSchema.is_numeric || dtype.includes("int") || dtype.includes("float") || dtype.includes("number"));

      if (imputeMethodSel) {
        if (isNum) {
          imputeMethodSel.innerHTML = `
            <option value="median_excl_outliers" selected>Median (Excl. Outliers) — Recommended</option>
            <option value="mean_excl_outliers">Mean (Excl. Outliers)</option>
            <option value="median">Median (All Values)</option>
            <option value="mean">Mean (All Values)</option>
          `;
        } else {
          imputeMethodSel.innerHTML = `
            <option value="mode" selected>Mode (Most Frequent)</option>
          `;
        }
      }
    };

    const updateVisibility = () => {
      const resSel = document.getElementById("m-out-res");
      const manualWrap = document.getElementById("m-out-manual-wrap");
      const imputeWrap = document.getElementById("m-out-impute-wrap");
      if (!resSel) return;
      const val = resSel.value;
      if (manualWrap) manualWrap.classList.toggle("hidden", val !== "correct");
      if (imputeWrap) imputeWrap.classList.toggle("hidden", val !== "replace");
    };

    setTimeout(() => {
      const colSel = document.getElementById("m-out-col");
      const resSel = document.getElementById("m-out-res");
      if (colSel) colSel.onchange = updateRowsAndMethods;
      if (resSel) resSel.onchange = updateVisibility;
      updateRowsAndMethods();
      updateVisibility();
    }, 100);

  } catch (e) {
    showAlert(e.message, "error");
  }
}

// Issue 18 & Item 6/7: Dedicated Suspicious Values Resolution Modal with Multi-Row Selection & Real-Time Dropdown State Flow
async function showSuspiciousModal(dataset, container, defaultCol = null) {
  try {
    const analysisRes = await api.getAnalysis(dataset);
    let currentAnalysis = analysisRes.analysis || {};

    const getUnresolvedSuspCols = (an) => {
      const issues = (an.suspicious && an.suspicious.suspicious_issues) || [];
      const colMap = new Map();
      issues.forEach(iss => {
        const col = iss.column;
        if (!col) return;
        if (!colMap.has(col)) {
          colMap.set(col, { column: col, count: 0, indices: [], issues: [] });
        }
        const entry = colMap.get(col);
        const curCount = iss.count || (iss.indices ? iss.indices.length : 1);
        entry.count += curCount;
        if (iss.indices) {
          iss.indices.forEach(idx => {
            if (!entry.indices.includes(idx)) entry.indices.push(idx);
          });
        }
        entry.issues.push(iss);
      });
      return Array.from(colMap.values()).filter(c => c.count > 0 && c.indices.length > 0);
    };

    let suspCols = getUnresolvedSuspCols(currentAnalysis);

    if (!suspCols.length) {
      showAlert("🎉 No columns currently contain suspicious or invalid values!", "info");
      return;
    }

    let selectedCol = defaultCol && suspCols.some(c => c.column === defaultCol)
      ? defaultCol
      : suspCols[0].column;

    showModal({
      title: "Resolve Suspicious & Invalid Values",
      autoClose: false,
      body: `
        <div id="m-susp-body-wrap">
          <div class="form-group">
            <label class="form-label">Column with Suspicious Values</label>
            <select class="form-select" id="m-susp-col">
              ${suspCols.map(c => `
                <option value="${escHtml(c.column)}" ${c.column === selectedCol ? 'selected' : ''}>
                  ${escHtml(c.column)} (${c.count} suspicious value${c.count > 1 ? 's' : ''})
                </option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem">
              <label class="form-label" style="margin-bottom:0">Select Affected Rows</label>
              <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:600; cursor:pointer; color:var(--primary); user-select:none">
                <input type="checkbox" id="m-susp-select-all" style="cursor:pointer; accent-color:var(--primary)"> Select All (<span id="m-susp-total-count">0</span>)
              </label>
            </div>
            <div id="m-susp-rows-container" style="max-height:165px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:0.4rem; background:var(--surface-2); display:flex; flex-direction:column; gap:0.3rem"></div>
            <div class="form-hint" style="display:flex; justify-content:space-between; margin-top:0.35rem">
              <span>Select one or more rows to apply resolution in bulk.</span>
              <span id="m-susp-selected-count" style="font-weight:600; color:var(--primary)">0 selected</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Resolution Action</label>
            <select class="form-select" id="m-susp-res" style="border-color:#ef4444; font-weight:600">
              <option value="delete_row" selected>🗑️ Delete Affected Row(s) (Default / Recommended)</option>
              <option value="correct">✏️ Correct (Enter Verified Manual Value)</option>
              <option value="replace">🔄 Replace with Imputed Value</option>
              <option value="keep">✓ Keep (Verified Valid Domain Value — Log Decision)</option>
            </select>
            <div class="form-hint" id="m-susp-action-hint">
              Deleting affected rows removes corrupted or logically invalid records from the dataset.
            </div>
          </div>

          <div class="form-group hidden" id="m-susp-manual-wrap">
            <label class="form-label">Verified Replacement Value</label>
            <input class="form-input" id="m-susp-val" placeholder="Enter corrected value">
          </div>

          <div class="form-group hidden" id="m-susp-impute-wrap">
            <label class="form-label">Imputation Method</label>
            <select class="form-select" id="m-susp-impute-method">
              <option value="median_excl_outliers" selected>Median (Excl. Outliers)</option>
              <option value="mean_excl_outliers">Mean (Excl. Outliers)</option>
              <option value="mode">Mode (Most Frequent)</option>
            </select>
          </div>
        </div>
      `,
      confirmText: "🗑️ Delete Affected Row(s)",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        const colSel = document.getElementById("m-susp-col");
        const resSel = document.getElementById("m-susp-res");
        if (!colSel) return;

        const col = colSel.value;
        const res = resSel.value;
        const manualVal = document.getElementById("m-susp-val") ? document.getElementById("m-susp-val").value : null;
        const imputeMethod = document.getElementById("m-susp-impute-method") ? document.getElementById("m-susp-impute-method").value : null;

        const checkedBoxes = Array.from(document.querySelectorAll(".m-susp-row-cb:checked"));
        const rowIndices = checkedBoxes.map(cb => parseInt(cb.value)).filter(n => !isNaN(n));

        if (!rowIndices.length) {
          showAlert("Please select at least one row to resolve.", "warning");
          return;
        }

        const confirmBtn = document.getElementById("modal-confirm");
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = "Applying...";
        }

        try {
          const r = await api.resolveSuspicious(dataset, rowIndices, col, res, imputeMethod, manualVal);
          await updateTopbar(dataset);
          const desc = (r.entries && r.entries.length)
            ? `${r.entries.length} suspicious value(s) resolved for '${col}'`
            : "Suspicious value resolved.";
          showAlert(`✓ ${desc}`, "success");
          loadMissingOverview(container, dataset);
          loadCleaningTable(container, dataset);

          // Always re-fetch fresh state from server so dropdown filtering is 100% synchronized
          const freshRes = await api.getAnalysis(dataset);
          currentAnalysis = freshRes.analysis || r.analysis || {};
          suspCols = getUnresolvedSuspCols(currentAnalysis);

          if (!suspCols.length) {
            // All suspicious issues in the entire dataset have been resolved!
            const wrap = document.getElementById("m-susp-body-wrap");
            if (wrap) {
              wrap.innerHTML = `
                <div style="text-align:center; padding:2rem 1rem">
                  <div style="font-size:3rem; margin-bottom:0.75rem">🎉</div>
                  <div style="font-weight:800; font-size:1.15rem; color:var(--ink); margin-bottom:0.5rem">All Suspicious Values Resolved!</div>
                  <p style="color:var(--ink-faint); font-size:0.875rem; margin-bottom:1.5rem">No remaining unresolved suspicious or invalid values exist in this dataset.</p>
                </div>
              `;
            }
            const cancelBtn = document.getElementById("modal-cancel");
            if (cancelBtn) cancelBtn.style.display = "none";
            if (confirmBtn) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = "Done";
              confirmBtn.className = "btn btn-success";
              confirmBtn.onclick = () => closeModal();
            }
            return;
          }

          // If the currently selected column is now fully resolved, select the next unresolved column
          if (!suspCols.some(c => c.column === selectedCol)) {
            selectedCol = suspCols[0].column;
          }

          // Rebuild column dropdown options from CURRENT unresolved state (removes resolved columns)
          colSel.innerHTML = suspCols.map(c => `
            <option value="${escHtml(c.column)}" ${c.column === selectedCol ? 'selected' : ''}>
              ${escHtml(c.column)} (${c.count} suspicious value${c.count > 1 ? 's' : ''})
            </option>
          `).join("");

          updateRows();
          updateResDisplay();
        } catch (e) {
          showAlert(e.message, "error");
        } finally {
          if (confirmBtn && suspCols.length > 0) {
            confirmBtn.disabled = false;
            updateResDisplay();
          }
        }
      }
    });

    const updateRows = () => {
      const colSel = document.getElementById("m-susp-col");
      const rowsContainer = document.getElementById("m-susp-rows-container");
      const selectAllCb = document.getElementById("m-susp-select-all");
      const totalCountEl = document.getElementById("m-susp-total-count");
      const selectedCountEl = document.getElementById("m-susp-selected-count");
      if (!colSel || !rowsContainer) return;
      selectedCol = colSel.value;
      const colEntry = suspCols.find(c => c.column === selectedCol);
      const indices = colEntry ? colEntry.indices : [];

      if (totalCountEl) totalCountEl.textContent = indices.length;

      if (!indices.length) {
        rowsContainer.innerHTML = `<div style="color:var(--ink-faint); font-size:0.8rem; padding:0.6rem; text-align:center">No unresolved suspicious rows in this column</div>`;
        if (selectAllCb) { selectAllCb.checked = false; selectAllCb.disabled = true; }
        if (selectedCountEl) selectedCountEl.textContent = "0 selected";
      } else {
        if (selectAllCb) { selectAllCb.checked = false; selectAllCb.disabled = false; }
        rowsContainer.innerHTML = indices.map((idx, i) => `
          <label style="display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.6rem; border-radius:4px; cursor:pointer; background:var(--surface); border:1px solid var(--border-soft); font-size:0.8rem; user-select:none; transition:background 0.15s">
            <span style="display:flex; align-items:center; gap:0.5rem">
              <input type="checkbox" class="m-susp-row-cb" value="${idx}" ${i === 0 ? "checked" : ""} style="cursor:pointer; accent-color:var(--primary)">
              <strong>Row ${idx}</strong>
            </span>
            <span style="color:var(--ink-faint); font-family:monospace; font-size:0.75rem">Suspicious Issue</span>
          </label>
        `).join("");

        const updateSelectedCount = () => {
          const cbs = Array.from(rowsContainer.querySelectorAll(".m-susp-row-cb"));
          const checked = cbs.filter(cb => cb.checked);
          if (selectedCountEl) selectedCountEl.textContent = `${checked.length} of ${cbs.length} selected`;
          if (selectAllCb) {
            selectAllCb.checked = checked.length === cbs.length && cbs.length > 0;
            selectAllCb.indeterminate = checked.length > 0 && checked.length < cbs.length;
          }
          const btn = document.getElementById("modal-confirm");
          const resSel = document.getElementById("m-susp-res");
          if (btn && resSel && resSel.value === "delete_row") {
            btn.textContent = checked.length > 1 ? `🗑️ Delete ${checked.length} Selected Rows` : "🗑️ Delete Affected Row";
          }
        };

        rowsContainer.querySelectorAll(".m-susp-row-cb").forEach(cb => {
          cb.addEventListener("change", updateSelectedCount);
        });

        if (selectAllCb) {
          selectAllCb.onchange = () => {
            rowsContainer.querySelectorAll(".m-susp-row-cb").forEach(cb => {
              cb.checked = selectAllCb.checked;
            });
            updateSelectedCount();
          };
        }

        updateSelectedCount();
      }
    };

    const updateResDisplay = () => {
      const resSel = document.getElementById("m-susp-res");
      const manualWrap = document.getElementById("m-susp-manual-wrap");
      const imputeWrap = document.getElementById("m-susp-impute-wrap");
      if (!resSel) return;
      const val = resSel.value;
      if (manualWrap) manualWrap.classList.toggle("hidden", val !== "correct");
      if (imputeWrap) imputeWrap.classList.toggle("hidden", val !== "replace");

      const btn = document.getElementById("modal-confirm");
      if (btn && suspCols.length > 0) {
        if (val === "delete_row") {
          btn.className = "btn btn-danger";
          const count = document.querySelectorAll(".m-susp-row-cb:checked").length;
          btn.textContent = count > 1 ? `🗑️ Delete ${count} Selected Rows` : "🗑️ Delete Affected Row";
        } else {
          btn.className = "btn btn-primary";
          btn.textContent = "Apply Resolution";
        }
      }
    };

    setTimeout(() => {
      const colSel = document.getElementById("m-susp-col");
      const resSel = document.getElementById("m-susp-res");
      if (colSel) colSel.onchange = () => {
        updateRows();
        updateResDisplay();
      };
      if (resSel) resSel.onchange = updateResDisplay;
      updateRows();
      updateResDisplay();
    }, 100);

  } catch (e) {
    showAlert(e.message, "error");
  }
}

// Fill Missing Modal with Issues 4, 11, & 21 fixes
async function showFillMissingModal(dataset, defaultCol, container) {
  try {
    const [analysisRes, prevRes] = await Promise.all([
      api.getAnalysis(dataset),
      api.getDatasetPreview(dataset, { page: 0, pageSize: 1 })
    ]);

    const analysis = analysisRes.analysis || {};
    const missing = analysis.missing || {};
    const affectedCols = missing.affected_columns || [];
    const schemaCols = (analysis.schema || {}).columns || [];
    const dtypes = prevRes.dtypes || {};

    // Filter to only columns with missing values (Issue 11a)
    let missingColNames = affectedCols.map(c => c.column);
    if (!missingColNames.length) {
      missingColNames = schemaCols.filter(c => (c.missing_count ?? 0) > 0).map(c => c.name);
    }

    if (!missingColNames.length) {
      showAlert("🎉 No columns currently contain missing values!", "info");
      return;
    }

    const selectedCol = defaultCol && missingColNames.includes(defaultCol) ? defaultCol : missingColNames[0];

    showModal({
      title: "Fill Missing Values — Configure & Preview",
      body: `
        <div class="form-group">
          <label class="form-label">Select Column with Missing Values</label>
          <select class="form-select" id="m-fill-col">
            ${missingColNames.map(c => {
              const aff = affectedCols.find(a => a.column === c);
              const mCount = aff ? (aff.missing_count ?? aff.count ?? 0) : 0;
              const mPct = aff ? (aff.missing_pct ?? aff.pct ?? 0) : 0;
              const countBadge = aff ? ` (${mCount} missing, ${mPct}%)` : '';
              return `<option value="${escHtml(c)}" ${c === selectedCol ? 'selected' : ''}>${escHtml(c)}${countBadge}</option>`;
            }).join("")}
          </select>
        </div>

        <!-- Identifier Column Warning (Issue 4 & Issue 21b) -->
        <div id="m-id-warning" class="hidden" style="margin-bottom:1rem; padding:0.75rem; background:var(--warning-bg); border:1px solid var(--warning-border); border-radius:8px">
          <div style="font-weight:700; color:var(--warning); font-size:0.8125rem" id="m-id-warning-title">⚠️ Identifier-Like Column Detected</div>
          <div style="font-size:0.75rem; color:var(--ink-soft); margin-top:0.25rem" id="m-id-warning-desc">
            This column appears to be a unique identifier / primary key. Statistical imputation (Mean/Median/Mode) will create invalid or duplicate keys. Deleting the row or entering a manual key is recommended.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Imputation Method</label>
          <select class="form-select" id="m-fill-method"></select>
          <div class="form-hint" id="m-method-hint">Select appropriate method for this column type.</div>
        </div>

        <div class="form-group hidden" id="m-manual-wrap">
          <label class="form-label">Manual Replacement Value</label>
          <input class="form-input" id="m-fill-val" placeholder="Enter value to replace missing cells">
          <div class="form-hint">This value will replace all missing cells in the selected column.</div>
        </div>
      `,
      confirmText: "Preview Imputation →",
      onConfirm: async () => {
        const col = document.getElementById("m-fill-col").value;
        const method = document.getElementById("m-fill-method").value;
        const manualVal = document.getElementById("m-fill-val") ? document.getElementById("m-fill-val").value : null;

        try {
          const prevData = await api.previewFillMissing(dataset, col, method, manualVal);
          showImputationPreviewModal(dataset, prevData, manualVal, container);
        } catch (e) {
          showAlert(e.message, "error");
        }
      }
    });

    setTimeout(() => {
      const colSel = document.getElementById("m-fill-col");
      const methodSel = document.getElementById("m-fill-method");
      const manualWrap = document.getElementById("m-manual-wrap");
      const idWarning = document.getElementById("m-id-warning");

      const updateMethodsForCol = () => {
        if (!colSel || !methodSel) return;
        const colName = colSel.value;
        const colSchema = schemaCols.find(c => c.name === colName) || {};
        const aff = affectedCols.find(a => a.column === colName) || {};
        const dtype = (dtypes[colName] || colSchema.dtype || aff.dtype || "").toLowerCase();
        const isNum = Boolean(aff.is_numeric || colSchema.is_numeric || dtype.includes("int") || dtype.includes("float") || dtype.includes("number"));
        const isIdentifier = Boolean(colSchema.is_identifier || aff.is_identifier);
        const idConf = colSchema.identifier_confidence || aff.identifier_confidence || "";

        if (idWarning) {
          if (isIdentifier) {
            idWarning.classList.remove("hidden");
            document.getElementById("m-id-warning-title").textContent = idConf === "strong" ? "🛑 Identifier Column Detected" : "⚠️ Possible Identifier Column";
          } else {
            idWarning.classList.add("hidden");
          }
        }

        if (isIdentifier) {
          methodSel.innerHTML = `
            <option value="delete_row" selected>Delete Affected Rows (Recommended for IDs)</option>
            <option value="manual">Manual Value Entry</option>
            <option value="leave_unchanged">Leave Unchanged</option>
          `;
        } else if (isNum) {
          // Issue 21c: Never offer Mode for numeric columns
          methodSel.innerHTML = `
            <option value="median_excl_outliers" selected>Median (Excluding Outliers) — Recommended</option>
            <option value="mean_excl_outliers">Mean (Excluding Outliers)</option>
            <option value="median">Median (All Values)</option>
            <option value="mean">Mean (All Values)</option>
            <option value="manual">Manual Value Entry</option>
            <option value="delete_row">Delete Affected Rows</option>
            <option value="leave_unchanged">Leave Unchanged</option>
          `;
        } else {
          // Categorical / string columns
          methodSel.innerHTML = `
            <option value="mode" selected>Mode (Most Frequent Value)</option>
            <option value="manual">Manual Value Entry</option>
            <option value="delete_row">Delete Affected Rows</option>
            <option value="leave_unchanged">Leave Unchanged</option>
          `;
        }

        if (manualWrap) manualWrap.classList.toggle("hidden", methodSel.value !== "manual");
      };

      if (colSel) colSel.onchange = updateMethodsForCol;
      if (methodSel) methodSel.onchange = () => { if (manualWrap) manualWrap.classList.toggle("hidden", methodSel.value !== "manual"); };
      updateMethodsForCol();
    }, 100);

  } catch (e) {
    showAlert(e.message, "error");
  }
}

function showImputationPreviewModal(dataset, prevData, manualVal, container) {
  const sampleTable = (prevData.sample_affected || []).map(r => `
    <tr>
      <td>${r.row}</td>
      <td style="color:#94a3b8"><em>Missing</em></td>
      <td style="color:#166534; font-weight:700">${escHtml(r.new)}</td>
    </tr>
  `).join("");

  showModal({
    title: `Preview Imputation — Column '${escHtml(prevData.column)}'`,
    body: `
      <div class="grid-2" style="gap:0.75rem; margin-bottom:1rem">
        <div class="stat-card"><div class="stat-label">Data Type</div><div class="stat-value" style="font-size:1rem">${escHtml(prevData.dtype)}</div></div>
        <div class="stat-card"><div class="stat-label">Missing Cells</div><div class="stat-value" style="color:#d97706">${prevData.missing_count} (${prevData.missing_pct}%)</div></div>
      </div>
      <div style="background:#f8fafc; padding:0.75rem 1rem; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:1rem">
        <div style="font-size:0.8125rem; color:#334155"><strong>Method:</strong> ${escHtml(prevData.method)}</div>
        <div style="font-size:0.8125rem; color:#334155"><strong>Description:</strong> ${escHtml(prevData.description)}</div>
        <div style="font-size:0.875rem; color:#166534; font-weight:700; margin-top:0.25rem">Replacement Value: ${escHtml(prevData.replacement_value)}</div>
      </div>

      <h4 style="font-size:0.875rem; font-weight:700; color:#0f172a; margin-bottom:0.35rem">Sample Affected Records</h4>
      <div class="data-table-wrap" style="max-height:200px">
        <table class="data-table">
          <thead><tr><th>Row #</th><th>Original</th><th>New Imputed Value</th></tr></thead>
          <tbody>${sampleTable || '<tr><td colspan="3" style="text-align:center">No sample rows</td></tr>'}</tbody>
        </table>
      </div>
    `,
    confirmText: "Apply Changes Now",
    confirmClass: "btn-success",
    onConfirm: async () => {
      try {
        const res = await api.fillMissing(dataset, prevData.column, prevData.method, manualVal);
        await updateTopbar(dataset);
        showAlert(`✓ ${res.entry.description}`, "success");
        await loadMissingOverview(container, dataset);
        await loadCleaningTable(container, dataset);
      } catch (e) {
        showAlert(e.message, "error");
      }
    }
  });
}

function showCellEditModal(dataset, rowIdx, col, currentVal, container) {
  showModal({
    title: `Edit Cell [Row ${rowIdx}, Column '${col}']`,
    body: `
      <div class="form-group"><label class="form-label">Current Value</label><input class="form-input" value="${escHtml(currentVal)}" disabled></div>
      <div class="form-group"><label class="form-label">New Value</label><input class="form-input" id="m-edit-newval" value="${escHtml(currentVal)}"></div>
    `,
    confirmText: "Save Edit",
    onConfirm: async () => {
      const newVal = document.getElementById("m-edit-newval").value;
      try {
        const res = await api.editCell(dataset, rowIdx, col, newVal);
        await updateTopbar(dataset);
        showAlert(`✓ Cell [${rowIdx}, '${col}'] updated: '${currentVal}' → '${newVal}'`, "success");
        await loadMissingOverview(container, dataset);
        await loadCleaningTable(container, dataset);
      } catch (e) { showAlert(e.message, "error"); }
    }
  });
}

// ===== CHANGE HISTORY PAGE (Issue 12: Styled Cards) =====
export async function renderHistory(container, dataset) {
  try {
    const st = await api.getDatasetState(dataset);
    if (!st || st.state === "empty") {
      renderNoDatasetState(container, "Change History", dataset);
      return;
    }
  } catch {
    renderNoDatasetState(container, "Change History", dataset);
    return;
  }

  container.innerHTML = `<div class="loading-overlay" style="min-height:200px"><div class="spinner spinner-lg"></div><div class="loading-text">Loading history...</div></div>`;
  try {
    const res = await api.getHistory(dataset);
    const history = res.history || [];

    // Reverse chronological order for audit log
    const reversedHistory = [...history].reverse();

    container.innerHTML = `
      <div class="card">
        <div class="card-title" style="justify-content:space-between">
          <span>📋 Complete Change History — ${escHtml(dataset.toUpperCase())} Dataset</span>
          <span class="badge badge-info">${history.length} Action(s) Recorded</span>
        </div>
        <p style="color:#64748b; font-size:0.8125rem; margin-bottom:1.25rem">
          Comprehensive audit log of all modifications applied to the working dataset in chronological order.
        </p>
        ${!reversedHistory.length ? `
          <div class="empty-state">
            <div style="font-size:2.5rem; margin-bottom:0.5rem">📝</div>
            <div class="empty-title">No changes recorded yet</div>
            <div class="empty-sub">Actions taken in the Cleaning Studio will appear here with full audit trails.</div>
          </div>
        ` : `
          <div>
            ${reversedHistory.map(item => {
              const act = (item.action || "").toUpperCase();
              let badgeClass = "history-badge fill";
              let icon = "💉";
              let iconBg = "#dbeafe";

              if (act.includes("DELETE") || act.includes("DROP")) {
                badgeClass = "history-badge delete";
                icon = "🗑️";
                iconBg = "#fee2e2";
              } else if (act.includes("EDIT") || act.includes("MANUAL")) {
                badgeClass = "history-badge edit";
                icon = "✏️";
                iconBg = "#ede9fe";
              } else if (act.includes("TYPE") || act.includes("REPAIR")) {
                badgeClass = "history-badge type";
                icon = "🔧";
                iconBg = "#fef3c7";
              } else if (act.includes("RENAME")) {
                badgeClass = "history-badge rename";
                icon = "🏷️";
                iconBg = "#e0e7ff";
              } else if (act.includes("DUPLICATE")) {
                badgeClass = "history-badge duplicate";
                icon = "👯";
                iconBg = "#ffedd5";
              } else if (act.includes("OUTLIER")) {
                badgeClass = "history-badge outlier";
                icon = "🎯";
                iconBg = "#fce7f3";
              } else if (act.includes("RESET")) {
                badgeClass = "history-badge reset";
                icon = "🔄";
                iconBg = "#f1f5f9";
              }

              return `
                <div class="history-card">
                  <div class="history-icon-wrap" style="background:${iconBg}">${icon}</div>
                  <div class="history-content">
                    <div class="history-top">
                      <div style="display:flex; align-items:center; gap:0.5rem">
                        <span class="${badgeClass}">${escHtml(item.action)}</span>
                        ${item.column ? `<strong style="font-size:0.8125rem; color:#0f172a">'${escHtml(item.column)}'</strong>` : ''}
                      </div>
                      <span class="history-time">#${item.sequence} · ${item.timestamp ? item.timestamp.slice(0, 19).replace('T', ' ') : '—'}</span>
                    </div>
                    <div class="history-desc">${escHtml(item.description)}</div>
                    ${item.original_value !== undefined || item.new_value !== undefined ? `
                      <div class="history-meta">
                        ${item.original_value !== undefined ? `Original: <code style="background:#f1f5f9; padding:0.1rem 0.3rem; border-radius:3px">${escHtml(item.original_value)}</code> → ` : ''}
                        ${item.new_value !== undefined ? `New: <code style="background:#dcfce7; color:#166534; padding:0.1rem 0.3rem; border-radius:3px">${escHtml(item.new_value)}</code>` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">✗ ${escHtml(e.message)}</div>`;
  }
}
