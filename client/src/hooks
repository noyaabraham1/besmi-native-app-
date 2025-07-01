import { useState, useEffect } from 'react';
import { NativeBiometric, BiometricOptions } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

export interface BiometricCredentials {
  username: string;
  password: string;
}

export const useBiometricAuth = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    if (!isNative) {
      setIsAvailable(false);
      return;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      setIsAvailable(result.isAvailable);
      
      if (result.isAvailable) {
        setBiometricType(result.biometryType === 'FACE_ID' ? 'face' : 'fingerprint');
      }
    } catch (error) {
      console.warn('Biometric availability check failed:', error);
      setIsAvailable(false);
    }
  };

  const authenticate = async (reason?: string): Promise<BiometricAuthResult> => {
    if (!isNative || !isAvailable) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    try {
      const options: BiometricOptions = {
        reason: reason || 'Please authenticate to continue',
        title: 'Biometric Authentication',
        subtitle: 'Use your biometric to authenticate',
        description: 'Authenticate using your fingerprint or face ID'
      };

      await NativeBiometric.verifyIdentity(options);
      return { success: true };
    } catch (error: any) {
      console.warn('Biometric authentication failed:', error);
      return { 
        success: false, 
        error: error.message || 'Authentication failed'
      };
    }
  };

  const enableBiometricLogin = async (userId: string): Promise<boolean> => {
    if (!isNative || !isAvailable) return false;

    try {
      await NativeBiometric.setCredentials({
        username: userId,
        password: 'biometric_enabled',
        server: 'besmi.com'
      });
      return true;
    } catch (error) {
      console.warn('Failed to enable biometric login:', error);
      return false;
    }
  };

  const disableBiometricLogin = (): boolean => {
    if (!isNative) return false;

    try {
      NativeBiometric.deleteCredentials({
        server: 'besmi.com'
      });
      return true;
    } catch (error) {
      console.warn('Failed to disable biometric login:', error);
      return false;
    }
  };

  const isBiometricEnabled = (): boolean => {
    if (!isNative) return false;
    
    try {
      // Check if credentials exist in secure storage
      const hasCredentials = localStorage.getItem('biometric_credentials');
      return !!hasCredentials;
    } catch {
      return false;
    }
  };

  const getBiometricUserId = (): string | null => {
    if (!isNative) return null;
    
    try {
      const credentials = localStorage.getItem('biometric_credentials');
      if (credentials) {
        const parsed = JSON.parse(credentials);
        return parsed.email || null;
      }
    } catch {
      return null;
    }
    
    return null;
  };

  return {
    isAvailable,
    biometricType,
    authenticate,
    enableBiometricLogin,
    disableBiometricLogin,
    isBiometricEnabled,
    getBiometricUserId
  };
};
