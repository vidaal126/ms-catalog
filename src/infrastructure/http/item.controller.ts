import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ID_GENERATOR, type IdGenerator } from "@application/ports/id-generator.port";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ItemEntity } from "../../domain/entities/item.entity";
import { ItemNotFoundError } from "../../domain/errors/item.errors";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "../../domain/repositories/item.repository";
import { CreateItemDto } from "./dto/create-item.dto";

const CORRELATION_ID_HEADER = "x-correlation-id";
// Valor vindo do cliente segue para o evento e para os logs: restringe
// charset e tamanho em vez de confiar no que chegou.
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

@Controller("items")
export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateItemDto,
    @Headers(CORRELATION_ID_HEADER) correlationIdHeader?: string,
  ): Promise<ItemEntity> {
    return this.createItemUseCase.execute(dto, {
      correlationId: this.resolveCorrelationId(correlationIdHeader),
    });
  }

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<ItemEntity[]> {
    return await this.itemRepository.findAll({
      page: page === undefined ? undefined : this.parsePositiveInt(page, "page"),
      limit: limit === undefined ? undefined : this.parsePositiveInt(limit, "limit"),
    });
  }

  @Get(":id")
  async findById(@Param("id") id: string): Promise<ItemEntity> {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new ItemNotFoundError(id);
    }
    return item;
  }

  private resolveCorrelationId(header: string | undefined): string {
    if (header !== undefined && CORRELATION_ID_PATTERN.test(header)) {
      return header;
    }
    return this.idGenerator.generate();
  }

  private parsePositiveInt(value: string, field: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(
        `Parâmetro ${field} deve ser um número inteiro positivo`,
      );
    }
    return parsed;
  }
}
