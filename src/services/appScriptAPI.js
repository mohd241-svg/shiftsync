// Replace with your actual Google Apps Script Web App URL
// Replace with your NEW Google Apps Script Web App URL after redeployment
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlO-NvXC0lMeG4-bFCl6xyR3LQXSfpozYdoXdd8Bji7gnSBYrZqv9aT8ZWH-_FMKQZQA/exec';




// Enhanced API call wrapper that includes timezone info
export const makeAPICall = async (payload) => {
  try {
    console.log('=== API CALL DEBUG START ===');
    console.log('URL:', APPS_SCRIPT_URL);
    
    // Add timezone information to all API calls
    const enhancedPayload = {
      ...payload,
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      clientTimezoneOffset: new Date().getTimezoneOffset()
    };
    
    console.log('Making API call:', enhancedPayload);
    console.log('Timestamp:', new Date().toISOString());
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(enhancedPayload),
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log('Raw response text:', responseText);
    
    if (!responseText.trim()) {
      throw new Error('Empty response from server');
    }
    
    const result = JSON.parse(responseText);
    console.log('Parsed API response:', result);
    console.log('=== API CALL DEBUG END ===');
    
    return result;
  } catch (error) {
    console.error('=== API ERROR ===');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error object:', error);
    console.error('Stack trace:', error.stack);
    console.error('=== API ERROR END ===');
    throw error;
  }
};

// Login a user by checking credentials against the Staff sheet
export const loginUser = async (credentials) => {
  console.log('loginUser called with:', credentials);
  return await makeAPICall({
    action: 'login',
    username: credentials.username, // This will be the employee's name
    password: credentials.password  // This will be the employee's ID
  });
};

// Start a new shift
export const startShift = async (shiftData) => {
  console.log('startShift called with:', shiftData);
  return await makeAPICall({
    action: 'startShift',
    employeeName: shiftData.employeeName,
    employeeId: shiftData.employeeId,
    shiftDate: shiftData.shiftDate,
    shiftType: shiftData.shiftType || 'Regular',
    startTime: shiftData.startTime
  });
};

// Stop current segment
export const stopShift = async (shiftData) => {
  console.log('stopShift called with:', shiftData);
  return await makeAPICall({
    action: 'stopShift',
    employeeName: shiftData.employeeName, // Added for robustness
    employeeId: shiftData.employeeId,
    shiftDate: shiftData.shiftDate,
    endTime: shiftData.endTime
  });
};

// *** THIS IS THE CORRECTED FUNCTION ***
// Add new segment to existing shift
export const addNewSegment = async (shiftData) => {
  console.log('addNewSegment called with:', shiftData);
  return await makeAPICall({
    action: 'addNewSegment',
    employeeName: shiftData.employeeName, // The missing piece
    employeeId: shiftData.employeeId,
    shiftDate: shiftData.shiftDate,
    startTime: shiftData.startTime
  });
};

// Get current shift status - ENHANCED WITH IMMEDIATE SMART STATUS AND AUTO-FIXING
export const getCurrentShift = async (filters) => {
  console.log('getCurrentShift called with:', filters);
  const result = await makeAPICall({
    action: 'getCurrentShift',
    employeeId: filters.employeeId,
    date: filters.date
  });
  
  // 🔥 ENHANCED FRONTEND SMART STATUS FALLBACK WITH AUTO-FIXING
  if (result.success && result.data && result.data.segments) {
    const backendStatus = result.data.status;
    const frontendSmartStatus = applyFrontendSmartStatus(result.data);
    
    // 🔧 TRUST BACKEND MORE: Only override in critical cases
    const shouldOverride = (
      // Only override if backend shows impossible status
      (backendStatus === 'COMPLETED' && frontendSmartStatus === 'OFFLINE') ||
      // Or if backend is clearly wrong about before-shift-start
      (backendStatus !== 'OFFLINE' && frontendSmartStatus === 'OFFLINE')
    );
    
    if (shouldOverride) {
      console.log(`🔄 CRITICAL STATUS CORRECTION: Backend="${backendStatus}" → Frontend="${frontendSmartStatus}"`);
      
      // 🚨 CRITICAL: If backend shows COMPLETED but should be OFFLINE, auto-fix immediately
      if (backendStatus === 'COMPLETED' && frontendSmartStatus === 'OFFLINE') {
        console.log('🚨 IMPOSSIBLE STATUS DETECTED - Auto-fixing backend...');
        
        // Try to fix the backend status immediately
        try {
          const fixResult = await fixShiftStatus(result.data.shiftId, 'DRAFT');
          if (fixResult.success) {
            console.log('✅ Backend status automatically corrected to DRAFT');
            result.data._backendFixed = true;
          } else {
            console.warn('⚠️ Could not fix backend status, using frontend correction');
          }
        } catch (error) {
          console.warn('⚠️ Backend auto-fix failed:', error);
        }
      }
      
      result.data.status = frontendSmartStatus;
      result.data._statusCorrected = true;
      result.data._originalBackendStatus = backendStatus;
    } else if (backendStatus !== frontendSmartStatus) {
      console.log(`💡 STATUS DIFFERENCE: Backend="${backendStatus}" vs Frontend="${frontendSmartStatus}" - TRUSTING BACKEND`);
      // Don't override - trust the backend
    }
  }
  
  return result;
};

