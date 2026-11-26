# Reads `aapt2 dump xmltree --file AndroidManifest.xml` and prints the value of the attribute
# `attribute` of the service named `service`, both given with -v. Prints nothing when the service or
# its attribute is missing. A string prints as it is; a flag, such as foregroundServiceType, prints
# as aapt2 shows it: 0x00000400 for systemExempted.
function flush() {
  if (inside && name == service && found) print found
  inside = 0; name = ""; found = ""
}
function value(line, key) {
  sub(".*:" key "\\(0x[0-9a-f]+\\)=", "", line)
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
/^ *E: service / { inside = 1; depth = indent; next }
inside && indent == depth + 2 && /:name\(0x01010003\)=/ { name = value($0, "name") }
inside && indent == depth + 2 && $0 ~ (":" attribute "\\(0x[0-9a-f]+\\)=") { found = value($0, attribute) }
END { flush() }
