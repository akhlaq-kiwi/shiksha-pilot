/**
 * Turns every <img> inside a container into a base64 data: URL, so html2canvas
 * can rasterise it into a PDF.
 *
 * Why this is needed at all: html2canvas draws each image onto a <canvas> and
 * then reads the pixels back. A canvas that has had a cross-origin image drawn
 * onto it is "tainted" and reading it back throws, so html2canvas silently
 * drops the image. On local dev the photos are same-origin ("/uploads/...")
 * and nothing taints, which is why PDFs looked correct there; on QA/production
 * the photos come from S3 on a different origin with no CORS headers, so every
 * profile photo vanished from the download while the on-screen preview — which
 * never touches a canvas — stayed perfect.
 *
 * A data: URL has no origin, so it cannot taint the canvas. The bytes are
 * fetched through our own authenticated media proxy rather than straight from
 * S3, because a direct browser fetch of a bucket without CORS headers is
 * blocked before we ever see the response.
 */

const TOKEN_KEY = 'shiksha_pilot_token';

const isDataUrl = (url) => typeof url === 'string' && url.startsWith('data:');

const isSameOrigin = (url) => {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch (_) {
    return false;
  }
};

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

const responseToDataUrl = async (response) => {
  if (!response || !response.ok) return null;
  const blob = await response.blob();
  if (!blob || blob.size === 0) return null;
  return blobToDataUrl(blob);
};

/** Fetch through the backend proxy — the path that works regardless of bucket CORS. */
const fetchViaProxy = async (url) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api/common/media?url=${encodeURIComponent(url)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return responseToDataUrl(response);
};

const toDataUrl = async (url) => {
  // Same-origin images (local storage driver, bundled assets) need no proxy.
  if (isSameOrigin(url)) {
    try {
      const direct = await responseToDataUrl(await fetch(url, { credentials: 'same-origin' }));
      if (isDataUrl(direct)) return direct;
    } catch (_) {}
  }

  try {
    const proxied = await fetchViaProxy(url);
    if (isDataUrl(proxied)) return proxied;
  } catch (_) {}

  // Last resort: the bucket may actually send CORS headers, in which case a
  // plain cross-origin fetch succeeds on its own.
  try {
    const cors = await responseToDataUrl(await fetch(url, { mode: 'cors', credentials: 'omit' }));
    if (isDataUrl(cors)) return cors;
  } catch (_) {}

  return null;
};

/**
 * Swap every <img> in `container` for an inline data: URL.
 *
 * @param {HTMLElement} container
 * @returns {Promise<() => void>} restore function putting the original srcs back
 */
export const inlineContainerImages = async (container) => {
  if (!container) return () => {};

  const images = Array.from(container.querySelectorAll('img'));
  const originals = new Map();

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || isDataUrl(src)) return;

      let dataUrl = null;
      try {
        dataUrl = await toDataUrl(src);
      } catch (err) {
        console.warn('ID card: could not inline image', src, err);
      }
      if (!isDataUrl(dataUrl)) {
        console.warn('ID card: image will be missing from the PDF', src);
        return;
      }

      originals.set(img, src);
      img.src = dataUrl;

      // html2canvas clones the DOM and snapshots immediately. Without waiting
      // for the new src to decode, the clone can be rasterised while the
      // element is still empty — a blank photo despite a valid data URL.
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        } else {
          await new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
      } catch (_) {}
    })
  );

  return () => {
    originals.forEach((src, img) => {
      img.src = src;
    });
  };
};

export default inlineContainerImages;
