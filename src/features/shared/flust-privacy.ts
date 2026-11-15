import { requireOptionalNativeModule } from 'expo';

// modules/flust-privacy. setSecure exists on Android only. Null where the module is missing, such
// as on the web.
type FlustPrivacy = {
  elapsedMs(): number;
  setSecure?(on: boolean): Promise<void>;
};

export const flustPrivacy = requireOptionalNativeModule<FlustPrivacy>('FlustPrivacy');
