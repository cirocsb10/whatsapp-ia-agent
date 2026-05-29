import { Test } from "@nestjs/testing";
import { EmbeddingProcessor } from "./embedding.processor";
import { PrismaService } from "../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockPrisma = { product: { findUnique: jest.fn(), update: jest.fn() } };

describe("EmbeddingProcessor", () => {
  let processor: EmbeddingProcessor;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EmbeddingProcessor, { provide: PrismaService, useValue: mockPrisma }, { provide: ConfigService, useValue: { get: () => "sk-test" } }],
    }).compile();
    processor = module.get<EmbeddingProcessor>(EmbeddingProcessor);
    jest.clearAllMocks();
  });

  it("deve gerar embedding e atualizar produto", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: "prod-uuid", name: "Camiseta Preta Premium", description: "100% algodão", tags: ["camiseta","preta"] });
    await processor.process({ name: "generate-embedding", data: { productId: "prod-uuid", tenantId: "tenant-123" } });
    expect(mockPrisma.product.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "prod-uuid" }, data: expect.objectContaining({ isEmbedded: true, embeddingText: expect.stringContaining("Camiseta Preta Premium") }) }));
  });
});
