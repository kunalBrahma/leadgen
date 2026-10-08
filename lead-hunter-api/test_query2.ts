import prisma from "./src/config/prisma";
async function test() {
  console.log("Starting findMany");
  try {
    const leads = await prisma.lead.findMany({
      where: {}, skip: 0, take: 50, orderBy: { intentScore: { sort: 'desc', nulls: 'last' } }
    });
    console.log("findMany success", leads.length);
  } catch (e) {
    console.error("error", e);
  }
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
