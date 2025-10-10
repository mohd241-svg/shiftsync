/**
 * Special test function to diagnose status calculation issues
 * Copy this entire function to your Apps Script editor and run it
 */
function testStatusCalculation() {
  Logger.log('=== 🧪 STARTING STATUS CALCULATION TEST ===');
  
  // Test data matching your actual shift
  const realShiftData = {
    shiftId: 'SH1759334466097',
    employeeName: 'Javed Hussain',
    employeeId: 'EMP004',
    shiftDate: '2025-10-01',
    segments: [{
      segmentId: 1,
      startTime: '09:30',
      endTime: '21:33',
      duration: 12.05
    }],
    status: 'ACTIVE'  // Current status in sheet
  };
  
  // Current time test cases
  const testTimes = [
    '21:32', // Just before end
    '21:33', // At end time
    '21:34', // Just after end
    '21:48', // Current real time
    '22:00'  // Well after end
  ];
  
  Logger.log('\n1️⃣ Testing isCurrentTimeAfterShiftEnd function:');
  testTimes.forEach(time => {
    const result = isCurrentTimeAfterShiftEnd(time, realShiftData.segments[0].endTime);
    Logger.log(`Time ${time} vs End ${realShiftData.segments[0].endTime}: isAfter = ${result}`);
  });
  
  Logger.log('\n2️⃣ Testing calculateSmartStatus function:');
  testTimes.forEach(time => {
    const result = calculateSmartStatus(realShiftData.segments, time);
    Logger.log(`Time ${time}: Status = ${result}`);
  });
  
  Logger.log('\n3️⃣ Testing full updateShiftStatus function:');
  const shiftId = realShiftData.shiftId;
  
  // Find the shift in the sheet
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHIFTS_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const allData = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  
  let targetRow = -1;
  allData.forEach((row, index) => {
    if (row[0] === shiftId) {
      targetRow = index + 2;
      Logger.log(`Found shift at row ${targetRow}`);
      
      // Log current sheet values
      Logger.log('Current sheet values:');
      Logger.log(`Status (col K): ${row[10]}`);
      Logger.log(`Last End Time (col G): ${row[6]}`);
      Logger.log(`Segments (col J): ${row[9]}`);
    }
  });
  
  if (targetRow > 0) {
    Logger.log('\nPerforming manual status check:');
    const currentTime = getCurrentTimeString();
    Logger.log(`Current time: ${currentTime}`);
    
    // Test time comparison directly
    const endTime = realShiftData.segments[0].endTime;
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    Logger.log(`Current time in minutes: ${currentMinutes}`);
    Logger.log(`End time in minutes: ${endMinutes}`);
    Logger.log(`Difference: ${currentMinutes - endMinutes} minutes`);
    
    // Calculate what the status should be
    const segments = JSON.parse(allData[targetRow - 2][9]);
    const shouldBeCompleted = isCurrentTimeAfterShiftEnd(currentTime, endTime);
    Logger.log(`Should be completed? ${shouldBeCompleted}`);
    
    const smartStatus = calculateSmartStatus(segments, currentTime);
    Logger.log(`Smart status calculation says: ${smartStatus}`);
  }
  
  Logger.log('\n=== 🏁 TEST COMPLETE ===');
  Logger.log('Please share these logs to get detailed analysis of the issue');
}

/**
 * Additional test function to verify time comparisons
 */
function testTimeComparisons() {
  Logger.log('=== ⏰ TESTING TIME COMPARISONS ===');
  
  const testCases = [
    { current: '21:48', end: '21:33', desc: 'Real case - 15 mins after' },
    { current: '21:33', end: '21:33', desc: 'Exact same time' },
    { current: '21:32', end: '21:33', desc: '1 min before' },
    { current: '21:34', end: '21:33', desc: '1 min after' },
    { current: '23:59', end: '21:33', desc: 'Late night same day' },
    { current: '00:01', end: '21:33', desc: 'Next day early morning' }
  ];
  
  testCases.forEach(test => {
    Logger.log(`\nTest: ${test.desc}`);
    Logger.log(`Comparing current ${test.current} vs end ${test.end}`);
    
    const result = isCurrentTimeAfterShiftEnd(test.current, test.end);
    Logger.log(`Result: ${result ? 'IS AFTER ✅' : 'NOT AFTER ❌'}`);
    
    // Show the math
    const [currentHour, currentMinute] = test.current.split(':').map(Number);
    const [endHour, endMinute] = test.end.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    Logger.log(`Current time in minutes: ${currentMinutes}`);
    Logger.log(`End time in minutes: ${endMinutes}`);
    Logger.log(`Difference: ${currentMinutes - endMinutes} minutes`);
  });
  
  Logger.log('\n=== ⏰ TIME TESTS COMPLETE ===');
}