import { useTranslation } from 'react-i18next';

import { ConfirmSheet } from '@/ui/confirm-sheet';

type FilterDisclosureSheetProps = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

// Google Play's prominent disclosure, shown before Android's VPN dialog. Declining is the safe
// choice, so it comes first, as in every sheet.
export function FilterDisclosureSheet({
  visible,
  onAccept,
  onDecline,
}: FilterDisclosureSheetProps) {
  const { t } = useTranslation();
  return (
    <ConfirmSheet
      visible={visible}
      title={t('filter.disclosure.title')}
      message={t('filter.disclosure.text')}
      confirmLabel={t('filter.disclosure.accept')}
      cancelLabel={t('filter.disclosure.later')}
      onConfirm={onAccept}
      onCancel={onDecline}
    />
  );
}
