import { deployDebateContract, getDebateInfo, getServerClient } from '../lib/genlayer-client';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentConfig {
  network: 'studio' | 'mainnet';
  rpcUrl: string;
  chainId: number;
}

const NETWORKS: Record<string, DeploymentConfig> = {
  studio: {
    network: 'studio',
    rpcUrl: 'https://studio.genlayer.com/api',
    chainId: 61999,
  }
};

const TEST_DEBATE = {
  topic: 'Template Debate Contract',
  description: 'This is a template contract deployment for testing and reference purposes.',
  durationHours: 24,
};

async function deployContract(network: string): Promise<void> {
  console.log('🚀 Starting contract deployment...\n');

  const config = NETWORKS[network];
  if (!config) {
    console.error(`❌ Invalid network: ${network}`);
    console.error(`   Available networks: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
  }

  console.log(`📡 Network: ${config.network}`);
  console.log(`🔗 RPC URL: ${config.rpcUrl}`);
  console.log(`🆔 Chain ID: ${config.chainId}\n`);

  if (config.network === 'mainnet') {
    console.log('⚠️  WARNING: You are about to deploy to MAINNET!');
    console.log('⚠️  Make sure you have completed the security audit checklist.');
    console.log('⚠️  See CONTRACT_AUDIT_CHECKLIST.md for details.\n');
  }

  try {
    console.log('🔌 Connecting to GenLayer network...');
    const client = await getServerClient();
    console.log('✅ Connected successfully\n');

    console.log('📝 Deploying contract with parameters:');
    console.log(`   Topic: ${TEST_DEBATE.topic}`);
    console.log(`   Description: ${TEST_DEBATE.description}`);
    console.log(`   Duration: ${TEST_DEBATE.durationHours} hours (${TEST_DEBATE.durationHours * 60} minutes)\n`);

    console.log('⏳ Deploying... (this may take a few minutes)\n');

    const result = await deployDebateContract(
      client,
      TEST_DEBATE.topic,
      TEST_DEBATE.description,
      TEST_DEBATE.durationHours * 60
    );

    console.log('✅ Contract deployed successfully!\n');
    console.log(`📍 Contract Address: ${result.contractAddress}`);
    console.log(`🔗 Transaction Hash: ${result.transactionHash}\n`);

    console.log('🔍 Verifying deployment...\n');

    const info = await getDebateInfo(result.contractAddress);

    console.log('✅ Verification successful!\n');
    console.log('📊 Contract Details:');
    console.log(`   Topic: ${info.topic}`);
    console.log(`   Description: ${info.description}`);
    console.log(`   Creator: ${info.creator}`);
    console.log(`   Status: ${info.status}`);
    console.log(`   Created At: ${new Date(info.created_at * 1000).toISOString()}`);
    console.log(`   End Time: ${new Date(info.end_time * 1000).toISOString()}`);
    console.log(`   Participants: ${info.participant_count}\n`);

    const deploymentInfo = {
      network: config.network,
      contractAddress: result.contractAddress,
      transactionHash: result.transactionHash,
      deployedAt: new Date().toISOString(),
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      contractDetails: info,
    };

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${config.network}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

    console.log(`💾 Deployment info saved to: ${filepath}\n`);

    console.log('📋 Next Steps:');
    console.log('   1. Verify contract on block explorer (if available)');
    console.log('   2. Test all contract methods');
    console.log('   3. Update environment variables with contract address');
    console.log('   4. Update documentation with deployment details');
    console.log('   5. Notify team of successful deployment\n');

    console.log('✨ Deployment complete!\n');

  } catch (error) {
    console.error('❌ Deployment failed!\n');
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check network connectivity');
    console.error('   2. Verify RPC URL is correct');
    console.error('   3. Ensure wallet has sufficient funds');
    console.error('   4. Check contract code for errors');
    console.error('   5. Review deployment logs for details\n');

    process.exit(1);
  }
}

function parseArgs(): string {
  const args = process.argv.slice(2);

  const networkIndex = args.indexOf('--network');
  if (networkIndex === -1 || networkIndex === args.length - 1) {
    console.error('❌ Missing --network argument');
    console.error('Usage: npm run deploy:contract -- --network <studio|mainnet>');
    process.exit(1);
  }

  return args[networkIndex + 1];
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Debate Room - Smart Contract Deployment Tool      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const network = parseArgs();
  await deployContract(network);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { deployContract };
