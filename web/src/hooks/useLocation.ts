import { useState } from 'react';
import { LocationInfo } from '../types';

interface UseLocationReturn {
  location: LocationInfo | null;
  isLoading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<LocationInfo | null>;
  getLocationFromPostalCode: (postalCode: string) => Promise<LocationInfo | null>;
}

export const useLocation = (): UseLocationReturn => {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current location using browser's geolocation API
  const getCurrentLocation = async (): Promise<LocationInfo | null> => {
    setIsLoading(true);
    setError(null);

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const errorMessage = 'Geolocation is not supported by your browser';
        setError(errorMessage);
        setIsLoading(false);
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const postalCode = await reverseGeocode(latitude, longitude);

            if (postalCode) {
              const locationInfo: LocationInfo = {
                postal_code: postalCode,
                latitude,
                longitude,
              };
              setLocation(locationInfo);
              setIsLoading(false);
              resolve(locationInfo);
            } else {
              const errorMessage = 'Could not determine postal code from your location';
              setError(errorMessage);
              setIsLoading(false);
              resolve(null);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
            setError(errorMessage);
            setIsLoading(false);
            resolve(null);
          }
        },
        (err) => {
          let errorMessage = 'Failed to get your location';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enter your postal code manually.';
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case err.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          setError(errorMessage);
          setIsLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  };

  // Get location from postal code (forward geocoding)
  const getLocationFromPostalCode = async (postalCode: string): Promise<LocationInfo | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Using Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&format=json&limit=1`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const locationInfo: LocationInfo = {
          postal_code: postalCode.toUpperCase().replace(/\s/g, ''),
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          city: result.display_name?.split(',')[0] || undefined,
        };
        setLocation(locationInfo);
        setIsLoading(false);
        return locationInfo;
      } else {
        const errorMessage = 'Postal code not found. Please check and try again.';
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate postal code';
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  // Helper function for reverse geocoding
  const reverseGeocode = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );

      if (!response.ok) {
        throw new Error('Failed to reverse geocode');
      }

      const data = await response.json();
      return data.address?.postcode || null;
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      return null;
    }
  };

  return {
    location,
    isLoading,
    error,
    getCurrentLocation,
    getLocationFromPostalCode,
  };
};