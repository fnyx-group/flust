import { Share } from 'react-native';

// The share sheet is the only way the report leaves flust, and only when the person picks a
// destination. Plain text, so nothing is written to a shared file first.
export async function shareReport(text: string): Promise<boolean> {
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
