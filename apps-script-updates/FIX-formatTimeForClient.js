// =============================================================
//                    QUICK FIX for Time Formatting Error
//     Replace your formatTimeForClient function with this one
// =============================================================

/**
 * Format time for display - converts server time to user's timezone
 * FIXED VERSION: Handles null/undefined values properly
 */
function formatTimeForClient(timeString, clientTimezone) {
  try {
    // Fix: Check if timeString is valid
    if (!timeString || timeString === null || timeString === undefined) {
      return null; // Return null for empty values
    }
    
    // Fix: Convert to string and check if it's a valid format
    const timeStr = String(timeString).trim();
    if (!timeStr || !timeStr.includes(':')) {
      return timeStr; // Return as-is if not in HH:MM format
    }
    
    if (!clientTimezone) return timeStr;
    
    // Parse the time string (assumes HH:MM format)
    const timeParts = timeStr.split(':');
    if (timeParts.length < 2) return timeStr;
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    // Validate hours and minutes
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
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
    return String(timeString || ''); // Return original as string if conversion fails
  }
}

// =============================================================
//                    WHAT TO DO:
// 
// 1. In your Apps Script, find the formatTimeForClient function
// 2. Replace it completely with the fixed version above
// 3. Save (Ctrl+S)
// 4. The error should be gone!
// =============================================================