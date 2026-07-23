// Loads .env since standalone tsx scripts don't get this from Next.js automatically
import 'dotenv/config'
// Adjust this import path to match where your shared Prisma client lives
// (the one that wires up the driver adapter, e.g. lib/prisma.ts)
import { prisma } from '../lib/prisma'

async function main() {
  console.log('--- Test 1: duplicate email should fail ---')
  try {
    await prisma.participant.create({ data: { full_name: 'Test A', email: 'duplicate@test.com' } })
    await prisma.participant.create({ data: { full_name: 'Test B', email: 'duplicate@test.com' } })
    console.log('FAIL: duplicate email was allowed')
  } catch (e) {
    console.log('PASS: duplicate email rejected')
  }

  console.log('--- Test 2: two null emails should NOT conflict ---')
  try {
    await prisma.participant.create({ data: { full_name: 'Test C', phone: '111' } })
    await prisma.participant.create({ data: { full_name: 'Test D', phone: '222' } })
    console.log('PASS: two participants with no email created fine')
  } catch (e) {
    console.log('FAIL: null emails incorrectly conflicted', e)
  }

  console.log('--- Test 3: duplicate enrollment should fail ---')
  const program = await prisma.program.findFirst()
  const participant = await prisma.participant.findFirst()
  if (program && participant) {
    try {
      await prisma.enrollment.create({ data: { participant_id: participant.id, program_id: program.id, status: 'registered' } })
      await prisma.enrollment.create({ data: { participant_id: participant.id, program_id: program.id, status: 'registered' } })
      console.log('FAIL: duplicate enrollment was allowed')
    } catch (e) {
      console.log('PASS: duplicate enrollment rejected')
    }
  }
}

main().finally(() => prisma.$disconnect())