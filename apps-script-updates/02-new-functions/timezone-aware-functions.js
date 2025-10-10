// =============================================================
//                TIMEZONE-AWARE TIME FUNCTIONS
//           Add these to your Google Apps Script
// =============================================================

/**
 * Enhanced getCurrentTimeString that accepts timezone from client
 */
function getCurrentTimeString(clientTimezone) {
  try {
    if (clientTimezone) {
      // Use client's timezone if provided
      const now = new Date();
      return now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: clientTimezone 
      });
    } else {
      // Fallback to server timezone
      return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (error) {
    Logger.log('Error in timezone-aware getCurrentTimeString: ' + error.toString());
    // Fallback to server time if timezone conversion fails
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Enhanced getCurrentDate that accepts timezone from client
 */
function getCurrentDate(clientTimezone) {
  try {
    if (clientTimezone) {
      const now = new Date();
      return now.toLocaleDateString('en-CA', { 
        timeZone: clientTimezone 
      }); // Returns YYYY-MM-DD format
    } else {
      // Fallback to server timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    Logger.log('Error in timezone-aware getCurrentDate: ' + error.toString());
    // Fallback to server date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Format time for display - converts server time to user's timezone
 */
function formatTimeForClient(timeString, clientTimezone) {
  try {
    if (!timeString || !clientTimezone) return timeString;
    
    // Parse the time string (assumes HH:MM format)
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Create a date object for today with this time
    const today = new Date();
    const timeDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    
    // Convert to client timezone
    return timeDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: clientTimezone
    });
  } catch (error) {
    Logger.log('Error formatting time for client: ' + error.toString());
    return timeString; // Return original if conversion fails
  }
}

/**
 * Enhanced response creator that includes timezone metadata
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