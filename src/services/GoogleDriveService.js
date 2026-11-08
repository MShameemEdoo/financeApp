// Google Drive REST API service
// Reads/writes a single JSON file: FinanceApp/finance-data.json
//
// React Native compatible — no Blob constructor, no FormData multipart.
// Uses simple upload (uploadType=media) for writes and a separate metadata
// PATCH so we avoid the Blob/FormData bugs that cause "Network request failed".

const DRIVE_API  = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME  = 'finance-data.json';
const FOLDER_NAME = 'FinanceApp';
const MIME_JSON  = 'application/json';

class GoogleDriveService {
  constructor() {
    this._fileId   = null;
    this._folderId = null;
  }

  // ── internal request helper ──────────────────────────────────────
  async _request(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      const e = new Error(`Drive ${options.method || 'GET'} ${res.status}: ${text}`);
      e.status = res.status;   // 401 = the access token has expired
      throw e;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  _authHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  // ── folder ───────────────────────────────────────────────────────
  async _getOrCreateFolder(token) {
    if (this._folderId) return this._folderId;

    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const list = await this._request(
      `${DRIVE_API}/files?q=${q}&fields=files(id,name)&orderBy=createdTime&spaces=drive`,
      { headers: this._authHeader(token) }
    );

    if (list.files?.length > 0) {
      this._folderId = list.files[0].id;
      return this._folderId;
    }

    const folder = await this._request(`${DRIVE_API}/files`, {
      method:  'POST',
      headers: { ...this._authHeader(token), 'Content-Type': MIME_JSON },
      body:    JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });

    this._folderId = folder.id;
    return this._folderId;
  }

  // ── file id lookup ───────────────────────────────────────────────
  async _getFileId(token) {
    if (this._fileId) return this._fileId;

    const folderId = await this._getOrCreateFolder(token);
    const q = encodeURIComponent(
      `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
    );
    const list = await this._request(
      `${DRIVE_API}/files?q=${q}&fields=files(id,name)&orderBy=createdTime&spaces=drive`,
      { headers: this._authHeader(token) }
    );

    if (list.files?.length > 0) {
      this._fileId = list.files[0].id;
    }
    return this._fileId; // null if not found yet
  }

  // ── public: load ─────────────────────────────────────────────────
  async loadData(token) {
    try {
      const fileId = await this._getFileId(token);
      if (!fileId) return null;

      const content = await this._request(
        `${DRIVE_API}/files/${fileId}?alt=media`,
        { headers: this._authHeader(token) }
      );

      if (typeof content === 'string') return JSON.parse(content);
      return content; // already parsed as JSON by _request
    } catch (e) {
      // Do NOT return null here: null means "no file yet". A failed read must not look like an
      // empty Drive, or a sync could overwrite good data. Let the caller see the error.
      console.warn('Drive loadData error:', e.message);
      throw e;
    }
  }

  // ── public: save ─────────────────────────────────────────────────
  // Uses two-step approach that works in React Native:
  //   Step 1 — upload raw JSON string with uploadType=media (no Blob, no FormData)
  //   Step 2 — if creating new file, set the parent folder via a metadata PATCH
  async saveData(token, data) {
    const jsonStr = JSON.stringify(
      { ...data, lastSynced: new Date().toISOString() },
      null, 2
    );

    const fileId = await this._getFileId(token);

    if (fileId) {
      // ── Update existing file — simple media upload ───────────────
      await this._request(
        `${UPLOAD_API}/files/${fileId}?uploadType=media`,
        {
          method:  'PATCH',
          headers: {
            ...this._authHeader(token),
            'Content-Type': MIME_JSON,
          },
          body: jsonStr,
        }
      );
    } else {
      // ── Create new file ──────────────────────────────────────────
      const folderId = await this._getOrCreateFolder(token);

      // Step 1: create file with metadata (name + parent)
      const created = await this._request(
        `${DRIVE_API}/files?fields=id`,
        {
          method:  'POST',
          headers: {
            ...this._authHeader(token),
            'Content-Type': MIME_JSON,
          },
          body: JSON.stringify({
            name:     FILE_NAME,
            mimeType: MIME_JSON,
            parents:  [folderId],
          }),
        }
      );

      this._fileId = created.id;

      // Step 2: upload the actual content
      await this._request(
        `${UPLOAD_API}/files/${this._fileId}?uploadType=media`,
        {
          method:  'PATCH',
          headers: {
            ...this._authHeader(token),
            'Content-Type': MIME_JSON,
          },
          body: jsonStr,
        }
      );
    }
  }

  // ── public: reset (on sign-out) ──────────────────────────────────
  reset() {
    this._fileId   = null;
    this._folderId = null;
  }
}

export default new GoogleDriveService();
