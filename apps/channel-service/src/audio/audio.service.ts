import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WhisperClient } from "./whisper.client";
import axios from "axios";
import { Client as MinioClient } from "minio";
import { randomUUID } from "crypto";

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);
  private readonly minio: MinioClient;

  constructor(
    private readonly config: ConfigService,
    private readonly whisper: WhisperClient,
  ) {
    this.minio = new MinioClient({
      endPoint: config.get("storage.endpoint") as string,
      port: config.get("storage.port") as number,
      useSSL: config.get("storage.useSSL") as boolean,
      accessKey: config.get("storage.accessKey") as string,
      secretKey: config.get("storage.secretKey") as string,
    });
  }

  async downloadAndTranscribe(
    mediaId: string,
    phoneNumberId: string,
  ): Promise<{ audioUrl: string; transcript: string }> {
    this.logger.log(`Processing audio: mediaId=${mediaId}`);
    const audioBuffer = await this.downloadFromMeta(mediaId);
    const audioUrl = await this.uploadToStorage(audioBuffer, mediaId, "audio/ogg", "audio", "ogg");
    const transcript = await this.whisper.transcribe(audioBuffer, "audio/ogg");
    return { audioUrl, transcript };
  }

  async downloadImageAndStore(mediaId: string): Promise<string> {
    this.logger.log(`Processing image: mediaId=${mediaId}`);
    const buffer = await this.downloadFromMeta(mediaId);
    return this.uploadToStorage(buffer, mediaId, "image/jpeg", "image", "jpg");
  }

  async downloadDocumentAndStore(mediaId: string, filename: string): Promise<string> {
    this.logger.log(`Processing document: mediaId=${mediaId}`);
    const buffer = await this.downloadFromMeta(mediaId);
    const ext = this.sanitizeExtension(filename.split(".").pop());
    return this.uploadToStorage(buffer, mediaId, "application/octet-stream", "document", ext);
  }

  private sanitizeExtension(rawExt: string | undefined): string {
    if (rawExt && /^[a-zA-Z0-9]{1,10}$/.test(rawExt)) {
      return rawExt.toLowerCase();
    }
    return "bin";
  }

  private async downloadFromMeta(mediaId: string): Promise<Buffer> {
    const base = this.config.get<string>("meta.graphApiBaseUrl");
    const version = this.config.get<string>("meta.graphApiVersion");
    const token = process.env["META_SYSTEM_USER_TOKEN"] ?? "";

    const urlResp = await axios.get(`${base}/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const audioResp = await axios.get(urlResp.data.url as string, {
      responseType: "arraybuffer",
      headers: { Authorization: `Bearer ${token}` },
    });

    return Buffer.from(audioResp.data as ArrayBuffer);
  }

  private async uploadToStorage(
    buffer: Buffer,
    mediaId: string,
    mimeType: string,
    folder: string,
    ext: string,
  ): Promise<string> {
    const bucket = this.config.get<string>("storage.bucket") as string;
    const safeMediaId = mediaId.replace(/[^a-zA-Z0-9_-]/g, "");
    const objectName = `${folder}/${randomUUID()}-${safeMediaId}.${ext}`;

    await this.minio.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": mimeType,
    });

    return this.minio.presignedGetObject(bucket, objectName, 3600);
  }
}
