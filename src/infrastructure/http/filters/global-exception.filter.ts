import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Response } from "express";
import { type ILogger, LOGGER_TOKEN } from "@common/logger/logger.interface";
import {
  DomainError,
  EntityConflictError,
  EntityNotFoundError,
  InvariantViolationError,
} from "@domain/errors/domain.error";

export interface ErrorResponseBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string | string[];
}

// Ponto unico de traducao erro -> HTTP. Erros de dominio viram 404/409/422,
// HttpException (inclusive os 400 do ValidationPipe) passa como esta, e
// qualquer outra coisa vira 500 generico: o detalhe fica so no log.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER_TOKEN) private readonly logger: ILogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: statusForDomainError(exception),
        error: exception.name,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      return fromHttpException(exception);
    }

    this.logger.error(
      "Erro nao tratado na requisicao HTTP",
      exception instanceof Error ? exception : new Error(String(exception)),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "Erro interno",
    };
  }
}

function statusForDomainError(error: DomainError): HttpStatus {
  if (error instanceof EntityNotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof EntityConflictError) return HttpStatus.CONFLICT;
  if (error instanceof InvariantViolationError) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  return HttpStatus.BAD_REQUEST;
}

function fromHttpException(exception: HttpException): ErrorResponseBody {
  const statusCode = exception.getStatus();
  const raw = exception.getResponse();

  if (typeof raw === "object" && raw !== null && "message" in raw) {
    const message = raw.message;
    const error = "error" in raw && typeof raw.error === "string" ? raw.error : exception.name;
    if (typeof message === "string" || isStringArray(message)) {
      return { statusCode, error, message };
    }
  }

  return { statusCode, error: exception.name, message: exception.message };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
