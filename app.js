// ==================== KEUANGAN KELUARGA APP ====================
// LocalStorage Keys
const STORAGE_KEYS = {
    USERS: 'keuangan_users',
    CURRENT_USER: 'keuangan_current_user',
    TRANSACTIONS: 'keuangan_transactions',
    BUDGET: 'keuangan_budget'
};

// ==================== UTILITY FUNCTIONS ====================
function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
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
function getUsers() {
    return getStorage(STORAGE_KEYS.USERS) || {};
}

function getCurrentUser() {
    return getStorage(STORAGE_KEYS.CURRENT_USER);
}

function setCurrentUser(username) {
    setStorage(STORAGE_KEYS.CURRENT_USER, username);
}

function registerUser(username, password, gaji) {
    const users = getUsers();
    if (users[username]) {
        showToast('Username sudah digunakan!', 'error');
        return false;
    }
    users[username] = {
        password: btoa(password), // Simple encoding (not secure for production)
        gaji: gaji,
        createdAt: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.USERS, users);

    // Initialize budget for new user
    const budgets = getStorage(STORAGE_KEYS.BUDGET) || {};
    budgets[username] = {
        gaji: gaji,
        living: 50,
        saving: 30,
        playing: 10,
        emergency: 10
    };
    setStorage(STORAGE_KEYS.BUDGET, budgets);

    // Initialize transactions with salary as first income
    const transactions = getStorage(STORAGE_KEYS.TRANSACTIONS) || {};
    const today = new Date().toISOString().split('T')[0];
    transactions[username] = [{
        id: Date.now(),
        type: 'income',
        category: 'living',
        amount: gaji,
        date: today,
        description: 'Gaji Bulanan',
        createdAt: new Date().toISOString()
    }];
    setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);

    showToast('Registrasi berhasil! Silakan login.');
    return true;
}

function loginUser(username, password) {
    const users = getUsers();
    if (!users[username]) {
        showToast('Username tidak ditemukan!', 'error');
        return false;
    }
    if (users[username].password !== btoa(password)) {
        showToast('Password salah!', 'error');
        return false;
    }
    setCurrentUser(username);
    showToast(`Selamat datang, ${username}!`);
    return true;
}

function logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    showToast('Berhasil keluar');
    showLoginPage();
}

function changePassword(oldPass, newPass) {
    const username = getCurrentUser();
    const users = getUsers();
    if (users[username].password !== btoa(oldPass)) {
        showToast('Password lama salah!', 'error');
        return false;
    }
    users[username].password = btoa(newPass);
    setStorage(STORAGE_KEYS.USERS, users);
    showToast('Password berhasil diubah!');
    return true;
}

// ==================== BUDGET MANAGEMENT ====================
function getUserBudget() {
    const username = getCurrentUser();
    const budgets = getStorage(STORAGE_KEYS.BUDGET) || {};
    return budgets[username] || { gaji: 6000000, living: 50, saving: 30, playing: 10, emergency: 10 };
}

function saveUserBudget(budget) {
    const username = getCurrentUser();
    const budgets = getStorage(STORAGE_KEYS.BUDGET) || {};
    budgets[username] = budget;
    setStorage(STORAGE_KEYS.BUDGET, budgets);
}

function calculateBudgetAmounts(budget) {
    const gaji = budget.gaji;
    return {
        living: Math.round(gaji * budget.living / 100),
        saving: Math.round(gaji * budget.saving / 100),
        playing: Math.round(gaji * budget.playing / 100),
        emergency: Math.round(gaji * (budget.emergency || 10) / 100)
    };
}

// ==================== TRANSACTION MANAGEMENT ====================
function getUserTransactions() {
    const username = getCurrentUser();
    const transactions = getStorage(STORAGE_KEYS.TRANSACTIONS) || {};
    return transactions[username] || [];
}