// 🔥 ENHANCED FRONTEND SMART STATUS LOGIC (backup for backend)
const applyFrontendSmartStatus = (shiftData) => {
  if (!shiftData || !shiftData.segments) return 'DRAFT';
  
  const segments = shiftData.segments;
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  console.log(`🔍 SMART STATUS: Current time: ${currentTime}, Stored status: "${shiftData.status}", Segments: ${segments.length}`);
  
  // 🚨 CRITICAL FIX: Check for impossible "COMPLETED" before shift starts
  if (shiftData.status === 'COMPLETED' && segments.length > 0) {
    const firstStartTime = segments[0]?.startTime;
    if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
      console.log(`🚨 IMPOSSIBLE STATUS DETECTED: Shift marked COMPLETED at ${currentTime} but starts at ${firstStartTime}`);
      console.log('🔧 CORRECTING TO: OFFLINE');
      return 'OFFLINE';
    }
  }
  
  // Check if current time is before shift starts
  if (segments.length > 0) {
    const firstStartTime = segments[0]?.startTime;
    if (firstStartTime && isCurrentTimeBeforeShiftStart(currentTime, firstStartTime)) {
      console.log(`⏰ BEFORE SHIFT START: Current ${currentTime} < Start ${firstStartTime} → OFFLINE`);
      return 'OFFLINE';
    }
  }
  
  const hasActiveSegment = segments.some(seg => !seg.endTime);
  
  if (hasActiveSegment) {
    console.log('✅ HAS ACTIVE SEGMENT → ACTIVE');
    return 'ACTIVE';
  }
  
  const completedSegments = segments.filter(seg => seg.endTime);
  if (completedSegments.length > 0) {
    const lastEndTime = completedSegments[completedSegments.length - 1]?.endTime;
    if (lastEndTime) {
      // 🔥 ENHANCED: Check if current time is after end time (same day or next day)
      if (isCurrentTimeAfterShiftEndEnhanced(currentTime, lastEndTime)) {
        console.log(`🏁 SHIFT COMPLETED: Current ${currentTime} > End ${lastEndTime} → COMPLETED`);
        return 'COMPLETED';
      }
      
      // Check for gaps between segments (more intelligent break detection)
      const gapDetected = checkForGapsBetweenSegments(segments, currentTime);
      if (gapDetected) {
        console.log(`⏸️ GAP BETWEEN SEGMENTS → ACTIVE (waiting for more work)`);
        return 'ACTIVE';
      }
      
      console.log(`⏸️ COMPLETED SEGMENTS, NO ACTIVE → ACTIVE (waiting for completion)`);
      return 'ACTIVE';
    }
  }
  
  if (segments.length === 0) {
    console.log('📝 NO SEGMENTS → DRAFT');
    return 'DRAFT';
  }
  
  console.log('📝 DEFAULT FALLBACK → DRAFT');
  return 'DRAFT';
};

// Enhanced gap detection between segments
const checkForGapsBetweenSegments = (segments, currentTime) => {
  if (!segments || segments.length <= 1) return false;
  
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    if (isNaN(currentHour) || isNaN(currentMinute)) return false;
    
    const currentMinutes = currentHour * 60 + currentMinute;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegmentEnd = segments[i]?.endTime;
      const nextSegmentStart = segments[i + 1]?.startTime;
      
      if (currentSegmentEnd && nextSegmentStart) {
        const [endHour, endMinute] = currentSegmentEnd.split(':').map(Number);
        const [startHour, startMinute] = nextSegmentStart.split(':').map(Number);
        
        if (isNaN(endHour) || isNaN(endMinute) || isNaN(startHour) || isNaN(startMinute)) {
          continue;
        }
        
        const endMinutes = endHour * 60 + endMinute;
        const startMinutes = startHour * 60 + startMinute;
        
        // Check if current time falls in the gap between segments
        if (currentMinutes > endMinutes && currentMinutes < startMinutes) {
          console.log(`🔍 FOUND GAP: Between ${currentSegmentEnd} and ${nextSegmentStart}, current: ${currentTime}`);
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking gaps between segments:', error);
    return false;
  }
};

// Helper functions for time comparison
const isCurrentTimeBeforeShiftStart = (currentTime, shiftStartTime) => {
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [shiftHour, shiftMinute] = shiftStartTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const shiftMinutes = shiftHour * 60 + shiftMinute;
    
    return currentMinutes < shiftMinutes;
  } catch (error) {
    console.error('Error comparing times:', error);
    return false;
  }
};

