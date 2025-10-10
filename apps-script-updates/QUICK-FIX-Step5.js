// =============================================================
//                    QUICK FIX for Step 5 Error  
//   Copy this code to replace the existing timezone functions
// =============================================================

/**
 * Enhanced response creator that includes timezone metadata
 * FIX: Use Session.getScriptTimeZone() instead of Utilities.getTimeZone()
 */
function createTimezoneAwareResponse(data, clientTimezone) {
  // Fix: Use Session.getScriptTimeZone() instead of Utilities.getTimeZone()
  const serverTimezone = Session.getScriptTimeZone();
  
  const response = {
    ...data,
    serverTimezone: serverTimezone,
    clientTimezone: clientTimezone || null,
    serverTime: new Date().toISOString(),
    responseGeneratedAt: new Date().toLocaleString('en-US', {
      timeZone: clientTimezone || serverTimezone
    })
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function with the fix applied
 */
function testNewTimezoneFunctionsFixed() {
  Logger.log('=== TESTING NEW TIMEZONE FUNCTIONS (FIXED) ===');
  
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
    
    // Test formatTimeForTimezone (fixed version)
    if (typeof formatTimeForTimezone === 'function') {
      // FIX: Use Session.getScriptTimeZone() instead of Utilities.getTimeZone()
      const serverTZ = Session.getScriptTimeZone();
      Logger.log("✅ Server timezone detection working: " + serverTZ);
      
      // Test timezone conversion
      const testDate = new Date();
      const serverTime = formatTimeForTimezone(testDate, serverTZ);
      const nycTime = formatTimeForTimezone(testDate, "America/New_York");
      
      Logger.log("🔄 TIME FORMATTING: " + serverTime + " → " + nycTime);
    }
    
    // Test createTimezoneAwareResponse
    if (typeof createTimezoneAwareResponse === 'function') {
      const testData = { message: 'Test response' };
      const response = createTimezoneAwareResponse(testData, 'America/New_York');
      Logger.log('📤 RESPONSE TEST: ' + (response ? 'Created' : 'Failed'));
    }
    
    Logger.log('✅ NEW TIMEZONE FUNCTIONS TEST PASSED (FIXED)');
    return { success: true, message: 'New timezone functions working' };
    
  } catch (error) {
    Logger.log('❌ NEW TIMEZONE FUNCTIONS TEST FAILED: ' + error.toString());
    return { success: false, message: 'New functions error: ' + error.toString() };
  }
}

// =============================================================
//                    WHAT TO DO:
// 
// 1. In your Apps Script editor, find the createTimezoneAwareResponse function
// 2. Replace line: const response = { ...data, serverTimezone: Utilities.getTimeZone(),
// 3. With line: const response = { ...data, serverTimezone: Session.getScriptTimeZone(),
// 4. Run testNewTimezoneFunctionsFixed() instead of testNewTimezoneFunctions()
// 
// OR just copy the fixed createTimezoneAwareResponse function above 
// and replace the old one completely.
// =============================================================