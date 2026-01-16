// ==================== GOOGLE APPS SCRIPT FOR KEUANGAN APP ====================
// Deploy this as a Web App in Google Apps Script

const SPREADSHEET_ID = '1BRQzoZgqBZXBluntEa6la5j6_ZyMtA-K-gIc2melF6Q';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch(action) {
      case 'register':
        result = registerUser(e.parameter.username, e.parameter.password, e.parameter.gaji);
        break;
      case 'login':
        result = loginUser(e.parameter.username, e.parameter.password);
        break;
      case 'getBudget':
        result = getBudget(e.parameter.username);
        break;
      case 'saveBudget':
        result = saveBudget(e.parameter.username, e.parameter.budget);
        break;
      case 'getTransactions':
        result = getTransactions(e.parameter.username);
        break;
      case 'addTransaction':
        result = addTransaction(e.parameter.username, e.parameter.transaction);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(e.parameter.username, e.parameter.transactionId);
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch(error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get or create sheet
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers based on sheet type
    if (name === 'Users') {
      sheet.appendRow(['username', 'password', 'gaji', 'createdAt']);
    } else if (name === 'Budgets') {
      sheet.appendRow(['username', 'gaji', 'livingAmt', 'savingAmt', 'playingAmt', 'emergencyAmt', 'living', 'saving', 'playing', 'emergency']);
    } else if (name === 'Transactions') {
      sheet.appendRow(['username', 'id', 'type', 'category', 'amount', 'date', 'description', 'createdAt']);
    }
  }
  return sheet;
}

// ==================== USER FUNCTIONS ====================
function registerUser(username, password, gaji) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();

  // Check if username exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return { success: false, error: 'Username already exists!' };
    }
  }

  // Add new user
  const encodedPassword = Utilities.base64Encode(password);
  sheet.appendRow([username, encodedPassword, parseFloat(gaji), new Date().toISOString()]);

  // Initialize budget
  const budgetSheet = getSheet('Budgets');
  const gajiNum = parseFloat(gaji);
  budgetSheet.appendRow([
    username,
    gajiNum,
    Math.round(gajiNum * 0.5),  // livingAmt
    Math.round(gajiNum * 0.3),  // savingAmt
    Math.round(gajiNum * 0.1),  // playingAmt
    Math.round(gajiNum * 0.1),  // emergencyAmt
    50, 30, 10, 10              // percentages
  ]);

  // Add initial salary transaction
  const txSheet = getSheet('Transactions');
  const today = new Date().toISOString().split('T')[0];
  txSheet.appendRow([
    username,
    Date.now(),
    'income',
    'living',
    gajiNum,
    today,
    'Monthly Salary',
    new Date().toISOString()
  ]);

  return { success: true, message: 'Registration successful!' };
}

function loginUser(username, password) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const encodedPassword = Utilities.base64Encode(password);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      if (data[i][1] === encodedPassword) {
        return {
          success: true,
          message: 'Login successful!',
          user: {
            username: username,
            gaji: data[i][2]
          }
        };
      } else {
        return { success: false, error: 'Wrong password!' };
      }
    }
  }

  return { success: false, error: 'Username not found!' };
}

// ==================== BUDGET FUNCTIONS ====================
function getBudget(username) {
  const sheet = getSheet('Budgets');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return {
        success: true,
        budget: {
          gaji: data[i][1],
          livingAmt: data[i][2],
          savingAmt: data[i][3],
          playingAmt: data[i][4],
          emergencyAmt: data[i][5],
          living: data[i][6],
          saving: data[i][7],
          playing: data[i][8],
          emergency: data[i][9]
        }
      };
    }
  }

  return { success: false, error: 'Budget not found' };
}

function saveBudget(username, budgetJson) {
  const budget = JSON.parse(budgetJson);
  const sheet = getSheet('Budgets');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 2, 1, 9).setValues([[
        budget.gaji,
        budget.livingAmt,
        budget.savingAmt,
        budget.playingAmt,
        budget.emergencyAmt,
        budget.living,
        budget.saving,
        budget.playing,
        budget.emergency
      ]]);
      return { success: true, message: 'Budget saved!' };
    }
  }

  // If not found, create new
  sheet.appendRow([
    username,
    budget.gaji,
    budget.livingAmt,
    budget.savingAmt,
    budget.playingAmt,
    budget.emergencyAmt,
    budget.living,
    budget.saving,
    budget.playing,
    budget.emergency
  ]);

  return { success: true, message: 'Budget created!' };
}

// ==================== TRANSACTION FUNCTIONS ====================
function getTransactions(username) {
  const sheet = getSheet('Transactions');
  const data = sheet.getDataRange().getValues();
  const transactions = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      transactions.push({
        id: data[i][1],
        type: data[i][2],
        category: data[i][3],
        amount: data[i][4],
        date: data[i][5],
        description: data[i][6],
        createdAt: data[i][7]
      });
    }
  }

  return { success: true, transactions: transactions };
}

function addTransaction(username, transactionJson) {
  const tx = JSON.parse(transactionJson);
  const sheet = getSheet('Transactions');

  sheet.appendRow([
    username,
    tx.id || Date.now(),
    tx.type,
    tx.category,
    tx.amount,
    tx.date,
    tx.description || '',
    tx.createdAt || new Date().toISOString()
  ]);

  return { success: true, message: 'Transaction added!' };
}

function deleteTransaction(username, transactionId) {
  const sheet = getSheet('Transactions');
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === username && String(data[i][1]) === String(transactionId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Transaction deleted!' };
    }
  }

  return { success: false, error: 'Transaction not found' };
}