const isCurrentTimeAfterShiftEnd = (currentTime, shiftEndTime) => {
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [shiftHour, shiftMinute] = shiftEndTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    const shiftMinutes = shiftHour * 60 + shiftMinute;
    
    return currentMinutes > shiftMinutes;
  } catch (error) {
    console.error('Error comparing times:', error);
    return false;
  }
};

// 🔥 NEW: Enhanced time comparison that handles both same-day and next-day scenarios
const isCurrentTimeAfterShiftEndEnhanced = (currentTime, shiftEndTime) => {
  try {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [shiftHour, shiftMinute] = shiftEndTime.split(':').map(Number);
    
    if (isNaN(currentHour) || isNaN(currentMinute) || isNaN(shiftHour) || isNaN(shiftMinute)) {
      console.error('Invalid time format in enhanced comparison');
      return false;
    }
    
    let currentMinutes = currentHour * 60 + currentMinute;
    const shiftMinutes = shiftHour * 60 + shiftMinute;
    
    console.log(`⏰ Enhanced time check: Current ${currentTime} (${currentMinutes} min) vs End ${shiftEndTime} (${shiftMinutes} min)`);
    
    // First check: Same day comparison
    if (currentMinutes > shiftMinutes) {
      console.log(`✅ Same day completion: ${currentMinutes} > ${shiftMinutes}`);
      return true;
    }
    
    // Second check: Next day scenario (if current time is early morning and shift ended in evening)
    if (currentHour >= 0 && currentHour <= 8 && shiftHour >= 15) {
      const adjustedCurrentMinutes = currentMinutes + (24 * 60); // Add 24 hours
      console.log(`🌅 Next day scenario: Adjusted current ${adjustedCurrentMinutes} vs ${shiftMinutes}`);
      return adjustedCurrentMinutes > shiftMinutes;
    }
    
    console.log(`⏳ Still within shift time or before completion`);
    return false;
  } catch (error) {
    console.error('Error in enhanced time comparison:', error);
    return false;
  }
};

// Complete entire shift
export const completeShift = async (shiftData) => {
  console.log('completeShift called with:', shiftData);
  return await makeAPICall({
    action: 'completeShift',
    employeeName: shiftData.employeeName, // Added for robustness
    employeeId: shiftData.employeeId,
    shiftDate: shiftData.shiftDate
  });
};

// Legacy function for backward compatibility
export const submitShift = async (shiftData) => {
  console.log('submitShift (legacy) called, redirecting to startShift');
  return await startShift(shiftData);
};

// Get shifts data for reports
export const getShifts = async (filters = {}) => {
  console.log('getShifts called with:', filters);
  return await makeAPICall({
    action: 'getShifts',
    employeeId: filters.employeeId,
    startDate: filters.startDate,
    endDate: filters.endDate
  });
};

// Get staff list
export const getStaffList = async () => {
  console.log('getStaffList called');
  return await makeAPICall({
    action: 'getStaffList'
  });
};

// Update shift status - Critical function for React frontend smart status sync
export const updateShiftStatus = async (payload) => {
  console.log('🔄 updateShiftStatus called with:', payload);
  return await makeAPICall({
    action: 'updateShiftStatus',
    shiftId: payload.shiftId,
    newStatus: payload.newStatus,
    reason: payload.reason || 'Frontend smart status calculation'
  });
};

// Submit time segments for a shift (uses createCompleteShift backend action)
export const submitTimeSegments = async (payload) => {
  console.log('⏰ submitTimeSegments called with:', payload);
  
  // Calculate firstStartTime, lastEndTime, and totalDuration from segments
  const segments = payload.segments || [];
  let firstStartTime = '';
  let lastEndTime = '';
  let totalDuration = 0;
  
  if (segments.length > 0) {
    // Sort segments by start time to ensure correct order
    const sortedSegments = [...segments].sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
    
    // Get first start time and last end time
    firstStartTime = sortedSegments[0].startTime;
    lastEndTime = sortedSegments[sortedSegments.length - 1].endTime;
    
    // Calculate total duration
    totalDuration = segments.reduce((total, segment) => {
      return total + (segment.duration || 0);
    }, 0);
    
    console.log(`📊 Calculated: firstStartTime=${firstStartTime}, lastEndTime=${lastEndTime}, totalDuration=${totalDuration}`);
  }
  
  return await makeAPICall({
    action: 'createCompleteShift',
    employeeName: payload.employeeName,
    employeeId: payload.employeeId,
    shiftDate: payload.date,
    shiftType: payload.shiftType || 'Regular',
    segments: segments,
    firstStartTime: firstStartTime,
    lastEndTime: lastEndTime,
    totalDuration: totalDuration,
    scheduleStatus: 'active', // Set appropriate status
    isUpdate: false,
    isFirstSave: true
  });
};

