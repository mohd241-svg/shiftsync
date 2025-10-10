# 📊 Staff Portal - Time Tracking System

A modern React-based staff time tracking application with Google Apps Script backend integration.

## 🎯 **Features**

- **Time Tracking**: Start, stop, and manage work shifts
- **Shift History**: View detailed shift records with timezone support
- **User Authentication**: Secure login with employee credentials
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Live shift status and duration tracking
- **Timezone Intelligence**: Times display in user's local timezone

## 🚀 **Quick Start**

### **Frontend (React)**
```bash
# Install dependencies
npm install

# Start development server
npm start
# Opens http://localhost:3000

# Build for production
npm run build
```

### **Backend (Google Apps Script)**
1. **Setup Instructions**: See `apps-script-updates/UPDATE-CHECKLIST.md`
2. **Timezone Support**: Enhanced time handling for global users
3. **Clean Dashboard**: Single dynamic table system for reporting

## 📁 **Project Structure**

```
Staff-Portal/
├── src/                    # React frontend source code
│   ├── components/         # React components
│   ├── contexts/          # React context providers
│   ├── services/          # API communication
│   └── styles/            # CSS styling
├── public/                # Static assets
├── build/                 # Production build output
├── apps-script-updates/   # Google Apps Script updates
│   ├── 01-safety-and-testing/  # Testing functions
│   ├── 02-new-functions/       # Timezone-aware functions
│   ├── 03-cleanup-system/      # Table cleanup
│   └── 04-core-updates/        # Updated core functions
└── package.json           # Dependencies and scripts
```

## 🛠️ **Technology Stack**

### **Frontend**
- **React 19.1.0** - Modern UI framework
- **Bootstrap 5.3** - Responsive CSS framework
- **JavaScript ES6+** - Modern JavaScript features

### **Backend**
- **Google Apps Script** - Cloud-based backend
- **Google Sheets** - Data storage
- **RESTful API** - HTTP-based communication

## 🌍 **Timezone Features**

- **Auto-detection**: Automatically detects user's timezone
- **Smart Formatting**: Displays times in local format
- **Global Support**: Works across different timezones
- **Consistent Data**: Server stores UTC, displays local

## 📊 **Apps Script Updates**

The `apps-script-updates/` folder contains organized updates:

1. **Safety & Testing** - Verify system integrity
2. **New Functions** - Timezone-aware capabilities
3. **Cleanup System** - Remove old table systems
4. **Core Updates** - Enhanced API functions

**Start Here**: `apps-script-updates/UPDATE-CHECKLIST.md`

## 🔧 **Development**

### **Available Scripts**
- `npm start` - Development server (localhost:3000)
- `npm test` - Run test suite
- `npm run build` - Create production build
- `npm run eject` - Eject from Create React App (one-way!)

### **Key Components**
- **`Login.js`** - Authentication interface
- **`StaffDashboard.js`** - Main staff interface
- **`AdminDashboard.js`** - Administrative controls
- **`ShiftHistory.js`** - Historical shift data with timezone support

### **API Integration**
- **`appScriptAPI.js`** - Handles Google Apps Script communication
- **`AuthContext.js`** - Manages authentication state

## 🛡️ **Safety & Updates**

- **Backup Strategy**: Always backup before updates
- **Phased Updates**: Follow numbered update phases
- **Testing Functions**: Verify each step works
- **Rollback Plan**: Easy restore if needed

## 📱 **Mobile Support**

- Responsive design for all screen sizes
- Touch-friendly interface
- Mobile navigation patterns
- Optimized for smartphone use

## 🎯 **Getting Help**

1. **Update Issues**: See `apps-script-updates/UPDATE-CHECKLIST.md`
2. **Frontend Issues**: Check browser console for errors
3. **Backend Issues**: Review Google Apps Script execution logs
4. **General Issues**: Check this README for common solutions

---

**🚀 Ready to use!** Start the frontend with `npm start` and follow the Apps Script update guide for backend improvements.

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
