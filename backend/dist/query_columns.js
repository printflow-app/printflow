"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const columns = await prisma.kanbanColumn.findMany();
    console.log(JSON.stringify(columns, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=query_columns.js.map