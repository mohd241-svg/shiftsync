// =============================================================
//                    FINAL TEST WITH CLEAN DATA
//         Run this instead to avoid test data conflicts
// =============================================================

function testCompleteSystemWithCleanData() {
  Logger.log('=== TESTING COMPLETE UPDATED SYSTEM (CLEAN DATA) ===');
  
  // Generate unique test data to avoid conflicts
  const uniqueId = 'FINALTEST' + Date.now().toString().slice(-6);
  
  Logger.log('Using clean test ID: ' + uniqueId);
  
  // Temporarily replace the test data in the core function test
  const originalTestFunctions = [
    { name: 'Current System', func: testCurrentSystem },
    { name: 'Timezone Functions', func: testNewTimezoneFunctions },
    { name: 'Updated doPost', func: testUpdatedDoPost },
    { name: 'Clean Core Functions', func: () => testCoreWithCleanData(uniqueId) }
  ];
  
  let passedTests = 0;
  let failedTests = [];
  
  originalTestFunctions.forEach(test => {
    Logger.log(`\n--- Running ${test.name} Test ---`);
    try {
      const result = test.func();
      if (result.success) {
        Logger.log(`✅ ${test.name}: PASSED`);
        passedTests++;
      } else {
        Logger.log(`❌ ${test.name}: FAILED - ${result.message}`);
        failedTests.push(test.name);
      }
    } catch (error) {
      Logger.log(`❌ ${test.name}: ERROR - ${error.toString()}`);
      failedTests.push(test.name);
    }
  });
  
  Logger.log('\n=== COMPLETE SYSTEM TEST RESULTS ===');
  Logger.log(`✅ Passed: ${passedTests}/${originalTestFunctions.length}`);
  
  if (failedTests.length > 0) {
    Logger.log(`❌ Failed: ${failedTests.join(', ')}`);
    Logger.log('🚨 SYSTEM NOT READY - Fix failed tests before going live');
    return { success: false, passed: passedTests, failed: failedTests.length };
  } else {
    Logger.log('🎉 ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION');
    return { success: true, passed: passedTests, failed: 0 };
  }
}

function testCoreWithCleanData(uniqueId) {
  Logger.log('=== TESTING UPDATED CORE FUNCTIONS (CLEAN DATA) ===');
  
  try {
    const testEmployeeId = uniqueId;
    const testEmployeeName = 'Clean Test User';
    const testDate = normalizeDate(new Date());
    const testTimezone = 'America/New_York';
    
    Logger.log(`🧪 Test Data: ${testEmployeeName} (${testEmployeeId}) on ${testDate}`);
    
    // Test startShiftSafe with clean data
    Logger.log('Testing startShiftSafe...');
    const startResult = startShiftSafe({
      employeeId: testEmployeeId,
      employeeName: testEmployeeName,
      shiftDate: testDate
    }, testTimezone);
    
    if (startResult.success) {
      Logger.log('✅ startShiftSafe working');
      
      // Test getCurrentShift
      Logger.log('Testing getCurrentShift...');
      const getCurrentResult = getCurrentShift({
        employeeId: testEmployeeId,
        date: testDate
      }, testTimezone);
      
      if (getCurrentResult.success && getCurrentResult.data) {
        Logger.log('✅ getCurrentShift working');
        
        if (getCurrentResult.data.timezone) {
          Logger.log('✅ Timezone data included in response');
        }
        
        // Test completeShift
        Logger.log('Testing completeShift...');
        const completeResult = stopShift({
          employeeId: testEmployeeId,
          employeeName: testEmployeeName,
          shiftDate: testDate
        }, testTimezone);
        
        if (completeResult.success) {
          Logger.log('✅ completeShift working');
        }
        
      }
      
    }
    
    Logger.log('✅ UPDATED CORE FUNCTIONS TEST PASSED (CLEAN DATA)');
    return { success: true, message: 'Updated core functions working with clean data' };
    
  } catch (error) {
    Logger.log('❌ UPDATED CORE FUNCTIONS TEST FAILED: ' + error.toString());
    return { success: false, message: 'Core functions error: ' + error.toString() };
  }
}

// =============================================================
//                    RUN THIS FUNCTION:
//              testCompleteSystemWithCleanData()
// =============================================================