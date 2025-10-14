import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getShifts, 
  handleAPIError, 
  checkShiftEditHistory, 
  updateShiftWithEditTracking,
  submitTimeSegments 
} from '../../services/appScriptAPI';
import TimeSegmentEntry from '../TimeSegmentEntry/TimeSegmentEntry';

const ShiftHistory = ({ refreshTrigger }) => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingShift, setEditingShift] = useState(null);
  const [editFormData, setEditFormData] = useState({
    firstStartTime: '',
    lastEndTime: '',
    shiftType: 'Regular'
  });
  const [saving, setSaving] = useState(false);
  const [editHistory, setEditHistory] = useState({}); // Track which shifts have been edited
  const [checkingEditHistory, setCheckingEditHistory] = useState(false);
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false); // For TimeSegmentEntry reveal
  const [message, setMessage] = useState(''); // Added message state like ShiftEntry

  // 🔥 EXACT COPY OF SHIFT ENTRY'S SMART STATUS LOGIC
  const determineSmartStatus = (shiftData) => {
    console.log('🧮 ShiftHistory - Calculating smart status (EXACT SHIFT ENTRY LOGIC):', shiftData);
    
    if (!shiftData || !shiftData.segments) {
      console.log('📝 No shift data or segments - DRAFT');
      return 'DRAFT';
    }
    
    const segments = shiftData.segments;
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    console.log('⏰ Current time:', currentTime);
    console.log('📋 Segments:', segments);

    if (!Array.isArray(segments) || segments.length === 0) {
      console.log('📝 No segments array - DRAFT');
      return 'DRAFT';
    }

    const timeToMinutes = (timeString) => {
      if (!timeString) return 0;
      const [hours, minutes] = timeString.split(':').map(Number);
      return (hours || 0) * 60 + (minutes || 0);
    };

    const currentTimeMinutes = timeToMinutes(currentTime);
    
    // Get the actual start and end times from segments
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    
    if (firstSegment && firstSegment.startTime) {
      const firstStartMinutes = timeToMinutes(firstSegment.startTime);
      console.log('🚀 First start time:', firstSegment.startTime, '=', firstStartMinutes, 'minutes');
      
      // Check if shift hasn't started yet
      if (currentTimeMinutes < firstStartMinutes) {
        console.log('⚫ Before start time - OFFLINE');
        return 'OFFLINE';
      }
    }

    // Check for active segments (segments without end time)
    const hasActiveSegment = segments.some(seg => !seg.endTime);
    console.log('🔄 Has active segment (no end time):', hasActiveSegment);
    
    if (hasActiveSegment) {
      console.log('🟢 Active segment detected - ACTIVE');
      return 'ACTIVE';
    }

    // Check if current time is before the last segment's end time
    if (lastSegment && lastSegment.endTime) {
      const lastEndMinutes = timeToMinutes(lastSegment.endTime);
      console.log('🏁 Last end time:', lastSegment.endTime, '=', lastEndMinutes, 'minutes');
      console.log('⏰ Comparison: current', currentTimeMinutes, 'vs end', lastEndMinutes);
      
      if (currentTimeMinutes < lastEndMinutes) {
        console.log('🟢 Current time before end time - should be ACTIVE');
        return 'ACTIVE';
      } else {
        console.log('🔵 Current time after end time - COMPLETED');
        return 'COMPLETED';
      }
    }

    // If all segments have end times but no clear end time, likely still active
    if (segments.length > 0 && segments.every(seg => seg.endTime)) {
      console.log('🟡 All segments have end times but unclear - ACTIVE for safety');
      return 'ACTIVE'; // Keep as active for manual completion
    }

    console.log('📝 Fallback to DRAFT');
    return 'DRAFT';
  };

  useEffect(() => {
    if (user) {
      console.log('🔄 ShiftHistory initial load - EXACT SHIFT ENTRY PATTERN');
      loadShiftHistory(true); // Always force fresh on load like ShiftEntry
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger refresh when refreshTrigger changes (EXACT SHIFT ENTRY PATTERN)
  useEffect(() => {
    if (refreshTrigger && user) {
      console.log('🔄 History refresh trigger activated - EXACT SHIFT ENTRY PATTERN - fetching FRESH data from Google Sheets');
      loadShiftHistory(true); // Force fresh data from sheet like ShiftEntry
    }
  }, [refreshTrigger, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for console debug refresh events (EXACT SHIFT ENTRY PATTERN)
  useEffect(() => {
    const handleConsoleRefresh = (event) => {
      if (user) {
        console.log('🔧 Console debug refresh triggered for ShiftHistory (SHIFT ENTRY PATTERN):', event.detail);
        setMessage('🔧 Console debug triggered - reloading data...');
        loadShiftHistory(true); // Force fresh data from Google Sheets like ShiftEntry
      }
    };

    window.addEventListener('forceShiftRefresh', handleConsoleRefresh);
    
    return () => {
      window.removeEventListener('forceShiftRefresh', handleConsoleRefresh);
    };
  }, [user]);

  // Debug: Log shift data to understand the structure
  useEffect(() => {
    if (shifts.length > 0) {
      console.log('🔍 Shift data structure debug:', shifts[0]);
      
      // Load edit history for all shifts on component mount
      loadEditHistoryForAllShifts();
      
      // Debug: Check edit status for each shift
      shifts.forEach((shift, index) => {
        const shiftId = shift.shiftId || shift.id;
        const isEdited = editHistory[shiftId] || shift._hasBeenEdited || shift.hasBeenEdited;
        
        console.log(`🔍 Shift ${index + 1} (${shiftId}) edit status:`, {
          'editHistory[shiftId]': editHistory[shiftId],
          '_hasBeenEdited': shift._hasBeenEdited,
          'hasBeenEdited': shift.hasBeenEdited,
          'isEdited': isEdited,
          'lastUpdated': shift.lastUpdated
        });
        
        const duration = shift.totalDuration || shift.totalHours || shift['Total Duration'] || shift['Total Hours'];
        if (!duration || duration === 0) {
          console.log(`⚠️ Shift ${index + 1} missing duration:`, {
            date: shift.date || shift.shiftDate,
            startTime: shift.firstStartTime || shift.startTime,
            endTime: shift.lastEndTime || shift.endTime,
            totalDuration: shift.totalDuration,
            totalHours: shift.totalHours,
            'Total Duration': shift['Total Duration'],
            'Total Hours': shift['Total Hours'],
            calculated: shift.firstStartTime && shift.lastEndTime ? calculateDuration(shift.firstStartTime, shift.lastEndTime) : 'N/A'
          });
        }
      });
    }
  }, [shifts, editHistory]); // Added editHistory as dependency

  // Load edit history for all shifts to maintain lock status after refresh
  const loadEditHistoryForAllShifts = async () => {
    if (!shifts.length) return;
    
    console.log('🔄 Loading edit history for all shifts...');
    const newEditHistory = {};
    
    // Check edit history for each shift
    for (const shift of shifts) {
      const shiftId = shift.shiftId || shift.id;
      if (shiftId) {
        try {
          const editHistoryResult = await checkShiftEditHistory(shiftId);
          if (editHistoryResult.success && editHistoryResult.data && editHistoryResult.data.hasBeenEdited) {
            newEditHistory[shiftId] = true;
            console.log(`🔒 Shift ${shiftId} marked as edited`);
          }
        } catch (error) {
          console.error(`Error checking edit history for shift ${shiftId}:`, error);
        }
      }
    }
    
    // Update the edit history state
    setEditHistory(newEditHistory);
    console.log('✅ Edit history loaded:', newEditHistory);
  };

  const loadShiftHistory = async (forceFresh = false) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🔄 Loading shift history - EXACTLY LIKE SHIFT ENTRY - forceFresh: ${forceFresh}`);
      
      // 🔥 REPLICATE SHIFT ENTRY PATTERN: Always use forceRefresh for fresh data
      const response = await getShifts({
        employeeId: user.id,
        forceRefresh: true, // Always force refresh like ShiftEntry
        forceFresh: true    // Always force fresh like ShiftEntry
      });

      if (response.success && response.data) {
        console.log('📋 SHIFT HISTORY - EXACT SHIFT ENTRY PATTERN - Pure sheet data received:', JSON.stringify(response.data, null, 2));
        
        // Handle both array and single object responses
        const shiftsData = Array.isArray(response.data) ? response.data : [response.data];
        
        // 🔥 REPLICATE SHIFT ENTRY SMART STATUS LOGIC for each shift
        const processedShifts = shiftsData.map((shift, index) => {
          if (!shift || !shift.segments) return shift;
          
          const sheetStatus = shift.status;
          const calculatedStatus = determineSmartStatus(shift); // Use same logic as ShiftEntry
          
          console.log(`📋 SHIFT ${index + 1} STATUS COMPARISON: Sheet="${sheetStatus}" vs Calculated="${calculatedStatus}"`);
          
          // Mark shifts that need status correction (like ShiftEntry does)
          if (sheetStatus !== calculatedStatus) {
            console.log(`🔄 SHIFT ${index + 1} STATUS MISMATCH: ${sheetStatus} → ${calculatedStatus}`);
            return {
              ...shift,
              status: calculatedStatus, // Use calculated status like ShiftEntry
              _statusCorrected: true,
              _originalBackendStatus: sheetStatus,
              _freshFromSheet: true
            };
          }
          
          return { ...shift, _freshFromSheet: true };
        });
        
        // Log each shift's key data points (exactly like ShiftEntry)
        processedShifts.forEach((shift, index) => {
          console.log(`📋 SHIFT ${index + 1} DATA (SHIFT ENTRY PATTERN):`, {
            shiftId: shift.shiftId,
            status: shift.status,
            totalDuration: shift.totalDuration,
            totalHours: shift.totalHours,
            lastEndTime: shift.lastEndTime,
            segments: shift.segments ? shift.segments.length : 0,
            _freshFromSheet: shift._freshFromSheet,
            _statusCorrected: shift._statusCorrected
          });
        });
        
        setShifts(processedShifts);
        setMessage('✅ Shift history loaded with fresh Google Sheets data (ShiftEntry pattern)');
      } else if (response.message && response.message.includes('Invalid action')) {
        setError('Shift history feature is being set up. The getShifts action needs to be added to your Google Apps Script backend.');
        setShifts([]);
      } else {
        setError(response.message || 'Failed to load shift history');
      }
    } catch (apiError) {
      console.error('Failed to load shift history:', apiError);
      if (apiError.message && apiError.message.includes('Invalid action')) {
        setError('Shift history feature is being set up. The getShifts action needs to be added to your Google Apps Script backend.');
        setShifts([]); // Set empty array to show the "no records" message
      } else {
        setError(handleAPIError(apiError));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration) => {
    const num = parseFloat(duration);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    
    try {
      const start = new Date(`1970-01-01T${startTime}:00`);
      const end = new Date(`1970-01-01T${endTime}:00`);
      let diffMs = end - start;
      
      // Handle overnight shifts
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      
      const hours = diffMs / (1000 * 60 * 60);
      return Math.round(hours * 100) / 100;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  };

  // 🔧 Calculate real-time end time and duration from segments
  const calculateRealTimeDataFromSegments = (shift) => {
    if (!shift.timeSegments && !shift.segments) {
      return {
        realEndTime: shift.lastEndTime || shift.endTime,
        realTotalDuration: shift.totalDuration || 0
      };
    }

    // Parse segments from either timeSegments or segments field
    let segments = shift.timeSegments || shift.segments;
    if (typeof segments === 'string') {
      try {
        segments = JSON.parse(segments);
      } catch (error) {
        console.error('Error parsing segments:', error);
        return {
          realEndTime: shift.lastEndTime || shift.endTime,
          realTotalDuration: shift.totalDuration || 0
        };
      }
    }

    if (!segments || segments.length === 0) {
      return {
        realEndTime: shift.lastEndTime || shift.endTime,
        realTotalDuration: shift.totalDuration || 0
      };
    }

    // Calculate real end time from last segment
    const lastSegment = segments[segments.length - 1];
    const realEndTime = lastSegment?.endTime || shift.lastEndTime || shift.endTime;

    // Calculate total duration from all segments
    const realTotalDuration = segments.reduce((total, segment) => {
      if (segment.startTime && segment.endTime) {
        const segmentDuration = calculateDuration(segment.startTime, segment.endTime);
        return total + segmentDuration;
      }
      return total + (segment.duration || 0);
    }, 0);

    console.log(`🔍 Real-time calculation for shift: endTime=${realEndTime}, totalDuration=${realTotalDuration.toFixed(2)}`);

    return { realEndTime, realTotalDuration };
  };

  const handleEditShift = async (shift) => {
    // Check if this shift has already been edited (one-time edit limit for employees)
    if (user && user.role !== 'admin') {
      setCheckingEditHistory(true);
      try {
        const editHistoryResult = await checkShiftEditHistory(shift.shiftId || shift.id);
        
        if (editHistoryResult.success && editHistoryResult.data && editHistoryResult.data.hasBeenEdited) {
          alert('⚠️ Edit Limit Reached\n\nThis shift has already been edited once. Employees can only edit each shift one time.\n\nIf you need to make additional changes, please contact an administrator.');
          setCheckingEditHistory(false);
          return;
        }
      } catch (error) {
        console.error('Error checking edit history:', error);
        // Continue with edit if check fails
      }
      setCheckingEditHistory(false);
    }
    
    setEditingShift(shift);
    
    // Debug: Log the shift data to see what properties are available
    console.log('🔍 Edit shift data:', shift);
    console.log('📝 Available time properties:', {
      firstStartTime: shift.firstStartTime,
      startTime: shift.startTime,
      'Start Time': shift['Start Time'],
      lastEndTime: shift.lastEndTime,
      endTime: shift.endTime,
      'End Time': shift['End Time']
    });
    
    // Helper function to extract HH:MM from various time formats
    const extractTime = (timeValue) => {
      if (!timeValue) return '';
      
      // If it's already in HH:MM format, return as-is
      if (typeof timeValue === 'string' && /^\d{2}:\d{2}$/.test(timeValue)) {
        return timeValue;
      }
      
      // If it's an ISO date string, extract the time part
      if (typeof timeValue === 'string' && timeValue.includes('T')) {
        const date = new Date(timeValue);
        return date.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Calcutta' // Match your timezone
        });
      }
      
      // If it's a Date object, format it
      if (timeValue instanceof Date) {
        return timeValue.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Calcutta'
        });
      }
      
      return '';
    };
    
    // Try to get times from segments first if main times are problematic
    let startTime = '';
    let endTime = '';
    
    if (shift.segments && shift.segments.length > 0) {
      // Use the first segment's start time and last segment's end time
      const firstSegment = shift.segments[0];
      const lastSegment = shift.segments[shift.segments.length - 1];
      
      startTime = firstSegment.startTime || extractTime(shift.firstStartTime || shift.startTime || shift['Start Time']);
      endTime = lastSegment.endTime || extractTime(shift.lastEndTime || shift.endTime || shift['End Time']);
    } else {
      // Fallback to main shift times
      startTime = extractTime(shift.firstStartTime || shift.startTime || shift['Start Time']);
      endTime = extractTime(shift.lastEndTime || shift.endTime || shift['End Time']);
    }
    
    console.log('🕐 Extracted times:', { startTime, endTime });
    
    setEditFormData({
      firstStartTime: startTime,
      lastEndTime: endTime,
      shiftType: shift.shiftType || shift['Shift Type'] || 'Regular'
    });
  };

  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditFormData({
      firstStartTime: '',
      lastEndTime: '',
      shiftType: 'Regular'
    });
  };

  const handleSaveEdit = async () => {
    if (!editingShift || !editFormData.firstStartTime || !editFormData.lastEndTime) {
      alert('Please fill in both start and end times.');
      return;
    }

    // Calculate new duration
    const newDuration = calculateDuration(editFormData.firstStartTime, editFormData.lastEndTime);
    if (newDuration <= 0) {
      alert('End time must be after start time.');
      return;
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(editFormData.firstStartTime) || !timeRegex.test(editFormData.lastEndTime)) {
      alert('Please enter valid time format (HH:MM).');
      return;
    }

    // Validate that end time is after start time
    if (editFormData.firstStartTime >= editFormData.lastEndTime) {
      alert('End time must be after start time.');
      return;
    }

    // Special warning for completed shifts
    if (editingShift.status === 'COMPLETED') {
      const confirmEdit = window.confirm(
        'This shift is marked as COMPLETED. Editing will mark it as updated. Do you want to continue?'
      );
      if (!confirmEdit) {
        return;
      }
    }

    setSaving(true);
    try {
      // Create updated segments data (EXACT SHIFT ENTRY PATTERN)
      const updatedSegments = [{
        segmentId: 1,
        startTime: editFormData.firstStartTime,
        endTime: editFormData.lastEndTime,
        duration: newDuration
      }];

      // 🔥 CALCULATE SMART STATUS (EXACT SHIFT ENTRY PATTERN)
      const mockShiftData = {
        segments: updatedSegments,
        status: 'ACTIVE'
      };
      const calculatedStatus = determineSmartStatus(mockShiftData);
      
      console.log(`📊 History Regular Edit - Smart status calculated: ${calculatedStatus}`);

      // Use the edit tracking system with EXACT SHIFT ENTRY COLUMN UPDATES
      const response = await updateShiftWithEditTracking({
        shiftId: editingShift.shiftId || editingShift.id,
        employeeName: user.name,
        employeeId: user.id,
        shiftDate: editingShift.shiftDate || editingShift.date,
        shiftType: editFormData.shiftType,
        segments: updatedSegments, // Column I & J update
        firstStartTime: editFormData.firstStartTime, // Column F update
        lastEndTime: editFormData.lastEndTime, // Column G update
        totalDuration: newDuration, // Column H update
        scheduleStatus: calculatedStatus, // Column K update (EXACT SHIFT ENTRY LOGIC)
        isUpdate: true,
        isEmployeeEdit: true,
        editedBy: user.name,
        editedById: user.id
      });

      if (response.success) {
        setMessage('✅ Shift updated successfully in Google Sheets!');
        
        // � Force fresh data reload (EXACT SHIFT ENTRY PATTERN)
        console.log('🔄 Forcing fresh data reload after regular edit (SHIFT ENTRY PATTERN)...');
        setTimeout(() => {
          loadShiftHistory(true); // Always force fresh like ShiftEntry
        }, 1000); // Small delay to ensure backend processing is complete
        
        // Track that this shift has been edited (for one-time limit)
        setEditHistory(prev => ({
          ...prev,
          [editingShift.shiftId || editingShift.id]: true
        }));
        
        const isFirstEdit = user && user.role !== 'admin';
        const successMessage = isFirstEdit 
          ? '✅ Shift updated successfully!\n\n⚠️ Note: This shift can no longer be edited. Employees can only edit each shift once.'
          : '✅ Shift updated successfully!';
        
        alert(successMessage);
        handleCancelEdit();
        loadShiftHistory(); // Reload to show updated data
      } else {
        alert('Error updating shift: ' + response.message);
      }
    } catch (error) {
      console.error('Failed to update shift:', error);
      alert('Error updating shift: ' + handleAPIError(error));
    } finally {
      setSaving(false);
    }
  };

  // Handle advanced time segment editing - EXACT SHIFT ENTRY PATTERN
  const handleAdvancedEdit = async (segments, scheduleInfo = {}) => {
    if (!editingShift) return;
    
    setSaving(true);
    setMessage(''); // Clear message like ShiftEntry
    
    if (!user || !user.name || !user.id) {
      setMessage('Error: User information not available.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        segments,
        employeeName: editingShift.employeeName || editingShift.name,
        employeeId: editingShift.employeeId || editingShift.id,
        date: editingShift.shiftDate || editingShift.date,
        shiftType: editingShift.shiftType || 'Regular',
        ...scheduleInfo
      };
      
      // 🔥 CRITICAL: Pass existing shift ID if available for proper segment updates (EXACT SHIFT ENTRY LOGIC)
      if (editingShift && (editingShift.shiftId || editingShift.id)) {
        payload.existingShiftId = editingShift.shiftId || editingShift.id;
        payload.isUpdate = true;
        console.log(`� Using existing shift ID: ${editingShift.shiftId || editingShift.id} for segment update (SHIFT ENTRY PATTERN)`);
      } else {
        console.log('🆕 Creating new shift (no existing shift ID) - SHIFT ENTRY PATTERN');
      }
      
      console.log('📤 ShiftHistory submitting segments with payload (SHIFT ENTRY PATTERN):', payload);
      
      const response = await submitTimeSegments(payload);

      if (response.success) {
        setMessage('✅ Time segments updated successfully in Google Sheets!');
        
        // � Force fresh data reload to show updated segments (EXACT SHIFT ENTRY PATTERN)
        console.log('🔄 Forcing fresh data reload after segment update (SHIFT ENTRY PATTERN)...');
        setTimeout(() => {
          loadShiftHistory(true); // Always force fresh like ShiftEntry
        }, 1000); // Small delay to ensure backend processing is complete
        
        // Update edit history
        setEditHistory(prev => ({
          ...prev,
          [editingShift.shiftId || editingShift.id]: true
        }));
        
        const isFirstEdit = user && user.role !== 'admin';
        const successMessage = isFirstEdit 
          ? '✅ Time segments updated successfully in Google Sheets!\n\n⚠️ Note: This shift can no longer be edited. Employees can only edit each shift once.'
          : '✅ Time segments updated successfully in Google Sheets!';
        
        alert(successMessage);
        handleCancelEdit();
        setShowAdvancedEdit(false);
        
        console.log('🎯 SHIFT ENTRY PATTERN COMPLETE: UI now shows fresh sheet data');
      } else {
        setMessage('❌ Error: ' + response.message);
        alert('Error updating time segments: ' + response.message);
      }
    } catch (error) {
      setMessage('❌ Error: ' + handleAPIError(error));
      console.error('Failed to update time segments:', error);
      alert('Error updating time segments: ' + handleAPIError(error));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      // Display in user's local timezone
      return date.toLocaleDateString(undefined, {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // If it's already in HH:MM format, assume it's in server timezone and convert
      if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
        // Create a date object for today with the server time
        const today = new Date().toISOString().split('T')[0];
        const serverDateTime = new Date(`${today}T${timeStr}:00`);
        
        // Display in user's timezone
        return serverDateTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZone: userTimezone
        });
      }
      
      // If it's a timestamp format like "1899-12-30T06:59:50.000Z"
      if (timeStr.includes('T')) {
        const date = new Date(timeStr);
        // Convert to user's timezone
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZone: userTimezone
        });
      }
      
      // If it's just a time string, try to parse it as server time
      const today = new Date().toISOString().split('T')[0];
      const date = new Date(`${today}T${timeStr}`);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZone: userTimezone
        });
      }
      
      return timeStr;
    } catch (error) {
      console.error('Error formatting time:', timeStr, error);
      return timeStr;
    }
  };

  if (!user) {
    return (
      <div className="alert alert-warning">
        Please log in to view your shift history.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      <div className="row g-0">
        <div className="col-12">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-2">
            <div>
              <h4 className="mb-0 fs-5 fs-md-4">Shift History</h4>
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                Click <i className="bi bi-pencil"></i> to edit times for any shift (including completed ones)
              </small>
            </div>
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={() => loadShiftHistory(true)} // Force fresh data from Google Sheets
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Loading...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Refresh
                </>
              )}
            </button>
          </div>

          {/* Message display like ShiftEntry */}
          {message && (
            <div className={`alert ${message.includes('✅') ? 'alert-success' : message.includes('❌') ? 'alert-danger' : 'alert-info'} alert-dismissible fade show`} role="alert">
              {message}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setMessage('')}
                aria-label="Close"
              ></button>
            </div>
          )}

          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {error}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setError('')}
                aria-label="Close"
              ></button>
            </div>
          )}

          {shifts.length === 0 ? (
            <div className="alert alert-info">
              No shift records found. Start tracking your shifts to see history here.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="d-block d-md-none">
                {shifts.map((shift, index) => {
                  // 🔧 Calculate real-time data for each shift
                  const { realEndTime, realTotalDuration } = calculateRealTimeDataFromSegments(shift);
                  
                  return (
                  <div key={shift.id || index} className="card mb-3 border-start border-primary border-3">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="card-title mb-0 text-primary">
                          {formatDate(shift.shiftDate || shift.date)}
                        </h6>
                        <div className="d-flex flex-column gap-1 align-items-end">
                          <span className={`badge ${
                            shift.shiftType === 'Overtime' ? 'bg-warning text-dark' : 'bg-primary'
                          }`}>
                            {shift.shiftType || 'Regular'}
                          </span>
                          {(shift.updated === true || shift.updated === 'TRUE') && (
                            <span className="badge bg-info text-dark" style={{fontSize: '0.7rem'}} title="This shift has been updated">
                              <i className="bi bi-pencil-fill"></i> Updated
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="row g-2 text-sm">
                        <div className="col-6">
                          <small className="text-muted d-block">Shift ID</small>
                          <span style={{fontSize: '0.8rem', fontFamily: 'monospace'}}>{shift.shiftId || shift.id || 'N/A'}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Date</small>
                          <span>{formatDate(shift.shiftDate || shift.date)}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Start Time</small>
                          <span>{formatTime(shift.firstStartTime || shift.startTime)}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">End Time</small>
                          <span>{formatTime(realEndTime)}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Total Hours</small>
                          <strong className="text-success">{formatDuration(
                            realTotalDuration || 
                            shift.totalHours || 
                            shift['Total Duration'] ||
                            shift['Total Hours'] ||
                            // Fallback: calculate from segments if main duration is 0 or missing
                            ((!shift.totalDuration || shift.totalDuration === 0) && shift.segments && shift.segments.length > 0 
                              ? shift.segments.reduce((total, seg) => total + (parseFloat(seg.duration) || 0), 0)
                              : (shift.firstStartTime && shift.lastEndTime ? calculateDuration(shift.firstStartTime, shift.lastEndTime) : 0))
                          )} hrs</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Status</small>
                          <span className={`badge badge-sm ${
                            shift.status === 'COMPLETED' ? 'bg-success' : 
                            shift.status === 'ACTIVE' ? 'bg-primary' :
                            shift.status === 'ON BREAK' ? 'bg-warning text-dark' :
                            shift.status === 'DRAFT' ? 'bg-secondary' : 'bg-light text-dark'
                          }`}>
                            {shift.status || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="d-flex gap-1">
                          <button 
                            className={`btn btn-sm flex-fill ${
                              editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited
                                ? 'btn-outline-secondary' 
                                : 'btn-outline-primary'
                            }`}
                            onClick={() => handleEditShift(shift)}
                            disabled={checkingEditHistory || (user && user.role !== 'admin' && (editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited))}
                            title={
                              checkingEditHistory 
                                ? 'Checking edit permissions...'
                                : (editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited)
                                  ? (user && user.role !== 'admin' ? 'Already edited (limit reached)' : 'Edit shift times (admin)')
                                  : 'Edit shift times'
                            }
                          >
                            {checkingEditHistory ? (
                              <>
                                <div className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></div>
                                Checking...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-pencil me-1"></i>
                                {((editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited) && 
                                 user && user.role !== 'admin') ? (
                                  <>
                                    Locked
                                    <i className="bi bi-lock-fill ms-1" style={{fontSize: '0.8em'}}></i>
                                  </>
                                ) : 'Edit Times'}
                              </>
                            )}
                          </button>
                          <button 
                            className="btn btn-outline-info btn-sm flex-fill"
                            onClick={() => {
                              alert(`Shift details for ${formatDate(shift.shiftDate || shift.date)}`);
                            }}
                          >
                            <i className="bi bi-eye me-1"></i>
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )})}
              </div>

              {/* Desktop Table View */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th>Shift ID</th>
                      <th>Date</th>
                      <th>Shift Type</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Total Hours</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift, index) => {
                      // 🔧 Calculate real-time data for each shift
                      const { realEndTime, realTotalDuration } = calculateRealTimeDataFromSegments(shift);
                      
                      return (
                      <tr key={shift.id || index}>
                        <td style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{shift.shiftId || shift.id || 'N/A'}</td>
                        <td>{formatDate(shift.shiftDate || shift.date)}</td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <span className={`badge ${
                              shift.shiftType === 'Overtime' ? 'bg-warning text-dark' : 'bg-primary'
                            }`}>
                              {shift.shiftType || 'Regular'}
                            </span>
                            {(shift.updated === true || shift.updated === 'TRUE') && (
                              <span className="badge bg-info text-dark" style={{fontSize: '0.7rem'}} title="This shift has been updated">
                                <i className="bi bi-pencil-fill"></i> Updated
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{formatTime(shift.firstStartTime || shift.startTime)}</td>
                        <td>{formatTime(realEndTime)}</td>
                        <td>
                          <strong>{formatDuration(realTotalDuration)}</strong> hrs
                        </td>
                        <td>
                          <span className={`badge ${
                            shift.status === 'COMPLETED' ? 'bg-success' : 
                            shift.status === 'ACTIVE' ? 'bg-primary' :
                            shift.status === 'ON BREAK' ? 'bg-warning text-dark' :
                            shift.status === 'DRAFT' ? 'bg-secondary' : 'bg-light text-dark'
                          }`}>
                            {shift.status || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button 
                              className={`btn btn-sm ${
                                editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited
                                  ? 'btn-outline-secondary' 
                                  : 'btn-outline-primary'
                              }`}
                              onClick={() => handleEditShift(shift)}
                              disabled={checkingEditHistory || (user && user.role !== 'admin' && (editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited))}
                              title={
                                checkingEditHistory 
                                  ? 'Checking edit permissions...'
                                  : (editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited)
                                    ? (user && user.role !== 'admin' ? 'Already edited (limit reached)' : 'Edit shift times (admin)')
                                    : 'Edit shift times'
                              }
                            >
                              {checkingEditHistory ? (
                                <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
                              ) : (
                                <>
                                  <i className="bi bi-pencil"></i>
                                  {((editHistory[shift.shiftId || shift.id] || shift._hasBeenEdited || shift.hasBeenEdited) && 
                                   user && user.role !== 'admin') && (
                                    <i className="bi bi-lock-fill ms-1 text-muted" style={{fontSize: '0.8em'}}></i>
                                  )}
                                </>
                              )}
                            </button>
                            <button 
                              className="btn btn-outline-info btn-sm"
                              onClick={() => {
                                alert(`Shift details for ${formatDate(shift.shiftDate || shift.date)}`);
                              }}
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      )})}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {shifts.length > 0 && (
            <div className="mt-3 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
              <div>
                <small className="text-muted">
                  Total shifts: {shifts.length} | 
                  Total hours: {shifts.reduce((sum, shift) => {
                    // 🔧 Use real-time calculated duration
                    const { realTotalDuration } = calculateRealTimeDataFromSegments(shift);
                    return sum + realTotalDuration;
                  }, 0).toFixed(2)}
                </small>
              </div>
              <div>
                <small className="text-muted">
                  <i className="bi bi-clock me-1"></i>
                  Times shown in: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Shift Modal */}
      {editingShift && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-pencil-square me-2"></i>
                  Edit Shift Times
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={handleCancelEdit}
                  disabled={saving}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Date:</strong> {formatDate(editingShift.shiftDate || editingShift.date)}
                </div>
                
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Shift Type</label>
                    <select 
                      className="form-select"
                      value={editFormData.shiftType}
                      onChange={(e) => setEditFormData({...editFormData, shiftType: e.target.value})}
                      disabled={saving}
                    >
                      <option value="Regular">Regular</option>
                      <option value="Overtime">Overtime</option>
                      <option value="Night">Night Shift</option>
                      <option value="Weekend">Weekend</option>
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Start Time</label>
                    <input 
                      type="time"
                      className="form-control"
                      value={editFormData.firstStartTime}
                      onChange={(e) => setEditFormData({...editFormData, firstStartTime: e.target.value})}
                      disabled={saving}
                      required
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">End Time</label>
                    <input 
                      type="time"
                      className="form-control"
                      value={editFormData.lastEndTime}
                      onChange={(e) => setEditFormData({...editFormData, lastEndTime: e.target.value})}
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
                
                {editFormData.firstStartTime && editFormData.lastEndTime && (
                  <div className="mt-3 p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Calculated Duration:</span>
                      <strong className="text-primary">
                        {calculateDuration(editFormData.firstStartTime, editFormData.lastEndTime).toFixed(2)} hours
                      </strong>
                    </div>
                  </div>
                )}
                
                {/* Advanced Time Segment Entry */}
                {showAdvancedEdit && (
                  <div className="mt-4">
                    <h6 className="text-primary">
                      <i className="bi bi-gear me-2"></i>
                      Advanced Time Segment Editor
                    </h6>
                    <div className="border rounded p-3 bg-light">
                      <TimeSegmentEntry
                        existingSegments={editingShift ? JSON.parse(editingShift.timeSegments || '[]') : []}
                        onSubmit={handleAdvancedEdit}
                        buttonText="Update Time Segments"
                        submitButtonClass="btn-success"
                        showSubmitButton={true}
                        employeeName={editingShift?.employeeName}
                        employeeId={editingShift?.employeeId}
                        shiftDate={editingShift?.shiftDate || editingShift?.date}
                        onCancel={() => setShowAdvancedEdit(false)}
                      />
                    </div>
                  </div>
                )}
                
                <div className="mt-3">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Note: This will update the shift times, recalculate duration, and mark the shift as "Updated" in the system.
                    {editingShift && editingShift.status === 'COMPLETED' && (
                      <span className="text-warning d-block mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        <strong>Warning:</strong> This shift is completed. Editing will change its status.
                      </span>
                    )}
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-info me-2" 
                  onClick={() => setShowAdvancedEdit(!showAdvancedEdit)}
                  disabled={saving}
                >
                  <i className="bi bi-gear me-1"></i>
                  {showAdvancedEdit ? 'Hide Advanced' : 'Advanced Edit'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveEdit}
                  disabled={saving || !editFormData.firstStartTime || !editFormData.lastEndTime}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-1"></i>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftHistory;