#!/bin/bash
# macOS CDP Setup for Antigravity
# Creates a launch wrapper — does NOT modify the app bundle (preserves code signing).

echo "=== Antigravity CDP Setup ==="
echo ""

IDE_NAME="Antigravity"

# Search for the app
APP_LOCATIONS=(
    "/Applications"
    "$HOME/Applications"
    "/Applications/Utilities"
)

app_path=""
for location in "${APP_LOCATIONS[@]}"; do
    if [ -d "$location" ]; then
        echo "Searching: $location"
        found=$(find "$location" -maxdepth 2 -name "*${IDE_NAME}*.app" -type d 2>/dev/null | head -n1)
        if [ -n "$found" ]; then
            app_path="$found"
            echo "Found: $app_path"
            break
        fi
    fi
done

if [ -z "$app_path" ]; then
    echo ""
    echo "ERROR: Antigravity.app not found in standard locations."
    echo "Please install Antigravity first."
    exit 1
fi

echo ""

# Create a Desktop launcher (.command file — double-click to launch)
wrapper_path="$HOME/Desktop/${IDE_NAME}-CDP.command"

# Write the launcher script
echo '#!/bin/bash' > "$wrapper_path"
echo "open -n -a \"$app_path\" --args --remote-debugging-port=9000" >> "$wrapper_path"
chmod +x "$wrapper_path"
echo "Created Desktop launcher: $wrapper_path"

# Add shell alias to .zshrc (default macOS shell)
shell_rc="$HOME/.zshrc"
alias_name=$(echo "$IDE_NAME" | tr '[:upper:]' '[:lower:]')-cdp

if [ -f "$shell_rc" ] && grep -q "$alias_name" "$shell_rc"; then
    echo "Shell alias '$alias_name' already exists in $shell_rc"
else
    echo "" >> "$shell_rc"
    echo "# Auto Accept — launch $IDE_NAME with CDP" >> "$shell_rc"
    echo "alias $alias_name='open -n -a \"$app_path\" --args --remote-debugging-port=9000'" >> "$shell_rc"
    echo "Added shell alias '$alias_name' to $shell_rc"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Launch Antigravity with CDP enabled using ONE of these methods:"
echo "  1. Double-click '${IDE_NAME}-CDP.command' on your Desktop"
echo "  2. Open a new Terminal and type: $alias_name"
echo "  3. Run: open -n -a \"Antigravity\" --args --remote-debugging-port=9000"
echo ""
echo "NOTE: The Dock icon launches WITHOUT CDP. Always use one of the methods above."