# 0036 Keyboard learning

## Context

Keyboards learn from what is typed to improve their suggestions, and can offer those words in other apps later. Journal notes, the check-in note and the custom reasons and plans hold intimate text: a word typed in flust could come back as a suggestion in a message.

## Decision

- On Android, every text field asks the keyboard not to learn what is typed in it: `modules/flust-privacy` adds `IME_FLAG_NO_PERSONALIZED_LEARNING` to the field's input options.
- The flag is added when a field takes focus, by a listener on the activity's view tree that `FlustPrivacyPackage` installs as the activity is created and removes when it is destroyed. React Native rewrites a field's input options whenever its return key changes, so a flag set once could be lost, and a field added later is covered without any change in JavaScript. The listener restarts the keyboard's input only when it adds the flag, once per focus.
- The flag applies in every variant, the development build included.
- iOS has no API that tells the system keyboard not to learn. flust does not work around it, for example by turning off autocorrection, which would make writing harder without stopping the learning. It is a known limitation in the [threat model](../security/threat-model.md).

## Consequences

- The flag is a request: keyboards may ignore it. Gboard honors it and shows its incognito icon on the field. Others may not, and nothing in flust can tell.
- Suggestions still work while typing in flust; the keyboard just does not keep what it saw.
