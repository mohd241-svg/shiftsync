// =============================================================
//             COMPLETE SMART STATUS UPDATE FOR GOOGLE APPS SCRIPT
//    🔥 FIXES IMPOSSIBLE "COMPLETED" STATUS BEFORE SHIFT STARTS
//    📋 COPY THESE FUNCTIONS TO YOUR APPS SCRIPT TO REPLACE EXISTING ONES
// =============================================================

/**
 * 🔥 ENHANCED getCurrentShift WITH COMPREHENSIVE SMART STATUS LOGIC
 * This version prevents impossible status scenarios like "COMPLETED" before shift starts
 * Replace your existing getCurrentShift function with this one
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
        break;
      }
    }

    if (!foundRowData) {
      Logger.log('No shift found for this user today.');
      return { success: true, data: null };
    }
    
    // ========================================
    // 🔥 ENHANCED SMART STATUS DETERMINATION LOGIC
    // ========================================
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    const lastEndTime = foundRowData[6]; // Last end time from sheet
    const storedStatus = foundRowData[10]; // Status stored in sheet
    
    // 🔥 NEW: Get current time for intelligent comparison
    const currentTime = getCurrentTimeString(clientTimezone);
    
    // Determine smart status based on REAL business logic + time validation
    let smartStatus;
    
    // 🔥 STEP 1: Check for impossible "COMPLETED" before shift starts
    if (storedStatus === 'COMPLETED' && segments.length > 0) {
      const firstStartTime = segments[0]?.startTime;
      if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
        Logger.log(`🚨 IMPOSSIBLE STATUS DETECTED: Shift marked COMPLETED at ${currentTime} but starts at ${firstStartTime}`);
        smartStatus = 'OFFLINE'; // Override impossible status
      } else {
        smartStatus = 'COMPLETED'; // Keep if actually valid
      }
    }
    // 🔥 STEP 2: Check if current time is before shift starts
    else if (segments.length > 0 && !hasActiveSegment) {
      const firstStartTime = segments[0]?.startTime;
      if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
        smartStatus = 'OFFLINE'; // Show offline until shift starts
      } else if (lastEndTime && isCurrentTimeAfterShiftEnd(currentTime, lastEndTime)) {
        smartStatus = 'COMPLETED'; // Actually completed - time has passed
      } else if (checkForGapsBetweenSegments(segments, currentTime)) {
        smartStatus = 'ON BREAK'; // In a gap between segments
      } else {
        smartStatus = 'ON BREAK'; // Default between segments
      }
    }
    // 🔥 STEP 3: Handle active segments
    else if (hasActiveSegment) {
      smartStatus = 'ACTIVE'; // Currently working
    }
    // 🔥 STEP 4: Handle completed segments with time validation
    else if (segments.length > 0) {
      if (lastEndTime && isCurrentTimeAfterShiftEnd(currentTime, lastEndTime)) {
        smartStatus = 'COMPLETED'; // Time has passed end time
      } else {
        smartStatus = 'ON BREAK'; // Between segments or break time
      }
    }
    // 🔥 STEP 5: No segments yet
    else {
      smartStatus = 'DRAFT'; // No segments created
    }
    
    Logger.log(`🎯 STATUS LOGIC: Stored="${storedStatus}", Smart="${smartStatus}", Active=${hasActiveSegment}, Segments=${segments.length}, CurrentTime=${currentTime}`);
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
      status: smartStatus, // 🔥 NOW USES SMART STATUS WITH TIME VALIDATION
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
        lastEndTime: lastEndTime,
        currentTime: currentTime,
        timeComparisonResults: {
          beforeShiftStart: segments.length > 0 && segments[0]?.startTime ? 
            isCurrentTimeBeforeShiftStart(currentTime, segments[0].startTime) : false,
          afterShiftEnd: lastEndTime ? 
            isCurrentTimeAfterShiftEnd(currentTime, lastEndTime) : false,
          inGapBetweenSegments: checkForGapsBetweenSegments(segments, currentTime)
        }
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
 * 🔥 ENHANCED getShifts WITH SAME SMART STATUS LOGIC
 * Replace your existing getShifts function with this one
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
    
    const currentTime = getCurrentTimeString(clientTimezone);
    
    const shifts = filteredData.map(row => {
      // ========================================
      // 🔥 SAME SMART STATUS LOGIC FOR SHIFT HISTORY
      // ========================================
      const segments = JSON.parse(row[9] || '[]');
      const hasActiveSegment = segments.some(seg => !seg.endTime);
      const lastEndTime = row[6];
      const storedStatus = row[10];
      
      let smartStatus;
      
      // Apply the same intelligent status logic
      if (storedStatus === 'COMPLETED' && segments.length > 0) {
        const firstStartTime = segments[0]?.startTime;
        if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
          smartStatus = 'OFFLINE';
        } else {
          smartStatus = 'COMPLETED';
        }
      } else if (segments.length > 0 && !hasActiveSegment) {
        const firstStartTime = segments[0]?.startTime;
        if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
          smartStatus = 'OFFLINE';
        } else if (lastEndTime && isCurrentTimeAfterShiftEnd(currentTime, lastEndTime)) {
          smartStatus = 'COMPLETED';
        } else if (checkForGapsBetweenSegments(segments, currentTime)) {
          smartStatus = 'ON BREAK';
        } else {
          smartStatus = 'ON BREAK';
        }
      } else if (hasActiveSegment) {
        smartStatus = 'ACTIVE';
      } else if (segments.length > 0) {
        if (lastEndTime && isCurrentTimeAfterShiftEnd(currentTime, lastEndTime)) {
          smartStatus = 'COMPLETED';
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
          endTimeFormatted: seg.endTime ? formatTimeForClient(seg.endTime, clientTimezone) : null
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

// =============================================================
//                    🔥 NEW SMART TIME COMPARISON FUNCTIONS
//    Add these new helper functions to your Apps Script
// =============================================================

/**
 * Check if current time is before shift start time
 */
