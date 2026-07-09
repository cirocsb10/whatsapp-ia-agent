import ky from "ky";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export const apiClient = ky.create({
  prefix: API_BASE,
});
