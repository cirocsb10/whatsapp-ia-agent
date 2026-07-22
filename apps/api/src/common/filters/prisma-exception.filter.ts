import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nestjs";
import type { Response } from "express";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Database error";

    switch (exception.code) {
      case "P2002":
        status = HttpStatus.CONFLICT;
        message = `Unique constraint violation: ${(exception.meta?.target as string[])?.join(", ")}`;
        break;
      case "P2025":
        status = HttpStatus.NOT_FOUND;
        message = "Record not found";
        break;
      case "P2003":
        status = HttpStatus.BAD_REQUEST;
        message = "Foreign key constraint violation";
        break;
    }

    this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
    Sentry.captureException(exception);

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
