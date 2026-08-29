# secrets/

Local-only signing material for the Android release build. **Nothing in here
is in git** — the repo root `.gitignore` ignores `secrets/*`, negating only
this README so the folder's purpose survives a fresh clone.

## Contents (after running the generator)

| File | What it is |
|---|---|
| `shikshapilot-upload.jks` | The Play **upload key**. Permanent and unrecoverable. |
| `key.properties` | The keystore path, alias and passwords, read by Gradle at build time. |

Generate them with:

```bash
./app/android/generate-upload-keystore.sh
```

## Two ways this folder gets lost

Being gitignored cuts both ways — git will not protect these files, and two
ordinary commands will destroy them without warning:

- **`git clean -xfd`** deletes ignored files. This is the usual way people lose
  a keystore.
- **Deleting and re-cloning the repo** takes the folder with it.

So this folder is *not* a backup. Put a copy of the `.jks` and its password in
the company password manager or vault, and treat what is here as a working
copy.

## If the key is lost anyway

Because the app is enrolled in Play App Signing, Google holds the real
distribution key and this is only the *upload* key — support can reset it and
you carry on. Without Play App Signing, losing it would mean never shipping an
update to existing installs again.
