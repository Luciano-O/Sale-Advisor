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
  ServiceUnavailableException,
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
const justificationSchema = z.object({ justification: z.string().trim().min(5).max(1_000) });
const correctionSchema = justificationSchema.extend({
  changes: z.record(z.string(), z.unknown())
});
const mergeSchema = justificationSchema.extend({ sourceOfferIds: z.array(z.uuid()).min(1) });
const splitSchema = justificationSchema.extend({ mentionIds: z.array(z.uuid()).min(1) });
const aliasSchema = justificationSchema.extend({
  productId: z.uuid(),
  alias: z.string().trim().min(2).max(160)
});
const blockSchema = justificationSchema.extend({ blocked: z.boolean() });

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
  getHealth() {
    return this.getReadiness();
  }

  @Get("live")
  getLiveness() {
    return { status: "ok", service: "api" };
  }

  @Get("ready")
  async getReadiness() {
    try {
      const health = await this.repository.health();
      return { status: "ok", database: this.repository.kind, ...health };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        checks: { database: "down", redis: "down" }
      });
    }
  }
}

@Controller("v1/admin")
@UseGuards(AdminKeyGuard)
export class AdminController {
  constructor(@Inject(API_REPOSITORY) private readonly repository: ApiRepository) {}

  @Get("dashboard")
  dashboard() {
    return this.repository.adminDashboard();
  }

  @Get("integrations")
  integrations() {
    return this.repository.adminIntegrations();
  }

  @Get("messages")
  async messages() {
    return { items: await this.repository.adminList("messages") };
  }

  @Get("offers")
  async offers() {
    return { items: await this.repository.adminList("offers") };
  }

  @Get("products")
  async products() {
    return { items: await this.repository.adminList("products") };
  }

  @Get("sources")
  async sources() {
    return { items: await this.repository.adminList("sources") };
  }

  @Get("audit")
  async audit() {
    return { items: await this.repository.adminList("audit") };
  }

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

  @Post("messages/:id/reprocess")
  reprocess(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("message.reprocess", {
      id,
      ...parse(justificationSchema, body)
    });
  }

  @Put("messages/:id/correction")
  @HttpCode(200)
  correct(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("message.correct", {
      id,
      ...parse(correctionSchema, body)
    });
  }

  @Post("offers/:id/merge")
  merge(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("offer.merge", { id, ...parse(mergeSchema, body) });
  }

  @Post("offers/:id/split")
  split(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("offer.split", { id, ...parse(splitSchema, body) });
  }

  @Post("aliases")
  alias(@Body() body: unknown) {
    return this.repository.adminAction("alias.create", parse(aliasSchema, body));
  }

  @Put("sources/:id/block")
  @HttpCode(200)
  blockSource(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("source.block", { id, ...parse(blockSchema, body) });
  }

  @Put("stores/:id/block")
  @HttpCode(200)
  blockStore(@Param("id") id: string, @Body() body: unknown) {
    return this.repository.adminAction("store.block", { id, ...parse(blockSchema, body) });
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