function saveUserTransactions(txList) {
    const username = getCurrentUser();
    const transactions = getStorage(STORAGE_KEYS.TRANSACTIONS) || {};
    transactions[username] = txList;
    setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
}

function addTransaction(tx) {
    const transactions = getUserTransactions();
    tx.id = Date.now();
    tx.createdAt = new Date().toISOString();
    transactions.push(tx);
    saveUserTransactions(transactions);
    showToast('Transaksi berhasil ditambahkan!');
    return tx;
}

function deleteTransaction(id) {
    let transactions = getUserTransactions();
    transactions = transactions.filter(t => t.id !== id);
    saveUserTransactions(transactions);
    showToast('Transaksi berhasil dihapus!');
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
    document.getElementById('welcomeUser').textContent = `Halo, ${getCurrentUser()}!`;

    // Set default month
    document.getElementById('dashboardMonth').value = getCurrentMonth();
    document.getElementById('filterMonth').value = getCurrentMonth();
    document.getElementById('reportMonth').value = getCurrentMonth();
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];

    // Auto-add monthly salary if not exists for current month
    ensureMonthlySalary();

    // Load initial data
    loadBudgetSettings();
    updateDashboard();
    loadTransactionList();
}

// Ensure salary income exists for current month
function ensureMonthlySalary() {
    const currentMonth = getCurrentMonth();
    const transactions = getUserTransactions();
    const budget = getUserBudget();

    // Check if salary already exists for this month
    const hasSalaryThisMonth = transactions.some(tx =>
        tx.type === 'income' &&
        tx.description === 'Gaji Bulanan' &&
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
            description: 'Gaji Bulanan',
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

    // Update stats
    document.getElementById('totalIncome').textContent = formatRupiah(summary.totalIncome);
    document.getElementById('totalExpense').textContent = formatRupiah(summary.totalExpense);
    document.getElementById('totalBalance').textContent = formatRupiah(summary.totalIncome - summary.totalExpense);

    // Update budget cards - Living
    document.getElementById('livingBudget').textContent = formatRupiah(amounts.living);
    document.getElementById('livingUsed').textContent = formatRupiah(summary.livingExpense);
    document.getElementById('livingRemain').textContent = formatRupiah(Math.max(0, amounts.living - summary.livingExpense));
    const livingPercent = Math.min(100, (summary.livingExpense / amounts.living) * 100);
    document.getElementById('livingProgress').style.width = `${livingPercent}%`;
    document.getElementById('livingProgress').style.background = livingPercent > 100 ? '#EF4444' : '#3B82F6';

    // Update budget cards - Saving
    document.getElementById('savingBudget').textContent = formatRupiah(amounts.saving);
    document.getElementById('savingUsed').textContent = formatRupiah(summary.savingIncome);
    document.getElementById('savingRemain').textContent = formatRupiah(Math.max(0, amounts.saving - summary.savingIncome));
    const savingPercent = Math.min(100, (summary.savingIncome / amounts.saving) * 100);
    document.getElementById('savingProgress').style.width = `${savingPercent}%`;

    // Update budget cards - Playing
    document.getElementById('playingBudget').textContent = formatRupiah(amounts.playing);
    document.getElementById('playingUsed').textContent = formatRupiah(summary.playingExpense);
    document.getElementById('playingRemain').textContent = formatRupiah(Math.max(0, amounts.playing - summary.playingExpense));
    const playingPercent = Math.min(100, (summary.playingExpense / amounts.playing) * 100);
    document.getElementById('playingProgress').style.width = `${playingPercent}%`;
    document.getElementById('playingProgress').style.background = playingPercent > 100 ? '#EF4444' : '#F59E0B';

    // Update budget cards - Emergency
    document.getElementById('emergencyBudget').textContent = formatRupiah(amounts.emergency);
    document.getElementById('emergencyUsed').textContent = formatRupiah(summary.emergencyExpense);
    document.getElementById('emergencyRemain').textContent = formatRupiah(Math.max(0, amounts.emergency - summary.emergencyExpense));
    const emergencyPercent = Math.min(100, (summary.emergencyExpense / amounts.emergency) * 100);
    document.getElementById('emergencyProgress').style.width = `${emergencyPercent}%`;
    document.getElementById('emergencyProgress').style.background = emergencyPercent > 100 ? '#DC2626' : '#EF4444';

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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

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
                label: 'Total Tabungan',
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
                label: 'Sisa Saldo',
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
        historyContainer.innerHTML = '<p class="no-history">Belum ada data transaksi</p>';
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
            labels: ['Kebutuhan', 'Tabungan', 'Hiburan', 'Darurat'],
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
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
                return monthNames[parseInt(mo) - 1];
            }),
            datasets: [
                {
                    label: 'Pemasukan',
                    data: incomeData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Pengeluaran',
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
                <p>Belum ada transaksi</p>
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
            <div class="empty-state">
                <div class="icon">📝</div>
                <p>Tidak ada transaksi</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => createTransactionHTML(tx, true)).join('');
}

