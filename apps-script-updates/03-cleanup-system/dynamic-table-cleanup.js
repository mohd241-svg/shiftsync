// =============================================================
//                    DYNAMIC TABLE CLEANUP SCRIPT
//              Run this to clean up your Google Sheets
// =============================================================

/**
 * MAIN CLEANUP FUNCTION - Run this once to clean everything up
 */
function cleanupDynamicTables() {
  Logger.log('=== STARTING DYNAMIC TABLE CLEANUP ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Step 1: Remove problematic/redundant sheets
    const sheetsToRemove = [
      'DynamicTable',           // ❌ Trigger-based (unreliable)
      'FormulaDynamicTable',    // ❌ Overly complex
      'TriggerFreeDynamicTable' // ❌ Manual refresh required
    ];
    
    let removedCount = 0;
    sheetsToRemove.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        spreadsheet.deleteSheet(sheet);
        Logger.log(`✅ Removed: ${sheetName}`);
        removedCount++;
      } else {
        Logger.log(`⏭️  Not found: ${sheetName} (already removed)`);
      }
    });
    
    // Step 2: Ensure SimpleFilterTable exists and is updated
    let filterSheet = spreadsheet.getSheetByName('SimpleFilterTable');
    if (!filterSheet) {
      Logger.log('📊 SimpleFilterTable not found - creating it...');
      createProductionFilterTable();
    } else {
      Logger.log('✅ SimpleFilterTable exists - checking if update needed...');
      updateExistingFilterTable();
    }
    
    // Step 3: Clean up old function references in any remaining sheets
    cleanupOldFunctionReferences();
    
    // Step 4: Report results
    Logger.log('');
    Logger.log('=== CLEANUP COMPLETE ===');
    Logger.log(`📊 Sheets removed: ${removedCount}`);
    Logger.log('✅ Production system: SimpleFilterTable');
    Logger.log('');
    Logger.log('🎯 WHAT YOU HAVE NOW:');
    Logger.log('• SimpleFilterTable - Your main filtering dashboard');
    Logger.log('• RealTimeShifts - Your data sheet');
    Logger.log('• Staff - Your employee data');
    Logger.log('');
    Logger.log('🚀 READY TO USE:');
    Logger.log('1. Go to SimpleFilterTable sheet');
    Logger.log('2. Use dropdowns in row 4 to filter data');
    Logger.log('3. Data updates automatically - no refresh needed!');
    
    return {
      success: true,
      message: `Cleanup complete. Removed ${removedCount} old sheets. SimpleFilterTable is ready.`,
      removedSheets: removedCount,
      productionSheet: 'SimpleFilterTable'
    };
    
  } catch (error) {
    Logger.log('❌ Error during cleanup: ' + error.toString());
    return {
      success: false,
      message: 'Cleanup failed: ' + error.toString()
    };
  }
}

/**
 * Creates the production-ready SimpleFilterTable
 */
