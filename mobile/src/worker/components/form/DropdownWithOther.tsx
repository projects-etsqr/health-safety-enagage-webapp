import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Dropdown, type DropdownOption } from './Dropdown';
import { TextArea } from './TextArea';

/**
 * A dropdown whose last option is "Other", revealing a box to type the thing
 * the list did not offer.
 *
 * Every fixed list on a safety form is wrong eventually — the hazard nobody
 * catalogued, the corner of the yard that is not a working station. Without a
 * way out the reporter picks the nearest wrong option, and the record is worse
 * than if they had been allowed to say what they meant.
 *
 * The caller keeps two pieces of state: the selection, and the typed text. When
 * the selection is OTHER the text is what matters and the caller sends it in
 * whichever field takes free text; otherwise the selection is sent and the text
 * is ignored. Keeping them apart means switching to Other and back does not
 * destroy what was typed.
 */

/** Sentinel for the selection. Prefixed and suffixed so it cannot collide with
 *  a real option value — station ids and hazard ids are plain numbers. */
export const OTHER_VALUE = '__other__';

interface Props {
  options: DropdownOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  otherText: string;
  onOtherTextChange: (text: string) => void;
  placeholder?: string;
  /** Wording for the free-text box. Say what is wanted, not "please specify". */
  otherPlaceholder?: string;
  otherLabel?: string;
  error?: string;
}

export function DropdownWithOther({
  options,
  value,
  onChange,
  otherText,
  onOtherTextChange,
  placeholder,
  otherPlaceholder = 'Describe it in your own words...',
  otherLabel = 'Other (not listed)',
  error,
}: Props) {
  const normalised: DropdownOption[] = options.map(o =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );

  return (
    <View>
      <Dropdown
        options={[...normalised, { label: otherLabel, value: OTHER_VALUE }]}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {value === OTHER_VALUE && (
        <View style={styles.otherBox}>
          <TextArea
            placeholder={otherPlaceholder}
            value={otherText}
            onChangeText={onOtherTextChange}
            minHeight={72}
            maxLength={255}
            error={error}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  otherBox: { marginTop: 8 },
});
