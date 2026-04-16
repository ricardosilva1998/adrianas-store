import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { sql as drizzleSql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

type Frontmatter = Record<string, string | number | boolean | Array<unknown>>;

const parseFrontmatter = (raw: string): { data: Frontmatter; body: string } => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Frontmatter = {};
  const lines = match[1].split("\n");
  let currentKey: string | null = null;
  let arrayAcc: unknown[] | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith("  - ")) {
      if (!arrayAcc || !currentKey) continue;
      const value = line.slice(4).trim();
      if (value.startsWith("{") && value.endsWith("}")) {
        const obj: Record<string, string> = {};
        const inner = value.slice(1, -1).trim();
        const parts = inner.split(",").map((p) => p.trim());
        for (const part of parts) {
          const [k, v] = part.split(":").map((x) => x.trim());
          obj[k] = v.replace(/^"|"$/g, "");
        }
        arrayAcc.push(obj);
      } else {
        arrayAcc.push(value.replace(/^"|"$/g, ""));
      }
      continue;
    }

    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    currentKey = key;

    if (rawValue === "") {
      arrayAcc = [];
      data[key] = arrayAcc as unknown[];
      continue;
    }

    arrayAcc = null;
    const v = rawValue.trim();
    if (v === "true") data[key] = true;
    else if (v === "false") data[key] = false;
    else if (!isNaN(Number(v))) data[key] = Number(v);
    else data[key] = v.replace(/^"|"$/g, "");
  }

  return { data, body: match[2].trim() };
};

