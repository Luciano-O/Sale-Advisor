#!/bin/sh
# Daily PostgreSQL dump into /backups (a host directory), keeping 7 days of files.
# Copy the directory off the VPS regularly; a backup on the same disk does not survive its loss.
set -eu

while true; do
  file="/backups/sale_advisor-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if pg_dump --format=custom --file="$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup.completed file=$(basename "$file") bytes=$(wc -c <"$file")"
  else
    rm -f "$file.partial"
    echo "backup.failed"
  fi
  find /backups -name 'sale_advisor-*.dump' -mtime +7 -delete
  sleep 86400
done
