// Replace the isCurrentTimeAfterShiftEnd function with this one
function isCurrentTimeAfterShiftEnd(currentTime, lastEndTime) {
  try {
    Logger.log(`🕒 Comparing times - Current: ${currentTime}, End: ${lastEndTime}`);
    
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [endHour, endMinute] = lastEndTime.split(':').map(Number);
    
    if (isNaN(currentHour) || isNaN(currentMinute) || isNaN(endHour) || isNaN(endMinute)) {
      Logger.log('⚠️ Invalid time format in comparison');
      return false;
    }
    
    let currentMinutes = currentHour * 60 + currentMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    // Handle midnight crossover: if current time is between 00:00 and 03:59,
    // and end time is between 18:00 and 23:59, assume it's the next day
    if (currentHour >= 0 && currentHour < 4 && endHour >= 18 && endHour <= 23) {
      currentMinutes = (currentHour + 24) * 60 + currentMinute;
      Logger.log(`🌙 Midnight crossover detected: Adjusted current minutes to ${currentMinutes}`);
    }
    
    const difference = currentMinutes - endMinutes;
    Logger.log(`🔍 Time difference: ${difference} minutes`);
    
    return difference > 0;
  } catch (error) {
    Logger.log('Error in isCurrentTimeAfterShiftEnd: ' + error.toString());
    return false;
  }
}

// Replace the calculateSmartStatus function with this one
function calculateSmartStatus(segments, currentTime) {
  try {
    Logger.log(`🔄 Calculating smart status at ${currentTime}`);
    
    if (!segments || segments.length === 0) {
      Logger.log('No segments found - DRAFT');
      return 'DRAFT';
    }

    const firstStartTime = segments[0].startTime;
    const lastSegment = segments[segments.length - 1];

    // First priority: Check if all segments are ended and current time is after last segment
    if (lastSegment && lastSegment.endTime) {
      Logger.log(`Checking completion: Current=${currentTime} vs LastEnd=${lastSegment.endTime}`);
      if (isCurrentTimeAfterShiftEnd(currentTime, lastSegment.endTime)) {
        Logger.log('Past end time - COMPLETED');
        return 'COMPLETED';
      }
    }

    // Second priority: Check if shift hasn't started yet
    if (isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
      Logger.log('Before start time - OFFLINE');
      return 'OFFLINE';
    }

    // Third priority: Check for active segments
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    if (hasActiveSegment) {
      Logger.log('Has active segment - ACTIVE');
      return 'ACTIVE';
    }

    Logger.log('All segments complete but within shift time - ON BREAK');
    return 'ON BREAK';
  } catch (error) {
    Logger.log('Error calculating smart status: ' + error.toString());
    return 'DRAFT'; // Safe fallback
  }
}

// Add these test functions
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

function testMidnightCrossover() {
  Logger.log('=== 🌙 TESTING MIDNIGHT CROSSOVER SCENARIOS ===');
  
  const testCases = [
    { current: '00:01', end: '21:33', desc: 'Just after midnight vs previous evening' },
    { current: '01:30', end: '23:45', desc: 'Early morning vs late night' },
    { current: '03:59', end: '22:00', desc: 'Before 4am vs previous night' },
    { current: '04:00', end: '22:00', desc: 'At 4am vs previous night' },
    { current: '23:59', end: '21:33', desc: 'Late night vs earlier evening' },
    { current: '22:00', end: '21:33', desc: 'Evening vs earlier evening' },
  ];
  
  testCases.forEach(test => {
    Logger.log(`\nTest: ${test.desc}`);
    const result = isCurrentTimeAfterShiftEnd(test.current, test.end);
    Logger.log(`Result: ${result ? 'IS AFTER ✅' : 'NOT AFTER ❌'}`);
  });
  
  Logger.log('\n=== 🌙 MIDNIGHT CROSSOVER TESTS COMPLETE ===');
}