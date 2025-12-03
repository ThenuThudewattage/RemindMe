import React from 'react';
import { Stack } from 'expo-router';

export default function RemindersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* List screen - this will show tabs */}
      <Stack.Screen 
        name="list" 
        options={{
          // This screen will show tabs since it's in the main tab navigator
        }}
      />
      
      {/* Edit screen - this will NOT show tabs (full screen modal) */}
      <Stack.Screen 
        name="edit" 
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      
      {/* Detail screen - this will NOT show tabs */}
      <Stack.Screen 
        name="detail" 
        options={{
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}