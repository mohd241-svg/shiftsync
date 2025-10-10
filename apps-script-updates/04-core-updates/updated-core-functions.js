// =============================================================
//              UPDATED CORE FUNCTIONS WITH TIMEZONE SUPPORT
//    Replace your existing functions with these timezone-aware versions
// =============================================================

function startShiftSafe(data, clientTimezone) {
  try {
    Logger.log('=== START SHIFT SAFE WITH TIMEZONE ===');
    if (!data.employeeName || !data.employeeId || !data.shiftDate) { 
      return { success: false, message: 'Missing required fields: employeeName, employeeId, shiftDate' }; 
    }
    
    const employeeId = String(data.employeeId).trim();
    const employeeName = String(data.employeeName).trim();
    const shiftDate = normalizeDate(data.shiftDate);
    
    // Use timezone-aware time if client timezone provided
    const currentTime = data.startTime || getCurrentTimeString(clientTimezone);
    
    Logger.log(`Starting shift for ${employeeName} at ${currentTime} (${clientTimezone || 'server timezone'})`);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = getOrCreateSheet(spreadsheet);
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(15000);
      const existingRow = findShiftRowDualCheck(sheet, employeeId, employeeName, shiftDate);
      
      if (existingRow > 0) {
        Logger.log('Found existing shift in row: ' + existingRow);
        return handleExistingShift(sheet, existingRow, data, currentTime, clientTimezone);
      } else {
        Logger.log('No existing shift found - Creating a new one');
        return createBrandNewShift(sheet, data, employeeId, employeeName, shiftDate, currentTime, clientTimezone);
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    Logger.log('Error in startShiftSafe: ' + error.toString());
    return { success: false, message: 'Failed to start shift: ' + error.toString() };
  }
}

function stopShift(data, clientTimezone) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    if (!sheet) { return { success: false, message: 'Shift sheet not found' }; }
    
    const employeeId = String(data.employeeId).trim();
    const employeeName = String(data.employeeName || '').trim();
    const shiftDate = normalizeDate(data.shiftDate);
    const row = findShiftRowDualCheck(sheet, employeeId, employeeName, shiftDate);
    
    if (row === 0) { return { success: false, message: 'No active shift found to stop' }; }
    
    const rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];
    let segments = JSON.parse(rowData[9] || '[]');
    const activeSegment = segments.find(seg => !seg.endTime);
    
    if (!activeSegment) { return { success: false, message: 'No active segment found to stop' }; }
    
    // Use timezone-aware time
    const endTime = data.endTime || getCurrentTimeString(clientTimezone);
    
    activeSegment.endTime = endTime;
    activeSegment.duration = calculateDuration(activeSegment.startTime, endTime);
    
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
    
    sheet.getRange(row, 7).setValue(endTime);
    sheet.getRange(row, 8).setValue(totalDuration);
    sheet.getRange(row, 10).setValue(JSON.stringify(segments));
    sheet.getRange(row, 11).setValue('BREAK');
    sheet.getRange(row, 13).setValue(new Date());
    
    formatShiftRow(sheet, row);
    
    const responseData = {
      shiftId: rowData[0], 
      employeeName: rowData[1], 
      employeeId: rowData[2], 
      shiftDate: normalizeDate(rowData[3]), 
      shiftType: rowData[4], 
      segments: segments.map(seg => ({
        ...seg,
        startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
        endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
      })), 
      totalDuration: totalDuration, 
      isActive: false, 
      status: 'BREAK',
      timezone: clientTimezone
    };
    
    return {
      success: true, 
      message: 'Segment stopped successfully',
      data: responseData
    };
  } catch (error) {
    Logger.log('Error stopping shift: ' + error.toString());
    return { success: false, message: 'Failed to stop segment: ' + error.toString() };
  }
}

function getCurrentShift(data, clientTimezone) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    if (!sheet) { return { success: true, data: null, message: 'Shift sheet does not exist' }; }

    const employeeId = String(data.employeeId).trim();
    const shiftDate = normalizeDate(data.date);
    
    Logger.log(`getCurrentShift: Searching for ID: "${employeeId}" on Date: "${shiftDate}"`);

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) { return { success: true, data: null }; }

    const allData = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    let foundRowData = null;

    // Loop from the end to find the most recent matching shift
    for (let i = allData.length - 1; i >= 0; i--) {
      const row = allData[i];
      const rowEmployeeId = String(row[2]).trim();
      const rowShiftDate = normalizeDate(row[3]);

      if (rowEmployeeId === employeeId && rowShiftDate === shiftDate) {
        foundRowData = row;
        Logger.log(`Match found in sheet row ${i + 2}`);
        break; // Stop after finding the first match from the bottom
      }
    }

    if (!foundRowData) {
      Logger.log('No shift found for this user today.');
      return { success: true, data: null };
    }
    
    // If a row was found, build the timezone-aware response object
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    
    const responseData = { 
      shiftId: foundRowData[0], 
      employeeName: foundRowData[1], 
      employeeId: foundRowData[2], 
      shiftDate: normalizeDate(foundRowData[3]), 
      shiftType: foundRowData[4], 
      segments: segments.map(seg => ({
        ...seg,
        startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
        endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
      })), 
      totalDuration: foundRowData[7], 
      status: foundRowData[10], 
      isActive: hasActiveSegment,
      firstStartTimeFormatted: formatTimeForClient(foundRowData[5], clientTimezone),
      lastEndTimeFormatted: foundRowData[6] ? formatTimeForClient(foundRowData[6], clientTimezone) : null,
      timezone: clientTimezone
    };
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    Logger.log('Error getting current shift: ' + error.toString());
    return { success: false, message: 'Failed to get current shift: ' + error.toString() };
  }
}

