// ==================== KEUANGAN KELUARGA APP ====================
// Google Sheets API URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwJKbyLM0lwXbC7Q32Zbk6m7_tiMUCSciwyZzAcHSkJHfGFa7r4aEGnCZERyOIF8OwLLg/exec';

// LocalStorage Keys (for caching and session)
const STORAGE_KEYS = {
    CURRENT_USER: 'keuangan_current_user',
    CACHED_TRANSACTIONS: 'keuangan_cached_transactions',
    CACHED_BUDGET: 'keuangan_cached_budget'
};

// Loading state
let isLoading = false;

function showLoading() {
    isLoading = true;
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    isLoading = false;
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'none';
}

// API call helper
async function apiCall(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Connection error. Please try again.', 'error');
        return { success: false, error: error.message };
    }
}

// ==================== UTILITY FUNCTIONS ====================
function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
}

// Format Rupiah with separate currency for better alignment
function formatRupiahHTML(num) {
    return `<span class="currency">Rp</span>${num.toLocaleString('id-ID')}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function setStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ==================== USER AUTHENTICATION ====================
function getCurrentUser() {
    return getStorage(STORAGE_KEYS.CURRENT_USER);
}

function setCurrentUser(username) {
    setStorage(STORAGE_KEYS.CURRENT_USER, username);
}

async function registerUser(username, password, gaji) {
    showLoading();
    const result = await apiCall('register', { username, password, gaji });
    hideLoading();

    if (result.success) {
        showToast('Registration successful! Please login.');
        return true;
    } else {
        showToast(result.error || 'Registration failed!', 'error');
        return false;
    }
}

async function loginUser(username, password) {
    showLoading();
    const result = await apiCall('login', { username, password });
    hideLoading();

    if (result.success) {
        setCurrentUser(username);
        showToast(`Welcome, ${username}!`);
        // Load and cache data
        await loadUserDataFromCloud();
        return true;
    } else {
        showToast(result.error || 'Login failed!', 'error');
        return false;
    }
}

function logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.CACHED_BUDGET);
    localStorage.removeItem(STORAGE_KEYS.CACHED_TRANSACTIONS);
    showToast('Logged out successfully');
    showLoginPage();
}

async function loadUserDataFromCloud() {
    const username = getCurrentUser();
    if (!username) return;

    showLoading();

    // Load budget
    const budgetResult = await apiCall('getBudget', { username });
    if (budgetResult.success && budgetResult.budget) {
        setStorage(STORAGE_KEYS.CACHED_BUDGET, budgetResult.budget);
    }

    // Load transactions
    const txResult = await apiCall('getTransactions', { username });
    if (txResult.success && txResult.transactions) {
        setStorage(STORAGE_KEYS.CACHED_TRANSACTIONS, txResult.transactions);
    }

    hideLoading();
}

function changePassword(oldPass, newPass) {
    // For now, password change requires re-registration
    showToast('Please contact admin to change password', 'warning');
    return false;
}

// ==================== BUDGET MANAGEMENT ====================
function getUserBudget() {
    // Get from cache
    const cached = getStorage(STORAGE_KEYS.CACHED_BUDGET);
    return cached || { gaji: 6000000, living: 50, saving: 30, playing: 10, emergency: 10 };
}

async function saveUserBudget(budget) {
    const username = getCurrentUser();

    // Save to cache immediately
    setStorage(STORAGE_KEYS.CACHED_BUDGET, budget);

    // Sync to cloud in background
    const result = await apiCall('saveBudget', {
        username,
        budget: JSON.stringify(budget)
    });

    if (!result.success) {
        console.error('Failed to sync budget to cloud');
    }
}

function calculateBudgetAmounts(budget) {
    const gaji = budget.gaji;

    // Use saved amounts if available (new format), otherwise calculate from percentages
    if (budget.livingAmt !== undefined) {
        return {
            living: budget.livingAmt,
            saving: budget.savingAmt,
            playing: budget.playingAmt,
            emergency: budget.emergencyAmt
        };
    }

    return {
        living: Math.round(gaji * budget.living / 100),
        saving: Math.round(gaji * budget.saving / 100),
        playing: Math.round(gaji * budget.playing / 100),
        emergency: Math.round(gaji * (budget.emergency || 10) / 100)
    };
}

// ==================== TRANSACTION MANAGEMENT ====================
function getUserTransactions() {
    // Get from cache
    const cached = getStorage(STORAGE_KEYS.CACHED_TRANSACTIONS);
    return cached || [];
}

function saveUserTransactions(txList) {
    // Save to cache
    setStorage(STORAGE_KEYS.CACHED_TRANSACTIONS, txList);
}

async function addTransaction(tx) {
    const username = getCurrentUser();
    tx.id = Date.now();
    tx.createdAt = new Date().toISOString();

    // Add to local cache immediately
    const transactions = getUserTransactions();
    transactions.push(tx);
    saveUserTransactions(transactions);

    // Sync to cloud in background
    const result = await apiCall('addTransaction', {
        username,
        transaction: JSON.stringify(tx)
    });

    if (result.success) {
        showToast('Transaction added successfully!');
    } else {
        showToast('Saved locally. Will sync when online.', 'warning');
    }

    return tx;
}

async function deleteTransaction(id) {
    const username = getCurrentUser();

    // Remove from local cache
    let transactions = getUserTransactions();
    transactions = transactions.filter(t => t.id !== id);
    saveUserTransactions(transactions);

    // Sync to cloud
    const result = await apiCall('deleteTransaction', {
        username,
        transactionId: id
    });

    if (result.success) {
        showToast('Transaction deleted successfully!');
    }
}

function getTransactionsByMonth(month) {
    const transactions = getUserTransactions();
    return transactions.filter(t => t.date.startsWith(month));
}

function getTransactionsSummary(month) {
    const txList = getTransactionsByMonth(month);
    const summary = {
        totalIncome: 0,
        totalExpense: 0,
        livingExpense: 0,
        savingExpense: 0,
        playingExpense: 0,
        emergencyExpense: 0,
        savingIncome: 0
    };

    txList.forEach(tx => {
        if (tx.type === 'income') {
            summary.totalIncome += tx.amount;
            if (tx.category === 'saving') {
                summary.savingIncome += tx.amount;
            }
        } else {
            summary.totalExpense += tx.amount;
            if (tx.category === 'living') summary.livingExpense += tx.amount;
            else if (tx.category === 'saving') summary.savingExpense += tx.amount;
            else if (tx.category === 'playing') summary.playingExpense += tx.amount;
            else if (tx.category === 'emergency') summary.emergencyExpense += tx.amount;
        }
    });

    return summary;
}

// ==================== UI NAVIGATION ====================
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('welcomeUser').textContent = `Hello, ${getCurrentUser()}!`;

    // Initialize year selectors
    initYearSelectors();

    // Set default date for transaction form
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];

    // Load initial data
    loadBudgetSettings();
}

// Ensure salary income exists for current month
function ensureMonthlySalary() {
    const currentMonth = getCurrentMonth();
    const transactions = getUserTransactions();
    const budget = getUserBudget();

    // Check if salary already exists for this month
    const hasSalaryThisMonth = transactions.some(tx =>
        tx.type === 'income' &&
        (tx.description === 'Monthly Salary' || tx.description === 'Gaji Bulanan') &&
        tx.date.startsWith(currentMonth)
    );

    if (!hasSalaryThisMonth) {
        const today = new Date().toISOString().split('T')[0];
        const salaryTx = {
            id: Date.now(),
            type: 'income',
            category: 'living',
            amount: budget.gaji,
            date: today,
            description: 'Monthly Salary',
            createdAt: new Date().toISOString()
        };
        transactions.push(salaryTx);
        saveUserTransactions(transactions);
    }
}

function switchPage(pageName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    document.getElementById(`${pageName}Section`).style.display = 'block';

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });

    // Refresh data based on page
    if (pageName === 'dashboard') updateDashboard();
    else if (pageName === 'transaksi') loadTransactionList();
    else if (pageName === 'tabungan') loadTabunganPage();
    else if (pageName === 'budget') loadBudgetSettings();
    else if (pageName === 'laporan') generateReport();
}

// ==================== DASHBOARD ====================
let expenseChart = null;
let trendChart = null;

function updateDashboard() {
    const month = document.getElementById('dashboardMonth').value || getCurrentMonth();
    const budget = getUserBudget();
    const amounts = calculateBudgetAmounts(budget);
    const summary = getTransactionsSummary(month);

    // Update stats with HTML format for alignment
    document.getElementById('totalIncome').innerHTML = formatRupiahHTML(summary.totalIncome);
    document.getElementById('totalExpense').innerHTML = formatRupiahHTML(summary.totalExpense);
    document.getElementById('totalBalance').innerHTML = formatRupiahHTML(summary.totalIncome - summary.totalExpense);

    // Update budget cards - Living
    document.getElementById('livingBudget').innerHTML = formatRupiahHTML(amounts.living);
    document.getElementById('livingUsed').innerHTML = formatRupiahHTML(summary.livingExpense);
    document.getElementById('livingRemain').innerHTML = formatRupiahHTML(Math.max(0, amounts.living - summary.livingExpense));
    const livingPercent = amounts.living > 0 ? Math.min(100, (summary.livingExpense / amounts.living) * 100) : 0;
    document.getElementById('livingProgress').style.width = `${livingPercent}%`;
    if (livingPercent > 100) document.getElementById('livingProgress').style.background = '#EF4444';

    // Update budget cards - Saving
    document.getElementById('savingBudget').innerHTML = formatRupiahHTML(amounts.saving);
    document.getElementById('savingUsed').innerHTML = formatRupiahHTML(summary.savingIncome);
    document.getElementById('savingRemain').innerHTML = formatRupiahHTML(Math.max(0, amounts.saving - summary.savingIncome));
    const savingPercent = amounts.saving > 0 ? Math.min(100, (summary.savingIncome / amounts.saving) * 100) : 0;
    document.getElementById('savingProgress').style.width = `${savingPercent}%`;

    // Update budget cards - Playing
    document.getElementById('playingBudget').innerHTML = formatRupiahHTML(amounts.playing);
    document.getElementById('playingUsed').innerHTML = formatRupiahHTML(summary.playingExpense);
    document.getElementById('playingRemain').innerHTML = formatRupiahHTML(Math.max(0, amounts.playing - summary.playingExpense));
    const playingPercent = amounts.playing > 0 ? Math.min(100, (summary.playingExpense / amounts.playing) * 100) : 0;
    document.getElementById('playingProgress').style.width = `${playingPercent}%`;
    if (playingPercent > 100) document.getElementById('playingProgress').style.background = '#EF4444';

    // Update budget cards - Emergency
    document.getElementById('emergencyBudget').innerHTML = formatRupiahHTML(amounts.emergency);
    document.getElementById('emergencyUsed').innerHTML = formatRupiahHTML(summary.emergencyExpense);
    document.getElementById('emergencyRemain').innerHTML = formatRupiahHTML(Math.max(0, amounts.emergency - summary.emergencyExpense));
    const emergencyPercent = amounts.emergency > 0 ? Math.min(100, (summary.emergencyExpense / amounts.emergency) * 100) : 0;
    document.getElementById('emergencyProgress').style.width = `${emergencyPercent}%`;

    // Update charts
    updateExpenseChart(summary);
    updateTrendChart();

    // Update recent transactions
    loadRecentTransactions();
}

// ==================== TABUNGAN PAGE ====================
let savingsLineChart = null;
let savingsBarChart = null;

function loadTabunganPage() {
    const transactions = getUserTransactions();

    // Group transactions by month
    const monthlyData = {};

    transactions.forEach(tx => {
        const month = tx.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expense: 0 };
        }
        if (tx.type === 'income') {
            monthlyData[month].income += tx.amount;
        } else {
            monthlyData[month].expense += tx.amount;
        }
    });

    // Sort months chronologically
    const months = Object.keys(monthlyData).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let totalAccumulated = 0;
    const chartLabels = [];
    const accumulatedData = [];
    const monthlyBalances = [];
    const historyItems = [];

    months.forEach(month => {
        const data = monthlyData[month];
        const balance = data.income - data.expense;
        totalAccumulated += balance;

        const [year, monthNum] = month.split('-');
        const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

        chartLabels.push(monthLabel);
        accumulatedData.push(totalAccumulated);
        monthlyBalances.push(balance);

        historyItems.unshift({
            label: monthLabel,
            income: data.income,
            expense: data.expense,
            balance: balance
        });
    });

    // Update total accumulated savings
    document.getElementById('accumulatedSavings').textContent = formatRupiah(totalAccumulated);

    // Update Line Chart (Accumulated Savings)
    const lineCtx = document.getElementById('savingsLineChart').getContext('2d');
    if (savingsLineChart) savingsLineChart.destroy();

    savingsLineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Total Savings',
                data: accumulatedData,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#10B981',
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => 'Rp ' + (value / 1000000).toFixed(1) + 'jt'
                    }
                }
            }
        }
    });

    // Update Bar Chart (Monthly Balances)
    const barCtx = document.getElementById('savingsBarChart').getContext('2d');
    if (savingsBarChart) savingsBarChart.destroy();

    savingsBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Balance',
                data: monthlyBalances,
                backgroundColor: monthlyBalances.map(v => v >= 0 ? '#10B981' : '#EF4444'),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    ticks: {
                        callback: value => 'Rp ' + (value / 1000000).toFixed(1) + 'jt'
                    }
                }
            }
        }
    });

    // Update History Table
    const historyContainer = document.getElementById('savingsHistoryList');
    if (historyItems.length === 0) {
        historyContainer.innerHTML = '<p class="no-history">No transaction data yet</p>';
    } else {
        historyContainer.innerHTML = historyItems.map(item => `
            <div class="history-row">
                <span class="month-name">${item.label}</span>
                <span class="income">+${formatRupiah(item.income)}</span>
                <span class="expense">-${formatRupiah(item.expense)}</span>
                <span class="balance ${item.balance >= 0 ? 'positive' : 'negative'}">
                    ${item.balance >= 0 ? '+' : ''}${formatRupiah(item.balance)}
                </span>
            </div>
        `).join('');
    }
}

function updateExpenseChart(summary) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Living', 'Saving', 'Playing', 'Emergency'],
            datasets: [{
                data: [summary.livingExpense, summary.savingExpense, summary.playingExpense, summary.emergencyExpense],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const transactions = getUserTransactions();

    // Get last 6 months
    const months = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthKey);

        const monthTx = transactions.filter(t => t.date.startsWith(monthKey));
        const income = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        incomeData.push(income);
        expenseData.push(expense);
    }

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [y, mo] = m.split('-');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return monthNames[parseInt(mo) - 1];
            }),
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expense',
                    data: expenseData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatRupiah(value)
                    }
                }
            }
        }
    });
}

function loadRecentTransactions() {
    const transactions = getUserTransactions().slice(-5).reverse();
    const container = document.getElementById('recentList');

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📝</div>
                <p>No transactions yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => createTransactionHTML(tx)).join('');
}

// ==================== TRANSACTION LIST ====================
function loadTransactionList() {
    const month = document.getElementById('filterMonth').value || getCurrentMonth();
    const typeFilter = document.getElementById('filterType').value;
    const categoryFilter = document.getElementById('filterCategory').value;

    let transactions = getTransactionsByMonth(month);

    if (typeFilter !== 'all') {
        transactions = transactions.filter(t => t.type === typeFilter);
    }
    if (categoryFilter !== 'all') {
        transactions = transactions.filter(t => t.category === categoryFilter);
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const container = document.getElementById('transactionList');

    if (transactions.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="empty-table">
                    <div class="empty-state">
                        <div class="icon">📝</div>
                        <p>No transactions found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => createTransactionTableRow(tx)).join('');
}

function getCategoryLabel(category) {
    const labels = {
        // Expense categories
        living: 'Living',
        saving: 'Saving',
        playing: 'Playing',
        emergency: 'Emergency',
        // Income categories
        salary: 'Salary',
        bonus: 'Bonus',
        thr: 'THR',
        freelance: 'Freelance',
        investment: 'Investment',
        other: 'Other'
    };
    return labels[category] || category;
}

function createTransactionHTML(tx, showActions = false) {
    const icons = {
        // Expense icons
        living: '🏠',
        saving: '💎',
        playing: '✈️',
        emergency: '🚨',
        // Income icons
        salary: '💰',
        bonus: '🎁',
        thr: '🎊',
        freelance: '💼',
        investment: '📈',
        other: '💵'
    };

    const icon = icons[tx.category] || '💵';
    const iconClass = tx.type === 'income' ? 'income' : tx.category;
    const amountClass = tx.type === 'income' ? 'income' : 'expense';
    const amountPrefix = tx.type === 'income' ? '+' : '-';
    const categoryLabel = getCategoryLabel(tx.category);

    const actionsHTML = showActions ? `
        <div class="tx-actions">
            <button class="btn-delete" onclick="handleDeleteTransaction(${tx.id})">Delete</button>
        </div>
    ` : '';

    return `
        <div class="transaction-item">
            <div class="tx-info">
                <div class="tx-icon ${iconClass}">${icon}</div>
                <div class="tx-details">
                    <h4>${tx.description || categoryLabel}</h4>
                    <p>${tx.date} • ${categoryLabel}</p>
                </div>
            </div>
            <div class="tx-amount ${amountClass}">${amountPrefix}${formatRupiah(tx.amount)}</div>
            ${actionsHTML}
        </div>
    `;
}

function handleDeleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        deleteTransaction(id);
        loadTransactionList();
        updateDashboard();
    }
}

// Create table row for transaction list
function createTransactionTableRow(tx) {
    const categoryLabel = getCategoryLabel(tx.category);
    const amountClass = tx.type === 'income' ? 'income' : 'expense';
    const amountPrefix = tx.type === 'income' ? '+' : '-';

    return `
        <tr>
            <td>${tx.date}</td>
            <td>${tx.description || categoryLabel}</td>
            <td><span class="category-badge ${tx.category}">${categoryLabel}</span></td>
            <td class="amount ${amountClass}">${amountPrefix}${formatRupiah(tx.amount)}</td>
            <td class="actions">
                <button class="btn-edit" onclick="openEditModal(${tx.id})">Edit</button>
                <button class="btn-delete" onclick="handleDeleteTransaction(${tx.id})">Delete</button>
            </td>
        </tr>
    `;
}

// ==================== EDIT TRANSACTION ====================
function openEditModal(id) {
    const transactions = getUserTransactions();
    const tx = transactions.find(t => t.id === id);

    if (!tx) return;

    document.getElementById('editTxId').value = tx.id;
    document.getElementById('editTxType').value = tx.type;
    updateEditCategoryOptions();
    document.getElementById('editTxCategory').value = tx.category;
    document.getElementById('editTxAmount').value = tx.amount;
    document.getElementById('editTxDate').value = tx.date;
    document.getElementById('editTxDescription').value = tx.description || '';

    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('editTransactionForm').reset();
}

function updateEditCategoryOptions() {
    const type = document.getElementById('editTxType').value;
    const categorySelect = document.getElementById('editTxCategory');

    if (type === 'income') {
        categorySelect.innerHTML = `
            <option value="salary">Salary</option>
            <option value="bonus">Bonus</option>
            <option value="thr">THR</option>
            <option value="freelance">Freelance</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
        `;
    } else {
        categorySelect.innerHTML = `
            <option value="living">Living</option>
            <option value="saving">Saving</option>
            <option value="playing">Playing</option>
            <option value="emergency">Emergency</option>
        `;
    }
}

function saveEditedTransaction(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('editTxId').value);
    const transactions = getUserTransactions();
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) return;

    transactions[index] = {
        ...transactions[index],
        type: document.getElementById('editTxType').value,
        category: document.getElementById('editTxCategory').value,
        amount: parseInt(document.getElementById('editTxAmount').value),
        date: document.getElementById('editTxDate').value,
        description: document.getElementById('editTxDescription').value
    };

    saveUserTransactions(transactions);
    closeEditModal();
    loadTransactionList();
    updateDashboard();
    showToast('Transaction updated successfully!');
}

// ==================== BUDGET SETTINGS ====================
function loadBudgetSettings() {
    const budget = getUserBudget();
    const gaji = budget.gaji || 0;

    document.getElementById('gajiInput').value = gaji;

    // Check if amounts are saved (new format) or use percentages (old format)
    if (budget.livingAmt !== undefined) {
        // Load EXACT saved amounts - these won't change!
        document.getElementById('livingAmountInput').value = budget.livingAmt;
        document.getElementById('savingAmountInput').value = budget.savingAmt;
        document.getElementById('playingAmountInput').value = budget.playingAmt;
        document.getElementById('emergencyAmountInput').value = budget.emergencyAmt;

        // Calculate percentages for display only (sliders are disabled)
        const livingPct = gaji > 0 ? Math.round((budget.livingAmt / gaji) * 100) : 0;
        const savingPct = gaji > 0 ? Math.round((budget.savingAmt / gaji) * 100) : 0;
        const playingPct = gaji > 0 ? Math.round((budget.playingAmt / gaji) * 100) : 0;
        const emergencyPct = gaji > 0 ? Math.round((budget.emergencyAmt / gaji) * 100) : 0;

        document.getElementById('livingPercent').value = livingPct;
        document.getElementById('savingPercent').value = savingPct;
        document.getElementById('playingPercent').value = playingPct;
        document.getElementById('emergencyPercent').value = emergencyPct;

        document.getElementById('livingPercentValue').textContent = `${livingPct}%`;
        document.getElementById('savingPercentValue').textContent = `${savingPct}%`;
        document.getElementById('playingPercentValue').textContent = `${playingPct}%`;
        document.getElementById('emergencyPercentValue').textContent = `${emergencyPct}%`;

        // Calculate total from actual saved amounts
        const totalAmt = budget.livingAmt + budget.savingAmt + budget.playingAmt + budget.emergencyAmt;
        const totalPct = gaji > 0 ? Math.round((totalAmt / gaji) * 100) : 0;
        document.getElementById('totalPercent').textContent = `${totalPct}%`;
        document.getElementById('percentWarning').style.display = totalPct !== 100 ? 'inline' : 'none';
    } else {
        // Load from percentages (old format) - one time conversion
        const living = budget.living || 50;
        const saving = budget.saving || 30;
        const playing = budget.playing || 10;
        const emergency = budget.emergency || 10;

        document.getElementById('livingPercent').value = living;
        document.getElementById('savingPercent').value = saving;
        document.getElementById('playingPercent').value = playing;
        document.getElementById('emergencyPercent').value = emergency;

        document.getElementById('livingPercentValue').textContent = `${living}%`;
        document.getElementById('savingPercentValue').textContent = `${saving}%`;
        document.getElementById('playingPercentValue').textContent = `${playing}%`;
        document.getElementById('emergencyPercentValue').textContent = `${emergency}%`;

        document.getElementById('livingAmountInput').value = Math.round(gaji * living / 100);
        document.getElementById('savingAmountInput').value = Math.round(gaji * saving / 100);
        document.getElementById('playingAmountInput').value = Math.round(gaji * playing / 100);
        document.getElementById('emergencyAmountInput').value = Math.round(gaji * emergency / 100);

        const total = living + saving + playing + emergency;
        document.getElementById('totalPercent').textContent = `${total}%`;
        document.getElementById('percentWarning').style.display = total !== 100 ? 'inline' : 'none';
    }
}

function updateBudgetDisplay(autoSave = true, fromSlider = true) {
    const gaji = parseInt(document.getElementById('gajiInput').value) || 0;
    const living = parseInt(document.getElementById('livingPercent').value) || 0;
    const saving = parseInt(document.getElementById('savingPercent').value) || 0;
    const playing = parseInt(document.getElementById('playingPercent').value) || 0;
    const emergency = parseInt(document.getElementById('emergencyPercent').value) || 0;

    // Update percentage displays
    document.getElementById('livingPercentValue').textContent = `${living}%`;
    document.getElementById('savingPercentValue').textContent = `${saving}%`;
    document.getElementById('playingPercentValue').textContent = `${playing}%`;
    document.getElementById('emergencyPercentValue').textContent = `${emergency}%`;

    // Only update amount inputs if change came from slider (not from amount input)
    if (fromSlider) {
        const livingAmt = Math.round(gaji * living / 100);
        const savingAmt = Math.round(gaji * saving / 100);
        const playingAmt = Math.round(gaji * playing / 100);
        const emergencyAmt = Math.round(gaji * emergency / 100);

        document.getElementById('livingAmountInput').value = livingAmt;
        document.getElementById('savingAmountInput').value = savingAmt;
        document.getElementById('playingAmountInput').value = playingAmt;
        document.getElementById('emergencyAmountInput').value = emergencyAmt;

        // Auto-save with calculated amounts
        if (autoSave && gaji > 0) {
            const budget = {
                gaji,
                livingAmt,
                savingAmt,
                playingAmt,
                emergencyAmt,
                living,
                saving,
                playing,
                emergency
            };
            saveUserBudget(budget);
        }
    }

    const total = living + saving + playing + emergency;
    document.getElementById('totalPercent').textContent = `${total}%`;
    document.getElementById('percentWarning').style.display = total !== 100 ? 'inline' : 'none';
}


// Update total percentage and save budget
function updateTotalAndSave() {
    const gaji = parseInt(document.getElementById('gajiInput').value) || 0;

    const livingAmt = parseInt(document.getElementById('livingAmountInput').value) || 0;
    const savingAmt = parseInt(document.getElementById('savingAmountInput').value) || 0;
    const playingAmt = parseInt(document.getElementById('playingAmountInput').value) || 0;
    const emergencyAmt = parseInt(document.getElementById('emergencyAmountInput').value) || 0;

    const totalAmt = livingAmt + savingAmt + playingAmt + emergencyAmt;
    const totalPct = gaji > 0 ? Math.round((totalAmt / gaji) * 100) : 0;

    document.getElementById('totalPercent').textContent = `${totalPct}%`;
    document.getElementById('percentWarning').style.display = totalPct !== 100 ? 'inline' : 'none';

    // Save budget
    if (gaji > 0) {
        const budget = {
            gaji,
            livingAmt,
            savingAmt,
            playingAmt,
            emergencyAmt,
            living: parseInt(document.getElementById('livingPercent').value) || 0,
            saving: parseInt(document.getElementById('savingPercent').value) || 0,
            playing: parseInt(document.getElementById('playingPercent').value) || 0,
            emergency: parseInt(document.getElementById('emergencyPercent').value) || 0
        };
        saveUserBudget(budget);
    }
}

// Sync amount input to slider (calculate percentage from amount)
function syncPercentFromAmount(category) {
    const gaji = parseInt(document.getElementById('gajiInput').value) || 0;
    if (gaji <= 0) return;

    // Get this category's amount and calculate percentage
    const amount = parseInt(document.getElementById(`${category}AmountInput`).value) || 0;
    const percent = Math.round((amount / gaji) * 100);

    // Update only this category's slider and percentage display
    document.getElementById(`${category}Percent`).value = percent;
    document.getElementById(`${category}PercentValue`).textContent = `${percent}%`;

    // Update total and save
    updateTotalAndSave();
}

// ==================== REPORTS ====================
let reportPieChart = null;

function generateReport() {
    const month = document.getElementById('reportMonth').value || getCurrentMonth();
    const summary = getTransactionsSummary(month);

    document.getElementById('reportIncome').textContent = formatRupiah(summary.totalIncome);
    document.getElementById('reportExpense').textContent = formatRupiah(summary.totalExpense);

    const diff = summary.totalIncome - summary.totalExpense;
    document.getElementById('reportDiff').textContent = formatRupiah(diff);
    document.getElementById('reportDiff').style.color = diff >= 0 ? '#10B981' : '#EF4444';

    // Update pie chart
    const ctx = document.getElementById('reportPieChart').getContext('2d');
    if (reportPieChart) reportPieChart.destroy();

    reportPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Living', 'Saving', 'Playing', 'Emergency'],
            datasets: [{
                data: [summary.livingExpense, summary.savingExpense, summary.playingExpense, summary.emergencyExpense],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Update breakdown
    const breakdown = document.getElementById('categoryBreakdown');
    breakdown.innerHTML = `
        <div class="breakdown-item">
            <span>🏠 Living</span>
            <strong>${formatRupiah(summary.livingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>💎 Saving</span>
            <strong>${formatRupiah(summary.savingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>✈️ Playing</span>
            <strong>${formatRupiah(summary.playingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>🚨 Emergency</span>
            <strong>${formatRupiah(summary.emergencyExpense)}</strong>
        </div>
    `;

    // Generate financial analysis
    generateFinancialAnalysis(summary);
}

// ==================== FINANCIAL ANALYSIS ====================
function generateFinancialAnalysis(summary) {
    const budget = getUserBudget();
    const amounts = calculateBudgetAmounts(budget);

    // Calculate ratios
    const totalIncome = summary.totalIncome || budget.gaji;
    const savingRatio = totalIncome > 0 ? (summary.savingIncome / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (summary.totalExpense / totalIncome) * 100 : 0;
    const budgetRemaining = totalIncome - summary.totalExpense;

    // Calculate health score
    const healthScore = calculateHealthScore(summary, budget, amounts);

    // Update UI
    document.getElementById('healthScore').textContent = healthScore.score;
    document.getElementById('healthStatus').textContent = healthScore.status;
    document.getElementById('savingRatio').textContent = savingRatio.toFixed(1) + '%';
    document.getElementById('expenseRatio').textContent = expenseRatio.toFixed(1) + '%';
    document.getElementById('budgetRemaining').textContent = formatRupiah(budgetRemaining);

    // Generate category analysis
    generateCategoryAnalysis(summary, amounts);

    // Generate suggestions
    generateSuggestions(summary, budget, amounts);

    // Generate tips
    generateTips(summary, budget);
}

function calculateHealthScore(summary, budget, amounts) {
    let score = 100;
    let issues = [];

    const totalIncome = summary.totalIncome || budget.gaji;

    // 1. Pengeluaran melebihi pemasukan (-30 poin)
    if (summary.totalExpense > totalIncome) {
        score -= 30;
        issues.push('deficit');
    }

    // 2. Living expense melebihi budget (-15 poin)
    if (summary.livingExpense > amounts.living) {
        score -= 15;
        issues.push('living_over');
    }

    // 3. Playing expense melebihi budget (-10 poin)
    if (summary.playingExpense > amounts.playing) {
        score -= 10;
        issues.push('playing_over');
    }

    // 4. Emergency digunakan (tidak buruk, tapi perlu perhatian) (-5 poin)
    if (summary.emergencyExpense > 0) {
        score -= 5;
        issues.push('emergency_used');
    }

    // 5. Tidak menabung sama sekali (-20 poin)
    if (summary.savingIncome === 0 && totalIncome > 0) {
        score -= 20;
        issues.push('no_saving');
    } else if (summary.savingIncome < amounts.saving * 0.5) {
        // Menabung kurang dari 50% target (-10 poin)
        score -= 10;
        issues.push('low_saving');
    }

    // 6. Bonus: Menabung lebih dari target (+5 poin)
    if (summary.savingIncome > amounts.saving) {
        score += 5;
    }

    // 7. Bonus: Pengeluaran di bawah 80% budget (+5 poin)
    if (summary.totalExpense < totalIncome * 0.8) {
        score += 5;
    }

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status;
    if (score >= 80) status = 'Excellent! 🌟';
    else if (score >= 60) status = 'Good 👍';
    else if (score >= 40) status = 'Needs Attention ⚠️';
    else status = 'Needs Improvement 🚨';

    return { score, status, issues };
}

function generateCategoryAnalysis(summary, amounts) {
    const categories = [
        {
            key: 'living',
            name: 'Living',
            icon: '🏠',
            budget: amounts.living,
            used: summary.livingExpense,
            desc: 'Essential Needs'
        },
        {
            key: 'saving',
            name: 'Saving',
            icon: '💎',
            budget: amounts.saving,
            used: summary.savingIncome,
            desc: 'Savings',
            isIncome: true
        },
        {
            key: 'playing',
            name: 'Playing',
            icon: '✈️',
            budget: amounts.playing,
            used: summary.playingExpense,
            desc: 'Lifestyle & Travel'
        },
        {
            key: 'emergency',
            name: 'Emergency',
            icon: '🚨',
            budget: amounts.emergency,
            used: summary.emergencyExpense,
            desc: 'Emergency Fund'
        }
    ];

    const container = document.getElementById('categoryAnalysis');
    container.innerHTML = categories.map(cat => {
        const percentage = cat.budget > 0 ? (cat.used / cat.budget) * 100 : 0;
        let statusClass, statusText;

        if (cat.isIncome) {
            // For saving, higher is better
            if (percentage >= 100) {
                statusClass = 'good';
                statusText = 'Target Reached!';
            } else if (percentage >= 50) {
                statusClass = 'warning';
                statusText = `${percentage.toFixed(0)}% of target`;
            } else {
                statusClass = 'danger';
                statusText = `Only ${percentage.toFixed(0)}%`;
            }
        } else {
            // For expenses, lower is better
            if (percentage <= 80) {
                statusClass = 'good';
                statusText = 'Safe';
            } else if (percentage <= 100) {
                statusClass = 'warning';
                statusText = `${percentage.toFixed(0)}% used`;
            } else {
                statusClass = 'danger';
                statusText = `Over ${(percentage - 100).toFixed(0)}%!`;
            }
        }

        return `
            <div class="category-analysis-item">
                <div class="category-info">
                    <div class="category-icon ${cat.key}">${cat.icon}</div>
                    <div class="category-details">
                        <h5>${cat.name}</h5>
                        <p>${cat.desc} • Budget: ${formatRupiah(cat.budget)}</p>
                    </div>
                </div>
                <div class="category-status">
                    <span class="amount">${formatRupiah(cat.used)}</span>
                    <span class="percentage ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    }).join('');
}

function generateSuggestions(summary, budget, amounts) {
    const suggestions = [];
    const totalIncome = summary.totalIncome || budget.gaji;

    // 1. Check deficit
    if (summary.totalExpense > totalIncome) {
        suggestions.push({
            type: 'danger',
            icon: '🚨',
            title: 'Expenses Exceed Income!',
            text: `You have a deficit of ${formatRupiah(summary.totalExpense - totalIncome)}. Review your expenses and cut unnecessary spending.`
        });
    }

    // 2. Check Living expense
    if (summary.livingExpense > amounts.living) {
        const over = summary.livingExpense - amounts.living;
        suggestions.push({
            type: 'warning',
            icon: '🏠',
            title: 'Living Budget Exceeded',
            text: `Living expenses exceeded budget by ${formatRupiah(over)}. Try to track spending details and find areas to reduce.`
        });
    } else if (summary.livingExpense < amounts.living * 0.5 && summary.livingExpense > 0) {
        suggestions.push({
            type: 'success',
            icon: '✨',
            title: 'Saving on Living Expenses',
            text: `Great! You only used ${((summary.livingExpense / amounts.living) * 100).toFixed(0)}% of your living budget. The remainder can go to savings.`
        });
    }

    // 3. Check Playing expense
    if (summary.playingExpense > amounts.playing) {
        suggestions.push({
            type: 'warning',
            icon: '✈️',
            title: 'Lifestyle Budget Exceeded',
            text: `Lifestyle & travel expenses exceeded budget. Try to limit leisure spending and focus on essentials.`
        });
    }

    // 4. Check Saving
    if (summary.savingIncome === 0 && totalIncome > 0) {
        suggestions.push({
            type: 'danger',
            icon: '💎',
            title: 'No Savings This Month',
            text: `You haven't saved anything this month. Savings target: ${formatRupiah(amounts.saving)}. Try to set aside at least 10-20% of income.`
        });
    } else if (summary.savingIncome < amounts.saving && summary.savingIncome > 0) {
        const remaining = amounts.saving - summary.savingIncome;
        suggestions.push({
            type: 'warning',
            icon: '💎',
            title: 'Savings Below Target',
            text: `You saved ${formatRupiah(summary.savingIncome)}, but still ${formatRupiah(remaining)} short of the target.`
        });
    } else if (summary.savingIncome >= amounts.saving) {
        suggestions.push({
            type: 'success',
            icon: '🎉',
            title: 'Savings Target Reached!',
            text: `Congratulations! You saved ${formatRupiah(summary.savingIncome)} this month. Keep up the good habit!`
        });
    }

    // 5. Check Emergency usage
    if (summary.emergencyExpense > 0) {
        suggestions.push({
            type: 'warning',
            icon: '🚨',
            title: 'Emergency Fund Used',
            text: `You used ${formatRupiah(summary.emergencyExpense)} from emergency fund. Make sure to replenish it next month.`
        });
    }

    // 6. If no issues
    if (suggestions.length === 0) {
        suggestions.push({
            type: 'success',
            icon: '🌟',
            title: 'Your Finances are Healthy!',
            text: 'No issues to address. Keep up the good financial management!'
        });
    }

    const container = document.getElementById('financialSuggestions');
    container.innerHTML = suggestions.map(s => `
        <div class="suggestion-item ${s.type}">
            <div class="suggestion-icon">${s.icon}</div>
            <div class="suggestion-content">
                <h5>${s.title}</h5>
                <p>${s.text}</p>
            </div>
        </div>
    `).join('');
}

function generateTips(summary, budget) {
    const tips = [
        {
            icon: '💡',
            text: 'Use the 50/30/10/10 method: 50% living, 30% saving, 10% lifestyle, 10% emergency.'
        },
        {
            icon: '📝',
            text: 'Track every expense, no matter how small. This helps you understand where your money goes.'
        },
        {
            icon: '🎯',
            text: 'Set specific savings goals (e.g., emergency fund = 6x monthly expenses).'
        },
        {
            icon: '🛒',
            text: 'Make a shopping list before going to the store and stick to it.'
        },
        {
            icon: '📅',
            text: 'Review your finances weekly to stay on budget.'
        }
    ];

    // Add contextual tips based on data
    if (summary.playingExpense > summary.savingIncome) {
        tips.unshift({
            icon: '⚠️',
            text: 'Lifestyle spending is higher than savings. Try to swap priorities!'
        });
    }

    if (summary.emergencyExpense > 0) {
        tips.unshift({
            icon: '🔄',
            text: 'After using emergency funds, prioritize replenishing them.'
        });
    }

    const container = document.getElementById('financialTips');
    container.innerHTML = tips.slice(0, 5).map(t => `
        <div class="tip-item">
            <span class="tip-icon">${t.icon}</span>
            <p>${t.text}</p>
        </div>
    `).join('');
}

function exportCSV() {
    const month = document.getElementById('reportMonth').value || getCurrentMonth();
    const transactions = getTransactionsByMonth(month);

    if (transactions.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
    const rows = transactions.map(tx => [
        tx.date,
        tx.type === 'income' ? 'Income' : 'Expense',
        getCategoryLabel(tx.category),
        tx.amount,
        tx.description || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadFile(`keuangan_${month}.csv`, csv, 'text/csv');
    showToast('CSV file downloaded successfully!');
}

// ==================== DATA MANAGEMENT ====================
function exportAllData() {
    const username = getCurrentUser();
    const data = {
        budget: getUserBudget(),
        transactions: getUserTransactions(),
        exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    downloadFile(`keuangan_backup_${username}.json`, json, 'application/json');
    showToast('Data exported successfully!');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.budget) {
                saveUserBudget(data.budget);
            }
            if (data.transactions) {
                saveUserTransactions(data.transactions);
            }

            showToast('Data imported successfully!');
            loadBudgetSettings();
            updateDashboard();
            loadTransactionList();
        } catch (error) {
            showToast('Invalid file format!', 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('WARNING: All data will be permanently deleted. Continue?')) {
        const username = getCurrentUser();

        const budgets = getStorage(STORAGE_KEYS.BUDGET) || {};
        // Reset with both amounts AND percentages to prevent conversion issues
        budgets[username] = {
            gaji: 6000000,
            livingAmt: 3000000,
            savingAmt: 1800000,
            playingAmt: 600000,
            emergencyAmt: 600000,
            living: 50,
            saving: 30,
            playing: 10,
            emergency: 10
        };
        setStorage(STORAGE_KEYS.BUDGET, budgets);

        const transactions = getStorage(STORAGE_KEYS.TRANSACTIONS) || {};
        transactions[username] = [];
        setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);

        showToast('All data deleted successfully!');
        loadBudgetSettings();
        updateDashboard();
        loadTransactionList();
    }
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async function() {
    // Check if already logged in
    if (getCurrentUser()) {
        await loadUserDataFromCloud();
        showMainApp();
    } else {
        showLoginPage();
    }

    // Login form
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const success = await loginUser(username, password);
        if (success) {
            showMainApp();
        }
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm').value;
        const gaji = parseInt(document.getElementById('regGaji').value);

        if (password !== confirm) {
            showToast('Passwords do not match!', 'error');
            return;
        }

        const success = await registerUser(username, password, gaji);
        if (success) {
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        }
    });

    // Toggle login/register
    document.getElementById('showRegister').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });

    document.getElementById('showLogin').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logoutUser);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            switchPage(this.dataset.page);
        });
    });

    // Transaction form
    document.getElementById('transactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const tx = {
            type: document.getElementById('txType').value,
            category: document.getElementById('txCategory').value,
            amount: parseInt(document.getElementById('txAmount').value),
            date: document.getElementById('txDate').value,
            description: document.getElementById('txDescription').value
        };
        addTransaction(tx);
        this.reset();
        document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
        loadTransactionList();
        updateDashboard();
    });

    // Transaction filters
    document.getElementById('filterType').addEventListener('change', loadTransactionList);
    document.getElementById('filterCategory').addEventListener('change', loadTransactionList);

    // Budget settings - ONLY amount inputs (sliders are display-only)
    document.getElementById('livingAmountInput').addEventListener('input', () => syncPercentFromAmount('living'));
    document.getElementById('savingAmountInput').addEventListener('input', () => syncPercentFromAmount('saving'));
    document.getElementById('playingAmountInput').addEventListener('input', () => syncPercentFromAmount('playing'));
    document.getElementById('emergencyAmountInput').addEventListener('input', () => syncPercentFromAmount('emergency'));

    document.getElementById('updateGaji').addEventListener('click', function() {
        const budget = getUserBudget();
        const newGaji = parseInt(document.getElementById('gajiInput').value) || 0;

        // Update gaji but KEEP existing amounts unchanged!
        budget.gaji = newGaji;

        // If amounts exist, keep them. Only recalculate percentages for display.
        if (budget.livingAmt !== undefined) {
            // Don't change amounts - just update the percentage displays
            const livingPct = newGaji > 0 ? Math.round((budget.livingAmt / newGaji) * 100) : 0;
            const savingPct = newGaji > 0 ? Math.round((budget.savingAmt / newGaji) * 100) : 0;
            const playingPct = newGaji > 0 ? Math.round((budget.playingAmt / newGaji) * 100) : 0;
            const emergencyPct = newGaji > 0 ? Math.round((budget.emergencyAmt / newGaji) * 100) : 0;

            budget.living = livingPct;
            budget.saving = savingPct;
            budget.playing = playingPct;
            budget.emergency = emergencyPct;
        }

        saveUserBudget(budget);
        loadBudgetSettings(); // Reload to update display
        showToast('Salary updated successfully!');
    });

    document.getElementById('saveBudget').addEventListener('click', function() {
        const gaji = parseInt(document.getElementById('gajiInput').value) || 0;

        // Get EXACT amounts from input fields - these are the source of truth!
        const livingAmt = parseInt(document.getElementById('livingAmountInput').value) || 0;
        const savingAmt = parseInt(document.getElementById('savingAmountInput').value) || 0;
        const playingAmt = parseInt(document.getElementById('playingAmountInput').value) || 0;
        const emergencyAmt = parseInt(document.getElementById('emergencyAmountInput').value) || 0;

        // Get percentages for display purposes only
        const living = parseInt(document.getElementById('livingPercent').value) || 0;
        const saving = parseInt(document.getElementById('savingPercent').value) || 0;
        const playing = parseInt(document.getElementById('playingPercent').value) || 0;
        const emergency = parseInt(document.getElementById('emergencyPercent').value) || 0;

        // Save both amounts AND percentages
        const budget = {
            gaji,
            // AMOUNTS - these are the source of truth!
            livingAmt,
            savingAmt,
            playingAmt,
            emergencyAmt,
            // Percentages for display only
            living,
            saving,
            playing,
            emergency
        };
        saveUserBudget(budget);
        showToast('Budget saved successfully!');
        updateDashboard();
    });

    // Reports
    document.getElementById('generateReport').addEventListener('click', generateReport);
    document.getElementById('exportCSV').addEventListener('click', exportCSV);

    // Settings
    document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const oldPass = document.getElementById('oldPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmNewPassword').value;

        if (newPass !== confirmPass) {
            showToast('New passwords do not match!', 'error');
            return;
        }

        if (changePassword(oldPass, newPass)) {
            this.reset();
        }
    });

    document.getElementById('exportData').addEventListener('click', exportAllData);

    document.getElementById('importData').addEventListener('click', function() {
        const file = document.getElementById('importFile').files[0];
        if (!file) {
            showToast('Please select a file first!', 'warning');
            return;
        }
        importData(file);
    });

    document.getElementById('clearData').addEventListener('click', clearAllData);

    // Quick Income Form
    document.getElementById('quickIncomeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const amount = parseInt(document.getElementById('quickIncomeAmount').value);
        const description = document.getElementById('quickIncomeDesc').value || 'Additional Income';
        const date = document.getElementById('quickIncomeDate').value;

        const tx = {
            type: 'income',
            category: 'living',
            amount: amount,
            date: date,
            description: description
        };

        addTransaction(tx);
        closeIncomeModal();
        this.reset();
        updateDashboard();
        loadTransactionList();
    });

    // Edit transaction form
    document.getElementById('editTransactionForm').addEventListener('submit', saveEditedTransaction);

    // Close edit modal when clicking outside
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });
});

