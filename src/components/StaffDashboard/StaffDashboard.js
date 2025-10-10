import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ShiftEntry from '../ShiftEntry/ShiftEntry';
import ShiftHistory from '../ShiftHistory/ShiftHistory';
import { autoStatusUpdateOnLoad, manualStatusUpdate, handleAPIError } from '../../services/appScriptAPI';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('shift-entry');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Automatic status update on portal load
  useEffect(() => {
    if (user) {
      handleAutoStatusUpdate();
    }
  }, [user]);

  const handleAutoStatusUpdate = async () => {
    try {
      setStatusUpdateLoading(true);
      console.log('🚀 Running automatic status update on portal load...');
      const result = await autoStatusUpdateOnLoad();
      
      if (result.success) {
        console.log('✅ Auto status update completed:', result.message);
        setLastUpdateTime(new Date());
      } else {
        console.warn('⚠️ Auto status update warning:', result.message);
      }
    } catch (error) {
      console.error('❌ Auto status update failed:', error);
      // Don't show error to user for automatic updates
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleManualStatusUpdate = async () => {
    try {
      setStatusUpdateLoading(true);
      console.log('🔄 Running manual status update...');
      const result = await manualStatusUpdate();
      
      if (result.success) {
        alert(`✅ Status update completed!\n${result.message}`);
        setLastUpdateTime(new Date());
        // Trigger refresh of current tab content
        window.location.reload();
      } else {
        alert(`⚠️ Status update completed with warnings:\n${result.message}`);
      }
    } catch (error) {
      console.error('❌ Manual status update failed:', error);
      alert(`❌ Status update failed:\n${handleAPIError(error)}`);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'shift-entry':
        return <ShiftEntry />;
      case 'shift-history':
        return <ShiftHistory />;
      default:
        return <ShiftEntry />;
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      {/* Navigation Bar */}
      <nav className="navbar navbar-expand-md navbar-dark bg-primary sticky-top">
        <div className="container-fluid px-3">
          <span className="navbar-brand mb-0 h1 d-flex align-items-center">
            <i className="bi bi-person-badge me-2"></i>
            <span className="d-none d-sm-inline">Staff Portal</span>
            <span className="d-inline d-sm-none">Portal</span>
          </span>
          
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarNav" 
            aria-controls="navbarNav" 
            aria-expanded="false" 
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto mb-2 mb-md-0">
              <li className="nav-item">
                <button 
                  className={`nav-link btn btn-link text-light p-2 ${activeTab === 'shift-entry' ? 'active fw-bold' : ''}`}
                  onClick={() => setActiveTab('shift-entry')}
                >
                  <i className="bi bi-clock me-1"></i>
                  <span className="d-none d-sm-inline">Shift Entry</span>
                  <span className="d-inline d-sm-none">Entry</span>
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link btn btn-link text-light p-2 ${activeTab === 'shift-history' ? 'active fw-bold' : ''}`}
                  onClick={() => setActiveTab('shift-history')}
                >
                  <i className="bi bi-calendar-check me-1"></i>
                  <span className="d-none d-sm-inline">View My Shifts</span>
                  <span className="d-inline d-sm-none">History</span>
                </button>
              </li>
            </ul>
            
            {/* Status Update Button */}
            <div className="navbar-nav me-3">
              <button 
                className="btn btn-outline-light btn-sm d-flex align-items-center"
                onClick={handleManualStatusUpdate}
                disabled={statusUpdateLoading}
                title={lastUpdateTime ? `Last updated: ${lastUpdateTime.toLocaleTimeString()}` : 'Update shift statuses'}
              >
                {statusUpdateLoading ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></div>
                    <span className="d-none d-sm-inline">Updating...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    <span className="d-none d-sm-inline">Refresh Status</span>
                    <span className="d-inline d-sm-none">Refresh</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="navbar-nav">
              <span className="navbar-text me-2 d-none d-md-inline">
                Welcome, <strong>{user?.name?.split(' ')[0] || 'User'}</strong>
              </span>
              <button 
                className="btn btn-outline-light btn-sm" 
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                <span className="d-none d-sm-inline">Logout</span>
                <span className="d-inline d-sm-none">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid p-2 p-md-4">
        <div className="row">
          <div className="col-12">
            {/* Content Header */}
            <div className="card shadow-sm mb-3 mb-md-4">
              <div className="card-body p-3">
                <div className="row align-items-center">
                  <div className="col">
                    <h4 className="mb-1 fs-5 fs-md-4">
                      {activeTab === 'shift-entry' && (
                        <>
                          <i className="bi bi-clock text-primary me-2"></i>
                          Shift Time Entry
                        </>
                      )}
                      {activeTab === 'shift-history' && (
                        <>
                          <i className="bi bi-calendar-check text-success me-2"></i>
                          My Shift History
                        </>
                      )}
                    </h4>
                    <p className="text-muted mb-0 small d-none d-md-block">
                      {activeTab === 'shift-entry' && 'Track your work hours and manage shift details'}
                      {activeTab === 'shift-history' && 'View and review your completed shifts'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Content */}
            <div className="card shadow-sm">
              <div className="card-body p-2 p-md-4">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
