# RemindMe+ 📱

A React Native Expo app that delivers multi-condition, proximity-based reminders using location, time, and battery conditions with local notifications.

## Features

- **Multi-Condition Reminders**: Set reminders based on location, time, and battery level
- **Location Search**: Search and select locations with Google Places Autocomplete
- **Geofencing**: Location-based reminders with customizable radius (50m-1000m)
- **Background Processing**: Monitors conditions even when app is not active
- **Local Notifications**: On-device notifications with actions (Complete, Snooze, Dismiss)
- **SQLite Storage**: All data stored locally, no server required
- **Battery Monitoring**: Reminders based on battery level and charging state
- **Dark Mode**: Fully themed dark mode with glassmorphism effects
- **Material Design UI**: Clean, modern interface using React Native Paper

## Requirements

- **Node.js**: 18.x or later
- **Expo CLI**: Latest version
- **iOS**: 13.0+ / **Android**: API level 21+
- **Device Permissions**: Location, Notifications, Background App Refresh

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd RemindMe+

# Install dependencies
npm install

# Start the development server
npx expo start
```
