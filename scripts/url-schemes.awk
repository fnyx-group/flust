# Reads `aapt2 dump xmltree --file AndroidManifest.xml` and prints the schemes of the intent
# filters that open URLs: a VIEW action with a data scheme. The <queries> entry that lets flust
# open web links is an <intent>, not an <intent-filter>, so it is not one.
# A value given as a resource reference prints as `@0x7f…`, without quotes, and is not resolved:
# such a scheme is printed as the reference, and such an action counts as VIEW, so that the check
# fails rather than miss one.
function flush(  i) {
  if (inside && view) for (i = 1; i <= count; i++) print schemes[i]
  inside = 0; view = 0; count = 0
}
function value(line, attribute) {
  sub(".*:" attribute "=", "", line)
  if (line ~ /^"/) {
    sub(/^"/, "", line)
    sub(/".*/, "", line)
  } else {
    sub(/ .*/, "", line)
  }
  return line
}
{ match($0, /^ */); indent = RLENGTH }
inside && indent <= depth { flush() }
/^ *E: intent-filter / { inside = 1; depth = indent; next }
inside && /:name\(0x01010003\)=("android\.intent\.action\.VIEW"|@)/ { view = 1 }
inside && /:scheme\(0x01010027\)=/ { schemes[++count] = value($0, "scheme\\(0x01010027\\)") }
END { flush() }
