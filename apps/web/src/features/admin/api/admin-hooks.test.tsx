/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();

jest.mock("@/shared/api/fetcher", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { useSystemLog } from "../api/system-log";
import { usePlatformSettings, useSavePlatformSettings } from "../api/platform-settings";
import { usePlansOverview, useOverridePlan } from "../api/plans";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("admin API hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("useSystemLog monta query com filtros", async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 });

    const { result } = renderHook(
      () => useSystemLog({ method: "GET", endpoint: "/auth" }, 2, 50),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringMatching(/\/super-admin\/system-log\?.*method=GET.*endpoint=%2Fauth/),
    );
  });

  it("usePlatformSettings e useSavePlatformSettings batem nos endpoints", async () => {
    mockGet.mockResolvedValue({ maintenanceMode: false });
    mockPut.mockResolvedValue({ maintenanceMode: true });

    const settings = renderHook(() => usePlatformSettings(), { wrapper: wrapper() });
    await waitFor(() => expect(settings.result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/super-admin/settings");

    const save = renderHook(() => useSavePlatformSettings(), { wrapper: wrapper() });
    save.result.current.mutate({ maintenanceMode: true });
    await waitFor(() => expect(save.result.current.isSuccess).toBe(true));
    expect(mockPut).toHaveBeenCalledWith("/super-admin/settings", {
      maintenanceMode: true,
    });
  });

  it("usePlansOverview e useOverridePlan batem nos endpoints", async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
    mockPost.mockResolvedValue({
      planType: "GROWTH",
      warning: "Assinatura Stripe não alterada",
    });

    const overview = renderHook(() => usePlansOverview(1), { wrapper: wrapper() });
    await waitFor(() => expect(overview.result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/super-admin/plans?page=1&limit=25");

    const override = renderHook(() => useOverridePlan(), { wrapper: wrapper() });
    override.result.current.mutate({ tenantId: "t1", planType: "GROWTH" });
    await waitFor(() => expect(override.result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith("/super-admin/plans/t1/override", {
      planType: "GROWTH",
      reason: undefined,
    });
  });
});
