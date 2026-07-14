"""
WebMCP gcloud token native messaging host.
Spawned by Chrome when the extension calls chrome.runtime.sendNativeMessage.
Communicates via stdin/stdout using the Chrome native messaging protocol:
  4-byte little-endian length prefix + UTF-8 JSON body.
"""
import json
import os
import shutil
import struct
import subprocess
import sys


def read_message() -> dict | None:
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack('<I', raw)[0]
    body = sys.stdin.buffer.read(length)
    return json.loads(body.decode('utf-8'))


def write_message(msg: dict) -> None:
    body = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(body)))
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


def find_gcloud() -> str | None:
    # Try PATH first (covers most installs)
    for name in ('gcloud', 'gcloud.cmd'):
        path = shutil.which(name)
        if path:
            return path

    # Fall back to common Windows install locations
    candidates = []
    for base in (
        os.environ.get('LOCALAPPDATA', ''),
        os.environ.get('PROGRAMFILES', ''),
        os.environ.get('PROGRAMFILES(X86)', ''),
    ):
        if base:
            candidates.append(
                os.path.join(base, 'Google', 'Cloud SDK',
                             'google-cloud-sdk', 'bin', 'gcloud.cmd')
            )

    for path in candidates:
        if os.path.exists(path):
            return path

    return None


def get_token() -> tuple[str | None, str | None]:
    gcloud = find_gcloud()
    if not gcloud:
        return None, (
            'gcloud not found. Make sure Google Cloud SDK is installed '
            'and `gcloud auth login` has been run.'
        )
    try:
        result = subprocess.run(
            [gcloud, 'auth', 'print-access-token'],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            return result.stdout.strip(), None
        return None, (result.stderr.strip() or 'gcloud returned a non-zero exit code')
    except subprocess.TimeoutExpired:
        return None, 'gcloud timed out after 15 seconds'
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def main() -> None:
    while True:
        msg = read_message()
        if msg is None:
            break
        if msg.get('type') == 'get_token':
            token, error = get_token()
            if token:
                write_message({'token': token})
            else:
                write_message({'error': error})


if __name__ == '__main__':
    main()
