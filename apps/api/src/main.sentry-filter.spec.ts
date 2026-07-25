import { ArgumentsHost, UnauthorizedException } from "@nestjs/common";
import type { HttpServer } from "@nestjs/common/interfaces";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";

/**
 * Regression: SentryGlobalFilter must receive the Nest httpAdapter (see main.ts).
 * Without it, BaseExceptionFilter.catch throws on 401 (isHeadersSent of undefined).
 */
describe("SentryGlobalFilter adapter wiring", () => {
  function createHttpHost() {
    const response = { headersSent: false };
    const reply = jest.fn();
    const httpAdapter = {
      isHeadersSent: jest.fn(() => response.headersSent),
      reply,
      end: jest.fn(),
    };
    const host = {
      getType: () => "http",
      getArgByIndex: (index: number) => (index === 1 ? response : undefined),
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;

    return { host, httpAdapter, reply, response };
  }

  it("handles UnauthorizedException without secondary errors when httpAdapter is wired", () => {
    const { host, httpAdapter, reply } = createHttpHost();
    const filter = new SentryGlobalFilter(httpAdapter as unknown as HttpServer);

    expect(() =>
      filter.catch(new UnauthorizedException("Invalid credentials"), host),
    ).not.toThrow();

    expect(httpAdapter.isHeadersSent).toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statusCode: 401,
        message: "Invalid credentials",
      }),
      401,
    );
  });

  it("documents main.ts requirement: filter needs httpAdapter in constructor", () => {
    const { host } = createHttpHost();
    const filterWithoutAdapter = new SentryGlobalFilter(undefined as never);

    expect(() =>
      filterWithoutAdapter.catch(new UnauthorizedException(), host),
    ).toThrow(/isHeadersSent/);
  });
});
