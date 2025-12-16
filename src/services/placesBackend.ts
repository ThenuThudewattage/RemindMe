import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from '../config/firebase';

// Types for Google Places API responses
interface PlacesPrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlacesAutocompleteResponse {
  predictions: PlacesPrediction[];
  status: string;
}

interface PlaceGeometry {
  location: {
    lat: number;
    lng: number;
  };
}

interface PlaceDetailsResponse {
  result: {
    geometry: PlaceGeometry;
    name: string;
    formatted_address: string;
    place_id: string;
  };
  status: string;
}

// Service for calling Firebase Cloud Functions
class PlacesBackendService {
  private static instance: PlacesBackendService;
  
  private constructor() {}
  
  public static getInstance(): PlacesBackendService {
    if (!PlacesBackendService.instance) {
      PlacesBackendService.instance = new PlacesBackendService();
    }
    return PlacesBackendService.instance;
  }

  /**
   * Search for places using Google Places Autocomplete
   * @param input - The search query string
   * @param sessionToken - Session token for billing optimization
   * @returns Places predictions
   */
  public async searchPlaces(
    input: string,
    sessionToken: string
  ): Promise<PlacesAutocompleteResponse> {
    try {
      const placesAutocomplete = httpsCallable<
        { input: string; sessionToken: string },
        PlacesAutocompleteResponse
      >(functions, 'placesAutocomplete');

      const result: HttpsCallableResult<PlacesAutocompleteResponse> = await placesAutocomplete({
        input,
        sessionToken,
      });

      return result.data;
    } catch (error) {
      console.error('Places autocomplete error:', error);
      throw new Error('Failed to search places. Please try again.');
    }
  }

  /**
   * Get detailed information about a specific place
   * @param placeId - The Google Place ID
   * @param sessionToken - Session token for billing optimization
   * @returns Place details with geometry
   */
  public async getPlaceDetails(
    placeId: string,
    sessionToken: string
  ): Promise<PlaceDetailsResponse> {
    try {
      const placeDetails = httpsCallable<
        { placeId: string; sessionToken: string },
        PlaceDetailsResponse
      >(functions, 'placeDetails');

      const result: HttpsCallableResult<PlaceDetailsResponse> = await placeDetails({
        placeId,
        sessionToken,
      });

      return result.data;
    } catch (error) {
      console.error('Place details error:', error);
      throw new Error('Failed to get place details. Please try again.');
    }
  }

  /**
   * Check if Firebase is properly configured
   * @returns true if Firebase is configured with valid project ID
   */
  public isConfigured(): boolean {
    const config = functions.app.options;
    return config.projectId !== undefined && 
           config.projectId !== 'YOUR_PROJECT_ID' &&
           config.projectId !== '';
  }
}

export default PlacesBackendService;
