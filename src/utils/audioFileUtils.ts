/**
 * Read a local file URI (file:// or content://) into a Blob.
 * Uses expo-file-system to avoid React Native fetch() issues with local URIs
 * (e.g. "Network request failed" when using fetch(uri) on Android).
 */
import * as FileSystem from 'expo-file-system';

export async function readFileUriToBlob(
  uri: string,
  mimeType: string = 'audio/wav'
): Promise<Blob> {
  if (uri == null || typeof uri !== 'string' || !uri) {
    throw new Error('readFileUriToBlob: uri is required');
  }
  const isLocal = uri.startsWith('file://') || uri.startsWith('content://');
  if (isLocal) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  const response = await fetch(uri);
  return response.blob();
}
