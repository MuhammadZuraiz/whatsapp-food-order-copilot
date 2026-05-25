import type { BrandStyleProfile } from "@prisma/client";
import type {
  BrandStyleAnalyzeRequest,
  BrandStyleProfileDto
} from "@wfo/shared";
import { AiService } from "../../ai/AiService.js";
import type { BrandStyleAnalysisResult } from "../../ai/types.js";
import { prisma } from "../../db/prisma.js";
import { parseJsonField, toJsonField } from "../../utils/jsonFields.js";

type BrandStyleSaveInput = {
  toneSummary: string | null;
  commonPhrases: string[];
  doRules: string[];
  dontRules: string[];
  exampleReplies: string[];
};

const requiredDoRules = [
  "Ask for missing delivery details clearly.",
  "Keep replies concise and human-approved.",
  "Confirm availability before finalizing scheduled delivery orders.",
  "Separate payment method from payment confirmation."
];

const requiredDontRules = [
  "Do not auto-send WhatsApp messages.",
  "Do not confirm incomplete orders.",
  "Do not say payment is confirmed unless manually verified.",
  "Do not overpromise availability."
];

const riskyStylePhrasePattern =
  /\b(proceed|confirm order receipt|confirm the order|order confirmed|your order is confirmed|payment received|prepared accordingly|ready to confirm|finali[sz]e)\b/i;

const riskyStylePhraseGlobalPattern =
  /\b(proceed|confirm order receipt|confirm the order|order confirmed|your order is confirmed|payment received|prepared accordingly|ready to confirm|finali[sz]e)\b/gi;

function normalizeForDedupe(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeForDedupe(trimmed);

    if (!trimmed || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueValues.push(trimmed);
  }

  return uniqueValues;
}

function trimText(value: string, maxLength = 180) {
  const compacted = value.replace(/\s+/g, " ").trim();

  return compacted.length > maxLength
    ? `${compacted.slice(0, maxLength - 3)}...`
    : compacted;
}

function redactStyleExample(value: string) {
  return trimText(
    value
      .replace(/https?:\/\/\S+/gi, "[link]")
      .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
  );
}

