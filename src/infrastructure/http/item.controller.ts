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
import { CreateItemUseCase } from "@application/use-cases/create-item.use-case";
import { GetItemUseCase } from "@application/use-cases/get-item.use-case";
import { ListItemsUseCase } from "@application/use-cases/list-items.use-case";
import { CreateItemDto } from "./dto/create-item.dto";
import type {
  ItemResponseDto,
  PaginatedItemsResponseDto,
} from "./dto/item-response.dto";
import {
  toItemResponse,
  toPaginatedItemsResponse,
} from "./mappers/item-response.mapper";

const CORRELATION_ID_HEADER = "x-correlation-id";
// Valor vindo do cliente segue para o evento e para os logs: restringe
// charset e tamanho em vez de confiar no que chegou.
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

@Controller("items")
export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly getItemUseCase: GetItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateItemDto,
    @Headers(CORRELATION_ID_HEADER) correlationIdHeader?: string,
  ): Promise<ItemResponseDto> {
    const item = await this.createItemUseCase.execute(dto, {
      correlationId: this.resolveCorrelationId(correlationIdHeader),
    });
    return toItemResponse(item);
  }

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedItemsResponseDto> {
    const output = await this.listItemsUseCase.execute({
      page: page === undefined ? undefined : this.parsePositiveInt(page, "page"),
      limit: limit === undefined ? undefined : this.parsePositiveInt(limit, "limit"),
    });
    return toPaginatedItemsResponse(output);
  }

  @Get(":id")
  async findById(@Param("id") id: string): Promise<ItemResponseDto> {
    return toItemResponse(await this.getItemUseCase.execute(id));
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
