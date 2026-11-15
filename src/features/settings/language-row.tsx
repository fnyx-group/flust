import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { languageLabel } from '@/features/settings/labels';
import { DEVICE_LANGUAGE, supportedLanguages, type LanguagePreference } from '@/lib/i18n/language';
import { NavRow } from '@/ui/nav-row';
import { OptionSheet } from '@/ui/option-sheet';

type LanguageRowProps = {
  // Null while the stored choice is being read.
  preference: LanguagePreference | null;
  onChoose: (preference: LanguagePreference) => void;
};

const CHOICES: readonly LanguagePreference[] = [DEVICE_LANGUAGE, ...supportedLanguages];

export function LanguageRow({ preference, onChoose }: LanguageRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <NavRow
        label={t('settings.language')}
        value={preference === null ? undefined : languageLabel(t, preference)}
        accessibilityHint={t('settings.languageHint')}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        visible={open}
        title={t('settings.language')}
        closeLabel={t('onboarding.close')}
        options={CHOICES.map((choice) => ({ key: choice, label: languageLabel(t, choice) }))}
        selected={preference}
        onSelect={onChoose}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
