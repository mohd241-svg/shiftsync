import React, { useState, useEffect, useCallback } from 'react';
import { 
  Button, 
  Grid, 
  Alert,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Typography,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  AccessTime,
  PlayArrow,
  Pause,
  Stop,
  Schedule,
  CheckCircle
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getCurrentShift, 
  getCurrentDate,
  handleAPIError,
  makeAPICall,
  syncStatusToSheet,
  submitTimeSegments
} from '../../services/appScriptAPI';
import TimeSegmentEntry from '../TimeSegmentEntry/TimeSegmentEntry';

const ShiftEntry = ({ refreshTrigger }) => {
  const { user } = useAuth();
  const [currentShift, setCurrentShift] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Enhanced Smart Status Calculation (synchronized with AdminDashboard)
  const determineSmartStatus = (shiftData) => {
    console.log('🧮 Employee Dashboard - Calculating smart status:', shiftData);
    
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

  // Load current shift with smart calculation → update sheet → fetch fresh data
  const loadCurrentShiftStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMessage('Loading shift data from Google Sheets...');
    
    try {
      const response = await getCurrentShift({
        employeeId: user.id,
        date: getCurrentDate(),
        forceRefresh: true
      });
      
      if (response.success && response.data) {
        console.log('📊 RECEIVED SHEET DATA:', JSON.stringify(response.data, null, 2));
        
        const sheetStatus = response.data.status;
        const calculatedStatus = determineSmartStatus(response.data);
        
        console.log(`STATUS COMPARISON: Sheet="${sheetStatus}" vs Calculated="${calculatedStatus}"`);
        
        // If statuses differ, update sheet first, then fetch fresh data
        if (sheetStatus !== calculatedStatus) {
          console.log(`UPDATING SHEET: ${sheetStatus} → ${calculatedStatus}`);
          
          try {
            const syncResult = await syncStatusToSheet(
              response.data.shiftId,
              calculatedStatus,
              `Smart status update: ${sheetStatus} → ${calculatedStatus}`
            );
            
            if (syncResult.success) {
              console.log('✅ Sheet updated successfully');
              
              // Fetch fresh data from updated sheet
              const freshResponse = await getCurrentShift({
                employeeId: user.id,
                date: getCurrentDate(),
                forceRefresh: true
              });
              
              if (freshResponse.success && freshResponse.data) {
                console.log('� Fresh sheet data received');
                setCurrentShift(freshResponse.data);
                setMessage(`✅ Status updated to ${calculatedStatus} - showing fresh sheet data`);
              } else {
                setCurrentShift(response.data);
                setMessage(`⚠️ Sheet updated but refresh failed - showing original data`);
              }
            } else {
              setCurrentShift(response.data);
              setMessage(`⚠️ Failed to update sheet: ${syncResult.message}`);
            }
          } catch (error) {
            console.error('❌ Status update error:', error);
            setCurrentShift(response.data);
            setMessage(`❌ Error updating status: ${error.message}`);
          }
        } else {
          // Statuses match - display sheet data as-is
          console.log('✅ Statuses match - displaying sheet data');
          setCurrentShift(response.data);
          setMessage(`📊 Current status: ${sheetStatus} (verified)`);
        }
      } else {
        setCurrentShift(null);
        setMessage('No shift found for today.');
      }
    } catch (error) {
      setMessage('Error: ' + handleAPIError(error));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCurrentShiftStatus();
    }
  }, [user, loadCurrentShiftStatus]);

  // Trigger refresh when refreshTrigger changes (from parent StaffDashboard)
  useEffect(() => {
    if (refreshTrigger && user) {
      console.log('🔄 Refresh trigger activated - fetching fresh data');
      loadCurrentShiftStatus();
    }
  }, [refreshTrigger, user, loadCurrentShiftStatus]);

  // Refresh data when tab becomes visible/active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('🔄 Tab became visible - refreshing shift data');
        loadCurrentShiftStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, loadCurrentShiftStatus]);

  // Listen for console debug refresh events
  useEffect(() => {
    const handleConsoleRefresh = (event) => {
      if (user) {
        console.log('🔧 Console debug refresh triggered:', event.detail);
        setMessage('🔧 Console debug triggered - reloading data...');
        loadCurrentShiftStatus();
      }
    };

    window.addEventListener('forceShiftRefresh', handleConsoleRefresh);
    
    return () => {
      window.removeEventListener('forceShiftRefresh', handleConsoleRefresh);
    };
  }, [user, loadCurrentShiftStatus]);

  const handleSubmitTimeSegments = async (segments, scheduleInfo = {}) => {
    setLoading(true);
    setMessage('');
    
    if (!user || !user.name || !user.id) {
      setMessage('Error: User information not available.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        segments,
        employeeName: user.name,
        employeeId: user.id,
        shiftType: 'Regular',
        date: getCurrentDate(),
        ...scheduleInfo
      };
      
      // 🔥 CRITICAL: Pass existing shift ID if available for proper segment updates
      if (currentShift && currentShift.shiftId) {
        payload.existingShiftId = currentShift.shiftId;
        payload.isUpdate = true;
        console.log(`🔧 Using existing shift ID: ${currentShift.shiftId} for segment update`);
      } else {
        console.log('🆕 Creating new shift (no existing shift ID)');
      }
      
      console.log('📤 ShiftEntry submitting segments with payload:', payload);
      
      const response = await submitTimeSegments(payload);

      if (response.success) {
        setMessage('✅ Time segments updated successfully in Google Sheets!');
        
        // 🔄 Force fresh data reload to show updated segments
        console.log('🔄 Forcing fresh data reload after segment update...');
        setTimeout(() => {
          loadCurrentShiftStatus();
        }, 1000); // Small delay to ensure backend processing is complete
        
      } else {
        setMessage('❌ Error: ' + response.message);
      }
    } catch (error) {
      setMessage('❌ Error: ' + handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteShift = async () => {
    if (!currentShift || !currentShift.shiftId) {
      setMessage('Error: No active shift to complete.');
      return;
    }

    setLoading(true);
    try {
      const response = await makeAPICall({
        action: 'completeShift',
        shiftId: currentShift.shiftId,
        employeeId: user.id,
        completedAt: new Date().toISOString()
      });

      if (response.success) {
        setMessage('Shift completed successfully!');
        loadCurrentShiftStatus();
      } else {
        setMessage('Error: ' + response.message);
      }
    } catch (error) {
      setMessage('Error: ' + handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const renderStatusChip = (status) => {
    const statusConfig = {
      'DRAFT': { color: 'default', icon: <Schedule />, label: 'Draft' },
      'OFFLINE': { color: 'default', icon: <Pause />, label: 'Offline' },
      'ACTIVE': { color: 'success', icon: <PlayArrow />, label: 'Active' },
      'ON BREAK': { color: 'warning', icon: <Pause />, label: 'On Break' },
      'COMPLETED': { color: 'primary', icon: <CheckCircle />, label: 'Completed' }
    };

    const config = statusConfig[status] || statusConfig['DRAFT'];
    
    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        variant="outlined"
        size="small"
      />
    );
  };

  const renderShiftSummary = () => {
    if (!currentShift) return null;

    const { segments = [], status } = currentShift;

    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Current Shift (Pure Sheet Data)</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {renderStatusChip(status)}
            </Box>
          </Box>
          
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Shift ID: {currentShift.shiftId} | Date: {currentShift.date}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Duration: {currentShift.totalDuration || 'N/A'} | Last End: {currentShift.lastEndTime || 'N/A'}
            </Typography>
          </Box>
          
          {segments.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Time Segments:
              </Typography>
              <List dense>
                {segments.map((segment, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <AccessTime fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${segment.startTime} - ${segment.endTime || 'In Progress'}`}
                      secondary={segment.activity || 'Work'}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Shift Entry
      </Typography>

      {message && (
        <Alert 
          severity={message.includes('Error') ? 'error' : 'success'} 
          sx={{ mb: 2 }}
        >
          {message}
        </Alert>
      )}

      {renderShiftSummary()}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <TimeSegmentEntry
              onSubmit={handleSubmitTimeSegments}
              currentShift={currentShift}
              loading={loading}
            />
          </Paper>
        </Grid>
      </Grid>

      {currentShift && currentShift.status === 'ACTIVE' && (
        <Box mt={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCompleteShift}
            disabled={loading}
            startIcon={<Stop />}
          >
            Complete Shift
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={loadCurrentShiftStatus}
            disabled={loading}
            sx={{ ml: 2 }}
          >
            Refresh Sheet Data
          </Button>
        </Box>
      )}

      {(!currentShift || currentShift.status !== 'ACTIVE') && (
        <Box mt={2}>
          <Button
            variant="outlined"
            color="primary"
            onClick={loadCurrentShiftStatus}
            disabled={loading}
          >
            Refresh Sheet Data
          </Button>
        </Box>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" mt={2}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default ShiftEntry;