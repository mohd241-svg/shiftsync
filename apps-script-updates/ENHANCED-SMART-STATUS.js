// =============================================================
//             🔥 ENHANCED SMART STATUS FUNCTIONALITY
//    Add these functions to your Google Apps Script backend
// =============================================================

/**
 * Ensures that shift status is up-to-date based on current time and shift data
 */
function updateShiftStatus(shiftId, clientTimezone) {
  try {
    Logger.log(`🔄 Updating status for shift ${shiftId}`);
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ Shift sheet not found');
      return { success: false, message: 'Shift sheet not found' };
    }

    // Find the row with this shift ID
    const lastRow = sheet.getLastRow();
    const shiftIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let targetRow = -1;
    
    for (let i = 0; i < shiftIds.length; i++) {
      if (shiftIds[i][0] === shiftId) {
        targetRow = i + 2; // Add 2 for header and 0-based index
        break;
      }
    }

    if (targetRow === -1) {
      Logger.log('❌ Shift not found');
      return { success: false, message: 'Shift not found' };
    }

    // Get shift data
    const rowData = sheet.getRange(targetRow, 1, 1, 13).getValues()[0];
    const segments = JSON.parse(rowData[9] || '[]');
    const currentStatus = rowData[10];
    
    // Calculate what the status should be
    const currentTime = getCurrentTimeString(clientTimezone);
    let newStatus = calculateSmartStatus(segments, currentTime);

    Logger.log(`Current status: ${currentStatus}, Calculated status: ${newStatus}`);

    if (newStatus !== currentStatus) {
      Logger.log(`🔄 Status change needed: ${currentStatus} → ${newStatus}`);
      
      // Update status in sheet
      sheet.getRange(targetRow, 11).setValue(newStatus);
      sheet.getRange(targetRow, 13).setValue(new Date());

      // If marking as completed, ensure all segments are closed
      if (newStatus === 'COMPLETED') {
        let needsUpdate = false;
        segments.forEach(segment => {
          if (!segment.endTime) {
            segment.endTime = currentTime;
            segment.duration = calculateDuration(segment.startTime, currentTime);
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
          sheet.getRange(targetRow, 7).setValue(currentTime); // Last end time
          sheet.getRange(targetRow, 8).setValue(totalDuration);
          sheet.getRange(targetRow, 10).setValue(JSON.stringify(segments));
        }
      }

      return {
        success: true,
        message: `Status updated from ${currentStatus} to ${newStatus}`,
        data: {
          shiftId: shiftId,
          oldStatus: currentStatus,
          newStatus: newStatus,
          updatedAt: new Date().toISOString()
        }
      };
    }

    return {
      success: true,
      message: 'Status is already correct',
      data: {
        shiftId: shiftId,
        status: currentStatus,
        noUpdateNeeded: true
      }
    };

  } catch (error) {
    Logger.log('❌ Error updating shift status: ' + error.toString());
    return { success: false, message: 'Failed to update status: ' + error.toString() };
  }
}

/**
 * Calculates what a shift's status should be based on current time and segments
 */
function calculateSmartStatus(segments, currentTime) {
  try {
    if (!segments || segments.length === 0) return 'DRAFT';

    const firstStartTime = segments[0].startTime;
    const lastSegment = segments[segments.length - 1];

    // Check if current time is before shift starts
    if (isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
      return 'OFFLINE';
    }

    // Check for active segments
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    if (hasActiveSegment) {
      return 'ACTIVE';
    }

    // All segments are completed, check if we're past the last end time
    if (lastSegment && lastSegment.endTime) {
      if (isCurrentTimeAfterShiftEnd(currentTime, lastSegment.endTime)) {
        return 'COMPLETED';
      }

      // Check for gaps between segments
      if (checkForGapsBetweenSegments(segments, currentTime)) {
        return 'ON BREAK';
      }
    }

    return 'ON BREAK';

  } catch (error) {
    Logger.log('Error calculating smart status: ' + error.toString());
    return 'DRAFT'; // Safe fallback
  }
}

/**
 * Checks if the current time is before a shift's start time
 */
function isCurrentTimeBeforeShiftStart(currentTime, startTime) {
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    
    return currentMinutes < startMinutes;
  } catch (error) {
    Logger.log('Error comparing start times: ' + error.toString());
    return false;
  }
}

/**
 * Checks if the current time is after a shift's end time
 */
function isCurrentTimeAfterShiftEnd(currentTime, endTime) {
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return currentMinutes > endMinutes;
  } catch (error) {
    Logger.log('Error comparing end times: ' + error.toString());
    return false;
  }
}

/**
 * Checks if current time falls in a gap between segments
 */
function checkForGapsBetweenSegments(segments, currentTime) {
  try {
    if (segments.length <= 1) return false;

    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegment = segments[i];
      const nextSegment = segments[i + 1];

      if (currentSegment.endTime && nextSegment.startTime) {
        const [endHour, endMinute] = currentSegment.endTime.split(':').map(Number);
        const [startHour, startMinute] = nextSegment.startTime.split(':').map(Number);

        const endMinutes = endHour * 60 + endMinute;
        const startMinutes = startHour * 60 + startMinute;

        if (currentMinutes > endMinutes && currentMinutes < startMinutes) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    Logger.log('Error checking gaps between segments: ' + error.toString());
    return false;
  }
}

// Add to your doPost function's switch statement:
// case 'syncShiftStatus':
//   response = updateShiftStatus(data.shiftId, clientTimezone);
//   break;