function isCurrentTimeBeforeShiftStart(currentTime, shiftStartTime) {
  try {
    if (!currentTime || !shiftStartTime) return false;
    
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [shiftHour, shiftMinute] = shiftStartTime.split(':').map(Number);
    
    if (isNaN(currentHour) || isNaN(currentMinute) || isNaN(shiftHour) || isNaN(shiftMinute)) {
      return false;
    }
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const shiftMinutes = shiftHour * 60 + shiftMinute;
    
    return currentMinutes < shiftMinutes;
  } catch (error) {
    Logger.log('Error in isCurrentTimeBeforeShiftStart: ' + error.toString());
    return false;
  }
}

/**
 * Check if current time is after shift end time
 */
function isCurrentTimeAfterShiftEnd(currentTime, shiftEndTime) {
  try {
    if (!currentTime || !shiftEndTime) return false;
    
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [shiftHour, shiftMinute] = shiftEndTime.split(':').map(Number);
    
    if (isNaN(currentHour) || isNaN(currentMinute) || isNaN(shiftHour) || isNaN(shiftMinute)) {
      return false;
    }
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const shiftMinutes = shiftHour * 60 + shiftMinute;
    
    return currentMinutes > shiftMinutes;
  } catch (error) {
    Logger.log('Error in isCurrentTimeAfterShiftEnd: ' + error.toString());
    return false;
  }
}

/**
 * Check if current time falls in a gap between segments (ON BREAK)
 */
function checkForGapsBetweenSegments(segments, currentTime) {
  if (!segments || segments.length <= 1) return false;
  
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    if (isNaN(currentHour) || isNaN(currentMinute)) return false;
    
    const currentMinutes = currentHour * 60 + currentMinute;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegmentEnd = segments[i]?.endTime;
      const nextSegmentStart = segments[i + 1]?.startTime;
      
      if (currentSegmentEnd && nextSegmentStart) {
        const [endHour, endMinute] = currentSegmentEnd.split(':').map(Number);
        const [startHour, startMinute] = nextSegmentStart.split(':').map(Number);
        
        if (isNaN(endHour) || isNaN(endMinute) || isNaN(startHour) || isNaN(startMinute)) {
          continue;
        }
        
        const endMinutes = endHour * 60 + endMinute;
        const startMinutes = startHour * 60 + startMinute;
        
        // Check if current time falls in the gap between segments
        if (currentMinutes > endMinutes && currentMinutes < startMinutes) {
          return true; // Found a gap!
        }
      }
    }
    return false;
  } catch (error) {
    Logger.log('Error in checkForGapsBetweenSegments: ' + error.toString());
    return false;
  }
}

// =============================================================
//                    🔥 ENHANCED TIME HELPER FUNCTIONS
// =============================================================

/**
 * Enhanced getCurrentTimeString that accepts timezone from client
 * UPDATED VERSION with better error handling
 */
