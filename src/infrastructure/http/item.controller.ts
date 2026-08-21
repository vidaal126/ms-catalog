import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ItemEntity } from "../../domain/entities/item.entity";
import {
  IItemRepository,
  ITEM_REPOSITORY,
} from "../../domain/repositories/item.repository";
import { CreateItemDto } from "./dto/create-item.dto";

@Controller("items")
export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    @Inject(ITEM_REPOSITORY) private readonly itemRepository: IItemRepository,
  ) {}

  @Post()
  async create(@Body() dto: CreateItemDto) {
    return this.createItemUseCase.execute(dto);
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
      throw new NotFoundException(`Item com id ${id} não encontrado`);
    }
    return item;
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
