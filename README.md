# DistroMaxi PWA SaaS Mayorista

Aplicación desacoplada para pedidos mayoristas B2B con Django REST, PostgreSQL, React/Vite, Zustand, Tailwind, PWA, tracking por REST polling, Web Push VAPID, importación CSV y datos demo.

## Stack

- Backend: Django 5.2 LTS, Django REST Framework, Simple JWT, PostgreSQL, Gunicorn, WhiteNoise.
- Frontend: React 19, Vite 8, TypeScript 5.9, React Router DOM 7.13.2, Zustand 5.0.12, Tailwind CSS 3.4.17.
- Testing: Django TestCase/APIClient, Vitest 4.1.2, Testing Library.

## Ejecutar con Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Admin Django: http://localhost:8000/admin

El backend ejecuta migraciones, carga datos demo y levanta Gunicorn. Para push real en navegador, completá `.env` con claves VAPID y ejecutá Docker Compose con esas variables.

## Ejecutar local

El backend requiere PostgreSQL. No hay fallback a SQLite: si faltan las variables `POSTGRES_*`, Django no arranca.

```bash
python -m pip install -r backend/requirements.txt
```

Si ejecutás Django fuera de Docker, configurá `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` en tu shell apuntando a una PostgreSQL disponible.

Con Docker, ejecutá comandos de Django dentro del contenedor backend para usar la PostgreSQL del compose:

```bash
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py seed_demo
```

```bash
cd frontend
npm install
npm run dev
```

## Cuentas demo

Todas usan `Demo1234!`.

- Admin: `admin@distromax.local`
- Distribuidora: `ventas@andina.local`
- Comercio: `compras@almacenluna.local`
- Chofer: `chofer@andina.local`

## Funcionalidad incluida

- Auth JWT con roles `ADMIN`, `DISTRIBUTOR`, `COMMERCE`, `DRIVER`.
- CRUD/API de distribuidoras, clientes, artículos, stock, vehículos, choferes, pedidos, entregas, notificaciones, planes y suscripciones.
- Stock con existencia, reserva, liberación y salida al entregar.
- Pedidos sin pago in-app; el pago se coordina entre comercio y distribuidora.
- Suscripción SaaS para distribuidoras con link de Mercado Pago.
- Tracking GPS por REST polling desde la PWA del chofer.
- Web Push VAPID con service worker, registro de suscripción y fallback si faltan claves.
- Importación CSV para artículos, clientes, vehículos, choferes y stock con reporte de errores.
- Frontend mobile-first con catálogo, carrito, checkout, dashboards, importador, billing y tracking OSM.

## Verificación

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test apps
cd frontend
npm run test
npm run build
```
