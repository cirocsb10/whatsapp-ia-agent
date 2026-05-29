import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI, { toFile } from "openai";
import { Readable } from "stream";

@Injectable()
export class WhisperClient {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(WhisperClient.name);

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: config.get<string>("openai.apiKey") });
  }

  async transcribe(audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<string> {
    const model = this.config.get<string>("openai.whisperModel") ?? "whisper-1";
    const audioFile = await toFile(Readable.from(audioBuffer), "audio.ogg", { type: mimeType });

    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model,
      language: "pt",
      response_format: "text",
      prompt: "Transcrição de áudio de cliente em conversa com assistente de vendas.",
    });

    this.logger.debug(`Transcribed ${audioBuffer.length} bytes`);
    return response;
  }
}
