
[ "$SERVICE" ] || { echo "\$SERVICE not set"; exit 1; }
CMD="./luajit $SERVICE.lua"
PID=$SERVICE.pid
LOG=$SERVICE.log

running() {
	local pid="$(cat $PID 2>/dev/null)"
	[ "$pid" ] || return 1
	ps --no-headers -o command -p $pid | grep -q "$CMD"
}

main() {
	if [ "$1" == start ]; then
		running && { echo "already running (pid $(cat $PID))."; return 1; }
		[ -f "$PID" ] && { echo "stale pid file found."; }
		$CMD 2>&1 >> $LOG &
		echo "$!" > $PID
		running && echo "started. pid: $(cat $PID)." || { echo "failed to start."; return 1; }
	elif [ "$1" == stop ]; then
		running || { echo "not running."; return 1; }
		local pid="$(cat $PID)"
		echo -n "killing pid $pid..."
		kill $pid
		running && { echo "failed."; return 1; } || { echo "ok."; rm $PID; }
	elif [ "$1" == restart ]; then
		"$0" stop && "$0" start
	elif [ ! "$1" -o "$1" == status ]; then
		running && echo "running. pid: $(cat $PID)." || echo "not running."
	elif [ "$1" == log ]; then
		tail -f $LOG 2>/dev/null
	elif [ "$1" == fg ]; then
		$CMD
	else
		echo "Usage: $0 [start | stop | restart | status | log | fg]"
	fi
}

main "$@"
