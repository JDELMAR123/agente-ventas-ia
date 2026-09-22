import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Datos de EJEMPLO, solo para desarrollo local — en producción cada
// comprador carga su propio negocio y catálogo desde /admin, empieza vacío.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const demoProducts = [
  {
    name: "Combo Parrilla Clásica",
    category: "Platos fuertes",
    description: "Carne a la parrilla con dos acompañantes a elegir.",
    price: 18.5,
    keywords: JSON.stringify(["parrilla", "carne", "combo"]),
  },
  {
    name: "Ensalada César",
    category: "Entradas",
    description: "Lechuga, pollo a la plancha, crutones y aderezo césar.",
    price: 9.0,
    keywords: JSON.stringify(["ensalada", "cesar", "césar", "pollo"]),
  },
  {
    name: "Jugo natural",
    category: "Bebidas",
    description: "Frutas de temporada, 500ml.",
    price: 3.5,
    keywords: JSON.stringify(["jugo", "bebida", "refresco"]),
  },
];

async function main() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName: "Restaurante Demo",
      brandTone: "cercano, cálido, con algún emoji ocasional",
      aiBusinessContext:
        "Somos un restaurante. Los clientes escriben para preguntar por el menú, " +
        "precios, horarios y para reservar o pedir a domicilio.",
    },
  });

  for (const p of demoProducts) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.product.create({ data: p });
    }
  }

  const contact = await prisma.contact.upsert({
    where: { phone: "34600111222" },
    update: {},
    create: { name: "Cliente Demo", phone: "34600111222", whatsappId: "34600111222" },
  });

  const conversation = await prisma.conversation.upsert({
    where: { channel_externalId: { channel: "WHATSAPP", externalId: "34600111222" } },
    update: {},
    create: {
      channel: "WHATSAPP",
      externalId: "34600111222",
      contactId: contact.id,
      lastMessagePreview: "Hola, ¿cuánto cuesta la parrilla?",
    },
  });

  await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, direction: "ENTRANTE", sender: "CLIENTE", body: "Hola, ¿cuánto cuesta la parrilla?" },
      { conversationId: conversation.id, direction: "SALIENTE", sender: "AGENTE", body: "¡Hola! La Parrilla Clásica cuesta $18.50 e incluye dos acompañantes 😊 ¿Te la reservo?" },
    ],
  });

  await prisma.lead.upsert({
    where: { contactId: contact.id },
    update: { stage: "CONTACTADO", interes: "Preguntó por la Parrilla Clásica" },
    create: { contactId: contact.id, stage: "CONTACTADO", interes: "Preguntó por la Parrilla Clásica" },
  });

  console.log(
    `Seed completado: negocio "Restaurante Demo", ${demoProducts.length} productos, 1 conversación de ejemplo.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