function getCurrentTimeString(clientTimezone) {
  try {
    if (clientTimezone) {
      // Use client's timezone if provided
      const now = new Date();
      return now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: clientTimezone 
      });
    } else {
      // Fallback to server timezone
      return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (error) {
    Logger.log('Error in timezone-aware getCurrentTimeString: ' + error.toString());
    // Fallback to server time if timezone conversion fails
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Format time for display - converts server time to user's timezone
 * IMPROVED VERSION with better null handling
 */
function formatTimeForClient(timeString, clientTimezone) {
  try {
    // Check if timeString is valid
    if (!timeString || timeString === null || timeString === undefined) {
      return null;
    }
    
    // Convert to string and check if it's a valid format
    const timeStr = String(timeString).trim();
    if (!timeStr || !timeStr.includes(':')) {
      return timeStr;
    }
    
    if (!clientTimezone) return timeStr;
    
    // Parse the time string (assumes HH:MM format)
    const timeParts = timeStr.split(':');
    if (timeParts.length < 2) return timeStr;
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    // Validate hours and minutes
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
    // Create a date object for today with this time
    const today = new Date();
    const timeDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    
    // Convert to client timezone
    return timeDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: clientTimezone
    });
  } catch (error) {
    Logger.log('Error formatting time for client: ' + error.toString());
    return String(timeString || '');
  }
}

// =============================================================
//                    🔥 DATABASE CLEANUP FUNCTION
//    OPTIONAL: Use this to fix existing impossible data
// =============================================================

/**
 * OPTIONAL: Fix all impossible shift statuses in your database
 * Run this once to clean up existing bad data
 */
function fixAllImpossibleShiftStatuses() {
  Logger.log('=== FIXING IMPOSSIBLE SHIFT STATUSES ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log('No shifts found to fix');
      return { success: true, message: 'No shifts to fix' };
    }
    
    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
    let fixedCount = 0;
    const currentTime = getCurrentTimeString(); // Use server time for consistency
    
    allData.forEach((row, index) => {
      const rowNumber = index + 2; // Actual sheet row number
      const segments = JSON.parse(row[9] || '[]');
      const storedStatus = row[10];
      
      // Check for impossible "COMPLETED" before shift starts
      if (storedStatus === 'COMPLETED' && segments.length > 0) {
        const firstStartTime = segments[0]?.startTime;
        if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
          // Fix the impossible status
          sheet.getRange(rowNumber, 11).setValue('DRAFT'); // Column K is status
          Logger.log(`🔧 FIXED Row ${rowNumber}: "${storedStatus}" → "DRAFT" (Shift marked completed at ${currentTime} for ${firstStartTime} start)`);
          fixedCount++;
        }
      }
    });
    
    Logger.log(`✅ Fixed ${fixedCount} impossible shift statuses`);
    return { success: true, message: `Fixed ${fixedCount} impossible shift statuses`, fixedCount: fixedCount };
    
  } catch (error) {
    Logger.log('❌ Error fixing shift statuses: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

// =============================================================
//                    📋 DEPLOYMENT INSTRUCTIONS
// =============================================================

/*
🚀 HOW TO DEPLOY THESE UPDATES:

1. COPY THE FUNCTIONS ABOVE:
   - getCurrentShift (replaces existing)
   - getShifts (replaces existing)  
   - isCurrentTimeBeforeShiftStart (NEW)
   - isCurrentTimeAfterShiftEnd (NEW)
   - checkForGapsBetweenSegments (NEW)
   - getCurrentTimeString (enhanced version)
   - formatTimeForClient (enhanced version)

2. PASTE INTO YOUR GOOGLE APPS SCRIPT:
   - Replace the existing functions with the same names
   - Add the new helper functions

3. OPTIONAL DATABASE CLEANUP:
   - Run fixAllImpossibleShiftStatuses() once to clean existing bad data

4. TEST THE UPDATE:
   - Your shift SH1758917398114 should now show "OFFLINE" instead of "COMPLETED"
   - Any shift before start time will show "OFFLINE"
   - Gaps between segments will show "ON BREAK"
   - Only actual completed shifts will show "COMPLETED"

🎯 WHAT THIS FIXES:
✅ No more "COMPLETED" before shift starts
✅ Shows "OFFLINE" when current time < shift start time  
✅ Shows "ON BREAK" when current time is between segments
✅ Shows "COMPLETED" only when current time > shift end time
✅ Handles timezone differences properly
✅ Works for both current shift and shift history
✅ Includes comprehensive error handling

🔥 RESULT: Your impossible shift data will now show the correct status!
*/