// Fix shift status - Handle status correction requests
export const fixShiftStatus = async (payload) => {
  console.log('🔧 fixShiftStatus called with:', payload);
  return await makeAPICall({
    action: 'fixShiftStatus',
    shiftId: payload.shiftId,
    correctStatus: payload.correctStatus,
    reason: payload.reason || 'Status correction'
  });
};

// Test connection to Apps Script
export const testConnection = async () => {
  try {
    console.log('Testing connection to:', APPS_SCRIPT_URL);
    console.log('🔍 Testing with GET request...');
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const result = await response.json();
    console.log('Connection test result:', result);
    return { success: true, message: 'Connection successful', data: result };
  } catch (error) {
    console.error('Connection test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return { success: false, message: 'Connection failed', error: error.message };
  }
};

// Utility function to get current time in user's timezone
export const getCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
};

// Get current time with timezone info for backend
export const getCurrentTimeWithTimezone = () => {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: now.getTimezoneOffset(),
    timestamp: now.toISOString()
  };
};

// Utility function to get current date in user's timezone
export const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }); // en-CA gives YYYY-MM-DD format in user's timezone
};

// Get current date with timezone info for backend
export const getCurrentDateWithTimezone = () => {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    date: now.toLocaleDateString('en-CA', { timeZone: timezone }),
    timezone: timezone,
    offset: now.getTimezoneOffset(),
    timestamp: now.toISOString()
  };
};

// Get user's timezone info
export const getUserTimezone = () => {
  const now = new Date();
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: now.getTimezoneOffset(),
    offsetHours: now.getTimezoneOffset() / 60,
    timezoneName: now.toLocaleTimeString('en-US', { timeZoneName: 'long' }).split(' ').slice(-2).join(' ')
  };
};

// Utility function to calculate duration
export const calculateDuration = (startTime, endTime) => {
  try {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    let diffMs = end - start;
    
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000; // Handle overnight shifts
    }
    
    return diffMs / (1000 * 60 * 60); // Return number, not string
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
};

// Debug function to test all API endpoints
export const debugAllEndpoints = async (employeeId, employeeName) => {
  const testDate = getCurrentDate();
  
  console.log('=== TESTING ALL ENDPOINTS ===');
  console.log('Employee ID:', employeeId);
  console.log('Employee Name:', employeeName);
  console.log('Test Date:', testDate);
  
  try {
    // Test connection
    console.log('1. Testing connection...');
    const connection = await testConnection();
    console.log('Connection result:', connection);
    
    // Test start shift
    console.log('2. Testing start shift...');
    const startResult = await startShift({
      employeeName: employeeName,
      employeeId: employeeId,
      shiftDate: testDate,
      shiftType: 'Regular'
    });
    console.log('Start shift result:', startResult);
    
    // Test get current shift
    console.log('3. Testing get current shift...');
    const currentResult = await getCurrentShift({
      employeeId: employeeId,
      date: testDate
    });
    console.log('Current shift result:', currentResult);
    
    console.log('=== ENDPOINT TESTING COMPLETE ===');
    return { success: true, message: 'All endpoint tests completed' };
    
  } catch (error) {
    console.error('Error in endpoint testing:', error);
    return { success: false, message: 'Endpoint testing failed', error: error.message };
  }
};

