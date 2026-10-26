#!/bin/sh
# Prints the Apache include for one Enhance site.
# Usage: infra/vps/render-apache-include.sh <domain> <loopback-port> > /etc/apache2/vhost_includes/<domain>.conf
set -eu

domain="${1:?domain is required}"
port="${2:?port is required}"
case "$domain" in *[!a-zA-Z0-9.-]*) echo "invalid domain: $domain" >&2; exit 1 ;; esac
case "$port" in *[!0-9]*) echo "invalid port: $port" >&2; exit 1 ;; esac

# Doubled backslashes: the replacement below consumes one level of escaping.
domain_regex=$(printf '%s' "$domain" | sed 's/\./\\\\./g')
template="$(dirname "$0")/apache-include.conf.template"
sed -e "s/__DOMAIN_REGEX__/$domain_regex/g" -e "s/__DOMAIN__/$domain/g" -e "s/__PORT__/$port/g" "$template"
