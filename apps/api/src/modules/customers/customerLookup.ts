import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type CustomerLookupInput = {
  chatName: string;
  customerKey?: string;
  customerPhone?: string;
};

function getCustomerLookupWhere(input: CustomerLookupInput) {
  const customerPhone = input.customerPhone?.trim();
  const customerKey = input.customerKey?.trim();

  return customerPhone
    ? { phoneRaw: customerPhone }
    : customerKey
      ? { phoneHash: customerKey }
      : { displayName: input.chatName };
}

export async function findCustomerByLookup(input: CustomerLookupInput) {
  return prisma.customer.findFirst({
    where: getCustomerLookupWhere(input),
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function findOrCreateCustomer(
  transaction: Prisma.TransactionClient,
  input: CustomerLookupInput
) {
  const customerPhone = input.customerPhone?.trim();
  const customerKey = input.customerKey?.trim();

  const existingCustomer = await transaction.customer.findFirst({
    where: getCustomerLookupWhere(input),
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (existingCustomer) {
    return existingCustomer;
  }

  return transaction.customer.create({
    data: {
      displayName: input.chatName,
      phoneRaw: customerPhone,
      phoneHash: customerKey
    }
  });
}
