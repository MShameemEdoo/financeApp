// Safe wrapper around @react-native-google-signin/google-signin.
//
// That package is a native module: it does NOT exist inside Expo Go, and
// importing it there crashes the whole app at startup ("RNGoogleSignin could
// not be found"). Loading it inside try/catch lets the app run in Expo Go in
// local-only mode, while dev builds / production builds get real Google sign-in.

let mod = null;
try {
  // eslint-disable-next-line global-require
  mod = require('@react-native-google-signin/google-signin');
} catch (e) {
  console.warn('Google Sign-In native module unavailable (Expo Go?). Running in local-only mode.');
}

export const googleAvailable = !!mod?.GoogleSignin;

const unavailable = () => Promise.reject(new Error('Google Sign-In is not available in this build.'));

// No-op stand-in so callers never have to null-check
const stub = {
  configure: () => {},
  hasPlayServices: unavailable,
  signIn: unavailable,
  signInSilently: unavailable,
  getTokens: unavailable,
  signOut: () => Promise.resolve(),
};

export const GoogleSignin       = mod?.GoogleSignin ?? stub;
export const statusCodes        = mod?.statusCodes ?? {};
export const isSuccessResponse  = mod?.isSuccessResponse ?? (() => false);
