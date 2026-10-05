/* issues.js — Data Quality Issue Center */
import * as api from "./api.js";
import { navigate, severityBadge, showModal, escHtml, renderNoDatasetState } from "./app.js";

export async function renderIssues(container, dataset) {
  try {
    const st = await api.getDatasetState(dataset);
    if (!st || st.state === "empty") {
      renderNoDatasetState(container, "Issue Center", dataset);
      return;
    }
  } catch {
    renderNoDatasetState(container, "Issue Center", dataset);
    return;
  }

  container.innerHTML = `<div class="loading-overlay" style="min-height:200px"><div class="spinner spinner-lg"></div><div class="loading-text">Loading issues...</div></div>`;
  try {
    const res = await api.getAnalysis(dataset);
    renderIssueCenter(container, res.analysis, dataset);
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">✗ ${escHtml(e.message)}</div>`;
  }
}

function renderIssueCenter(container, a, dataset) {
  const issues = a.issue_center || [];
  const recs = a.recommendations || [];

  // Map recommendations into issues for unified inline presentation
  const enrichedIssues = issues.map(issue => {
    const match = recs.find(r => 
      (issue.column && r.column === issue.column && (r.category === issue.category || r.action_hint === issue.action_hint)) ||
      (issue.column && r.column === issue.column) ||
      (!issue.column && r.category === issue.category)
    );
    return {
      ...issue,
      recommendation: match ? match.recommendation : null,
      recWhy: match ? match.why : null,
    };
  });

  container.innerHTML = `
    <div id="issue-alerts"></div>

    <div class="card">
      <div class="card-title">⚠️ Data Quality Issue Center</div>
      <p style="color:var(--ink-faint); font-size:0.8125rem; margin-bottom:1rem">
        Detected quality problems, potential anomalies, and data-type inconsistencies categorized by severity and type.
      </p>

      <div style="display:flex; gap:0.5rem; margin-bottom:1.25rem; flex-wrap:wrap">
        <button class="btn btn-primary btn-sm filter-btn" data-filter="all">All Issues (${issues.length})</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-filter="Missing Values">Missing Values</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-filter="Duplicate Rows">Duplicate Rows</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-filter="Data-Type Issues">Data-Type Issues</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-filter="Suspicious Values">Suspicious Values</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-filter="Potential Outliers">Potential Outliers</button>
      </div>

      <div id="issue-list-container">
        ${renderIssueList(enrichedIssues)}
      </div>
    </div>
  `;

  // Filter tabs wiring
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll(".filter-btn").forEach(b => {
        b.classList.remove("btn-primary");
        b.classList.add("btn-secondary");
      });
      btn.classList.remove("btn-secondary");
      btn.classList.add("btn-primary");
      const f = btn.dataset.filter;
      const filtered = f === "all" ? enrichedIssues : enrichedIssues.filter(i => i.category === f);
      container.querySelector("#issue-list-container").innerHTML = renderIssueList(filtered);
      wireIssueButtons(container, dataset, filtered);
    };
  });

  wireIssueButtons(container, dataset, enrichedIssues);
}

