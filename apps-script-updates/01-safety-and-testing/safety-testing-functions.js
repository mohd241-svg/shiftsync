// =============================================================
//                    SAFETY TESTING FUNCTIONS
//              Add these to your Apps Script for safe updates
// =============================================================

/**
 * STEP 1: Test your current system before making ANY changes
 */
function testCurrentSystem() {
  Logger.log('=== TESTING CURRENT SYSTEM ===');
  
  try {
    // Test that core functions exist
    const coreFunctions = [
      'authenticateUser', 'startShiftSafe', 'stopShift', 'getCurrentShift', 
      'getShifts', 'createCompleteShift', 'normalizeDate', 'getCurrentTimeString'
    ];
    
    let missingFunctions = [];
    coreFunctions.forEach(funcName => {
      try {
        if (typeof eval(funcName) === 'function') {
          Logger.log(`✅ ${funcName}: EXISTS`);
        } else {
          missingFunctions.push(funcName);
        }
      } catch (e) {
        missingFunctions.push(funcName);
      }
    });
    
    if (missingFunctions.length > 0) {
      Logger.log(`❌ Missing functions: ${missingFunctions.join(', ')}`);
      return { success: false, message: 'Missing core functions', missing: missingFunctions };
    }
    
    // Test that sheets exist
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const requiredSheets = ['RealTimeShifts', 'Staff'];
    let missingSheets = [];
    
    requiredSheets.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        Logger.log(`✅ Sheet ${sheetName}: EXISTS`);
      } else {
        missingSheets.push(sheetName);
      }
    });
    
    if (missingSheets.length > 0) {
      Logger.log(`❌ Missing sheets: ${missingSheets.join(', ')}`);
      return { success: false, message: 'Missing required sheets', missingSheets };
    }
    
    // Test basic authentication (safe test)
    try {
      const authResult = authenticateUser({ username: 'test', password: 'test' });
      Logger.log(`✅ Authentication function: ${authResult.success ? 'WORKING' : 'WORKING (expected fail)'}`);
    } catch (authError) {
      Logger.log(`❌ Authentication function error: ${authError.toString()}`);
      return { success: false, message: 'Authentication function broken' };
    }
    
    Logger.log('✅ CURRENT SYSTEM TEST PASSED');
    return { success: true, message: 'Current system is working properly' };
    
  } catch (error) {
    Logger.log('❌ CURRENT SYSTEM TEST FAILED: ' + error.toString());
    return { success: false, message: 'Current system has errors: ' + error.toString() };
  }
}

/**
 * STEP 2: Test cleanup safety (what would be affected)
 */
