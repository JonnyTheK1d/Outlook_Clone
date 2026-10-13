#!/usr/bin/env bash
# Rootless, authenticated display tool for the Debian cloud workspace.
set -euo pipefail
task_tools=/workspace/.tools
mkdir -p "$task_tools/apt/lists/partial" "$task_tools/apt/cache/archives/partial" "$task_tools/apt/etc/parts" "$task_tools/downloads" "$task_tools/debian" "$task_tools/bin"
if [[ ! -x "$task_tools/debian/usr/bin/Xvfb" ]]; then
  cat > "$task_tools/apt/etc/sources.list" <<'EOF'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
EOF
  task_apt_options=(-o Dir::Etc::main=- -o "Dir::Etc::parts=$task_tools/apt/etc/parts" -o "Dir::Etc::sourcelist=$task_tools/apt/etc/sources.list" -o Dir::Etc::sourceparts=- -o "Dir::State::lists=$task_tools/apt/lists" -o "Dir::Cache=$task_tools/apt/cache")
  /usr/bin/apt-get "${task_apt_options[@]}" update
  (cd "$task_tools/downloads" && /usr/bin/apt-get "${task_apt_options[@]}" download xvfb)
  for task_package in "$task_tools/downloads/"xvfb_*.deb; do dpkg-deb -x "$task_package" "$task_tools/debian"; done
fi
"$task_tools/debian/usr/bin/Xvfb" -help >/dev/null 2>&1