function renderIssueList(issues) {
  if (!issues.length) {
    return `
      <div class="empty-state">
        <div style="font-size:2.5rem; margin-bottom:0.5rem">🎉</div>
        <div class="empty-title">No issues in this category!</div>
        <div class="empty-sub">Your dataset meets quality standards for this category.</div>
      </div>
    `;
  }

  return issues.map((i, idx) => `
    <div class="issue-card ${i.severity}" style="margin-bottom:1rem">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom:0.35rem">
        <div style="display:flex; align-items:center; gap:0.5rem; font-weight:700; color:var(--ink); font-size:0.875rem">
          ${severityBadge(i.severity)}
          <span>${escHtml(i.category)} ${i.column ? `— Column '${escHtml(i.column)}'` : ''}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--ink-faint)">
          Affected: <strong>${i.count}</strong> ${i.pct !== null && i.pct !== undefined ? `(${i.pct}%)` : ''}
        </div>
      </div>

      <div style="font-size:0.8125rem; color:var(--ink-soft); line-height:1.45; margin-bottom:0.5rem">
        ${escHtml(i.description)}
      </div>

      ${i.recommendation ? `
        <div style="margin-bottom:0.75rem; padding:0.6rem 0.85rem; background:var(--info-bg); border-radius:8px; border-left:3px solid var(--info); font-size:0.8125rem">
          <div style="font-weight:700; color:var(--info); margin-bottom:0.15rem">💡 Recommendation:</div>
          <div style="color:var(--ink-soft); line-height:1.4">${escHtml(i.recommendation)}</div>
        </div>
      ` : ''}

      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap">
        ${i.affected_indices && i.affected_indices.length ? `
          <button class="btn btn-secondary btn-sm btn-inspect" data-idx="${idx}">Show Affected Records (${i.affected_indices.length})</button>
        ` : ''}
        ${i.category === "Suspicious Values" ? `
          <button class="btn btn-danger btn-sm btn-quick-del-susp" data-idx="${idx}" title="Delete rows containing suspicious values">
            🗑️ Delete Affected Row(s) (Default)
          </button>
          <button class="btn btn-primary btn-sm btn-action" data-hint="resolve_suspicious" data-col="${escHtml(i.column || '')}">
            Resolve in Modal →
          </button>
        ` : `
          <button class="btn btn-primary btn-sm btn-action" data-hint="${i.action_hint || ''}" data-col="${escHtml(i.column || '')}">
            Apply Action →
          </button>
        `}
      </div>
    </div>
  `).join("");
}

function wireIssueButtons(container, dataset, currentIssues) {
  container.querySelectorAll(".btn-inspect").forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.idx);
      const issue = currentIssues[idx];
      if (!issue || !issue.affected_indices || !issue.affected_indices.length) return;

      try {
        const recordsRes = await api.getAffectedRows(dataset, issue.affected_indices);
        showModal({
          title: `Affected Records (${recordsRes.records.length}) — ${issue.category}`,
          body: renderAffectedModalTable(recordsRes),
          showCancel: false,
          confirmText: "Close",
        });
      } catch (e) {
        showAlert(e.message, "error");
      }
    };
  });

  // Default fast one-click row deletion for suspicious values (Issue 18)
  container.querySelectorAll(".btn-quick-del-susp").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx);
      const issue = currentIssues[idx];
      if (!issue || !issue.affected_indices || !issue.affected_indices.length) return;
      const count = issue.affected_indices.length;

      showModal({
        title: `Delete ${count} Row(s) with Suspicious Values?`,
        body: `
          <p>Delete all ${count} record(s) flagged for suspicious / invalid values in column <strong>'${escHtml(issue.column || '')}'</strong>?</p>
          <div style="margin-top:0.75rem; padding:0.6rem; background:var(--danger-bg); border:1px solid var(--danger-border); border-radius:6px; font-size:0.75rem; color:var(--danger)">
            ⚠️ Affected row indices: ${issue.affected_indices.slice(0, 15).join(", ")}${count > 15 ? '...' : ''}
          </div>
        `,
        confirmText: "Delete Affected Row(s)",
        confirmClass: "btn-danger",
        onConfirm: async () => {
          try {
            await api.deleteRows(dataset, issue.affected_indices);
            showAlert(`✓ Deleted ${count} row(s) containing suspicious values.`, "success");
            renderIssues(container, dataset);
          } catch (e) {
            showAlert(e.message, "error");
          }
        }
      });
    };
  });

  const goClean = (hint, col) => {
    navigate("cleaning", { dataset, hint, column: col });
  };

  container.querySelectorAll(".btn-action").forEach(btn => {
    btn.onclick = () => goClean(btn.dataset.hint, btn.dataset.col);
  });
}

function renderAffectedModalTable(res) {
  if (!res.records || !res.records.length) return "<p style='color:var(--ink-faint)'>No records found.</p>";
  const cols = res.columns || [];
  let html = `<div class="data-table-wrap" style="max-height:400px; overflow-y:auto"><table class="data-table"><thead><tr><th>#</th>${cols.map(c => `<th>${escHtml(c)}</th>`).join("")}</tr></thead><tbody>`;
  res.records.forEach((row, i) => {
    html += `<tr><td>${i}</td>${cols.map(c => `<td>${row[c] === null ? '<span class="null-cell">null</span>' : escHtml(row[c])}</td>`).join("")}</tr>`;
  });
  html += "</tbody></table></div>";
  return html;
}
