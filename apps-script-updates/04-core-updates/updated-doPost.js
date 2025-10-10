// =============================================================
//            UPDATED doPost WITH TIMEZONE SUPPORT
//   Replace your existing doPost function with this version
// =============================================================

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) { 
      return createResponse({ success: false, message: 'No data received' }); 
    }
    
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Extract timezone information from client
    const clientTimezone = data.clientTimezone || null;
    const clientTimezoneOffset = data.clientTimezoneOffset || null;
    
    Logger.log(`Action: ${action}, Client Timezone: ${clientTimezone}, Data: ${JSON.stringify(data)}`);
    
    let response;
    
    switch(action) {
      case 'login': 
        response = authenticateUser(data, clientTimezone); 
        break;
      case 'startShift': 
        response = startShiftSafe(data, clientTimezone); 
        break;
      case 'stopShift': 
        response = stopShift(data, clientTimezone); 
        break;
      case 'addNewSegment': 
        response = addNewSegment(data, clientTimezone); 
        break;
      case 'getCurrentShift': 
        response = getCurrentShift(data, clientTimezone); 
        break;
      case 'completeShift': 
        response = completeShift(data, clientTimezone); 
        break;
      case 'cleanupDuplicates': 
        response = cleanupDuplicateShifts(); 
        break;
      case 'getShifts': 
        response = getShifts(data, clientTimezone); 
        break;
      case 'getStaffList': 
        response = getStaffList(); 
        break;
      case 'createCompleteShift': 
        response = createCompleteShift(data, clientTimezone); 
        break;
      case 'getDynamicData': 
        response = getDynamicTableData(data); 
        break;
      case 'setupDynamicTable': 
        response = setupDynamicTableSheet(); 
        break;
      case 'setupSmartDynamicTable': 
        response = setupSmartDynamicTable(); 
        break;
      case 'resetRefreshControl': 
        response = resetRefreshControl(); 
        break;
      case 'smartRefreshDynamicTable': 
        response = smartRefreshDynamicTable(); 
        break;
      case 'setupImprovedTable': 
        response = setupImprovedSmartDynamicTable(); 
        break;
      case 'forceImprovedRefresh': 
        response = forceImprovedRefresh(); 
        break;
      case 'performImprovedRefresh': 
        response = performImprovedRefresh(); 
        break;
      case 'setupTriggerFreeSystem': 
        response = setupTriggerFreeSystem(); 
        break;
      case 'smartRefreshData': 
        response = smartRefreshData(); 
        break;
      case 'setupTriggerFreeTable': 
        response = setupTriggerFreeDynamicTable(); 
        break;
      case 'setupFormulaBasedSystem': 
        response = setupFormulaBasedSystem(); 
        break;
      default: 
        response = { success: false, message: 'Invalid action: ' + action };
    }
    
    // Use timezone-aware response creator
    return createTimezoneAwareResponse(response, clientTimezone);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return createTimezoneAwareResponse({ 
      success: false, 
      message: 'Server error: ' + error.toString() 
    }, null);
  }
}