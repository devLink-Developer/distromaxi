#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "${DJANGO_SEED_DEMO:-1}" = "1" ]; then
  python manage.py seed_demo
fi

exec "$@"
