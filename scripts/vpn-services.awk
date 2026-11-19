# Reads `aapt2 dump xmltree --file AndroidManifest.xml` and prints the name of every service that
# can act as a VPN: one protected by BIND_VPN_SERVICE, or one with an android.net.VpnService
# action. A permission or an action given as a resource reference prints as `@0x7f…` and is not
# resolved: it counts as a VPN, so that the check fails rather than miss one.
function flush() {
  if (inside && vpn) print name
  inside = 0; vpn = 0; name = ""; action = -1
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
/^ *E: service / { inside = 1; depth = indent; next }
inside && indent == depth + 2 && /:name\(0x01010003\)=/ { name = value($0, "name\\(0x01010003\\)") }
inside && indent == depth + 2 && /:permission\(0x01010006\)=("android\.permission\.BIND_VPN_SERVICE"|@)/ { vpn = 1 }
inside && /^ *E: action / { action = indent }
inside && indent > depth + 2 && indent == action + 2 && /:name\(0x01010003\)=("android\.net\.VpnService"|@)/ { vpn = 1 }
END { flush() }