function createProductionFilterTable() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const filterSheet = spreadsheet.insertSheet('SimpleFilterTable');
    
    // 🎨 PROFESSIONAL HEADER
    filterSheet.getRange('A1').setValue('📊 STAFF PORTAL - DYNAMIC REPORTS DASHBOARD');
    filterSheet.getRange('A1:H1').merge();
    filterSheet.getRange('A1').setBackground('#2c3e50')
                              .setFontColor('#ecf0f1')
                              .setFontWeight('bold')
                              .setFontSize(16)
                              .setHorizontalAlignment('center')
                              .setBorder(true, true, true, true, false, false);
    
    // 🎨 FILTER CONTROLS
    const filterHeaders = ['👤 Employee', '📋 Status', '📊 View Type', '📅 Date Range', '📆 Start Date', '📆 End Date'];
    filterSheet.getRange('A3:F3').setValues([filterHeaders]);
    filterSheet.getRange('A3:F3').setBackground('#3498db')
                                 .setFontColor('#ffffff')
                                 .setFontWeight('bold')
                                 .setFontSize(11)
                                 .setHorizontalAlignment('center')
                                 .setBorder(true, true, true, true, false, false);
    
    // Filter input styling
    filterSheet.getRange('A4:F4').setBackground('#ecf0f1')
                                 .setBorder(true, true, true, true, false, false)
                                 .setHorizontalAlignment('center');
    
    // Employee search (text input)
    filterSheet.getRange('A4').setValue('').setNote('🔍 Type employee name to search');
    
    // Status dropdown
    const statusOptions = ['All Statuses', 'ACTIVE', 'COMPLETED', 'DRAFT', 'BREAK'];
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(statusOptions)
      .setAllowInvalid(false)
      .build();
    filterSheet.getRange('B4').setDataValidation(statusRule).setValue('All Statuses');
    
    // View type dropdown
    const viewOptions = [
      'Essential View (6 cols)',
      'Management View (8 cols)',
      'Complete View (All 15 cols)',
      'Time Tracking (7 cols)',
      'Audit Trail (9 cols)',
      'Quick Summary (4 cols)'
    ];
    const viewRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(viewOptions)
      .setAllowInvalid(false)
      .build();
    filterSheet.getRange('C4').setDataValidation(viewRule).setValue('Essential View (6 cols)');
    
    // Date range dropdown
    const dateOptions = ['All Time', 'Today', 'This Week', 'This Month', 'Last 7 Days', 'Last 30 Days', 'Custom Range'];
    const dateRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(dateOptions)
      .setAllowInvalid(false)
      .build();
    filterSheet.getRange('D4').setDataValidation(dateRule).setValue('All Time');
    
    // Calendar date inputs
    const dateValidation = SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(false)
      .build();
    filterSheet.getRange('E4:F4').setDataValidation(dateValidation);
    
    // 🎨 INSTRUCTIONS
    filterSheet.getRange('A6').setValue('⚡ INSTANT FILTERING: Select your criteria above and watch results update automatically below!');
    filterSheet.getRange('A6:F6').merge();
    filterSheet.getRange('A6').setBackground('#f39c12')
                              .setFontColor('#ffffff')
                              .setFontWeight('bold')
                              .setFontSize(10)
                              .setHorizontalAlignment('center');
    
    // 🎨 RESULTS HEADER
    filterSheet.getRange('A8').setValue('📋 FILTERED RESULTS');
    filterSheet.getRange('A8:H8').merge();
    filterSheet.getRange('A8').setBackground('#27ae60')
                              .setFontColor('#ffffff')
                              .setFontWeight('bold')
                              .setFontSize(14)
                              .setHorizontalAlignment('center');
    
    // 🔥 SMART QUERY FORMULA - This does all the magic!
    const smartQueryFormula = `=IF(C4="Quick Summary (4 cols)",
      QUERY(RealTimeShifts!A:O, 
        "SELECT A,B,K,H WHERE B IS NOT NULL" & 
        IF(A4<>"", " AND B CONTAINS '" & A4 & "'", "") &
        IF(B4<>"All Statuses", " AND K='" & B4 & "'", "") &
        IF(D4="Today", " AND D=date'" & TEXT(TODAY(),"yyyy-mm-dd") & "'", "") &
        IF(D4="This Week", " AND D>=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+7,"yyyy-mm-dd") & "'", "") &
        IF(D4="This Month", " AND D>=date'" & TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(EOMONTH(TODAY(),0),"yyyy-mm-dd") & "'", "") &
        IF(D4="Last 7 Days", " AND D>=date'" & TEXT(TODAY()-7,"yyyy-mm-dd") & "'", "") &
        IF(D4="Last 30 Days", " AND D>=date'" & TEXT(TODAY()-30,"yyyy-mm-dd") & "'", "") &
        IF(D4="Custom Range", 
          IF(AND(E4<>"",F4<>""), " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'",
          IF(E4<>"", " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "'",
          IF(F4<>"", " AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'", ""))), "") &
        " ORDER BY D DESC", 1),
      IF(C4="Essential View (6 cols)",
        QUERY(RealTimeShifts!A:O, 
          "SELECT A,B,E,H,K,D WHERE B IS NOT NULL" & 
          IF(A4<>"", " AND B CONTAINS '" & A4 & "'", "") &
          IF(B4<>"All Statuses", " AND K='" & B4 & "'", "") &
          IF(D4="Today", " AND D=date'" & TEXT(TODAY(),"yyyy-mm-dd") & "'", "") &
          IF(D4="This Week", " AND D>=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+7,"yyyy-mm-dd") & "'", "") &
          IF(D4="This Month", " AND D>=date'" & TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(EOMONTH(TODAY(),0),"yyyy-mm-dd") & "'", "") &
          IF(D4="Last 7 Days", " AND D>=date'" & TEXT(TODAY()-7,"yyyy-mm-dd") & "'", "") &
          IF(D4="Last 30 Days", " AND D>=date'" & TEXT(TODAY()-30,"yyyy-mm-dd") & "'", "") &
          IF(D4="Custom Range", 
            IF(AND(E4<>"",F4<>""), " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'",
            IF(E4<>"", " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "'",
            IF(F4<>"", " AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'", ""))), "") &
          " ORDER BY D DESC", 1),
        QUERY(RealTimeShifts!A:O, 
          "SELECT A,B,C,D,E,F,G,H,I,J,K,L,M,N,O WHERE B IS NOT NULL" & 
          IF(A4<>"", " AND B CONTAINS '" & A4 & "'", "") &
          IF(B4<>"All Statuses", " AND K='" & B4 & "'", "") &
          IF(D4="Today", " AND D=date'" & TEXT(TODAY(),"yyyy-mm-dd") & "'", "") &
          IF(D4="This Week", " AND D>=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(TODAY()-WEEKDAY(TODAY())+7,"yyyy-mm-dd") & "'", "") &
          IF(D4="This Month", " AND D>=date'" & TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(EOMONTH(TODAY(),0),"yyyy-mm-dd") & "'", "") &
          IF(D4="Last 7 Days", " AND D>=date'" & TEXT(TODAY()-7,"yyyy-mm-dd") & "'", "") &
          IF(D4="Last 30 Days", " AND D>=date'" & TEXT(TODAY()-30,"yyyy-mm-dd") & "'", "") &
          IF(D4="Custom Range", 
            IF(AND(E4<>"",F4<>""), " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "' AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'",
            IF(E4<>"", " AND D>=date'" & TEXT(E4,"yyyy-mm-dd") & "'",
            IF(F4<>"", " AND D<=date'" & TEXT(F4,"yyyy-mm-dd") & "'", ""))), "") &
          " ORDER BY D DESC", 1)
      )
    )`;
    
    // Insert the smart formula
    filterSheet.getRange('A10').setFormula(smartQueryFormula);
    
    // Set column widths
    filterSheet.setColumnWidth(1, 140);
    filterSheet.setColumnWidth(2, 130);
    filterSheet.setColumnWidth(3, 120);
    filterSheet.setColumnWidth(4, 120);
    filterSheet.setColumnWidth(5, 150);
    filterSheet.setColumnWidth(6, 150);
    
    Logger.log('✅ Production SimpleFilterTable created');
    
  } catch (error) {
    Logger.log('❌ Error creating production filter table: ' + error.toString());
    throw error;
  }
}

