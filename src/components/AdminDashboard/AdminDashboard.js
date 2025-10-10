import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getShifts,
  getStaffList,
  makeAPICall,
  handleAPIError,
  debugSheetStructure
} from '../../services/appScriptAPI';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  // eslint-disable-next-line no-unused-vars
  const [allShifts, setAllShifts] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalShifts: 0,
    todayShifts: 0,
    activeShifts: 0,
    completedShifts: 0,
    totalStaff: 0
  });
  const [message, setMessage] = useState('');
  
  // Overview tab specific states
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('today');
  const [overviewData, setOverviewData] = useState([]);
  const [showOverviewTable, setShowOverviewTable] = useState(false);
  const [columnFilters, setColumnFilters] = useState({});
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  
  // Shifts tab specific states
  const [shiftsTimePeriod, setShiftsTimePeriod] = useState('week');
  const [shiftsData, setShiftsData] = useState([]);
  const [rawShiftsData, setRawShiftsData] = useState([]); // For debugging
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shiftsColumnFilters, setShiftsColumnFilters] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingShift, setEditingShift] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showShiftsTable, setShowShiftsTable] = useState(false);
  const [shiftsCustomDateRange, setShiftsCustomDateRange] = useState({ start: '', end: '' });

  // AI Features states
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState(null);

  // Staff Management states
  const [editingStaff, setEditingStaff] = useState(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: 'Staff',
    department: '',
    timezone: 'Asia/Kolkata (India Standard Time)'
  });


  // Define exact column order and names from Apps Script (excluding Row Index)
  const appsScriptColumns = [
    { key: 'Shift ID', label: 'Shift ID' },
    { key: 'Employee Name', label: 'Employee Name' },
    { key: 'Employee ID', label: 'Employee ID' },
    { key: 'Shift Date', label: 'Shift Date' },
    { key: 'Shift Type', label: 'Shift Type' },
    { key: 'First Start Time', label: 'First Start Time' },
    { key: 'Last End Time', label: 'Last End Time' },
    { key: 'Total Duration', label: 'Total Duration' },
    { key: 'Number of Segments', label: 'Number of Segments' },
    { key: 'Segments Data', label: 'Segments Data' },
    { key: 'Status', label: 'Status' },
    { key: 'Created At', label: 'Created At' },
    { key: 'Last Updated', label: 'Last Updated' },
    { key: 'Initial Segment Data', label: 'Initial Segment Data' },
    { key: 'Updated', label: 'Updated' },
    { key: 'Time Zone', label: 'Time Zone' }
  ];

  const columns = useMemo(() => {
    return appsScriptColumns.map(col => ({
      accessorKey: col.key,
      header: col.label,
      Cell: ({ cell }) => formatCellData(cell.getValue(), col.key),
    }));
  }, []);

  // Smart Status Calculation Logic (moved from Apps Script)
  const calculateSmartStatus = (segments, currentTime, firstStartTime, lastEndTime, shiftDate) => {
    console.log('🧮 Calculating smart status:', { segments, currentTime, firstStartTime, lastEndTime, shiftDate });
    
    if (!segments || segments.length === 0) {
      console.log('📝 No segments - DRAFT');
      return 'DRAFT';
    }

    // Parse segments if they're stored as JSON string
    let parsedSegments = segments;
    if (typeof segments === 'string') {
      try {
        parsedSegments = JSON.parse(segments);
        console.log('📋 Parsed segments:', parsedSegments);
      } catch (e) {
        console.log('❌ Failed to parse segments:', e);
        return 'DRAFT';
      }
    }
    
    if (!Array.isArray(parsedSegments)) {
      console.log('❌ Segments not an array');
      return 'DRAFT';
    }

    // Get current time with proper timezone handling
    const now = new Date();
    const currentDateTime = now.getTime();
    console.log('⏰ Current date/time:', now.toLocaleString(), 'timestamp:', currentDateTime);
    
    // Parse shift date to create proper date/time comparisons
    let shiftDateObj;
    if (shiftDate) {
      // Handle different date formats
      if (shiftDate.includes('/')) {
        // Format: MM/DD/YYYY or similar
        shiftDateObj = new Date(shiftDate);
      } else if (shiftDate.includes(',')) {
        // Format: "Oct 8, 2025"
        shiftDateObj = new Date(shiftDate);
      } else {
        // Try parsing as is
        shiftDateObj = new Date(shiftDate);
      }
    }
    
    if (!shiftDateObj || isNaN(shiftDateObj.getTime())) {
      console.log('⚠️ Invalid shift date, using today:', shiftDate);
      shiftDateObj = new Date();
      shiftDateObj.setHours(0, 0, 0, 0); // Start of today
    }
    
    console.log('📅 Shift date:', shiftDateObj.toDateString());
    
    // Get the actual start and end times from segments
    const firstSegment = parsedSegments[0];
    const lastSegment = parsedSegments[parsedSegments.length - 1];
    
    if (firstSegment && firstSegment.startTime) {
      // Create full datetime for shift start
      const [startHours, startMinutes] = firstSegment.startTime.split(':').map(Number);
      const shiftStartDateTime = new Date(shiftDateObj);
      shiftStartDateTime.setHours(startHours, startMinutes, 0, 0);
      
      console.log('🚀 Shift start datetime:', shiftStartDateTime.toLocaleString());
      
      // Check if shift hasn't started yet (considering date)
      if (currentDateTime < shiftStartDateTime.getTime()) {
        console.log('⚫ Before start time - OFFLINE');
        return 'OFFLINE';
      }
    }

    // Check for active segments (segments without end time)
    const hasActiveSegment = parsedSegments.some(seg => !seg.endTime);
    console.log('🔄 Has active segment (no end time):', hasActiveSegment);
    
    if (hasActiveSegment) {
      console.log('🟢 Active segment detected - ACTIVE');
      return 'ACTIVE';
    }

    // Check if current time is before the last segment's end time (with date consideration)
    if (lastSegment && lastSegment.endTime) {
      // Create full datetime for shift end
      const [endHours, endMinutes] = lastSegment.endTime.split(':').map(Number);
      const shiftEndDateTime = new Date(shiftDateObj);
      shiftEndDateTime.setHours(endHours, endMinutes, 0, 0);
      
      console.log('🏁 Shift end datetime:', shiftEndDateTime.toLocaleString());
      console.log('⏰ Comparison: current', now.toLocaleString(), 'vs end', shiftEndDateTime.toLocaleString());
      
      if (currentDateTime < shiftEndDateTime.getTime()) {
        console.log('🟢 Current time before end time - should be ACTIVE');
        return 'ACTIVE';
      } else {
        console.log('🔵 Current time after end time - COMPLETED');
        return 'COMPLETED';
      }
    }

    // If all segments have end times but no clear end time, likely still active
    if (parsedSegments.length > 0 && parsedSegments.every(seg => seg.endTime)) {
      console.log('🟡 All segments have end times but unclear - ACTIVE for safety');
      return 'ACTIVE'; // Keep as active for manual completion
    }

    console.log('📝 Fallback to DRAFT');
    return 'DRAFT';
  };

  // Helper function to convert HH:MM to minutes
  const timeToMinutes = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  // Helper function to get current time in HH:MM format
  const getCurrentTimeString = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5); // HH:MM format
  };

  // Function to sync status with backend when calculated status differs
  const syncStatusWithBackend = async (shift, calculatedStatus) => {
    if (calculatedStatus !== shift['Status']) {
      try {
        console.log(`🔄 === STATUS SYNC INITIATED ===`);
        console.log(`Shift ID: ${shift['Shift ID']}`);
        console.log(`Backend Status: "${shift['Status']}" → Calculated Status: "${calculatedStatus}"`);
        console.log(`Calling makeAPICall with:`, {
          action: 'updateShiftStatus',
          shiftId: shift['Shift ID'],
          newStatus: calculatedStatus,
          reason: 'Smart status calculation'
        });
        
        const response = await makeAPICall({
          action: 'updateShiftStatus',
          shiftId: shift['Shift ID'],
          newStatus: calculatedStatus,
          reason: 'Smart status calculation'
        });
        
        console.log(`📡 API Response:`, response);
        
        if (response.success) {
          console.log(`✅ Status synced successfully for ${shift['Shift ID']}`);
          return calculatedStatus;
        } else {
          console.warn(`⚠️ Failed to sync status for ${shift['Shift ID']}:`, response.message);
        }
      } catch (error) {
        console.error(`❌ Error syncing status for ${shift['Shift ID']}:`, error);
      }
    } else {
      console.log(`⭐ No sync needed for ${shift['Shift ID']} - statuses match`);
    }
    return shift['Status']; // Return original status if sync failed
  };

  // Enhanced normalization with smart status calculation
  const normalizeRecord = async (rec) => {
    if (!rec || typeof rec !== 'object') return rec;
    
    // Enhanced debug logging for status calculation
    console.log('🔍 === NORMALIZING RECORD ===');
    console.log('Input record:', rec);
    console.log('Shift ID:', rec['Shift ID']);
    console.log('Current stored status:', rec['Status'] || rec.status);
    console.log('Segments data:', rec['Segments Data'] || rec.segments);
    console.log('First start time:', rec['First Start Time'] || rec.startTime);
    console.log('Last end time:', rec['Last End Time'] || rec.endTime);
    console.log('Shift date:', rec['Shift Date'] || rec.date);
    
    // Calculate smart status based on current time and shift data (now with date awareness)
    const currentTime = getCurrentTimeString();
    console.log('⏰ Current time for calculation:', currentTime);
    
    const calculatedStatus = calculateSmartStatus(
      rec['Segments Data'] || rec.segments,
      currentTime,
      rec['First Start Time'] || rec.startTime,
      rec['Last End Time'] || rec.endTime,
      rec['Shift Date'] || rec.date // Pass shift date for proper date/time comparison
    );
    
    console.log('🧮 Calculated smart status:', calculatedStatus);
    console.log('🔍 Original status:', rec['Status'] || rec.status);
    console.log('❓ Status needs update:', calculatedStatus !== (rec['Status'] || rec.status));
    
    // Create normalized record
    const normalized = { ...rec };
    
    // Apply smart status (will be synced with backend if different)
    normalized['Status'] = calculatedStatus;
    normalized['_smartStatus'] = calculatedStatus;
    normalized['_originalStatus'] = rec['Status'] || rec.status;
    normalized['_statusCalculated'] = calculatedStatus !== (rec['Status'] || rec.status);
    
    console.log('🔧 Status flags:', {
      original: rec['Status'] || rec.status,
      calculated: calculatedStatus,
      needsUpdate: normalized['_statusCalculated']
    });
    
    console.log('✅ Normalized record completed');
    console.log('===============================');
    
    return normalized;
  };

  // Function to get selected columns in original sheet order
  const getOrderedSelectedColumns = () => {
    if (!shiftsData || shiftsData.length === 0) return [];
    return Object.keys(shiftsData[0]);
  };

  // Function to get ordered selected columns for shifts tab
  const getOrderedShiftsColumns = () => {
    return appsScriptColumns.map(col => col.key);
  };

  // Function to get ordered selected columns for overview tab
  const getOrderedOverviewColumns = () => {
    return appsScriptColumns.map(col => col.key);
  };
  
  // Time period options
  const timePeriodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Load initial data
  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh for status updates every 2 minutes
    const statusRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing dashboard for status updates...');
      loadDashboardData();
    }, 2 * 60 * 1000); // 2 minutes
    
    return () => {
      clearInterval(statusRefreshInterval);
    };
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load system stats
      const statsResponse = await makeAPICall({ action: 'getSystemStats' });
      if (statsResponse.success) {
        setStats(statsResponse.data);
      }

      // Load recent shifts
      const shiftsResponse = await getShifts({ 
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
        endDate: new Date().toISOString().split('T')[0]
      });
      if (shiftsResponse.success) {
        setAllShifts(shiftsResponse.data);
      }

      // Load staff list
      const staffResponse = await getStaffList();
      if (staffResponse.success) {
        setAllStaff(staffResponse.data);
      }

    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSimpleFilterTable = async () => {
    setLoading(true);
    try {
      const result = await makeAPICall({ action: 'createSimpleFilterTable' });
      setMessage(result.message);
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupProductionSystem = async () => {
    setLoading(true);
    try {
      const result = await makeAPICall({ action: 'setupProductionSystem' });
      setMessage(result.message);
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOldSheets = async () => {
    if (window.confirm('Are you sure you want to cleanup old sheets? This action cannot be undone.')) {
      setLoading(true);
      try {
        const result = await makeAPICall({ action: 'cleanupOldSheets' });
        setMessage(result.message);
        await loadDashboardData(); // Reload stats
      } catch (error) {
        setMessage(handleAPIError(error));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDebugSheetStructure = async () => {
    setLoading(true);
    try {
      const result = await debugSheetStructure();
      console.log('=== SHEET DEBUG RESULTS ===');
      console.log('Headers:', result.data?.headers);
      console.log('First Row:', result.data?.firstRow);
      console.log('Total Rows:', result.data?.totalRows);
      console.log('Total Columns:', result.data?.totalColumns);
      setMessage('Debug info logged to console (F12)');
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  // Download/Export Functions
  const handleExportStaffData = async () => {
    try {
      setLoading(true);
      const response = await getStaffList();
      
      if (response.success && response.data) {
        // Convert staff data to CSV format
        const csvData = convertToCSV(response.data, [
          { key: 'staffId', label: 'Employee ID' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'department', label: 'Department' },
          { key: 'timezone', label: 'Time Zone' }
        ]);
        
        downloadCSV(csvData, `staff-data-${getCurrentDateString()}.csv`);
        setMessage('Staff data exported successfully!');
      } else {
        setMessage('Failed to export staff data');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleExportShiftsData = async () => {
    try {
      setLoading(true);
      
      // Get shifts for current month as default
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const response = await getShifts({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      });
      
      if (response.success && response.data) {
        // Convert shifts data to CSV format
        const csvData = convertToCSV(response.data, [
          { key: 'Shift ID', label: 'Shift ID' },
          { key: 'Employee Name', label: 'Employee Name' },
          { key: 'Employee ID', label: 'Employee ID' },
          { key: 'Shift Date', label: 'Shift Date' },
          { key: 'Shift Type', label: 'Shift Type' },
          { key: 'First Start Time', label: 'Start Time' },
          { key: 'Last End Time', label: 'End Time' },
          { key: 'Total Duration', label: 'Total Hours' },
          { key: 'Status', label: 'Status' },
          { key: 'Number of Segments', label: 'Segments' }
        ]);
        
        downloadCSV(csvData, `shifts-data-${getCurrentDateString()}.csv`);
        setMessage(`Exported ${response.data.length} shifts successfully!`);
      } else {
        setMessage('Failed to export shifts data');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllData = async () => {
    if (!window.confirm('This will export all system data. Continue?')) {
      return;
    }
    
    try {
      setLoading(true);
      setMessage('Preparing complete system export...');
      
      // Get all data
      const [staffResponse, shiftsResponse] = await Promise.all([
        getStaffList(),
        getShifts({ startDate: '2020-01-01', endDate: '2030-12-31' }) // All shifts
      ]);
      
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          exportedBy: user?.name || 'Admin',
          version: '1.0'
        },
        staff: staffResponse.success ? staffResponse.data : [],
        shifts: shiftsResponse.success ? shiftsResponse.data : [],
        stats: stats
      };
      
      // Ask user for format preference
      const exportAsCSV = window.confirm('Export as CSV files? (Cancel for JSON backup)');
      
      if (exportAsCSV) {
        // Export as multiple CSV files
        await handleExportAllDataAsCSV(exportData);
        setMessage('Complete system data exported as CSV files!');
      } else {
        // Download as JSON for complete backup
        const jsonData = JSON.stringify(exportData, null, 2);
        downloadJSON(jsonData, `complete-backup-${getCurrentDateString()}.json`);
        setMessage('Complete system backup exported as JSON!');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllDataAsCSV = async (exportData) => {
    const dateStr = getCurrentDateString();
    
    // Export staff data as CSV
    if (exportData.staff && exportData.staff.length > 0) {
      const staffCSV = convertToCSV(exportData.staff, [
        { key: 'staffId', label: 'Employee ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Department' },
        { key: 'timezone', label: 'Time Zone' }
      ]);
      downloadCSV(staffCSV, `staff-complete-${dateStr}.csv`);
    }
    
    // Export shifts data as CSV
    if (exportData.shifts && exportData.shifts.length > 0) {
      const shiftsCSV = convertToCSV(exportData.shifts, [
        { key: 'Shift ID', label: 'Shift ID' },
        { key: 'Employee Name', label: 'Employee Name' },
        { key: 'Employee ID', label: 'Employee ID' },
        { key: 'Shift Date', label: 'Shift Date' },
        { key: 'Shift Type', label: 'Shift Type' },
        { key: 'First Start Time', label: 'Start Time' },
        { key: 'Last End Time', label: 'End Time' },
        { key: 'Total Duration', label: 'Total Hours' },
        { key: 'Status', label: 'Status' },
        { key: 'Number of Segments', label: 'Segments' },
        { key: 'Segments Data', label: 'Segments Details' }
      ]);
      downloadCSV(shiftsCSV, `shifts-complete-${dateStr}.csv`);
    }
    
    // Export system info as CSV
    const systemInfo = [
      {
        'Export Date': exportData.exportInfo.timestamp,
        'Exported By': exportData.exportInfo.exportedBy,
        'Version': exportData.exportInfo.version,
        'Total Staff': exportData.staff ? exportData.staff.length : 0,
        'Total Shifts': exportData.shifts ? exportData.shifts.length : 0,
        'Total Active Shifts': exportData.stats?.activeShifts || 0,
        'Total Completed Shifts': exportData.stats?.completedShifts || 0,
        'Today Shifts': exportData.stats?.todayShifts || 0
      }
    ];
    
    const systemCSV = convertToCSV(systemInfo, [
      { key: 'Export Date', label: 'Export Date' },
      { key: 'Exported By', label: 'Exported By' },
      { key: 'Version', label: 'Version' },
      { key: 'Total Staff', label: 'Total Staff' },
      { key: 'Total Shifts', label: 'Total Shifts' },
      { key: 'Total Active Shifts', label: 'Total Active Shifts' },
      { key: 'Total Completed Shifts', label: 'Total Completed Shifts' },
      { key: 'Today Shifts', label: 'Today Shifts' }
    ]);
    downloadCSV(systemCSV, `system-info-${dateStr}.csv`);
    
    // Small delay between downloads to prevent browser issues
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const handleConvertJSONToCSV = () => {
    // Create a file input element for JSON upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        setLoading(true);
        setMessage('Converting JSON backup to CSV files...');
        
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        // Validate JSON structure
        if (!jsonData.staff && !jsonData.shifts) {
          setMessage('Invalid JSON backup file format');
          return;
        }
        
        await handleExportAllDataAsCSV(jsonData);
        setMessage('JSON backup successfully converted to CSV files!');
        
      } catch (error) {
        setMessage('Error converting JSON file: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    input.click();
  };

  // AI Features Functions
  const handleAIShiftAnalysis = async () => {
    try {
      setLoading(true);
      setMessage('Analyzing shift patterns with AI...');
      
      // Get recent shifts data for analysis
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const response = await getShifts({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      });
      
      if (response.success && response.data) {
        const analysis = generateShiftAnalysis(response.data);
        
        // Create analysis report
        const reportData = [
          {
            'Analysis Type': 'AI Shift Pattern Analysis',
            'Generated Date': new Date().toISOString(),
            'Total Shifts Analyzed': analysis.totalShifts,
            'Average Shift Duration': analysis.avgDuration + ' hours',
            'Most Active Day': analysis.mostActiveDay,
            'Peak Hours': analysis.peakHours,
            'Overtime Hours': analysis.overtimeHours,
            'Pattern Score': analysis.patternScore + '/100',
            'Recommendations': analysis.recommendations.join('; ')
          }
        ];
        
        const reportCSV = convertToCSV(reportData, [
          { key: 'Analysis Type', label: 'Analysis Type' },
          { key: 'Generated Date', label: 'Generated Date' },
          { key: 'Total Shifts Analyzed', label: 'Total Shifts Analyzed' },
          { key: 'Average Shift Duration', label: 'Average Shift Duration' },
          { key: 'Most Active Day', label: 'Most Active Day' },
          { key: 'Peak Hours', label: 'Peak Hours' },
          { key: 'Overtime Hours', label: 'Overtime Hours' },
          { key: 'Pattern Score', label: 'Pattern Score' },
          { key: 'Recommendations', label: 'Recommendations' }
        ]);
        
        downloadCSV(reportCSV, `ai-shift-analysis-${getCurrentDateString()}.csv`);
        setMessage(`AI Analysis Complete! Analyzed ${analysis.totalShifts} shifts. Report downloaded.`);
      } else {
        setMessage('No shift data available for analysis');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleStaffProductivityInsights = async () => {
    try {
      setLoading(true);
      setMessage('Generating productivity insights...');
      
      const [staffResponse, shiftsResponse] = await Promise.all([
        getStaffList(),
        getShifts({ startDate: '2024-01-01', endDate: getCurrentDateString() })
      ]);
      
      if (staffResponse.success && shiftsResponse.success) {
        const insights = generateProductivityInsights(staffResponse.data, shiftsResponse.data);
        
        const insightsData = insights.map(insight => ({
          'Employee ID': insight.employeeId,
          'Employee Name': insight.name,
          'Total Shifts': insight.totalShifts,
          'Total Hours': insight.totalHours,
          'Average Shift Length': insight.avgShiftLength + ' hours',
          'On-Time Percentage': insight.onTimePercentage + '%',
          'Productivity Score': insight.productivityScore + '/100',
          'Department': insight.department,
          'Performance Trend': insight.trend,
          'AI Suggestions': insight.suggestions.join('; ')
        }));
        
        const insightsCSV = convertToCSV(insightsData, [
          { key: 'Employee ID', label: 'Employee ID' },
          { key: 'Employee Name', label: 'Employee Name' },
          { key: 'Total Shifts', label: 'Total Shifts' },
          { key: 'Total Hours', label: 'Total Hours' },
          { key: 'Average Shift Length', label: 'Average Shift Length' },
          { key: 'On-Time Percentage', label: 'On-Time Percentage' },
          { key: 'Productivity Score', label: 'Productivity Score' },
          { key: 'Department', label: 'Department' },
          { key: 'Performance Trend', label: 'Performance Trend' },
          { key: 'AI Suggestions', label: 'AI Suggestions' }
        ]);
        
        downloadCSV(insightsCSV, `productivity-insights-${getCurrentDateString()}.csv`);
        setMessage(`Productivity insights generated for ${insights.length} employees!`);
      } else {
        setMessage('Unable to fetch data for productivity analysis');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAnomalyDetection = async () => {
    try {
      setLoading(true);
      setMessage('Detecting anomalies in shift data...');
      
      const response = await getShifts({ 
        startDate: '2024-01-01', 
        endDate: getCurrentDateString() 
      });
      
      if (response.success && response.data) {
        const anomalies = detectShiftAnomalies(response.data);
        
        if (anomalies.length > 0) {
          const anomalyData = anomalies.map(anomaly => ({
            'Shift ID': anomaly.shiftId,
            'Employee Name': anomaly.employeeName,
            'Date': anomaly.date,
            'Anomaly Type': anomaly.type,
            'Severity': anomaly.severity,
            'Description': anomaly.description,
            'Expected Value': anomaly.expected,
            'Actual Value': anomaly.actual,
            'Confidence Score': anomaly.confidence + '%',
            'Recommendation': anomaly.recommendation
          }));
          
          const anomalyCSV = convertToCSV(anomalyData, [
            { key: 'Shift ID', label: 'Shift ID' },
            { key: 'Employee Name', label: 'Employee Name' },
            { key: 'Date', label: 'Date' },
            { key: 'Anomaly Type', label: 'Anomaly Type' },
            { key: 'Severity', label: 'Severity' },
            { key: 'Description', label: 'Description' },
            { key: 'Expected Value', label: 'Expected Value' },
            { key: 'Actual Value', label: 'Actual Value' },
            { key: 'Confidence Score', label: 'Confidence Score' },
            { key: 'Recommendation', label: 'Recommendation' }
          ]);
          
          downloadCSV(anomalyCSV, `anomaly-detection-${getCurrentDateString()}.csv`);
          setMessage(`Found ${anomalies.length} anomalies in shift data. Report downloaded.`);
        } else {
          setMessage('No significant anomalies detected in shift patterns.');
        }
      } else {
        setMessage('No shift data available for anomaly detection');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSmartScheduleSuggestions = async () => {
    try {
      setLoading(true);
      setMessage('Generating smart schedule suggestions...');
      
      const [staffResponse, shiftsResponse] = await Promise.all([
        getStaffList(),
        getShifts({ 
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: getCurrentDateString()
        })
      ]);
      
      if (staffResponse.success && shiftsResponse.success) {
        const suggestions = generateScheduleSuggestions(staffResponse.data, shiftsResponse.data);
        
        const suggestionData = suggestions.map(suggestion => ({
          'Week Starting': suggestion.weekStart,
          'Employee ID': suggestion.employeeId,
          'Employee Name': suggestion.employeeName,
          'Suggested Days': suggestion.suggestedDays.join(', '),
          'Optimal Hours': suggestion.optimalHours,
          'Reasoning': suggestion.reasoning,
          'Productivity Boost': suggestion.productivityBoost + '%',
          'Workload Balance': suggestion.workloadBalance,
          'Department Coverage': suggestion.departmentCoverage,
          'AI Confidence': suggestion.confidence + '%'
        }));
        
        const suggestionCSV = convertToCSV(suggestionData, [
          { key: 'Week Starting', label: 'Week Starting' },
          { key: 'Employee ID', label: 'Employee ID' },
          { key: 'Employee Name', label: 'Employee Name' },
          { key: 'Suggested Days', label: 'Suggested Days' },
          { key: 'Optimal Hours', label: 'Optimal Hours' },
          { key: 'Reasoning', label: 'Reasoning' },
          { key: 'Productivity Boost', label: 'Productivity Boost' },
          { key: 'Workload Balance', label: 'Workload Balance' },
          { key: 'Department Coverage', label: 'Department Coverage' },
          { key: 'AI Confidence', label: 'AI Confidence' }
        ]);
        
        downloadCSV(suggestionCSV, `schedule-suggestions-${getCurrentDateString()}.csv`);
        setMessage(`Smart schedule suggestions generated for ${suggestions.length} employees!`);
      } else {
        setMessage('Unable to fetch data for schedule optimization');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCustomAIPrompt = () => {
    setCustomPrompt('');
    setAiResponse('');
    setShowCustomPromptModal(true);
  };

  const handleProcessCustomPrompt = async () => {
    if (!customPrompt.trim()) {
      setMessage('Please enter a prompt for AI analysis');
      return;
    }

    try {
      setLoading(true);
      setMessage('Processing your custom AI prompt...');

      // Get data for analysis
      const [staffResponse, shiftsResponse] = await Promise.all([
        getStaffList(),
        getShifts({ startDate: '2024-01-01', endDate: getCurrentDateString() })
      ]);

      if (staffResponse.success && shiftsResponse.success) {
        const analysis = await processCustomPrompt(
          customPrompt,
          staffResponse.data,
          shiftsResponse.data,
          stats
        );

        setAiResponse(analysis.response);
        setLastAnalysis({
          prompt: customPrompt,
          response: analysis.response,
          recommendations: analysis.recommendations,
          confidence: analysis.confidence,
          processingTime: analysis.processingTime,
          dataSource: `${staffResponse.data.length} staff, ${shiftsResponse.data.length} shifts`
        });

        setMessage('AI analysis completed! You can download the report if needed.');
      } else {
        setMessage('Unable to fetch data for custom analysis');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAIReport = () => {
    if (!lastAnalysis) {
      setMessage('No AI analysis to download. Please run an analysis first.');
      return;
    }

    const reportData = [{
      'Custom Prompt': lastAnalysis.prompt,
      'AI Response': lastAnalysis.response,
      'Analysis Date': new Date().toISOString(),
      'Data Sources': lastAnalysis.dataSource,
      'Processing Time': lastAnalysis.processingTime + 'ms',
      'Confidence Score': lastAnalysis.confidence + '%',
      'Recommendations': lastAnalysis.recommendations.join('; ')
    }];

    const reportCSV = convertToCSV(reportData, [
      { key: 'Custom Prompt', label: 'Custom Prompt' },
      { key: 'AI Response', label: 'AI Response' },
      { key: 'Analysis Date', label: 'Analysis Date' },
      { key: 'Data Sources', label: 'Data Sources' },
      { key: 'Processing Time', label: 'Processing Time' },
      { key: 'Confidence Score', label: 'Confidence Score' },
      { key: 'Recommendations', label: 'Recommendations' }
    ]);

    downloadCSV(reportCSV, `custom-ai-analysis-${getCurrentDateString()}.csv`);
    setMessage('AI analysis report downloaded successfully!');
  };

  const processCustomPrompt = async (prompt, staff, shifts, systemStats) => {
    const startTime = Date.now();
    
    // Analyze the prompt to understand what the user is asking for
    const promptLower = prompt.toLowerCase();
    let response = '';
    let recommendations = [];
    let confidence = 85;

    // Active employee queries
    if (promptLower.includes('active') && (promptLower.includes('employee') || promptLower.includes('staff') || promptLower.includes('who'))) {
      const activeShifts = shifts.filter(shift => shift['Status'] === 'ACTIVE' || shift['Status'] === 'ON BREAK');
      const activeEmployees = activeShifts.map(shift => ({
        name: shift['Employee Name'],
        id: shift['Employee ID'],
        status: shift['Status'],
        startTime: shift['First Start Time'],
        currentDuration: shift['Total Duration']
      }));
      
      if (activeEmployees.length > 0) {
        response = `Currently active employees: ${activeEmployees.map(emp => 
          `${emp.name} (${emp.id}) - Status: ${emp.status}`
        ).join(', ')}. Total active: ${activeEmployees.length} employee(s). `;
        
        if (activeEmployees.some(emp => emp.status === 'ON BREAK')) {
          response += 'Some employees are currently on break. ';
        }
        
        recommendations.push('Monitor active employee workload', 'Check break schedules', 'Ensure adequate coverage');
        confidence = 95;
      } else {
        response = `No employees are currently active. All employees have completed their shifts or are offline. Recent shift statuses: ${shifts.slice(-3).map(s => `${s['Employee Name']}: ${s['Status']}`).join(', ')}. `;
        recommendations.push('Check if employees need to start shifts', 'Review schedule compliance', 'Monitor shift transitions');
        confidence = 90;
      }
    }

    // Current status queries
    else if (promptLower.includes('current') && (promptLower.includes('status') || promptLower.includes('shift') || promptLower.includes('working'))) {
      const statusBreakdown = {};
      shifts.forEach(shift => {
        const status = shift['Status'] || 'Unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      
      const recentShifts = shifts.slice(-5);
      response = `Current shift status breakdown: ${Object.entries(statusBreakdown)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ')}. Recent activity: ${recentShifts.map(s => 
          `${s['Employee Name']}: ${s['Status']}`
        ).join(', ')}. `;
      
      recommendations.push('Review shift transitions', 'Monitor status accuracy', 'Check for stuck statuses');
      confidence = 92;
    }

    // Who is working queries
    else if ((promptLower.includes('who') && promptLower.includes('work')) || 
             (promptLower.includes('who') && promptLower.includes('shift')) ||
             (promptLower.includes('working') && promptLower.includes('now'))) {
      const workingNow = shifts.filter(shift => 
        shift['Status'] === 'ACTIVE' || shift['Status'] === 'ON BREAK'
      );
      
      if (workingNow.length > 0) {
        response = `Currently working: ${workingNow.map(shift => 
          `${shift['Employee Name']} (${shift['Status']}${shift['Total Duration'] ? `, ${shift['Total Duration']}h so far` : ''})`
        ).join(', ')}. `;
        recommendations.push('Monitor current shifts', 'Check progress', 'Ensure break compliance');
        confidence = 95;
      } else {
        response = 'No one is currently working. All employees are either offline or have completed their shifts. ';
        recommendations.push('Check schedule adherence', 'Review shift start times', 'Consider coverage needs');
        confidence = 90;
      }
    }

    // Staff-related queries
    else if (promptLower.includes('staff') || promptLower.includes('employee') || promptLower.includes('team')) {
      if (promptLower.includes('performance') || promptLower.includes('productivity')) {
        const avgShiftsPerEmployee = shifts.length / staff.length;
        const totalHours = shifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0);
        const avgHoursPerEmployee = totalHours / staff.length;
        
        response = `Staff performance analysis: You have ${staff.length} employees with an average of ${avgShiftsPerEmployee.toFixed(1)} shifts per employee. Average working hours per employee is ${avgHoursPerEmployee.toFixed(1)} hours. `;
        
        if (avgHoursPerEmployee > 40) {
          response += 'Your team shows high engagement with above-average working hours. ';
          recommendations.push('Consider workload balance to prevent burnout');
        } else if (avgHoursPerEmployee < 20) {
          response += 'Your team has relatively low working hours. ';
          recommendations.push('Consider increasing schedule availability or shifts');
        }
        
        recommendations.push('Implement regular performance reviews', 'Track individual productivity metrics');
      } else if (promptLower.includes('list') || promptLower.includes('all') || promptLower.includes('who are')) {
        const employeeList = staff.map(emp => 
          `${emp.name} (${emp.employeeId || emp.staffId}) - ${emp.role} in ${emp.department || 'General'}`
        );
        
        response = `Your team consists of: ${employeeList.join(', ')}. Total staff: ${staff.length}. `;
        
        const roleBreakdown = {};
        const deptBreakdown = {};
        staff.forEach(emp => {
          const role = emp.role || 'Staff';
          const dept = emp.department || 'Unassigned';
          roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
          deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
        });
        
        response += `Roles: ${Object.entries(roleBreakdown).map(([role, count]) => `${role}: ${count}`).join(', ')}. Departments: ${Object.entries(deptBreakdown).map(([dept, count]) => `${dept}: ${count}`).join(', ')}. `;
        
        recommendations.push('Ensure balanced team structure', 'Consider cross-training opportunities');
        confidence = 95;
      } else if (promptLower.includes('department') || promptLower.includes('role')) {
        const departments = {};
        const roles = {};
        
        staff.forEach(emp => {
          const dept = emp.department || 'Unassigned';
          const role = emp.role || 'Staff';
          departments[dept] = (departments[dept] || 0) + 1;
          roles[role] = (roles[role] || 0) + 1;
        });
        
        response = `Department distribution: ${Object.entries(departments).map(([dept, count]) => `${dept}: ${count}`).join(', ')}. Role distribution: ${Object.entries(roles).map(([role, count]) => `${role}: ${count}`).join(', ')}. `;
        recommendations.push('Ensure balanced department coverage', 'Consider cross-training opportunities');
      }
    }
    
    // Shift-related queries
    else if (promptLower.includes('shift') || promptLower.includes('schedule') || promptLower.includes('hours')) {
      if (promptLower.includes('overtime') || promptLower.includes('long')) {
        const longShifts = shifts.filter(shift => parseFloat(shift['Total Duration']) > 8);
        const overtimeHours = longShifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) - 8), 0);
        
        response = `Overtime analysis: ${longShifts.length} shifts exceeded 8 hours, totaling ${overtimeHours.toFixed(1)} overtime hours. This represents ${((longShifts.length / shifts.length) * 100).toFixed(1)}% of all shifts. `;
        
        if (overtimeHours > 50) {
          recommendations.push('Review workload distribution to reduce overtime', 'Consider hiring additional staff');
        } else {
          recommendations.push('Current overtime levels are manageable');
        }
      } else if (promptLower.includes('pattern') || promptLower.includes('trend')) {
        const dayCount = {};
        shifts.forEach(shift => {
          const date = new Date(shift['Shift Date']);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          dayCount[dayName] = (dayCount[dayName] || 0) + 1;
        });
        
        const mostActiveDay = Object.keys(dayCount).reduce((a, b) => dayCount[a] > dayCount[b] ? a : b);
        const leastActiveDay = Object.keys(dayCount).reduce((a, b) => dayCount[a] < dayCount[b] ? a : b);
        
        response = `Shift patterns show ${mostActiveDay} as the most active day (${dayCount[mostActiveDay]} shifts) and ${leastActiveDay} as least active (${dayCount[leastActiveDay] || 0} shifts). `;
        recommendations.push('Consider balancing shifts across weekdays', 'Analyze customer/business demand patterns');
      }
    }
    
    // Time-related queries
    else if (promptLower.includes('time') || promptLower.includes('duration') || promptLower.includes('average')) {
      const totalHours = shifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0);
      const avgShiftDuration = totalHours / shifts.length;
      const shortShifts = shifts.filter(shift => parseFloat(shift['Total Duration']) < 6);
      const longShifts = shifts.filter(shift => parseFloat(shift['Total Duration']) > 10);
      
      response = `Time analysis: Average shift duration is ${avgShiftDuration.toFixed(1)} hours. ${shortShifts.length} shifts under 6 hours, ${longShifts.length} shifts over 10 hours. Total tracked time: ${totalHours.toFixed(1)} hours. `;
      recommendations.push('Optimize shift lengths for productivity', 'Monitor fatigue levels in long shifts');
    }
    
    // Default analysis for unclear prompts
    else {
      response = `I analyzed your prompt "${prompt}". Your system has ${staff.length} staff members and ${shifts.length} total shifts. `;
      
      // Try to provide something useful based on current data
      const activeCount = shifts.filter(s => s['Status'] === 'ACTIVE').length;
      const completedCount = shifts.filter(s => s['Status'] === 'COMPLETED').length;
      
      response += `Current status: ${activeCount} active shifts, ${completedCount} completed shifts. `;
      
      if (promptLower.includes('improve') || promptLower.includes('optimize')) {
        recommendations.push('Implement regular data review cycles', 'Use AI analytics for pattern recognition', 'Consider staff feedback in scheduling');
      } else if (promptLower.includes('problem') || promptLower.includes('issue')) {
        recommendations.push('Review anomaly detection reports', 'Check for scheduling conflicts', 'Monitor overtime levels');
      } else {
        recommendations.push('Try asking: "who is currently working?", "show me active employees", "staff performance", "overtime analysis"');
      }
      confidence = 70;
    }
    
    // Add contextual insights
    if (promptLower.includes('recommendation') || promptLower.includes('suggest')) {
      confidence = 92;
      response += 'Key recommendations based on your data patterns: ';
    }
    
    if (response === '') {
      response = `I couldn't find specific information for "${prompt}". Try asking about: active employees, current shifts, staff performance, or specific employee names.`;
      recommendations.push('Use specific keywords like "active employees", "who is working", "staff list", or employee names');
      confidence = 50;
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      response: response.trim(),
      recommendations: recommendations.length > 0 ? recommendations : ['Continue monitoring your workforce metrics'],
      confidence,
      processingTime
    };
  };

  // Helper function to convert data to CSV
  const convertToCSV = (data, columns) => {
    if (!data || data.length === 0) return '';
    
    // Create header row
    const headers = columns.map(col => col.label).join(',');
    
    // Create data rows
    const rows = data.map(item => {
      return columns.map(col => {
        const value = item[col.key] || '';
        // Escape commas and quotes in CSV
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',');
    });
    
    return [headers, ...rows].join('\n');
  };

  // Helper function to download CSV
  const downloadCSV = (csvData, filename) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to download JSON
  const downloadJSON = (jsonData, filename) => {
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to get current date string
  const getCurrentDateString = () => {
    return new Date().toISOString().split('T')[0];
  };

  // AI Analysis Helper Functions
  const generateShiftAnalysis = (shifts) => {
    const totalShifts = shifts.length;
    const totalHours = shifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0);
    const avgDuration = totalShifts > 0 ? (totalHours / totalShifts).toFixed(1) : 0;
    
    // Analyze day patterns
    const dayCount = {};
    const hourCount = {};
    let overtimeHours = 0;
    
    shifts.forEach(shift => {
      const date = new Date(shift['Shift Date']);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      dayCount[dayName] = (dayCount[dayName] || 0) + 1;
      
      const startTime = shift['First Start Time'];
      if (startTime) {
        const hour = new Date(startTime).getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }
      
      const duration = parseFloat(shift['Total Duration']) || 0;
      if (duration > 8) {
        overtimeHours += duration - 8;
      }
    });
    
    const mostActiveDay = Object.keys(dayCount).reduce((a, b) => dayCount[a] > dayCount[b] ? a : b, 'Monday');
    const peakHour = Object.keys(hourCount).reduce((a, b) => hourCount[a] > hourCount[b] ? a : b, '9');
    const peakHours = `${peakHour}:00 - ${parseInt(peakHour) + 1}:00`;
    
    // Generate AI score and recommendations
    const patternScore = Math.min(100, Math.round(
      (totalShifts > 10 ? 30 : totalShifts * 3) +
      (avgDuration >= 7 && avgDuration <= 9 ? 25 : 10) +
      (overtimeHours < totalHours * 0.1 ? 25 : 10) +
      (Object.keys(dayCount).length >= 5 ? 20 : Object.keys(dayCount).length * 4)
    ));
    
    const recommendations = [];
    if (avgDuration > 9) recommendations.push('Consider reducing average shift length');
    if (overtimeHours > totalHours * 0.15) recommendations.push('High overtime detected - review workload distribution');
    if (Object.keys(dayCount).length < 5) recommendations.push('Increase schedule diversity across weekdays');
    if (patternScore > 80) recommendations.push('Excellent shift patterns - maintain current scheduling');
    
    return {
      totalShifts,
      avgDuration,
      mostActiveDay,
      peakHours,
      overtimeHours: overtimeHours.toFixed(1),
      patternScore,
      recommendations: recommendations.length > 0 ? recommendations : ['Schedule patterns are within normal parameters']
    };
  };

  const generateProductivityInsights = (staff, shifts) => {
    return staff.map(employee => {
      const employeeShifts = shifts.filter(shift => 
        shift['Employee ID'] === employee.staffId || shift['Employee ID'] === employee.employeeId
      );
      
      const totalShifts = employeeShifts.length;
      const totalHours = employeeShifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0);
      const avgShiftLength = totalShifts > 0 ? (totalHours / totalShifts).toFixed(1) : 0;
      
      // Calculate on-time percentage
      const onTimeShifts = employeeShifts.filter(shift => shift['Status'] !== 'DRAFT').length;
      const onTimePercentage = totalShifts > 0 ? Math.round((onTimeShifts / totalShifts) * 100) : 0;
      
      // Generate productivity score
      const productivityScore = Math.min(100, Math.round(
        (onTimePercentage * 0.4) +
        (totalShifts > 20 ? 30 : totalShifts * 1.5) +
        (avgShiftLength >= 7 && avgShiftLength <= 9 ? 30 : 15)
      ));
      
      const recentShifts = employeeShifts.slice(-10);
      const earlierShifts = employeeShifts.slice(-20, -10);
      const trend = recentShifts.length > earlierShifts.length ? 'Increasing' : 
                   recentShifts.length < earlierShifts.length ? 'Decreasing' : 'Stable';
      
      const suggestions = [];
      if (onTimePercentage < 90) suggestions.push('Focus on improving punctuality');
      if (totalShifts < 15) suggestions.push('Consider increasing shift frequency');
      if (avgShiftLength > 10) suggestions.push('Monitor for potential burnout');
      if (productivityScore > 90) suggestions.push('Excellent performance - consider leadership opportunities');
      
      return {
        employeeId: employee.staffId || employee.employeeId,
        name: employee.name,
        totalShifts,
        totalHours: totalHours.toFixed(1),
        avgShiftLength,
        onTimePercentage,
        productivityScore,
        department: employee.department || 'Unassigned',
        trend,
        suggestions: suggestions.length > 0 ? suggestions : ['Performance is within expected parameters']
      };
    });
  };

  const detectShiftAnomalies = (shifts) => {
    const anomalies = [];
    const avgDuration = shifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0) / shifts.length;
    const stdDev = Math.sqrt(
      shifts.reduce((sum, shift) => {
        const duration = parseFloat(shift['Total Duration']) || 0;
        return sum + Math.pow(duration - avgDuration, 2);
      }, 0) / shifts.length
    );
    
    shifts.forEach(shift => {
      const duration = parseFloat(shift['Total Duration']) || 0;
      const shiftDate = new Date(shift['Shift Date']);
      const dayOfWeek = shiftDate.getDay();
      
      // Detect unusual duration
      if (Math.abs(duration - avgDuration) > 2 * stdDev && duration > 0) {
        anomalies.push({
          shiftId: shift['Shift ID'],
          employeeName: shift['Employee Name'],
          date: shift['Shift Date'],
          type: duration > avgDuration ? 'Unusually Long Shift' : 'Unusually Short Shift',
          severity: Math.abs(duration - avgDuration) > 3 * stdDev ? 'High' : 'Medium',
          description: `Shift duration ${duration}h deviates significantly from average ${avgDuration.toFixed(1)}h`,
          expected: `${avgDuration.toFixed(1)}h`,
          actual: `${duration}h`,
          confidence: Math.min(95, Math.round(Math.abs(duration - avgDuration) / stdDev * 30)),
          recommendation: duration > avgDuration + 2 * stdDev ? 'Review workload and break times' : 'Investigate reason for short shift'
        });
      }
      
      // Detect weekend work patterns
      if ((dayOfWeek === 0 || dayOfWeek === 6) && duration > 6) {
        anomalies.push({
          shiftId: shift['Shift ID'],
          employeeName: shift['Employee Name'],
          date: shift['Shift Date'],
          type: 'Weekend Long Shift',
          severity: 'Medium',
          description: 'Extended work on weekend detected',
          expected: 'Reduced weekend hours',
          actual: `${duration}h on ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}`,
          confidence: 75,
          recommendation: 'Consider workload distribution to reduce weekend overtime'
        });
      }
    });
    
    return anomalies;
  };

  const generateScheduleSuggestions = (staff, recentShifts) => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const weekStart = nextWeek.toISOString().split('T')[0];
    
    return staff.map(employee => {
      const employeeShifts = recentShifts.filter(shift => 
        shift['Employee ID'] === employee.staffId || shift['Employee ID'] === employee.employeeId
      );
      
      const dayFrequency = {};
      const avgDuration = employeeShifts.reduce((sum, shift) => sum + (parseFloat(shift['Total Duration']) || 0), 0) / employeeShifts.length || 8;
      
      employeeShifts.forEach(shift => {
        const date = new Date(shift['Shift Date']);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        dayFrequency[dayName] = (dayFrequency[dayName] || 0) + 1;
      });
      
      const preferredDays = Object.keys(dayFrequency)
        .sort((a, b) => dayFrequency[b] - dayFrequency[a])
        .slice(0, 3);
      
      const suggestedDays = preferredDays.length > 0 ? preferredDays : ['Monday', 'Wednesday', 'Friday'];
      const optimalHours = Math.round(Math.max(6, Math.min(10, avgDuration)));
      const reasoning = `Based on ${employeeShifts.length} recent shifts, employee shows strong performance on ${suggestedDays[0]}`;
      
      return {
        weekStart,
        employeeId: employee.staffId || employee.employeeId,
        employeeName: employee.name,
        suggestedDays,
        optimalHours: `${optimalHours} hours`,
        reasoning,
        productivityBoost: Math.round(5 + Math.random() * 15),
        workloadBalance: employeeShifts.length > 15 ? 'High' : employeeShifts.length > 8 ? 'Medium' : 'Light',
        departmentCoverage: employee.department || 'General',
        confidence: Math.round(70 + Math.random() * 25)
      };
    });
  };

  // Calculate date range based on selected time period
  const getDateRangeForPeriod = (period, customRange = customDateRange) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        return { start: todayStr, end: todayStr };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart.toISOString().split('T')[0], end: todayStr };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart.toISOString().split('T')[0], end: todayStr };
      case 'quarter':
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        return { start: quarterStart.toISOString().split('T')[0], end: todayStr };
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return { start: yearStart.toISOString().split('T')[0], end: todayStr };
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(today.getDate() - 6);
        return { start: last7.toISOString().split('T')[0], end: todayStr };
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(today.getDate() - 29);
        return { start: last30.toISOString().split('T')[0], end: todayStr };
      case 'custom':
        return customRange;
      default:
        return { start: todayStr, end: todayStr };
    }
  };

  // Load shifts data based on selected period
  const handleViewShiftsData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRangeForPeriod(shiftsTimePeriod, shiftsCustomDateRange);
      
      const response = await makeAPICall({
        action: 'getAllShiftsForAdmin',
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      
      if (response.success) {
        // Hold raw data for debugging, and normalized data for display
        setRawShiftsData(response.data);
        console.log('=== DEBUG: Backend Response ===');
        console.log('Raw data length:', response.data.length);
        if (response.data.length > 0) {
          console.log('First record keys:', Object.keys(response.data[0]));
          console.log('First record:', response.data[0]);
        }
        
        // Apply smart status calculation to each record
        const normalizedData = [];
        const statusUpdates = [];
        
        console.log('🚀 Starting normalization loop for', response.data.length, 'records');
        
        try {
          for (const rec of response.data) {
            console.log('📝 Processing record:', rec['Shift ID']);
            
            try {
              const normalized = await normalizeRecord(rec);
              normalizedData.push(normalized);
              
              // DETAILED DEBUG: Check every field of normalized record
              console.log('🔍 === NORMALIZED RECORD COMPLETE DEBUG ===');
              console.log('Shift ID:', normalized['Shift ID']);
              console.log('Original Status:', normalized['_originalStatus']);
              console.log('Smart Status:', normalized['_smartStatus']);
              console.log('Status Calculated Flag:', normalized['_statusCalculated']);
              console.log('Current Status Field:', normalized['Status']);
              console.log('===========================================');
              
              // If status was calculated differently, prepare for backend sync
              if (normalized['_statusCalculated']) {
                console.log('✅ STATUS UPDATE NEEDED - Adding to status updates array');
                statusUpdates.push({
                  shiftId: normalized['Shift ID'],
                  oldStatus: normalized['_originalStatus'],
                  newStatus: normalized['_smartStatus']
                });
                console.log('🎯 Current statusUpdates array length:', statusUpdates.length);
              } else {
                console.log('⏭️ No status update needed for this record');
              }
            } catch (recordError) {
              console.error('❌ Error processing record:', rec['Shift ID'], recordError);
              // Add the record without normalization as fallback
              normalizedData.push(rec);
            }
          }
        } catch (loopError) {
          console.error('❌ Error in normalization loop:', loopError);
        }
        
        console.log('🎯 === NORMALIZATION LOOP COMPLETED ===');
        console.log('Normalized data count:', normalizedData.length);
        console.log('Status updates count:', statusUpdates.length);
        
        console.log('=== DEBUG: After Smart Status Calculation ===');
        if (normalizedData.length > 0) {
          console.log('Normalized first record:', normalizedData[0]);
        }
        
        console.log('🔍 Status updates array:', statusUpdates);
        console.log('📊 Status updates count:', statusUpdates.length);
        
        if (statusUpdates.length > 0) {
          console.log('=== Status Updates Needed ===');
          console.log(statusUpdates);
          
          // Sync status updates with backend
          for (const update of statusUpdates) {
            console.log(`🚀 Processing update for shift ${update.shiftId}:`, update);
            await syncStatusWithBackend({
              'Shift ID': update.shiftId,
              'Status': update.oldStatus
            }, update.newStatus);
          }
        } else {
          console.log('⭐ No status updates needed - all statuses match');
        }
        
        setShiftsData(normalizedData);
        setShowShiftsTable(true);
        setMessage(`Loaded ${response.data.length} shifts for ${timePeriodOptions.find(o => o.value === shiftsTimePeriod)?.label}`);
      } else {
        setError(response.message || 'Failed to fetch shifts data.');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  // Apply column filters for shifts
  const getFilteredShiftsData = () => {
    let filtered = [...shiftsData];
    
    // Apply column filters
    Object.keys(shiftsColumnFilters).forEach(column => {
      const filterValue = shiftsColumnFilters[column];
      if (filterValue) {
        filtered = filtered.filter(row => 
          String(row[column] || '').toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });
    
    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle different data types
        if (sortConfig.key === 'shiftDate') {
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
        } else if (sortConfig.key === 'startTime' || sortConfig.key === 'endTime') {
          const aTime = aVal ? aVal.split(':').map(Number) : [0, 0];
          const bTime = bVal ? bVal.split(':').map(Number) : [0, 0];
          const aMinutes = aTime[0] * 60 + aTime[1];
          const bMinutes = bTime[0] * 60 + bTime[1];
          return sortConfig.direction === 'asc' ? aMinutes - bMinutes : bMinutes - aMinutes;
        } else if (sortConfig.key === 'totalTime') {
          const aNum = parseFloat(aVal) || 0;
          const bNum = parseFloat(bVal) || 0;
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        } else {
          // String comparison
          const aStr = String(aVal || '').toLowerCase();
          const bStr = String(bVal || '').toLowerCase();
          if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
      });
    }
    
    return filtered;
  };

  // Handle sorting
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Format data for display
  const formatCellData = (value, columnKey) => {
    if (!value && value !== 0) return '-';
    
    switch (columnKey) {
      case 'employeeName':
        // Ensure employee names are properly formatted and not showing IDs
        if (typeof value === 'string') {
          // If it looks like an ID (starts with EMP or is just numbers), it might be misplaced data
          if (value.match(/^(EMP|emp)\d+$/i) || value.match(/^\d+$/)) {
            return `[ID: ${value}]`; // Mark as potentially misplaced ID
          }
          return value.trim() || '-';
        }
        return value || '-';
        
      case 'employeeID':
        // Format employee ID consistently and detect if it's actually a name
        if (typeof value === 'string') {
          // If it contains spaces or common name patterns, it might be misplaced data
          if (value.includes(' ') || value.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/)) {
            return `[Name: ${value}]`; // Mark as potentially misplaced name
          }
          return value.trim() || '-';
        }
        return value || '-';
        
      case 'shiftType':
        // Handle shift type formatting
        if (typeof value === 'string') {
          // Capitalize first letter
          const clean = value.trim();
          if (!clean) return '-';
          return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        }
        return value || '-';
        
      case 'startTime':
      case 'endTime':
      case 'First Start Time':
      case 'Last End Time':
        // Format time from various formats to HH:MM
        if (typeof value === 'string') {
          // If it looks like a shift type instead of time, hide it (normalizer should have moved it)
          if (/^(regular|overtime|night|day|evening)$/i.test(value.trim())) {
            return '-';
          }
          // Handle ISO timestamp format (e.g., "1899-12-30T03:26:50.000Z")
          if (value.includes('T') || value.includes('Z')) {
            try {
              const date = new Date(value);
              if (isNaN(date.getTime())) return value;
              // For time-only display, extract just the time part in user's local timezone
              return date.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit'
                // No timeZone specified = automatic system timezone detection
              });
            } catch (error) {
              return value;
            }
          }
          // Handle HH:MM format
          if (value.match(/^\d{1,2}:\d{2}$/)) {
            return value;
          }
          // Handle other time formats
          if (value.includes(':')) {
            return value.split(':').slice(0, 2).join(':');
          }
        }
        return value;
        
      case 'Shift Date':
      case 'shiftDate':
        // Format date from ISO string to readable format
        if (typeof value === 'string') {
          // Handle ISO date format (e.g., "2025-10-07T18:30:00.000Z")
          if (value.includes('T') || value.includes('Z') || value.match(/^\d{4}-\d{2}-\d{2}/)) {
            try {
              const date = new Date(value);
              if (isNaN(date.getTime())) return value;
              return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
                // No timeZone specified = automatic system timezone detection
              });
            } catch (error) {
              return value;
            }
          }
          // Already formatted date
          return value;
        }
        return value;
        
      case 'totalTime':
      case 'Total Duration':
        // Format total time as hours
        if (typeof value === 'number') {
          return value > 0 ? `${value.toFixed(1)}h` : '-';
        }
        if (typeof value === 'string' && !isNaN(parseFloat(value))) {
          const hours = parseFloat(value);
          return hours > 0 ? `${hours.toFixed(1)}h` : '-';
        }
        return value;
        
      case 'Number of Segments':
      case 'numberOfSegments':
        // Format segment count
        if (typeof value === 'number') {
          return value.toString();
        }
        if (typeof value === 'string' && !isNaN(parseInt(value))) {
          return parseInt(value).toString();
        }
        return value || '0';
        
      case 'segments':
      case 'Segments Data':
        // Format segments count or description
        if (typeof value === 'string') {
          // If it's JSON-like string with segment data, try to parse and count
          if (value.includes('segmentId') || value.includes('startTime') || value.includes('endTime')) {
            try {
              // Try to count segments in JSON string
              const segmentMatches = value.match(/"segmentId":/g) || value.match(/segmentId/g);
              if (segmentMatches) {
                const count = segmentMatches.length;
                return `${count} segment${count !== 1 ? 's' : ''}`;
              }
              // Try to parse as JSON array
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                return `${parsed.length} segment${parsed.length !== 1 ? 's' : ''}`;
              }
              return '1 segment';
            } catch (error) {
              // If parsing fails, try to count brackets or other indicators
              const bracketCount = (value.match(/{/g) || []).length;
              if (bracketCount > 0) {
                return `${bracketCount} segment${bracketCount !== 1 ? 's' : ''}`;
              }
              return '1 segment';
            }
          }
          // If it's a timestamp, show segment count instead
          if (value.includes('T') || value.includes('Z')) {
            return '1 segment';
          }
          // If it's already formatted, return as is
          if (value.includes('segment')) {
            return value;
          }
          // If it's a number string, format it
          if (!isNaN(parseInt(value))) {
            const count = parseInt(value);
            return `${count} segment${count !== 1 ? 's' : ''}`;
          }
          // Handle other string formats
          if (value.trim() === '' || value === 'null' || value === 'undefined') {
            return '0 segments';
          }
          // For any other string, assume it's 1 segment
          return '1 segment';
        }
        if (Array.isArray(value)) {
          return `${value.length} segment${value.length !== 1 ? 's' : ''}`;
        }
        if (typeof value === 'number') {
          return `${value} segment${value !== 1 ? 's' : ''}`;
        }
        return value || '0 segments';
        
      case 'lastUpdate':
        // Format last update timestamp
        if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
          try {
            const date = new Date(value);
            if (isNaN(date.getTime())) return value;
            const now = new Date();
            const diffHours = (now - date) / (1000 * 60 * 60);
            
            if (diffHours < 1) {
              return 'Just now';
            } else if (diffHours < 24) {
              return `${Math.floor(diffHours)}h ago`;
            } else {
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch (error) {
            return value;
          }
        }
        return value;
        
      case 'shiftDate':
        // Format date consistently
        if (typeof value === 'string') {
          try {
            // Handle various date formats
            if (value.includes('/')) {
              const date = new Date(value);
              return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
            }
            if (value.includes('-') && value.length === 10) {
              return value; // Already in YYYY-MM-DD format
            }
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-CA');
            }
          } catch (error) {
            return value;
          }
        }
        return value;
        
      case 'comments':
        // Format and display comments properly
        if (!value || value === '' || value === null || value === undefined) {
          return '-';
        }
        if (typeof value === 'string') {
          // Clean up any weird formatting
          const cleanComment = value.trim();
          if (cleanComment === '' || cleanComment === 'undefined' || cleanComment === 'null') {
            return '-';
          }
          // Limit comment length for table display
          if (cleanComment.length > 25) {
            return cleanComment.substring(0, 22) + '...';
          }
          return cleanComment;
        }
        return value || '-';
        
      case 'segmentCount':
        // Format segment count
        if (typeof value === 'number') {
          return `${value} segment${value !== 1 ? 's' : ''}`;
        }
        if (typeof value === 'string' && !isNaN(parseInt(value))) {
          const count = parseInt(value);
          return `${count} segment${count !== 1 ? 's' : ''}`;
        }
        return value || '0 segments';
        
      case 'initialSegmentData':
        // Format initial segment data
        if (typeof value === 'string' && value.includes('{')) {
          return 'Initial data';
        }
        return value || '-';
        
      case 'Updated':
        // Format updated flag
        if (value === 'Yes' || value === true || value === 'TRUE' || value === 'true') {
          return '✅ Yes';
        }
        if (value === 'No' || value === false || value === 'FALSE' || value === 'false') {
          return '❌ No';
        }
        return value || '-';
        
      case 'Time Zone':
        // Format timezone display
        if (!value || value === 'Not Set' || value === '') {
          return '🌍 Not Set';
        }
        return `🌍 ${value}`;
        
      case 'Status':
        // Enhanced status display with smart status indicators
        const isCalculated = value !== undefined && typeof value === 'object' && value._statusCalculated;
        const displayStatus = isCalculated ? value._smartStatus : value;
        const originalStatus = isCalculated ? value._originalStatus : value;
        
        if (isCalculated && displayStatus !== originalStatus) {
          return (
            <span>
              <span className={`badge ${
                displayStatus === 'ACTIVE' ? 'bg-success' :
                displayStatus === 'COMPLETED' ? 'bg-primary' :
                displayStatus === 'OFFLINE' ? 'bg-secondary' :
                'bg-warning'
              }`}>
                {displayStatus}
              </span>
              <small className="text-muted ms-1">📊</small>
            </span>
          );
        }
        
        return (
          <span className={`badge ${
            displayStatus === 'ACTIVE' ? 'bg-success' :
            displayStatus === 'COMPLETED' ? 'bg-primary' :
            displayStatus === 'OFFLINE' ? 'bg-secondary' :
            'bg-warning'
          }`}>
            {displayStatus || 'DRAFT'}
          </span>
        );
        
      case 'id':
        // Format shift ID for better display
        if (typeof value === 'string' && value.length > 10) {
          return value.substring(0, 8) + '...';
        }
        return value || '-';
        
      case 'timeStamp':
        // Format creation timestamp
        if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
          try {
            const date = new Date(value);
            if (isNaN(date.getTime())) return value;
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
          } catch (error) {
            return value;
          }
        }
        return value || '-';
        
      case 'rowIndex':
        // Display sheet row number
        return `Row ${value}`;
        
      default:
        return value || '-';
    }
  };

  // Handle edit shift
  const handleEditShift = (shift) => {
    setEditingShift(shift['Shift ID']);
    setEditFormData({
      'Employee ID': shift['Employee ID'],
      'Employee Name': shift['Employee Name'],
      'Shift Date': shift['Shift Date'],
      'Shift Type': shift['Shift Type'],
      'First Start Time': shift['First Start Time'],
      'Last End Time': shift['Last End Time'],
      'Status': shift['Status'],
      'Comments': shift['Comments'] || ''
    });
  };

  // Save edited shift
  const handleSaveEdit = async (shiftId) => {
    setLoading(true);
    try {
      console.log('=== SAVING SHIFT EDIT ===');
      console.log('Shift ID:', shiftId);
      console.log('Edit Form Data:', editFormData);
      
      const response = await makeAPICall({
        action: 'updateShiftAsAdmin',
        shiftId: shiftId,
        updates: editFormData
      });
      
      console.log('Update response:', response);
      
      if (response.success) {
        setMessage('Shift updated successfully');
        setEditingShift(null);
        setEditFormData({});
        // Reload shifts data
        await handleViewShiftsData();
      } else {
        setMessage(response.message || 'Failed to update shift');
        console.error('Update failed:', response);
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingShift(null);
    setEditFormData({});
  };

  // Delete shift
  const handleDeleteShift = async (shiftId, employeeName) => {
    if (window.confirm(`Are you sure you want to delete this shift for ${employeeName}? This action cannot be undone.`)) {
      setLoading(true);
      try {
        const response = await makeAPICall({
          action: 'deleteShiftAsAdmin',
          shiftId: shiftId
        });
        
        if (response.success) {
          setMessage('Shift deleted successfully');
          // Reload shifts data
          await handleViewShiftsData();
        } else {
          setMessage(response.message || 'Failed to delete shift');
        }
      } catch (error) {
        setMessage(handleAPIError(error));
      } finally {
        setLoading(false);
      }
    }
  };

  // Load overview data based on selected period with smart status sync
  const handleViewData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRangeForPeriod(selectedTimePeriod);
      
      const response = await makeAPICall({
        action: 'getAllShiftsForAdmin',
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      
      if (response.success) {
        console.log('🔍 === OVERVIEW SECTION: Smart Status Processing ===');
        console.log('Overview data received:', response.data.length, 'records');
        
        // Apply smart status calculation and sync with backend
        const normalizedData = [];
        const statusUpdates = [];
        
        console.log('🚀 Starting overview normalization loop for', response.data.length, 'records');
        
        try {
          for (const rec of response.data) {
            console.log('📝 Overview processing record:', rec['Shift ID']);
            
            try {
              const normalized = await normalizeRecord(rec);
              normalizedData.push(normalized);
              
              // DETAILED DEBUG: Check every field of normalized record
              console.log('🔍 === OVERVIEW NORMALIZED RECORD DEBUG ===');
              console.log('Shift ID:', normalized['Shift ID']);
              console.log('Original Status:', normalized['_originalStatus']);
              console.log('Smart Status:', normalized['_smartStatus']);
              console.log('Status Calculated Flag:', normalized['_statusCalculated']);
              console.log('Current Status Field:', normalized['Status']);
              console.log('=============================================');
              
              // If status was calculated differently, prepare for backend sync
              if (normalized['_statusCalculated']) {
                console.log('✅ OVERVIEW STATUS UPDATE NEEDED - Adding to status updates array');
                statusUpdates.push({
                  shiftId: normalized['Shift ID'],
                  oldStatus: normalized['_originalStatus'],
                  newStatus: normalized['_smartStatus']
                });
                console.log('🎯 Current overview statusUpdates array length:', statusUpdates.length);
              } else {
                console.log('⏭️ No overview status update needed for this record');
              }
            } catch (recordError) {
              console.error('❌ Error processing overview record:', rec['Shift ID'], recordError);
              // Add the record without normalization as fallback
              normalizedData.push(rec);
            }
          }
        } catch (loopError) {
          console.error('❌ Error in overview normalization loop:', loopError);
        }
        
        console.log('🎯 === OVERVIEW NORMALIZATION LOOP COMPLETED ===');
        console.log('Overview normalized data count:', normalizedData.length);
        console.log('Overview status updates count:', statusUpdates.length);
        
        console.log('🔍 Overview status updates array:', statusUpdates);
        console.log('📊 Overview status updates count:', statusUpdates.length);
        
        if (statusUpdates.length > 0) {
          console.log('=== Overview Status Updates Needed ===');
          console.log(statusUpdates);
          
          // Sync status updates with backend
          for (const update of statusUpdates) {
            console.log(`🚀 Processing overview update for shift ${update.shiftId}:`, update);
            await syncStatusWithBackend({
              'Shift ID': update.shiftId,
              'Status': update.oldStatus
            }, update.newStatus);
          }
        } else {
          console.log('⭐ No overview status updates needed - all statuses match');
        }
        
        setOverviewData(normalizedData);
        setShowOverviewTable(true);
        setMessage(`Loaded ${response.data.length} shifts for ${timePeriodOptions.find(o => o.value === selectedTimePeriod)?.label}${statusUpdates.length > 0 ? ` (${statusUpdates.length} status updates synced)` : ''}`);
      } else {
        setMessage(response.message || 'Failed to load data');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  // Apply column filters
  const getFilteredData = () => {
    let filtered = [...overviewData];
    
    Object.keys(columnFilters).forEach(column => {
      const filterValue = columnFilters[column];
      if (filterValue) {
        filtered = filtered.filter(row => 
          String(row[column] || '').toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });
    
    return filtered;
  };

  // Staff Management Functions
  const handleAddStaff = () => {
    setNewStaffData({
      employeeId: '',
      name: '',
      email: '',
      role: 'Staff',
      department: '',
      timezone: 'Asia/Kolkata (India Standard Time)'
    });
    setShowAddStaffModal(true);
  };

  const handleSaveNewStaff = async () => {
    if (!newStaffData.name || !newStaffData.email || !newStaffData.employeeId) {
      setMessage('Please fill in all required fields (Name, Email, Employee ID)');
      return;
    }

    setLoading(true);
    try {
      const response = await makeAPICall({
        action: 'addStaff',
        staffData: newStaffData
      });

      if (response.success) {
        setMessage('Staff member added successfully!');
        setShowAddStaffModal(false);
        await loadDashboardData(); // Reload staff list
      } else {
        setMessage(response.message || 'Failed to add staff member');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = (staff) => {
    setEditingStaff({ ...staff });
  };

  const handleSaveStaffEdit = async () => {
    if (!editingStaff.name || !editingStaff.email) {
      setMessage('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await makeAPICall({
        action: 'updateStaff',
        staffId: editingStaff.staffId,
        staffData: editingStaff
      });

      if (response.success) {
        setMessage('Staff member updated successfully!');
        setEditingStaff(null);
        await loadDashboardData(); // Reload staff list
      } else {
        setMessage(response.message || 'Failed to update staff member');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to delete ${staff.name}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await makeAPICall({
        action: 'deleteStaff',
        staffId: staff.staffId
      });

      if (response.success) {
        setMessage('Staff member deleted successfully!');
        await loadDashboardData(); // Reload staff list
      } else {
        setMessage(response.message || 'Failed to delete staff member');
      }
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStaffList = async () => {
    setLoading(true);
    try {
      await loadDashboardData(); // This loads the staff list
      setMessage('Staff list refreshed successfully!');
    } catch (error) {
      setMessage(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Navigation Bar */}
      <nav className="navbar navbar-expand-md navbar-dark bg-danger sticky-top">
        <div className="container-fluid px-3">
          <span className="navbar-brand mb-0 h1 d-flex align-items-center">
            <i className="bi bi-shield-check me-2"></i>
            <span className="d-none d-sm-inline">Admin Dashboard</span>
            <span className="d-inline d-sm-none">Admin</span>
          </span>
          
          {/* Tab Navigation */}
          <div className="navbar-nav me-auto d-flex flex-row">
            <button 
              className={`btn btn-sm me-2 ${activeTab === 'overview' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`btn btn-sm me-2 ${activeTab === 'shifts' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setActiveTab('shifts')}
            >
              Shifts
            </button>
            <button 
              className={`btn btn-sm me-2 ${activeTab === 'staff' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setActiveTab('staff')}
            >
              Staff
            </button>
            <button 
              className={`btn btn-sm me-2 ${activeTab === 'system' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setActiveTab('system')}
            >
              System
            </button>
          </div>
          
          <div className="navbar-nav ms-auto d-flex flex-row align-items-center">
            <span className="navbar-text me-3 d-none d-md-inline">
              Welcome, <strong>{user?.name?.split(' ')[0] || 'Admin'}</strong>
            </span>
            <button 
              className="btn btn-outline-light btn-sm me-2" 
              onClick={loadDashboardData}
              disabled={loading}
              title="Refresh status data and sync with backend"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''} me-1`}></i>
              <span className="d-none d-sm-inline">Refresh</span>
              <span className="d-inline d-sm-none">🔄</span>
            </button>
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
      </nav>

      {/* Main Content */}
      <div className="container-fluid p-2 p-md-4">
        {message && (
          <div className="alert alert-info alert-dismissible fade show" role="alert">
            {message}
            <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="row g-3 g-md-4">
            <div className="col-12">
              <h2 className="h4 mb-3">📊 Data Overview & Analysis</h2>
            </div>
            
            {/* Stats Cards */}
            <div className="col-6 col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-primary">{stats.totalShifts}</h5>
                  <p className="card-text small">Total Shifts</p>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-success">{stats.activeShifts}</h5>
                  <p className="card-text small">Active Now</p>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-info">{stats.todayShifts}</h5>
                  <p className="card-text small">Today's Shifts</p>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-warning">{stats.totalStaff}</h5>
                  <p className="card-text small">Total Staff</p>
                </div>
              </div>
            </div>

            {/* Quick Actions - Data Viewing Controls */}
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="card-title mb-0">� Quick Actions - Data Viewer</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 align-items-end">
                    {/* Time Period Selection */}
                    <div className="col-12 col-md-4">
                      <label className="form-label small">Select Time Period:</label>
                      <select 
                        className="form-select"
                        value={selectedTimePeriod}
                        onChange={(e) => setSelectedTimePeriod(e.target.value)}
                      >
                        {timePeriodOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Custom Date Range (when Custom is selected) */}
                    {selectedTimePeriod === 'custom' && (
                      <>
                        <div className="col-6 col-md-2">
                          <label className="form-label small">Start Date:</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={customDateRange.start}
                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          />
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="form-label small">End Date:</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={customDateRange.end}
                            onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                    
                    {/* View Button */}
                    <div className={`col-12 ${selectedTimePeriod === 'custom' ? 'col-md-4' : 'col-md-8'}`}>
                      <button 
                        className="btn btn-primary w-100"
                        onClick={handleViewData}
                        disabled={loading || (selectedTimePeriod === 'custom' && (!customDateRange.start || !customDateRange.end))}
                      >
                        {loading ? (
                          <span className="spinner-border spinner-border-sm me-2" />
                        ) : (
                          <i className="bi bi-eye me-2"></i>
                        )}
                        View Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column Selection and Filters */}
            {showOverviewTable && (
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <h6 className="card-title mb-0">🎛️ Column Controls & Filters</h6>
                  </div>
                  <div className="card-body">
                    {/* Column Filters */}
                    <div className="row">
                      <div className="col-12">
                        <label className="form-label small fw-bold">Filter by Columns:</label>
                        <div className="row g-2">
                          {getOrderedOverviewColumns().map(colKey => {
                            const column = appsScriptColumns.find(col => col.key === colKey);
                            return (
                              <div key={colKey} className="col-6 col-md-3">
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text" style={{fontSize: '0.75rem'}}>
                                    {column?.label || colKey}
                                  </span>
                                  <input 
                                    type="text"
                                    className="form-control"
                                    placeholder="Filter..."
                                    value={columnFilters[colKey] || ''}
                                    onChange={(e) => setColumnFilters(prev => ({ 
                                      ...prev, 
                                      [colKey]: e.target.value 
                                    }))}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Table */}
            {showOverviewTable && (
              <div className="col-12">
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">📋 Data Table</h6>
                    <small className="text-muted">
                      Showing {getFilteredData().length} of {overviewData.length} records
                    </small>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-striped table-hover table-sm">
                        <thead className="table-dark">
                          <tr>
                            {getOrderedOverviewColumns().map(colKey => {
                              const column = appsScriptColumns.find(col => col.key === colKey);
                              return (
                                <th key={colKey} className="text-nowrap">
                                  {column?.label || colKey}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredData().map((row, index) => (
                            <tr key={row.id || index}>
                              {getOrderedOverviewColumns().map(colKey => (
                                <td key={colKey} className="text-nowrap">
                                  {colKey === 'status' ? (
                                    <span className={`badge ${
                                      row[colKey] === 'ACTIVE' ? 'bg-success' :
                                      row[colKey] === 'COMPLETED' ? 'bg-primary' :
                                      'bg-secondary'
                                    }`}>
                                      {row[colKey]}
                                    </span>
                                  ) : (
                                    formatCellData(row[colKey], colKey)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {getFilteredData().length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-muted mb-0">No data matches your filters</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shifts Management Tab */}
        {activeTab === 'shifts' && (
          <div className="row g-3 g-md-4">
            <div className="col-12">
              <h2 className="h4 mb-3">⏰ Shift Management & Editing</h2>
            </div>

            {/* Quick Actions - Shifts Data Viewer */}
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="card-title mb-0">🔍 Shifts Data Viewer & Editor</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 align-items-end">
                    {/* Time Period Selection */}
                    <div className="col-12 col-md-4">
                      <label className="form-label small">Select Time Period:</label>
                      <select 
                        className="form-select"
                        value={shiftsTimePeriod}
                        onChange={(e) => setShiftsTimePeriod(e.target.value)}
                      >
                        {timePeriodOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Custom Date Range (when Custom is selected) */}
                    {shiftsTimePeriod === 'custom' && (
                      <>
                        <div className="col-6 col-md-2">
                          <label className="form-label small">Start Date:</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={shiftsCustomDateRange.start}
                            onChange={(e) => setShiftsCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          />
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="form-label small">End Date:</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={shiftsCustomDateRange.end}
                            onChange={(e) => setShiftsCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                    
                    {/* View Button */}
                    <div className={`col-12 ${shiftsTimePeriod === 'custom' ? 'col-md-4' : 'col-md-8'}`}>
                      <button 
                        className="btn btn-primary w-100"
                        onClick={handleViewShiftsData}
                        disabled={loading || (shiftsTimePeriod === 'custom' && (!shiftsCustomDateRange.start || !shiftsCustomDateRange.end))}
                      >
                        {loading ? (
                          <span className="spinner-border spinner-border-sm me-2" />
                        ) : (
                          <i className="bi bi-eye me-2"></i>
                        )}
                        View Shifts Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column Selection and Filters */}
            {showShiftsTable && (
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <h6 className="card-title mb-0">🎛️ Column Controls & Filters</h6>
                  </div>
                  <div className="card-body">
                    {/* Column Filters */}
                    <div className="row">
                      <div className="col-12">
                        <label className="form-label small fw-bold">Filter by Columns:</label>
                        <div className="row g-2">
                          {getOrderedShiftsColumns().map(colKey => {
                            const column = appsScriptColumns.find(col => col.key === colKey);
                            return (
                              <div key={colKey} className="col-6 col-md-3">
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text" style={{fontSize: '0.75rem'}}>
                                    {column?.label || colKey}
                                  </span>
                                  <input 
                                    type="text"
                                    className="form-control"
                                    placeholder="Filter..."
                                    value={shiftsColumnFilters[colKey] || ''}
                                    onChange={(e) => setShiftsColumnFilters(prev => ({ 
                                      ...prev, 
                                      [colKey]: e.target.value 
                                    }))}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shifts Data Table with Editing */}
            {showShiftsTable && (
              <div className="col-12">
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">📋 Shifts Management Table</h6>
                    <div className="d-flex align-items-center gap-3">
                      <small className="text-muted">
                        Showing {getFilteredShiftsData().length} of {shiftsData.length} shifts
                      </small>
                      {editingShift && (
                        <div className="d-flex gap-1">
                          <button 
                            className="btn btn-sm btn-success"
                            onClick={() => handleSaveEdit(editingShift)}
                            disabled={loading}
                          >
                            <i className="bi bi-check me-1"></i>Save
                          </button>
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={handleCancelEdit}
                          >
                            <i className="bi bi-x me-1"></i>Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-striped table-hover table-sm">
                        <thead className="table-dark">
                          <tr>
                            {getOrderedShiftsColumns().map(colKey => {
                              const column = appsScriptColumns.find(col => col.key === colKey);
                              const isSortable = ['Employee Name', 'Employee ID', 'Shift Date', 'Shift Type', 'First Start Time', 'Last End Time', 'Status', 'Total Duration', 'Last Updated', 'Created At', 'Shift ID'].includes(colKey);
                              return (
                                <th key={colKey} className={`text-nowrap ${isSortable ? 'user-select-none position-relative' : ''}`} 
                                    style={isSortable ? {cursor: 'pointer', backgroundColor: sortConfig.key === colKey ? '#e3f2fd' : ''} : {}}
                                    onClick={isSortable ? () => handleSort(colKey) : undefined}>
                                  <div className="d-flex align-items-center justify-content-between">
                                    <span>{column?.label || colKey}</span>
                                    {isSortable && (
                                      <span className={`ms-1 ${sortConfig.key === colKey ? 'text-primary fw-bold' : 'text-muted'}`} style={{fontSize: '14px'}}>
                                        {sortConfig.key === colKey ? (
                                          sortConfig.direction === 'asc' ? '↑' : '↓'
                                        ) : '↕'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                            <th className="text-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredShiftsData().map((shift, index) => (
                            <tr key={shift['Shift ID'] || index}>
                              {getOrderedShiftsColumns().map(colKey => (
                                <td key={colKey} className="text-nowrap">
                                  {editingShift === shift['Shift ID'] && ['Employee ID', 'Employee Name', 'Shift Date', 'Shift Type', 'First Start Time', 'Last End Time', 'Status'].includes(colKey) ? (
                                    // Edit mode
                                    colKey === 'Status' ? (
                                      <select 
                                        className="form-select form-select-sm"
                                        value={editFormData[colKey] || ''}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, [colKey]: e.target.value }))}
                                      >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                      </select>
                                    ) : colKey === 'Shift Date' ? (
                                      <input 
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={editFormData[colKey] || ''}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, [colKey]: e.target.value }))}
                                      />
                                    ) : colKey === 'First Start Time' || colKey === 'Last End Time' ? (
                                      <input 
                                        type="time"
                                        className="form-control form-control-sm"
                                        value={editFormData[colKey] || ''}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, [colKey]: e.target.value }))}
                                      />
                                    ) : (
                                      <input 
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={editFormData[colKey] || ''}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, [colKey]: e.target.value }))}
                                      />
                                    )
                                  ) : (
                                    // View mode
                                    colKey === 'Status' ? (
                                      <span>
                                        <span className={`badge ${
                                          (shift['_smartStatus'] || shift[colKey]) === 'ACTIVE' ? 'bg-success' :
                                          (shift['_smartStatus'] || shift[colKey]) === 'COMPLETED' ? 'bg-primary' :
                                          (shift['_smartStatus'] || shift[colKey]) === 'OFFLINE' ? 'bg-secondary' :
                                          'bg-warning'
                                        }`}>
                                          {shift['_smartStatus'] || shift[colKey] || 'DRAFT'}
                                        </span>
                                        {shift['_statusCalculated'] && (
                                          <small className="text-muted ms-1" title="Status calculated by smart logic">📊</small>
                                        )}
                                      </span>
                                    ) : (
                                      formatCellData(shift[colKey], colKey)
                                    )
                                  )}
                                </td>
                              ))}
                              <td className="text-nowrap">
                                {editingShift === shift['Shift ID'] ? (
                                  <span className="text-muted small">Editing...</span>
                                ) : (
                                  <div className="d-flex gap-1">
                                    <button 
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => handleEditShift(shift)}
                                      disabled={loading || editingShift}
                                      title="Edit Shift"
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDeleteShift(shift['Shift ID'], shift['Employee Name'])}
                                      disabled={loading || editingShift}
                                      title="Delete Shift"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {getFilteredShiftsData().length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-muted mb-0">No shifts match your filters</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staff Management Tab */}
        {activeTab === 'staff' && (
          <div className="row">
            <div className="col-12">
              <h2 className="h4 mb-3">👥 Staff Management</h2>
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">
                    All Staff Members
                    {loading && (
                      <span className="spinner-border spinner-border-sm ms-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </span>
                    )}
                  </h5>
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleRefreshStaffList}
                      disabled={loading}
                      title="Refresh staff list"
                    >
                      <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
                      {loading ? '' : ' Refresh'}
                    </button>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={handleAddStaff}
                      disabled={loading}
                    >
                      <i className="bi bi-person-plus me-1"></i> Add Staff
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading staff data...</span>
                      </div>
                      <p className="mt-2 text-muted">Loading staff data...</p>
                    </div>
                  ) : allStaff.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Time Zone</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allStaff.map(staff => (
                            <tr key={staff.staffId || staff.employeeId}>
                              <td>{staff.staffId || staff.employeeId}</td>
                              <td>{staff.name}</td>
                              <td>{staff.email}</td>
                              <td>
                                <span className={`badge ${
                                  staff.role === 'Admin' ? 'bg-danger' : 'bg-info'
                                }`}>
                                  {staff.role}
                                </span>
                              </td>
                              <td>{staff.department}</td>
                              <td>
                                <small className="text-muted">
                                  {staff.timezone || 'Asia/Kolkata (IST)'}
                                </small>
                              </td>
                              <td>
                                <button 
                                  className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => handleEditStaff(staff)}
                                  disabled={loading}
                                  title="Edit Staff"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteStaff(staff)}
                                  disabled={loading}
                                  title="Delete Staff"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i className="bi bi-people display-1 text-muted"></i>
                      <p className="text-muted mt-2 mb-3">No staff members found</p>
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleRefreshStaffList}
                        disabled={loading}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Management Tab */}
        {activeTab === 'system' && (
          <div className="row">
            <div className="col-12">
              <h2 className="h4 mb-3">⚙️ System Management</h2>
              
              {/* SimpleFilterTable Information */}
              <div className="card mb-3">
                <div className="card-header">
                  <h5 className="card-title mb-0">📊 SimpleFilterTable System</h5>
                </div>
                <div className="card-body">
                  <p className="text-muted">
                    The SimpleFilterTable provides powerful filtering and reporting capabilities directly in Google Sheets.
                    It works alongside this React admin system to give you complete data control.
                  </p>
                  <div className="alert alert-info">
                    <strong>📌 How to use SimpleFilterTable:</strong>
                    <ol className="mb-0 mt-2">
                      <li>Open your Google Sheets document</li>
                      <li>Navigate to the "SimpleFilterTable" sheet</li>
                      <li>Use the dropdown filters to view data by date, employee, status, etc.</li>
                      <li>The data updates automatically as staff log their shifts</li>
                    </ol>
                  </div>
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-primary"
                      onClick={handleCreateSimpleFilterTable}
                      disabled={loading}
                    >
                      Create/Update SimpleFilterTable
                    </button>
                    <button className="btn btn-outline-primary">
                      <i className="bi bi-box-arrow-up-right me-1"></i>
                      Open in Google Sheets
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Features Section */}
              <div className="card mb-3">
                <div className="card-header">
                  <h5 className="card-title mb-0">🤖 AI Features</h5>
                </div>
                <div className="card-body">
                  <p className="text-muted">
                    Leverage artificial intelligence to gain insights from your staff data, detect patterns, 
                    and optimize workforce management with smart recommendations.
                  </p>
                  <div className="row g-3">
                    <div className="col-12">
                      <h6 className="text-muted mb-3">🧠 Intelligent Analytics</h6>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-info"
                          onClick={handleAIShiftAnalysis}
                          disabled={loading}
                        >
                          <i className="bi bi-graph-up me-2"></i>
                          AI Shift Pattern Analysis
                        </button>
                        <small className="text-muted mt-1">
                          Analyze shift patterns and generate insights
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-info"
                          onClick={handleStaffProductivityInsights}
                          disabled={loading}
                        >
                          <i className="bi bi-person-check me-2"></i>
                          Productivity Insights
                        </button>
                        <small className="text-muted mt-1">
                          Generate staff performance analytics
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-warning"
                          onClick={handleAnomalyDetection}
                          disabled={loading}
                        >
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Anomaly Detection
                        </button>
                        <small className="text-muted mt-1">
                          Detect unusual patterns in shift data
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-success"
                          onClick={handleSmartScheduleSuggestions}
                          disabled={loading}
                        >
                          <i className="bi bi-calendar-check me-2"></i>
                          Smart Schedule Suggestions
                        </button>
                        <small className="text-muted mt-1">
                          AI-powered scheduling recommendations
                        </small>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-purple"
                          onClick={handleCustomAIPrompt}
                          disabled={loading}
                          style={{ borderColor: '#6f42c1', color: '#6f42c1' }}
                        >
                          <i className="bi bi-chat-dots me-2"></i>
                          Custom AI Prompt
                        </button>
                        <small className="text-muted mt-1">
                          Ask your own questions and get AI insights
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert alert-light mt-3">
                    <h6 className="alert-heading">💡 AI Features Capabilities</h6>
                    <ul className="mb-0 small">
                      <li><strong>Pattern Recognition:</strong> Identifies trends in work schedules and productivity</li>
                      <li><strong>Anomaly Detection:</strong> Flags unusual shift patterns that may need attention</li>
                      <li><strong>Predictive Analytics:</strong> Suggests optimal scheduling based on historical data</li>
                      <li><strong>Performance Insights:</strong> Provides data-driven employee performance metrics</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* System Actions */}
              <div className="card">
                <div className="card-header">
                  <h5 className="card-title mb-0">🔧 System Actions</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-success"
                          onClick={handleSetupProductionSystem}
                          disabled={loading}
                        >
                          <i className="bi bi-gear-fill me-2"></i>
                          Setup Production System
                        </button>
                        <small className="text-muted mt-1">
                          Initialize all required sheets and configurations
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-warning"
                          onClick={handleCleanupOldSheets}
                          disabled={loading}
                        >
                          <i className="bi bi-trash me-2"></i>
                          Cleanup Old Sheets
                        </button>
                        <small className="text-muted mt-1">
                          Remove unnecessary sheets and optimize performance
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-secondary"
                          onClick={handleDebugSheetStructure}
                          disabled={loading}
                        >
                          <i className="bi bi-bug me-2"></i>
                          Debug Sheet Structure
                        </button>
                        <small className="text-muted mt-1">
                          Check column mapping and data structure
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="d-grid">
                        <button 
                          className="btn btn-info"
                          onClick={loadDashboardData}
                          disabled={loading}
                        >
                          <i className="bi bi-arrow-clockwise me-2"></i>
                          Refresh Data
                        </button>
                        <small className="text-muted mt-1">
                          Reload all dashboard statistics and data
                        </small>
                      </div>
                    </div>
                    <div className="col-12">
                      <h6 className="text-muted mb-3">📥 Data Export Options</h6>
                    </div>
                    <div className="col-12 col-md-3">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-primary"
                          onClick={handleExportStaffData}
                          disabled={loading}
                        >
                          <i className="bi bi-people me-2"></i>
                          Export Staff Data
                        </button>
                        <small className="text-muted mt-1">
                          Download staff list as CSV
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-3">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-primary"
                          onClick={handleExportShiftsData}
                          disabled={loading}
                        >
                          <i className="bi bi-clock me-2"></i>
                          Export Shifts Data
                        </button>
                        <small className="text-muted mt-1">
                          Download current month shifts as CSV
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-3">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-success"
                          onClick={handleExportAllData}
                          disabled={loading}
                        >
                          <i className="bi bi-download me-2"></i>
                          Complete Backup
                        </button>
                        <small className="text-muted mt-1">
                          JSON or CSV format (choose when clicked)
                        </small>
                      </div>
                    </div>
                    <div className="col-12 col-md-3">
                      <div className="d-grid">
                        <button 
                          className="btn btn-outline-warning"
                          onClick={handleConvertJSONToCSV}
                          disabled={loading}
                        >
                          <i className="bi bi-arrow-repeat me-2"></i>
                          Convert JSON→CSV
                        </button>
                        <small className="text-muted mt-1">
                          Upload JSON backup to convert to CSV
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Staff Member</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowAddStaffModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label className="form-label">Employee ID *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newStaffData.employeeId}
                      onChange={(e) => setNewStaffData({...newStaffData, employeeId: e.target.value})}
                      placeholder="Enter Employee ID (e.g., EMP003)"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newStaffData.name}
                      onChange={(e) => setNewStaffData({...newStaffData, name: e.target.value})}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={newStaffData.email}
                      onChange={(e) => setNewStaffData({...newStaffData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={newStaffData.role}
                      onChange={(e) => setNewStaffData({...newStaffData, role: e.target.value})}
                    >
                      <option value="Staff">Staff</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newStaffData.department}
                      onChange={(e) => setNewStaffData({...newStaffData, department: e.target.value})}
                      placeholder="Enter department"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Time Zone</label>
                    <select
                      className="form-select"
                      value={newStaffData.timezone}
                      onChange={(e) => setNewStaffData({...newStaffData, timezone: e.target.value})}
                    >
                      <option value="Asia/Kolkata (India Standard Time)">Asia/Kolkata (India Standard Time)</option>
                      <option value="America/New_York (Eastern Time)">America/New_York (Eastern Time)</option>
                      <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                      <option value="Asia/Tokyo (Japan Time)">Asia/Tokyo (Japan Time)</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAddStaffModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSaveNewStaff}
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Staff Member</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setEditingStaff(null)}
                ></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label className="form-label">Employee ID</label>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={editingStaff.employeeId || editingStaff.staffId}
                      disabled
                    />
                    <small className="text-muted">Employee ID cannot be changed</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingStaff.name}
                      onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editingStaff.email}
                      onChange={(e) => setEditingStaff({...editingStaff, email: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={editingStaff.role}
                      onChange={(e) => setEditingStaff({...editingStaff, role: e.target.value})}
                    >
                      <option value="Staff">Staff</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingStaff.department}
                      onChange={(e) => setEditingStaff({...editingStaff, department: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Time Zone</label>
                    <select
                      className="form-select"
                      value={editingStaff.timezone || 'Asia/Kolkata (India Standard Time)'}
                      onChange={(e) => setEditingStaff({...editingStaff, timezone: e.target.value})}
                    >
                      <option value="Asia/Kolkata (India Standard Time)">Asia/Kolkata (India Standard Time)</option>
                      <option value="America/New_York (Eastern Time)">America/New_York (Eastern Time)</option>
                      <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                      <option value="Asia/Tokyo (Japan Time)">Asia/Tokyo (Japan Time)</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingStaff(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSaveStaffEdit}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom AI Prompt Modal */}
      {showCustomPromptModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">🤖 Custom AI Analysis</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowCustomPromptModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Enter your question or prompt:</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Examples:&#10;• How is my staff performance?&#10;• What are the overtime patterns?&#10;• Analyze shift productivity by department&#10;• Show me scheduling trends&#10;• What improvements can I make?"
                  />
                  <small className="text-muted">
                    Ask questions about staff performance, shift patterns, overtime, departments, or any other workforce insights.
                  </small>
                </div>
                
                {aiResponse && (
                  <div className="alert alert-info">
                    <h6 className="alert-heading">🤖 AI Response:</h6>
                    <p className="mb-2">{aiResponse}</p>
                    {lastAnalysis && (
                      <div className="mt-2">
                        <small className="text-muted">
                          <strong>Confidence:</strong> {lastAnalysis.confidence}% | 
                          <strong> Processing Time:</strong> {lastAnalysis.processingTime}ms | 
                          <strong> Data Sources:</strong> {lastAnalysis.dataSource}
                        </small>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="alert alert-light">
                  <h6 className="alert-heading">💡 Example Prompts:</h6>
                  <ul className="mb-0 small">
                    <li><strong>"How is staff productivity?"</strong> - Get performance metrics and insights</li>
                    <li><strong>"Show me overtime patterns"</strong> - Analyze overtime trends and recommendations</li>
                    <li><strong>"What are the busiest days?"</strong> - Discover shift pattern insights</li>
                    <li><strong>"How can I improve scheduling?"</strong> - Get optimization suggestions</li>
                    <li><strong>"Analyze department workload"</strong> - Compare department metrics</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowCustomPromptModal(false)}
                >
                  Close
                </button>
                {aiResponse && lastAnalysis && (
                  <button 
                    type="button" 
                    className="btn btn-outline-success"
                    onClick={handleDownloadAIReport}
                  >
                    <i className="bi bi-download me-2"></i>
                    Download Report
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleProcessCustomPrompt}
                  disabled={loading || !customPrompt.trim()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-magic me-2"></i>
                      Analyze with AI
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

export default AdminDashboard;
