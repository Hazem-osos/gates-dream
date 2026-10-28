#!/bin/bash
# Test wrapper: forwards to the disposable container's real sqlcmd; -i <host file> is copied in first.
args=(); tmp=""
while [ $# -gt 0 ]; do
  case "$1" in
    -S) args+=("-S" "localhost"); shift 2 ;;
    -i) tmp="/tmp/q_$$.sql"; docker cp "$2" gates_mig_synthetic_mssql:$tmp >/dev/null; docker exec -u root gates_mig_synthetic_mssql chmod 644 $tmp; args+=("-i" "$tmp"); shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
docker exec -e SQLCMDPASSWORD="$SQLCMDPASSWORD" gates_mig_synthetic_mssql /opt/mssql-tools18/bin/sqlcmd -C "${args[@]}"; rc=$?
[ -n "$tmp" ] && docker exec -u root gates_mig_synthetic_mssql rm -f $tmp
exit $rc
