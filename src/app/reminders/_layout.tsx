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
      
      {/* Edit screen - this will NOT show tabs */}
      <Stack.Screen 
        name="edit" 
        options={{
          presentation: 'modal', // Optional: makes it feel more like a modal
        }}
      />
      
      {/* Detail screen - this will NOT show tabs */}
      <Stack.Screen 
        name="detail" 
        options={{
          // Standard screen without tabs
        }}
      />
    </Stack>
  );
}