// ==================== YEAR FILTER FUNCTIONS ====================
function initYearSelectors() {
    const currentYear = new Date().getFullYear();
    const years = [];
    // Start from current year going forward
    for (let y = currentYear; y <= currentYear + 10; y++) {
        years.push(y);
    }

    const yearSelectors = ['dashboardYear', 'filterYear', 'reportYear'];
    yearSelectors.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = years.map(y =>
                `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
            ).join('');
        }
    });

    // Set current month
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const monthSelectors = ['dashboardMonthSelect', 'filterMonthSelect', 'reportMonthSelect'];
    monthSelectors.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.value = currentMonth;
        }
    });

    // Initialize hidden inputs
    updateDashboardMonth();
    updateFilterMonth();
    updateReportMonth();
}

function updateDashboardMonth() {
    const year = document.getElementById('dashboardYear').value;
    const month = document.getElementById('dashboardMonthSelect').value;
    document.getElementById('dashboardMonth').value = `${year}-${month}`;
    updateDashboard();
}

function updateFilterMonth() {
    const year = document.getElementById('filterYear').value;
    const month = document.getElementById('filterMonthSelect').value;
    document.getElementById('filterMonth').value = `${year}-${month}`;
    loadTransactionList();
}

function updateReportMonth() {
    const year = document.getElementById('reportYear').value;
    const month = document.getElementById('reportMonthSelect').value;
    document.getElementById('reportMonth').value = `${year}-${month}`;
}

// ==================== DYNAMIC CATEGORY OPTIONS ====================
function updateCategoryOptions() {
    const type = document.getElementById('txType').value;
    const categorySelect = document.getElementById('txCategory');

    if (type === 'income') {
        categorySelect.innerHTML = `
            <option value="salary">Salary</option>
            <option value="bonus">Bonus</option>
            <option value="thr">THR</option>
            <option value="freelance">Freelance</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
        `;
    } else {
        categorySelect.innerHTML = `
            <option value="living">Living</option>
            <option value="saving">Saving</option>
            <option value="playing">Playing</option>
            <option value="emergency">Emergency</option>
        `;
    }
}

// ==================== QUICK INCOME MODAL ====================
function showQuickIncome() {
    document.getElementById('quickIncomeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('incomeModal').classList.add('show');
}

function closeIncomeModal() {
    document.getElementById('incomeModal').classList.remove('show');
    document.getElementById('quickIncomeForm').reset();
}
