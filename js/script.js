/**
 * Expense & Budget Visualizer — app.js
 * Vanilla JS | localStorage | Chart.js
 */

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */
const STORAGE_KEY   = 'budgetTracker_transactions';
const LIMIT_KEY     = 'budgetTracker_spendLimit';
const THEME_KEY     = 'budgetTracker_theme';

const CATEGORY_COLORS = {
  Food:      '#ff6b6b',
  Transport: '#4ecdc4',
  Fun:       '#a78bfa',
};

const CATEGORY_ICONS = {
  Food:      '🍔',
  Transport: '🚗',
  Fun:       '🎉',
};

/** @type {{ id: string, name: string, amount: number, category: string, timestamp: number }[]} */
let transactions = [];
let spendLimit   = 0;
let chartInstance = null;

/* ============================================================
   DOM REFS
   ============================================================ */
const dom = {
  form:             document.getElementById('transactionForm'),
  itemName:         document.getElementById('itemName'),
  amount:           document.getElementById('amount'),
  category:         document.getElementById('category'),
  itemNameError:    document.getElementById('itemNameError'),
  amountError:      document.getElementById('amountError'),
  categoryError:    document.getElementById('categoryError'),
  totalBalance:     document.getElementById('totalBalance'),
  spendLimit:       document.getElementById('spendLimit'),
  limitWarning:     document.getElementById('limitWarning'),
  limitView:        document.getElementById('limitView'),
  limitEdit:        document.getElementById('limitEdit'),
  limitDisplay:     document.getElementById('limitDisplay'),
  limitChangeBtn:   document.getElementById('limitChangeBtn'),
  limitConfirmBtn:  document.getElementById('limitConfirmBtn'),
  limitCancelBtn:   document.getElementById('limitCancelBtn'),
  transactionList:  document.getElementById('transactionList'),
  listEmpty:        document.getElementById('listEmpty'),
  chartCanvas:      document.getElementById('spendingChart'),
  chartEmpty:       document.getElementById('chartEmpty'),
  sortSelect:       document.getElementById('sortSelect'),
  themeToggle:      document.getElementById('themeToggle'),
  themeIcon:        document.getElementById('themeIcon'),
};

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

function saveLimit(value) {
  localStorage.setItem(LIMIT_KEY, String(value));
}

function loadLimit() {
  const raw = localStorage.getItem(LIMIT_KEY);
  return raw ? parseFloat(raw) : 0;
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

/* ============================================================
   HELPERS
   ============================================================ */
function generateId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatCurrency(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function getTotal() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/* ============================================================
   FORM VALIDATION
   ============================================================ */
function clearErrors() {
  [dom.itemName, dom.amount, dom.category].forEach(el => el.classList.remove('is-error'));
  [dom.itemNameError, dom.amountError, dom.categoryError].forEach(el => el.textContent = '');
}

function validateForm() {
  let valid = true;
  clearErrors();

  const name   = dom.itemName.value.trim();
  const amt    = dom.amount.value.trim();
  const cat    = dom.category.value;

  if (!name) {
    dom.itemNameError.textContent = 'Item name is required.';
    dom.itemName.classList.add('is-error');
    valid = false;
  }

  if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
    dom.amountError.textContent = 'Enter a valid amount greater than 0.';
    dom.amount.classList.add('is-error');
    valid = false;
  }

  if (!cat) {
    dom.categoryError.textContent = 'Please select a category.';
    dom.category.classList.add('is-error');
    valid = false;
  }

  return valid;
}

/* ============================================================
   ADD TRANSACTION
   ============================================================ */
function addTransaction(name, amount, category) {
  const txn = {
    id:        generateId(),
    name:      name,
    amount:    amount,
    category:  category,
    timestamp: Date.now(),
  };
  transactions.push(txn);
  saveTransactions();
  render();
}

/* ============================================================
   DELETE TRANSACTION
   ============================================================ */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  render();
}

/* ============================================================
   SORT
   ============================================================ */
function getSortedTransactions() {
  const sortVal = dom.sortSelect.value;
  const clone   = [...transactions];

  switch (sortVal) {
    case 'date-asc':
      return clone.sort((a, b) => a.timestamp - b.timestamp);
    case 'date-desc':
      return clone.sort((a, b) => b.timestamp - a.timestamp);
    case 'amount-desc':
      return clone.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return clone.sort((a, b) => a.amount - b.amount);
    case 'category-asc':
      return clone.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return clone;
  }
}

/* ============================================================
   RENDER — TRANSACTION LIST
   ============================================================ */
