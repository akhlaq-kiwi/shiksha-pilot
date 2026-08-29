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
ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ANDROID_DIR/../.." && pwd)"

# Both live in the gitignored secrets/ folder at the repo root. Gradle reads
# android/key.properties, so that stays where it is and simply points at the
# keystore next door.
SECRETS_DIR="${SECRETS_DIR:-$REPO_ROOT/secrets}"
KEYSTORE="${KEYSTORE_PATH:-$SECRETS_DIR/shikshapilot-upload.jks}"
PROPS="$ANDROID_DIR/key.properties"
SECRETS_PROPS="$SECRETS_DIR/key.properties"

if [ -e "$KEYSTORE" ]; then
  echo "A keystore already exists at $KEYSTORE"
  echo "Refusing to overwrite it. If you genuinely need a new one, move the old"
  echo "file aside first — and be certain nothing has been published with it."
  exit 1
fi

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

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
write_props() {
  cat > "$1" <<EOF
storeFile=$KEYSTORE
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF
  chmod 600 "$1"
}

# Gradle reads android/key.properties; the copy in secrets/ keeps the password
# alongside the keystore it belongs to, which is what gets backed up.
write_props "$PROPS"
write_props "$SECRETS_PROPS"

unset PASS PASS2 KEYSTORE_PASS

echo
echo "Created:"
echo "  $KEYSTORE        (chmod 600, gitignored)"
echo "  $SECRETS_PROPS   (chmod 600, gitignored)"
echo "  $PROPS           (chmod 600, gitignored — this is the one Gradle reads)"
echo
echo "To inspect the certificate:"
echo "  keytool -list -v -keystore \"$KEYSTORE\" -alias $ALIAS"
echo
echo "NEXT — back these up before you do anything else."
echo "Copy the keystore and its password into the company password manager or"
echo "vault. secrets/ is gitignored, which also means git will not protect it:"
echo "'git clean -xfd' deletes ignored files, and re-cloning the repo loses the"
echo "folder entirely. Treat what is on disk as a working copy, not a backup."
