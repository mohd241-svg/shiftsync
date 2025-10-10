import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getShifts, handleAPIError } from '../../services/appScriptAPI';

const ShiftHistory = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadShiftHistory();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadShiftHistory = async () => {
    setLoading(true);
    setError('');
    
    try {
      // First try to get shifts using the getShifts API
      const response = await getShifts({
        employeeId: user.id
        // You can add date filters here if needed:
        // startDate: '2024-01-01',
        // endDate: '2024-12-31'
      });

      if (response.success && response.data) {
        // Handle both array and single object responses
        const shiftsData = Array.isArray(response.data) ? response.data : [response.data];
        setShifts(shiftsData);
      } else if (response.message && response.message.includes('Invalid action')) {
        // If getShifts is not implemented in backend, show helpful message
        setError('Shift history feature is being set up. The getShifts action needs to be added to your Google Apps Script backend.');
        setShifts([]); // Set empty array to show the "no records" message
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
            <h4 className="mb-0 fs-5 fs-md-4">Shift History</h4>
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={loadShiftHistory}
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
                {shifts.map((shift, index) => (
                  <div key={shift.id || index} className="card mb-3 border-start border-primary border-3">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="card-title mb-0 text-primary">
                          {formatDate(shift.shiftDate || shift.date)}
                        </h6>
                        <span className={`badge ${
                          shift.shiftType === 'Overtime' ? 'bg-warning text-dark' : 'bg-primary'
                        }`}>
                          {shift.shiftType || 'Regular'}
                        </span>
                      </div>
                      <div className="row g-2 text-sm">
                        <div className="col-6">
                          <small className="text-muted d-block">Start Time</small>
                          <span>{formatTime(shift.firstStartTime || shift.startTime)}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">End Time</small>
                          <span>{formatTime(shift.lastEndTime || shift.endTime)}</span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Total Hours</small>
                          <strong className="text-success">{formatDuration(shift.totalDuration || shift.totalHours)} hrs</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Status</small>
                          <span className={`badge badge-sm ${
                            shift.status === 'COMPLETED' ? 'bg-success' : 
                            shift.status === 'DRAFT' ? 'bg-warning text-dark' : 'bg-secondary'
                          }`}>
                            {shift.status || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <button 
                          className="btn btn-outline-info btn-sm w-100"
                          onClick={() => {
                            alert(`Shift details for ${formatDate(shift.shiftDate || shift.date)}`);
                          }}
                        >
                          <i className="bi bi-eye me-1"></i>
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="table-responsive d-none d-md-block">
                <table className="table table-striped table-hover">
                  <thead className="table-dark">
                    <tr>
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
                    {shifts.map((shift, index) => (
                      <tr key={shift.id || index}>
                        <td>{formatDate(shift.shiftDate || shift.date)}</td>
                        <td>
                          <span className={`badge ${
                            shift.shiftType === 'Overtime' ? 'bg-warning text-dark' : 'bg-primary'
                          }`}>
                            {shift.shiftType || 'Regular'}
                          </span>
                        </td>
                        <td>{formatTime(shift.firstStartTime || shift.startTime)}</td>
                        <td>{formatTime(shift.lastEndTime || shift.endTime)}</td>
                        <td>
                          <strong>{formatDuration(shift.totalDuration || shift.totalHours)}</strong> hrs
                        </td>
                        <td>
                          <span className={`badge ${
                            shift.status === 'COMPLETED' ? 'bg-success' : 
                            shift.status === 'DRAFT' ? 'bg-warning text-dark' : 'bg-secondary'
                          }`}>
                            {shift.status || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-outline-info btn-sm"
                            onClick={() => {
                              alert(`Shift details for ${formatDate(shift.shiftDate || shift.date)}`);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
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
                  Total hours: {shifts.reduce((sum, shift) => sum + parseFloat(shift.totalDuration || shift.totalHours || 0), 0).toFixed(2)}
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
    </div>
  );
};

export default ShiftHistory;