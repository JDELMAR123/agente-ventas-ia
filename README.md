# Agente de ventas por WhatsApp — con IA

Agente conversacional **autoalojado** para pequeños comercios (restaurantes,
servicios, tiendas): responde por WhatsApp, califica al cliente, resuelve
dudas de catálogo y precios, agenda o cierra ventas simples, hace seguimiento
automático si el cliente no responde, y deja todo registrado en su propio
CRM interno. Escala a un humano (aviso por Slack) si el cliente negocia un
precio fuera de rango, hay una queja, o el agente no tiene confianza para
responder.

Cada negocio despliega **su propia copia**: su base de datos, su número de
WhatsApp, su configuración. No depende de ningún servicio central.

Stack: Node.js, TypeScript, Fastify 5, Prisma 7, PostgreSQL.

---

## Qué incluye

- **Un solo "cerebro" para todos los canales**: la lógica del agente no sabe
  si el mensaje vino de WhatsApp, Instagram o Messenger — cada canal es un
  adaptador intercambiable con la misma interfaz. **WhatsApp está
  implementado de verdad** (Meta Cloud API); Instagram y Messenger están
  preparados como "stubs" listos para activarse.
- **Herramientas reales, no prompts sueltos**: el agente usa *tool calling*
  de verdad para buscar al cliente, crear/actualizar el lead, consultar el
  catálogo (nunca inventa precios), registrar cada interacción, programar
  seguimientos y escalar a un humano.
- **Dos motores de IA**:
  - **Motor de reglas** (incluido, sin coste, sin cuentas externas) por
    defecto — decide qué herramienta usar según palabras clave.
  - **Claude (Anthropic)**, como mejora opcional de pago: tool-use real y
    multi-turno, activándola con tu propia clave de API desde `/admin`.
- **Seguimiento automático**: un job programado revisa cada hora los
  seguimientos pendientes y reengancha al cliente si sigue sin responder.
- **Observabilidad**: cada llamada a una herramienta (de cualquiera de los
  dos motores) queda registrada — motor, argumentos, resultado, éxito/error
  — visible en `/dashboard` junto a las conversaciones activas y la etapa de
  cada lead.
- **Todo configurable sin tocar código**: nombre del negocio, tono de marca,
  catálogo de productos, motor de IA + clave, descuento máximo autorizado,
  webhook de Slack y credenciales de WhatsApp — todo desde `/admin`.

El canal de WhatsApp requiere una app de Meta: ver
[docs/META_SETUP.md](docs/META_SETUP.md).

---

## Desarrollo local

```bash
npm install
cp .env.example .env              # ajusta DATABASE_URL, ADMIN_USER/PASSWORD
npx prisma dev --detach --name agente-ventas   # base de datos local (o usa tu propio Postgres)
npm run db:push                   # crea las tablas
npm run db:seed                   # datos de ejemplo ("Restaurante Demo")
npm run dev                       # http://localhost:3300
```

- `/admin` — panel de configuración (usuario/contraseña de `.env`).
- `/dashboard` — conversaciones, etapas del pipeline, log de herramientas.
- `/webhooks/whatsapp` — endpoint público para Meta (ver
  [docs/META_SETUP.md](docs/META_SETUP.md)).

Mientras no conectes WhatsApp de verdad, puedes probar el flujo del agente
llamando directamente a la lógica interna o simulando un `POST` al webhook
con el formato de mensaje de Meta.

### Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (recarga en caliente) |
| `npm run build` | Compila para producción |
| `npm start` | Arranca la build compilada (`dist/`) |
| `npm run db:push` | Sincroniza el esquema con la base de datos (desarrollo) |
| `npm run db:migrate` | Crea una migración nueva |
| `npm run db:deploy` | Aplica migraciones pendientes (producción) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Datos de ejemplo (solo desarrollo) |
| `npm run lint` | ESLint |

---

## Configuración

Todo se hace desde **`/admin`** (protegido con usuario/contraseña): nombre
del negocio, tono de marca, contexto para la IA, descuento máximo, motor de
IA + clave de Anthropic, webhook de Slack, correo de respaldo, y el
catálogo de productos completo.

Variables de entorno (ver [.env.example](.env.example)):

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `DATABASE_URL_UNPOOLED` | Conexión directa, opcional (para pooler tipo Neon) |
| `PORT` | Puerto del servidor (por defecto 3300) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Acceso a `/admin` y `/dashboard` |
| `META_*` | Credenciales de WhatsApp — respaldo; `/admin` tiene prioridad |
| `ANTHROPIC_API_KEY` | Activa el motor de Claude — respaldo; `/admin` tiene prioridad |
| `SLACK_WEBHOOK_URL` / `ESCALATION_EMAIL` | Escalamiento a humano — respaldo; `/admin` tiene prioridad |

En producción, la base de datos arranca **vacía** (no se ejecuta el seed):
configura el negocio desde `/admin` antes de conectar WhatsApp.

---

## Estructura

```
prisma/schema.prisma       Modelos: Settings, Product, Contact, Conversation, Message, Lead, FollowUp, ToolCallLog
prisma/migrations/         Migraciones
prisma/seed.ts             Datos de ejemplo (solo desarrollo local)
docs/META_SETUP.md         Guía para conectar WhatsApp de verdad
src/agent/tools/           Las 6 herramientas del agente (buscar cliente, crear lead, catálogo, etc.)
src/agent/engines/         Motor de reglas (gratis) y motor de Claude (de pago, opcional)
src/agent/core.ts          Punto de entrada único, agnóstico de canal
src/agent/systemPrompt.ts  Prompt del sistema (tono y reglas configurables)
src/channels/              Adaptadores: WhatsApp (real), Instagram/Messenger (stubs)
src/routes/webhooks.ts     Endpoints públicos de Meta
src/routes/admin.ts        Panel de configuración
src/routes/dashboard.ts    Panel de conversaciones y observabilidad
src/jobs/followUps.ts      Job programado de seguimiento automático
src/settings/              Configuración de la instalación (con caché)
src/catalog/               Consulta del catálogo de productos
```

---

## Licencia

Uso interno / venta como producto digital según lo acordado con el
propietario del proyecto.