const seedProducts = async () => {
  const dir = "./src/content/products";
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));

  console.log(`📦 A migrar ${files.length} produtos...`);

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = await readFile(join(dir, file), "utf-8");
    const { data, body } = parseFrontmatter(raw);

    const existing = await db
      .select()
      .from(schema.products)
      .where(drizzleSql`${schema.products.slug} = ${slug}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`  · ${slug} (já existe, skip)`);
      continue;
    }

    const priceCents = Math.round(Number(data.price) * 100);
    const images = Array.isArray(data.images) ? (data.images as string[]) : [];
    const colors = Array.isArray(data.availableColors)
      ? (data.availableColors as Array<{ name: string; hex: string }>)
      : [];

    const [inserted] = await db
      .insert(schema.products)
      .values({
        slug,
        name: String(data.name),
        description: String(data.description),
        longDescription: body,
        priceCents,
        category: data.category as schema.ProductCategorySlug,
        stock: 10,
        unlimitedStock: true,
        bestseller: Boolean(data.bestseller),
        personalizable: data.personalizable !== false,
        active: true,
        sortOrder: Number(data.order ?? 0),
      })
      .returning();

    if (images.length > 0) {
      await db.insert(schema.productImages).values(
        images.map((url, i) => ({
          productId: inserted.id,
          url,
          position: i,
        })),
      );
    }

    if (colors.length > 0) {
      await db.insert(schema.productColors).values(
        colors.map((c, i) => ({
          productId: inserted.id,
          name: c.name,
          hex: c.hex,
          position: i,
        })),
      );
    }

    console.log(`  ✔ ${slug}`);
  }
};

const seedPages = async () => {
  console.log("📄 A semear páginas editáveis...");

  const pagesToSeed = [
    {
      slug: "sobre-nos",
      title: "Sobre Nós",
      body: `A Adriana's Store nasceu do desejo de criar peças únicas, personalizadas à mão, que contam uma história. Cada frase, cada cor, cada desenho que nos confiam é trabalhado com o mesmo cuidado — como se fosse para nós.

## Feito à mão

Cada estampa é aplicada manualmente no nosso atelier. Sem linhas de produção, sem atalhos — só mãos e atenção ao detalhe.

## 100% personalizado

Frases, cores, doodles. Partilha a tua ideia e nós damos-lhe forma — seja para ti, para oferecer ou para um momento especial.

## Feito em Portugal

Todo o processo acontece no nosso atelier em Portugal. Os envios são feitos via CTT para qualquer ponto do país e para as Ilhas.

## A nossa missão

Acreditamos que os objectos que nos rodeiam devem ter significado. Por isso fazemos peças que celebram histórias pequenas, frases que nos definem, piadas privadas entre amigas, palavras que queremos guardar. Peças simples, mas vividas.`,
    },
    {
      slug: "como-encomendar",
      title: "Como Encomendar",
      body: `Encomendar é simples. Explicamos tudo aqui — desde a personalização até ao envio.

## 1. Escolhe o produto

Navega o catálogo e abre a página do produto que queres. Vais encontrar medidas, cores disponíveis e exemplos de encomendas anteriores.

## 2. Personaliza

Clica em **Personalizar**, escreve uma frase (até 100 caracteres), escolhe as cores e descreve o desenho ou doodle que queres estampado.

## 3. Carrinho e checkout

Adiciona ao carrinho e avança para o checkout. Preenche os teus dados de contacto e morada e escolhe o método de pagamento.

## 4. Produção e envio

Recebemos o teu pedido por email. Preparamos a peça em 3 a 5 dias úteis e enviamos via CTT. Recebes código de seguimento por email.

## Prazos de entrega estimados (CTT)

- **Portugal Continental**: 1 a 3 dias úteis
- **Madeira e Açores**: 4 a 7 dias úteis
- **Europa**: 5 a 10 dias úteis

## Métodos de pagamento

Após submeter a encomenda, recebes por email as instruções de pagamento do método escolhido. A encomenda só entra em produção depois da confirmação do pagamento.

- **MB Way** — envia para o número indicado por email
- **Transferência bancária** — envia comprovativo por email
- **PayPal** — envia para o email indicado`,
    },
    {
      slug: "termos-condicoes",
      title: "Termos e Condições",
      body: `Última atualização: versão inicial. Este documento é um rascunho e deve ser revisto com aconselhamento legal antes da publicação definitiva.

## 1. Âmbito

Os presentes Termos e Condições regulam a relação entre a Adriana's Store e os utilizadores do site. Ao efectuar uma encomenda, declaras conhecer e aceitar integralmente estes termos.

## 2. Produtos e personalização

Todas as peças da Adriana's Store são produzidas à mão, por encomenda. As imagens apresentadas no site representam exemplos reais de encomendas anteriores, mas cada peça é única e podem existir pequenas variações de cor, posicionamento ou traço. Essas variações fazem parte do carácter artesanal do produto e não são consideradas defeito.

## 3. Preços e pagamento

Os preços indicados no site estão em euros e incluem IVA à taxa legal em vigor. Os custos de envio são calculados no checkout. A produção da encomenda inicia-se apenas após confirmação do pagamento.

## 4. Prazos de produção e envio

O prazo de preparação é de 3 a 5 dias úteis, a contar da confirmação do pagamento. Os envios são feitos via CTT.

## 5. Direito de livre resolução

Nos termos do Decreto-Lei n.º 24/2014, o consumidor dispõe de 14 dias para livre resolução. **Produtos personalizados estão excluídos** deste direito, por serem produzidos especificamente para o cliente.

## 6. Dados pessoais

Os dados pessoais recolhidos através do formulário de encomenda são tratados exclusivamente para a execução do contrato de compra.

## 7. Lei aplicável

Estes Termos e Condições são regidos pela lei portuguesa.`,
    },
  ];

  for (const page of pagesToSeed) {
    const existing = await db
      .select()
      .from(schema.pages)
      .where(drizzleSql`${schema.pages.slug} = ${page.slug}`)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.pages).values(page);
      console.log(`  ✔ ${page.slug}`);
    } else {
      console.log(`  · ${page.slug} (já existe, skip)`);
    }
  }
};

const seedAdminUser = async () => {
  console.log("👤 A criar utilizadores admin iniciais...");

  const admins = [
    {
      email: (process.env.ADMIN_SEED_EMAIL ?? "").trim().toLowerCase(),
      password: process.env.ADMIN_SEED_PASSWORD ?? "",
      name: process.env.ADMIN_SEED_NAME ?? "Admin",
    },
    {
      email: (process.env.ADMIN_SEED_EMAIL_2 ?? "").trim().toLowerCase(),
      password: process.env.ADMIN_SEED_PASSWORD_2 ?? "",
      name: process.env.ADMIN_SEED_NAME_2 ?? "Admin",
    },
  ];

  for (const { email, password, name } of admins) {
    if (!email || !password) continue;

    const existing = await db
      .select()
      .from(schema.users)
      .where(drizzleSql`${schema.users.email} = ${email}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`  · ${email} já existe`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(schema.users).values({
      email,
      name,
      passwordHash,
      role: "admin",
    });

    console.log(`  ✔ ${email} (admin)`);
  }
};

const main = async () => {
  try {
    await seedProducts();
    await seedPages();
    await seedAdminUser();
    console.log("✅ Seed concluído.");
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error("❌ Seed falhou:", err);
  process.exit(1);
});
