#!/bin/bash
# Keep the dev and prod preview servers alive for demo purposes.
export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"
cd /home/ubuntu/repos/discover
while true; do
  if ! curl -s -o /dev/null --max-time 8 localhost:3000; then
    echo "$(date) dev down — restarting" >> /tmp/watchdog.log
    (NEXT_DIST_DIR=.next-dev nohup npx next dev >/tmp/dev.log 2>&1 & disown)
  fi
  if [ -O /tmp/discover-build-in-progress ]; then
    echo "$(date) build in progress — skipping prod restart" >> /tmp/watchdog.log
  elif ! curl -s -o /dev/null --max-time 8 localhost:3212; then
    echo "$(date) prod down — restarting" >> /tmp/watchdog.log
    (nohup npx next start -p 3212 >/tmp/prod.log 2>&1 & disown)
  fi
  sleep 60
done
