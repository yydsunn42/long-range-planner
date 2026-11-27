"""Build the local EventKit helper. No task data or calendar writes."""
from pathlib import Path
import plistlib
import subprocess
import os
import platform

src = Path(__file__).resolve().parent
app = src / 'LrpRemindersBridge.app'
contents = app / 'Contents'
binary = contents / 'MacOS' / 'LrpRemindersBridge'
binary.parent.mkdir(parents=True, exist_ok=True)
info = {
    'CFBundleIdentifier': 'local.long-range-planner.reminders-bridge',
    'CFBundleName': 'Long Range Planner 提醒事项连接',
    'CFBundleDisplayName': 'Long Range Planner 提醒事项连接',
    'CFBundleExecutable': binary.name,
    'CFBundlePackageType': 'APPL',
    'CFBundleVersion': '1',
    'CFBundleShortVersionString': '1.0',
    'LSMinimumSystemVersion': '14.0',
    'LSUIElement': True,
    'NSRemindersFullAccessUsageDescription': '将 Long Range Planner 有日期的任务与子任务同步到提醒事项和日历，并双向同步完成状态。不会导入其他待办。',
}
(contents / 'Info.plist').write_bytes(plistlib.dumps(info))
# The installed default SDK is newer than this machine's Swift 6.3 compiler.
sdk = os.environ.get('SDKROOT') or '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk'
if not Path(sdk).exists():
    sdk = subprocess.check_output(['xcrun', '--show-sdk-path'], text=True).strip()
subprocess.run(['xcrun', 'swiftc', '-swift-version', '6', '-O', '-sdk', sdk,
    '-target', f'{platform.machine()}-apple-macos14.0', '-module-cache-path', '/private/tmp/lrp-swift-module-cache',
    str(src / 'apple-reminders-bridge.swift'), '-o', str(binary)], check=True)
subprocess.run(['codesign', '--force', '--sign', '-', '--identifier', info['CFBundleIdentifier'], str(app)], check=True)
print(app)