function getShifts(data, clientTimezone) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) { return { success: true, data: [], message: 'No shifts found' }; }
    
    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
    let filteredData = allData;
    
    if (data && data.employeeId) { 
      filteredData = filteredData.filter(row => String(row[2]).trim() === String(data.employeeId).trim()); 
    }
    
    if (data && data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(data.endDate);
      endDate.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter(row => { 
        const shiftDate = new Date(row[3]); 
        return shiftDate >= startDate && shiftDate <= endDate; 
      });
    }
    
    const shifts = filteredData.map(row => ({
      shiftId: row[0], 
      employeeName: row[1], 
      employeeId: row[2], 
      shiftDate: normalizeDate(row[3]), 
      shiftType: row[4], 
      firstStartTime: row[5],
      firstStartTimeFormatted: formatTimeForClient(row[5], clientTimezone),
      lastEndTime: row[6],
      lastEndTimeFormatted: row[6] ? formatTimeForClient(row[6], clientTimezone) : null,
      totalDuration: row[7], 
      numberOfSegments: row[8], 
      segments: JSON.parse(row[9] || '[]').map(seg => ({
        ...seg,
        startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
        endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
      })), 
      status: row[10], 
      createdAt: row[11], 
      lastUpdated: row[12],
      timezone: clientTimezone
    }));
    
    return { success: true, data: shifts, count: shifts.length };
  } catch (error) {
    Logger.log('Error getting shifts: ' + error.toString());
    return { success: false, message: 'Failed to retrieve shifts: ' + error.toString() };
  }
}

// Helper functions that need timezone support
function handleExistingShift(sheet, row, data, currentTime, clientTimezone) {
  try {
    const rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];
    const status = rowData[10];
    const employeeId = rowData[2];
    const shiftDate = rowData[3];
    
    if (status === 'COMPLETED') { return { success: false, message: 'Shift already completed for today' }; }
    if (status === 'ACTIVE') { 
      return { 
        success: true, 
        message: 'Your shift is already active', 
        data: getCurrentShift({employeeId, date: shiftDate}, clientTimezone).data 
      }; 
    }
    
    let segments = JSON.parse(rowData[9] || '[]');
    segments.push({ segmentId: segments.length + 1, startTime: currentTime, endTime: null, duration: null });
    
    sheet.getRange(row, 9).setValue(segments.length);
    sheet.getRange(row, 10).setValue(JSON.stringify(segments));
    sheet.getRange(row, 11).setValue('ACTIVE');
    sheet.getRange(row, 13).setValue(new Date());
    
    formatShiftRow(sheet, row);
    
    const responseData = { 
      shiftId: rowData[0], 
      employeeName: rowData[1], 
      employeeId: employeeId, 
      shiftDate: normalizeDate(shiftDate), 
      shiftType: rowData[4], 
      segments: segments.map(seg => ({
        ...seg,
        startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
        endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
      })), 
      totalDuration: rowData[7], 
      isActive: true, 
      status: 'ACTIVE',
      timezone: clientTimezone
    };
    
    return {
      success: true, 
      message: 'New work segment started',
      data: responseData
    };
  } catch (error) {
    Logger.log('Error handling existing shift: ' + error.toString());
    return { success: false, message: 'Failed to update existing shift: ' + error.toString() };
  }
}

function createBrandNewShift(sheet, data, employeeId, employeeName, shiftDate, currentTime, clientTimezone) {
  const shiftId = 'SH' + Date.now();
  const segments = [{ segmentId: 1, startTime: currentTime, endTime: null, duration: null }];
  const shiftType = data.shiftType || 'Regular';
  
  const rowData = [ 
    shiftId, employeeName, employeeId, shiftDate, shiftType, currentTime, null, 0, 1, 
    JSON.stringify(segments), 'ACTIVE', new Date(), new Date() 
  ];
  
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, 13).setValues([rowData]);
  formatShiftRow(sheet, nextRow);
  
  Logger.log('NEW SHIFT CREATED in row: ' + nextRow);
  
  const responseData = { 
    shiftId: shiftId, 
    employeeName: employeeName, 
    employeeId: employeeId, 
    shiftDate: shiftDate, 
    shiftType: shiftType, 
    segments: segments.map(seg => ({
      ...seg,
      startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
      endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
    })), 
    totalDuration: 0, 
    isActive: true, 
    status: 'ACTIVE',
    timezone: clientTimezone
  };
  
  return {
    success: true, 
    message: 'New shift started successfully',
    data: responseData
  };
}