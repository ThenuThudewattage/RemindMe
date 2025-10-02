# RemindMe+ 📱

A React Native Expo app that delivers multi-condition, proximity-based reminders using location, time, and battery conditions with local notifications.

## 🌟 Features

- **Multi-Condition Reminders**: Set reminders based on location, time, and battery level
- **Geofencing**: Location-based reminders with customizable radius
- **Background Processing**: Monitors conditions even when app is not active
- **Local Notifications**: On-device notifications with actions (Complete, Snooze, Dismiss)
- **SQLite Storage**: All data stored locally, no server required
- **Battery Monitoring**: Reminders based on battery level and charging state
- **Material Design UI**: Clean, modern interface using React Native Paper

## 📋 Requirements

- **Node.js**: 18.x or later
- **Expo CLI**: Latest version
- **iOS**: 13.0+ / **Android**: API level 21+
- **Device Permissions**: Location, Notifications, Background App Refresh

## 🚀 Quick Start

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

### 2. Running on Device

- **iOS**: Scan QR code with Camera app or use Expo Go
- **Android**: Scan QR code with Expo Go app
- **Physical Device Recommended**: Location and background features work best on real devices

### 3. Required Permissions

The app will request the following permissions on first launch:

- **Location**: Always (required for geofencing)
- **Notifications**: Allow (required for reminders)
- **Background App Refresh**: Enable (required for background processing)

## 📱 App Structure

### Main Screens

1. **Home**: Quick overview and recent reminders
2. **Reminders List**: View all active and inactive reminders
3. **Add/Edit Reminder**: Create or modify reminders with conditions
4. **Reminder Details**: View reminder history and statistics
5. **Settings**: Manage permissions and app preferences

### Reminder Conditions

#### Time Conditions
- **At specific time**: Set exact date and time
- **Recurring**: Daily, weekly, or custom intervals
- **Time range**: Between specific hours

#### Location Conditions
- **Enter location**: Trigger when entering a geofenced area
- **Exit location**: Trigger when leaving a geofenced area
- **At location**: Trigger when at a specific place
- **Radius**: Customizable from 50m to 5km

#### Battery Conditions
- **Battery level**: Above/below specific percentage
- **Charging state**: When plugged in or unplugged
- **Low battery**: When battery is critically low

## 🏗️ Architecture

### Core Services

```
src/
├── app/                 # Expo Router screens
├── components/          # Reusable UI components  
├── services/           # Core business logic
│   ├── db.ts           # SQLite database operations
│   ├── repo.ts         # Data repository layer
│   ├── location.ts     # Location & geofencing
│   ├── battery.ts      # Battery monitoring
│   ├── notifications.ts # Local notifications
│   ├── background.ts   # Background task management
│   └── contextEngine.ts # Condition evaluation
└── types/              # TypeScript definitions
```

### Data Flow

1. **User creates reminder** → Repository stores in SQLite
2. **Background service monitors** → Location, battery, time conditions
3. **Context engine evaluates** → Checks if all conditions are met
4. **Notification triggered** → Local notification with actions
5. **Event logged** → Stores reminder history

## 🔧 Configuration

### Environment Setup

Create `.env` file in project root (optional):

```bash
EXPO_PUBLIC_API_URL=your-api-url  # If using external APIs
EXPO_PUBLIC_DEBUG=true            # Enable debug logging
```

### Customization

Key configuration files:

- `app.json`: Expo configuration and permissions
- `src/services/contextEngine.ts`: Condition evaluation logic
- `src/services/notifications.ts`: Notification behavior

## 📊 Database Schema

### Reminders Table
```sql
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT,
  conditions TEXT NOT NULL,  -- JSON array of conditions
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

### Events Table
```sql
CREATE TABLE reminder_events (
  id TEXT PRIMARY KEY,
  reminderId TEXT NOT NULL,
  type TEXT NOT NULL,       -- 'triggered', 'completed', 'snoozed'
  timestamp TEXT NOT NULL,
  metadata TEXT,            -- Additional event data
  FOREIGN KEY (reminderId) REFERENCES reminders (id)
);
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Create reminder with location condition
- [ ] Test geofencing by moving in/out of area
- [ ] Create time-based reminder
- [ ] Test battery level conditions
- [ ] Verify background processing works
- [ ] Test notification actions (Complete/Snooze/Dismiss)
- [ ] Check reminder history and statistics

### Debug Mode

Enable debug logging by setting `EXPO_PUBLIC_DEBUG=true` in environment variables.

## 🚨 Troubleshooting

### Common Issues

**Location not working:**
- Ensure "Always" location permission is granted
- Check that Location Services are enabled system-wide
- Test on physical device (simulator may have limited location features)

**Background processing not working:**
- Enable Background App Refresh in device settings
- Ensure app is not in battery optimization/power saving mode
- Check notification permissions are granted

**Notifications not showing:**
- Verify notification permissions are granted
- Check Do Not Disturb settings
- Test on physical device (simulators may not show notifications reliably)

**Database errors:**
- Clear app data and restart
- Check SQLite compatibility on device
- Verify write permissions in app directory

### Performance Tips

- Limit number of active geofences (iOS: 20 max, Android: 100 max)
- Use appropriate geofence radius (larger = less battery drain)
- Set reasonable reminder frequencies to avoid spam
- Regularly clean up old reminder events

## 🛠️ Development

### Building for Production

```bash
# Build for iOS
npx expo build:ios

# Build for Android  
npx expo build:android

# Or use EAS Build (recommended)
npx eas build --platform all
```

### Code Structure Guidelines

- **Services**: Keep business logic separate from UI
- **Components**: Create reusable, focused components
- **Types**: Define clear TypeScript interfaces
- **Error Handling**: Always handle async operation failures
- **Performance**: Use React.memo() for heavy components

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:

- Create an issue in the GitHub repository
- Check existing issues for similar problems
- Review the troubleshooting section above

---

**Built with ❤️ using Expo, React Native, and TypeScript**