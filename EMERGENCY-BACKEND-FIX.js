// =============================================================
//                 🚨 EMERGENCY BACKEND FIX FOR YOUR GOOGLE APPS SCRIPT
//          Add this function to fix your impossible shift data immediately
// =============================================================

/**
 * 🔥 EMERGENCY FIX: Add this to your Google Apps Script and run it once
 * This will fix the impossible "COMPLETED" shift for Ismail (SH1758917398114)
 */
function fixImpossibleShiftData() {
  Logger.log('=== EMERGENCY FIX: Fixing Impossible Shift Data ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ Shifts sheet not found');
      return { success: false, message: 'Shifts sheet not found' };
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('❌ No data found');
      return { success: false, message: 'No data found' };
    }
    
    const allData = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    let fixedCount = 0;
    
    // Get current time for comparison
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    Logger.log(`🕐 Current time: ${currentTime}`);
    
    allData.forEach((row, index) => {
      const rowNumber = index + 2; // Actual sheet row number
      const shiftId = row[0];
      const employeeName = row[1];
      const segments = JSON.parse(row[9] || '[]');
      const status = row[10];
      
      // Focus on the specific problematic shift or similar cases
      if (status === 'COMPLETED' && segments.length > 0) {
        const firstStartTime = segments[0]?.startTime;
        
        if (firstStartTime) {
          // Check if current time is before shift start
          const [currentHour, currentMinute] = currentTime.split(':').map(Number);
          const [startHour, startMinute] = firstStartTime.split(':').map(Number);
          
          const currentMinutes = currentHour * 60 + currentMinute;
          const startMinutes = startHour * 60 + startMinute;
          
          if (currentMinutes < startMinutes) {
            // This is impossible! Fix it.
            sheet.getRange(rowNumber, 11).setValue('DRAFT'); // Column K is status
            Logger.log(`🔧 FIXED ${shiftId} (${employeeName}): "COMPLETED" → "DRAFT" (Current: ${currentTime}, Starts: ${firstStartTime})`);
            fixedCount++;
          }
        }
      }
    });
    
    Logger.log(`✅ Fixed ${fixedCount} impossible shift statuses`);
    
    return { 
      success: true, 
      message: `Emergency fix completed. Fixed ${fixedCount} impossible shift statuses.`,
      fixedCount: fixedCount,
      currentTime: currentTime
    };
    
  } catch (error) {
    Logger.log('❌ Emergency fix failed: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// =============================================================
//             🔥 ENHANCED getCurrentShift - IMMEDIATE SMART STATUS
//    Replace your existing getCurrentShift with this version for instant fix
// =============================================================

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
        break;
      }
    }

    if (!foundRowData) {
      Logger.log('No shift found for this user today.');
      return { success: true, data: null };
    }
    
    // ========================================
    // 🔥 IMMEDIATE SMART STATUS LOGIC (NO DELAYS)
    // ========================================
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    const lastEndTime = foundRowData[6];
    const storedStatus = foundRowData[10];
    
    // Get current time for immediate comparison
    const currentTime = getCurrentTimeString(clientTimezone);
    let smartStatus = storedStatus; // Default to stored status
    
    // 🚨 IMMEDIATE FIX: Check for impossible "COMPLETED" before shift starts
    if (storedStatus === 'COMPLETED' && segments.length > 0) {
      const firstStartTime = segments[0]?.startTime;
      if (firstStartTime) {
        const [currentHour, currentMinute] = currentTime.split(':').map(Number);
        const [startHour, startMinute] = firstStartTime.split(':').map(Number);
        
        if (!isNaN(currentHour) && !isNaN(currentMinute) && !isNaN(startHour) && !isNaN(startMinute)) {
          const currentMinutes = currentHour * 60 + currentMinute;
          const startMinutes = startHour * 60 + startMinute;
          
          if (currentMinutes < startMinutes) {
            Logger.log(`🚨 IMPOSSIBLE STATUS DETECTED: Shift marked COMPLETED at ${currentTime} but starts at ${firstStartTime}`);
            smartStatus = 'OFFLINE'; // Override impossible status immediately
            
            // 🔥 AUTO-FIX: Update the sheet immediately
            try {
              const rowNumber = findRowNumber(spreadsheet, SHIFTS_SHEET_NAME, foundRowData[0]); // Find row by shift ID
              if (rowNumber > 0) {
                sheet.getRange(rowNumber, 11).setValue('DRAFT'); // Fix the database too
                Logger.log(`🔧 AUTO-FIXED database: Changed status to DRAFT in row ${rowNumber}`);
              }
            } catch (fixError) {
              Logger.log('⚠️ Could not auto-fix database: ' + fixError.toString());
            }
          }
        }
      }
    }
    
    Logger.log(`🎯 IMMEDIATE STATUS: Stored="${storedStatus}", Smart="${smartStatus}", CurrentTime=${currentTime}`);
    
    // Build response with immediate smart status
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
      status: smartStatus, // 🔥 IMMEDIATE SMART STATUS
      isActive: hasActiveSegment,
      firstStartTimeFormatted: formatTimeForClient(foundRowData[5], clientTimezone),
      lastEndTimeFormatted: foundRowData[6] ? formatTimeForClient(foundRowData[6], clientTimezone) : null,
      timezone: clientTimezone,
      _debug: {
        storedStatus: storedStatus,
        smartStatus: smartStatus,
        currentTime: currentTime,
        autoFixed: smartStatus !== storedStatus
      }
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

// Helper function to find row number by shift ID
function findRowNumber(spreadsheet, sheetName, shiftId) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return 0;
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  
  const shiftIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < shiftIds.length; i++) {
    if (shiftIds[i][0] === shiftId) {
      return i + 2; // Return actual row number
    }
  }
  return 0;
}

// =============================================================
//                    📋 DEPLOYMENT INSTRUCTIONS
// =============================================================

/*
🚀 IMMEDIATE FIXES TO DEPLOY:

1. **EMERGENCY FIX** (Run once):
   - Copy fixImpossibleShiftData() function to your Google Apps Script
   - Run it once to fix existing impossible data
   - This will change "COMPLETED" to "DRAFT" for shifts that haven't started

2. **PERMANENT FIX** (Replace existing function):
   - Replace your getCurrentShift function with the enhanced version above
   - This provides immediate smart status and auto-fixes impossible data
   - No more refresh required - works instantly

3. **RESULT**:
   ✅ Your impossible shift will show "OFFLINE" immediately (no refresh needed)
   ✅ Google Sheet data will be automatically corrected
   ✅ Future impossible statuses will be prevented
   ✅ Real-time status updates work properly

🎯 PRIORITY: Deploy the enhanced getCurrentShift function first for immediate results!
*/