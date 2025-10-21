/**
 * Get user's postal code using browser geolocation and geocoding API
 */
export const getPostalCodeFromLocation = async (): Promise<string> => {
  // Check if geolocation is available
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  try {
    // Get current position with timeout
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
        });
      }
    );

    const { latitude, longitude } = position.coords;

    // Use Nominatim (OpenStreetMap) for reverse geocoding (free, no API key required)
    const geocodingUrl = `${
      import.meta.env.VITE_GEOCODING_API_URL
    }?lat=${latitude}&lon=${longitude}&format=json`;

    const response = await fetch(geocodingUrl, {
      headers: {
        'User-Agent': 'Smart Grocery Saver',
      },
    });

    if (!response.ok) {
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();

    // Extract postal code from response
    const postalCode = data.address?.postcode || data.address?.postal_code;

    if (!postalCode) {
      throw new Error('Unable to determine postal code from location');
    }

    // Remove spaces from postal code
    return postalCode.replace(/\s/g, '');
  } catch (error) {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          throw new Error('Location permission denied');
        case error.POSITION_UNAVAILABLE:
          throw new Error('Location unavailable');
        case error.TIMEOUT:
          throw new Error('Location request timed out');
        default:
          throw new Error('Failed to get location');
      }
    }
    throw error;
  }
};