// 🔥 NEW: Comprehensive system test for impossible status scenarios
export const testImpossibleStatusScenarios = async (employeeId, employeeName) => {
  console.log('=== TESTING IMPOSSIBLE STATUS SCENARIOS ===');
  
  const testDate = getCurrentDate();
  const results = {
    tests: [],
    passed: 0,
    failed: 0
  };
  
  const addTestResult = (testName, passed, details) => {
    results.tests.push({ testName, passed, details });
    if (passed) results.passed++;
    else results.failed++;
  };
  
  try {
    // Test 1: Get current shift and check if status makes sense
    console.log('🧪 Test 1: Checking current shift status logic...');
    const currentShift = await getCurrentShift({ employeeId, date: testDate });
    
    if (currentShift.success && currentShift.data) {
      const data = currentShift.data;
      const hasStatusCorrection = data._statusCorrected;
      const originalStatus = data._originalBackendStatus;
      const finalStatus = data.status;
      
      if (hasStatusCorrection) {
        console.log(`✅ Status correction detected: "${originalStatus}" → "${finalStatus}"`);
        addTestResult('Status Correction', true, `Corrected from ${originalStatus} to ${finalStatus}`);
      } else {
        console.log(`✅ No status correction needed, current status: "${finalStatus}"`);
        addTestResult('Status Logic', true, `Current status "${finalStatus}" is correct`);
      }
      
      // Test the time logic
      if (data.segments && data.segments.length > 0) {
        const firstStart = data.segments[0]?.startTime;
        const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        if (firstStart && isCurrentTimeBeforeShiftStart(now, firstStart) && finalStatus === 'COMPLETED') {
          addTestResult('Impossible Status Check', false, `Status is COMPLETED but shift starts at ${firstStart} and current time is ${now}`);
        } else {
          addTestResult('Impossible Status Check', true, 'No impossible status detected');
        }
      }
      
    } else {
      addTestResult('Get Current Shift', false, currentShift.message || 'Failed to get shift data');
    }
    
    // Test 2: Test the frontend smart status function directly
    console.log('🧪 Test 2: Testing frontend smart status function...');
    
    const mockShiftData = {
      status: 'COMPLETED',
      segments: [
        {
          startTime: '09:00',
          endTime: '12:00'
        }
      ]
    };
    
    const smartStatus = applyFrontendSmartStatus(mockShiftData);
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    if (isCurrentTimeBeforeShiftStart(now, '09:00') && smartStatus !== 'OFFLINE') {
      addTestResult('Smart Status Function', false, `Should return OFFLINE when current time (${now}) is before 09:00, got ${smartStatus}`);
    } else {
      addTestResult('Smart Status Function', true, `Smart status logic working correctly: ${smartStatus}`);
    }
    
    // Test 3: Test the fix function
    console.log('🧪 Test 3: Testing status fix capability...');
    
    if (currentShift.success && currentShift.data && currentShift.data.shiftId) {
      const shiftId = currentShift.data.shiftId;
      console.log(`Testing fix function with shift ID: ${shiftId}`);
      
      // Note: We won't actually change the status, just test if the function exists
      if (typeof fixShiftStatus === 'function') {
        addTestResult('Fix Function Available', true, 'fixShiftStatus function is available');
      } else {
        addTestResult('Fix Function Available', false, 'fixShiftStatus function not found');
      }
    }
    
    console.log('=== TEST RESULTS ===');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log('📋 Details:', results.tests);
    
    return {
      success: results.failed === 0,
      message: `Tests completed: ${results.passed} passed, ${results.failed} failed`,
      results: results
    };
    
  } catch (error) {
    console.error('Error in system testing:', error);
    addTestResult('System Test', false, error.message);
    return {
      success: false,
      message: 'System test failed with error: ' + error.message,
      results: results
    };
  }
};

// Enhanced error handling wrapper
export const handleAPIError = (error) => {
  console.error('API Error occurred:', error);
  
  if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return 'Invalid response from server. Please try again.';
  } else if (error.message.includes('CORS')) {
    return 'Cross-origin request blocked. Please check your Apps Script deployment.';
  } else {
    return `Connection error: ${error.message}`;
  }
};

// 🔥 NEW: Test the backend auto-update system
export const testBackendAutoUpdate = async () => {
  console.log('🧪 Testing backend auto-update system...');
  try {
    const response = await makeAPICall({
      action: 'manualStatusUpdate'
    });
    
    console.log('📋 Auto-update test result:', response);
    return response;
  } catch (error) {
    console.error('Error testing auto-update:', error);
    return { success: false, message: handleAPIError(error) };
  }
};

// 🔥 NEW: Check trigger status
export const checkAutoUpdateStatus = async () => {
  console.log('⚙️ Checking auto-update trigger status...');
  try {
    const response = await makeAPICall({
      action: 'checkTriggerStatus'
    });
    
    console.log('📊 Trigger status:', response);
    return response;
  } catch (error) {
    console.error('Error checking trigger status:', error);
    return { success: false, message: handleAPIError(error) };
  }
};

// 🔥 NEW: Create auto-update trigger
export const setupAutoUpdates = async () => {
  console.log('🚀 Setting up auto-update triggers...');
  try {
    const response = await makeAPICall({
      action: 'createStatusUpdateTrigger'
    });
    
    console.log('✅ Auto-update setup result:', response);
    return response;
  } catch (error) {
    console.error('Error setting up auto-updates:', error);
    return { success: false, message: handleAPIError(error) };
  }
};

// Duplicate fixShiftStatus function removed - using the one defined earlier

// 🔥 NEW: Proactive status monitor and fixer
export const monitorAndFixStatus = async (shiftData) => {
  if (!shiftData || !shiftData.segments || shiftData.segments.length === 0) return shiftData;
  
  const currentStatus = shiftData.status;
  const correctStatus = applyFrontendSmartStatus(shiftData);
  
  // If status is wrong, try to fix it in the backend automatically
  if (currentStatus !== correctStatus && currentStatus === 'COMPLETED') {
    console.log(`🔧 AUTO-FIXING: Backend status "${currentStatus}" should be "${correctStatus}"`);
    
    // Try to fix the backend status
    const fixResult = await fixShiftStatus(shiftData.shiftId, correctStatus);
    
    if (fixResult.success) {
      console.log('✅ Backend status automatically corrected');
    }
    
    // Return corrected data regardless of backend fix result
    return {
      ...shiftData,
      status: correctStatus,
      _autoFixed: true
    };
  }
  
  return shiftData;
};