function getCategoryLabel(category) {
    const labels = {
        living: 'Kebutuhan',
        saving: 'Tabungan',
        playing: 'Hiburan',
        emergency: 'Darurat'
    };
    return labels[category] || category;
}

function createTransactionHTML(tx, showActions = false) {
    const icons = {
        living: '🏠',
        saving: '💎',
        playing: '🎮',
        emergency: '🚨',
        income: '💵'
    };

    const icon = tx.type === 'income' ? icons.income : icons[tx.category];
    const iconClass = tx.type === 'income' ? 'income' : tx.category;
    const amountClass = tx.type === 'income' ? 'income' : 'expense';
    const amountPrefix = tx.type === 'income' ? '+' : '-';
    const categoryLabel = getCategoryLabel(tx.category);

    const actionsHTML = showActions ? `
        <div class="tx-actions">
            <button class="btn-delete" onclick="handleDeleteTransaction(${tx.id})">Hapus</button>
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
    if (confirm('Yakin ingin menghapus transaksi ini?')) {
        deleteTransaction(id);
        loadTransactionList();
        updateDashboard();
    }
}

// ==================== BUDGET SETTINGS ====================
function loadBudgetSettings() {
    const budget = getUserBudget();

    document.getElementById('gajiInput').value = budget.gaji;
    document.getElementById('livingPercent').value = budget.living;
    document.getElementById('savingPercent').value = budget.saving;
    document.getElementById('playingPercent').value = budget.playing;
    document.getElementById('emergencyPercent').value = budget.emergency || 10;

    updateBudgetDisplay();
}

function updateBudgetDisplay() {
    const gaji = parseInt(document.getElementById('gajiInput').value) || 0;
    const living = parseInt(document.getElementById('livingPercent').value);
    const saving = parseInt(document.getElementById('savingPercent').value);
    const playing = parseInt(document.getElementById('playingPercent').value);
    const emergency = parseInt(document.getElementById('emergencyPercent').value);

    document.getElementById('livingPercentValue').textContent = `${living}%`;
    document.getElementById('savingPercentValue').textContent = `${saving}%`;
    document.getElementById('playingPercentValue').textContent = `${playing}%`;
    document.getElementById('emergencyPercentValue').textContent = `${emergency}%`;

    document.getElementById('livingAmount').textContent = Math.round(gaji * living / 100).toLocaleString('id-ID');
    document.getElementById('savingAmount').textContent = Math.round(gaji * saving / 100).toLocaleString('id-ID');
    document.getElementById('playingAmount').textContent = Math.round(gaji * playing / 100).toLocaleString('id-ID');
    document.getElementById('emergencyAmount').textContent = Math.round(gaji * emergency / 100).toLocaleString('id-ID');

    const total = living + saving + playing + emergency;
    document.getElementById('totalPercent').textContent = `${total}%`;
    document.getElementById('percentWarning').style.display = total !== 100 ? 'inline' : 'none';
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
            labels: ['Kebutuhan', 'Tabungan', 'Hiburan', 'Darurat'],
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
            <span>🏠 Kebutuhan</span>
            <strong>${formatRupiah(summary.livingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>💎 Tabungan</span>
            <strong>${formatRupiah(summary.savingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>🎮 Hiburan</span>
            <strong>${formatRupiah(summary.playingExpense)}</strong>
        </div>
        <div class="breakdown-item">
            <span>🚨 Darurat</span>
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
    if (score >= 80) status = 'Sangat Baik! 🌟';
    else if (score >= 60) status = 'Baik 👍';
    else if (score >= 40) status = 'Perlu Perhatian ⚠️';
    else status = 'Perlu Perbaikan 🚨';

    return { score, status, issues };
}

function generateCategoryAnalysis(summary, amounts) {
    const categories = [
        {
            key: 'living',
            name: 'Kebutuhan',
            icon: '🏠',
            budget: amounts.living,
            used: summary.livingExpense,
            desc: 'Kebutuhan Pokok'
        },
        {
            key: 'saving',
            name: 'Tabungan',
            icon: '💎',
            budget: amounts.saving,
            used: summary.savingIncome,
            desc: 'Tabungan',
            isIncome: true
        },
        {
            key: 'playing',
            name: 'Hiburan',
            icon: '🎮',
            budget: amounts.playing,
            used: summary.playingExpense,
            desc: 'Hiburan'
        },
        {
            key: 'emergency',
            name: 'Darurat',
            icon: '🚨',
            budget: amounts.emergency,
            used: summary.emergencyExpense,
            desc: 'Dana Darurat'
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
                statusText = 'Target Tercapai!';
            } else if (percentage >= 50) {
                statusClass = 'warning';
                statusText = `${percentage.toFixed(0)}% dari target`;
            } else {
                statusClass = 'danger';
                statusText = `Baru ${percentage.toFixed(0)}%`;
            }
        } else {
            // For expenses, lower is better
            if (percentage <= 80) {
                statusClass = 'good';
                statusText = 'Aman';
            } else if (percentage <= 100) {
                statusClass = 'warning';
                statusText = `${percentage.toFixed(0)}% terpakai`;
            } else {
                statusClass = 'danger';
                statusText = `Melebihi ${(percentage - 100).toFixed(0)}%!`;
            }
        }

        return `
            <div class="category-analysis-item">
                <div class="category-info">
                    <div class="category-icon ${cat.key}">${cat.icon}</div>
                    <div class="category-details">
                        <h5>${cat.name}</h5>
                        <p>${cat.desc} • Anggaran: ${formatRupiah(cat.budget)}</p>
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

    // 1. Cek defisit
    if (summary.totalExpense > totalIncome) {
        suggestions.push({
            type: 'danger',
            icon: '🚨',
            title: 'Pengeluaran Melebihi Pemasukan!',
            text: `Kamu mengalami defisit sebesar ${formatRupiah(summary.totalExpense - totalIncome)}. Segera evaluasi pengeluaran dan kurangi yang tidak perlu.`
        });
    }

    // 2. Cek Living expense
    if (summary.livingExpense > amounts.living) {
        const over = summary.livingExpense - amounts.living;
        suggestions.push({
            type: 'warning',
            icon: '🏠',
            title: 'Anggaran Kebutuhan Terlampaui',
            text: `Pengeluaran kebutuhan pokok melebihi anggaran ${formatRupiah(over)}. Coba catat detail pengeluaran dan cari yang bisa dikurangi.`
        });
    } else if (summary.livingExpense < amounts.living * 0.5 && summary.livingExpense > 0) {
        suggestions.push({
            type: 'success',
            icon: '✨',
            title: 'Hemat di Kebutuhan Pokok',
            text: `Bagus! Kamu hanya menggunakan ${((summary.livingExpense / amounts.living) * 100).toFixed(0)}% anggaran kebutuhan. Sisa bisa dialokasikan ke tabungan.`
        });
    }

    // 3. Cek Playing expense
    if (summary.playingExpense > amounts.playing) {
        suggestions.push({
            type: 'warning',
            icon: '🎮',
            title: 'Anggaran Hiburan Terlampaui',
            text: `Pengeluaran hiburan melebihi anggaran. Coba batasi pengeluaran untuk hiburan dan fokus pada kebutuhan pokok.`
        });
    }

    // 4. Cek Saving
    if (summary.savingIncome === 0 && totalIncome > 0) {
        suggestions.push({
            type: 'danger',
            icon: '💎',
            title: 'Belum Ada Tabungan Bulan Ini',
            text: `Kamu belum menabung bulan ini. Target tabungan: ${formatRupiah(amounts.saving)}. Sisihkan minimal 10-20% dari penghasilan.`
        });
    } else if (summary.savingIncome < amounts.saving && summary.savingIncome > 0) {
        const kurang = amounts.saving - summary.savingIncome;
        suggestions.push({
            type: 'warning',
            icon: '💎',
            title: 'Tabungan Belum Mencapai Target',
            text: `Kamu sudah menabung ${formatRupiah(summary.savingIncome)}, tapi masih kurang ${formatRupiah(kurang)} dari target.`
        });
    } else if (summary.savingIncome >= amounts.saving) {
        suggestions.push({
            type: 'success',
            icon: '🎉',
            title: 'Target Tabungan Tercapai!',
            text: `Selamat! Kamu sudah menabung ${formatRupiah(summary.savingIncome)} bulan ini. Pertahankan kebiasaan baik ini!`
        });
    }

    // 5. Cek Emergency usage
    if (summary.emergencyExpense > 0) {
        suggestions.push({
            type: 'warning',
            icon: '🚨',
            title: 'Dana Darurat Terpakai',
            text: `Kamu menggunakan ${formatRupiah(summary.emergencyExpense)} dari dana darurat. Pastikan untuk mengisi kembali dana darurat bulan depan.`
        });
    }

    // 6. Jika tidak ada masalah
    if (suggestions.length === 0) {
        suggestions.push({
            type: 'success',
            icon: '🌟',
            title: 'Keuangan Kamu Sehat!',
            text: 'Tidak ada masalah yang perlu diperhatikan. Terus pertahankan pengelolaan keuangan yang baik!'
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
            text: 'Gunakan metode 50/30/10/10: 50% kebutuhan, 30% tabungan, 10% hiburan, 10% darurat.'
        },
        {
            icon: '📝',
            text: 'Catat setiap pengeluaran, sekecil apapun. Ini membantu mengetahui kemana uang pergi.'
        },
        {
            icon: '🎯',
            text: 'Tetapkan tujuan tabungan spesifik (misal: dana darurat 6x pengeluaran bulanan).'
        },
        {
            icon: '🛒',
            text: 'Buat daftar belanja sebelum ke toko dan patuhi daftar tersebut.'
        },
        {
            icon: '📅',
            text: 'Review keuangan setiap minggu untuk tetap sesuai anggaran.'
        }
    ];

    // Add contextual tips based on data
    if (summary.playingExpense > summary.savingIncome) {
        tips.unshift({
            icon: '⚠️',
            text: 'Pengeluaran hiburan lebih besar dari tabungan. Coba tukar prioritasnya!'
        });
    }

    if (summary.emergencyExpense > 0) {
        tips.unshift({
            icon: '🔄',
            text: 'Setelah menggunakan dana darurat, prioritaskan untuk mengisinya kembali.'
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
        showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan'];
    const rows = transactions.map(tx => [
        tx.date,
        tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        getCategoryLabel(tx.category),
        tx.amount,
        tx.description || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadFile(`keuangan_${month}.csv`, csv, 'text/csv');
    showToast('File CSV berhasil diunduh!');
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
    showToast('Data berhasil diekspor!');
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

            showToast('Data berhasil diimpor!');
            loadBudgetSettings();
            updateDashboard();
            loadTransactionList();
        } catch (error) {
            showToast('Format file tidak valid!', 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('PERINGATAN: Semua data akan dihapus permanen. Lanjutkan?')) {
        const username = getCurrentUser();

        const budgets = getStorage(STORAGE_KEYS.BUDGET) || {};
        budgets[username] = { gaji: 6000000, living: 50, saving: 30, playing: 10, emergency: 10 };
        setStorage(STORAGE_KEYS.BUDGET, budgets);

        const transactions = getStorage(STORAGE_KEYS.TRANSACTIONS) || {};
        transactions[username] = [];
        setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);

        showToast('Semua data berhasil dihapus!');
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
document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    if (getCurrentUser()) {
        showMainApp();
    } else {
        showLoginPage();
    }

    // Login form
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (loginUser(username, password)) {
            showMainApp();
        }
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm').value;
        const gaji = parseInt(document.getElementById('regGaji').value);

        if (password !== confirm) {
            showToast('Password tidak cocok!', 'error');
            return;
        }

        if (registerUser(username, password, gaji)) {
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

    // Dashboard month change
    document.getElementById('dashboardMonth').addEventListener('change', updateDashboard);

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
    document.getElementById('filterMonth').addEventListener('change', loadTransactionList);
    document.getElementById('filterType').addEventListener('change', loadTransactionList);
    document.getElementById('filterCategory').addEventListener('change', loadTransactionList);

    // Budget settings
    document.getElementById('livingPercent').addEventListener('input', updateBudgetDisplay);
    document.getElementById('savingPercent').addEventListener('input', updateBudgetDisplay);
    document.getElementById('playingPercent').addEventListener('input', updateBudgetDisplay);
    document.getElementById('emergencyPercent').addEventListener('input', updateBudgetDisplay);
    document.getElementById('gajiInput').addEventListener('input', updateBudgetDisplay);

    document.getElementById('updateGaji').addEventListener('click', function() {
        const budget = getUserBudget();
        budget.gaji = parseInt(document.getElementById('gajiInput').value);
        saveUserBudget(budget);
        updateBudgetDisplay();
        showToast('Gaji berhasil diupdate!');
    });

    document.getElementById('saveBudget').addEventListener('click', function() {
        const living = parseInt(document.getElementById('livingPercent').value);
        const saving = parseInt(document.getElementById('savingPercent').value);
        const playing = parseInt(document.getElementById('playingPercent').value);
        const emergency = parseInt(document.getElementById('emergencyPercent').value);

        if (living + saving + playing + emergency !== 100) {
            showToast('Total persentase harus 100%!', 'error');
            return;
        }

        const budget = {
            gaji: parseInt(document.getElementById('gajiInput').value),
            living,
            saving,
            playing,
            emergency
        };
        saveUserBudget(budget);
        showToast('Pengaturan anggaran berhasil disimpan!');
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
            showToast('Password baru tidak cocok!', 'error');
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
            showToast('Pilih file terlebih dahulu!', 'warning');
            return;
        }
        importData(file);
    });

    document.getElementById('clearData').addEventListener('click', clearAllData);

    // Quick Income Form
    document.getElementById('quickIncomeForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const amount = parseInt(document.getElementById('quickIncomeAmount').value);
        const description = document.getElementById('quickIncomeDesc').value || 'Pemasukan Tambahan';
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

    // Close modal when clicking outside
    document.getElementById('incomeModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeIncomeModal();
        }
    });
});

// ==================== QUICK INCOME MODAL ====================
function showQuickIncome() {
    document.getElementById('quickIncomeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('incomeModal').classList.add('show');
}

function closeIncomeModal() {
    document.getElementById('incomeModal').classList.remove('show');
    document.getElementById('quickIncomeForm').reset();
}
