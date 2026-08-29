#!/usr/bin/env bash
#
# Generates the Play upload keystore and the matching key.properties.
#
# Run this yourself rather than letting a tool do it: the passwords are typed
# at the prompts below and never appear in a command line, a shell history, or
# anyone's logs.
#
#   ./app/android/generate-upload-keystore.sh
#
# Run once, ever. If a keystore already exists this script refuses to touch it
# — overwriting one means every future update to an already-published app is
# rejected by Play.

set -euo pipefail

# PKCS12 rather than JKS: JKS is a deprecated proprietary format and keytool
# nags about it on every use. Gradle detects the type from the file, so the
# conventional .jks filename is kept.
ALIAS="shikshapilot-upload"
KEYSTORE="${KEYSTORE_PATH:-$HOME/shikshapilot-upload.jks}"
ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPS="$ANDROID_DIR/key.properties"

if [ -e "$KEYSTORE" ]; then
  echo "A keystore already exists at $KEYSTORE"
  echo "Refusing to overwrite it. If you genuinely need a new one, move the old"
  echo "file aside first — and be certain nothing has been published with it."
  exit 1
fi

echo "Creating the Shiksha Pilot upload keystore."
echo "  keystore : $KEYSTORE"
echo "  alias    : $ALIAS"
echo

# One password for both the store and the key keeps the CI secrets simpler and
# loses nothing: anyone who can read the store can read the key regardless.
read -r -s -p "Choose a password (min 6 chars): " PASS; echo
read -r -s -p "Confirm password: " PASS2; echo
echo

if [ "$PASS" != "$PASS2" ]; then
  echo "Passwords do not match. Nothing was created."
  exit 1
fi
if [ ${#PASS} -lt 6 ]; then
  echo "Password must be at least 6 characters. Nothing was created."
  exit 1
fi

# keytool's :env form reads from the process environment, so this has to be
# exported rather than left as a plain shell variable. Passing it this way
# instead of as -storepass <literal> keeps the password out of `ps` output.
export KEYSTORE_PASS="$PASS"

# 10000 days ~ 27 years. Play requires a key valid well past 2033.
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -storetype PKCS12 \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias "$ALIAS" \
  -storepass:env KEYSTORE_PASS \
  -keypass:env KEYSTORE_PASS \
  -dname "CN=Shiksha Pilot, OU=Engineering, O=Shiksha Pilot, L=Lucknow, ST=Uttar Pradesh, C=IN"

chmod 600 "$KEYSTORE"

umask 077
cat > "$PROPS" <<EOF
storeFile=$KEYSTORE
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF
chmod 600 "$PROPS"

unset PASS PASS2 KEYSTORE_PASS

echo
echo "Created:"
echo "  $KEYSTORE   (chmod 600)"
echo "  $PROPS      (chmod 600, gitignored)"
echo
echo "To inspect the certificate:"
echo "  keytool -list -v -keystore \"$KEYSTORE\" -alias $ALIAS"
echo
echo "NEXT — back this file up before you do anything else."
echo "Put $KEYSTORE and its password in the company password manager or vault."
echo "It is not in git, and it cannot be regenerated. Losing it means Google has"
echo "to reset your upload key before you can ship another update."
