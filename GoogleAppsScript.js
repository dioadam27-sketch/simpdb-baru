
// ==========================================
// SCRIPT BACKEND SIMPDB (V6 - SMART ATTENDANCE)
// Perbaikan: Concurrency & Caching untuk Real-time Polling
// Copy kode ini ke script editor untuk URL:
// https://script.google.com/macros/s/AKfycbyXNaMOllSVNuPtUjYWLWZ2X1L1qpcZCuaBKACIrAVc0kbK7miaqblexu7fGhdSw4WE/exec
// ==========================================

// Mapping Nama Sheet dan Kolom Data
const TABLES = {
  courses: {
    sheet: 'Courses',
    columns: ['id', 'code', 'name', 'credits', 'coordinatorId']
  },
  lecturers: {
    sheet: 'Lecturers',
    columns: ['id', 'name', 'nip', 'position', 'expertise', 'password']
  },
  rooms: {
    sheet: 'Rooms',
    columns: ['id', 'name', 'capacity', 'building', 'location']
  },
  classes: {
    sheet: 'Classes',
    columns: ['id', 'name']
  },
  schedule: {
    sheet: 'Schedule',
    columns: ['id', 'courseId', 'lecturerIds', 'pjmkLecturerId', 'roomId', 'className', 'day', 'timeSlot']
  },
  teaching_logs: {
    sheet: 'TeachingLogs',
    columns: ['id', 'scheduleId', 'lecturerId', 'week', 'timestamp', 'date']
  },
  settings: {
    sheet: 'Settings',
    columns: ['id', 'key', 'value']
  }
};

const CACHE_KEY = 'SIMPDB_DATA_V6_FIX_LOGS_3_REALTIME'; 
const CACHE_EXPIRATION = 300; // Cache 5 menit

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLES).forEach(key => {
    const config = TABLES[key];
    let sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      sheet = ss.insertSheet(config.sheet);
      sheet.appendRow(config.columns);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, config.columns.length).setFontWeight('bold');
    }
  });
}

