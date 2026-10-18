import { Capacitor, registerPlugin } from '@capacitor/core';
import { download } from './storage';

interface TextExportPlugin {
  saveTextFile(options: { filename: string; content: string; mimeType: string }): Promise<{ saved: boolean }>;
}

const TextExport = registerPlugin<TextExportPlugin>('TextExport');

/** Android asks where to save and confirms the write; the web starts its usual download. */
export async function exportTextFile(filename: string, content: string, mimeType = 'text/markdown;charset=utf-8'): Promise<boolean> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const result = await TextExport.saveTextFile({ filename, content, mimeType });
    return result.saved === true;
  }
  download(filename, content, mimeType);
  return true;
}