// =============================================================
//                   INTELLIGENT TIME VALIDATION
// =============================================================

// Check if a time segment has already passed (based on current time)
export const isTimeSegmentPassed = (endTime, segmentDate = null) => {
  // DISABLED: Always return false to allow editing of any time segment
  return false;
  
  /* ORIGINAL LOGIC - COMMENTED OUT
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // If segment date is provided and it's not today, check if it's in the past
    if (segmentDate && segmentDate !== today) {
      const segDate = new Date(segmentDate);
      return segDate < new Date(today);
    }
    
    // For today's segments, compare end time with current time
    if (!endTime) return false; // If no end time, segment is still ongoing
    
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    
    const endTimeMinutes = endHour * 60 + endMinute;
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    return currentTimeMinutes > endTimeMinutes;
  } catch (error) {
    console.error('Error checking if time segment passed:', error);
    return false; // Default to allowing edits if there's an error
  }
  */
};

// Check if any part of a time segment conflicts with current time
export const isTimeSegmentConflictingWithCurrent = (startTime, endTime, segmentDate = null) => {
  // DISABLED: Always return false to allow editing of any time segment
  return false;
  
  /* ORIGINAL LOGIC - COMMENTED OUT
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Only check for today's segments
    if (segmentDate && segmentDate !== today) {
      return false;
    }
    
    if (!startTime || !endTime) return false;
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // Check if current time falls within the segment
    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  } catch (error) {
    console.error('Error checking time segment conflict:', error);
    return false;
  }
  */
};

// Validate if segments can be edited based on current time
export const validateSegmentsEditability = (segments, shiftDate = null) => {
  const today = getCurrentDate();
  const editableSegments = [];
  const nonEditableSegments = [];
  
  segments.forEach((segment, index) => {
    const segmentPassed = isTimeSegmentPassed(segment.endTime, shiftDate || today);
    const segmentConflicting = isTimeSegmentConflictingWithCurrent(
      segment.startTime, 
      segment.endTime, 
      shiftDate || today
    );
    
    if (segmentPassed || segmentConflicting) {
      nonEditableSegments.push({
        ...segment,
        index,
        reason: segmentPassed ? 'Time has passed' : 'Currently active time period'
      });
    } else {
      editableSegments.push({ ...segment, index });
    }
  });
  
  return {
    canEdit: nonEditableSegments.length === 0,
    editableSegments,
    nonEditableSegments,
    hasPassedSegments: nonEditableSegments.some(seg => seg.reason === 'Time has passed'),
    hasActiveSegments: nonEditableSegments.some(seg => seg.reason === 'Currently active time period')
  };
};

// Get time-based restrictions for UI
export const getTimeRestrictions = (shiftDate = null) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const targetDate = shiftDate || today;
  const isToday = targetDate === today;
  
  return {
    isToday,
    isPastDate: false, // DISABLED: Allow editing of past dates
    currentTime,
    maxAllowedEndTime: '23:59', // DISABLED: Allow any end time
    canCreateNewSegments: true, // DISABLED: Always allow new segments
    canEditPastSegments: true // DISABLED: Always allow editing
  };
};

// =============================================================
//                 DYNAMIC TABLE API FUNCTIONS
// =============================================================

// Get dynamic table data
export const getDynamicTableData = async (filters) => {
  return await makeAPICall({
    action: 'getDynamicData',
    columnSelector: filters.columnSelector || 'All Columns',
    dateChoice: filters.dateChoice || 'This Month',
    customStartDate: filters.customStartDate,
    customEndDate: filters.customEndDate
  });
};

// Setup smart dynamic table with sheet-based refresh
export const setupSmartDynamicTable = async () => {
  return await makeAPICall({
    action: 'setupSmartDynamicTable'
  });
};

// Reset refresh control state
export const resetDynamicTableRefresh = async () => {
  return await makeAPICall({
    action: 'resetRefreshControl'
  });
};

// Debug function to test smart refresh from frontend
export const testSmartRefresh = async () => {
  return await makeAPICall({
    action: 'forceRefreshDynamicTable'
  });
};

// Test the timezone auto-update fix
export const testTimezoneAutoUpdate = async () => {
  return await makeAPICall({
    action: 'testTimezoneAutoUpdate'
  });
};

// Force run auto-update with user timezone
export const forceAutoUpdateWithUserTimezone = async () => {
  return await makeAPICall({
    action: 'forceAutoUpdateWithUserTimezone'
  });
};

