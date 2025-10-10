function syncShiftStatus(data, clientTimezone) {
  try {
    if (!data.shiftId || !data.newStatus) {
      return { success: false, message: 'Missing required fields: shiftId, newStatus' };
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
    if (!sheet) { return { success: false, message: 'Shift sheet not found' }; }

    // Find the row with this shift ID
    const lastRow = sheet.getLastRow();
    const shiftIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let targetRow = -1;
    
    for (let i = 0; i < shiftIds.length; i++) {
      if (shiftIds[i][0] === data.shiftId) {
        targetRow = i + 2; // Add 2 for header and 0-based index
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: 'Shift not found' };
    }

    // Update the status
    sheet.getRange(targetRow, 11).setValue(data.newStatus);
    sheet.getRange(targetRow, 13).setValue(new Date());

    // If marking as completed, ensure all segments are closed
    if (data.newStatus === 'COMPLETED') {
      const segments = JSON.parse(sheet.getRange(targetRow, 10).getValue() || '[]');
      let needsUpdate = false;

      segments.forEach(segment => {
        if (!segment.endTime) {
          segment.endTime = getCurrentTimeString(clientTimezone);
          segment.duration = calculateDuration(segment.startTime, segment.endTime);
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);
        sheet.getRange(targetRow, 7).setValue(segments[segments.length - 1].endTime);
        sheet.getRange(targetRow, 8).setValue(totalDuration);
        sheet.getRange(targetRow, 10).setValue(JSON.stringify(segments));
      }
    }

    return {
      success: true,
      message: `Shift status updated to ${data.newStatus}`,
      data: {
        shiftId: data.shiftId,
        status: data.newStatus,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    Logger.log('Error syncing shift status: ' + error.toString());
    return { success: false, message: 'Failed to sync status: ' + error.toString() };
  }
}