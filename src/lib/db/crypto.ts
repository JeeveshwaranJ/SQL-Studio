/**
 * Encrypts raw text using AES-GCM with a key derived from a SHA-256 hash of a passphrase.
 * Returns a Base64-encoded string combining the 12-byte IV and the ciphertext.
 */
export async function encryptData(text: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Hash the passphrase using SHA-256 to generate 256 bits of key material
  const passwordBuffer = encoder.encode(passphrase);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);

  const key = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  // Combine IV and ciphertext into a single byte stream for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Convert binary byte stream to Base64 string
  return btoa(String.fromCharCode(...Array.from(combined)));
}

/**
 * Decrypts a Base64-encoded string containing an IV and ciphertext using a key
 * derived from a SHA-256 hash of a passphrase.
 */
export async function decryptData(encryptedBase64: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();

  // Convert Base64 back to binary byte stream
  const combined = new Uint8Array(
    atob(encryptedBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const passwordBuffer = encoder.encode(passphrase);
  const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);

  const key = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
