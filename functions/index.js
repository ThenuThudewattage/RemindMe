const {onCall, HttpsError} = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Google Places Autocomplete Cloud Function
 *
 * This function acts as a secure proxy between your mobile app and Google Places API.
 * Benefits:
 * - API key stored securely in Firebase (never exposed in client)
 * - Rate limiting per user
 * - Usage tracking and analytics
 * - Error handling and logging
 *
 * Set your Google Maps API Key:
 * firebase functions:config:set google.maps_key="YOUR_API_KEY"
 */
exports.placesAutocomplete = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to search places",
    );
  }

  const userId = request.auth.uid;
  const {input, sessionToken} = request.data;

  // 2. Input validation
  if (!input || typeof input !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Search input is required and must be a string",
    );
  }

  if (input.length < 2) {
    throw new HttpsError(
        "invalid-argument",
        "Search input must be at least 2 characters",
    );
  }

  try {
    // 3. Rate limiting (10 requests per minute per user) - OPTIONAL
    try {
      const rateLimitRef = admin.firestore()
          .collection("rateLimits")
          .doc(userId);

      const rateLimitDoc = await rateLimitRef.get();
      const now = Date.now();

      if (rateLimitDoc.exists) {
        const {count, resetAt} = rateLimitDoc.data();

        // Check if within rate limit window
        if (now < resetAt) {
          if (count >= 10) {
            throw new HttpsError(
                "resource-exhausted",
                "Rate limit exceeded. Maximum 10 requests per minute. " +
                "Please try again later.",
            );
          }
          // Increment counter
          await rateLimitRef.update({
            count: admin.firestore.FieldValue.increment(1),
          });
        } else {
          // Reset window
          await rateLimitRef.set({
            count: 1,
            resetAt: now + 60000, // 1 minute from now
          });
        }
      } else {
        // First request
        await rateLimitRef.set({
          count: 1,
          resetAt: now + 60000,
        });
      }
    } catch (firestoreError) {
      // Firestore is disabled, skip rate limiting
      console.warn("Firestore unavailable, skipping rate limiting:", firestoreError.message);
    }

    // 4. Call Google Places API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_key;

    if (!apiKey) {
      console.error("Google Maps API key missing");
      throw new HttpsError(
          "failed-precondition",
          "Google Maps API key not configured. " +
          "Run: firebase functions:config:set google.maps_key=YOUR_KEY",
      );
    }

    const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json",
        {
          params: {
            input,
            key: apiKey,
            sessiontoken: sessionToken || undefined,
          },
          timeout: 10000, // 10 second timeout
        },
    );

    // 5. Log usage for analytics - OPTIONAL
    try {
      await admin.firestore().collection("apiUsage").add({
        userId,
        endpoint: "placesAutocomplete",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        input: input.substring(0, 50), // Only log first 50 chars for privacy
        resultsCount: response.data.predictions?.length || 0,
      });
    } catch (firestoreError) {
      // Firestore is disabled, skip usage logging
      console.warn("Firestore unavailable, skipping usage logging:", firestoreError.message);
    }

    // 6. Return results
    return response.data;
  } catch (error) {
    // Log error for debugging
    console.error("Places autocomplete error:", {
      userId,
      input: input.substring(0, 50),
      error: error.message,
      stack: error.stack,
      details: error.response?.data || "No response data",
    });

    // Re-throw HttpsError (handled by Firebase)
    if (error instanceof HttpsError || error.code === "failed-precondition") {
      throw error;
    }

    // Handle API errors
    if (error.response) {
      throw new HttpsError(
          "internal",
          `Google Places API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
      );
    }

    // Handle network errors
    throw new HttpsError(
        "internal",
        `Failed to fetch places: ${error.message}`,
    );
  }
});

/**
 * Google Place Details Cloud Function
 *
 * Fetches detailed information about a specific place.
 * Used after user selects a place from autocomplete results.
 */
exports.placeDetails = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to get place details",
    );
  }

  const userId = request.auth.uid;
  const {placeId, sessionToken} = request.data;

  // 2. Input validation
  if (!placeId || typeof placeId !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Place ID is required and must be a string",
    );
  }

  try {
    // 3. Rate limiting (same as autocomplete) - OPTIONAL
    try {
      const rateLimitRef = admin.firestore()
          .collection("rateLimits")
          .doc(userId);

      const rateLimitDoc = await rateLimitRef.get();
      const now = Date.now();

      if (rateLimitDoc.exists) {
        const {count, resetAt} = rateLimitDoc.data();

        if (now < resetAt) {
          if (count >= 10) {
            throw new HttpsError(
                "resource-exhausted",
                "Rate limit exceeded. Maximum 10 requests per minute.",
            );
          }
          await rateLimitRef.update({
            count: admin.firestore.FieldValue.increment(1),
          });
        } else {
          await rateLimitRef.set({
            count: 1,
            resetAt: now + 60000,
          });
        }
      } else {
        await rateLimitRef.set({
          count: 1,
          resetAt: now + 60000,
        });
      }
    } catch (firestoreError) {
      // Firestore is disabled, skip rate limiting
      console.warn("Firestore unavailable, skipping rate limiting:", firestoreError.message);
    }

    // 4. Call Google Places API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || functions.config().google?.maps_key;

    if (!apiKey) {
      console.error("Google Maps API key missing");
      throw new HttpsError(
          "failed-precondition",
          "Google Maps API key not configured. " +
          "Run: firebase functions:config:set google.maps_key=YOUR_KEY",
      );
    }

    const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
          params: {
            place_id: placeId,
            key: apiKey,
            sessiontoken: sessionToken || undefined,
            fields: "geometry,name,formatted_address,place_id",
          },
          timeout: 10000,
        },
    );

    // 5. Log usage - OPTIONAL
    try {
      await admin.firestore().collection("apiUsage").add({
        userId,
        endpoint: "placeDetails",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        placeId,
      });
    } catch (firestoreError) {
      // Firestore is disabled, skip usage logging
      console.warn("Firestore unavailable, skipping usage logging:", firestoreError.message);
    }

    // 6. Return results
    return response.data;
  } catch (error) {
    console.error("Place details error:", {
      userId,
      placeId,
      error: error.message,
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    if (error.response) {
      throw new HttpsError(
          "internal",
          `Google Places API error: ${error.response.status}`,
      );
    }

    throw new HttpsError(
        "internal",
        "Failed to fetch place details. Please try again.",
    );
  }
});