function getOpeningPhrase(text: string) {
  const match = text.trim().match(/^(sure|please|noted|thanks|thank you|we accept|i can|i'll|i will|yes|no problem)\b/i);

  return match?.[0] ?? null;
}

function stripRiskyToneSummary(value: string | null) {
  if (!value) {
    return null;
  }

  if (riskyStylePhrasePattern.test(value)) {
    return "Warm, concise, polite, helpful food-order tone.";
  }

  const cleaned = trimText(value)
    .replace(/\bconfirmation-oriented\b/gi, "careful")
    .replace(riskyStylePhraseGlobalPattern, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Warm, concise, polite food-order tone.";
}

function isUnsafeStylePhrase(value: string) {
  return riskyStylePhrasePattern.test(value);
}

function isLowQualityExample(value: string) {
  const trimmed = value.trim();

  return (
    trimmed.length < 8 ||
    /^\.{2,}$/.test(trimmed) ||
    /\.{2,}/.test(trimmed) ||
    /\b\w{1,8}\.{3,}$/i.test(trimmed) ||
    /[a-z]\.{3,}\s*$/i.test(trimmed)
  );
}

function cleanExamples(values: string[]) {
  return unique(
    values
      .map(redactStyleExample)
      .filter((value) => !isUnsafeStylePhrase(value))
      .filter((value) => !isLowQualityExample(value))
  ).slice(0, 8);
}

export function sanitizeBrandStyleProfile(
  input: BrandStyleSaveInput
): BrandStyleSaveInput {
  return {
    toneSummary: stripRiskyToneSummary(input.toneSummary),
    commonPhrases: unique(input.commonPhrases)
      .filter((phrase) => !isUnsafeStylePhrase(phrase))
      .slice(0, 10),
    doRules: unique([...input.doRules, ...requiredDoRules])
      .filter((rule) => !isUnsafeStylePhrase(rule))
      .slice(0, 8),
    dontRules: unique([...input.dontRules, ...requiredDontRules]).slice(0, 8),
    exampleReplies: cleanExamples(input.exampleReplies)
  };
}

function buildFallbackBrandStyle(messages: string[]): BrandStyleSaveInput {
  const nonEmptyMessages = messages.map(trimText).filter(Boolean);
  const wordCounts = nonEmptyMessages.map((message) =>
    message.split(/\s+/).filter(Boolean).length
  );
  const averageWords =
    wordCounts.length > 0
      ? Math.round(
          wordCounts.reduce((total, count) => total + count, 0) /
            wordCounts.length
        )
      : 0;
  const commonPhrases = unique(
    nonEmptyMessages
      .map(getOpeningPhrase)
      .filter((phrase): phrase is string => phrase !== null)
  ).slice(0, 8);

  return {
    toneSummary:
      averageWords > 0
        ? `Warm, concise, polite food-order tone with replies averaging about ${averageWords} words.`
        : "Warm, concise, polite food-order tone.",
    commonPhrases,
    doRules: [
      "Ask for missing delivery details clearly.",
      "Keep replies concise and human-approved.",
      "Confirm availability before finalizing scheduled delivery orders.",
      "Separate payment method from payment confirmation."
    ],
    dontRules: [
      "Do not overpromise availability.",
      "Do not say payment is confirmed unless manually verified.",
      "Do not confirm incomplete orders.",
      "Do not auto-send WhatsApp messages."
    ],
    exampleReplies: nonEmptyMessages.map(redactStyleExample).slice(0, 4)
  };
}

function normalizeAnalysisResult(
  result: BrandStyleAnalysisResult,
  fallback: BrandStyleSaveInput
): BrandStyleSaveInput {
  return {
    toneSummary: result.toneSummary || fallback.toneSummary,
    commonPhrases: unique([
      ...result.commonPhrases,
      ...fallback.commonPhrases
    ]).slice(0, 10),
    doRules: unique([...result.doRules, ...fallback.doRules]).slice(0, 10),
    dontRules: unique([...result.dontRules, ...fallback.dontRules]).slice(
      0,
      10
    ),
    exampleReplies: unique(
      [...result.exampleReplies, ...fallback.exampleReplies].map(
        redactStyleExample
      )
    )
  };
}

function profileToDto(profile: BrandStyleProfile): BrandStyleProfileDto {
  return {
    id: profile.id,
    toneSummary: profile.toneSummary,
    commonPhrases: parseJsonField<string[]>(profile.commonPhrasesJson, []),
    doRules: parseJsonField<string[]>(profile.doRulesJson, []),
    dontRules: parseJsonField<string[]>(profile.dontRulesJson, []),
    exampleReplies: parseJsonField<string[]>(profile.exampleRepliesJson, []),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

async function saveBrandStyleProfile(input: BrandStyleSaveInput) {
  const sanitizedInput = sanitizeBrandStyleProfile(input);
  const existingProfile = await prisma.brandStyleProfile.findFirst({
    orderBy: {
      updatedAt: "desc"
    }
  });
  const data = {
    toneSummary: sanitizedInput.toneSummary,
    commonPhrasesJson: toJsonField(sanitizedInput.commonPhrases),
    doRulesJson: toJsonField(sanitizedInput.doRules),
    dontRulesJson: toJsonField(sanitizedInput.dontRules),
    exampleRepliesJson: toJsonField(sanitizedInput.exampleReplies)
  };

  if (existingProfile) {
    return prisma.brandStyleProfile.update({
      where: {
        id: existingProfile.id
      },
      data
    });
  }

  return prisma.brandStyleProfile.create({
    data
  });
}

export async function getCurrentBrandStyleProfile() {
  const profile = await prisma.brandStyleProfile.findFirst({
    orderBy: {
      updatedAt: "desc"
    }
  });

  return profile ? profileToDto(profile) : null;
}

export function formatBrandStyleContext(profile: BrandStyleProfileDto | null) {
  if (!profile) {
    return "Brand style profile: none saved yet.";
  }

  return [
    "Brand style profile for wording only:",
    profile.toneSummary ? `Tone: ${profile.toneSummary}` : null,
    profile.commonPhrases.length > 0
      ? `Common phrases: ${profile.commonPhrases.join(", ")}`
      : null,
    profile.doRules.length > 0 ? `Do: ${profile.doRules.join("; ")}` : null,
    profile.dontRules.length > 0
      ? `Don't: ${profile.dontRules.join("; ")}`
      : null,
    profile.exampleReplies.length > 0
      ? `Style examples: ${profile.exampleReplies.join(" | ")}`
      : null,
    "Safety, missing fields, product facts, and payment rules override style."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function analyzeAndSaveBrandStyleFromTexts(messages: string[]) {
  const cleanMessages = messages.map(trimText).filter(Boolean).slice(0, 200);
  const warnings: string[] = [];

  if (cleanMessages.length === 0) {
    return {
      updated: false,
      profile: await getCurrentBrandStyleProfile(),
      warnings: ["No business messages were available for brand style analysis."]
    };
  }

  const fallback = buildFallbackBrandStyle(cleanMessages);
  const service = new AiService();
  let styleInput = fallback;

  try {
    const result = await service.analyzeBrandStyle(cleanMessages.join("\n"));

    if (service.usedFallback) {
      warnings.push(
        "Brand style AI task failed; local style fallback was used."
      );
    } else {
      styleInput = normalizeAnalysisResult(result, fallback);
    }
  } catch {
    warnings.push("Brand style AI task failed; local style fallback was used.");
  }

  const savedProfile = await saveBrandStyleProfile(styleInput);

  return {
    updated: true,
    profile: profileToDto(savedProfile),
    warnings
  };
}

export async function analyzeBrandStyleFromStoredConversations(
  input: BrandStyleAnalyzeRequest
) {
  const normalizedBusinessNames = new Set(
    input.businessSenderNames.map((name) => name.toLocaleLowerCase().trim())
  );
  const messages = await prisma.message.findMany({
    where: input.conversationIds
      ? {
          conversationId: {
            in: input.conversationIds
          }
        }
      : undefined,
    include: {
      conversation: true
    },
    orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
    take: input.limit * 4
  });
  const businessMessages = messages
    .filter(
      (message) =>
        message.senderType === "business" ||
        (message.senderName
          ? normalizedBusinessNames.has(
              message.senderName.toLocaleLowerCase().trim()
            )
          : false)
    )
    .slice(0, input.limit)
    .reverse()
    .map((message) => message.messageText);

  return analyzeAndSaveBrandStyleFromTexts(businessMessages);
}
