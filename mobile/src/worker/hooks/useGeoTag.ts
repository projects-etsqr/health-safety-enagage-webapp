import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface GeoTag {
  gps_latitude?: number;
  gps_longitude?: number;
}

let configured = false;

function configureOnce() {
  if (configured) return;
  configured = true;
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto',
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location for safety records',
        message:
          'HSE records are tagged with where they were captured so a report can be traced ' +
          'back to the exact place of work.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Auto-captures the GPS fix every HSE record is specced to carry
 * ("GPS Capture — lat/long on all records", Layer 1 of the mobile shell).
 *
 * Resolves to an empty tag rather than throwing when permission is refused or
 * no fix is available. A report without coordinates is still worth far more
 * than a report the worker could not file, so location never blocks a submit.
 */
export function useGeoTag(): { geo: GeoTag; refresh: () => void; isLocating: boolean } {
  const [geo, setGeo] = useState<GeoTag>({});
  const [isLocating, setIsLocating] = useState(false);

  const refresh = useCallback(() => {
    configureOnce();
    setIsLocating(true);

    ensurePermission().then(ok => {
      if (!ok) {
        setGeo({});
        setIsLocating(false);
        return;
      }

      Geolocation.getCurrentPosition(
        pos => {
          setGeo({
            gps_latitude: pos?.coords?.latitude,
            gps_longitude: pos?.coords?.longitude,
          });
          setIsLocating(false);
        },
        () => {
          setGeo({});
          setIsLocating(false);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { geo, refresh, isLocating };
}
