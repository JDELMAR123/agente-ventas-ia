# Conectar WhatsApp (Meta)

Esta guía cubre los trámites y la configuración para que el agente reciba y
envíe mensajes reales por WhatsApp. El código ya está listo: solo hay que
rellenar credenciales, ya sea en `/admin` (recomendado) o en variables de
entorno como respaldo. Instagram y Messenger están preparados con la misma
interfaz de canal, pero por ahora son "stubs" (no envían mensajes reales) —
se activan repitiendo este mismo proceso cuando se implementen del todo.

## Resumen del proceso

| Paso | Quién | Tiempo aprox. |
| ---- | ----- | ------------- |
| 1. Cuenta de Meta Business + verificación del negocio | Tú | días–semanas |
| 2. App de Meta (tipo "Business") | Tú | 30 min |
| 3. WhatsApp: alta del número + Phone Number ID + token | Tú | 1 h |
| 4. Configurar el webhook apuntando al agente (HTTPS público) | Tú | 30 min |
| 5. Revisión de permisos de Meta (App Review), para salir del modo de pruebas | Meta | 1–3 semanas |

## 1. Meta Business y verificación

1. Crea un [Meta Business Manager](https://business.facebook.com/).
2. En **Configuración del negocio → Centro de seguridad**, inicia la
   **verificación del negocio** (documento fiscal, dominio, teléfono).
   Sin esto, Meta limita el envío de mensajes fuera de la ventana de pruebas
   (solo a números de prueba que tú mismo agregues).

## 2. App de Meta

1. En [developers.facebook.com](https://developers.facebook.com/apps) →
   **Crear app** → tipo **Business**.
2. Añade el producto **WhatsApp**.

## 3. WhatsApp

1. En el panel de WhatsApp de la app, añade un **número de teléfono** (no
   puede estar activo ya en la app normal de WhatsApp) — o usa el número de
   prueba gratuito que Meta da por defecto para probar el flujo primero.
2. Copia el **Phone Number ID** (aparece en el panel de WhatsApp → API Setup).
3. Genera un **token de acceso permanente**: crea un System User en
   Business Settings → System Users, asígnale el permiso
   `whatsapp_business_messaging` sobre la app, y genera su token sin fecha de
   caducidad (el token temporal de 24h que Meta muestra por defecto solo
   sirve para pruebas rápidas).

## 4. Configurar en el agente

Ve al panel **`/admin`** de tu instalación (protegido con `ADMIN_USER` /
`ADMIN_PASSWORD`) → sección **"WhatsApp (Meta Cloud API)"** y rellena:

- **Token de verificación del webhook**: invéntate cualquier cadena secreta
  (por ejemplo, generada con `openssl rand -hex 16`). Es solo para que Meta
  confirme que el webhook es tuyo, no viene de Meta.
- **Token de acceso de WhatsApp**: el System User token del paso 3.
- **Phone Number ID**: el del paso 3.

Alternativa por variables de entorno (si prefieres no pasar por `/admin`, o
como respaldo — lo de `/admin` siempre tiene prioridad si está configurado):

```
META_WEBHOOK_VERIFY_TOKEN="una-cadena-larga-y-secreta"
META_WHATSAPP_TOKEN="EAAG..."
META_WHATSAPP_PHONE_ID="123456789012345"
```

## 5. Webhook en el panel de Meta

El agente expone este endpoint (necesita una URL pública con HTTPS):

```
https://TU-DOMINIO/webhooks/whatsapp
```

1. En el panel de WhatsApp de tu app → **Configuration → Webhook**:
   - **Callback URL**: la URL de arriba.
   - **Verify token**: la misma cadena que pusiste en el paso 4.
   - Clic en **Verify and save** (Meta hace un `GET` con `hub.challenge`; el
     agente responde solo si el token coincide).
   - Suscríbete al campo **`messages`**.

2. **En desarrollo local**, usa un túnel para tener HTTPS público:

   ```bash
   npx untun@latest tunnel http://localhost:3300
   # o: ngrok http 3300
   ```

   Usa la URL que te dé el túnel como Callback URL mientras pruebas.

## 6. App Review

Para enviar mensajes a cualquier número (no solo a los que agregaste como
"número de prueba"), Meta exige revisar el permiso
`whatsapp_business_messaging`. Prepara un vídeo mostrando el flujo de
conversación y una política de privacidad publicada. Mientras tanto, puedes
probar todo el flujo real agregando hasta 5 números de prueba en el panel de
WhatsApp → API Setup → "To" (sin necesidad de review).

## Comprobación

Cuando el token, el Phone Number ID y el verify token estén configurados:

1. Guarda en el panel de Meta el webhook — debe quedar en verde ("Verified").
2. Envía un WhatsApp al número configurado desde uno de los números de
   prueba autorizados.
3. Revisa **`/dashboard`**: debe aparecer una conversación nueva. Si el
   motor de reglas (o Claude, si configuraste tu propia clave en `/admin`)
   respondió, el mensaje saliente llegó de verdad por WhatsApp.
4. Si algo falla, revisa los logs del servidor — cada llamada a Meta o error
   de parseo del webhook queda registrado ahí.
