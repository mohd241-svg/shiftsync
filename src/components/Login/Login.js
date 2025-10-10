import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { loginUser, handleAPIError } from '../../services/appScriptAPI';

// Timezone options
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Manila', label: 'Philippines (PHT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' }
];

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '', // This will be the Name from the sheet
    password: '', // This will be the Employee ID from the sheet
  });
  const [timezone, setTimezone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();


  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!timezone) {
      setError('Please select your timezone');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const response = await loginUser({
        ...credentials,
        timezone: timezone
      });
      
      if (response.success && response.data) {
        // Store timezone in user data
        const userData = {
          ...response.data,
          timezone: timezone
        };
        login(userData, response.data.role);
      } else {
        // Set an error message from the API response
        setError(response.message || 'An unknown error occurred.');
      }
    } catch (apiError) {
      console.error('Login API call failed:', apiError);
      setError(handleAPIError(apiError));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="row w-100">
        <div className="col-12 col-sm-8 col-md-6 col-lg-4 mx-auto">
          <div className="card shadow">
            <div className="card-body p-4">
              <h2 className="card-title text-center mb-4">Staff Portal Login</h2>
              
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

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">
                    Username (Full Name) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    name="username"
                    value={credentials.username}
                    onChange={handleChange}
                    required
                    autoFocus
                    disabled={loading}
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    Password (Employee ID) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    name="password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="timezone" className="form-label">
                    <i className="bi bi-globe me-2"></i>
                    Your Timezone <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    required
                    disabled={loading}
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                  >
                    <option value="">Select your timezone...</option>
                    {TIMEZONE_OPTIONS.map(tz => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <div className="form-text text-muted">
                    This ensures accurate time tracking for your location
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span 
                        className="spinner-border spinner-border-sm me-2" 
                        role="status" 
                        aria-hidden="true"
                      ></span>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Login;
