// =============================================================
//              IMPROVED STATUS LOGIC FOR SHIFTS
//    Add this function to your Apps Script for better status handling
// =============================================================

/**
 * Smart status determination based on shift segments
 */
function determineShiftStatus(segments, isEndOfDay = false) {
  if (!segments || segments.length === 0) {
    return 'DRAFT'; // No segments yet
  }

  // Check for active segments (no end time)
  const activeSegments = segments.filter(seg => !seg.endTime);
  const completedSegments = segments.filter(seg => seg.endTime);
  
  if (activeSegments.length > 0) {
    return 'ACTIVE'; // Currently working
  }
  
  if (completedSegments.length > 0 && !isEndOfDay) {
    return 'ON BREAK'; // Between segments, more work possible
  }
  
  if (completedSegments.length > 0 && isEndOfDay) {
    return 'COMPLETED'; // Finished for the day
  }
  
  return 'DRAFT'; // Default fallback
}

/**
 * Check if it's reasonable to consider the shift complete
 * (e.g., after 6 PM, or if user manually completed)
 */
function isReasonablyEndOfDay(lastEndTime, manualComplete = false) {
  if (manualComplete) return true;
  
  try {
    if (!lastEndTime) return false;
    
    // Parse the time string (HH:MM format)
    const [hours, minutes] = lastEndTime.split(':').map(Number);
    const endHour = hours + (minutes / 60);
    
    // Consider end of day after 6 PM (18:00) or before 4 AM (04:00)
    return endHour >= 18 || endHour <= 4;
  } catch (error) {
    return false; // If parsing fails, assume not end of day
  }
}

/**
 * Enhanced getCurrentShift with better status logic
 */
function getCurrentShiftWithSmartStatus(data, clientTimezone) {
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
    
    // Smart status determination
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    const lastEndTime = foundRowData[6]; // Last end time from sheet
    const storedStatus = foundRowData[10]; // Status stored in sheet
    
    // Determine smart status
    let smartStatus;
    if (storedStatus === 'COMPLETED') {
      // If manually completed, keep as completed
      smartStatus = 'COMPLETED';
    } else {
      // Use smart logic
      const isEndOfDay = isReasonablyEndOfDay(lastEndTime);
      smartStatus = determineShiftStatus(segments, isEndOfDay);
    }
    
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
      status: smartStatus, // Use smart status instead of stored status
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

// =============================================================
//                    WHAT TO DO:
// 
// 1. Add all the functions above to your Apps Script
// 2. Replace your getCurrentShift function with getCurrentShiftWithSmartStatus
// 3. OR just replace the status determination part in your existing getCurrentShift
// 
// The new logic:
// - ACTIVE: Currently working (has segments without end time)
// - ON BREAK: Between segments (all segments have end times, but not late)
// - COMPLETED: End of day (after 6 PM) or manually completed
// - DRAFT: No segments yet
// =============================================================