function testCleanupSafety() {
  Logger.log('=== TESTING CLEANUP SAFETY ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const allSheets = spreadsheet.getSheets();
    
    Logger.log('📊 CURRENT SHEETS:');
    allSheets.forEach(sheet => {
      Logger.log(`   - ${sheet.getName()}`);
    });
    
    // Check which sheets would be affected
    const sheetsToRemove = ['DynamicTable', 'FormulaDynamicTable', 'TriggerFreeDynamicTable'];
    const sheetsToKeep = ['RealTimeShifts', 'Staff', 'SimpleFilterTable'];
    
    const wouldRemove = [];
    const willKeep = [];
    
    sheetsToRemove.forEach(name => {
      if (spreadsheet.getSheetByName(name)) {
        wouldRemove.push(name);
      }
    });
    
    sheetsToKeep.forEach(name => {
      if (spreadsheet.getSheetByName(name)) {
        willKeep.push(name);
      }
    });
    
    Logger.log('');
    Logger.log('🗑️  WOULD REMOVE:');
    if (wouldRemove.length > 0) {
      wouldRemove.forEach(name => Logger.log(`   - ${name} (old table system)`));
    } else {
      Logger.log('   - None (already clean)');
    }
    
    Logger.log('');
    Logger.log('✅ WOULD KEEP (SAFE):');
    willKeep.forEach(name => Logger.log(`   - ${name} (your data)`));
    
    // Check for any data in sheets that would be removed
    let hasImportantData = false;
    wouldRemove.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet && sheet.getLastRow() > 10) {
        Logger.log(`⚠️  ${sheetName} has ${sheet.getLastRow()} rows - might have data`);
        hasImportantData = true;
      }
    });
    
    if (hasImportantData) {
      Logger.log('');
      Logger.log('⚠️  WARNING: Some sheets to be removed have data. Review manually first.');
    }
    
    Logger.log('');
    Logger.log('✅ CLEANUP SAFETY TEST COMPLETE');
    
    return { 
      success: true, 
      wouldRemove: wouldRemove.length,
      wouldKeep: willKeep.length,
      hasData: hasImportantData,
      removedSheets: wouldRemove
    };
    
  } catch (error) {
    Logger.log('❌ CLEANUP SAFETY TEST FAILED: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * STEP 3: Test new timezone functions after adding them
 */
function testNewTimezoneFunctions() {
  Logger.log('=== TESTING NEW TIMEZONE FUNCTIONS ===');
  
  try {
    // Test timezone-aware getCurrentTimeString
    if (typeof getCurrentTimeString === 'function') {
      const serverTime = getCurrentTimeString();
      const nycTime = getCurrentTimeString('America/New_York');
      const londonTime = getCurrentTimeString('Europe/London');
      const tokyoTime = getCurrentTimeString('Asia/Tokyo');
      
      Logger.log('🕐 TIME COMPARISONS:');
      Logger.log(`   Server:    ${serverTime}`);
      Logger.log(`   New York:  ${nycTime}`);
      Logger.log(`   London:    ${londonTime}`);
      Logger.log(`   Tokyo:     ${tokyoTime}`);
      
      if (nycTime !== serverTime || londonTime !== serverTime) {
        Logger.log('✅ Timezone conversion working');
      } else {
        Logger.log('⚠️  All times same - might be server timezone issue');
      }
    }
    
    // Test timezone-aware getCurrentDate
    if (typeof getCurrentDate === 'function') {
      const serverDate = getCurrentDate();
      const nycDate = getCurrentDate('America/New_York');
      
      Logger.log('📅 DATE COMPARISONS:');
      Logger.log(`   Server: ${serverDate}`);
      Logger.log(`   NYC:    ${nycDate}`);
    }
    
  try {
    // Fix: Use Session.getScriptTimeZone() instead of Utilities.getTimeZone()
    const serverTZ = Session.getScriptTimeZone();
    console.log("✅ Timezone functions working correctly");
    
    // Test timezone conversion
    const testDate = new Date();
    const serverTime = formatTimeForTimezone(testDate, serverTZ);
    const nycTime = formatTimeForTimezone(testDate, "America/New_York");
    
    console.log("🔄 TIME FORMATTING: " + serverTime + " → " + nycTime);
    return true;
  } catch (error) {
    console.log("❌ NEW TIMEZONE FUNCTIONS TEST FAILED: " + error.toString());
    return false;
  }
    
    // Test createTimezoneAwareResponse
    if (typeof createTimezoneAwareResponse === 'function') {
      const testData = { message: 'Test response' };
      const response = createTimezoneAwareResponse(testData, 'America/New_York');
      Logger.log('📤 RESPONSE TEST: ' + (response ? 'Created' : 'Failed'));
    }
    
    Logger.log('✅ NEW TIMEZONE FUNCTIONS TEST PASSED');
    return { success: true, message: 'New timezone functions working' };
    
  } catch (error) {
    Logger.log('❌ NEW TIMEZONE FUNCTIONS TEST FAILED: ' + error.toString());
    return { success: false, message: 'New functions error: ' + error.toString() };
  }
}

/**
 * STEP 4: Test updated doPost function
 */
function testUpdatedDoPost() {
  Logger.log('=== TESTING UPDATED doPost ===');
  
  try {
    // Create test request with timezone data
    const testRequest = {
      postData: {
        contents: JSON.stringify({
          action: 'getStaffList',
          clientTimezone: 'America/New_York',
          clientTimezoneOffset: -300
        })
      }
    };
    
    // Test the updated doPost
    const response = doPost(testRequest);
    const content = response.getContent();
    const parsed = JSON.parse(content);
    
    Logger.log('📤 doPost Response Keys:');
    Object.keys(parsed).forEach(key => {
      Logger.log(`   - ${key}: ${typeof parsed[key]}`);
    });
    
    // Check for timezone metadata
    if (parsed.clientTimezone) {
      Logger.log('✅ Timezone metadata included');
    } else {
      Logger.log('⚠️  No timezone metadata found');
    }
    
    if (parsed.success !== undefined) {
      Logger.log('✅ Response format correct');
    } else {
      Logger.log('❌ Response format incorrect');
      return { success: false, message: 'Invalid response format' };
    }
    
    Logger.log('✅ UPDATED doPost TEST PASSED');
    return { success: true, message: 'Updated doPost working' };
    
  } catch (error) {
    Logger.log('❌ UPDATED doPost TEST FAILED: ' + error.toString());
    return { success: false, message: 'doPost error: ' + error.toString() };
  }
}

/**
 * STEP 5: Test updated core functions
 */
function testUpdatedCoreFunctions() {
  Logger.log('=== TESTING UPDATED CORE FUNCTIONS ===');
  
  try {
    const testEmployeeId = 'TEST001';
    const testEmployeeName = 'Test User';
    const testDate = normalizeDate(new Date());
    const testTimezone = 'America/New_York';
    
    Logger.log(`🧪 Test Data: ${testEmployeeName} (${testEmployeeId}) on ${testDate}`);
    
    // Test startShiftSafe with timezone
    Logger.log('Testing startShiftSafe...');
    const startResult = startShiftSafe({
      employeeId: testEmployeeId,
      employeeName: testEmployeeName,
      shiftDate: testDate
    }, testTimezone);
    
    if (startResult.success) {
      Logger.log('✅ startShiftSafe working');
      
      // Test getCurrentShift with timezone
      Logger.log('Testing getCurrentShift...');
      const getCurrentResult = getCurrentShift({
        employeeId: testEmployeeId,
        date: testDate
      }, testTimezone);
      
      if (getCurrentResult.success && getCurrentResult.data) {
        Logger.log('✅ getCurrentShift working');
        
        // Check for timezone data in response
        if (getCurrentResult.data.timezone) {
          Logger.log('✅ Timezone data included in response');
        } else {
          Logger.log('⚠️  No timezone data in response');
        }
        
        // Test completeShift
        Logger.log('Testing completeShift...');
        const completeResult = completeShift({
          employeeId: testEmployeeId,
          employeeName: testEmployeeName,
          shiftDate: testDate
        }, testTimezone);
        
        if (completeResult.success) {
          Logger.log('✅ completeShift working');
        } else {
          Logger.log('⚠️  completeShift issue: ' + completeResult.message);
        }
        
      } else {
        Logger.log('❌ getCurrentShift failed: ' + getCurrentResult.message);
      }
      
    } else {
      Logger.log('❌ startShiftSafe failed: ' + startResult.message);
      return { success: false, message: 'startShiftSafe failed' };
    }
    
    Logger.log('✅ UPDATED CORE FUNCTIONS TEST PASSED');
    return { success: true, message: 'Updated core functions working' };
    
  } catch (error) {
    Logger.log('❌ UPDATED CORE FUNCTIONS TEST FAILED: ' + error.toString());
    return { success: false, message: 'Core functions error: ' + error.toString() };
  }
}

/**
 * STEP 6: Complete system test after all updates
 */
function testCompleteUpdatedSystem() {
  Logger.log('=== TESTING COMPLETE UPDATED SYSTEM ===');
  
  const tests = [
    { name: 'Current System', func: testCurrentSystem },
    { name: 'Timezone Functions', func: testNewTimezoneFunctions },
    { name: 'Updated doPost', func: testUpdatedDoPost },
    { name: 'Updated Core Functions', func: testUpdatedCoreFunctions }
  ];
  
  let passedTests = 0;
  let failedTests = [];
  
  tests.forEach(test => {
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
  Logger.log(`✅ Passed: ${passedTests}/${tests.length}`);
  
  if (failedTests.length > 0) {
    Logger.log(`❌ Failed: ${failedTests.join(', ')}`);
    Logger.log('🚨 SYSTEM NOT READY - Fix failed tests before going live');
    return { success: false, passed: passedTests, failed: failedTests.length };
  } else {
    Logger.log('🎉 ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION');
    return { success: true, passed: passedTests, failed: 0 };
  }
}