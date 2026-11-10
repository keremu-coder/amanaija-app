#!/bin/sh
# Adds the iPhone permission text and the push setting after Capacitor creates the project.
# Does not sign or submit the app.
set -e
PLIST="ios/App/App/Info.plist"
ENT="ios/App/App/App.entitlements"
PBX="ios/App/App.xcodeproj/project.pbxproj"
test -f "$PLIST"

add() {
  /usr/libexec/PlistBuddy -c "Add $1 $2 $3" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set $1 $3" "$PLIST"
}
add ":NSLocationWhenInUseUsageDescription" string "AmaNaija uses your location while the app is open to show shops and neighbours near you."
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string remote-notification" "$PLIST" 2>/dev/null || true

cat > "$ENT" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>aps-environment</key>
  <string>development</string>
</dict>
</plist>
EOF

if ! grep -q "CODE_SIGN_ENTITLEMENTS" "$PBX"; then
  perl -i -pe 's/(CODE_SIGN_STYLE = Automatic;)/$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/' "$PBX"
fi
