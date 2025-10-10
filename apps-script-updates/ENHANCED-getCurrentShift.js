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
    let foundRow = -1;

    // Loop from the end to find the most recent matching shift
    for (let i = allData.length - 1; i >= 0; i--) {
      const row = allData[i];
      const rowEmployeeId = String(row[2]).trim();
      const rowShiftDate = normalizeDate(row[3]);

      if (rowEmployeeId === employeeId && rowShiftDate === shiftDate) {
        foundRowData = row;
        foundRow = i + 2; // +2 for header and 0-based index
        Logger.log(`Match found in sheet row ${foundRow}`);
        break;
      }
    }

    if (!foundRowData) {
      Logger.log('No shift found for this user today.');
      return { success: true, data: null };
    }
    
    // Parse segments and check status
    const segments = JSON.parse(foundRowData[9] || '[]');
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    let currentStatus = foundRowData[10];
    
    // Check if shift should be marked as completed
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.endTime) {
      const now = getCurrentTimeString(clientTimezone);
      const lastEndTime = lastSegment.endTime;
      
      // Compare time components
      const [nowHour, nowMin] = now.split(':').map(Number);
      const [endHour, endMin] = lastEndTime.split(':').map(Number);
      const nowMinutes = nowHour * 60 + nowMin;
      const endMinutes = endHour * 60 + endMin;
      
      // If current time is after the last end time and there are no active segments
      if (nowMinutes > endMinutes && !hasActiveSegment) {
        currentStatus = 'COMPLETED';
        // Update the sheet
        sheet.getRange(foundRow, 11).setValue('COMPLETED');
        sheet.getRange(foundRow, 13).setValue(new Date());
      }
    }
    
    // Build the timezone-aware response object
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
      status: currentStatus, // Use the potentially updated status
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