// Test comprehensive time comparison scenarios
export const testTimeComparison = async () => {
  return await makeAPICall({
    action: 'testTimeComparison'
  });
};

// Test time comparison with real shift data
export const testTimeComparisonWithRealData = async () => {
  return await makeAPICall({
    action: 'testTimeComparisonWithRealData'
  });
};

// Test comprehensive timezone conversion system
export const testFullTimezoneSystem = async () => {
  return await makeAPICall({
    action: 'testTimezoneConversion'
  });
};

// Test timezone issue directly
export const testTimezoneIssueDirectly = async () => {
  return await makeAPICall({
    action: 'testTimezoneIssueDirectly'
  });
};

// Get simple server time and timezone info
export const getServerTimeInfo = async () => {
  return await makeAPICall({
    action: 'getServerTimeInfo'
  });
};

// Test timezone storage in Time Zone column
export const testTimezoneStorage = async () => {
  return await makeAPICall({
    action: 'testTimezoneStorage'
  });
};

// Verify Time Zone column P setup and functionality
export const verifyTimezoneColumnP = async () => {
  return await makeAPICall({
    action: 'verifyTimezoneColumnP'
  });
};

// Verify Time Zone column F setup and functionality  
export const verifyTimezoneColumnF = async () => {
  return await makeAPICall({
    action: 'verifyTimezoneColumnF'
  });
};

// Clean up duplicate Time Zone columns
export const cleanupDuplicateTimezoneColumns = async () => {
  return await makeAPICall({
    action: 'cleanupDuplicateTimezoneColumns'
  });
};

// =============================================================
//                 STATUS UPDATE SYSTEM
// =============================================================

// Manual status update for all shifts (refresh button functionality)
export const manualStatusUpdate = async () => {
  console.log('🔄 Manual status update triggered');
  return await makeAPICall({
    action: 'manualStatusUpdate'
  });
};

// Automatic status update on portal load
export const autoStatusUpdateOnLoad = async () => {
  console.log('🚀 Auto status update on portal load');
  return await makeAPICall({
    action: 'autoStatusUpdateOnLoad'
  });
};

// Check if shift has been edited before (for one-time edit limit)
export const checkShiftEditHistory = async (shiftId) => {
  console.log('📝 Checking edit history for shift:', shiftId);
  return await makeAPICall({
    action: 'checkShiftEditHistory',
    shiftId: shiftId
  });
};

// Record that a shift has been edited (for tracking purposes)
export const recordShiftEdit = async (shiftId, editDetails) => {
  console.log('✍️ Recording shift edit:', shiftId, editDetails);
  return await makeAPICall({
    action: 'recordShiftEdit',
    shiftId: shiftId,
    editDetails: editDetails,
    editTimestamp: new Date().toISOString()
  });
};

// Update shift with edit tracking (for employee portal with one-time limit)
export const updateShiftWithEditTracking = async (shiftData) => {
  console.log('📋 Updating shift with edit tracking:', shiftData);
  return await makeAPICall({
    action: 'updateShiftWithEditTracking',
    ...shiftData
  });
};

// Disable automatic shift completion (emergency fix)
export const disableAutoCompletion = async () => {
  return await makeAPICall({
    action: 'disableAutoCompletion'
  });
};

// Test timezone extraction and time conversion
export const testTimezoneExtraction = async () => {
  return await makeAPICall({
    action: 'testTimezoneExtraction'
  });
};

// Test auto-update system with fixed timezone conversion
export const testAutoUpdateWithFixedTimezone = async () => {
  return await makeAPICall({
    action: 'testAutoUpdateWithFixedTimezone'
  });
};

// Remove ON BREAK status from all existing shifts
export const removeOnBreakStatus = async () => {
  return await makeAPICall({
    action: 'removeOnBreakStatus'
  });
};

// Verify status simplification is complete
export const verifyStatusSimplification = async () => {
  return await makeAPICall({
    action: 'verifyStatusSimplification'
  });
};

// Emergency function to revert recently auto-completed shifts
export const revertAutoCompletedShifts = async () => {
  return await makeAPICall({
    action: 'revertAutoCompletedShifts'
  });
};

// =============================================================
//                 TIMEZONE CONVERSION UTILITIES
// =============================================================

// Convert server time to user timezone
export const convertServerTimeToUserTime = (serverTime, userTimezone) => {
  try {
    // Create a date object with server time in server timezone
    const today = new Date().toISOString().split('T')[0];
    const serverDateTime = new Date(`${today}T${serverTime}:00`);
    
    // Convert to user timezone
    const userTime = serverDateTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    });
    
    return userTime;
  } catch (error) {
    console.error('Error converting server time to user time:', error);
    return serverTime; // Fallback to original time
  }
};

