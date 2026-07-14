import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  anonymousEventBatchSchema,
  importMessageSchema,
  installationSchema,
  offerCursorSchema,
  offerScoreLabelSchema
} from "@sale-advisor/contracts";
import type { ImportMessage } from "@sale-advisor/contracts";
import { z } from "zod";

import { AdminKeyGuard } from "./admin-key.guard.js";
import { API_REPOSITORY, type ApiRepository } from "./repository.js";

const importEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({ name: z.string().trim().min(1).max(120), kind: z.literal("import") }),
  notifyEligible: z.boolean().default(false),
  messages: z.array(z.unknown()).min(1).max(1_000)
});
const preferencesSchema = z.object({
  category: z.literal("GPU"),
  minimumLabel: offerScoreLabelSchema
});
const pushTargetSchema = z.object({
  target: z.string().trim().min(1).nullable(),
  enabled: z.boolean()
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({ message: "validation_failed", issues: result.error.issues });
  return result.data;
}

@Controller("v1/health")
export class HealthController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}
  @Get()
  async getHealth() {
    const health = await this.repository.health();
    return { status: "ok", database: this.repository.kind, ...health };
  }
}

@Controller("v1/admin")
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}

  @Post("messages")
  async createManualMessage(@Body() body: unknown) {
    const message = parse(importMessageSchema, body);
    const result = await this.repository.importMessages({
      source: { name: "Cadastro manual", kind: "manual" },
      notifyEligible: true,
      messages: [message]
    });
    return { ...result, messageId: result.messageIds[0], status: "pending", notifyEligible: true };
  }

  @Post("imports")
  async createImport(@Body() body: unknown) {
    const envelope = parse(importEnvelopeSchema, body);
    const messages: ImportMessage[] = [];
    const rejections: Array<{ index: number; issues: unknown }> = [];
    envelope.messages.forEach((value, index) => {
      const parsed = importMessageSchema.safeParse(value);
      if (parsed.success) messages.push(parsed.data);
      else rejections.push({ index, issues: parsed.error.issues });
    });
    const result =
      messages.length > 0
        ? await this.repository.importMessages({
            source: envelope.source,
            notifyEligible: envelope.notifyEligible,
            messages
          })
        : { batchId: crypto.randomUUID(), messageIds: [] };
    const status =
      messages.length === 0 ? "failed" : rejections.length > 0 ? "partial" : "completed";
    return {
      ...result,
      status,
      notifyEligible: envelope.notifyEligible,
      acceptedCount: messages.length,
      rejectedCount: rejections.length,
      rejections
    };
  }
}

@Controller("v1/offers")
export class OffersController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}
  @Get()
  async list(@Query() query: unknown) {
    return this.repository.listOffers(parse(offerCursorSchema, query));
  }
  @Get(":id")
  async detail(@Param("id") id: string) {
    const offer = await this.repository.findOffer(id);
    if (!offer) throw new NotFoundException();
    return offer;
  }
}

@Controller("v1/installations")
export class InstallationsController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}
  @Post()
  async upsert(@Body() body: unknown) {
    const installation = parse(installationSchema, body);
    await this.repository.upsertInstallation(installation);
    return { id: installation.id };
  }
  @Put(":id/push-target")
  @HttpCode(200)
  async pushTarget(@Param("id") id: string, @Body() body: unknown) {
    if (!(await this.repository.updatePushTarget(id, parse(pushTargetSchema, body))))
      throw new NotFoundException();
    return { updated: true };
  }
  @Put(":id/notification-preferences")
  @HttpCode(200)
  async preferences(@Param("id") id: string, @Body() body: unknown) {
    if (!(await this.repository.updatePreferences(id, parse(preferencesSchema, body))))
      throw new NotFoundException();
    return { updated: true };
  }
}

@Controller("v1/events")
export class EventsController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}
  @Post("batch")
  async batch(@Body() body: unknown) {
    const batch = parse(anonymousEventBatchSchema, body);
    return { acceptedCount: await this.repository.addEvents(batch.events) };
  }
}
