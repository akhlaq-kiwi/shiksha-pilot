/**
 * Resolves a stored file reference to a URL the browser can load.
 *
 * Uploads live on S3 and come back as absolute URLs, which are used as-is.
 * Files uploaded before the move to S3 (and anything stored while the local
 * storage driver is active) are relative "/uploads/..." paths — those stay
 * relative so they resolve against the current origin, which the dev server
 * proxies to the API and production serves directly.
 *
 * @param {string} path - Stored value, e.g. from photo_path or attachment_path
 * @returns {string} A loadable URL, or '' when there is nothing to load
 */
export function resolveFileUrl(path) {
  const value = (path ?? '').toString().trim();
  if (!value) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return value.startsWith('/') ? value : `/${value}`;
}

export default resolveFileUrl;
