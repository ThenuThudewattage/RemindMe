# Alarm Sounds

Place your alarm sound files in this directory.

## Default Alarm Sound

You need to add an alarm sound file named `alarm.mp3` (or other supported format) to this directory.

## Supported Formats
- MP3
- WAV
- M4A
- AAC

## Recommendations
- Use a loud, attention-grabbing sound
- Duration: 3-10 seconds (will loop)
- Sample rate: 44.1kHz or 48kHz
- Bit rate: 128-320 kbps for MP3

## Free Alarm Sound Resources
- Freesound.org
- Zapsplat.com
- SoundBible.com

## Usage in Code

```typescript
// In alarm.ts service
const soundUri = require('../../assets/sounds/alarm.mp3');
```

## Note for Developers
Until you add an actual alarm sound file, the app will fall back to system vibration only.
