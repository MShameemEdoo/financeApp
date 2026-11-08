// App-wide configuration.
//
// GOOGLE_WEB_CLIENT_ID is the "Web application" OAuth client from Google Cloud Console.
// It is not a secret (it is visible in every web app that uses Google sign-in).
// The phone app and the web app share it, so they are the same "app" to Google Drive and
// can see the same finance-data.json file.
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '824630405894-7fq9idah6poku7jvta0ad1kelh7nq71d.apps.googleusercontent.com';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

// How often an open, signed-in app checks Drive for changes made on another device
export const SYNC_POLL_MS = 60 * 1000;
