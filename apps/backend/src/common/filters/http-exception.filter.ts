import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Request, Response } from "express";

interface ErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorBody = this.normalizeException(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(errorBody.message, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        code: errorBody.code,
        message: errorBody.message,
        details: errorBody.details
      },
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
  }

  private normalizeException(exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as string | ErrorResponse;

      if (typeof response === "string") {
        return {
          code: exception.name,
          message: response,
          details: undefined
        };
      }

      const messages = Array.isArray(response.message) ? response.message : response.message ? [response.message] : [];

      return {
        code: response.code ?? response.error ?? exception.name,
        message: messages[0] ?? exception.message,
        details: messages.length > 1 ? messages : undefined
      };
    }

    return {
      code: status === HttpStatus.INTERNAL_SERVER_ERROR ? "InternalServerError" : "Error",
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? "Internal server error" : "Request failed",
      details: undefined
    };
  }
}