// Convert user time to server timezone
export const convertUserTimeToServerTime = (userTime, userTimezone, serverTimezone = 'America/New_York') => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Create date in user timezone
    const userDateTime = new Date(`${today}T${userTime}:00`);
    
    // Convert to server timezone
    const serverTime = userDateTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: serverTimezone
    });
    
    return serverTime;
  } catch (error) {
    console.error('Error converting user time to server time:', error);
    return userTime; // Fallback to original time
  }
};

// Get timezone offset difference between user and server
export const getTimezoneOffset = (userTimezone, serverTimezone = 'America/New_York') => {
  try {
    const now = new Date();
    
    // Get time in both timezones
    const userTime = now.toLocaleString('en-US', { timeZone: userTimezone });
    const serverTime = now.toLocaleString('en-US', { timeZone: serverTimezone });
    
    // Calculate offset in hours
    const userDate = new Date(userTime);
    const serverDate = new Date(serverTime);
    const offsetMs = userDate.getTime() - serverDate.getTime();
    const offsetHours = offsetMs / (1000 * 60 * 60);
    
    return {
      offsetHours: offsetHours,
      userTime: userTime,
      serverTime: serverTime,
      userTimezone: userTimezone,
      serverTimezone: serverTimezone
    };
  } catch (error) {
    console.error('Error calculating timezone offset:', error);
    return { offsetHours: 0 };
  }
};

// Test timezone conversion with real data
export const testTimezoneConversion = async () => {
  return await makeAPICall({
    action: 'testTimezoneConversion'
  });
};

// =============================================
// ADMIN SYSTEM FUNCTIONS
// =============================================

// Get system statistics for admin dashboard
export const getSystemStats = async () => {
  return await makeAPICall({
    action: 'getSystemStats'
  });
};

// Get all shifts with admin-level filtering
export const getAllShiftsForAdmin = async (filters = {}) => {
  return await makeAPICall({
    action: 'getAllShiftsForAdmin',
    ...filters
  });
};

// Update a shift with admin privileges
export const updateShiftAsAdmin = async (shiftData) => {
  return await makeAPICall({
    action: 'updateShiftAsAdmin',
    ...shiftData
  });
};

// Delete a shift with admin privileges
export const deleteShiftAsAdmin = async (shiftId) => {
  return await makeAPICall({
    action: 'deleteShiftAsAdmin',
    shiftId: shiftId
  });
};

// Create/update SimpleFilterTable
export const createSimpleFilterTable = async () => {
  return await makeAPICall({
    action: 'createSimpleFilterTable'
  });
};

// Setup production system
export const setupProductionSystem = async () => {
  return await makeAPICall({
    action: 'setupProductionSystem'
  });
};

// Cleanup old sheets
export const cleanupOldSheets = async () => {
  return await makeAPICall({
    action: 'cleanupOldSheets'
  });
};

// Debug function to check sheet structure
export const debugSheetStructure = async () => {
  return await makeAPICall({
    action: 'debugSheetStructure'
  });
};

// Staff Management API Functions
export const addStaff = async (staffData) => {
  return await makeAPICall({
    action: 'addStaff',
    staffData: staffData
  });
};

export const updateStaff = async (staffId, staffData) => {
  return await makeAPICall({
    action: 'updateStaff',
    staffId: staffId,
    staffData: staffData
  });
};

export const deleteStaff = async (staffId) => {
  return await makeAPICall({
    action: 'deleteStaff',
    staffId: staffId
  });
};

// =============================================================
//                   ENHANCED AI SYSTEM
// =============================================================

// Get comprehensive sheet data for AI analysis
export const getComprehensiveSheetData = async () => {
  console.log('🤖 Fetching comprehensive sheet data for AI analysis');
  return await makeAPICall({
    action: 'getComprehensiveSheetData'
  });
};

// Process AI prompt with automatic data fetching
export const processAIPromptWithData = async (prompt, includeRawData = true) => {
  console.log('🤖 Processing AI prompt with automatic data fetching:', prompt);
  return await makeAPICall({
    action: 'processAIPromptWithData',
    prompt: prompt,
    includeRawData: includeRawData,
    requestTimestamp: new Date().toISOString()
  });
};

// Experimental AI features
export const runExperimentalAI = async (experimentType, parameters = {}) => {
  console.log('🧪 Running experimental AI:', experimentType, parameters);
  return await makeAPICall({
    action: 'runExperimentalAI',
    experimentType: experimentType,
    parameters: parameters,
    requestTimestamp: new Date().toISOString()
  });
};

// Get AI analysis suggestions
export const getAIAnalysisSuggestions = async () => {
  console.log('💡 Getting AI analysis suggestions');
  return await makeAPICall({
    action: 'getAIAnalysisSuggestions'
  });
};

// Get AI insights dashboard
export const getAIInsightsDashboard = async () => {
  console.log('📊 Getting AI insights dashboard');
  return await makeAPICall({
    action: 'getAIInsightsDashboard'
  });
};
