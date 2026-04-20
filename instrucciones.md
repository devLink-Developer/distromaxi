# 📦 DISTRO APP — ESPECIFICACIÓN TÉCNICA COMPLETA (PWA MAYORISTA)

## 🧠 Objetivo

Desarrollar una aplicación tipo **PedidosYa / Rappi**, orientada a **distribuidores mayoristas**, que conecte:

* Comercios (clientes B2B)
* Distribuidores (vendedores)
* Repartidores (Propios de cada distribuidor)

La aplicación será una **PWA (Progressive Web App)** con arquitectura desacoplada (SPA + API REST).

---

# 🏗️ STACK TECNOLÓGICO (OBLIGATORIO)

## Infraestructura

* Docker
* Docker Compose

## Backend

* Django (última LTS)
* Django REST Framework
* PostgreSQL
* Gunicorn
* WhiteNoise

## Frontend

* React (con Vite 8.x)
* TypeScript 5.9.x
* React Router DOM 7.13.2
* Zustand 5.0.12
* Tailwind CSS 3.4.17

## Testing

* Vitest 4.1.2
* Testing Library

---

# 📁 ESTRUCTURA DEL PROYECTO

```
distro-app/
│
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── users/
│   │   ├── commerces/
│   │   ├── distributors/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── deliveries/
│   │   └── payments/
│   ├── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── routes/
│   │   └── types/
│
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```

---

# 🔐 MODELO DE USUARIOS

## Tipos de usuario

* ADMIN
* DISTRIBUTOR
* COMMERCE (cliente)
* ENTREGA

## Modelo base (custom user)

Campos:

* email (login)
* password
* role
* is_active
* created_at

---

# 📦 MÓDULOS BACKEND

## 1. USERS

* Registro / Login (JWT)
* Roles
* Perfil

## 2. DISTRIBUTORS

* Datos del distribuidor
* Catálogo de productos

## 3. PRODUCTS

Campos:

* name
* description
* price
* stock
* distributor_id
* category
* image

## 4. COMMERCES

* Comercios registrados
* Dirección
* Geolocalización

## 5. ORDERS

Estados:

* PENDING
* ACCEPTED
* PREPARING
* ON_THE_WAY
* DELIVERED
* CANCELLED

Campos:

* commerce_id
* distributor_id
* total
* status

## 6. ORDER ITEMS

* product_id
* quantity
* price

## 7. DELIVERIES

* rider_id
* order_id
* status
* location tracking

## 8. PAYMENTS

* method
* status
* transaction_id

---

# 🔌 API REST (DRF)

## Auth

* POST /api/auth/register
* POST /api/auth/login
* GET /api/auth/me

## Productos

* GET /api/products
* POST /api/products
* GET /api/products/

## Pedidos

* POST /api/orders
* GET /api/orders
* PATCH /api/orders//status

## Distribuidores

* GET /api/distributors

## Riders

* GET /api/deliveries/available
* PATCH /api/deliveries/

---

# ⚛️ FRONTEND (ARQUITECTURA)

## Routing (React Router)

Rutas principales:

```
/login
/register
/home
/distributors
/products/:id
/cart
/orders
/dashboard (según rol)
```

---

# 🧠 ESTADO GLOBAL (ZUSTAND)

Stores:

## authStore

* user
* token
* login/logout

## cartStore

* items
* add/remove
* total

## orderStore

* orders
* currentOrder

---

# 🎨 UI/UX (TAILWIND)

## Estilo

* Mobile-first
* Inspirado en Rappi / PedidosYa
* UI rápida y simple

## Componentes clave

* Navbar inferior (mobile)
* Cards de productos
* Lista de distribuidores
* Checkout
* Tracking en tiempo real

---

# 📲 PWA FEATURES

* Service Worker
* Offline fallback
* Instalación en dispositivo
* Push notifications (Firebase opcional)

---

# 🐳 DOCKER

## docker-compose.yml

Servicios:

* backend
* frontend
* db (PostgreSQL)

---

# 🧪 TESTING FRONTEND

## Vitest + Testing Library

Tests obligatorios:

* Login
* Carrito
* Checkout
* Render de productos

---

# 🚀 DESPLIEGUE

## Backend

* Gunicorn
* WhiteNoise para estáticos

## Frontend

* Build con Vite
* Servido por Django o CDN

---

# ⚙️ TAREAS PARA AGENTES CODEX

## AGENTE 1 — BACKEND CORE

* Crear proyecto Django
* Configurar PostgreSQL
* Custom User Model
* JWT Auth

## AGENTE 2 — MODELOS Y API

* Crear apps
* Modelos
* Serializers
* ViewSets

## AGENTE 3 — FRONTEND BASE

* Crear proyecto Vite + React + TS
* Configurar Tailwind
* Routing

## AGENTE 4 — ESTADO Y SERVICIOS

* Zustand stores
* API client (axios)

## AGENTE 5 — UI

* Layout tipo app delivery
* Componentes reutilizables

## AGENTE 6 — PEDIDOS

* Carrito
* Checkout
* Flujo completo

## AGENTE 7 — RIDERS

* Panel de entregas
* Tracking básico

## AGENTE 8 — PWA

* Service Worker
* Instalación

## AGENTE 9 — TESTING

* Vitest setup
* Tests clave

## AGENTE 10 — DEVOPS

* Dockerfiles
* docker-compose
* Scripts de build

---

# 🧩 CONSIDERACIONES CLAVE

* Arquitectura desacoplada (frontend/backend)
* Seguridad JWT
* Escalabilidad (multi-distribuidor)
* Código modular
* Tipado estricto en frontend

---

# 🏁 RESULTADO ESPERADO

Una aplicación funcional donde:

* Comercios hacen pedidos
* Distribuidores venden
* Riders entregan
* Admin gestiona todo

---

# 🔥 NOTA FINAL PARA CODEX

Cada agente debe trabajar de forma independiente pero respetando:

* Tipos compartidos
* Estructura del proyecto
* Contratos de API

NO improvisar dependencias fuera del stack definido.

---
