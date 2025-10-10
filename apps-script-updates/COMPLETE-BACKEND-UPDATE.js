// =============================================================
//              COMPLETE BACKEND UPDATE FOR SMART STATUS
//    Replace your existing functions with these improved versions
// =============================================================

/**
 * REPLACE YOUR EXISTING getCurrentShift FUNCTION WITH THIS ONE
 * This version includes smart status determination logic
 */
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
    
    // ========================================
    // 🔥 NEW: SMART STATUS DETERMINATION LOGIC
    // ========================================
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    const lastEndTime = foundRowData[6]; // Last end time from sheet
    const storedStatus = foundRowData[10]; // Status stored in sheet
    
    // Determine smart status based on business logic
    let smartStatus;
    
    if (storedStatus === 'COMPLETED') {
      // If manually completed, keep as completed
      smartStatus = 'COMPLETED';
    } else if (hasActiveSegment) {
      // Has segments without end time = currently working
      smartStatus = 'ACTIVE';
    } else if (segments.length > 0) {
      // Has completed segments but no active ones
      if (lastEndTime) {
        try {
          const [hours] = lastEndTime.split(':').map(Number);
          const isLateInDay = hours >= 18 || hours <= 4; // After 6 PM or before 4 AM
          
          if (isLateInDay) {
            smartStatus = 'COMPLETED'; // Reasonable end of day
          } else {
            smartStatus = 'ON BREAK'; // Between segments during work day
          }
        } catch (error) {
          Logger.log('Error parsing time: ' + error.toString());
          smartStatus = 'ON BREAK'; // Default to break if time parsing fails
        }
      } else {
        smartStatus = 'ON BREAK'; // Has segments but no end time recorded
      }
    } else {
      smartStatus = 'DRAFT'; // No segments yet
    }
    
    Logger.log(`Status Logic: Stored="${storedStatus}", Smart="${smartStatus}", Active=${hasActiveSegment}, Segments=${segments.length}`);
    // ========================================
    
    // Build timezone-aware response object with SMART STATUS
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
      status: smartStatus, // 🔥 NOW USES SMART STATUS INSTEAD OF foundRowData[10]
      isActive: hasActiveSegment,
      firstStartTimeFormatted: formatTimeForClient(foundRowData[5], clientTimezone),
      lastEndTimeFormatted: foundRowData[6] ? formatTimeForClient(foundRowData[6], clientTimezone) : null,
      timezone: clientTimezone,
      // Additional debugging info (optional)
      _statusDebug: {
        storedStatus: storedStatus,
        calculatedStatus: smartStatus,
        hasActiveSegment: hasActiveSegment,
        segmentCount: segments.length,
        lastEndTime: lastEndTime
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

/**
 * REPLACE YOUR EXISTING getShifts FUNCTION WITH THIS ONE
 * This version also includes smart status determination for shift history
 */
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
    
    const shifts = filteredData.map(row => {
      // ========================================
      // 🔥 SMART STATUS FOR EACH SHIFT IN HISTORY
      // ========================================
      const segments = JSON.parse(row[9] || '[]');
      const hasActiveSegment = segments.some(seg => !seg.endTime);
      const lastEndTime = row[6];
      const storedStatus = row[10];
      
      let smartStatus;
      if (storedStatus === 'COMPLETED') {
        smartStatus = 'COMPLETED';
      } else if (hasActiveSegment) {
        smartStatus = 'ACTIVE';
      } else if (segments.length > 0) {
        if (lastEndTime) {
          try {
            const [hours] = lastEndTime.split(':').map(Number);
            const isLateInDay = hours >= 18 || hours <= 4;
            smartStatus = isLateInDay ? 'COMPLETED' : 'ON BREAK';
          } catch (error) {
            smartStatus = 'ON BREAK';
          }
        } else {
          smartStatus = 'ON BREAK';
        }
      } else {
        smartStatus = 'DRAFT';
      }
      // ========================================
      
      return {
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
        segments: segments.map(seg => ({
          ...seg,
          startTimeFormatted: formatTimeForClient(seg.startTime, clientTimezone),
          endTimeFormatted: seg.endTime ? formatTimeForMatching(seg.endTime, clientTimezone) : null
        })), 
        status: smartStatus, // 🔥 SMART STATUS FOR HISTORY TOO
        createdAt: row[11], 
        lastUpdated: row[12],
        timezone: clientTimezone
      };
    });
    
    return { success: true, data: shifts, count: shifts.length };
  } catch (error) {
    Logger.log('Error getting shifts: ' + error.toString());
    return { success: false, message: 'Failed to retrieve shifts: ' + error.toString() };
  }
}

/**
 * OPTIONAL: ADD THIS NEW HELPER FUNCTION
 * This function can be called to update all existing shift statuses in the database
 */
function updateAllShiftStatusesToSmart() {
  Logger.log('=== UPDATING ALL SHIFT STATUSES TO SMART LOGIC ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log('No shifts found to update');
      return { success: true, message: 'No shifts to update' };
    }
    
    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
    let updatedCount = 0;
    
    allData.forEach((row, index) => {
      const rowNumber = index + 2; // Actual sheet row number
      
      const segments = JSON.parse(row[9] || '[]');
      const hasActiveSegment = segments.some(seg => !seg.endTime);
      const lastEndTime = row[6];
      const storedStatus = row[10];
      
      // Calculate smart status
      let smartStatus;
      if (storedStatus === 'COMPLETED') {
        smartStatus = 'COMPLETED'; // Keep manually completed
      } else if (hasActiveSegment) {
        smartStatus = 'ACTIVE';
      } else if (segments.length > 0) {
        if (lastEndTime) {
          try {
            const [hours] = lastEndTime.split(':').map(Number);
            const isLateInDay = hours >= 18 || hours <= 4;
            smartStatus = isLateInDay ? 'COMPLETED' : 'ON BREAK';
          } catch (error) {
            smartStatus = 'ON BREAK';
          }
        } else {
          smartStatus = 'ON BREAK';
        }
      } else {
        smartStatus = 'DRAFT';
      }
      
      // Update if different from stored status
      if (smartStatus !== storedStatus) {
        sheet.getRange(rowNumber, 11).setValue(smartStatus); // Column K is status
        Logger.log(`Updated row ${rowNumber}: "${storedStatus}" → "${smartStatus}"`);
        updatedCount++;
      }
    });
    
    Logger.log(`✅ Updated ${updatedCount} shift statuses`);
    return { success: true, message: `Updated ${updatedCount} shift statuses to smart logic` };
    
  } catch (error) {
    Logger.log('❌ Error updating shift statuses: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// =============================================================
//                    WHAT TO DO:
// 
// 1. Copy the getCurrentShift function above
// 2. In your Apps Script, find your existing getCurrentShift function
// 3. Replace the ENTIRE function with the one above
// 4. Do the same for getShifts function
// 5. Save your Apps Script (Ctrl+S)
// 6. Test your React app - status should now be correct!
// 
// OPTIONAL:
// 7. Run updateAllShiftStatusesToSmart() once to fix existing data
// 
// The new logic:
// - ACTIVE: Has segments without end time (currently working)
// - ON BREAK: All segments complete, but before 6 PM (between segments)  
// - COMPLETED: After 6 PM or manually marked complete
// - DRAFT: No segments yet
// =============================================================