import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { CreateItemUseCase } from "@application/use-cases/create-item.use-case";
import { GetItemUseCase } from "@application/use-cases/get-item.use-case";
import { ListItemsUseCase } from "@application/use-cases/list-items.use-case";
import { CorrelationId } from "./decorators/correlation-id.decorator";
import { CreateItemDto } from "./dto/create-item.dto";
import type {
  ItemResponseDto,
  PaginatedItemsResponseDto,
} from "./dto/item-response.dto";
import {
  toItemResponse,
  toPaginatedItemsResponse,
} from "./mappers/item-response.mapper";
import { IdempotencyInterceptor } from "./interceptors/idempotency.interceptor";

// Throttler "createItem" (limite proprio, via env) vale so para o POST; o
// "default" vale para todas as rotas.
@Controller("items")
@SkipThrottle({ createItem: true })
export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly getItemUseCase: GetItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase,
  ) {}

  @Post()
  @SkipThrottle({ createItem: false })
  @UseInterceptors(IdempotencyInterceptor)
  async create(
    @Body() dto: CreateItemDto,
    @CorrelationId() correlationId: string,
  ): Promise<ItemResponseDto> {
    const item = await this.createItemUseCase.execute(dto, { correlationId });
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
