import type { Prisma } from "@prisma/client";

export type CustomerLookupInput = {
  chatName: string;
  customerKey?: string;
  customerPhone?: string;
};

export async function findOrCreateCustomer(
  transaction: Prisma.TransactionClient,
  input: CustomerLookupInput
) {
  const customerPhone = input.customerPhone?.trim();
  const customerKey = input.customerKey?.trim();
  const where = customerPhone
    ? { phoneRaw: customerPhone }
    : customerKey
      ? { phoneHash: customerKey }
      : { displayName: input.chatName };

  const existingCustomer = await transaction.customer.findFirst({
    where,
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
