import { type ArgumentsHost, BadRequestException, HttpStatus } from "@nestjs/common";
import type { ILogger } from "@common/logger/logger.interface";
import { InvalidItemPriceError } from "@domain/entities/item.entity";
import { ItemAlreadyExistsError, ItemNotFoundError } from "@domain/errors/item.errors";
import { InvalidDimensionsError } from "@domain/value-objects/dimensions.value-object";
import { type ErrorResponseBody, GlobalExceptionFilter } from "./global-exception.filter";

interface Captured {
  status?: number;
  body?: ErrorResponseBody;
}

function hostCapturing(captured: Captured): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: ErrorResponseBody) {
      captured.body = body;
      return this;
    },
  };
  const host: Pick<ArgumentsHost, "switchToHttp"> = {
    switchToHttp: () => ({
      getResponse: <T>() => response as T,
      getRequest: <T>() => ({}) as T,
      getNext: <T>() => (() => undefined) as T,
    }),
  };
  return host as ArgumentsHost;
}

function silentLogger(): ILogger & { error: jest.Mock } {
  return { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

function run(exception: unknown, logger: ILogger = silentLogger()): Captured {
  const captured: Captured = {};
  new GlobalExceptionFilter(logger).catch(exception, hostCapturing(captured));
  return captured;
}

describe("GlobalExceptionFilter", () => {
  it.each([
    [new ItemNotFoundError("x"), HttpStatus.NOT_FOUND],
    [new ItemAlreadyExistsError("BOX-001"), HttpStatus.CONFLICT],
    [new InvalidItemPriceError(), HttpStatus.UNPROCESSABLE_ENTITY],
    [new InvalidDimensionsError("lengthCm invalido"), HttpStatus.UNPROCESSABLE_ENTITY],
  ])("mapeia %p para %p", (error, status) => {
    const { status: sent, body } = run(error);

    expect(sent).toBe(status);
    expect(body).toEqual({ statusCode: status, error: error.name, message: error.message });
  });

  it("repassa HttpException como esta (400 do ValidationPipe)", () => {
    const { status, body } = run(new BadRequestException(["sku must be a string"]));

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: ["sku must be a string"],
    });
  });

  it("responde 500 generico sem vazar detalhes e loga o erro original", () => {
    const logger = silentLogger();
    const original = new Error("connect ECONNREFUSED 127.0.0.1:5433");

    const { status, body } = run(original, logger);

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body?.message).toBe("Erro interno");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), original);
  });
});