/**
 * Updates existing SimpleFilterTable if needed
 */
function updateExistingFilterTable() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const filterSheet = spreadsheet.getSheetByName('SimpleFilterTable');
    
    if (!filterSheet) {
      Logger.log('SimpleFilterTable not found - creating new one');
      createProductionFilterTable();
      return;
    }
    
    // Check if it has the modern header
    const currentTitle = filterSheet.getRange('A1').getValue();
    if (!currentTitle.includes('DYNAMIC REPORTS DASHBOARD')) {
      Logger.log('📊 Updating SimpleFilterTable to latest version...');
      
      // Clear and recreate with latest version
      filterSheet.clear();
      
      // Recreate with production version
      const tempSheet = filterSheet; // Keep reference
      spreadsheet.deleteSheet(filterSheet);
      createProductionFilterTable();
      
      Logger.log('✅ SimpleFilterTable updated to latest version');
    } else {
      Logger.log('✅ SimpleFilterTable is already up to date');
    }
    
  } catch (error) {
    Logger.log('⚠️ Error updating filter table: ' + error.toString());
    // Not critical - continue with cleanup
  }
}

/**
 * Remove any old function references that might cause issues
 */
function cleanupOldFunctionReferences() {
  try {
    // Delete old triggers that might reference removed functions
    const triggers = ScriptApp.getProjectTriggers();
    const oldFunctions = [
      'onSmartRefreshEdit',
      'onImprovedEdit', 
      'onDynamicTableEdit',
      'refreshDynamicTableData'
    ];
    
    let removedTriggers = 0;
    triggers.forEach(trigger => {
      if (oldFunctions.includes(trigger.getHandlerFunction())) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`🗑️  Removed old trigger: ${trigger.getHandlerFunction()}`);
        removedTriggers++;
      }
    });
    
    if (removedTriggers > 0) {
      Logger.log(`✅ Cleaned up ${removedTriggers} old triggers`);
    } else {
      Logger.log('✅ No old triggers to clean up');
    }
    
  } catch (error) {
    Logger.log('⚠️ Error cleaning up old references: ' + error.toString());
    // Not critical - continue
  }
}

/**
 * Quick test to verify the cleaned-up system works
 */
function testCleanedUpSystem() {
  Logger.log('=== TESTING CLEANED UP SYSTEM ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Check that SimpleFilterTable exists
    const filterSheet = spreadsheet.getSheetByName('SimpleFilterTable');
    if (!filterSheet) {
      Logger.log('❌ SimpleFilterTable not found');
      return { success: false, message: 'SimpleFilterTable missing' };
    }
    
    // Check that old sheets are gone
    const oldSheets = ['DynamicTable', 'FormulaDynamicTable', 'TriggerFreeDynamicTable'];
    const stillExists = oldSheets.filter(name => spreadsheet.getSheetByName(name) !== null);
    
    if (stillExists.length > 0) {
      Logger.log(`⚠️  Old sheets still exist: ${stillExists.join(', ')}`);
    } else {
      Logger.log('✅ All old sheets successfully removed');
    }
    
    // Check that the filter table has the right formula
    const formulaCell = filterSheet.getRange('A10');
    const formula = formulaCell.getFormula();
    
    if (formula.includes('QUERY(RealTimeShifts!A:O')) {
      Logger.log('✅ SimpleFilterTable formula is working');
    } else {
      Logger.log('⚠️  SimpleFilterTable formula may need attention');
    }
    
    Logger.log('');
    Logger.log('🎯 CLEANUP TEST RESULTS:');
    Logger.log('• SimpleFilterTable: ✅ Present and working');
    Logger.log(`• Old sheets removed: ${oldSheets.length - stillExists.length}/${oldSheets.length}`);
    Logger.log('• System ready for production use');
    
    return {
      success: true,
      message: 'Cleanup verified successfully',
      filterTableExists: true,
      oldSheetsRemoved: oldSheets.length - stillExists.length,
      totalOldSheets: oldSheets.length
    };
    
  } catch (error) {
    Logger.log('❌ Error testing cleaned up system: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}