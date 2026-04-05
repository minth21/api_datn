import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const userCount = await prisma.user.count()
  console.log(`Total users in DB: ${userCount}`)
  
  const testCount = await prisma.test.count()
  console.log(`Total tests in DB: ${testCount}`)

  const partCount = await prisma.part.count()
  console.log(`Total parts in DB: ${partCount}`)

  const questionCount = await prisma.question.count()
  console.log(`Total questions in DB: ${questionCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