function renderList() {
  const sorted = getSortedTransactions();
  dom.transactionList.innerHTML = '';

  if (sorted.length === 0) {
    dom.listEmpty.classList.remove('hidden');
    return;
  }

  dom.listEmpty.classList.add('hidden');

  sorted.forEach(txn => {
    const li = document.createElement('li');
    li.className    = 'transaction-item';
    li.dataset.category = txn.category;
    li.dataset.id   = txn.id;

    // Highlight if single transaction amount exceeds limit
    if (spendLimit > 0 && txn.amount > spendLimit) {
      li.classList.add('over-limit');
    }

    li.innerHTML = `
      <div class="item-info">
        <p class="item-name" title="${escapeHtml(txn.name)}">
          ${CATEGORY_ICONS[txn.category] || ''} ${escapeHtml(txn.name)}
        </p>
        <div class="item-meta">
          <span class="item-category ${txn.category}">${txn.category}</span>
        </div>
      </div>
      <span class="item-amount">${formatCurrency(txn.amount)}</span>
      <button
        class="btn-delete"
        data-id="${txn.id}"
        aria-label="Delete transaction ${escapeHtml(txn.name)}"
      >Delete</button>
    `;

    dom.transactionList.appendChild(li);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   RENDER — BALANCE
   ============================================================ */
function renderBalance() {
  const total = getTotal();
  dom.totalBalance.textContent = formatCurrency(total);

  if (spendLimit > 0 && total > spendLimit) {
    dom.limitWarning.classList.remove('hidden');
  } else {
    dom.limitWarning.classList.add('hidden');
  }
}

/* ============================================================
   RENDER — PIE CHART
   ============================================================ */
function renderChart() {
  // Aggregate by category
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels     = Object.keys(totals);
  const data       = Object.values(totals);
  const bgColors   = labels.map(l => CATEGORY_COLORS[l] || '#999');
  const borderColors = bgColors.map(c => c);

  if (labels.length === 0) {
    dom.chartEmpty.classList.remove('hidden');
    dom.chartCanvas.classList.add('hidden');
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  dom.chartEmpty.classList.add('hidden');
  dom.chartCanvas.classList.remove('hidden');

  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-text').trim() || '#1e2131';

  if (chartInstance) {
    // Update existing chart data
    chartInstance.data.labels            = labels;
    chartInstance.data.datasets[0].data  = data;
    chartInstance.data.datasets[0].backgroundColor  = bgColors;
    chartInstance.data.datasets[0].borderColor       = borderColors;
    chartInstance.options.plugins.legend.labels.color = textColor;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(dom.chartCanvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data:            data,
        backgroundColor: bgColors,
        borderColor:     borderColors,
        borderWidth:     2,
        hoverOffset:     12,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color:     textColor,
            font:      { size: 13, weight: '600' },
            padding:   16,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const val   = ctx.parsed;
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${formatCurrency(val)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/* ============================================================
   MAIN RENDER (orchestrates all sub-renders)
   ============================================================ */
function render() {
  renderBalance();
  renderList();
  renderChart();
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  // Rebuild chart so legend/tooltip colors update
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  renderChart();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  applyTheme(next);
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

// Form submit
dom.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const name   = dom.itemName.value.trim();
  const amount = parseFloat(dom.amount.value.trim());
  const cat    = dom.category.value;

  addTransaction(name, amount, cat);

  // Reset form
  dom.form.reset();
  clearErrors();
  dom.itemName.focus();
});

// Delete (event delegation on the list)
dom.transactionList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  deleteTransaction(id);
});

// Sort change
dom.sortSelect.addEventListener('change', () => {
  renderList();
});

// Spend limit — view / edit / confirm / cancel
function enterLimitEditMode() {
  dom.limitView.classList.add('hidden');
  dom.limitEdit.classList.remove('hidden');
  // Pre-fill with current value so user can see what they're changing
  dom.spendLimit.value = spendLimit > 0 ? spendLimit : '';
  dom.spendLimit.focus();
}

function exitLimitEditMode() {
  dom.limitEdit.classList.add('hidden');
  dom.limitView.classList.remove('hidden');
}

function updateLimitDisplay() {
  dom.limitDisplay.textContent = spendLimit > 0
    ? formatCurrency(spendLimit)
    : 'Not set';
}

dom.limitChangeBtn.addEventListener('click', enterLimitEditMode);

dom.limitConfirmBtn.addEventListener('click', () => {
  const val = parseFloat(dom.spendLimit.value);
  spendLimit = isNaN(val) || val < 0 ? 0 : val;
  saveLimit(spendLimit);
  updateLimitDisplay();
  exitLimitEditMode();
  render();
});

dom.limitCancelBtn.addEventListener('click', () => {
  exitLimitEditMode();
});

// Allow confirming with Enter key inside the limit input
dom.spendLimit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dom.limitConfirmBtn.click();
  }
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
});

// Theme toggle
dom.themeToggle.addEventListener('click', toggleTheme);

// Block non-numeric keys on the amount field
dom.amount.addEventListener('keydown', (e) => {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
});

/* ============================================================
   INITIALISE
   ============================================================ */
function init() {
  // Restore persisted data
  loadTransactions();
  spendLimit = loadLimit();

  // Restore theme
  const theme = loadTheme();
  applyTheme(theme);

  // Populate limit display if saved
  updateLimitDisplay();

  // Initial render
  render();
}

init();