function doGet(e) {
  // Optimization: Double-Checked Locking
  // 1. Try reading from Cache first (Fast Path) without Lock
  const nocache = e.parameter.nocache === 'true'; 
  const cache = CacheService.getScriptCache();
  
  if (!nocache) {
    const cachedData = cache.get(CACHE_KEY);
    if (cachedData != null) {
      return ContentService.createTextOutput(cachedData).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 2. Lock only if cache miss or forced refresh
  // Short wait time for read, fallback to error quickly if overloaded is better than hanging forever
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { 
     // Return busy signal
     return ContentService.createTextOutput(JSON.stringify({error:"Server Busy"})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 3. Check cache again after acquiring lock (in case another thread filled it)
    if (!nocache) {
      const cachedData = cache.get(CACHE_KEY);
      if (cachedData != null) {
        return ContentService.createTextOutput(cachedData).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 4. Heavy Lift: Read from Spreadsheet
    const result = {};
    Object.keys(TABLES).forEach(key => {
      result[key] = getData(key);
    });

    const jsonString = JSON.stringify(result);
    // Write back to cache
    try { cache.put(CACHE_KEY, jsonString, CACHE_EXPIRATION); } catch(err) {}
    
    return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Write lock needs more patience
  if (!lock.tryLock(30000)) {
     return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Server busy, try again.' })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action; 
    const tableKey = payload.table;
    const data = payload.data;
    const id = payload.id; 
    
    if (!TABLES[tableKey]) throw new Error("Table not found: " + tableKey);
    
    if (tableKey === 'teaching_logs' && (action === 'add' || action === 'update')) {
       handleLogUpsert(data);
    } 
    else if (action === 'add') {
      addRow(tableKey, data);
    } else if (action === 'bulk_add') {
      if (Array.isArray(data)) addRows(tableKey, data);
    } else if (action === 'delete') {
      deleteRow(tableKey, id);
    } else if (action === 'update') {
      if (tableKey === 'settings' && data.key) {
        deleteRowsByKey(tableKey, data.key);
        addRow(tableKey, data);
      } else {
        // Optimized update: In-place update instead of delete+add
        updateRow(tableKey, data);
      }
    } else if (action === 'clear') {
      clearTable(tableKey);
    }

    SpreadsheetApp.flush();
    // Invalidate Cache immediately so next poll gets fresh data
    CacheService.getScriptCache().remove(CACHE_KEY);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- HELPER FUNCTIONS ---

function getData(tableKey) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return [];
  
  const rawData = sheet.getRange(2, 1, lastRow - 1, config.columns.length).getValues();
  
  return rawData.map(row => {
    const item = {};
    config.columns.forEach((col, index) => {
      const val = row[index];
      if (['id', 'nip', 'courseId', 'roomId', 'pjmkLecturerId', 'password', 'scheduleId', 'lecturerId', 'date', 'coordinatorId'].includes(col)) {
        item[col] = String(val);
      } else if (col === 'lecturerIds') {
        item[col] = String(val); 
      } else if (col === 'week') {
         item[col] = Number(val);
      } else {
        item[col] = (typeof val === 'number') ? val : String(val);
      }
    });
    return item;
  });
}

function addRow(tableKey, data) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  const rowData = prepareRowData(config.columns, data);
  sheet.appendRow(rowData);
}

function updateRow(tableKey, data) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  const lastRow = sheet.getLastRow();
  const id = String(data.id);
  
  // Find row index based on ID (Column 1)
  // Optimization: Read only ID column
  const idData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let rowIndex = -1;
  
  for(let i=0; i<idData.length; i++) {
    if(String(idData[i][0]) === id) {
      rowIndex = i + 2; // +2 offset (Header + 0-index)
      break;
    }
  }
  
  if (rowIndex !== -1) {
    const rowData = prepareRowData(config.columns, data);
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Fallback: Add if not found
    addRow(tableKey, data);
  }
}

function handleLogUpsert(data) {
  const config = TABLES['teaching_logs'];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  
  const lastRow = sheet.getLastRow();
  let foundRowIndex = -1;
  
  if (lastRow > 1) {
    // Only fetch key columns for searching to be faster
    const checkRange = sheet.getRange(2, 2, lastRow - 1, 3).getValues(); 
    
    for (let i = 0; i < checkRange.length; i++) {
      const rowScheduleId = String(checkRange[i][0]);
      const rowLecturerId = String(checkRange[i][1]);
      const rowWeek = Number(checkRange[i][2]);
      
      if (rowScheduleId === String(data.scheduleId) && 
          rowLecturerId === String(data.lecturerId) && 
          rowWeek === Number(data.week)) {
        foundRowIndex = i + 2; 
        break;
      }
    }
  }
  
  const rowData = prepareRowData(config.columns, data);
  
  if (foundRowIndex > -1) {
    sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function prepareRowData(columns, data) {
  return columns.map(col => {
    if (col === 'id' || col === 'nip' || col === 'password' || 
        col === 'scheduleId' || col === 'lecturerId' || col === 'date' || col === 'coordinatorId') {
      return "'" + (data[col] || '');
    }
    if (col === 'lecturerIds') return JSON.stringify(data[col] || []);
    return data[col] || '';
  });
}

function addRows(tableKey, dataArray) {
  if (dataArray.length === 0) return;
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  
  const rows = dataArray.map(item => prepareRowData(config.columns, item));
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, config.columns.length).setValues(rows);
}

function deleteRow(tableKey, id) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const targetId = String(id).trim(); 
  
  for (let i = idColumn.length - 1; i >= 0; i--) {
    const cellId = String(idColumn[i][0]).trim();
    if (cellId === targetId) {
      sheet.deleteRow(i + 2);
    }
  }
}

function deleteRowsByKey(tableKey, keyVal) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const keyIndex = config.columns.indexOf('key');
  if (keyIndex === -1) return; 

  const columnData = sheet.getRange(2, keyIndex + 1, lastRow - 1, 1).getValues();
  const targetKey = String(keyVal).trim().toLowerCase();
  
  for (let i = columnData.length - 1; i >= 0; i--) {
    const cellKey = String(columnData[i][0]).trim().toLowerCase();
    if (cellKey === targetKey) {
      sheet.deleteRow(i + 2); 
    }
  }
}

function clearTable(tableKey) {
  const config = TABLES[tableKey];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}
