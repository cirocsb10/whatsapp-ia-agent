import { PrismaClient, UserRole, PlanType, AgentTone } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const devTenant = await prisma.tenant.upsert({
    where: { slug: "dev-tenant" },
    update: {},
    create: {
      name: "Loja Demonstração",
      slug: "dev-tenant",
      status: "ACTIVE",
      planType: PlanType.GROWTH,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "dev_owner_clerk_id" },
    update: {},
    create: {
      tenantId: devTenant.id,
      clerkId: "dev_owner_clerk_id",
      email: "owner@dev-tenant.com",
      name: "Admin Dev",
      role: UserRole.OWNER,
      isSuperAdmin: true,
    },
  });

  await prisma.agentConfig.upsert({
    where: { tenantId: devTenant.id },
    update: {},
    create: {
      tenantId: devTenant.id,
      agentName: "Carla",
      tone: AgentTone.FRIENDLY,
      greetingMessage:
        "Olá! Sou a Carla, assistente virtual da Loja Demonstração. Como posso ajudar você hoje?",
      llmModel: "gpt-4o-mini",
      llmTemperature: 0.3,
      businessHours: {
        mon: { open: "09:00", close: "18:00", active: true },
        tue: { open: "09:00", close: "18:00", active: true },
        wed: { open: "09:00", close: "18:00", active: true },
        thu: { open: "09:00", close: "18:00", active: true },
        fri: { open: "09:00", close: "18:00", active: true },
        sat: { open: "09:00", close: "13:00", active: true },
        sun: { open: "00:00", close: "00:00", active: false },
      },
    },
  });

  const category = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: devTenant.id, slug: "camisetas" } },
    update: {},
    create: {
      tenantId: devTenant.id,
      name: "Camisetas",
      slug: "camisetas",
    },
  });

  const products = [
    {
      name: "Camiseta Premium Preta",
      description: "Camiseta 100% algodão, corte slim, lavável à máquina",
      priceCents: 5990,
      stockQty: 50,
      tags: ["camiseta", "preta", "slim", "algodão", "premium"],
    },
    {
      name: "Camiseta Estampada Branca",
      description: "Camiseta estampada exclusiva, algodão macio, unissex",
      priceCents: 4990,
      stockQty: 30,
      tags: ["camiseta", "branca", "estampada", "unissex"],
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        tenantId: devTenant.id,
        categoryId: category.id,
        ...p,
        variations: [{ name: "Tamanho", values: ["P", "M", "G", "GG"] }],
      },
    });
  }

  await prisma.guardRule.create({
    data: {
      tenantId: devTenant.id,
      name: "Não mencionar concorrentes",
      type: "TEXT_BLOCK",
      action: "REWRITE",
      priority: 10,
      config: { patterns: ["marca rival", "concorrente", "outra loja"] },
      fallbackMessage:
        "Posso ajudar com informações sobre nossos produtos. O que gostaria de saber?",
    },
  });

  console.log("✅ Seed concluído!");
  console.log(`   Tenant: ${devTenant.name} (ID: ${devTenant.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
