// Comprehensive connection test to debug the network error
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzvK5CPjzPpeAiMy1giizBz9eRyHXTYYgq8lERjwEF0XeZKvTZKk0OY3_2d1DaaceUJ/exec';

console.log('🔍 COMPREHENSIVE CONNECTION TEST');
console.log('=================================');
console.log('URL:', APPS_SCRIPT_URL);
console.log('Browser:', navigator.userAgent);
console.log('Current time:', new Date().toISOString());
console.log('Client timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('');

// Test 1: Simple GET request
console.log('📍 TEST 1: GET Request');
fetch(APPS_SCRIPT_URL, {
  method: 'GET'
})
.then(response => {
  console.log('✅ GET Status:', response.status, response.statusText);
  console.log('✅ GET OK:', response.ok);
  console.log('✅ GET URL:', response.url);
  console.log('✅ GET Type:', response.type);
  console.log('✅ GET Redirected:', response.redirected);
  console.log('✅ GET Headers:');
  for (let [key, value] of response.headers.entries()) {
    console.log(`    ${key}: ${value}`);
  }
  return response.text();
})
.then(text => {
  console.log('✅ GET Response Length:', text.length);
  console.log('✅ GET Response Text:', text);
  try {
    const json = JSON.parse(text);
    console.log('✅ GET Parsed JSON:', json);
  } catch (e) {
    console.log('⚠️ GET Response is not JSON:', e.message);
  }
})
.catch(error => {
  console.error('❌ GET Request failed');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  if (error.cause) console.error('Error cause:', error.cause);
  console.error('Error stack:', error.stack);
});

// Test 2: POST request with valid action
setTimeout(() => {
  console.log('');
  console.log('📍 TEST 2: POST Request (testConnection)');
  
  const payload = {
    action: 'testConnection',
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    clientTimezoneOffset: new Date().getTimezoneOffset(),
    testData: 'connectivity-test'
  };
  
  console.log('Sending payload:', payload);
  
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
  .then(response => {
    console.log('✅ POST Status:', response.status, response.statusText);
    console.log('✅ POST OK:', response.ok);
    console.log('✅ POST URL:', response.url);
    console.log('✅ POST Type:', response.type);
    console.log('✅ POST Redirected:', response.redirected);
    console.log('✅ POST Headers:');
    for (let [key, value] of response.headers.entries()) {
      console.log(`    ${key}: ${value}`);
    }
    return response.text();
  })
  .then(text => {
    console.log('✅ POST Response Length:', text.length);
    console.log('✅ POST Response Text:', text);
    try {
      const json = JSON.parse(text);
      console.log('✅ POST Parsed JSON:', json);
    } catch (e) {
      console.log('⚠️ POST Response is not JSON:', e.message);
      console.log('First 200 chars of response:', text.substring(0, 200));
    }
  })
  .catch(error => {
    console.error('❌ POST Request failed');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.cause) console.error('Error cause:', error.cause);
    console.error('Error stack:', error.stack);
  });
}, 2000);

// Test 3: POST request with login action (like your app)
setTimeout(() => {
  console.log('');
  console.log('📍 TEST 3: POST Request (login test)');
  
  const loginPayload = {
    action: 'login',
    username: 'John Doe',
    password: 'EMP001',
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    clientTimezoneOffset: new Date().getTimezoneOffset()
  };
  
  console.log('Sending login payload:', loginPayload);
  
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(loginPayload),
  })
  .then(response => {
    console.log('✅ LOGIN Status:', response.status, response.statusText);
    console.log('✅ LOGIN OK:', response.ok);
    return response.text();
  })
  .then(text => {
    console.log('✅ LOGIN Response Text:', text);
    try {
      const json = JSON.parse(text);
      console.log('✅ LOGIN Parsed JSON:', json);
      
      if (json.success) {
        console.log('🎉 GREAT! Authentication works!');
        console.log('User data:', json.data);
      } else {
        console.log('🔒 Authentication failed (expected):', json.message);
      }
    } catch (e) {
      console.log('⚠️ LOGIN Response is not JSON:', e.message);
    }
  })
  .catch(error => {
    console.error('❌ LOGIN Request failed');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  });
}, 4000);

// Test 4: Test with different content types
setTimeout(() => {
  console.log('');
  console.log('📍 TEST 4: POST with different Content-Type');
  
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'testConnection',
      testType: 'json-header'
    }),
  })
  .then(response => {
    console.log('✅ JSON Header Status:', response.status);
    return response.text();
  })
  .then(text => {
    console.log('✅ JSON Header Response:', text);
  })
  .catch(error => {
    console.error('❌ JSON Header failed:', error.message);
  });
}, 6000);

console.log('');
console.log('⏳ Running all tests... Check results above as they complete.');
console.log('📝 This will help identify exactly what\'s failing.');
console.log('');