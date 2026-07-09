import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ConfigService } from "@nestjs/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(cipherText: string, key: Buffer): string {
  const [ivB64, authTagB64, dataB64] = cipherText.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Formato de senha criptografada inválido");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function getEncryptionKey(config: ConfigService): Buffer {
  const raw = config.get<string>("SETTINGS_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY não configurada. Gere com: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY deve decodificar para exatamente 32 bytes (openssl rand -base64 32)",
    );
  }
  return key;
}
