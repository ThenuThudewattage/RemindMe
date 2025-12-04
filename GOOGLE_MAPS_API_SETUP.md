# Google Maps API Setup for Location Search

## Overview
The location search feature uses Google Places Autocomplete API to provide real-time location suggestions as you type, just like Google Maps.

## ⚠️ API Key Required
To use the location search feature, you need a Google Maps API key with the Places API enabled.

## Step-by-Step Setup

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (required for search autocomplete)
   - **Geocoding API** (optional, for address lookups)
   - **Maps SDK for Android** (if building for Android)
   - **Maps SDK for iOS** (if building for iOS)

4. Go to **APIs & Services** > **Credentials**
5. Click **+ CREATE CREDENTIALS** > **API key**
6. Copy your new API key

### 2. Restrict Your API Key (Important for Security)

1. Click on your API key to edit it
2. Under **Application restrictions**:
   - For development: Select "None"
   - For production: Select "iOS apps" or "Android apps" and add your bundle ID/package name

3. Under **API restrictions**:
   - Select "Restrict key"
   - Check the APIs you enabled above

4. Click **Save**

### 3. Add API Key to Your App

Open `/src/features/geofencing/MapPicker.tsx` and replace:

```typescript
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
```

With your actual API key:

```typescript
const GOOGLE_MAPS_API_KEY = 'AIzaSyC4R6AN7SmujjPUIGKdgDg3fcb4m0AYgR7';  // Example key
```

### 4. For iOS: Add API Key to Info.plist (if using native maps)

If you're using Google Maps instead of Apple Maps on iOS, add to `ios/RemindMe/Info.plist`:

```xml
<key>GMSApiKey</key>
<string>YOUR_GOOGLE_MAPS_API_KEY</string>
```

### 5. For Android: Add API Key to AndroidManifest.xml (if using native maps)

Add to `android/app/src/main/AndroidManifest.xml` inside `<application>` tag:

```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

## 🎯 Features You Get

### Real-time Autocomplete
- Type any address, place name, or business
- Instant suggestions appear as you type
- Powered by Google's comprehensive location database

### What You Can Search
- **Addresses**: "123 Main Street, New York"
- **Places**: "Central Park", "Eiffel Tower"
- **Businesses**: "Starbucks", "Walmart"
- **Landmarks**: "Golden Gate Bridge", "Times Square"
- **Cities/Regions**: "San Francisco", "Manhattan"
- **Postal Codes**: "94102", "10001"

### How It Works
1. Start typing in the search bar overlay on the map
2. Suggestions appear in real-time below
3. Tap any suggestion
4. Map animates to the location
5. Marker is placed automatically
6. Location label is set from the place name

## 💰 Pricing

Google Maps Platform offers:
- **$200 free credit per month**
- Places Autocomplete: $2.83 per 1,000 requests (first tier)
- Most personal apps stay within free tier

Calculate costs: [Google Maps Pricing](https://mapsplatform.google.com/pricing/)

## 🔒 Security Best Practices

### DO:
✅ Restrict API key to specific apps (bundle ID/package name)
✅ Restrict to only needed APIs
✅ Monitor usage in Google Cloud Console
✅ Use different keys for development and production
✅ Rotate keys periodically

### DON'T:
❌ Commit API keys to public repositories
❌ Share API keys publicly
❌ Use unrestricted keys in production
❌ Leave unused APIs enabled

## 🚫 Without API Key

If you don't add an API key, the search feature will:
- Still show the search bar
- Display an error when you try to search
- Allow manual pin placement (long-press on map)
- Work for all other features except search

## 🆓 Alternative: Use Basic Search (No API Key)

If you prefer not to use Google Places API, the app falls back to:
- Manual pin placement by long-pressing the map
- Dragging markers to adjust position
- Current location button
- Address lookup via device's geocoding (limited)

## 📱 Testing

### Test Search Works:
1. Open "Wake Me There" or location-based reminder
2. Type "Starbucks" in search bar
3. Should see list of nearby Starbucks locations
4. Tap one to select it

### If Search Doesn't Work:
- Check API key is correct
- Verify Places API is enabled in Google Cloud Console
- Check internet connection
- Look for errors in development console
- Verify API key restrictions allow your app

## 🐛 Troubleshooting

### "This API project is not authorized to use this API"
- Go to Google Cloud Console
- Enable Places API for your project
- Wait a few minutes for propagation

### "API key not valid"
- Double-check the key is copied correctly
- Ensure no extra spaces or quotes
- Verify key restrictions allow your app

### No suggestions appearing
- Check internet connection
- Verify API key is set
- Try a common search term like "McDonald's"
- Check Google Cloud Console for API usage/errors

### "You have exceeded your request quota for this API"
- Check usage in Google Cloud Console
- Either add billing information or wait for quota reset
- Consider optimizing number of search requests

## 📚 Resources

- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Get API Key](https://console.cloud.google.com/apis/credentials)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)

## 🎉 Once Set Up

After adding your API key:
1. Restart the Expo development server
2. Reload your app
3. Try searching for a location
4. Enjoy Google Maps-quality search! 🗺️
